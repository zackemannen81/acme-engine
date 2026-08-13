/**
 * The executable inventory of what `aal-acme-adapter/2` cannot carry to or
 * from today's ACME engine.
 *
 * Every entry is a fact about the two type definitions, not an opinion. Each
 * one has a named error class, a row in `SEAM_GAP_INVENTORY`, and a test.
 * `seam-translation.ts` refuses to translate across an unsatisfied gap, so no
 * default is ever invented on the caller's behalf.
 */
import type { JsonValue } from '../../packages/core/src/index.js';

export type SeamGapCode =
  // The engine requires a value the seam has no field for. Only an
  // out-of-band supplement can satisfy these; acknowledgement cannot.
  | 'SEAM_MODEL_SELECTION_ABSENT'
  | 'SEAM_EXPECTED_REVISION_ABSENT'
  // The engine has a documented default the seam cannot express.
  | 'SEAM_EXECUTION_POLICY_ABSENT'
  // The seam carries a value the engine has no field for.
  | 'SEAM_WORKSPACE_ID_UNROUTABLE'
  | 'SEAM_CORRELATION_ID_UNROUTABLE'
  | 'SEAM_ENTITY_TYPE_UNROUTABLE'
  | 'SEAM_APPLICATION_VERSION_UNROUTABLE'
  | 'SEAM_CONTRACT_REF_UNENFORCEABLE'
  | 'SEAM_TASK_PINS_UNENFORCEABLE'
  | 'SEAM_SOURCE_ARTIFACT_IDS_UNROUTABLE'
  // The seam and the engine disagree outright.
  | 'SEAM_CONTRACT_VERSION_UNSUPPORTED'
  | 'SEAM_ENTITY_ID_AMBIGUOUS'
  // The engine returns a value the seam has no field for.
  | 'SEAM_DOCUMENT_KEYS_DROPPED'
  | 'SEAM_EVENT_IDS_DROPPED'
  | 'SEAM_ERROR_STAGE_DROPPED'
  | 'SEAM_ERROR_DETAILS_DROPPED'
  | 'SEAM_ERROR_CAUSE_REF_DROPPED'
  // The seam requires a value the engine never produces.
  | 'SEAM_SUGGESTION_SET_UNPRODUCED'
  // Neither side has the concept at all.
  | 'SEAM_PRINCIPAL_ABSENT_ON_BOTH_SIDES'
  | 'SEAM_REPLAY_REFERENCE_UNSUPPORTED'
  | 'SEAM_JOB_HANDLE_UNSUPPORTED';

export type SeamGapKind =
  | 'engine-requires-seam-absent'
  | 'engine-defaults-seam-cannot-express'
  | 'seam-carries-engine-drops'
  | 'seam-contradicts-engine'
  | 'engine-returns-seam-drops'
  | 'seam-requires-engine-never-produces'
  | 'absent-on-both-sides';

export type SeamDirection = 'request' | 'result' | 'both';

export interface SeamGap<TCode extends SeamGapCode = SeamGapCode> {
  readonly code: TCode;
  readonly kind: SeamGapKind;
  readonly direction: SeamDirection;
  /** Dotted path in `aal-acme-adapter/2`, or `null` when the seam has none. */
  readonly seamPath: string | null;
  /** Dotted path in the engine types, or `null` when the engine has none. */
  readonly enginePath: string | null;
  /**
   * Whether a caller may accept the gap and continue. Acknowledgement is a
   * decision to lose information; it can never conjure a value the engine
   * requires, so `engine-requires-seam-absent`, `seam-contradicts-engine` and
   * `absent-on-both-sides` gaps are always false.
   */
  readonly acknowledgeable: boolean;
  readonly summary: string;
  readonly consequence: string;
}

function gap<TCode extends SeamGapCode>(entry: SeamGap<TCode>): SeamGap<TCode> {
  return Object.freeze(entry);
}

export abstract class SeamTranslationError<
  TCode extends SeamGapCode = SeamGapCode,
> extends Error {
  readonly gap: SeamGap<TCode>;
  readonly detail: JsonValue;

  protected constructor(entry: SeamGap<TCode>, detail: JsonValue) {
    super(`${entry.code}: ${entry.summary} ${entry.consequence}`);
    this.name = new.target.name;
    this.gap = entry;
    this.detail = detail;
  }
}

