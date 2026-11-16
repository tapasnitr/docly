import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
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

  // Outside production, security headers and rate limiting are skipped entirely
  // so local development never trips over them (helmet's
  // Cross-Origin-Resource-Policy blocks the web app on :3000 from loading API
  // resources on :3001, and the tight auth rate limits lock you out after a
  // handful of logins).
  const isProduction = config.NODE_ENV === 'production';

  if (isProduction) {
    await app.register(helmet, { contentSecurityPolicy: false });
  }

  // TEMPORARY: allow every origin regardless of CORS_ORIGIN. `true` reflects
  // the request's Origin back (a literal "*" is rejected by browsers when
  // credentials are included). Restore the CORS_ORIGIN allowlist before
  // deploying to production.
  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  });

  await app.register(cookie);

  // multipart/form-data uploads (documents). Limits are enforced while
  // streaming: one file per request, a size cap (MAX_UPLOAD_MB), and a few
  // small text fields. With throwFileSizeLimit off, an oversized file is
  // flagged as truncated and rejected with a clean 413 by the document
  // service instead of an opaque stream error.
  await app.register(multipart, {
    throwFileSizeLimit: false,
    limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 5, fieldSize: 1024 },
  });

  // Rate limiting (production only): a generous global default (protects every
  // route from abuse/accidental hammering) plus much tighter per-route limits on
  // the sensitive auth endpoints (see routes/v1/auth.routes.ts's
  // `config.rateLimit`), which override this default. Keyed by IP - fine for a
  // single-instance deployment; swap in a shared (Redis) store before scaling
  // out horizontally. When the plugin isn't registered, routes' `config.rateLimit`
  // is simply ignored.
  if (isProduction) {
    await app.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
    });
  }

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
