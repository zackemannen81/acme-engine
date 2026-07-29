import type { JsonValue } from './common.js';
import type { ExecutionStatus } from './execution-types.js';

export type AcmeErrorCode =
  | 'INVALID_REQUEST'
  | 'NOT_FOUND_MODULE'
  | 'NOT_FOUND_TASK'
  | 'NOT_FOUND_CONTRACT'
  | 'UNSUPPORTED_CAPABILITY'
  | 'CONFLICT_IDEMPOTENCY_KEY'
  | 'CONFLICT_STATE_REVISION'
  | 'BUDGET_EXCEEDED'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'MODEL_RATE_LIMIT'
  | 'MODEL_AUTH'
  | 'MODEL_UNAVAILABLE'
  | 'MODEL_CONTENT_FILTER'
  | 'MODEL_INVALID_RESPONSE'
  | 'DOMAIN_INVALID_RESULT'
  | 'EVALUATION_BLOCKED'
  | 'PERSISTENCE_TRANSIENT'
  | 'PERSISTENCE_CORRUPTION'
  | 'INTERNAL';

export interface AcmeErrorData {
  readonly code: AcmeErrorCode;
  readonly message: string;
  readonly stage: ExecutionStatus;
  readonly retryable: boolean;
  readonly details?: JsonValue;
  readonly causeRef?: string;
}

export class AcmeError extends Error {
  readonly data: AcmeErrorData;

  constructor(data: AcmeErrorData, options?: ErrorOptions) {
    super(data.message, options);
    this.name = 'AcmeError';
    this.data = Object.freeze({ ...data });
  }
}
