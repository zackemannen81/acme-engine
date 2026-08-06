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
import type { Database } from 'better-sqlite3';

import { withSqliteDriverErrors } from './driver-errors.js';

export interface SqliteQualityEvaluationStoreOptions {
  readonly database: Database;
  readonly hashing?: Hashing;
}

interface QualityEvaluationRow {
  readonly evaluation_id: string;
  readonly record_json: string;
}

/**
 * Durable append-only quality evaluation store (ACME-0065 / plan Q1).
 * Same public port as the in-memory adapter; rows live beside the ledger DB
 * without a foreign key into execution tables.
 */
export function createSqliteQualityEvaluationStore(
  options: SqliteQualityEvaluationStoreOptions,
): QualityEvaluationStore {
  const hashing = options.hashing ?? nodeHashing;
  const database = options.database;

  const getById = database.prepare(
    `SELECT evaluation_id, record_json
       FROM quality_evaluations
      WHERE evaluation_id = ?`,
  );
  const insert = database.prepare(
    `INSERT INTO quality_evaluations (
      evaluation_id, run_id, execution_id, subject_digest, result_digest,
      evaluator_id, evaluator_version, evaluator_kind, verdict, record_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const listAll = database.prepare(
    `SELECT evaluation_id, record_json
       FROM quality_evaluations
      ORDER BY evaluation_id`,
  );
  const listByRun = database.prepare(
    `SELECT evaluation_id, record_json
       FROM quality_evaluations
      WHERE run_id = ?
      ORDER BY evaluation_id`,
  );
  const listByExecution = database.prepare(
    `SELECT evaluation_id, record_json
       FROM quality_evaluations
      WHERE execution_id = ?
      ORDER BY evaluation_id`,
  );
  const listByRunAndExecution = database.prepare(
    `SELECT evaluation_id, record_json
       FROM quality_evaluations
      WHERE run_id = ? AND execution_id = ?
      ORDER BY evaluation_id`,
  );

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
      // Collision is a quality-domain error; keep it outside the SQLite driver
      // mapper so QUALITY_STORE_COLLISION is not rewritten to INTERNAL.
      const existing = withSqliteDriverErrors(
        () =>
          getById.get(record.evaluationId) as QualityEvaluationRow | undefined,
      );
      if (existing !== undefined) {
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
      withSqliteDriverErrors(() => {
        insert.run(
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
        );
      });
      return 'created';
    },

    async get(evaluationId: string): Promise<QualityEvaluationRecord | null> {
      return withSqliteDriverErrors(() => {
        const row = getById.get(evaluationId) as
          | QualityEvaluationRow
          | undefined;
        return row === undefined ? null : parseRow(row);
      });
    },

    async list(
      query: QualityEvaluationQuery = {},
    ): Promise<readonly QualityEvaluationRecord[]> {
      return withSqliteDriverErrors(() => {
        let rows: QualityEvaluationRow[];
        if (query.runId !== undefined && query.executionId !== undefined) {
          rows = listByRunAndExecution.all(
            query.runId,
            query.executionId,
          ) as QualityEvaluationRow[];
        } else if (query.runId !== undefined) {
          rows = listByRun.all(query.runId) as QualityEvaluationRow[];
        } else if (query.executionId !== undefined) {
          rows = listByExecution.all(
            query.executionId,
          ) as QualityEvaluationRow[];
        } else {
          rows = listAll.all() as QualityEvaluationRow[];
        }
        return Object.freeze(rows.map((row) => parseRow(row)));
      });
    },
  });
}
