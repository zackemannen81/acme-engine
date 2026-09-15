import type { IsoTimestamp, JsonValue } from './common.js';
import type { AcmeErrorData } from './errors.js';
import type {
  ModelCapabilities,
  ModelRequest,
  ModelSelection,
  NormalizedModelResponse,
  NormalizedUsage,
} from './model.js';

export const ACME_MODEL_EXECUTION_MAX_REQUEST_BYTES = 1_048_576 as const;
export const ACME_MODEL_EXECUTION_MAX_STREAM_EVENT_BYTES = 65_536 as const;
export const ACME_MODEL_EXECUTION_MAX_RETAINED_PAYLOAD_BYTES =
  1_048_576 as const;

export const DEFAULT_MODEL_EXECUTION_POLICY = Object.freeze({
  timeoutMs: 30_000,
  retention: 'hash-only',
}) satisfies ModelExecutionPolicy;

export interface ModelExecutionPolicy {
  readonly timeoutMs: number;
  readonly retention: 'none' | 'hash-only' | 'encrypted-payload';
}

export interface ModelExecutionRequest {
  readonly requestKey: string;
  readonly model: ModelSelection;
  readonly request: ModelRequest;
  readonly requiredCapabilities?: Partial<ModelCapabilities>;
  readonly policy?: Partial<ModelExecutionPolicy>;
}

export type ModelExecutionFailureKind =
  | 'timeout'
  | 'cancel'
  | 'provider-http'
  | 'malformed-stream'
  | 'truncated-stream'
  | 'ambiguous-delivery'
  | 'invalid-response'
  | 'unavailable'
  | 'auth'
  | 'rate-limit'
  | 'content-filter'
  | 'conflict'
  | 'unsupported-capability'
  | 'invalid-request'
  | 'resume-evidence-unavailable'
  | 'cancelled'
  | 'internal';

export interface ModelExecutionDiagnostic {
  readonly kind: ModelExecutionFailureKind | 'completed';
  readonly delivery?: 'not-sent' | 'sent' | 'unknown';
  readonly httpStatus?: number;
  readonly finishReason?: NormalizedModelResponse['finishReason'];
}

export type ModelExecutionStatus =
  | 'accepted'
  | 'calling-model'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'conflicted'
  | 'ambiguous';

export type ModelExecutionResult =
  | {
      readonly status: 'succeeded';
      readonly modelExecutionId: string;
      readonly replayed: boolean;
      readonly response: NormalizedModelResponse;
      readonly usage: NormalizedUsage;
      readonly diagnostic: ModelExecutionDiagnostic;
    }
  | {
      readonly status: 'failed' | 'cancelled' | 'conflicted';
      readonly modelExecutionId: string;
      readonly error: AcmeErrorData;
      readonly diagnostic: ModelExecutionDiagnostic;
    };

export interface ModelExecuteOptions {
  readonly signal?: AbortSignal;
  readonly onEvent?: (
    event: import('./model.js').ModelStreamEvent,
  ) => void | Promise<void>;
}

export interface ModelExecutionRecord {
  readonly modelExecutionId: string;
  readonly requestKey: string;
  readonly requestFingerprint: string;
  readonly requestHash: string;
  readonly selection: ModelSelection;
  readonly request: ModelRequest;
  readonly requiredCapabilities: Partial<ModelCapabilities>;
  readonly policy: ModelExecutionPolicy;
  readonly status: ModelExecutionStatus;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly error?: AcmeErrorData;
  readonly diagnostic?: ModelExecutionDiagnostic;
  readonly result?: ModelExecutionResult;
}

export type JsonObject = { readonly [key: string]: JsonValue };
