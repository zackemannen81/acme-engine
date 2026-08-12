import { afterAll } from 'vitest';

import {
  createPostgresEvidenceProductRepository,
  dropEvidenceProductSchema,
  migrateEvidenceProductSchema,
} from '../../packages/adapter-evidence-product-postgres/src/index.js';
import type { EvidenceProductRepository } from '../../packages/evidence-product-contracts/src/index.js';
import {
  evidencePrimaryViewConformance,
  evidenceProductRepositoryConformance,
} from '../../packages/evidence-testing/src/product-conformance.js';
import { createSharedPool, randomSchema } from './harness.js';

const pool = createSharedPool();
const schemas: string[] = [];

afterAll(async () => {
  for (const schema of schemas) {
    try {
      await dropEvidenceProductSchema(pool, schema);
    } catch {
      // best-effort
    }
  }
  await pool.end();
});

function createRepository(): EvidenceProductRepository {
  const schema = randomSchema('evidence_test');
  schemas.push(schema);
  let ready: Promise<EvidenceProductRepository> | undefined;
  let cached: EvidenceProductRepository | undefined;

  async function repo(): Promise<EvidenceProductRepository> {
    if (cached !== undefined) return cached;
    ready ??= (async () => {
      await migrateEvidenceProductSchema({
        pool,
        schema,
        appliedAt: '2026-08-12T00:00:00.000Z',
      });
      const created = createPostgresEvidenceProductRepository({ pool, schema });
      cached = created;
      return created;
    })();
    return ready;
  }

  return {
    snapshot: async () => (await repo()).snapshot(),
    putWorkspace: async (workspace) => (await repo()).putWorkspace(workspace),
    putSource: async (source) => (await repo()).putSource(source),
    putObservations: async (observations) =>
      (await repo()).putObservations(observations),
    putRelations: async (relations) => (await repo()).putRelations(relations),
    putOpenQuestions: async (openQuestions) =>
      (await repo()).putOpenQuestions(openQuestions),
    putAssessments: async (assessments) =>
      (await repo()).putAssessments(assessments),
    putChangeSet: async (changeSet) => (await repo()).putChangeSet(changeSet),
    putJob: async (job) => (await repo()).putJob(job),
    appendReviewDecision: async (decision) =>
      (await repo()).appendReviewDecision(decision),
    advanceEvidenceRevision: async (workspaceId, expected, next) =>
      (await repo()).advanceEvidenceRevision(workspaceId, expected, next),
  };
}

evidenceProductRepositoryConformance({ createRepository });
evidencePrimaryViewConformance({ createRepository });
