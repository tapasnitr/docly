import { FastifyInstance } from 'fastify';
import { prisma } from '@docly/database';
import { redis } from '@docly/config';

export async function registerHealthRoutes(fastify: FastifyInstance) {
  // Liveness probe - is the service running?
  fastify.get('/api/v1/health/live', async (request, reply) => {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  });

  // Readiness probe - is the service ready to accept traffic?
  fastify.get('/api/v1/health/ready', async (request, reply) => {
    try {
      // Check database connection
      await prisma.$queryRaw`SELECT 1`;

      // Check redis connection
      await redis.ping();

      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'healthy',
          redis: 'healthy',
        },
      };
    } catch (error: any) {
      reply.status(503).send({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  });

  // Detailed health status
  fastify.get('/api/v1/health/status', async (request, reply) => {
    const checks: Record<string, any> = {
      api: { status: 'healthy' },
    };

    // Check database
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'healthy' };
    } catch (error: any) {
      checks.database = { status: 'unhealthy', error: error.message };
    }

    // Check redis
    try {
      await redis.ping();
      checks.redis = { status: 'healthy' };
    } catch (error: any) {
      checks.redis = { status: 'unhealthy', error: error.message };
    }

    const allHealthy = Object.values(checks).every((c: any) => c.status === 'healthy');

    reply.status(allHealthy ? 200 : 503).send({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    });
  });
}
