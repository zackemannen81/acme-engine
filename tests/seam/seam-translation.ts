/**
 * A real, executable translation between `aal-acme-adapter/2` and today's
 * ACME engine types.
 *
 * Two rules govern the whole file:
 *
 * 1. Nothing is invented. Where the seam cannot supply what the engine needs,
 *    the caller must pass it explicitly as a supplement. Where the seam cannot
 *    carry what the engine has, the caller must acknowledge the loss by code.
 * 2. Every refusal is a named error from `seam-gaps.ts`, so the set of things
 *    this seam cannot do is a test suite rather than a document.
 */
import type {
  ExecutionPolicy,
  ExecutionRequest,
  ExecutionResult,
  JsonValue,
  ModelSelection,
} from '../../packages/core/src/index.js';

import {
  ACME_ADAPTER_CONTRACT_VERSION,
  type AcmeAdapterRequest,
  type AcmeAdapterResult,
} from './aal-acme-adapter-2.js';
import {
  SEAM_APPLICATION_VERSION_UNROUTABLE,
  SEAM_CONTRACT_REF_UNENFORCEABLE,
  SEAM_CONTRACT_VERSION_UNSUPPORTED,
  SEAM_CORRELATION_ID_UNROUTABLE,
  SEAM_DOCUMENT_KEYS_DROPPED,
  SEAM_ENTITY_ID_AMBIGUOUS,
  SEAM_ENTITY_TYPE_UNROUTABLE,
  SEAM_ERROR_CAUSE_REF_DROPPED,
  SEAM_ERROR_DETAILS_DROPPED,
  SEAM_ERROR_STAGE_DROPPED,
  SEAM_EVENT_IDS_DROPPED,
  SEAM_EXECUTION_POLICY_ABSENT,
  SEAM_EXPECTED_REVISION_ABSENT,
  SEAM_MODEL_SELECTION_ABSENT,
  SEAM_SOURCE_ARTIFACT_IDS_UNROUTABLE,
  SEAM_SUGGESTION_SET_UNPRODUCED,
  SEAM_TASK_PINS_UNENFORCEABLE,
  SEAM_WORKSPACE_ID_UNROUTABLE,
  SeamApplicationVersionUnroutableError,
  SeamContractRefUnenforceableError,
  SeamContractVersionUnsupportedError,
  SeamCorrelationIdUnroutableError,
  SeamDocumentKeysDroppedError,
  SeamEntityIdAmbiguousError,
  SeamEntityTypeUnroutableError,
  SeamErrorCauseRefDroppedError,
  SeamErrorDetailsDroppedError,
  SeamErrorStageDroppedError,
  SeamEventIdsDroppedError,
  SeamExecutionPolicyAbsentError,
  SeamExpectedRevisionAbsentError,
  SeamJobHandleUnsupportedError,
  SeamModelSelectionAbsentError,
  SeamPrincipalUnsupportedError,
  SeamReplayReferenceUnsupportedError,
  SeamSourceArtifactIdsUnroutableError,
  SeamSuggestionSetUnproducedError,
  SeamTaskPinsUnenforceableError,
  SeamWorkspaceIdUnroutableError,
  type SeamGap,
  type SeamGapCode,
  type SeamTranslationError,
} from './seam-gaps.js';

/**
 * Values the engine needs that `aal-acme-adapter/2` has no field for. Every
 * member of this interface is evidence of a gap: a complete seam would need
 * none of it.
 */
export interface SeamRequestSupplements {
  readonly model?: ModelSelection;
  readonly policy?: Partial<ExecutionPolicy>;
  /** Only consulted when `engineTarget.expectedEngineRevision` is absent. */
  readonly expectedRevision?: number;
}

interface DetectedGap {
  readonly gap: SeamGap;
  readonly detail: JsonValue;
  raise(): never;
}

function detected(
  gap: SeamGap,
  detail: JsonValue,
  make: (detail: JsonValue) => SeamTranslationError,
): DetectedGap {
  return {
    gap,
    detail,
    raise(): never {
      throw make(detail);
    },
  };
}

