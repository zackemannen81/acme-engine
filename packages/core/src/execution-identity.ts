import type { Hashing, JsonValue } from './common.js';
import { AcmeError } from './errors.js';
import type { ExecutionPolicy } from './execution-types.js';
import { nodeHashing } from './hashing.js';
import type { ModelSelection } from './model.js';
import { validateModelSelection } from './model-validation.js';

export const ACME_EXECUTION_ID_ALGORITHM = 'acme-execution-id-1' as const;
export const ACME_OPERATION_KEY_ALGORITHM = 'acme-operation-key-1' as const;
export const ACME_REQUEST_FINGERPRINT_ALGORITHM =
  'acme-request-fingerprint-1' as const;
export const ACME_MEMORY_RETRIEVAL_ALGORITHM =
  'acme-memory-retrieval-1' as const;
export const ACME_MEMORY_RETRIEVAL_LIMIT = 50 as const;

export const DEFAULT_EXECUTION_POLICY: ExecutionPolicy = Object.freeze({
  timeoutMs: 30_000,
  maxModelCalls: 1,
  maxRepairCalls: 0,
  maxRevisionCalls: 0,
  retention: 'hash-only',
});

export const MILESTONE_1_MEMORY_RETRIEVAL = Object.freeze({
  algorithm: ACME_MEMORY_RETRIEVAL_ALGORITHM,
  limit: ACME_MEMORY_RETRIEVAL_LIMIT,
});

const policyKeys = new Set([
  'timeoutMs',
  'maxModelCalls',
  'maxRepairCalls',
  'maxRevisionCalls',
  'maxInputTokens',
  'maxOutputTokens',
  'maxEstimatedCostMinor',
  'retention',
]);

function invalid(message: string, details?: JsonValue): never {
  throw new AcmeError({
    code: 'INVALID_REQUEST',
    message,
    stage: 'accepted',
    retryable: false,
    ...(details === undefined ? {} : { details }),
  });
}

function requireText(value: string, field: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    invalid(`${field} must be a non-empty string.`, { field });
  }
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    invalid(`${field} must be a positive safe integer.`, { field });
  }
  return value as number;
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    invalid(`${field} must be a non-negative safe integer.`, { field });
  }
  return value as number;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

export function resolveExecutionPolicy(
  supplied?: Partial<ExecutionPolicy>,
): ExecutionPolicy {
  if (
    supplied !== undefined &&
    (supplied === null ||
      typeof supplied !== 'object' ||
      Array.isArray(supplied))
  ) {
    invalid('Execution policy must be an object.');
  }
  const policy = supplied ?? {};
  const unexpected = Object.keys(policy)
    .filter((key) => !policyKeys.has(key))
    .sort();
  if (unexpected.length > 0) {
    invalid('Execution policy contains unexpected fields.', { unexpected });
  }

  const timeoutMs =
    policy.timeoutMs === undefined
      ? DEFAULT_EXECUTION_POLICY.timeoutMs
      : positiveInteger(policy.timeoutMs, 'policy.timeoutMs');
  const maxModelCalls =
    policy.maxModelCalls === undefined
      ? DEFAULT_EXECUTION_POLICY.maxModelCalls
      : nonNegativeInteger(policy.maxModelCalls, 'policy.maxModelCalls');
  const maxRepairCalls =
    policy.maxRepairCalls === undefined
      ? DEFAULT_EXECUTION_POLICY.maxRepairCalls
      : nonNegativeInteger(policy.maxRepairCalls, 'policy.maxRepairCalls');
  const maxRevisionCalls =
    policy.maxRevisionCalls === undefined
      ? DEFAULT_EXECUTION_POLICY.maxRevisionCalls
      : nonNegativeInteger(policy.maxRevisionCalls, 'policy.maxRevisionCalls');
  const retention = policy.retention ?? DEFAULT_EXECUTION_POLICY.retention;
  if (
    retention !== 'none' &&
    retention !== 'hash-only' &&
    retention !== 'encrypted-payload'
  ) {
    invalid('policy.retention is invalid.');
  }
  // One primary call and no revision calls remain the Milestone 1 bound.
  // ADR-0045 §5 admits a bounded repair budget: the engine implements the
  // repair call it already declared, so a recoverably invalid response is
  // corrected within budget rather than paid for and discarded. Repair is
  // budgeted separately from the primary call and never loops.
  if (maxModelCalls !== 1 || maxRevisionCalls !== 0) {
    invalid(
      'An execution allows exactly one model call and zero revision calls.',
      { maxModelCalls, maxRepairCalls, maxRevisionCalls },
    );
  }

  return deepFreeze({
    timeoutMs,
    maxModelCalls,
    maxRepairCalls,
    maxRevisionCalls,
    ...(policy.maxInputTokens === undefined
      ? {}
      : {
          maxInputTokens: positiveInteger(
            policy.maxInputTokens,
            'policy.maxInputTokens',
          ),
        }),
    ...(policy.maxOutputTokens === undefined
      ? {}
      : {
          maxOutputTokens: positiveInteger(
            policy.maxOutputTokens,
            'policy.maxOutputTokens',
          ),
        }),
    ...(policy.maxEstimatedCostMinor === undefined
      ? {}
      : {
          maxEstimatedCostMinor: positiveInteger(
            policy.maxEstimatedCostMinor,
            'policy.maxEstimatedCostMinor',
          ),
        }),
    retention,
  });
}

