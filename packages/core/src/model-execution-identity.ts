import type { Hashing, JsonValue } from './common.js';
import { AcmeError } from './errors.js';
import { nodeHashing } from './hashing.js';
import type { ModelCapabilities, ModelSelection } from './model.js';
import { validateModelSelection } from './model-validation.js';
import {
  DEFAULT_MODEL_EXECUTION_POLICY,
  type ModelExecutionPolicy,
} from './model-execution-types.js';

export const ACME_MODEL_EXECUTION_ID_ALGORITHM =
  'acme-model-execution-id-1' as const;
export const ACME_MODEL_EXECUTION_FINGERPRINT_ALGORITHM =
  'acme-model-execution-fingerprint-1' as const;

const policyKeys = new Set(['timeoutMs', 'retention']);

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

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

export function resolveModelExecutionPolicy(
  supplied?: Partial<ModelExecutionPolicy>,
): ModelExecutionPolicy {
  if (
    supplied !== undefined &&
    (supplied === null ||
      typeof supplied !== 'object' ||
      Array.isArray(supplied))
  ) {
    invalid('Model execution policy must be an object.');
  }
  const policy = supplied ?? {};
  const unexpected = Object.keys(policy)
    .filter((key) => !policyKeys.has(key))
    .sort();
  if (unexpected.length > 0) {
    invalid('Model execution policy contains unexpected fields.', {
      unexpected,
    });
  }
  const timeoutMs =
    policy.timeoutMs === undefined
      ? DEFAULT_MODEL_EXECUTION_POLICY.timeoutMs
      : positiveInteger(policy.timeoutMs, 'policy.timeoutMs');
  const retention =
    policy.retention ?? DEFAULT_MODEL_EXECUTION_POLICY.retention;
  if (
    retention !== 'none' &&
    retention !== 'hash-only' &&
    retention !== 'encrypted-payload'
  ) {
    invalid('policy.retention is invalid.');
  }
  return deepFreeze({ timeoutMs, retention });
}

export function deriveModelExecutionId(
  requestKey: string,
  hashing: Hashing = nodeHashing,
): string {
  requireText(requestKey, 'requestKey');
  return `model_execution_${hashing.sha256(
    hashing.canonicalJson({
      algorithm: ACME_MODEL_EXECUTION_ID_ALGORITHM,
      requestKey,
    }),
  )}`;
}

export interface ModelExecutionFingerprintInput {
  readonly requestKey: string;
  readonly model: ModelSelection;
  readonly requestHash: string;
  readonly requiredCapabilities: Partial<ModelCapabilities>;
  readonly policy: ModelExecutionPolicy;
}

export function computeModelExecutionFingerprint(
  input: ModelExecutionFingerprintInput,
  hashing: Hashing = nodeHashing,
): string {
  requireText(input.requestKey, 'requestKey');
  requireText(input.requestHash, 'requestHash');
  const model = validateModelSelection(input.model);
  return hashing.sha256(
    hashing.canonicalJson({
      algorithm: ACME_MODEL_EXECUTION_FINGERPRINT_ALGORITHM,
      requestKey: input.requestKey,
      model,
      requestHash: input.requestHash,
      requiredCapabilities: input.requiredCapabilities,
      policy: input.policy,
    } as unknown as JsonValue),
  );
}
