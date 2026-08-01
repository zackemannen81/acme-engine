import type {
  DiagnosticFact,
  EntityId,
  ExecutionId,
  IsoTimestamp,
  JsonValue,
  Namespace,
  StoredDocument,
} from './common.js';
import type { ContractRef } from './contracts.js';
import type { AcmeErrorData } from './errors.js';
import type { EvaluationDecision } from './evaluation.js';
import type {
  ExecutionPolicy,
  ExecutionRequest,
  ExecutionResult,
  ExecutionStatus,
} from './execution-types.js';
import type {
  MemoryCandidate,
  MemoryQuery,
  MemoryRecord,
  PreparedMemory,
  PreparedMemoryDecision,
  RankedMemory,
} from './memory.js';
import type {
  CompletedModelCall,
  FailedModelCall,
  ModelCallRecord,
  ModelCallReservation,
} from './repository-model-call.js';
import type { CandidateDocument, CandidateEvent } from './modules.js';
import type { PreparedState, StateSnapshot, StateTransition } from './state.js';

export interface AcceptedExecution {
  readonly executionId: ExecutionId;
  readonly request: ExecutionRequest<JsonValue>;
  readonly requestFingerprint: string;
  readonly inputHash: string;
  readonly contract: ContractRef;
  readonly contractFingerprint: string;
  readonly effectivePolicy: ExecutionPolicy;
  readonly createdAt: IsoTimestamp;
}

export type AcceptResult =
  | { readonly kind: 'created'; readonly execution: ExecutionRecord }
  | { readonly kind: 'existing'; readonly execution: ExecutionRecord }
  | { readonly kind: 'conflict'; readonly existingExecutionId: ExecutionId };

