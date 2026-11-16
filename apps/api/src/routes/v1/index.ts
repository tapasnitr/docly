import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.routes.js';
import { authRoutes } from './auth.routes.js';
import { userRoutes } from './user.routes.js';
import { organizationRoutes } from './organization.routes.js';
import { dashboardRoutes } from './dashboard.routes.js';
import { projectRoutes } from './project.routes.js';
import { taskRoutes } from './task.routes.js';
import { documentRoutes } from './document.routes.js';
import { aiRoutes } from './ai.routes.js';

// API versioning strategy: each version is a self-contained set of route
// modules registered under its own path prefix. A breaking change gets a new
// /api/v2 module registered alongside (not instead of) v1, rather than
// mutating v1's contract in place.
export async function registerV1Routes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(userRoutes, { prefix: '/api/v1' });
  await app.register(organizationRoutes, { prefix: '/api/v1' });
  await app.register(dashboardRoutes, { prefix: '/api/v1' });
  await app.register(projectRoutes, { prefix: '/api/v1' });
  await app.register(taskRoutes, { prefix: '/api/v1' });
  await app.register(documentRoutes, { prefix: '/api/v1' });
  await app.register(aiRoutes, { prefix: '/api/v1' });
}
