import { afterAll } from 'vitest';

import { dropPostgresSchema } from '../../packages/adapter-postgres/src/index.js';
import { executionRepositoryConformance } from '../../packages/testing/src/index.js';
import { createSharedPool } from './harness.js';
import { createLazyPostgresRepositoryFactory } from './lazy-repository.js';

const pool = createSharedPool();
const schemas: string[] = [];

afterAll(async () => {
  for (const schema of schemas) {
    try {
      await dropPostgresSchema(pool, schema);
    } catch {
      // best-effort cleanup
    }
  }
  await pool.end();
});

executionRepositoryConformance('postgres adapter', {
  createRepository: createLazyPostgresRepositoryFactory({ pool, schemas }),
});
