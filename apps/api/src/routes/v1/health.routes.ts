import type { FastifyInstance } from 'fastify';
import { healthController } from '../../controllers/health.controller.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  // Liveness: is the process running? No dependency checks - used by
  // orchestrators to decide whether to restart the container.
  app.get('/health/live', healthController.liveness);

  // Readiness: is the service ready to accept traffic? Checks downstream
  // dependencies (database, redis) - used by load balancers/orchestrators
  // to decide whether to route traffic to this instance.
  app.get('/health/ready', healthController.readiness);
}
