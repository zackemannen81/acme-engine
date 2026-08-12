import { afterAll, expect, it } from 'vitest';

import {
  createPostgresEvidenceProductRepository,
  dropEvidenceProductSchema,
  migrateEvidenceProductSchema,
} from '../../packages/adapter-evidence-product-postgres/src/index.js';
import type { EvidenceProductRepository } from '../../packages/evidence-product-contracts/src/index.js';
import {
  evidencePrimaryViewConformance,
  evidenceProductRepositoryConformance,
  evidenceIngestionRepositoryConformance,
  evidenceReviewerOperationsRepositoryConformance,
} from '../../packages/evidence-testing/src/product-conformance.js';
import { developmentObserveArtifactInput } from '../../packages/evidence-testing/src/index.js';
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
    caseSnapshot: async (caseId, workspaceId) =>
      (await repo()).caseSnapshot(caseId, workspaceId),
    bindCaseObjects: async (bindings) =>
      (await repo()).bindCaseObjects(bindings),
    putTextImport: async (record, scope) =>
      (await repo()).putTextImport(record, scope),
    putRedactionDraft: async (draft, scope) =>
      (await repo()).putRedactionDraft(draft, scope),
    applyRedaction: async (draft, log, scope) =>
      (await repo()).applyRedaction(draft, log, scope),
    putReviewAssignment: async (assignment, activity, scope) =>
      (await repo()).putReviewAssignment(assignment, activity, scope),
    appendReviewComment: async (comment, activity, scope) =>
      (await repo()).appendReviewComment(comment, activity, scope),
    appendReviewActivity: async (activity, scope) =>
      (await repo()).appendReviewActivity(activity, scope),
    appendReviewDecisions: async (decisions, activities, scope) =>
      (await repo()).appendReviewDecisions(decisions, activities, scope),
    stageArtifact: async (staging, audit, scope) =>
      (await repo()).stageArtifact(staging, audit, scope),
    activateArtifactSource: async (
      source,
      representation,
      envelope,
      lifecycle,
      audit,
      scope,
    ) =>
      (await repo()).activateArtifactSource(
        source,
        representation,
        envelope,
        lifecycle,
        audit,
        scope,
      ),
    appendSecurityAudit: async (audit, scope) =>
      (await repo()).appendSecurityAudit(audit, scope),
    updateArtifactEnvelope: async (envelope, lifecycle, audit, scope) =>
      (await repo()).updateArtifactEnvelope(envelope, lifecycle, audit, scope),
    appendArtifactLifecycle: async (lifecycle, audit, scope) =>
      (await repo()).appendArtifactLifecycle(lifecycle, audit, scope),
    quarantineArtifactStaging: async (stagingId, lifecycle, audit, scope) =>
      (await repo()).quarantineArtifactStaging(
        stagingId,
        lifecycle,
        audit,
        scope,
      ),
    putWorkspace: async (workspace, scope) =>
      (await repo()).putWorkspace(workspace, scope),
    putSource: async (source, scope) => (await repo()).putSource(source, scope),
    putObservations: async (observations, scope) =>
      (await repo()).putObservations(observations, scope),
    putRelations: async (relations, scope) =>
      (await repo()).putRelations(relations, scope),
    putOpenQuestions: async (openQuestions, scope) =>
      (await repo()).putOpenQuestions(openQuestions, scope),
    putAssessments: async (assessments, scope) =>
      (await repo()).putAssessments(assessments, scope),
    putChangeSet: async (changeSet, scope) =>
      (await repo()).putChangeSet(changeSet, scope),
    putJob: async (job, scope) => (await repo()).putJob(job, scope),
    appendReviewDecision: async (decision, scope) =>
      (await repo()).appendReviewDecision(decision, scope),
    advanceEvidenceRevision: async (workspaceId, expected, next) =>
      (await repo()).advanceEvidenceRevision(workspaceId, expected, next),
  };
}

evidenceProductRepositoryConformance({ createRepository });
evidencePrimaryViewConformance({ createRepository });
evidenceIngestionRepositoryConformance({ createRepository });
evidenceReviewerOperationsRepositoryConformance({ createRepository });

it('persists case-object scope and allows identical content ids only by explicit binding', async () => {
  const repository = createRepository();
  const now = '2026-08-12T00:00:00.000Z';
  const source = developmentObserveArtifactInput().artifactVersion;
  for (const suffix of ['one', 'two']) {
    const scope = {
      caseId: `case-${suffix}`,
      workspaceId: `workspace-${suffix}`,
      boundAt: now,
    } as const;
    await repository.putWorkspace(
      {
        schemaVersion: 'evidence-workspace/1',
        workspaceId: scope.workspaceId,
        label: `Synthetic ${suffix}`,
        dataPolicy: 'synthetic-only',
        evidenceRevision: 0,
        createdAt: now,
      },
      scope,
    );
    await repository.putSource(source, scope);
    expect(
      (await repository.caseSnapshot(scope.caseId, scope.workspaceId)).sources,
    ).toHaveLength(1);
  }
  await expect(
    repository.bindCaseObjects([
      {
        schemaVersion: 'evidence-case-object-binding/1',
        caseId: 'case-one',
        workspaceId: 'workspace-two',
        objectKind: 'source',
        objectId: source.artifactVersionId,
        boundAt: now,
      },
    ]),
  ).rejects.toThrow();
});