/* -------------------------------------------------------------------------
 * Request direction: the engine requires what the seam does not carry.
 * ---------------------------------------------------------------------- */

export const SEAM_MODEL_SELECTION_ABSENT = gap({
  code: 'SEAM_MODEL_SELECTION_ABSENT',
  kind: 'engine-requires-seam-absent',
  direction: 'request',
  seamPath: null,
  enginePath: 'ExecutionRequest.model',
  acknowledgeable: false,
  summary: 'aal-acme-adapter/2 has no model selection field.',
  consequence:
    'ExecutionRequest.model is required and participates in the request ' +
    'fingerprint, so the model must be chosen out of band and two choices ' +
    'under one seam requestKey collide on one execution identity.',
});

export class SeamModelSelectionAbsentError extends SeamTranslationError<'SEAM_MODEL_SELECTION_ABSENT'> {
  constructor(detail: JsonValue) {
    super(SEAM_MODEL_SELECTION_ABSENT, detail);
  }
}

export const SEAM_EXPECTED_REVISION_ABSENT = gap({
  code: 'SEAM_EXPECTED_REVISION_ABSENT',
  kind: 'engine-requires-seam-absent',
  direction: 'request',
  seamPath: 'engineTarget.expectedEngineRevision',
  enginePath: 'ExecutionRequest.expectedRevision',
  acknowledgeable: false,
  summary:
    'expectedEngineRevision is optional in the seam and required by the engine.',
  consequence:
    'The engine rejects a request without a non-negative expectedRevision, ' +
    'and subject.expectedApplicationVersion is explicitly not a substitute.',
});

export class SeamExpectedRevisionAbsentError extends SeamTranslationError<'SEAM_EXPECTED_REVISION_ABSENT'> {
  constructor(detail: JsonValue) {
    super(SEAM_EXPECTED_REVISION_ABSENT, detail);
  }
}

export const SEAM_EXECUTION_POLICY_ABSENT = gap({
  code: 'SEAM_EXECUTION_POLICY_ABSENT',
  kind: 'engine-defaults-seam-cannot-express',
  direction: 'request',
  seamPath: null,
  enginePath: 'ExecutionRequest.policy',
  acknowledgeable: true,
  summary: 'aal-acme-adapter/2 has no policy or retention field.',
  consequence:
    'Omitting policy silently accepts DEFAULT_EXECUTION_POLICY, whose ' +
    "retention is 'hash-only'; the application cannot ask for 'none' or " +
    "'encrypted-payload', nor set any budget, through the seam.",
});

export class SeamExecutionPolicyAbsentError extends SeamTranslationError<'SEAM_EXECUTION_POLICY_ABSENT'> {
  constructor(detail: JsonValue) {
    super(SEAM_EXECUTION_POLICY_ABSENT, detail);
  }
}

/* -------------------------------------------------------------------------
 * Request direction: the seam carries what the engine drops.
 * ---------------------------------------------------------------------- */

export const SEAM_WORKSPACE_ID_UNROUTABLE = gap({
  code: 'SEAM_WORKSPACE_ID_UNROUTABLE',
  kind: 'seam-carries-engine-drops',
  direction: 'request',
  seamPath: 'workspaceId',
  enginePath: null,
  acknowledgeable: true,
  summary: 'ExecutionRequest has no tenant or workspace field.',
  consequence:
    'deriveExecutionId hashes only (namespace, requestKey), so two ' +
    'workspaces issuing the same requestKey share one execution identity ' +
    "and the second caller is served the first workspace's committed result.",
});

export class SeamWorkspaceIdUnroutableError extends SeamTranslationError<'SEAM_WORKSPACE_ID_UNROUTABLE'> {
  constructor(detail: JsonValue) {
    super(SEAM_WORKSPACE_ID_UNROUTABLE, detail);
  }
}

export const SEAM_CORRELATION_ID_UNROUTABLE = gap({
  code: 'SEAM_CORRELATION_ID_UNROUTABLE',
  kind: 'seam-carries-engine-drops',
  direction: 'request',
  seamPath: 'correlationId',
  enginePath: null,
  acknowledgeable: true,
  summary: 'ExecutionRequest has no correlation field.',
  consequence:
    'Engine evidence cannot be joined back to the application request that ' +
    'caused it except through requestKey, which is also the idempotency key.',
});

