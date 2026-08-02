import type {
  AcmeErrorData,
  ExecutionAttempt,
  ExecutionPolicy,
  ExecutionRecord,
  ExecutionReplayEvidence,
  ExecutionResult,
  ExecutionStatus,
  JsonValue,
  ModelCallRecord,
} from '@acme/core';

import {
  optionalContentView,
  retainedContentView,
  type PayloadView,
  type RedactionOptions,
} from '../redaction.js';
import {
  available,
  unavailable,
  VIEW_UNAVAILABLE,
  EXECUTION_VIEW_VERSION,
  type ViewSection,
} from '../view.js';
import {
  contractRefView,
  diagnosticView,
  documentView,
  errorView,
  memoryRecordView,
  modelSelectionView,
  rankedMemoryView,
  stateSnapshotView,
  type ContractRefView,
  type DiagnosticView,
  type DocumentView,
  type ErrorView,
  type MemoryRecordView,
  type ModelSelectionView,
  type RankedMemoryView,
  type StateSnapshotView,
} from './shared.js';

/**
 * S4 — execution inspector (ADR-0019).
 *
 * The builder is pure: recorded evidence in, one versioned view out. It never
 * decides whether an execution was correct. Terminal status, digests and
 * errors are copied from what the engine and the repository recorded.
 */

/** Recorded evidence one execution inspector view is built from. */
export interface ExecutionEvidence {
  readonly execution: ExecutionRecord;
  readonly attempts: readonly ExecutionAttempt[];
  readonly modelCalls: readonly ModelCallRecord[];
  /**
   * Absent or `null` when the repository holds no replay evidence. The read
   * set, task input and prepared commit sections then render as unavailable
   * rather than as empty.
   */
  readonly replayEvidence?: ExecutionReplayEvidence | null;
}

export interface ExecutionViewOptions {
  /** Local reveal for development and test only. Never sticky. */
  readonly revealContent?: boolean;
}

/**
 * Stage order the engine advances through. Terminal non-commit statuses are
 * deliberately absent: they say that an execution stopped, not how far it got.
 */
const STAGE_ORDER: readonly ExecutionStatus[] = [
  'accepted',
  'loading',
  'calling-model',
  'validating',
  'interpreting',
  'evaluating',
  'preparing-commit',
  'committed',
];

/** Response-pipeline substages, in the order `ResponsePipeline` runs them. */
const PIPELINE_ORDER = ['input', 'empty', 'parse', 'schema', 'semantic'];

export type TrustStage =
  | 'contract-input'
  | 'normalize'
  | 'parse'
  | 'schema'
  | 'semantics'
  | 'interpret'
  | 'evaluate'
  | 'memory'
  | 'projection'
  | 'state'
  | 'commit';

/**
 * `reached` means the execution entered the stage and the recorded evidence
 * does not say more. It is deliberately weaker than `passed`.
 */
export type TrustStageOutcome = 'passed' | 'failed' | 'reached' | 'not-reached';

interface TrustStageDefinition {
  readonly stage: TrustStage;
  readonly executionStage: ExecutionStatus;
  /** Set when the stage maps onto one response-pipeline substage. */
  readonly pipelineStage?: string;
}

const TRUST_STAGES: readonly TrustStageDefinition[] = [
  {
    stage: 'contract-input',
    executionStage: 'validating',
    pipelineStage: 'input',
  },
  { stage: 'normalize', executionStage: 'validating', pipelineStage: 'empty' },
  { stage: 'parse', executionStage: 'validating', pipelineStage: 'parse' },
  { stage: 'schema', executionStage: 'validating', pipelineStage: 'schema' },
  {
    stage: 'semantics',
    executionStage: 'validating',
    pipelineStage: 'semantic',
  },
  { stage: 'interpret', executionStage: 'interpreting' },
  { stage: 'evaluate', executionStage: 'evaluating' },
  { stage: 'memory', executionStage: 'preparing-commit' },
  { stage: 'projection', executionStage: 'preparing-commit' },
  { stage: 'state', executionStage: 'preparing-commit' },
  { stage: 'commit', executionStage: 'committed' },
];

export interface PolicyView {
  readonly timeoutMs: number;
  readonly maxModelCalls: number;
  readonly maxRepairCalls: number;
  readonly maxRevisionCalls: number;
  readonly maxInputTokens: number | null;
  readonly maxOutputTokens: number | null;
  readonly maxEstimatedCostMinor: number | null;
  readonly retention: ExecutionPolicy['retention'];
}

