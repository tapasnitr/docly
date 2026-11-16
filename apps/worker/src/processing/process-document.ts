import { Prisma, prisma } from '@docly/database';
import type { DocumentProcessingJob } from '@docly/jobs';
import { getStorage, StorageObjectNotFoundError } from '@docly/storage';
import { createEmbeddingProvider, serializeEmbedding } from '@docly/rag';
import { UnrecoverableError } from 'bullmq';
import { chunkText } from './chunk.js';
import { ExtractionError, extractText, isSupportedExtension } from './extract.js';

// Shown to users when something unexpected breaks. Internal error text never
// reaches them - it stays in the worker logs.
export const GENERIC_FAILURE_MESSAGE = 'Processing failed unexpectedly. Use Retry to try again.';

async function readAll(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function extensionOf(storageKey: string): string {
  const dot = storageKey.lastIndexOf('.');
  return dot === -1 ? '' : storageKey.slice(dot + 1).toLowerCase();
}

// The pipeline for one document: download -> extract text -> chunk -> embed ->
// save. Idempotent: running it again replaces the previous
// chunks, so a retry never duplicates data.
//
// Problems with the file itself throw UnrecoverableError (retrying can't fix
// a corrupt PDF); anything else is thrown as-is and BullMQ retries it with
// backoff.
export async function processDocument(job: DocumentProcessingJob): Promise<{ chunks: number }> {
  const { documentId, organizationId, processingJobId } = job;

  const document = await prisma.document.findFirst({ where: { id: documentId, organizationId } });
  if (!document) {
    // Deleted between upload and processing - nothing left to do.
    throw new UnrecoverableError('The document no longer exists');
  }

  await prisma.$transaction([
    prisma.document.update({ where: { id: documentId }, data: { status: 'processing', processingError: null } }),
    prisma.processingJob.updateMany({ where: { id: processingJobId }, data: { status: 'processing', error: null } }),
  ]);

  const extension = extensionOf(document.s3Key);
  if (!isSupportedExtension(extension)) {
    throw new UnrecoverableError('This file type cannot be processed');
  }

  let buffer: Buffer;
  try {
    buffer = await readAll(await getStorage().download(document.s3Key));
  } catch (error) {
    if (error instanceof StorageObjectNotFoundError) {
      throw new UnrecoverableError('The stored file could not be found');
    }
    throw error;
  }

  let text: string;
  try {
    text = await extractText(buffer, extension);
  } catch (error) {
    if (error instanceof ExtractionError) {
      throw new UnrecoverableError(error.message);
    }
    throw error;
  }

  const chunks = chunkText(text);

  // Embed before opening the transaction: it can be a slow network call, and a
  // failure here is retried by BullMQ without touching existing chunks.
  const embedder = createEmbeddingProvider();
  const vectors = chunks.length > 0 ? await embedder.embed(chunks) : [];

  try {
    await prisma.$transaction(async (tx) => {
      await tx.documentChunk.deleteMany({ where: { documentId } });
      await tx.documentChunk.createMany({
        data: chunks.map((chunkTextValue, chunkIndex) => ({
          documentId,
          chunkIndex,
          text: chunkTextValue,
          embedding: serializeEmbedding(embedder.model, vectors[chunkIndex]),
        })),
      });
      await tx.document.update({
        where: { id: documentId },
        data: { status: 'ready', textContent: text, processingError: null },
      });
      await tx.processingJob.updateMany({ where: { id: processingJobId }, data: { status: 'completed', error: null } });
      await tx.auditLog.create({
        data: {
          organizationId,
          action: 'document.processed',
          resourceType: 'document',
          resourceId: document.projectId ?? document.id,
          changes: JSON.stringify({ documentId, filename: document.filename, chunks: chunks.length }),
        },
      });
    });
  } catch (error) {
    // Foreign-key violation: the document was deleted while we were working.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new UnrecoverableError('The document no longer exists');
    }
    throw error;
  }

  return { chunks: chunks.length };
}

export interface FailureInfo {
  job: DocumentProcessingJob;
  error: Error;
  // How many attempts have run so far (including the one that just failed).
  attemptsMade: number;
  maxAttempts: number;
}

// Called when a job attempt fails. While retries remain it just records the
// retry count; once the job is out of attempts (or failed permanently) it
// marks the document 'failed' with a user-safe message, which is what the UI
// shows next to the Retry button.
export async function recordFailure({ job, error, attemptsMade, maxAttempts }: FailureInfo): Promise<'retrying' | 'failed'> {
  const { documentId, organizationId, processingJobId } = job;
  const permanent = error instanceof UnrecoverableError || error.name === 'UnrecoverableError';
  const exhausted = attemptsMade >= maxAttempts;

  if (!permanent && !exhausted) {
    await prisma.processingJob.updateMany({
      where: { id: processingJobId },
      data: { status: 'pending', retries: attemptsMade, error: 'Temporary error - retrying' },
    });
    return 'retrying';
  }

  // File problems carry a message written for users; anything else is generic.
  const userMessage = permanent ? error.message : GENERIC_FAILURE_MESSAGE;

  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId },
    select: { id: true, filename: true, projectId: true },
  });
  if (!document) return 'failed'; // deleted - nothing to mark

  await prisma.$transaction([
    prisma.document.update({ where: { id: documentId }, data: { status: 'failed', processingError: userMessage } }),
    prisma.processingJob.updateMany({
      where: { id: processingJobId },
      data: { status: 'failed', retries: Math.max(attemptsMade - 1, 0), error: userMessage },
    }),
    prisma.auditLog.create({
      data: {
        organizationId,
        action: 'document.processing_failed',
        resourceType: 'document',
        resourceId: document.projectId ?? document.id,
        changes: JSON.stringify({ documentId, filename: document.filename, reason: userMessage }),
      },
    }),
  ]);
  return 'failed';
}
