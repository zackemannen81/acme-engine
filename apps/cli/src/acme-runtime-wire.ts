export type RuntimeJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly RuntimeJsonValue[]
  | { readonly [key: string]: RuntimeJsonValue };

export const ACME_RUNTIME_PROTOCOL_VERSION = 'acme-runtime/1' as const;
export const ACME_RUNTIME_EXECUTE_PATH = '/v1/execute' as const;
export const ACME_RUNTIME_COMPATIBILITY_PATH = '/v1/compatibility' as const;
export const ACME_RUNTIME_ERROR_VERSION = 'acme-runtime-error/1' as const;

export interface AcmeRuntimeDescriptor {
  readonly protocolVersion: typeof ACME_RUNTIME_PROTOCOL_VERSION;
  readonly engineBuild: string;
  readonly executePath: typeof ACME_RUNTIME_EXECUTE_PATH;
}

export interface AcmeRuntimeModelSelection {
  readonly profile: string;
  readonly providerHint?: string;
  readonly modelHint?: string;
}

export interface AcmeRuntimeExecutionPolicy {
  readonly timeoutMs?: number;
  readonly maxModelCalls?: number;
  readonly maxRepairCalls?: number;
  readonly maxRevisionCalls?: number;
  readonly maxInputTokens?: number;
  readonly maxOutputTokens?: number;
  readonly maxEstimatedCostMinor?: number;
  readonly retention?: 'none' | 'hash-only' | 'encrypted-payload';
}

/**
 * Canonical external representation of one ACME ExecutionRequest.
 *
 * Application identity, source-document metadata and application revisions do
 * not belong here. Callers may keep those values in their own orchestration
 * layer and correlate through their own request records.
 */
export interface AcmeRuntimeRequest<
  TInput extends RuntimeJsonValue = RuntimeJsonValue,
> {
  readonly protocolVersion: typeof ACME_RUNTIME_PROTOCOL_VERSION;
  readonly requestKey: string;
  readonly correlationId?: string;
  readonly engine: {
    readonly namespace: string;
    readonly task: string;
    readonly entityId: string;
    readonly expectedRevision: number;
    readonly model: AcmeRuntimeModelSelection;
    readonly policy?: AcmeRuntimeExecutionPolicy;
  };
  readonly input: TInput;
}

export type AcmeRuntimeResult =
  | {
      readonly protocolVersion: typeof ACME_RUNTIME_PROTOCOL_VERSION;
      readonly requestKey: string;
      readonly status: 'committed';
      readonly executionId: string;
      readonly replayed: boolean;
      readonly revision: number;
      readonly documentKeys: readonly string[];
      readonly eventIds: readonly string[];
    }
  | {
      readonly protocolVersion: typeof ACME_RUNTIME_PROTOCOL_VERSION;
      readonly requestKey: string;
      readonly status: 'blocked' | 'conflicted' | 'cancelled' | 'failed';
      readonly executionId: string;
      readonly error: {
        readonly code: string;
        readonly message: string;
        readonly stage: string;
        readonly retryable: boolean;
        readonly details?: RuntimeJsonValue;
        readonly causeRef?: string;
      };
    };

export interface AcmeRuntimeErrorEnvelope {
  readonly protocolVersion: typeof ACME_RUNTIME_ERROR_VERSION;
  readonly code: string;
  readonly message: string;
}