export interface ExecutionHeaderView {
  readonly executionId: string;
  readonly requestKey: string;
  readonly namespace: string;
  readonly task: string;
  readonly entityId: string;
  readonly expectedRevision: number;
  readonly requestFingerprint: string;
  readonly inputHash: string;
  readonly contract: ContractRefView;
  readonly contractFingerprint: string;
  readonly model: ModelSelectionView;
  readonly policy: PolicyView;
  readonly status: ExecutionStatus;
  readonly currentStage: ExecutionStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** The request input, which is not the validated task input. */
  readonly requestInput: PayloadView;
}

export interface AttemptView {
  readonly attemptNumber: number;
  readonly stage: ExecutionStatus;
  readonly outcome: ExecutionAttempt['outcome'];
  readonly occurredAt: string;
  readonly retryAt: string | null;
  readonly diagnostic: DiagnosticView | null;
}

export interface ModelCallView {
  readonly modelCallId: string;
  readonly callKey: string;
  readonly attempt: number;
  readonly purpose: ModelCallRecord['purpose'];
  readonly status: ModelCallRecord['status'];
  /**
   * Copied from the recorded status. An ambiguous call is not a failure and
   * is never retried (ADR-0014).
   */
  readonly ambiguous: boolean;
  readonly selection: ModelSelectionView;
  readonly requestHash: string;
  readonly responseHash: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly requestProtected: boolean;
  readonly responseProtected: boolean;
  readonly response: PayloadView;
  readonly error: ErrorView | null;
}

export interface ReadSetView {
  readonly state: StateSnapshotView | null;
  readonly loadedMemories: readonly MemoryRecordView[];
  readonly retrievedMemories: readonly RankedMemoryView[];
  readonly documents: readonly DocumentView[];
}

export interface PreparedStateView {
  readonly fromRevision: number;
  readonly toRevision: number;
  readonly transitionId: string;
  readonly operationKey: string;
  readonly schemaVersion: string;
  readonly deltaSchemaVersion: string;
  readonly previousHash: string | null;
  readonly nextHash: string;
  readonly valueHash: string;
}

export interface PreparedCommitView {
  readonly operationDigest: string;
  readonly expectedRevision: number;
  readonly committedAt: string;
  readonly documents: readonly {
    readonly key: string;
    readonly kind: string;
    readonly schemaVersion: string;
    readonly contentHash: string;
    readonly value: PayloadView;
  }[];
  readonly memoryCandidateCount: number;
  readonly memoryDecisionCount: number;
  readonly memoryMutationCount: number;
  readonly state: ViewSection<PreparedStateView>;
  readonly evaluatorRuns: readonly {
    readonly evaluatorId: string;
    readonly evaluatorVersion: string;
    readonly attempt: number;
    readonly subjectHash: string;
    readonly decision: JsonValue;
  }[];
  readonly events: readonly {
    readonly key: string;
    readonly type: string;
    readonly schemaVersion: string;
    readonly payload: PayloadView;
  }[];
}

export interface PipelineIssueView {
  readonly code: string;
  readonly severity: string;
  readonly path: readonly (string | number)[];
  /**
   * Issue messages can come from a domain contract's semantic validation and
   * may quote model output, so they follow the content rule. Engine-authored
   * error messages on `ErrorView` do not.
   */
  readonly message: PayloadView;
}

export interface ResponseValidationView {
  readonly pipelineStage: string | null;
  readonly repairable: boolean | null;
  readonly issues: readonly PipelineIssueView[];
}

export interface TrustStageView {
  readonly stage: TrustStage;
  readonly executionStage: ExecutionStatus;
  readonly outcome: TrustStageOutcome;
}

export interface ExecutionTerminalView {
  readonly reached: boolean;
  readonly status: ExecutionStatus;
  readonly committed: boolean;
  readonly replayed: boolean | null;
  readonly revision: number | null;
  readonly documentKeys: readonly string[] | null;
  readonly eventIds: readonly string[] | null;
  readonly error: ErrorView | null;
}

