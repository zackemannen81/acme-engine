import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'apps/**/test/**/*.test.ts',
      'packages/**/test/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    // The live gate costs money and needs a credential. It is excluded here
    // so no default run, and therefore no CI step, can reach it.
    exclude: [...configDefaults.exclude, 'tests/live/**'],
  },
});
