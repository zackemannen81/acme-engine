import { canonicalJson } from '@acme/core';
import {
  EVIDENCE_PRODUCT_SNAPSHOT_SCHEMA_VERSION,
  EvidenceProductCommandCollisionError,
  EvidenceProductSnapshotSchema,
  EvidenceReviewDecisionSchema,
  EvidenceWorkspaceSchema,
  type EvidenceProductJob,
  type EvidenceProductRepository,
  type EvidenceProductSnapshot,
  type EvidenceReviewDecision,
} from '@acme/evidence-product-contracts';
import {
  EvidenceAssessmentSchema,
  EvidenceObservationSchema,
  EvidenceOpenQuestionSchema,
  EvidenceRelationSchema,
  SourceArtifactVersionSchema,
} from '@acme/module-evidence';
import type { Pool, PoolClient } from 'pg';

function assertSchemaName(name: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) {
    throw new Error(`Invalid schema name ${JSON.stringify(name)}.`);
  }
  return name;
}

function qIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function same(left: unknown, right: unknown): boolean {
  return canonicalJson(left as never) === canonicalJson(right as never);
}

function decisionCommand(value: EvidenceReviewDecision): unknown {
  return {
    workspaceId: value.workspaceId,
    targetKind: value.targetKind,
    targetVersionId: value.targetVersionId,
    action: value.action,
    reviewerRef: value.reviewerRef,
    rationale: value.rationale,
    commandKey: value.commandKey,
    basisEvidenceRevision: value.basisEvidenceRevision,
  };
}

async function withWrite<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // prefer original
      }
      throw error;
    }
  } finally {
    client.release();
  }
}

