import pino from 'pino';
import { Worker } from 'bullmq';
import { config } from '@docly/config';

const logger = pino({
  level: config.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      singleLine: false,
    },
  },
});

const worker = new Worker('document_processing', async (job) => {
  logger.info({ jobId: job.id }, 'Processing job');
  
  // Simulated job processing
  await new Promise((resolve) => setTimeout(resolve, 1000));
  
  logger.info({ jobId: job.id }, 'Job completed');
  return { success: true };
}, {
  connection: {
    host: config.REDIS_HOST || 'localhost',
    port: config.REDIS_PORT || 6379,
  },
  concurrency: config.WORKER_CONCURRENCY || 5,
});

worker.on('active', (job) => {
  logger.info({ jobId: job.id }, 'Job started');
});

worker.on('completed', (job, result) => {
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
