import { afterAll } from 'vitest';

import {
  createPostgresQualityEvaluationStore,
  dropPostgresSchema,
  migratePostgresSchema,
} from '../../packages/adapter-postgres/src/index.js';
import { qualityEvaluationStoreConformance } from '../../packages/testing/src/index.js';
import { createSharedPool, randomSchema } from './harness.js';

const pool = createSharedPool();
const schemas: string[] = [];

afterAll(async () => {
  for (const schema of schemas) {
    try {
      await dropPostgresSchema(pool, schema);
    } catch {
      // best-effort
    }
  }
  await pool.end();
});

qualityEvaluationStoreConformance('postgres adapter', {
  createStore: (hashing) => {
    const schema = randomSchema('acme_quality');
    schemas.push(schema);
    let ready:
      | Promise<ReturnType<typeof createPostgresQualityEvaluationStore>>
      | undefined;
    let cached:
      ReturnType<typeof createPostgresQualityEvaluationStore> | undefined;

    async function store() {
      if (cached !== undefined) return cached;
      ready ??= (async () => {
        await migratePostgresSchema({
          pool,
          schema,
          appliedAt: '2026-08-12T00:00:00.000Z',
        });
        const created = createPostgresQualityEvaluationStore({
          pool,
          schema,
          ...(hashing === undefined ? {} : { hashing }),
        });
        cached = created;
        return created;
      })();
      return ready;
    }

    return {
      put: async (record) => (await store()).put(record),
      get: async (id) => (await store()).get(id),
      list: async (query) => (await store()).list(query),
    };
  },
});
