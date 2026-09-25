import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { config } from '@docly/config';
import { getLoggerOptions } from '@docly/logger';
import { registerErrorHandler } from './middleware/error-handler.js';
import { registerRedis } from './plugins/redis.js';
import { registerV1Routes } from './routes/v1/index.js';
import { ACCESS_TOKEN_COOKIE } from './lib/cookies.js';

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

  await app.register(cookie);

  // Rate limiting: a generous global default (protects every route from
  // abuse/accidental hammering) plus much tighter per-route limits on the
  // sensitive auth endpoints (see routes/v1/auth.routes.ts's `config.rateLimit`),
  // which override this default. Keyed by IP - fine for a single-instance
  // deployment; swap in a shared (Redis) store before scaling out horizontally.
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Session/token management: access tokens are short-lived JWTs. `request.jwtVerify()`
  // checks the Authorization header first (for non-browser API clients), falling back
  // to the access-token cookie (for the web app) via the `cookie` option below.
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRY },
    cookie: { cookieName: ACCESS_TOKEN_COOKIE, signed: false },
  });

  await registerRedis(app);

  registerErrorHandler(app);

  await registerV1Routes(app);

  return app;
}
