/**
 * Engine-side vendored copy of the application-owned AAL runtime wire.
 *
 * Source authority for the product-facing contract remains the ACME Arbetsyta.
 * This composition-root module deliberately does not import product source: a
 * wire-version update is an explicit compatibility event, not source coupling.
 */
export type AdapterJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly AdapterJsonValue[]
  | { readonly [key: string]: AdapterJsonValue };

export const ACME_RUNTIME_PROTOCOL_VERSION = 'aal-acme-runtime/1' as const;
export const ACME_ADAPTER_V3_CONTRACT_VERSION = 'aal-acme-adapter/3' as const;
export const ACME_RUNTIME_EXECUTE_PATH = '/v1/execute' as const;
export const ACME_RUNTIME_COMPATIBILITY_PATH = '/v1/compatibility' as const;
export const ACME_RUNTIME_ERROR_VERSION = 'aal-acme-runtime-error/1' as const;

/**
 * Frozen execution-core review point after Felix's fork adopted Rickard's
 * 2026-08-16 main tree. Host wrapper commits do not redefine engine semantics.
 */
export const ACME_ENGINE_V3_REVIEW_POINT = Object.freeze({
  repository: 'felixnissen/acme-engine',
  commit: '7326d24d1a2baff71a63d249fed698343a5a7d3b',
} as const);

export const ACME_RUNTIME_DESCRIPTOR = Object.freeze({
  protocolVersion: ACME_RUNTIME_PROTOCOL_VERSION,
  adapterContractVersion: ACME_ADAPTER_V3_CONTRACT_VERSION,
  engineRepository: ACME_ENGINE_V3_REVIEW_POINT.repository,
  engineCommit: ACME_ENGINE_V3_REVIEW_POINT.commit,
  compatibility: 'unverified' as const,
  executePath: ACME_RUNTIME_EXECUTE_PATH,
});

export type AcmeRuntimeDescriptor = typeof ACME_RUNTIME_DESCRIPTOR;

export type AcmeAdapterV3ModelSelection = {
  profile: string;
  providerHint?: string;
  modelHint?: string;
};

export type AcmeAdapterV3ExecutionPolicy = {
  timeoutMs: number;
  maxModelCalls: number;
  maxRepairCalls: number;
  maxRevisionCalls: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  maxEstimatedCostMinor?: number;
  retention: 'none' | 'hash-only' | 'encrypted-payload';
};

export type AcmeAdapterV3Request<
  TInput extends AdapterJsonValue = AdapterJsonValue,
> = {
  contractVersion: typeof ACME_ADAPTER_V3_CONTRACT_VERSION;
  requestKey: string;
  correlationId: string;
  workspaceId: string;
  subject: {
    entityType: string;
    entityId: string;
    expectedApplicationVersion: number;
  };
  engineTarget: {
    repository: typeof ACME_ENGINE_V3_REVIEW_POINT.repository;
    commit: typeof ACME_ENGINE_V3_REVIEW_POINT.commit;
    namespace: string;
    entityId: string;
    expectedEngineRevision: number;
    model: AcmeAdapterV3ModelSelection;
    policy: AcmeAdapterV3ExecutionPolicy;
  };
  task: {
    id: string;
    engineTask: string;
    version: `${number}.${number}.${number}`;
    contractRef: string;
    inputSchemaSha256: string;
    outputSchemaSha256: string;
  };
  sourceArtifactIds: readonly string[];
  input: TInput;
};

export type AcmeAdapterV3ExecutionStage =
  | 'accepted'
  | 'loading'
  | 'calling-model'
  | 'validating'
  | 'interpreting'
  | 'evaluating'
  | 'preparing-commit'
  | 'committed'
  | 'blocked'
  | 'conflicted'
  | 'cancelled'
  | 'failed';

export type AcmeAdapterV3Error = {
  code: string;
  message: string;
  stage: AcmeAdapterV3ExecutionStage;
  retryable: boolean;
  details?: AdapterJsonValue;
  causeRef?: string;
};

export type AcmeAdapterV3Result =
  | {
      contractVersion: typeof ACME_ADAPTER_V3_CONTRACT_VERSION;
      requestKey: string;
      status: 'unavailable';
      reason:
        | 'not-connected'
        | 'task-unsupported'
        | 'source-payload-unavailable'
        | 'engine-pin-unavailable';
    }
  | {
      contractVersion: typeof ACME_ADAPTER_V3_CONTRACT_VERSION;
      requestKey: string;
      status: 'committed';
      executionId: string;
      replayed: boolean;
      engineRevision: number;
      documentKeys: readonly string[];
      eventIds: readonly string[];
    }
  | {
      contractVersion: typeof ACME_ADAPTER_V3_CONTRACT_VERSION;
      requestKey: string;
      status: 'blocked' | 'conflicted' | 'cancelled' | 'failed';
      executionId: string;
      error: AcmeAdapterV3Error;
    };

export type AcmeRuntimeErrorEnvelope = {
  protocolVersion: typeof ACME_RUNTIME_ERROR_VERSION;
  code: string;
  message: string;
};