export function deriveExecutionId(
  namespace: string,
  requestKey: string,
  hashing: Hashing = nodeHashing,
): string {
  requireText(namespace, 'namespace');
  requireText(requestKey, 'requestKey');
  return `execution_${hashing.sha256(
    hashing.canonicalJson({
      algorithm: ACME_EXECUTION_ID_ALGORITHM,
      namespace,
      requestKey,
    }),
  )}`;
}

export interface OperationKeyInput {
  readonly executionId: string;
  readonly namespace: string;
  readonly task: string;
  readonly entityId: string;
}

export function deriveOperationKey(
  input: OperationKeyInput,
  hashing: Hashing = nodeHashing,
): string {
  requireText(input.executionId, 'executionId');
  requireText(input.namespace, 'namespace');
  requireText(input.task, 'task');
  requireText(input.entityId, 'entityId');
  return `operation_${hashing.sha256(
    hashing.canonicalJson({
      algorithm: ACME_OPERATION_KEY_ALGORITHM,
      executionId: input.executionId,
      namespace: input.namespace,
      task: input.task,
      entityId: input.entityId,
    }),
  )}`;
}

export interface RequestFingerprintInput {
  readonly namespace: string;
  readonly task: string;
  readonly entityId: string;
  readonly expectedRevision: number;
  readonly input: JsonValue;
  readonly contractFingerprint: string;
  readonly stateSchemaVersion: string;
  readonly model: ModelSelection;
}

export function computeRequestFingerprint(
  input: RequestFingerprintInput,
  hashing: Hashing = nodeHashing,
): string {
  requireText(input.namespace, 'namespace');
  requireText(input.task, 'task');
  requireText(input.entityId, 'entityId');
  requireText(input.contractFingerprint, 'contractFingerprint');
  requireText(input.stateSchemaVersion, 'stateSchemaVersion');
  if (
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 0
  ) {
    invalid('expectedRevision must be a non-negative safe integer.');
  }
  const model = validateModelSelection(input.model);
  return hashing.sha256(
    hashing.canonicalJson({
      algorithm: ACME_REQUEST_FINGERPRINT_ALGORITHM,
      namespace: input.namespace,
      task: input.task,
      entityId: input.entityId,
      expectedRevision: input.expectedRevision,
      input: input.input,
      contractFingerprint: input.contractFingerprint,
      stateSchemaVersion: input.stateSchemaVersion,
      model,
      retrieval: MILESTONE_1_MEMORY_RETRIEVAL,
    } as unknown as JsonValue),
  );
}

export function computeTaskInputHash(
  input: JsonValue,
  hashing: Hashing = nodeHashing,
): string {
  return hashing.sha256(hashing.canonicalJson(input));
}
