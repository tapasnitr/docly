import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.routes.js';

// API versioning strategy: each version is a self-contained set of route
// modules registered under its own path prefix. A breaking change gets a new
// /api/v2 module registered alongside (not instead of) v1, rather than
// mutating v1's contract in place.
export async function registerV1Routes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes, { prefix: '/api/v1' });
}
