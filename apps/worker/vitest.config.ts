import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The integration tests talk to a real (test) database; give busy or slow
    // machines room.
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
