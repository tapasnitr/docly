import { Worker, type Job } from 'bullmq';
import { config } from '@docly/config';
import { createLogger } from '@docly/logger';
import { DOCUMENT_JOB_OPTIONS, DOCUMENT_PROCESSING_QUEUE, redisConnection, type DocumentProcessingJob } from '@docly/jobs';
import { processDocument, recordFailure } from './processing/process-document.js';

const logger = createLogger('worker', config.LOG_LEVEL);

const worker = new Worker<DocumentProcessingJob>(
  DOCUMENT_PROCESSING_QUEUE,
  async (job: Job<DocumentProcessingJob>) => {
    logger.info({ jobId: job.id, documentId: job.data.documentId, attempt: job.attemptsMade + 1 }, 'Processing document');
    return processDocument(job.data);
  },
  {
    connection: redisConnection(),
    concurrency: config.WORKER_CONCURRENCY,
  }
);

worker.on('completed', (job, result: { chunks: number }) => {
  logger.info({ jobId: job.id, documentId: job.data.documentId, chunks: result.chunks }, 'Document processed');
});

// A failed attempt: record it (retry count, or final 'failed' status for the
// user). A bookkeeping error here must never crash the worker.
worker.on('failed', (job, error) => {
  if (!job) return;
  const maxAttempts = job.opts.attempts ?? DOCUMENT_JOB_OPTIONS.attempts ?? 1;
  logger.error({ jobId: job.id, documentId: job.data.documentId, attempt: job.attemptsMade, error: error.message }, 'Document processing attempt failed');

  recordFailure({ job: job.data, error, attemptsMade: job.attemptsMade, maxAttempts }).catch((recordError: unknown) => {
    logger.error({ jobId: job.id, error: String(recordError) }, 'Could not record the processing failure');
  });
});

worker.on('error', (error) => {
  logger.error({ error: error.message }, 'Worker error');
});

logger.info('Worker started, listening for jobs...');

// Graceful shutdown: finish in-flight jobs before exiting.
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down gracefully...`);
  await worker.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