export interface ExecutionRecord {
  readonly executionId: ExecutionId;
  readonly request: ExecutionRequest<JsonValue>;
  readonly requestFingerprint: string;
  readonly inputHash: string;
  readonly contract: ContractRef;
  readonly contractFingerprint: string;
  readonly policy: ExecutionPolicy;
  readonly status: ExecutionStatus;
  readonly currentStage: ExecutionStatus;
  readonly result?: ExecutionResult;
  readonly error?: AcmeErrorData;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

/**
 * Recorded evidence an interrupted execution can be resumed from (ADR-0017).
 *
 * `lastAttemptNumber` is `0` when no attempt has been recorded yet, so a
 * resumed run always continues at `lastAttemptNumber + 1`.
 */
export interface ExecutionResumeState {
  readonly executionId: ExecutionId;
  readonly lastAttemptNumber: number;
  readonly modelCalls: readonly ModelCallRecord[];
}

export interface ExecutionAttempt {
  readonly executionId: ExecutionId;
  readonly attemptNumber: number;
  readonly stage: ExecutionStatus;
  readonly outcome: 'started' | 'succeeded' | 'failed' | 'retry-scheduled';
  readonly retryAt?: IsoTimestamp;
  readonly diagnostic?: DiagnosticFact;
  readonly occurredAt: IsoTimestamp;
}

export interface ContextQuery {
  readonly namespace: Namespace;
  readonly entityId: EntityId;
  readonly expectedRevision: number;
  readonly memory: MemoryQuery;
  readonly documentKinds?: readonly string[];
}

export interface ExecutionReadSet {
  readonly state: StateSnapshot<JsonValue> | null;
  readonly memories: readonly MemoryRecord[];
  readonly documents: readonly StoredDocument[];
}

export interface RecordedRankedMemory extends RankedMemory {
  readonly rank: number;
}

export interface ExecutionReplayReadSet {
  readonly state: StateSnapshot<JsonValue> | null;
  readonly loadedMemories: readonly MemoryRecord[];
  readonly retrievedMemories: readonly RecordedRankedMemory[];
  readonly documents: readonly StoredDocument[];
}

export interface PreparedReplayEvidence {
  readonly taskInput: JsonValue;
  readonly readSet: ExecutionReplayReadSet;
}

export interface PreparedEvaluatorRun {
  readonly evaluatorId: string;
  readonly evaluatorVersion: string;
  readonly attempt: number;
  readonly subjectHash: string;
  readonly decision: EvaluationDecision;
}

export interface PreparedCommit {
  readonly executionId: ExecutionId;
  readonly expectedRevision: number;
  readonly operationDigest: string;
  readonly documents: readonly CandidateDocument[];
  readonly memoryCandidates: readonly MemoryCandidate[];
  readonly memory: PreparedMemory;
  readonly state: PreparedState<JsonValue, JsonValue> | null;
  readonly evaluatorRuns: readonly PreparedEvaluatorRun[];
  readonly events: readonly CandidateEvent[];
  readonly committedAt: IsoTimestamp;
  readonly replayEvidence?: PreparedReplayEvidence;
}

export type PreparedCommitContent = Omit<PreparedCommit, 'operationDigest'>;

export interface CommittedExecution {
  readonly executionId: ExecutionId;
  readonly revision: number;
  readonly documentKeys: readonly string[];
  readonly eventIds: readonly string[];
  readonly operationDigest: string;
}

export interface NonCommitTerminalRecord {
  readonly executionId: ExecutionId;
  readonly status: 'blocked' | 'conflicted' | 'cancelled' | 'failed';
  readonly error: AcmeErrorData;
  readonly terminalAt: IsoTimestamp;
}

export interface ExecutionReplayEvidence {
  readonly executionId: ExecutionId;
  readonly request: ExecutionRequest<JsonValue>;
  readonly requestFingerprint: string;
  readonly inputHash: string;
  readonly contract: ContractRef;
  readonly contractFingerprint: string;
  readonly effectivePolicy: ExecutionPolicy;
  readonly taskInput: JsonValue;
  readonly readSet: ExecutionReplayReadSet;
  readonly modelCalls: readonly ModelCallRecord[];
  readonly preparedCommit: PreparedCommit;
}

export interface StoredMemoryCandidate {
  readonly executionId: ExecutionId;
  readonly candidate: MemoryCandidate;
  readonly decision: PreparedMemoryDecision;
  readonly createdAt: IsoTimestamp;
}

export interface StoredEvaluatorRun extends PreparedEvaluatorRun {
  readonly executionId: ExecutionId;
  readonly createdAt: IsoTimestamp;
}

export interface DomainEventRecord {
  readonly eventId: string;
  readonly executionId: ExecutionId;
  readonly key: string;
  readonly namespace: Namespace;
  readonly entityId: EntityId;
  readonly type: string;
  readonly schemaVersion: string;
  readonly payload: JsonValue;
  readonly occurredAt: IsoTimestamp;
}

export interface OutboxRecord {
  readonly eventId: string;
  readonly status: 'pending' | 'claimed' | 'delivered' | 'failed';
  readonly attemptCount: number;
  readonly availableAt: IsoTimestamp;
  readonly claimedAt?: IsoTimestamp;
  readonly deliveredAt?: IsoTimestamp;
  readonly lastError?: AcmeErrorData;
}

export interface ExecutionRepository {
  accept(request: AcceptedExecution): Promise<AcceptResult>;
  get(executionId: ExecutionId): Promise<ExecutionRecord | null>;
  appendAttempt(attempt: ExecutionAttempt): Promise<void>;
  reserveModelCall(call: ModelCallReservation): Promise<ModelCallRecord>;
  completeModelCall(call: CompletedModelCall): Promise<void>;
  failModelCall(call: FailedModelCall): Promise<void>;
  loadContext(query: ContextQuery): Promise<ExecutionReadSet>;
  /**
   * Recorded model calls and attempt progress of an accepted execution,
   * revealed with the same payload rules as `loadReplayEvidence`. Returns
   * `null` only when the execution is unknown.
   */
  loadResumeState(
    executionId: ExecutionId,
  ): Promise<ExecutionResumeState | null>;
  commit(prepared: PreparedCommit): Promise<CommittedExecution>;
  markTerminal(terminal: NonCommitTerminalRecord): Promise<void>;
  loadReplayEvidence(
    executionId: ExecutionId,
  ): Promise<ExecutionReplayEvidence | null>;
}

export interface RepositoryStateEvidence {
  readonly snapshots: readonly StateSnapshot<JsonValue>[];
  readonly transitions: readonly StateTransition<JsonValue>[];
}

export interface RepositoryEvidence {
  readonly executions: readonly ExecutionRecord[];
  readonly attempts: readonly ExecutionAttempt[];
  readonly modelCalls: readonly ModelCallRecord[];
  readonly documents: readonly StoredDocument[];
  readonly memoryCandidates: readonly StoredMemoryCandidate[];
  readonly memoryRecords: readonly MemoryRecord[];
  readonly state: RepositoryStateEvidence;
  readonly evaluatorRuns: readonly StoredEvaluatorRun[];
  readonly events: readonly DomainEventRecord[];
  readonly outbox: readonly OutboxRecord[];
}

export type {
  CompletedModelCall,
  FailedModelCall,
  ModelCallRecord,
  ModelCallReservation,
} from './repository-model-call.js';