export function createPostgresEvidenceProductRepository(options: {
  readonly pool: Pool;
  readonly schema?: string;
}): EvidenceProductRepository {
  const schema = assertSchemaName(options.schema ?? 'evidence');
  const s = qIdent(schema);
  const pool = options.pool;

  async function loadSnapshot(
    client: PoolClient | Pool,
  ): Promise<EvidenceProductSnapshot> {
    const [
      workspaces,
      sources,
      observations,
      relations,
      openQuestions,
      assessments,
      jobs,
      reviewDecisions,
    ] = await Promise.all([
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.workspaces ORDER BY workspace_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.sources ORDER BY artifact_version_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.observations ORDER BY observation_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.relations ORDER BY relation_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.open_questions ORDER BY open_question_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.assessments ORDER BY assessment_version_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.jobs ORDER BY job_id`,
      ),
      client.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.review_decisions
           ORDER BY decided_at, review_decision_id`,
      ),
    ]);

    return EvidenceProductSnapshotSchema.parse({
      schemaVersion: EVIDENCE_PRODUCT_SNAPSHOT_SCHEMA_VERSION,
      workspaces: workspaces.rows.map((row) => JSON.parse(row.record_json)),
      sources: sources.rows.map((row) => JSON.parse(row.record_json)),
      observations: observations.rows.map((row) => JSON.parse(row.record_json)),
      relations: relations.rows.map((row) => JSON.parse(row.record_json)),
      openQuestions: openQuestions.rows.map((row) =>
        JSON.parse(row.record_json),
      ),
      assessments: assessments.rows.map((row) => JSON.parse(row.record_json)),
      jobs: jobs.rows.map((row) => JSON.parse(row.record_json)),
      reviewDecisions: reviewDecisions.rows.map((row) =>
        JSON.parse(row.record_json),
      ),
    });
  }

  return {
    async snapshot() {
      return clone(await loadSnapshot(pool));
    },

    async putWorkspace(workspace) {
      const value = EvidenceWorkspaceSchema.parse(workspace);
      return withWrite(pool, async (client) => {
        const existing = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.workspaces WHERE workspace_id = $1`,
          [value.workspaceId],
        );
        const row = existing.rows[0];
        if (row !== undefined) {
          const stored = EvidenceWorkspaceSchema.parse(
            JSON.parse(row.record_json),
          );
          if (!same(stored, value)) {
            throw new EvidenceProductCommandCollisionError(value.workspaceId);
          }
          return clone(stored);
        }
        await client.query(
          `INSERT INTO ${s}.workspaces (workspace_id, record_json)
           VALUES ($1, $2)`,
          [value.workspaceId, canonicalJson(value as never)],
        );
        return clone(value);
      });
    },

    async putSource(source) {
      const value = SourceArtifactVersionSchema.parse(source);
      return withWrite(pool, async (client) => {
        const existing = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.sources WHERE artifact_version_id = $1`,
          [value.artifactVersionId],
        );
        const row = existing.rows[0];
        if (row !== undefined) {
          const stored = SourceArtifactVersionSchema.parse(
            JSON.parse(row.record_json),
          );
          if (!same(stored, value)) {
            throw new EvidenceProductCommandCollisionError(
              value.artifactVersionId,
            );
          }
          return clone(stored);
        }
        await client.query(
          `INSERT INTO ${s}.sources (artifact_version_id, record_json)
           VALUES ($1, $2)`,
          [value.artifactVersionId, canonicalJson(value as never)],
        );
        return clone(value);
      });
    },

    async putObservations(observations) {
      const values = observations.map((value) =>
        EvidenceObservationSchema.parse(value),
      );
      return withWrite(pool, async (client) => {
        for (const value of values) {
          const existing = await client.query<{ record_json: string }>(
            `SELECT record_json FROM ${s}.observations WHERE observation_id = $1`,
            [value.observationId],
          );
          const row = existing.rows[0];
          if (row !== undefined) {
            const stored = EvidenceObservationSchema.parse(
              JSON.parse(row.record_json),
            );
            if (!same(stored, value)) {
              throw new EvidenceProductCommandCollisionError(
                value.observationId,
              );
            }
            continue;
          }
          await client.query(
            `INSERT INTO ${s}.observations (observation_id, record_json)
             VALUES ($1, $2)`,
            [value.observationId, canonicalJson(value as never)],
          );
        }
        return clone(values);
      });
    },

    async putRelations(relations) {
      const values = relations.map((value) =>
        EvidenceRelationSchema.parse(value),
      );
      return withWrite(pool, async (client) => {
        for (const value of values) {
          const existing = await client.query<{ record_json: string }>(
            `SELECT record_json FROM ${s}.relations WHERE relation_id = $1`,
            [value.relationId],
          );
          const row = existing.rows[0];
          if (row !== undefined) {
            const stored = EvidenceRelationSchema.parse(
              JSON.parse(row.record_json),
            );
            if (!same(stored, value)) {
              throw new EvidenceProductCommandCollisionError(value.relationId);
            }
            continue;
          }
          await client.query(
            `INSERT INTO ${s}.relations (relation_id, record_json)
             VALUES ($1, $2)`,
            [value.relationId, canonicalJson(value as never)],
          );
        }
        return clone(values);
      });
    },

    async putOpenQuestions(openQuestions) {
      const values = openQuestions.map((value) =>
        EvidenceOpenQuestionSchema.parse(value),
      );
      return withWrite(pool, async (client) => {
        for (const value of values) {
          const existing = await client.query<{ record_json: string }>(
            `SELECT record_json FROM ${s}.open_questions WHERE open_question_id = $1`,
            [value.openQuestionId],
          );
          const row = existing.rows[0];
          if (row !== undefined) {
            const stored = EvidenceOpenQuestionSchema.parse(
              JSON.parse(row.record_json),
            );
            if (!same(stored, value)) {
              throw new EvidenceProductCommandCollisionError(
                value.openQuestionId,
              );
            }
            continue;
          }
          await client.query(
            `INSERT INTO ${s}.open_questions (open_question_id, record_json)
             VALUES ($1, $2)`,
            [value.openQuestionId, canonicalJson(value as never)],
          );
        }
        return clone(values);
      });
    },

    async putAssessments(assessments) {
      const values = assessments.map((value) =>
        EvidenceAssessmentSchema.parse(value),
      );
      return withWrite(pool, async (client) => {
        for (const value of values) {
          const existing = await client.query<{ record_json: string }>(
            `SELECT record_json FROM ${s}.assessments WHERE assessment_version_id = $1`,
            [value.assessmentVersionId],
          );
          const row = existing.rows[0];
          if (row !== undefined) {
            const stored = EvidenceAssessmentSchema.parse(
              JSON.parse(row.record_json),
            );
            if (!same(stored, value)) {
              throw new EvidenceProductCommandCollisionError(
                value.assessmentVersionId,
              );
            }
            continue;
          }
          await client.query(
            `INSERT INTO ${s}.assessments (assessment_version_id, record_json)
             VALUES ($1, $2)`,
            [value.assessmentVersionId, canonicalJson(value as never)],
          );
        }
        return clone(values);
      });
    },

    async putJob(job: EvidenceProductJob) {
      return withWrite(pool, async (client) => {
        const existing = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.jobs WHERE job_id = $1`,
          [job.jobId],
        );
        const row = existing.rows[0];
        if (row !== undefined) {
          const stored = JSON.parse(row.record_json) as EvidenceProductJob;
          if (
            stored.workspaceId !== job.workspaceId ||
            stored.commandKey !== job.commandKey ||
            stored.artifactVersionId !== job.artifactVersionId
          ) {
            throw new EvidenceProductCommandCollisionError(job.commandKey);
          }
        }
        await client.query(
          `INSERT INTO ${s}.jobs (
             job_id, workspace_id, command_key, artifact_version_id, record_json
           ) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (job_id) DO UPDATE SET
             workspace_id = EXCLUDED.workspace_id,
             command_key = EXCLUDED.command_key,
             artifact_version_id = EXCLUDED.artifact_version_id,
             record_json = EXCLUDED.record_json`,
          [
            job.jobId,
            job.workspaceId,
            job.commandKey,
            job.artifactVersionId,
            canonicalJson(job as never),
          ],
        );
        return clone(job);
      });
    },

    async appendReviewDecision(decision) {
      const value = EvidenceReviewDecisionSchema.parse(decision);
      return withWrite(pool, async (client) => {
        const existing = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.review_decisions
            WHERE workspace_id = $1 AND command_key = $2`,
          [value.workspaceId, value.commandKey],
        );
        const row = existing.rows[0];
        if (row !== undefined) {
          const stored = EvidenceReviewDecisionSchema.parse(
            JSON.parse(row.record_json),
          );
          if (!same(decisionCommand(stored), decisionCommand(value))) {
            throw new EvidenceProductCommandCollisionError(value.commandKey);
          }
          return clone(stored);
        }
        await client.query(
          `INSERT INTO ${s}.review_decisions (
             review_decision_id, workspace_id, command_key, decided_at, record_json
           ) VALUES ($1, $2, $3, $4, $5)`,
          [
            value.reviewDecisionId,
            value.workspaceId,
            value.commandKey,
            value.decidedAt,
            canonicalJson(value as never),
          ],
        );
        return clone(value);
      });
    },

    async advanceEvidenceRevision(workspaceId, expectedRevision, nextRevision) {
      return withWrite(pool, async (client) => {
        const existing = await client.query<{ record_json: string }>(
          `SELECT record_json FROM ${s}.workspaces WHERE workspace_id = $1 FOR UPDATE`,
          [workspaceId],
        );
        const row = existing.rows[0];
        if (row === undefined) {
          throw new RangeError(`Unknown workspace ${workspaceId}.`);
        }
        const current = EvidenceWorkspaceSchema.parse(
          JSON.parse(row.record_json),
        );
        if (
          current.evidenceRevision !== expectedRevision ||
          nextRevision < expectedRevision ||
          nextRevision > expectedRevision + 1
        ) {
          throw new EvidenceProductCommandCollisionError(
            `revision:${workspaceId}`,
          );
        }
        const value = EvidenceWorkspaceSchema.parse({
          ...current,
          evidenceRevision: nextRevision,
        });
        await client.query(
          `UPDATE ${s}.workspaces SET record_json = $2 WHERE workspace_id = $1`,
          [workspaceId, canonicalJson(value as never)],
        );
        return clone(value);
      });
    },
  };
}
