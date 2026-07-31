import { defineConfig } from 'vitest/config';

/**
 * The live gate. It is a separate configuration on purpose: nothing in the
 * default suite, and therefore nothing in CI, can reach these tests.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/live/**/*.test.ts'],
    // One real call against a remote provider is slower than any offline test.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
