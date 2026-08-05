import {
  canonicalJson,
  sha256,
  type Hashing,
  type JsonValue,
} from '@acme/core';
import {
  createQualityEvaluationInput,
  createQualityEvaluationRecord,
  type QualityEvaluationRecord,
  type QualityEvaluationStore,
} from '@acme/evaluation';
import { describe, expect, it } from 'vitest';

export interface QualityEvaluationStoreConformanceOptions {
  readonly createStore: (hashing?: Hashing) => QualityEvaluationStore;
}

function record(
  runId: string,
  evaluatorId: string,
  verdict: 'pass' | 'fail' = 'pass',
  hashing?: Hashing,
): QualityEvaluationRecord {
  const input = createQualityEvaluationInput({
    runId,
    executionResult: {
      status: 'committed',
      executionId: `execution-${runId}`,
      replayed: false,
      revision: 1,
      documentKeys: ['artifact'],
      eventIds: [],
    },
    operationDigest: sha256(`operation-${runId}`),
    artifact: { kind: 'document', id: 'artifact', value: { runId } },
    contract: {
      id: 'conformance.observe',
      version: '1.0.0',
      fingerprint: sha256('contract'),
    },
    ...(hashing === undefined ? {} : { hashing }),
  });
  return createQualityEvaluationRecord({
    input,
    evaluator: {
      id: evaluatorId,
      version: '1.0.0',
      kind: 'deterministic',
    },
    result: { scores: [], findings: [], verdict },
    ...(hashing === undefined ? {} : { hashing }),
  });
}

export function qualityEvaluationStoreConformance(
  name: string,
  options: QualityEvaluationStoreConformanceOptions,
): void {
  describe(`${name} quality evaluation store conformance`, () => {
    it('stores append-only records and treats an identical retry as idempotent', async () => {
      const store = options.createStore();
      const candidate = record('run-a', 'quality-a');
      await expect(store.put(candidate)).resolves.toBe('created');
      await expect(store.put(candidate)).resolves.toBe('existing');
      await expect(store.get(candidate.evaluationId)).resolves.toStrictEqual(
        candidate,
      );
    });

    it('filters and deterministically orders detached reads', async () => {
      const store = options.createStore();
      const candidates = [
        record('run-b', 'quality-z'),
        record('run-a', 'quality-b'),
        record('run-a', 'quality-a'),
      ];
      for (const candidate of candidates) await store.put(candidate);
      const listed = await store.list({ runId: 'run-a' });
      expect(listed).toHaveLength(2);
      expect(listed.map((entry) => entry.evaluationId)).toStrictEqual(
        listed.map((entry) => entry.evaluationId).toSorted(),
      );
      expect(Object.isFrozen(listed[0])).toBe(true);
    });

    it('refuses divergent content under the same evaluation identity', async () => {
      const collisionHashing: Hashing = {
        canonicalJson,
        sha256: () => 'a'.repeat(64),
      };
      const store = options.createStore(collisionHashing);
      const first = record('run-a', 'quality', 'pass', collisionHashing);
      const divergent = record('run-a', 'quality', 'fail', collisionHashing);
      expect(first.evaluationId).toBe(divergent.evaluationId);
      expect(canonicalJson(first as unknown as JsonValue)).not.toBe(
        canonicalJson(divergent as unknown as JsonValue),
      );
      await store.put(first);
      await expect(store.put(divergent)).rejects.toMatchObject({
        code: 'QUALITY_STORE_COLLISION',
      });
    });
  });
}
