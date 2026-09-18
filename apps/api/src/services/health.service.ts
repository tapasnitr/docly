import { healthRepository } from '../repositories/health.repository.js';

export interface ComponentHealth {
  status: 'healthy' | 'unhealthy';
  error?: string;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded';
  checks: {
    database: ComponentHealth;
    redis: ComponentHealth;
  };
}

async function checkComponent(check: () => Promise<void>): Promise<ComponentHealth> {
  try {
    await check();
    return { status: 'healthy' };
  } catch (error) {
    return { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Service layer: business logic for a domain, orchestrating one or more
// repositories. Controllers call services; services never touch Fastify's
// request/reply objects directly, which keeps them reusable and testable.
export const healthService = {
  async getReadiness(): Promise<SystemHealth> {
    const [database, redis] = await Promise.all([
      checkComponent(() => healthRepository.checkDatabase()),
      checkComponent(() => healthRepository.checkRedis()),
    ]);

    const allHealthy = database.status === 'healthy' && redis.status === 'healthy';

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      checks: { database, redis },
    };
  },
};
