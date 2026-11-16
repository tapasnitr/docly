import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
// Imported first so its .env loading runs before @docly/database reads
// process.env.DATABASE_URL (see auth.test.ts for the same pattern).
import '@docly/config';
import { prisma } from '@docly/database';
import { buildApp } from '../app.js';
import { sanitizeFilename } from '../lib/file-validation.js';
import { LocalStorageProvider, setStorageForTesting, StorageObjectNotFoundError } from '@docly/storage';
import { setDocumentQueueForTesting, type DocumentProcessingJob } from '@docly/jobs';
import { registerUser, authed, type TestUser } from './helpers.js';

interface DocRow {
  id: string;
  title: string;
  filename: string;
  mimeType: string;
  size: number;
  status: string;
  projectId: string;
  uploadedBy: { id: string };
}

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF\n');
// Smallest thing that satisfies the .docx check: a ZIP header plus the
// word/document.xml entry name.
const DOCX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('....word/document.xml....')]);

interface FilePart {
  filename: string;
  contentType: string;
  data: Buffer;
}

// Builds a multipart/form-data body by hand so tests need no extra deps.
function multipart(file: FilePart | null, fields: Record<string, string> = {}) {
  const boundary = `----docly-test-${Math.random().toString(36).slice(2)}`;
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)
    );
  }
  if (file) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\n` +
          `Content-Type: ${file.contentType}\r\n\r\n`
      ),
      file.data,
      Buffer.from('\r\n')
    );
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(chunks), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

async function filesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter((e) => e.isFile()).map((e) => join(e.parentPath ?? dir, e.name));
}

// Documents: upload validation, RBAC, tenant/project isolation, listing,
// download, deletion (and file cleanup) and the storage provider.
describe('Documents API', () => {
  let app: FastifyInstance;
  let api: ReturnType<typeof authed>;
  let storageDir: string;

  // Stands in for the BullMQ queue: records every published job, and can be
  // told to fail (to simulate Redis being down).
  const queued: DocumentProcessingJob[] = [];
  let queueShouldFail = false;

  const createdUserIds: string[] = [];
  const createdOrgIds = new Set<string>();

  async function makeUser(): Promise<TestUser> {
    const user = await registerUser(app);
    createdUserIds.push(user.userId);
    createdOrgIds.add(user.organizationId);
    return user;
  }

  // owner: org OWNER + project LEAD. contributor: project MEMBER.
  // reader: project VIEWER. stranger: org member outside the project.
  // outsider: a different organization.
  let owner: TestUser;
  let contributor: TestUser;
  let reader: TestUser;
  let stranger: TestUser;
  let outsider: TestUser;
  let orgId: string;
  let projectId: string;
  let otherProjectId: string;

  const docsUrl = (project = projectId) => `/api/v1/organizations/${orgId}/projects/${project}/documents`;

  function upload(user: TestUser | null, file: FilePart | null, fields: Record<string, string> = {}, project = projectId) {
    const { payload, headers } = multipart(file, fields);
    return app.inject({
      method: 'POST',
      url: docsUrl(project),
      payload,
      headers,
      cookies: user ? { docly_access_token: user.accessCookie } : undefined,
    });
  }

  async function uploadOk(user: TestUser, file: FilePart, fields: Record<string, string> = {}, project = projectId) {
    const response = await upload(user, file, fields, project);
    expect(response.statusCode, response.body).toBe(201);
    return response.json().data.document as DocRow;
  }

  const pdfFile = (name = 'report.pdf'): FilePart => ({ filename: name, contentType: 'application/pdf', data: PDF });

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'docly-test-storage-'));
    setStorageForTesting(new LocalStorageProvider(storageDir));
    setDocumentQueueForTesting({
      add: async (_name, data) => {
        if (queueShouldFail) throw new Error('redis unavailable');
        queued.push(data);
        return undefined;
      },
      close: async () => undefined,
    });

    app = await buildApp();
    await app.ready();
    api = authed(app);

    owner = await makeUser();
    contributor = await makeUser();
    reader = await makeUser();
    stranger = await makeUser();
    outsider = await makeUser();
    orgId = owner.organizationId;

    for (const user of [contributor, reader, stranger]) {
      const added = await api.post(`/api/v1/organizations/${orgId}/members`, owner, {
        email: user.email,
        role: 'MEMBER',
      });
      expect(added.statusCode).toBe(201);
    }

    projectId = (await api.post(`/api/v1/organizations/${orgId}/projects`, owner, { name: 'Docs project' })).json().data
      .project.id;
    otherProjectId = (await api.post(`/api/v1/organizations/${orgId}/projects`, owner, { name: 'Other docs' })).json()
      .data.project.id;

    for (const [user, role] of [
      [contributor, 'MEMBER'],
      [reader, 'VIEWER'],
    ] as const) {
      const added = await api.post(`/api/v1/organizations/${orgId}/projects/${projectId}/members`, owner, {
        userId: user.userId,
        role,
      });
      expect(added.statusCode).toBe(201);
    }
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [...createdOrgIds] } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
    setStorageForTesting(null);
    setDocumentQueueForTesting(null);
    await rm(storageDir, { recursive: true, force: true });
  });

  describe('POST /documents (upload)', () => {
    it('uploads a PDF, records its metadata and stores the file', async () => {
      const before = (await filesUnder(storageDir)).length;
      const doc = await uploadOk(contributor, pdfFile('Quarterly Report.pdf'));

      expect(doc.filename).toBe('Quarterly Report.pdf');
      expect(doc.title).toBe('Quarterly Report');
      expect(doc.mimeType).toBe('application/pdf');
      expect(doc.size).toBe(PDF.length);
      expect(doc.status).toBe('pending');
      expect(doc.uploadedBy.id).toBe(contributor.userId);
      expect(doc.projectId).toBe(projectId);
      expect(JSON.stringify(doc)).not.toContain('s3Key');
      expect((await filesUnder(storageDir)).length).toBe(before + 1);
    });

    it('accepts txt, md (even when sent as octet-stream) and docx', async () => {
      const txt = await uploadOk(owner, { filename: 'notes.txt', contentType: 'text/plain', data: Buffer.from('héllo wörld') });
      expect(txt.mimeType).toBe('text/plain');

      const md = await uploadOk(owner, {
        filename: 'readme.md',
        contentType: 'application/octet-stream',
        data: Buffer.from('# Title\n\nSome *markdown*.'),
      });
      expect(md.mimeType).toBe('text/markdown');

      const docx = await uploadOk(owner, {
        filename: 'Plan.DOCX',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        data: DOCX,
      });
      expect(docx.mimeType).toContain('wordprocessingml');
    });

    it('uses a custom title when one is sent before the file', async () => {
      const doc = await uploadOk(owner, pdfFile('x.pdf'), { title: '  Board deck  ' });
      expect(doc.title).toBe('Board deck');
    });

    it('rejects disallowed file types', async () => {
      for (const name of ['malware.exe', 'script.js', 'page.html', 'archive.zip', 'noextension']) {
        const response = await upload(owner, { filename: name, contentType: 'application/octet-stream', data: PDF });
        expect(response.statusCode, name).toBe(400);
      }
    });

    it('rejects a file whose content does not match its extension', async () => {
      const fakePdf = await upload(owner, {
        filename: 'fake.pdf',
        contentType: 'application/pdf',
        data: Buffer.from('this is definitely not a pdf'),
      });
      expect(fakePdf.statusCode).toBe(400);

      const zipWithoutWord = await upload(owner, {
        filename: 'fake.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        data: Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]),
      });
      expect(zipWithoutWord.statusCode).toBe(400);

      const binaryAsText = await upload(owner, {
        filename: 'binary.txt',
        contentType: 'text/plain',
        data: Buffer.from([0x68, 0x69, 0x00, 0x01, 0x02]),
      });
      expect(binaryAsText.statusCode).toBe(400);
    });

    it('rejects a declared MIME type that contradicts the extension', async () => {
      const response = await upload(owner, { filename: 'a.pdf', contentType: 'image/png', data: PDF });
      expect(response.statusCode).toBe(400);
    });

    it('rejects an empty file, a missing file, and a non-multipart request', async () => {
      expect((await upload(owner, { filename: 'e.txt', contentType: 'text/plain', data: Buffer.alloc(0) })).statusCode).toBe(400);
      expect((await upload(owner, null, { title: 'no file' })).statusCode).toBe(400);

      const json = await api.post(docsUrl(), owner, { title: 'json body' });
      expect(json.statusCode).toBe(400);
    });

    it('rejects a file over the size limit with 413', async () => {
      const tooBig = Buffer.alloc(11 * 1024 * 1024, 'a');
      const response = await upload(owner, { filename: 'big.txt', contentType: 'text/plain', data: tooBig });
      expect(response.statusCode).toBe(413);
    });

    it('never trusts the supplied filename for storage', async () => {
      const doc = await uploadOk(owner, { filename: '../../etc/evil.txt', contentType: 'text/plain', data: Buffer.from('hi') });
      expect(doc.filename).toBe('evil.txt');

      const row = await prisma.document.findUniqueOrThrow({ where: { id: doc.id } });
      expect(row.s3Key.startsWith(`${orgId}/${projectId}/`)).toBe(true);
      expect(row.s3Key).not.toContain('evil');
      expect(row.s3Key).not.toContain('..');
    });

    it('enforces roles and tenant isolation', async () => {
      expect((await upload(reader, pdfFile())).statusCode).toBe(403);
      expect((await upload(stranger, pdfFile())).statusCode).toBe(404);
      expect((await upload(outsider, pdfFile())).statusCode).toBe(404);
      expect((await upload(null, pdfFile())).statusCode).toBe(401);
    });
  });

  describe('listing', () => {
    let alpha: DocRow;

    beforeAll(async () => {
      alpha = await uploadOk(owner, pdfFile('zebra-budget.pdf'));
      await uploadOk(owner, pdfFile('zebra-plan.pdf'));
      await prisma.document.update({ where: { id: alpha.id }, data: { status: 'ready' } });
    });

    it('lists a project\'s documents (readable by a read-only member)', async () => {
      const response = await api.get(docsUrl(), reader);
      expect(response.statusCode).toBe(200);
      const { documents, pagination } = response.json().data as { documents: DocRow[]; pagination: { total: number } };
      expect(documents.length).toBeGreaterThan(0);
      expect(pagination.total).toBe(documents.length);
      expect(documents.every((d) => d.projectId === projectId)).toBe(true);
    });

    it('searches by title or filename and filters by status', async () => {
      const search = (await api.get(`${docsUrl()}?search=ZEBRA`, owner)).json().data.documents as DocRow[];
      expect(search).toHaveLength(2);

      const ready = (await api.get(`${docsUrl()}?status=ready`, owner)).json().data.documents as DocRow[];
      expect(ready.map((d) => d.id)).toEqual([alpha.id]);

      expect((await api.get(`${docsUrl()}?status=bogus`, owner)).statusCode).toBe(400);
    });

    it('paginates', async () => {
      const data = (await api.get(`${docsUrl()}?pageSize=2`, owner)).json().data as {
        documents: DocRow[];
        pagination: { total: number; totalPages: number };
      };
      expect(data.documents).toHaveLength(2);
      expect(data.pagination.totalPages).toBe(Math.ceil(data.pagination.total / 2));
    });

    it('does not leak documents across projects', async () => {
      const other = await uploadOk(owner, pdfFile('only-in-other.pdf'), {}, otherProjectId);
      const documents = (await api.get(docsUrl(), owner)).json().data.documents as DocRow[];
      expect(documents.some((d) => d.id === other.id)).toBe(false);
    });

    it('scopes the organization-wide list to projects the caller belongs to', async () => {
      const orgUrl = `/api/v1/organizations/${orgId}/documents`;
      const ownerIds = ((await api.get(orgUrl, owner)).json().data.documents as DocRow[]).map((d) => d.projectId);
      expect(ownerIds).toContain(projectId);
      expect(ownerIds).toContain(otherProjectId);

      const contributorIds = ((await api.get(orgUrl, contributor)).json().data.documents as DocRow[]).map((d) => d.projectId);
      expect(contributorIds).toContain(projectId);
      expect(contributorIds).not.toContain(otherProjectId);

      expect(((await api.get(orgUrl, stranger)).json().data.documents as DocRow[])).toHaveLength(0);
      expect((await api.get(orgUrl, outsider)).statusCode).toBe(404);
    });

    it('hides the project list from non-members and other organizations', async () => {
      expect((await api.get(docsUrl(), stranger)).statusCode).toBe(404);
      expect((await api.get(docsUrl(), outsider)).statusCode).toBe(404);
    });
  });

  describe('get, status and download', () => {
    it('gets one document and its status', async () => {
      const doc = await uploadOk(owner, pdfFile('single.pdf'));
      const got = await api.get(`${docsUrl()}/${doc.id}`, reader);
      expect(got.statusCode).toBe(200);
      expect(got.json().data.document.id).toBe(doc.id);

      const status = await api.get(`${docsUrl()}/${doc.id}/status`, reader);
      expect(status.json().data).toMatchObject({ id: doc.id, status: 'pending', processingError: null });
    });

    it('404s for another project\'s document or an unknown id', async () => {
      const other = await uploadOk(owner, pdfFile('elsewhere.pdf'), {}, otherProjectId);
      expect((await api.get(`${docsUrl()}/${other.id}`, owner)).statusCode).toBe(404);
      expect((await api.get(`${docsUrl()}/nope`, owner)).statusCode).toBe(404);
      expect((await api.get(`${docsUrl()}/${other.id}/download`, owner)).statusCode).toBe(404);
    });

    it('downloads the exact bytes with safe headers', async () => {
      const doc = await uploadOk(owner, pdfFile('Résumé final.pdf'));
      const response = await api.get(`${docsUrl()}/${doc.id}/download`, reader);

      expect(response.statusCode).toBe(200);
      expect(Buffer.compare(response.rawPayload, PDF)).toBe(0);
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toMatch(/^attachment;/);
      // ASCII fallback plus an RFC 5987 UTF-8 name, so non-ASCII names survive.
      expect(response.headers['content-disposition']).toMatch(/filename="[ -~]*"; filename\*=UTF-8''R%C3%A9sum%C3%A9%20final\.pdf/);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('refuses downloads to non-members and other tenants', async () => {
      const doc = await uploadOk(owner, pdfFile('private.pdf'));
      expect((await api.get(`${docsUrl()}/${doc.id}/download`, stranger)).statusCode).toBe(404);
      expect((await api.get(`${docsUrl()}/${doc.id}/download`, outsider)).statusCode).toBe(404);
      const anon = await app.inject({ method: 'GET', url: `${docsUrl()}/${doc.id}/download` });
      expect(anon.statusCode).toBe(401);
    });

    it('404s (not 500) when the stored file is missing', async () => {
      const doc = await uploadOk(owner, pdfFile('lost.pdf'));
      const row = await prisma.document.findUniqueOrThrow({ where: { id: doc.id } });
      await new LocalStorageProvider(storageDir).delete(row.s3Key);
      expect((await api.get(`${docsUrl()}/${doc.id}/download`, owner)).statusCode).toBe(404);
    });
  });

  describe('DELETE /documents/:id', () => {
    it('lets a member delete their own upload, removing the file too', async () => {
      const doc = await uploadOk(contributor, pdfFile('mine.pdf'));
      const row = await prisma.document.findUniqueOrThrow({ where: { id: doc.id } });
      const filesBefore = (await filesUnder(storageDir)).length;

      expect((await api.delete(`${docsUrl()}/${doc.id}`, contributor)).statusCode).toBe(200);
      expect((await api.get(`${docsUrl()}/${doc.id}`, owner)).statusCode).toBe(404);
      expect((await filesUnder(storageDir)).length).toBe(filesBefore - 1);
      await expect(new LocalStorageProvider(storageDir).download(row.s3Key)).rejects.toBeInstanceOf(
        StorageObjectNotFoundError
      );
    });

    it("forbids deleting someone else's document, but lets the lead", async () => {
      const doc = await uploadOk(owner, pdfFile('lead-owned.pdf'));
      expect((await api.delete(`${docsUrl()}/${doc.id}`, contributor)).statusCode).toBe(403);
      expect((await api.get(`${docsUrl()}/${doc.id}`, owner)).statusCode).toBe(200);

      const theirs = await uploadOk(contributor, pdfFile('contributor-owned.pdf'));
      expect((await api.delete(`${docsUrl()}/${theirs.id}`, owner)).statusCode).toBe(200);
    });

    it('rejects read-only members and outsiders', async () => {
      const doc = await uploadOk(owner, pdfFile('protected.pdf'));
      expect((await api.delete(`${docsUrl()}/${doc.id}`, reader)).statusCode).toBe(403);
      expect((await api.delete(`${docsUrl()}/${doc.id}`, outsider)).statusCode).toBe(404);
    });
  });

  describe('integration', () => {
    it('records document activity in the project feed', async () => {
      const project = await api.post(`/api/v1/organizations/${orgId}/projects`, owner, { name: 'Audit docs' });
      const auditId = project.json().data.project.id as string;
      const doc = await uploadOk(owner, pdfFile('audited.pdf'), {}, auditId);
      await api.delete(`${docsUrl(auditId)}/${doc.id}`, owner);

      const activity = await api.get(`/api/v1/organizations/${orgId}/projects/${auditId}/activity?limit=50`, owner);
      const actions = (activity.json().data.activity as Array<{ action: string }>).map((a) => a.action);
      expect(actions).toEqual(expect.arrayContaining(['document.uploaded', 'document.deleted']));
    });

    it("removes a project's files when the project is deleted", async () => {
      const project = await api.post(`/api/v1/organizations/${orgId}/projects`, owner, { name: 'Doomed docs' });
      const doomedId = project.json().data.project.id as string;
      const doc = await uploadOk(owner, pdfFile('doomed.pdf'), {}, doomedId);
      const row = await prisma.document.findUniqueOrThrow({ where: { id: doc.id } });
      // The file exists before the project is deleted (close the stream so the
      // temp directory can be removed on Windows afterwards).
      const stream = await new LocalStorageProvider(storageDir).download(row.s3Key);
      stream.destroy();

      expect((await api.delete(`/api/v1/organizations/${orgId}/projects/${doomedId}`, owner)).statusCode).toBe(200);
      expect(await prisma.document.findUnique({ where: { id: doc.id } })).toBeNull();
      await expect(new LocalStorageProvider(storageDir).download(row.s3Key)).rejects.toBeInstanceOf(
        StorageObjectNotFoundError
      );
    });

    it("removes an organization's files when the organization is deleted", async () => {
      const boss = await makeUser();
      const project = await api.post(`/api/v1/organizations/${boss.organizationId}/projects`, boss, { name: 'Org docs' });
      const pid = project.json().data.project.id as string;
      const { payload, headers } = multipart(pdfFile('org-file.pdf'));
      const created = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${boss.organizationId}/projects/${pid}/documents`,
        payload,
        headers,
        cookies: { docly_access_token: boss.accessCookie },
      });
      const row = await prisma.document.findUniqueOrThrow({ where: { id: created.json().data.document.id } });

      expect((await api.delete(`/api/v1/organizations/${boss.organizationId}`, boss)).statusCode).toBe(200);
      await expect(new LocalStorageProvider(storageDir).download(row.s3Key)).rejects.toBeInstanceOf(
        StorageObjectNotFoundError
      );
    });
  });

  describe('processing queue, status and retry', () => {
    it('queues exactly one processing job per upload, tracked by a ProcessingJob row', async () => {
      queued.length = 0;
      const doc = await uploadOk(owner, pdfFile('queued.pdf'));

      expect(queued).toHaveLength(1);
      expect(queued[0]).toMatchObject({ documentId: doc.id, organizationId: orgId });
      const job = await prisma.processingJob.findUniqueOrThrow({ where: { id: queued[0]!.processingJobId } });
      expect(job).toMatchObject({ documentId: doc.id, status: 'pending', jobType: 'extract' });
      expect(doc.status).toBe('pending');
      // Queue payloads carry ids only, never file contents.
      expect(Object.keys(queued[0]!).sort()).toEqual(['documentId', 'organizationId', 'processingJobId']);
    });

    it('still accepts the upload when the queue is down, marking it failed so it can be retried', async () => {
      queueShouldFail = true;
      let doc: DocRow & { processingError: string | null };
      try {
        doc = (await uploadOk(owner, pdfFile('no-queue.pdf'))) as typeof doc;
      } finally {
        queueShouldFail = false;
      }

      expect(doc.status).toBe('failed');
      expect(doc.processingError).toMatch(/Retry/);
      // The file itself was stored safely.
      expect((await api.get(`${docsUrl()}/${doc.id}/download`, owner)).statusCode).toBe(200);
    });

    it('exposes chunkCount without leaking internals', async () => {
      const doc = await uploadOk(owner, pdfFile('chunky.pdf'));
      expect(doc).toMatchObject({ chunkCount: 0 });

      await prisma.documentChunk.createMany({
        data: [
          { documentId: doc.id, chunkIndex: 0, text: 'one' },
          { documentId: doc.id, chunkIndex: 1, text: 'two' },
        ],
      });

      const got = (await api.get(`${docsUrl()}/${doc.id}`, owner)).json().data.document;
      expect(got.chunkCount).toBe(2);
      expect(got).not.toHaveProperty('_count');
      const listed = ((await api.get(docsUrl(), owner)).json().data.documents as Array<{ id: string; chunkCount: number }>).find(
        (d) => d.id === doc.id
      );
      expect(listed?.chunkCount).toBe(2);
    });

    it('retries a failed document: back to pending, error cleared, a new job queued', async () => {
      const doc = await uploadOk(owner, pdfFile('retry-me.pdf'));
      await prisma.document.update({ where: { id: doc.id }, data: { status: 'failed', processingError: 'The PDF could not be read.' } });
      queued.length = 0;

      const response = await api.post(`${docsUrl()}/${doc.id}/retry`, contributor);
      expect(response.statusCode).toBe(200);
      expect(response.json().data.document).toMatchObject({ status: 'pending', processingError: null });

      expect(queued).toHaveLength(1);
      expect(queued[0]!.documentId).toBe(doc.id);
      expect(await prisma.processingJob.count({ where: { documentId: doc.id } })).toBe(2);
    });

    it('refuses to retry a document that is processing or already ready (409)', async () => {
      const doc = await uploadOk(owner, pdfFile('busy.pdf'));
      for (const status of ['processing', 'ready']) {
        await prisma.document.update({ where: { id: doc.id }, data: { status } });
        queued.length = 0;
        expect((await api.post(`${docsUrl()}/${doc.id}/retry`, owner)).statusCode).toBe(409);
        expect(queued).toHaveLength(0);
      }
    });

    it('lets a failed document be retried even if the queue is still down (stays failed)', async () => {
      const doc = await uploadOk(owner, pdfFile('still-down.pdf'));
      await prisma.document.update({ where: { id: doc.id }, data: { status: 'failed', processingError: 'x' } });

      queueShouldFail = true;
      try {
        const response = await api.post(`${docsUrl()}/${doc.id}/retry`, owner);
        expect(response.statusCode).toBe(200);
        expect(response.json().data.document.status).toBe('failed');
      } finally {
        queueShouldFail = false;
      }
    });

    it('enforces roles on retry and records it in the activity feed', async () => {
      const doc = await uploadOk(owner, pdfFile('guarded-retry.pdf'));
      await prisma.document.update({ where: { id: doc.id }, data: { status: 'failed' } });

      expect((await api.post(`${docsUrl()}/${doc.id}/retry`, reader)).statusCode).toBe(403);
      expect((await api.post(`${docsUrl()}/${doc.id}/retry`, stranger)).statusCode).toBe(404);
      expect((await api.post(`${docsUrl()}/${doc.id}/retry`, outsider)).statusCode).toBe(404);
      const anon = await app.inject({ method: 'POST', url: `${docsUrl()}/${doc.id}/retry` });
      expect(anon.statusCode).toBe(401);

      expect((await api.post(`${docsUrl()}/${doc.id}/retry`, owner)).statusCode).toBe(200);
      const activity = await api.get(`/api/v1/organizations/${orgId}/projects/${projectId}/activity?limit=100`, owner);
      const actions = (activity.json().data.activity as Array<{ action: string }>).map((a) => a.action);
      expect(actions).toContain('document.reprocess_requested');
    });

    it('404s a retry for a document in another project', async () => {
      const other = await uploadOk(owner, pdfFile('other-retry.pdf'), {}, otherProjectId);
      await prisma.document.update({ where: { id: other.id }, data: { status: 'failed' } });
      expect((await api.post(`${docsUrl()}/${other.id}/retry`, owner)).statusCode).toBe(404);
    });
  });

  describe('storage provider & filename helpers', () => {
    it('refuses keys that escape the storage root', async () => {
      const storage = new LocalStorageProvider(storageDir);
      await expect(storage.upload('../outside.txt', Buffer.from('x'))).rejects.toThrow('Invalid storage key');
      await expect(storage.download('../../etc/passwd')).rejects.toThrow('Invalid storage key');
    });

    it('deletes idempotently and reports missing objects on download', async () => {
      const storage = new LocalStorageProvider(storageDir);
      await expect(storage.delete('does/not/exist.txt')).resolves.toBeUndefined();
      await expect(storage.download('does/not/exist.txt')).rejects.toBeInstanceOf(StorageObjectNotFoundError);
    });

    it('sanitizes filenames', () => {
      expect(sanitizeFilename('../../a/b/c.pdf')).toBe('c.pdf');
      expect(sanitizeFilename('C:\\Users\\x\\file.txt')).toBe('file.txt');
      expect(sanitizeFilename('we"ird<na>me?.md')).toBe('weirdname.md');
      expect(sanitizeFilename('   ')).toBe('document');
      expect(sanitizeFilename('..')).toBe('document');
      expect(sanitizeFilename('a'.repeat(300) + '.pdf').length).toBeLessThanOrEqual(200);
    });
  });
});
