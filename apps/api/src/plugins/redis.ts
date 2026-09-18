import type { FastifyInstance } from 'fastify';
import { connectRedis, disconnectRedis } from '@docly/redis';
import { config } from '@docly/config';

// Connects the shared Redis client during startup (so the server doesn't accept
// traffic before it's ready) and closes it on shutdown via Fastify's lifecycle.
export async function registerRedis(app: FastifyInstance): Promise<void> {
  await connectRedis({
    url: config.REDIS_URL,
    onError: (err) => app.log.error({ err }, 'Redis client error'),
  });

  app.addHook('onClose', async () => {
    await disconnectRedis();
  });
}