export class SeamCorrelationIdUnroutableError extends SeamTranslationError<'SEAM_CORRELATION_ID_UNROUTABLE'> {
  constructor(detail: JsonValue) {
    super(SEAM_CORRELATION_ID_UNROUTABLE, detail);
  }
}

export const SEAM_ENTITY_TYPE_UNROUTABLE = gap({
  code: 'SEAM_ENTITY_TYPE_UNROUTABLE',
  kind: 'seam-carries-engine-drops',
  direction: 'request',
  seamPath: 'subject.entityType',
  enginePath: null,
  acknowledgeable: true,
  summary: 'The engine addresses an entity by id inside a namespace only.',
  consequence:
    'Two application entity types sharing an id string address the same ' +
    'engine entity, and the engine cannot report which type it acted on.',
});

export class SeamEntityTypeUnroutableError extends SeamTranslationError<'SEAM_ENTITY_TYPE_UNROUTABLE'> {
  constructor(detail: JsonValue) {
    super(SEAM_ENTITY_TYPE_UNROUTABLE, detail);
  }
}

export const SEAM_APPLICATION_VERSION_UNROUTABLE = gap({
  code: 'SEAM_APPLICATION_VERSION_UNROUTABLE',
  kind: 'seam-carries-engine-drops',
  direction: 'request',
  seamPath: 'subject.expectedApplicationVersion',
  enginePath: null,
  acknowledgeable: true,
  summary:
    'The application optimistic version has no engine field and, by the ' +
    "seam's own comment, must not become expectedRevision.",
  consequence:
    'The engine cannot enforce the application concurrency check, so a ' +
    'committed engine result may be applied to a subject that moved on.',
});

export class SeamApplicationVersionUnroutableError extends SeamTranslationError<'SEAM_APPLICATION_VERSION_UNROUTABLE'> {
  constructor(detail: JsonValue) {
    super(SEAM_APPLICATION_VERSION_UNROUTABLE, detail);
  }
}

export const SEAM_CONTRACT_REF_UNENFORCEABLE = gap({
  code: 'SEAM_CONTRACT_REF_UNENFORCEABLE',
  kind: 'seam-carries-engine-drops',
  direction: 'request',
  seamPath: 'engineTarget.contractRef',
  enginePath: null,
  acknowledgeable: true,
  summary: 'ExecutionRequest cannot pin a prompt contract.',
  consequence:
    'The engine resolves the contract from the task definition in its own ' +
    'registry, so the pin is unverifiable at the boundary and a registry ' +
    'change silently retargets the application without a request error.',
});

export class SeamContractRefUnenforceableError extends SeamTranslationError<'SEAM_CONTRACT_REF_UNENFORCEABLE'> {
  constructor(detail: JsonValue) {
    super(SEAM_CONTRACT_REF_UNENFORCEABLE, detail);
  }
}

export const SEAM_TASK_PINS_UNENFORCEABLE = gap({
  code: 'SEAM_TASK_PINS_UNENFORCEABLE',
  kind: 'seam-carries-engine-drops',
  direction: 'request',
  seamPath: 'task',
  enginePath: null,
  acknowledgeable: true,
  summary:
    'task.id, task.version, inputSchemaSha256 and outputSchemaSha256 have ' +
    'no engine request field.',
  consequence:
    'The seam cannot make the engine reject a task whose schemas no longer ' +
    'hash to the values the application verified.',
});

export class SeamTaskPinsUnenforceableError extends SeamTranslationError<'SEAM_TASK_PINS_UNENFORCEABLE'> {
  constructor(detail: JsonValue) {
    super(SEAM_TASK_PINS_UNENFORCEABLE, detail);
  }
}

export const SEAM_SOURCE_ARTIFACT_IDS_UNROUTABLE = gap({
  code: 'SEAM_SOURCE_ARTIFACT_IDS_UNROUTABLE',
  kind: 'seam-carries-engine-drops',
  direction: 'request',
  seamPath: 'sourceArtifactIds',
  enginePath: null,
  acknowledgeable: true,
  summary: 'ExecutionRequest has no source artifact field.',
  consequence:
    'Source binding survives only if the caller folds the ids into `input`, ' +
    'where they become opaque task payload rather than a checked reference.',
});

