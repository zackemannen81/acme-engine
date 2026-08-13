/**
 * Vendored copy of the application-owned seam `aal-acme-adapter/2`.
 *
 * Provenance: `app/core/acme-adapter.ts` in the ACME-Arbetsyta application
 * clone. Copied verbatim except for formatting (repository Prettier profile)
 * and this header. Nothing here may import an engine package: the point of the
 * fixture is that the seam is defined without reference to ACME, so the
 * translation in `seam-translation.ts` is the only place the two vocabularies
 * meet.
 *
 * Do not "fix" this file to make a test pass. It is the counterparty's
 * contract. If a test fails against it, that is the finding.
 */
export const ACME_ADAPTER_CONTRACT_VERSION = 'aal-acme-adapter/2' as const;

export const ACME_ENGINE_REVIEW_POINT = {
  repository: 'felixnissen/acme-engine',
  commit: 'cac35fc466406bcfc50b38aca808e14f967b563c',
  runtime: 'not-connected',
  compatibility: 'not-claimed',
} as const;

export type AdapterJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly AdapterJsonValue[]
  | { readonly [key: string]: AdapterJsonValue };

export type AcmeAdapterRequest<
  TInput extends AdapterJsonValue = AdapterJsonValue,
> = {
  contractVersion: typeof ACME_ADAPTER_CONTRACT_VERSION;
  requestKey: string;
  correlationId: string;
  workspaceId: string;
  /** Application optimistic version. It is never reused as an engine revision. */
  subject: {
    entityType: string;
    entityId: string;
    expectedApplicationVersion: number;
  };
  engineTarget: {
    namespace: string;
    task: string;
    contractRef: string;
    entityId: string;
    expectedEngineRevision?: number;
  };
  task: {
    id: string;
    version: `${number}.${number}.${number}`;
    inputSchemaSha256: string;
    outputSchemaSha256: string;
  };
  sourceArtifactIds: readonly string[];
  input: TInput;
};

export type AcmeAdapterResult =
  | {
      contractVersion: typeof ACME_ADAPTER_CONTRACT_VERSION;
      status: 'unavailable';
      reason:
        'not-connected' | 'task-unsupported' | 'source-payload-unavailable';
    }
  | {
      contractVersion: typeof ACME_ADAPTER_CONTRACT_VERSION;
      status: 'committed';
      executionId: string;
      replayed: boolean;
      engineRevision: number;
      suggestionSetRef: string | null;
    }
  | {
      contractVersion: typeof ACME_ADAPTER_CONTRACT_VERSION;
      status: 'blocked' | 'conflicted' | 'cancelled' | 'failed';
      executionId?: string;
      error: { code: string; message: string; retryable: boolean };
    };

export type AcmeSuggestionEnvelope<
  TPayload extends AdapterJsonValue = AdapterJsonValue,
> = {
  contractVersion: 'aal-acme-suggestion/1';
  suggestionId: string;
  workspaceId: string;
  executionId: string;
  engineCommit: typeof ACME_ENGINE_REVIEW_POINT.commit;
  task: AcmeAdapterRequest['task'];
  sourceArtifactIds: readonly string[];
  target: {
    entityType: string;
    entityId: string;
    expectedApplicationVersion: number;
  };
  suggestionType: string;
  payload: TPayload;
  payloadSha256: string;
};

export type AcmeTaskCompatibilityClaim = {
  adapterContractVersion: typeof ACME_ADAPTER_CONTRACT_VERSION;
  engineRepository: typeof ACME_ENGINE_REVIEW_POINT.repository;
  engineCommit: typeof ACME_ENGINE_REVIEW_POINT.commit;
  taskId: string;
  taskVersion: `${number}.${number}.${number}`;
  fixtureSha256: string;
  status: 'not-claimed' | 'verified';
};

export interface AcmeAdapterPort {
  execute(request: AcmeAdapterRequest): Promise<AcmeAdapterResult>;
}
