import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/backend/**/*.test.ts', 'packages/**/*.test.ts', 'apps/mobile/src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 15000,
    hookTimeout: 15000,
    maxWorkers: 2,
  },
});
