import type { FastifyReply, FastifyRequest } from 'fastify';
import { healthService } from '../services/health.service.js';
import { sendSuccess } from '../lib/api-response.js';

// Controller layer: thin glue between HTTP and the service layer. No business
// logic lives here - just request parsing, calling a service, and shaping the
// HTTP response.
export const healthController = {
  liveness(_request: FastifyRequest, reply: FastifyReply): void {
    sendSuccess(reply, { status: 'alive' });
  },

  async readiness(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const health = await healthService.getReadiness();
    sendSuccess(reply, health, health.status === 'healthy' ? 200 : 503);
  },
};
