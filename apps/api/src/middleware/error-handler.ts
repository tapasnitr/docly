import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { buildErrorBody } from '../lib/api-response.js';

// Error handling strategy: a single central handler translates every thrown error
// into the standard error envelope. AppError subclasses carry their own status/code
// and are safe to expose as-is. Everything else is logged with full detail and
// returns a generic message in production (full message in development, to help
// debugging without leaking internals to clients in prod).
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        request.log.error({ err: error }, error.message);
      } else {
        request.log.warn({ err: error }, error.message);
      }
      reply
        .status(error.statusCode)
        .send(buildErrorBody({ code: error.code, message: error.message, details: error.details }));
      return;
    }

    if (error instanceof ZodError) {
      reply.status(400).send(
        buildErrorBody({
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.flatten(),
        })
      );
      return;
    }

    // Fastify's built-in schema validation errors carry a statusCode < 500.
    const fastifyError = error as FastifyError;
    if (typeof fastifyError.statusCode === 'number' && fastifyError.statusCode < 500) {
      reply
        .status(fastifyError.statusCode)
        .send(buildErrorBody({ code: fastifyError.code ?? 'BAD_REQUEST', message: fastifyError.message }));
      return;
    }

    request.log.error({ err: error }, 'Unhandled error');
    const isProduction = process.env.NODE_ENV === 'production';
    reply.status(500).send(
      buildErrorBody({
        code: 'INTERNAL_SERVER_ERROR',
        message: isProduction ? 'Internal Server Error' : error.message,
      })
    );
  });

  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    reply
      .status(404)
      .send(buildErrorBody({ code: 'NOT_FOUND', message: `Route ${request.method} ${request.url} not found` }));
  });
}
