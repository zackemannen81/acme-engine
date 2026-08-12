import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/live/supabase-auth.test.ts'],
    testTimeout: 30_000,
  },
});
