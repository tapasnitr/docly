import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import { config } from '@docly/config';
import { getLoggerOptions } from '@docly/logger';
import { registerErrorHandler } from './middleware/error-handler.js';
import { registerRedis } from './plugins/redis.js';
import { registerV1Routes } from './routes/v1/index.js';

// Builds a fully configured Fastify instance without starting the HTTP
// listener. Kept separate from index.ts so the app can be built and exercised
// (e.g. in tests) without binding a port.
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: getLoggerOptions('api', config.LOG_LEVEL),
    requestTimeout: 30000,
    genReqId: () => randomUUID(),
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(cors, {
    origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(','),
    credentials: true,
  });

  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRY },
  });

  await registerRedis(app);

  registerErrorHandler(app);

  await registerV1Routes(app);

  return app;
}
