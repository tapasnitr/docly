import { prisma } from '@docly/database';
import { getRedisClient } from '@docly/redis';

// Repository layer: the only place raw Prisma/Redis calls happen for this domain.
// Services depend on this interface, not on Prisma/Redis directly, so the data
// access technology can change without touching business logic.
export const healthRepository = {
  async checkDatabase(): Promise<void> {
    await prisma.$queryRaw`SELECT 1`;
  },

  async checkRedis(): Promise<void> {
    await getRedisClient().ping();
  },
};