function detectRequestGaps(
  request: AcmeAdapterRequest,
  supplements: SeamRequestSupplements,
): readonly DetectedGap[] {
  const gaps: DetectedGap[] = [];

  if (request.contractVersion !== ACME_ADAPTER_CONTRACT_VERSION) {
    gaps.push(
      detected(
        SEAM_CONTRACT_VERSION_UNSUPPORTED,
        {
          observed: request.contractVersion as unknown as JsonValue,
          supported: ACME_ADAPTER_CONTRACT_VERSION,
        },
        (detail) => new SeamContractVersionUnsupportedError(detail),
      ),
    );
  }

  if (request.subject.entityId !== request.engineTarget.entityId) {
    gaps.push(
      detected(
        SEAM_ENTITY_ID_AMBIGUOUS,
        {
          subjectEntityId: request.subject.entityId,
          engineTargetEntityId: request.engineTarget.entityId,
        },
        (detail) => new SeamEntityIdAmbiguousError(detail),
      ),
    );
  }

  gaps.push(
    detected(
      SEAM_WORKSPACE_ID_UNROUTABLE,
      { workspaceId: request.workspaceId, requestKey: request.requestKey },
      (detail) => new SeamWorkspaceIdUnroutableError(detail),
    ),
    detected(
      SEAM_CORRELATION_ID_UNROUTABLE,
      { correlationId: request.correlationId },
      (detail) => new SeamCorrelationIdUnroutableError(detail),
    ),
    detected(
      SEAM_ENTITY_TYPE_UNROUTABLE,
      { entityType: request.subject.entityType },
      (detail) => new SeamEntityTypeUnroutableError(detail),
    ),
    detected(
      SEAM_APPLICATION_VERSION_UNROUTABLE,
      {
        expectedApplicationVersion: request.subject.expectedApplicationVersion,
      },
      (detail) => new SeamApplicationVersionUnroutableError(detail),
    ),
    detected(
      SEAM_CONTRACT_REF_UNENFORCEABLE,
      { contractRef: request.engineTarget.contractRef },
      (detail) => new SeamContractRefUnenforceableError(detail),
    ),
    detected(
      SEAM_TASK_PINS_UNENFORCEABLE,
      {
        id: request.task.id,
        version: request.task.version,
        inputSchemaSha256: request.task.inputSchemaSha256,
        outputSchemaSha256: request.task.outputSchemaSha256,
      },
      (detail) => new SeamTaskPinsUnenforceableError(detail),
    ),
  );

  if (request.sourceArtifactIds.length > 0) {
    gaps.push(
      detected(
        SEAM_SOURCE_ARTIFACT_IDS_UNROUTABLE,
        { sourceArtifactIds: [...request.sourceArtifactIds] },
        (detail) => new SeamSourceArtifactIdsUnroutableError(detail),
      ),
    );
  }

  if (supplements.model === undefined) {
    gaps.push(
      detected(
        SEAM_MODEL_SELECTION_ABSENT,
        { requestKey: request.requestKey },
        (detail) => new SeamModelSelectionAbsentError(detail),
      ),
    );
  }

  if (
    request.engineTarget.expectedEngineRevision === undefined &&
    supplements.expectedRevision === undefined
  ) {
    gaps.push(
      detected(
        SEAM_EXPECTED_REVISION_ABSENT,
        {
          expectedApplicationVersion:
            request.subject.expectedApplicationVersion,
        },
        (detail) => new SeamExpectedRevisionAbsentError(detail),
      ),
    );
  }

  if (supplements.policy === undefined) {
    gaps.push(
      detected(
        SEAM_EXECUTION_POLICY_ABSENT,
        { engineDefaultRetention: 'hash-only' },
        (detail) => new SeamExecutionPolicyAbsentError(detail),
      ),
    );
  }

  return Object.freeze(gaps);
}

/**
 * Every gap this particular request runs into, without translating it. The
 * order is stable and matches the order `toExecutionRequest` refuses in.
 */
export function inventoryRequestGaps(
  request: AcmeAdapterRequest,
  supplements: SeamRequestSupplements = {},
): readonly SeamGap[] {
  return Object.freeze(
    detectRequestGaps(request, supplements).map((entry) => entry.gap),
  );
}

/**
 * Translate a seam request into an engine request, or refuse.
 *
 * `acknowledged` is the caller's explicit list of losses it accepts. A gap
 * whose `acknowledgeable` is false can never appear there: it is satisfied by
 * a supplement or not at all.
 */
export function toExecutionRequest(
  request: AcmeAdapterRequest,
  supplements: SeamRequestSupplements = {},
  acknowledged: readonly SeamGapCode[] = [],
): ExecutionRequest {
  for (const entry of detectRequestGaps(request, supplements)) {
    if (!entry.gap.acknowledgeable || !acknowledged.includes(entry.gap.code)) {
      entry.raise();
    }
  }

  const model = supplements.model;
  if (model === undefined) {
    throw new SeamModelSelectionAbsentError({ requestKey: request.requestKey });
  }
  const expectedRevision =
    request.engineTarget.expectedEngineRevision ?? supplements.expectedRevision;
  if (expectedRevision === undefined) {
    throw new SeamExpectedRevisionAbsentError({
      requestKey: request.requestKey,
    });
  }

  return Object.freeze({
    requestKey: request.requestKey,
    namespace: request.engineTarget.namespace,
    task: request.engineTarget.task,
    // Both seam entity ids were proven equal above, so either is correct.
    entityId: request.engineTarget.entityId,
    expectedRevision,
    input: request.input as JsonValue,
    model,
    ...(supplements.policy === undefined ? {} : { policy: supplements.policy }),
  } satisfies ExecutionRequest);
}

