import { Queue, type ConnectionOptions, type JobsOptions } from 'bullmq';
import { config } from '@docly/config';

// Queue names are shared constants so the producer (API) and the consumer
// (worker) can never drift apart.
export const DOCUMENT_PROCESSING_QUEUE = 'document_processing';

// Everything the worker needs to find the work. Deliberately IDs only, never
// file contents or text: jobs live in Redis, and the database/storage are the
// source of truth for the data itself.
export interface DocumentProcessingJob {
  documentId: string;
  organizationId: string;
  // The ProcessingJob row tracking this attempt chain (status, retries, error).
  processingJobId: string;
}

// Transient failures (storage hiccup, database blip) are retried with
// exponential backoff; permanent failures (corrupt file) are thrown as
// UnrecoverableError by the worker and skip the retries (spec section 55).
export const DOCUMENT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

// BullMQ takes ioredis-style options, so derive them from the single
// REDIS_URL source of truth instead of separate host/port variables.
export function redisConnection(url: string = config.REDIS_URL): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
  };
}

// The slice of a queue the API needs - small enough to fake in tests.
export interface DocumentQueue {
  add(name: string, data: DocumentProcessingJob, options?: JobsOptions): Promise<unknown>;
  close(): Promise<void>;
}

let queue: DocumentQueue | null = null;

function getDocumentQueue(): DocumentQueue {
  queue ??= new Queue<DocumentProcessingJob>(DOCUMENT_PROCESSING_QUEUE, { connection: redisConnection() });
  return queue;
}

// Lets tests capture enqueued jobs without a Redis round trip.
export function setDocumentQueueForTesting(next: DocumentQueue | null): void {
  queue = next;
}

const ENQUEUE_TIMEOUT_MS = 5000;

// Publishes a processing job. The jobId is the ProcessingJob row's id, so
// re-publishing the same attempt can't create a duplicate. Bounded by a
// timeout so an unreachable Redis fails the call quickly instead of hanging
// the HTTP request.
export async function enqueueDocumentProcessing(job: DocumentProcessingJob): Promise<void> {
  const add = getDocumentQueue().add('process-document', job, {
    ...DOCUMENT_JOB_OPTIONS,
    jobId: job.processingJobId,
  });

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Timed out publishing the processing job')), ENQUEUE_TIMEOUT_MS);
  });
  try {
    await Promise.race([add, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function closeQueues(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
