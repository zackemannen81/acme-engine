import type { Hashing, JsonValue } from './common.js';
import { nodeHashing } from './hashing.js';
import type {
  PreparedCommit,
  PreparedCommitContent,
  PreparedEvaluatorRun,
} from './repository.js';

export const ACME_OPERATION_DIGEST_ALGORITHM =
  'acme-operation-digest-1' as const;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareEvaluators(
  left: PreparedEvaluatorRun,
  right: PreparedEvaluatorRun,
): number {
  return (
    compareText(left.evaluatorId, right.evaluatorId) ||
    left.attempt - right.attempt
  );
}

export function computeOperationDigest(
  prepared: PreparedCommitContent | PreparedCommit,
  hashing: Hashing = nodeHashing,
): string {
  const input: JsonValue = {
    algorithm: ACME_OPERATION_DIGEST_ALGORITHM,
    executionId: prepared.executionId,
    expectedRevision: prepared.expectedRevision,
    documents: [...prepared.documents].sort((left, right) =>
      compareText(left.key, right.key),
    ) as unknown as JsonValue,
    memoryCandidates: [...prepared.memoryCandidates].sort((left, right) =>
      compareText(left.key, right.key),
    ) as unknown as JsonValue,
    memory: prepared.memory as unknown as JsonValue,
    state: prepared.state as unknown as JsonValue,
    evaluatorRuns: [...prepared.evaluatorRuns].sort(
      compareEvaluators,
    ) as unknown as JsonValue,
    events: [...prepared.events].sort((left, right) =>
      compareText(left.key, right.key),
    ) as unknown as JsonValue,
    committedAt: prepared.committedAt,
  };

  return hashing.sha256(hashing.canonicalJson(input));
}
