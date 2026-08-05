import { canonicalJson, type Hashing, type JsonValue } from '@acme/core';
import {
  QualityEvaluationError,
  validateQualityEvaluationRecordIdentity,
  type QualityEvaluationQuery,
  type QualityEvaluationRecord,
  type QualityEvaluationStore,
} from '@acme/evaluation';

export interface InMemoryQualityEvaluationStoreOptions {
  readonly hashing?: Hashing;
}

/** Append-only reference adapter for post-execution quality evidence. */
export function createInMemoryQualityEvaluationStore(
  options: InMemoryQualityEvaluationStoreOptions = {},
): QualityEvaluationStore {
  const records = new Map<string, QualityEvaluationRecord>();
  const hashing = options.hashing;

  return Object.freeze({
    async put(
      candidate: QualityEvaluationRecord,
    ): Promise<'created' | 'existing'> {
      const record = validateQualityEvaluationRecordIdentity(
        candidate,
        hashing,
      );
      const existing = records.get(record.evaluationId);
      if (existing !== undefined) {
        if (
          canonicalJson(existing as unknown as JsonValue) !==
          canonicalJson(record as unknown as JsonValue)
        ) {
          throw new QualityEvaluationError(
            'QUALITY_STORE_COLLISION',
            `Quality evaluation ${JSON.stringify(record.evaluationId)} already exists with different content.`,
          );
        }
        return 'existing';
      }
      records.set(record.evaluationId, record);
      return 'created';
    },

    async get(evaluationId: string): Promise<QualityEvaluationRecord | null> {
      const record = records.get(evaluationId);
      return record === undefined
        ? null
        : validateQualityEvaluationRecordIdentity(record, hashing);
    },

    async list(
      query: QualityEvaluationQuery = {},
    ): Promise<readonly QualityEvaluationRecord[]> {
      return Object.freeze(
        [...records.values()]
          .filter(
            (record) =>
              (query.runId === undefined ||
                record.subject.runId === query.runId) &&
              (query.executionId === undefined ||
                record.subject.executionId === query.executionId),
          )
          .sort((left, right) =>
            left.evaluationId.localeCompare(right.evaluationId),
          )
          .map((record) =>
            validateQualityEvaluationRecordIdentity(record, hashing),
          ),
      );
    },
  });
}
