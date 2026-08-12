import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/postgres/**/*.test.ts'],
    // Refusing without a connection is the suite's job (harness throws).
    // This config is excluded from the default hermetic suite.
    fileParallelism: false,
    maxWorkers: 1,
  },
});