export class SeamSourceArtifactIdsUnroutableError extends SeamTranslationError<'SEAM_SOURCE_ARTIFACT_IDS_UNROUTABLE'> {
  constructor(detail: JsonValue) {
    super(SEAM_SOURCE_ARTIFACT_IDS_UNROUTABLE, detail);
  }
}

/* -------------------------------------------------------------------------
 * Request direction: the seam contradicts the engine.
 * ---------------------------------------------------------------------- */

export const SEAM_CONTRACT_VERSION_UNSUPPORTED = gap({
  code: 'SEAM_CONTRACT_VERSION_UNSUPPORTED',
  kind: 'seam-contradicts-engine',
  direction: 'both',
  seamPath: 'contractVersion',
  enginePath: null,
  acknowledgeable: false,
  summary: 'Only aal-acme-adapter/2 is translated.',
  consequence:
    'A different seam version has an unknown field set, so translating it ' +
    'would mean guessing which fields still mean what they used to.',
});

export class SeamContractVersionUnsupportedError extends SeamTranslationError<'SEAM_CONTRACT_VERSION_UNSUPPORTED'> {
  constructor(detail: JsonValue) {
    super(SEAM_CONTRACT_VERSION_UNSUPPORTED, detail);
  }
}

export const SEAM_ENTITY_ID_AMBIGUOUS = gap({
  code: 'SEAM_ENTITY_ID_AMBIGUOUS',
  kind: 'seam-contradicts-engine',
  direction: 'request',
  seamPath: 'subject.entityId | engineTarget.entityId',
  enginePath: 'ExecutionRequest.entityId',
  acknowledgeable: false,
  summary: 'The seam carries two entity ids and the engine accepts one.',
  consequence:
    'When they differ there is no rule in either type that says which one ' +
    'the engine should act on, so picking one would be an invention.',
});

export class SeamEntityIdAmbiguousError extends SeamTranslationError<'SEAM_ENTITY_ID_AMBIGUOUS'> {
  constructor(detail: JsonValue) {
    super(SEAM_ENTITY_ID_AMBIGUOUS, detail);
  }
}

/* -------------------------------------------------------------------------
 * Result direction: the engine returns what the seam drops.
 * ---------------------------------------------------------------------- */

export const SEAM_DOCUMENT_KEYS_DROPPED = gap({
  code: 'SEAM_DOCUMENT_KEYS_DROPPED',
  kind: 'engine-returns-seam-drops',
  direction: 'result',
  seamPath: null,
  enginePath: "ExecutionResult['committed'].documentKeys",
  acknowledgeable: true,
  summary: 'The committed seam result has no document field.',
  consequence:
    'The application learns that something was written but not what, so it ' +
    'cannot fetch, review or bind the documents the execution produced.',
});

export class SeamDocumentKeysDroppedError extends SeamTranslationError<'SEAM_DOCUMENT_KEYS_DROPPED'> {
  constructor(detail: JsonValue) {
    super(SEAM_DOCUMENT_KEYS_DROPPED, detail);
  }
}

export const SEAM_EVENT_IDS_DROPPED = gap({
  code: 'SEAM_EVENT_IDS_DROPPED',
  kind: 'engine-returns-seam-drops',
  direction: 'result',
  seamPath: null,
  enginePath: "ExecutionResult['committed'].eventIds",
  acknowledgeable: true,
  summary: 'The committed seam result has no event field.',
  consequence:
    'Committed events reach the outbox, but the application cannot ' +
    'correlate a delivered event with the request that produced it.',
});

export class SeamEventIdsDroppedError extends SeamTranslationError<'SEAM_EVENT_IDS_DROPPED'> {
  constructor(detail: JsonValue) {
    super(SEAM_EVENT_IDS_DROPPED, detail);
  }
}

