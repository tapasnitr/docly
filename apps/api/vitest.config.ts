import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Suites register several users (bcrypt) in beforeAll; give slow or busy
    // machines (and CI runners) room so that isn't mistaken for a failure.
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
