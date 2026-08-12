import {
  canonicalJson,
  nodeHashing,
  type Hashing,
  type JsonValue,
} from '@acme/core';
import {
  QualityEvaluationError,
  validateQualityEvaluationRecordIdentity,
  type QualityEvaluationQuery,
  type QualityEvaluationRecord,
  type QualityEvaluationStore,
} from '@acme/evaluation';
import type { Pool } from 'pg';

import { withPostgresDriverErrors } from './driver-errors.js';
import { assertSchemaName, qIdent } from './schema.js';
import { execute, queryAll, queryOne } from './transaction.js';

export interface PostgresQualityEvaluationStoreOptions {
  readonly pool: Pool;
  readonly hashing?: Hashing;
  readonly schema?: string;
}

interface QualityEvaluationRow {
  readonly evaluation_id: string;
  readonly record_json: string;
}

/**
 * Durable append-only quality evaluation store (ADR-0026 / ACME-0085).
 * Same public port as the SQLite and in-memory adapters; rows live in the
 * `acme` schema without a foreign key into execution tables.
 */
export function createPostgresQualityEvaluationStore(
  options: PostgresQualityEvaluationStoreOptions,
): QualityEvaluationStore {
  const hashing = options.hashing ?? nodeHashing;
  const pool = options.pool;
  const schema = assertSchemaName(options.schema ?? 'acme');
  const s = qIdent(schema);

  function parseRow(row: QualityEvaluationRow): QualityEvaluationRecord {
    const parsed = JSON.parse(row.record_json) as QualityEvaluationRecord;
    return validateQualityEvaluationRecordIdentity(parsed, hashing);
  }

  return Object.freeze({
    async put(
      candidate: QualityEvaluationRecord,
    ): Promise<'created' | 'existing'> {
      const record = validateQualityEvaluationRecordIdentity(
        candidate,
        hashing,
      );
      // Collision is a quality-domain error; keep it outside the driver mapper
      // so QUALITY_STORE_COLLISION is not rewritten to INTERNAL (SQLite parity).
      let rowCount: number;
      try {
        rowCount = await withPostgresDriverErrors(async () =>
          execute(
            pool,
            `INSERT INTO ${s}.quality_evaluations (
              evaluation_id, run_id, execution_id, subject_digest, result_digest,
              evaluator_id, evaluator_version, evaluator_kind, verdict, record_json
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (evaluation_id) DO NOTHING`,
            [
              record.evaluationId,
              record.subject.runId,
              record.subject.executionId,
              record.subjectDigest,
              record.resultDigest,
              record.evaluator.id,
              record.evaluator.version,
              record.evaluator.kind,
              record.result.verdict,
              hashing.canonicalJson(record as unknown as JsonValue),
            ],
          ),
        );
      } catch (error) {
        if (error instanceof QualityEvaluationError) {
          throw error;
        }
        throw error;
      }
      if (rowCount === 0) {
        const existing = await withPostgresDriverErrors(async () =>
          queryOne<QualityEvaluationRow>(
            pool,
            `SELECT evaluation_id, record_json
               FROM ${s}.quality_evaluations
              WHERE evaluation_id = $1`,
            [record.evaluationId],
          ),
        );
        if (existing === undefined) {
          throw new QualityEvaluationError(
            'QUALITY_STORE_COLLISION',
            `Quality evaluation ${JSON.stringify(record.evaluationId)} conflicted without a stored row.`,
          );
        }
        const stored = parseRow(existing);
        if (
          canonicalJson(stored as unknown as JsonValue) !==
          canonicalJson(record as unknown as JsonValue)
        ) {
          throw new QualityEvaluationError(
            'QUALITY_STORE_COLLISION',
            `Quality evaluation ${JSON.stringify(record.evaluationId)} already exists with different content.`,
          );
        }
        return 'existing';
      }
      return 'created';
    },

    async get(evaluationId: string): Promise<QualityEvaluationRecord | null> {
      return withPostgresDriverErrors(async () => {
        const row = await queryOne<QualityEvaluationRow>(
          pool,
          `SELECT evaluation_id, record_json
             FROM ${s}.quality_evaluations
            WHERE evaluation_id = $1`,
          [evaluationId],
        );
        return row === undefined ? null : parseRow(row);
      });
    },

    async list(
      query: QualityEvaluationQuery = {},
    ): Promise<readonly QualityEvaluationRecord[]> {
      return withPostgresDriverErrors(async () => {
        let rows: QualityEvaluationRow[];
        if (query.runId !== undefined && query.executionId !== undefined) {
          rows = await queryAll<QualityEvaluationRow>(
            pool,
            `SELECT evaluation_id, record_json
               FROM ${s}.quality_evaluations
              WHERE run_id = $1 AND execution_id = $2
              ORDER BY evaluation_id`,
            [query.runId, query.executionId],
          );
        } else if (query.runId !== undefined) {
          rows = await queryAll<QualityEvaluationRow>(
            pool,
            `SELECT evaluation_id, record_json
               FROM ${s}.quality_evaluations
              WHERE run_id = $1
              ORDER BY evaluation_id`,
            [query.runId],
          );
        } else if (query.executionId !== undefined) {
          rows = await queryAll<QualityEvaluationRow>(
            pool,
            `SELECT evaluation_id, record_json
               FROM ${s}.quality_evaluations
              WHERE execution_id = $1
              ORDER BY evaluation_id`,
            [query.executionId],
          );
        } else {
          rows = await queryAll<QualityEvaluationRow>(
            pool,
            `SELECT evaluation_id, record_json
               FROM ${s}.quality_evaluations
              ORDER BY evaluation_id`,
          );
        }
        return Object.freeze(rows.map((row) => parseRow(row)));
      });
    },
  });
}
