import type {
  AcmeErrorData,
  ModelCapabilities,
  ModelExecutionDiagnostic,
  ModelExecutionPolicy,
  ModelRequest,
  ModelSelection,
  NormalizedModelResponse,
  NormalizedUsage,
} from '@acme/core';

export const ACME_MODEL_RUNTIME_PROTOCOL_VERSION =
  'acme-model-runtime/1' as const;
export const ACME_MODEL_RUNTIME_EXECUTE_PATH = '/v1/model/execute' as const;
export const ACME_MODEL_RUNTIME_COMPATIBILITY_PATH =
  '/v1/model/compatibility' as const;
export const ACME_MODEL_RUNTIME_ERROR_VERSION =
  'acme-model-runtime-error/1' as const;
export const ACME_MODEL_RUNTIME_HEADER = 'x-acme-model-runtime-protocol';

export interface AcmeModelRuntimeDescriptor {
  readonly protocolVersion: typeof ACME_MODEL_RUNTIME_PROTOCOL_VERSION;
  readonly engineBuild: string;
  readonly executePath: typeof ACME_MODEL_RUNTIME_EXECUTE_PATH;
}

export interface AcmeModelRuntimeRequest {
  readonly protocolVersion: typeof ACME_MODEL_RUNTIME_PROTOCOL_VERSION;
  readonly requestKey: string;
  readonly correlationId?: string;
  readonly model: ModelSelection;
  readonly request: ModelRequest;
  readonly requiredCapabilities?: Partial<ModelCapabilities>;
  readonly policy?: Partial<ModelExecutionPolicy>;
}

export interface AcmeModelRuntimeErrorBody {
  readonly code: string;
  readonly message: string;
  readonly stage: string;
  readonly retryable: boolean;
  readonly details?: unknown;
}

export interface AcmeModelRuntimeSucceededResult {
  readonly status: 'succeeded';
  readonly modelExecutionId: string;
  readonly replayed: boolean;
  readonly usage: NormalizedUsage;
  readonly diagnostic: ModelExecutionDiagnostic;
  readonly response: NormalizedModelResponse;
}

export interface AcmeModelRuntimeFailedResult {
  readonly status: 'failed' | 'cancelled' | 'conflicted';
  readonly modelExecutionId: string;
  readonly diagnostic: ModelExecutionDiagnostic;
}

export type AcmeModelRuntimeStreamEvent =
  | {
      readonly protocolVersion: typeof ACME_MODEL_RUNTIME_PROTOCOL_VERSION;
      readonly type: 'reasoning-delta';
      readonly sequence: number;
      readonly text: string;
    }
  | {
      readonly protocolVersion: typeof ACME_MODEL_RUNTIME_PROTOCOL_VERSION;
      readonly type: 'content-delta';
      readonly sequence: number;
      readonly text: string;
    }
  | {
      readonly protocolVersion: typeof ACME_MODEL_RUNTIME_PROTOCOL_VERSION;
      readonly type: 'tool-call-delta';
      readonly sequence: number;
      readonly index: number;
      readonly toolCallId?: string;
      readonly name?: string;
      readonly argumentsDelta?: string;
    }
  | {
      readonly protocolVersion: typeof ACME_MODEL_RUNTIME_PROTOCOL_VERSION;
      readonly type: 'completed';
      readonly sequence: number;
      readonly response: NormalizedModelResponse;
      readonly result: AcmeModelRuntimeSucceededResult;
    }
  | {
      readonly protocolVersion: typeof ACME_MODEL_RUNTIME_PROTOCOL_VERSION;
      readonly type: 'failed';
      readonly sequence: number;
      readonly error: AcmeModelRuntimeErrorBody | AcmeErrorData;
      readonly result: AcmeModelRuntimeFailedResult;
    };

export interface AcmeModelRuntimeErrorEnvelope {
  readonly protocolVersion: typeof ACME_MODEL_RUNTIME_ERROR_VERSION;
  readonly code: string;
  readonly message: string;
}
