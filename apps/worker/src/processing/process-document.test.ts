import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// Imported first so its .env loading runs before @docly/database reads
// process.env.DATABASE_URL.
import '@docly/config';
import { prisma } from '@docly/database';
import { LocalStorageProvider, setStorageForTesting } from '@docly/storage';
import { UnrecoverableError } from 'bullmq';
import { GENERIC_FAILURE_MESSAGE, processDocument, recordFailure } from './process-document.js';
import { makeDocx, makePdf } from './fixtures.js';

// The whole pipeline against a real database and a real (temp-dir) storage:
// stored file -> extract -> chunk -> chunks saved -> status 'ready', plus the
// failure paths and their user-facing messages.
describe('processDocument', () => {
  let storageDir: string;
  let storage: LocalStorageProvider;
  let userId: string;
  let organizationId: string;
  let projectId: string;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  async function addDocument(filename: string, data: Buffer | null, ext = filename.split('.').pop()!) {
    const s3Key = `${organizationId}/${projectId}/${Math.random().toString(36).slice(2)}.${ext}`;
    if (data) await storage.upload(s3Key, data);
    const document = await prisma.document.create({
      data: { organizationId, projectId, uploadedById: userId, title: filename, filename, size: data?.length ?? 0, s3Key },
    });
    const job = await prisma.processingJob.create({ data: { documentId: document.id, jobType: 'extract' } });
    return { document, jobPayload: { documentId: document.id, organizationId, processingJobId: job.id }, jobId: job.id };
  }

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'docly-worker-test-'));
    storage = new LocalStorageProvider(storageDir);
    setStorageForTesting(storage);

    const user = await prisma.user.create({
      data: { email: `worker-test-${suffix}@example.com`, name: 'Worker Test', passwordHash: 'x' },
    });
    userId = user.id;
    const org = await prisma.organization.create({ data: { name: 'Worker Test Org', slug: `worker-test-${suffix}` } });
    organizationId = org.id;
    await prisma.organizationMember.create({ data: { userId, organizationId, role: 'OWNER' } });
    const project = await prisma.project.create({ data: { organizationId, name: 'Worker project', createdById: userId } });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    setStorageForTesting(null);
    await prisma.$disconnect();
    await rm(storageDir, { recursive: true, force: true });
  });

  it('processes a text file: chunks stored, text saved, status ready', async () => {
    const body = 'Paragraph about invoices. '.repeat(120);
    const { document, jobPayload, jobId } = await addDocument('notes.txt', Buffer.from(body));

    const result = await processDocument(jobPayload);

    const after = await prisma.document.findUniqueOrThrow({ where: { id: document.id } });
    expect(after.status).toBe('ready');
    expect(after.processingError).toBeNull();
    expect(after.textContent).toContain('Paragraph about invoices.');

    const chunks = await prisma.documentChunk.findMany({ where: { documentId: document.id }, orderBy: { chunkIndex: 'asc' } });
    expect(chunks.length).toBe(result.chunks);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
    expect(chunks.every((c) => c.text.length > 0 && c.text.length <= 1000)).toBe(true);

    const job = await prisma.processingJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.status).toBe('completed');

    const audit = await prisma.auditLog.findFirst({ where: { organizationId, action: 'document.processed', resourceId: projectId } });
    expect(audit).not.toBeNull();
  });

  it('processes PDF, Word and Markdown files', async () => {
    const pdf = await addDocument('report.pdf', makePdf('Annual report: revenue and costs'));
    const docx = await addDocument('plan.docx', await makeDocx(['Project plan phase one', 'Phase two']));
    const md = await addDocument('readme.md', Buffer.from('# Heading\n\nBody text here.'));

    for (const { jobPayload } of [pdf, docx, md]) await processDocument(jobPayload);

    const textOf = async (id: string) => (await prisma.document.findUniqueOrThrow({ where: { id } })).textContent;
    expect(await textOf(pdf.document.id)).toContain('Annual report');
    expect(await textOf(docx.document.id)).toContain('Project plan phase one');
    expect(await textOf(md.document.id)).toContain('Body text here.');
  });

  it('is idempotent: processing twice replaces chunks instead of duplicating them', async () => {
    const { document, jobPayload } = await addDocument('twice.txt', Buffer.from('Sentence number one. '.repeat(200)));
    const first = await processDocument(jobPayload);
    const second = await processDocument(jobPayload);

    expect(second.chunks).toBe(first.chunks);
    expect(await prisma.documentChunk.count({ where: { documentId: document.id } })).toBe(first.chunks);
  });

  it('fails permanently, with a clear message, for a corrupt PDF', async () => {
    const { document, jobPayload } = await addDocument('broken.pdf', Buffer.from('%PDF-1.4 not really a pdf'));

    const error = await processDocument(jobPayload).catch((e: Error) => e);
    expect(error).toBeInstanceOf(UnrecoverableError);
    expect((error as Error).message).toMatch(/could not be read/i);

    // Mid-processing the document is marked 'processing' until the failure is recorded.
    expect((await prisma.document.findUniqueOrThrow({ where: { id: document.id } })).status).toBe('processing');
    expect(await prisma.documentChunk.count({ where: { documentId: document.id } })).toBe(0);
  });

  it('fails permanently for a file with no extractable text', async () => {
    const { jobPayload } = await addDocument('blank.txt', Buffer.from('   \n  '));
    const error = await processDocument(jobPayload).catch((e: Error) => e);
    expect(error).toBeInstanceOf(UnrecoverableError);
    expect((error as Error).message).toMatch(/No text could be extracted/);
  });

  it('fails permanently when the stored file is missing', async () => {
    const { jobPayload } = await addDocument('gone.txt', null);
    const error = await processDocument(jobPayload).catch((e: Error) => e);
    expect(error).toBeInstanceOf(UnrecoverableError);
    expect((error as Error).message).toMatch(/stored file could not be found/);
  });

  it('gives up quietly when the document was deleted before processing', async () => {
    const { document, jobPayload } = await addDocument('deleted.txt', Buffer.from('soon gone'));
    await prisma.document.delete({ where: { id: document.id } });

    const error = await processDocument(jobPayload).catch((e: Error) => e);
    expect(error).toBeInstanceOf(UnrecoverableError);
    expect((error as Error).message).toMatch(/no longer exists/);
  });

  it('does not process a document through another organization id (tenant scoping)', async () => {
    const { jobPayload } = await addDocument('scoped.txt', Buffer.from('private'));
    const error = await processDocument({ ...jobPayload, organizationId: 'some-other-org' }).catch((e: Error) => e);
    expect(error).toBeInstanceOf(UnrecoverableError);
  });

  describe('recordFailure', () => {
    it('keeps the document processing and counts the retry while attempts remain', async () => {
      const { document, jobPayload, jobId } = await addDocument('retry.txt', Buffer.from('x'));
      await prisma.document.update({ where: { id: document.id }, data: { status: 'processing' } });

      const outcome = await recordFailure({
        job: jobPayload,
        error: new Error('ECONNRESET talking to storage'),
        attemptsMade: 1,
        maxAttempts: 3,
      });

      expect(outcome).toBe('retrying');
      expect((await prisma.document.findUniqueOrThrow({ where: { id: document.id } })).status).toBe('processing');
      const job = await prisma.processingJob.findUniqueOrThrow({ where: { id: jobId } });
      expect(job.status).toBe('pending');
      expect(job.retries).toBe(1);
    });

    it('marks the document failed once attempts are exhausted, with a generic user message', async () => {
      const { document, jobPayload, jobId } = await addDocument('exhausted.txt', Buffer.from('x'));

      const outcome = await recordFailure({
        job: jobPayload,
        error: new Error('password=hunter2 at /srv/internal/path.ts:42'),
        attemptsMade: 3,
        maxAttempts: 3,
      });

      expect(outcome).toBe('failed');
      const after = await prisma.document.findUniqueOrThrow({ where: { id: document.id } });
      expect(after.status).toBe('failed');
      // Internal error text must never reach the user.
      expect(after.processingError).toBe(GENERIC_FAILURE_MESSAGE);
      expect(after.processingError).not.toContain('hunter2');
      expect((await prisma.processingJob.findUniqueOrThrow({ where: { id: jobId } })).status).toBe('failed');
      expect(
        await prisma.auditLog.findFirst({ where: { organizationId, action: 'document.processing_failed' } })
      ).not.toBeNull();
    });

    it('fails immediately, with the file-specific message, on a permanent error', async () => {
      const { document, jobPayload } = await addDocument('permanent.txt', Buffer.from('x'));

      const outcome = await recordFailure({
        job: jobPayload,
        error: new UnrecoverableError('The PDF could not be read. It may be corrupt or password-protected.'),
        attemptsMade: 1,
        maxAttempts: 3,
      });

      expect(outcome).toBe('failed');
      const after = await prisma.document.findUniqueOrThrow({ where: { id: document.id } });
      expect(after.status).toBe('failed');
      expect(after.processingError).toBe('The PDF could not be read. It may be corrupt or password-protected.');
    });

    it('does nothing (and does not throw) when the document no longer exists', async () => {
      const { document, jobPayload } = await addDocument('vanished.txt', Buffer.from('x'));
      await prisma.document.delete({ where: { id: document.id } });
      await expect(
        recordFailure({ job: jobPayload, error: new UnrecoverableError('x'), attemptsMade: 1, maxAttempts: 3 })
      ).resolves.toBe('failed');
    });
  });
});
