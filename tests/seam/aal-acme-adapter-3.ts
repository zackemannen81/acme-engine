/**
 * Vendored copy of the application-owned `aal-acme-adapter/3` wire contract.
 *
 * Source authority: felixnissen/ACME-Arbetsyta, AAL-0012 draft PR #1.
 * Engine review pin: f21855417b75988e5bdcfcb481e4f4729a5f5fba.
 *
 * This is intentionally a local conformance fixture, not a cross-repository
 * source dependency. If the application contract changes, this copy must be
 * re-vendored and its conformance evidence regenerated explicitly.
 */

export type AdapterJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly AdapterJsonValue[]
  | { readonly [key: string]: AdapterJsonValue };

export const ACME_ADAPTER_V3_CONTRACT_VERSION = 'aal-acme-adapter/3' as const;

export const ACME_ENGINE_V3_REVIEW_POINT = {
  repository: 'felixnissen/acme-engine',
  commit: 'f21855417b75988e5bdcfcb481e4f4729a5f5fba',
  runtime: 'not-connected',
  compatibility: 'engine-conformance-pending',
} as const;

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
