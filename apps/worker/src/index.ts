import { Worker } from 'bullmq';
import { config } from '@docly/config';
import { createLogger } from '@docly/logger';

const logger = createLogger('worker', config.LOG_LEVEL);

// BullMQ needs a { host, port } connection object (ioredis-style), so derive
// it from the single REDIS_URL source of truth rather than keeping separate
// REDIS_HOST/REDIS_PORT env vars that could drift out of sync with it.
const redisUrl = new URL(config.REDIS_URL);

const worker = new Worker(
  'document_processing',
  async (job) => {
    logger.info({ jobId: job.id }, 'Processing job');

    // Simulated job processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    logger.info({ jobId: job.id }, 'Job completed');
    return { success: true };
  },
  {
    connection: {
      host: redisUrl.hostname,
      port: Number(redisUrl.port) || 6379,
    },
    concurrency: config.WORKER_CONCURRENCY,
  }
);

worker.on('active', (job) => {
  logger.info({ jobId: job.id }, 'Job started');
});

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Job completed successfully');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Job failed');
});

logger.info('Worker started, listening for jobs...');

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await worker.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await worker.close();
  process.exit(0);
});