export const SEAM_ERROR_STAGE_DROPPED = gap({
  code: 'SEAM_ERROR_STAGE_DROPPED',
  kind: 'engine-returns-seam-drops',
  direction: 'result',
  seamPath: null,
  enginePath: 'AcmeErrorData.stage',
  acknowledgeable: true,
  summary: 'The seam error object is {code, message, retryable} only.',
  consequence:
    'The engine always sets stage, so every non-committed result loses the ' +
    'one field that says how far the execution got before it stopped.',
});

export class SeamErrorStageDroppedError extends SeamTranslationError<'SEAM_ERROR_STAGE_DROPPED'> {
  constructor(detail: JsonValue) {
    super(SEAM_ERROR_STAGE_DROPPED, detail);
  }
}

export const SEAM_ERROR_DETAILS_DROPPED = gap({
  code: 'SEAM_ERROR_DETAILS_DROPPED',
  kind: 'engine-returns-seam-drops',
  direction: 'result',
  seamPath: null,
  enginePath: 'AcmeErrorData.details',
  acknowledgeable: true,
  summary: 'The seam error object has no details field.',
  consequence:
    'Schema issue lists, conflicting request keys and budget numbers are ' +
    'discarded, leaving a human-readable message as the only diagnosis.',
});

export class SeamErrorDetailsDroppedError extends SeamTranslationError<'SEAM_ERROR_DETAILS_DROPPED'> {
  constructor(detail: JsonValue) {
    super(SEAM_ERROR_DETAILS_DROPPED, detail);
  }
}

export const SEAM_ERROR_CAUSE_REF_DROPPED = gap({
  code: 'SEAM_ERROR_CAUSE_REF_DROPPED',
  kind: 'engine-returns-seam-drops',
  direction: 'result',
  seamPath: null,
  enginePath: 'AcmeErrorData.causeRef',
  acknowledgeable: true,
  summary: 'The seam error object has no causeRef field.',
  consequence:
    'The pointer from a seam-visible failure to the underlying engine ' +
    'evidence is lost, so support cannot walk from a ticket to a cause.',
});

export class SeamErrorCauseRefDroppedError extends SeamTranslationError<'SEAM_ERROR_CAUSE_REF_DROPPED'> {
  constructor(detail: JsonValue) {
    super(SEAM_ERROR_CAUSE_REF_DROPPED, detail);
  }
}

/* -------------------------------------------------------------------------
 * Result direction: the seam requires what the engine never produces.
 * ---------------------------------------------------------------------- */

export const SEAM_SUGGESTION_SET_UNPRODUCED = gap({
  code: 'SEAM_SUGGESTION_SET_UNPRODUCED',
  kind: 'seam-requires-engine-never-produces',
  direction: 'result',
  seamPath: 'suggestionSetRef',
  enginePath: null,
  acknowledgeable: true,
  summary: 'The engine has no suggestion concept at any commit.',
  consequence:
    'suggestionSetRef is a required key on a committed seam result, so the ' +
    'only honest value is null; anything else would be fabricated and the ' +
    'application cannot distinguish "no suggestions" from "not implemented".',
});

export class SeamSuggestionSetUnproducedError extends SeamTranslationError<'SEAM_SUGGESTION_SET_UNPRODUCED'> {
  constructor(detail: JsonValue) {
    super(SEAM_SUGGESTION_SET_UNPRODUCED, detail);
  }
}

/* -------------------------------------------------------------------------
 * Absent on both sides.
 * ---------------------------------------------------------------------- */

export const SEAM_PRINCIPAL_ABSENT_ON_BOTH_SIDES = gap({
  code: 'SEAM_PRINCIPAL_ABSENT_ON_BOTH_SIDES',
  kind: 'absent-on-both-sides',
  direction: 'both',
  seamPath: null,
  enginePath: null,
  acknowledgeable: false,
  summary: 'Neither the seam nor ExecutionRequest carries a principal.',
  consequence:
    'A server-derived authenticated principal cannot reach the engine, so ' +
    'engine evidence can never record who caused an execution and no ' +
    'per-principal authorization is possible inside the engine.',
});

export class SeamPrincipalUnsupportedError extends SeamTranslationError<'SEAM_PRINCIPAL_ABSENT_ON_BOTH_SIDES'> {
  constructor(detail: JsonValue) {
    super(SEAM_PRINCIPAL_ABSENT_ON_BOTH_SIDES, detail);
  }
}