function detectResultGaps(result: ExecutionResult): readonly DetectedGap[] {
  const gaps: DetectedGap[] = [];

  if (result.status === 'committed') {
    if (result.documentKeys.length > 0) {
      gaps.push(
        detected(
          SEAM_DOCUMENT_KEYS_DROPPED,
          { documentKeys: [...result.documentKeys] },
          (detail) => new SeamDocumentKeysDroppedError(detail),
        ),
      );
    }
    if (result.eventIds.length > 0) {
      gaps.push(
        detected(
          SEAM_EVENT_IDS_DROPPED,
          { eventIds: [...result.eventIds] },
          (detail) => new SeamEventIdsDroppedError(detail),
        ),
      );
    }
    gaps.push(
      detected(
        SEAM_SUGGESTION_SET_UNPRODUCED,
        { executionId: result.executionId },
        (detail) => new SeamSuggestionSetUnproducedError(detail),
      ),
    );
    return Object.freeze(gaps);
  }

  gaps.push(
    detected(
      SEAM_ERROR_STAGE_DROPPED,
      { stage: result.error.stage, code: result.error.code },
      (detail) => new SeamErrorStageDroppedError(detail),
    ),
  );
  if (result.error.details !== undefined) {
    gaps.push(
      detected(
        SEAM_ERROR_DETAILS_DROPPED,
        { details: result.error.details },
        (detail) => new SeamErrorDetailsDroppedError(detail),
      ),
    );
  }
  if (result.error.causeRef !== undefined) {
    gaps.push(
      detected(
        SEAM_ERROR_CAUSE_REF_DROPPED,
        { causeRef: result.error.causeRef },
        (detail) => new SeamErrorCauseRefDroppedError(detail),
      ),
    );
  }
  return Object.freeze(gaps);
}

/** Every gap this particular engine result runs into, without translating it. */
export function inventoryResultGaps(
  result: ExecutionResult,
): readonly SeamGap[] {
  return Object.freeze(detectResultGaps(result).map((entry) => entry.gap));
}

/**
 * Translate an engine result into a seam result, or refuse. `suggestionSetRef`
 * is always null: the engine produces no suggestions, and the seam requires
 * the key, so null is the only value that is not a fabrication.
 */
export function toAcmeAdapterResult(
  result: ExecutionResult,
  acknowledged: readonly SeamGapCode[] = [],
): AcmeAdapterResult {
  for (const entry of detectResultGaps(result)) {
    if (!entry.gap.acknowledgeable || !acknowledged.includes(entry.gap.code)) {
      entry.raise();
    }
  }

  if (result.status === 'committed') {
    return Object.freeze({
      contractVersion: ACME_ADAPTER_CONTRACT_VERSION,
      status: 'committed',
      executionId: result.executionId,
      replayed: result.replayed,
      engineRevision: result.revision,
      suggestionSetRef: null,
    } satisfies AcmeAdapterResult);
  }

  return Object.freeze({
    contractVersion: ACME_ADAPTER_CONTRACT_VERSION,
    status: result.status,
    executionId: result.executionId,
    error: Object.freeze({
      code: result.error.code,
      message: result.error.message,
      retryable: result.error.retryable,
    }),
  } satisfies AcmeAdapterResult);
}

/**
 * The seam's `unavailable` status has no engine origin. No `ExecutionResult`
 * maps to it: it describes the adapter refusing before the engine is reached.
 * It is constructed here so tests can state that boundary rather than imply it.
 */
export function unavailableResult(
  reason: 'not-connected' | 'task-unsupported' | 'source-payload-unavailable',
): AcmeAdapterResult {
  return Object.freeze({
    contractVersion: ACME_ADAPTER_CONTRACT_VERSION,
    status: 'unavailable',
    reason,
  } satisfies AcmeAdapterResult);
}

export type SeamCapability = 'principal' | 'replay-reference' | 'job-handle';

/**
 * Capabilities the engine has (or would need) that `aal-acme-adapter/2` has no
 * shape for at all. This always throws; that is the finding.
 */
export function assertSeamCapability(capability: SeamCapability): never {
  if (capability === 'principal') {
    throw new SeamPrincipalUnsupportedError({ capability });
  }
  if (capability === 'replay-reference') {
    throw new SeamReplayReferenceUnsupportedError({ capability });
  }
  throw new SeamJobHandleUnsupportedError({ capability });
}