export interface ExecutionView {
  readonly view: typeof EXECUTION_VIEW_VERSION;
  readonly retention: ExecutionPolicy['retention'];
  readonly header: ExecutionHeaderView;
  readonly terminal: ExecutionTerminalView;
  readonly attempts: readonly AttemptView[];
  readonly modelCalls: readonly ModelCallView[];
  readonly taskInput: ViewSection<{ readonly value: PayloadView }>;
  readonly readSet: ViewSection<ReadSetView>;
  readonly trustPipeline: readonly TrustStageView[];
  readonly responseValidation: ViewSection<ResponseValidationView>;
  readonly preparedCommit: ViewSection<PreparedCommitView>;
}

function isObject(
  value: JsonValue,
): value is { readonly [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function detailField(
  details: JsonValue | undefined,
  field: string,
): JsonValue | undefined {
  if (details === undefined || !isObject(details)) {
    return undefined;
  }
  return details[field];
}

function terminalError(execution: ExecutionRecord): AcmeErrorData | undefined {
  if (execution.error !== undefined) {
    return execution.error;
  }
  const result: ExecutionResult | undefined = execution.result;
  if (result !== undefined && result.status !== 'committed') {
    return result.error;
  }
  return undefined;
}

function stageIndex(stage: ExecutionStatus | undefined): number {
  return stage === undefined ? -1 : STAGE_ORDER.indexOf(stage);
}

function reachedIndex(
  execution: ExecutionRecord,
  attempts: readonly ExecutionAttempt[],
  error: AcmeErrorData | undefined,
): number {
  let reached = stageIndex(execution.currentStage);
  reached = Math.max(reached, stageIndex(execution.status));
  reached = Math.max(reached, stageIndex(error?.stage));
  for (const attempt of attempts) {
    reached = Math.max(reached, stageIndex(attempt.stage));
  }
  return reached;
}

function substageCount(executionStage: ExecutionStatus): number {
  return TRUST_STAGES.filter(
    (definition) => definition.executionStage === executionStage,
  ).length;
}

/**
 * Outcome of one trust substage, derived only from recorded evidence.
 *
 * When the failing execution stage owns several substages and the error does
 * not identify which one failed, every substage of that stage reports
 * `reached`. Guessing `passed` or `failed` there would be the interface
 * inventing a verdict.
 */
function trustStageOutcome(
  definition: TrustStageDefinition,
  options: {
    readonly reached: number;
    readonly failure: number;
    readonly committed: boolean;
    readonly pipelineStage: string | null;
  },
): TrustStageOutcome {
  const index = stageIndex(definition.executionStage);
  if (index > options.reached) {
    return 'not-reached';
  }
  if (options.failure >= 0) {
    if (index > options.failure) {
      return 'not-reached';
    }
    if (index === options.failure) {
      if (
        options.pipelineStage !== null &&
        definition.pipelineStage !== undefined
      ) {
        const failedAt = PIPELINE_ORDER.indexOf(options.pipelineStage);
        const own = PIPELINE_ORDER.indexOf(definition.pipelineStage);
        if (failedAt < 0 || own < 0) {
          return 'reached';
        }
        if (own === failedAt) {
          return 'failed';
        }
        return own < failedAt ? 'passed' : 'not-reached';
      }
      return substageCount(definition.executionStage) === 1
        ? 'failed'
        : 'reached';
    }
    return 'passed';
  }
  if (index < options.reached) {
    return 'passed';
  }
  return options.committed ? 'passed' : 'reached';
}

function policyView(policy: ExecutionPolicy): PolicyView {
  return {
    timeoutMs: policy.timeoutMs,
    maxModelCalls: policy.maxModelCalls,
    maxRepairCalls: policy.maxRepairCalls,
    maxRevisionCalls: policy.maxRevisionCalls,
    maxInputTokens: policy.maxInputTokens ?? null,
    maxOutputTokens: policy.maxOutputTokens ?? null,
    maxEstimatedCostMinor: policy.maxEstimatedCostMinor ?? null,
    retention: policy.retention,
  };
}

function terminalView(
  execution: ExecutionRecord,
  error: AcmeErrorData | undefined,
  options: RedactionOptions,
): ExecutionTerminalView {
  const result = execution.result;
  const committed = result !== undefined && result.status === 'committed';
  return {
    reached: result !== undefined || error !== undefined,
    status: execution.status,
    committed,
    replayed: committed ? result.replayed : null,
    revision: committed ? result.revision : null,
    documentKeys: committed ? [...result.documentKeys] : null,
    eventIds: committed ? [...result.eventIds] : null,
    error: error === undefined ? null : errorView(error, options),
  };
}

function modelCallView(
  call: ModelCallRecord,
  retention: ExecutionPolicy['retention'],
  options: RedactionOptions,
): ModelCallView {
  return {
    modelCallId: call.modelCallId,
    callKey: call.callKey,
    attempt: call.attempt,
    purpose: call.purpose,
    status: call.status,
    ambiguous: call.status === 'ambiguous',
    selection: modelSelectionView(call.selection),
    requestHash: call.requestHash,
    responseHash: call.responseHash ?? null,
    startedAt: call.startedAt,
    completedAt: call.completedAt ?? null,
    requestProtected: call.protectedRequest !== undefined,
    responseProtected: call.protectedResponse !== undefined,
    response: retainedContentView(
      call.response === undefined
        ? undefined
        : (call.response as unknown as JsonValue),
      retention,
      options,
    ),
    error: call.error === undefined ? null : errorView(call.error, options),
  };
}

function readSetView(
  evidence: ExecutionReplayEvidence,
  options: RedactionOptions,
): ReadSetView {
  return {
    state:
      evidence.readSet.state === null
        ? null
        : stateSnapshotView(evidence.readSet.state, options),
    loadedMemories: evidence.readSet.loadedMemories.map((record) =>
      memoryRecordView(record, options),
    ),
    retrievedMemories: evidence.readSet.retrievedMemories.map((ranked) =>
      rankedMemoryView(ranked, options),
    ),
    documents: evidence.readSet.documents.map((document) =>
      documentView(document, options),
    ),
  };
}

function preparedCommitView(
  evidence: ExecutionReplayEvidence,
  options: RedactionOptions,
): PreparedCommitView {
  const prepared = evidence.preparedCommit;
  return {
    operationDigest: prepared.operationDigest,
    expectedRevision: prepared.expectedRevision,
    committedAt: prepared.committedAt,
    documents: prepared.documents.map((document) => ({
      key: document.key,
      kind: document.kind,
      schemaVersion: document.schemaVersion,
      contentHash: document.contentHash,
      value: optionalContentView(
        document.value,
        VIEW_UNAVAILABLE.payloadUnreadable,
        options,
      ),
    })),
    memoryCandidateCount: prepared.memoryCandidates.length,
    memoryDecisionCount: prepared.memory.decisions.length,
    memoryMutationCount: prepared.memory.mutations.length,
    state:
      prepared.state === null
        ? unavailable(VIEW_UNAVAILABLE.preparedState)
        : available<PreparedStateView>({
            fromRevision: prepared.state.transition.fromRevision,
            toRevision: prepared.state.transition.toRevision,
            transitionId: prepared.state.transition.transitionId,
            operationKey: prepared.state.transition.operationKey,
            schemaVersion: prepared.state.snapshot.schemaVersion,
            deltaSchemaVersion: prepared.state.transition.deltaSchemaVersion,
            previousHash: prepared.state.transition.previousHash,
            nextHash: prepared.state.transition.nextHash,
            valueHash: prepared.state.snapshot.valueHash,
          }),
    evaluatorRuns: prepared.evaluatorRuns.map((run) => ({
      evaluatorId: run.evaluatorId,
      evaluatorVersion: run.evaluatorVersion,
      attempt: run.attempt,
      subjectHash: run.subjectHash,
      decision: run.decision as unknown as JsonValue,
    })),
    events: prepared.events.map((event) => ({
      key: event.key,
      type: event.type,
      schemaVersion: event.schemaVersion,
      payload: optionalContentView(
        event.payload,
        VIEW_UNAVAILABLE.payloadUnreadable,
        options,
      ),
    })),
  };
}

function pipelineIssues(
  details: JsonValue | undefined,
  options: RedactionOptions,
): readonly PipelineIssueView[] {
  const raw = detailField(details, 'issues');
  if (raw === undefined || !Array.isArray(raw)) {
    return [];
  }
  const issues: PipelineIssueView[] = [];
  for (const entry of raw) {
    if (!isObject(entry)) {
      continue;
    }
    const path = entry['path'];
    issues.push({
      code: typeof entry['code'] === 'string' ? entry['code'] : 'UNKNOWN',
      severity:
        typeof entry['severity'] === 'string' ? entry['severity'] : 'error',
      path: Array.isArray(path)
        ? path.filter(
            (part): part is string | number =>
              typeof part === 'string' || typeof part === 'number',
          )
        : [],
      message: optionalContentView(
        entry['message'],
        VIEW_UNAVAILABLE.payloadUnreadable,
        options,
      ),
    });
  }
  return issues;
}

function responseValidationView(
  error: AcmeErrorData | undefined,
  options: RedactionOptions,
): ViewSection<ResponseValidationView> {
  if (error === undefined || error.code !== 'MODEL_INVALID_RESPONSE') {
    return unavailable(VIEW_UNAVAILABLE.responseValidation);
  }
  const pipelineStage = detailField(error.details, 'pipelineStage');
  const repairable = detailField(error.details, 'repairable');
  return available<ResponseValidationView>({
    pipelineStage: typeof pipelineStage === 'string' ? pipelineStage : null,
    repairable: typeof repairable === 'boolean' ? repairable : null,
    issues: pipelineIssues(error.details, options),
  });
}

export function buildExecutionView(
  evidence: ExecutionEvidence,
  viewOptions: ExecutionViewOptions = {},
): ExecutionView {
  const { execution } = evidence;
  const options: RedactionOptions =
    viewOptions.revealContent === undefined
      ? {}
      : { revealContent: viewOptions.revealContent };
  const { retention } = execution.policy;
  const error = terminalError(execution);
  const replayEvidence = evidence.replayEvidence ?? null;
  const reached = reachedIndex(execution, evidence.attempts, error);
  const failure = stageIndex(error?.stage);
  const rawPipelineStage = detailField(error?.details, 'pipelineStage');
  const pipelineStage =
    typeof rawPipelineStage === 'string' ? rawPipelineStage : null;
  const committed =
    execution.result !== undefined && execution.result.status === 'committed';

  return {
    view: EXECUTION_VIEW_VERSION,
    retention,
    header: {
      executionId: execution.executionId,
      requestKey: execution.request.requestKey,
      namespace: execution.request.namespace,
      task: execution.request.task,
      entityId: execution.request.entityId,
      expectedRevision: execution.request.expectedRevision,
      requestFingerprint: execution.requestFingerprint,
      inputHash: execution.inputHash,
      contract: contractRefView(execution.contract),
      contractFingerprint: execution.contractFingerprint,
      model: modelSelectionView(execution.request.model),
      policy: policyView(execution.policy),
      status: execution.status,
      currentStage: execution.currentStage,
      createdAt: execution.createdAt,
      updatedAt: execution.updatedAt,
      requestInput: optionalContentView(
        execution.request.input,
        VIEW_UNAVAILABLE.payloadUnreadable,
        options,
      ),
    },
    terminal: terminalView(execution, error, options),
    attempts: evidence.attempts.map((attempt) => ({
      attemptNumber: attempt.attemptNumber,
      stage: attempt.stage,
      outcome: attempt.outcome,
      occurredAt: attempt.occurredAt,
      retryAt: attempt.retryAt ?? null,
      diagnostic:
        attempt.diagnostic === undefined
          ? null
          : diagnosticView(attempt.diagnostic, options),
    })),
    modelCalls: evidence.modelCalls.map((call) =>
      modelCallView(call, retention, options),
    ),
    taskInput:
      replayEvidence === null
        ? unavailable(VIEW_UNAVAILABLE.taskInput)
        : available({
            value: optionalContentView(
              replayEvidence.taskInput,
              VIEW_UNAVAILABLE.taskInput,
              options,
            ),
          }),
    readSet:
      replayEvidence === null
        ? unavailable(VIEW_UNAVAILABLE.replayEvidence)
        : available<ReadSetView>(readSetView(replayEvidence, options)),
    trustPipeline: TRUST_STAGES.map((definition) => ({
      stage: definition.stage,
      executionStage: definition.executionStage,
      outcome: trustStageOutcome(definition, {
        reached,
        failure,
        committed,
        pipelineStage,
      }),
    })),
    responseValidation: responseValidationView(error, options),
    preparedCommit:
      replayEvidence === null
        ? unavailable(VIEW_UNAVAILABLE.preparedCommit)
        : available<PreparedCommitView>(
            preparedCommitView(replayEvidence, options),
          ),
  };
}