export const SEAM_REPLAY_REFERENCE_UNSUPPORTED = gap({
  code: 'SEAM_REPLAY_REFERENCE_UNSUPPORTED',
  kind: 'absent-on-both-sides',
  direction: 'result',
  seamPath: null,
  enginePath: 'ExecutionEngine.replayVerify -> ReplayReport',
  acknowledgeable: false,
  summary: 'AcmeAdapterResult has no field for a replay reference or report.',
  consequence:
    'The engine can verify an execution against its recorded evidence, but ' +
    'the seam offers no way to request that or to return status, digests ' +
    'or differences, so replayability is invisible to the application.',
});

export class SeamReplayReferenceUnsupportedError extends SeamTranslationError<'SEAM_REPLAY_REFERENCE_UNSUPPORTED'> {
  constructor(detail: JsonValue) {
    super(SEAM_REPLAY_REFERENCE_UNSUPPORTED, detail);
  }
}

export const SEAM_JOB_HANDLE_UNSUPPORTED = gap({
  code: 'SEAM_JOB_HANDLE_UNSUPPORTED',
  kind: 'absent-on-both-sides',
  direction: 'result',
  seamPath: null,
  enginePath: 'ExecuteOptions.signal',
  acknowledgeable: false,
  summary:
    'AcmeAdapterPort.execute resolves once with a terminal result and has ' +
    'no in-flight handle.',
  consequence:
    'The engine accepts an AbortSignal and the CLI runs executions through a ' +
    'JobRunner with progress and cooperative cancel, but the seam can ' +
    'neither pass a signal nor return a handle, so nothing is cancellable ' +
    'or observable from the application while it runs.',
});

export class SeamJobHandleUnsupportedError extends SeamTranslationError<'SEAM_JOB_HANDLE_UNSUPPORTED'> {
  constructor(detail: JsonValue) {
    super(SEAM_JOB_HANDLE_UNSUPPORTED, detail);
  }
}

/** Every gap, in declaration order. Tests assert this list stays complete. */
export const SEAM_GAP_INVENTORY: readonly SeamGap[] = Object.freeze([
  SEAM_MODEL_SELECTION_ABSENT,
  SEAM_EXPECTED_REVISION_ABSENT,
  SEAM_EXECUTION_POLICY_ABSENT,
  SEAM_WORKSPACE_ID_UNROUTABLE,
  SEAM_CORRELATION_ID_UNROUTABLE,
  SEAM_ENTITY_TYPE_UNROUTABLE,
  SEAM_APPLICATION_VERSION_UNROUTABLE,
  SEAM_CONTRACT_REF_UNENFORCEABLE,
  SEAM_TASK_PINS_UNENFORCEABLE,
  SEAM_SOURCE_ARTIFACT_IDS_UNROUTABLE,
  SEAM_CONTRACT_VERSION_UNSUPPORTED,
  SEAM_ENTITY_ID_AMBIGUOUS,
  SEAM_DOCUMENT_KEYS_DROPPED,
  SEAM_EVENT_IDS_DROPPED,
  SEAM_ERROR_STAGE_DROPPED,
  SEAM_ERROR_DETAILS_DROPPED,
  SEAM_ERROR_CAUSE_REF_DROPPED,
  SEAM_SUGGESTION_SET_UNPRODUCED,
  SEAM_PRINCIPAL_ABSENT_ON_BOTH_SIDES,
  SEAM_REPLAY_REFERENCE_UNSUPPORTED,
  SEAM_JOB_HANDLE_UNSUPPORTED,
]);

/**
 * Gaps that apply to every request regardless of its contents. They are the
 * floor: no `aal-acme-adapter/2` request can be translated without losing
 * these, whatever the caller supplies.
 */
export const SEAM_REQUEST_GAP_FLOOR: readonly SeamGapCode[] = Object.freeze([
  'SEAM_WORKSPACE_ID_UNROUTABLE',
  'SEAM_CORRELATION_ID_UNROUTABLE',
  'SEAM_ENTITY_TYPE_UNROUTABLE',
  'SEAM_APPLICATION_VERSION_UNROUTABLE',
  'SEAM_CONTRACT_REF_UNENFORCEABLE',
  'SEAM_TASK_PINS_UNENFORCEABLE',
]);
