import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import pino from 'pino';
import { config } from '@docly/config';
import { registerHealthRoutes } from './routes/health.js';

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

const fastify = Fastify({
  logger: logger,
  requestTimeout: 30000,
});

// Register plugins
await fastify.register(helmet, {
  contentSecurityPolicy: false,
});

await fastify.register(cors, {
  origin: true,
  credentials: true,
});

// JWT plugin
await fastify.register(jwt, {
  secret: config.JWT_SECRET,
  sign: {
    expiresIn: config.JWT_EXPIRY,
  },
});

// Health check routes
registerHealthRoutes(fastify);

// Basic hello route
fastify.get('/api/v1/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  logger.error(error, 'Unhandled error');
  reply.status(500).send({
    statusCode: 500,
    message: 'Internal Server Error',
  });
});

// Start server
const start = async () => {
  try {
    const host = config.API_HOST || '0.0.0.0';
    const port = config.API_PORT || 3001;
    
    await fastify.listen({ host, port });
    logger.info(`API server listening on ${host}:${port}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
const signals: ('SIGINT' | 'SIGTERM')[] = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    logger.info(`${signal} received, shutting down gracefully...`);
    await fastify.close();
    process.exit(0);
  });
});

start();
