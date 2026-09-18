import { config } from '@docly/config';
import { buildApp } from './app.js';

async function start(): Promise<void> {
  const app = await buildApp();

  const signals: ('SIGINT' | 'SIGTERM')[] = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      app.log.info(`${signal} received, shutting down gracefully...`);
      await app.close();
      process.exit(0);
    });
  });

  try {
    await app.listen({ host: config.API_HOST, port: config.API_PORT });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
