import {
  AcmeError,
  computeOperationDigest,
  nodeHashing,
  type AcceptResult,
  type AcceptedExecution,
  type CommittedExecution,
  type CompletedModelCall,
  type ContextQuery,
  type DomainEventRecord,
  type ExecutionAttempt,
  type ExecutionReadSet,
  type ExecutionRecord,
  type ExecutionReplayEvidence,
  type ExecutionRepository,
  type FailedModelCall,
  type Hashing,
  type IdGenerator,
  type JsonValue,
  type MemoryRecord,
  type ModelCallRecord,
  type ModelCallReservation,
  type NonCommitTerminalRecord,
  type OutboxRecord,
  type PreparedCommit,
  type RepositoryEvidence,
  type StateSnapshot,
  type StateTransition,
  type StoredDocument,
  type StoredEvaluatorRun,
  type StoredMemoryCandidate,
} from '@acme/core';

export interface InMemoryExecutionRepositoryOptions {
  readonly ids: IdGenerator;
  readonly hashing?: Hashing;
}

interface StateHead {
  readonly revision: number;
  readonly valueHash: string;
}

interface Store {
  readonly executions: Map<string, ExecutionRecord>;
  readonly requestKeys: Map<string, string>;
  readonly attempts: Map<string, ExecutionAttempt>;
  readonly modelCalls: Map<string, ModelCallRecord>;
  readonly modelCallKeys: Map<string, string>;
  readonly documents: Map<string, StoredDocument>;
  readonly documentKeys: Map<string, string>;
  readonly memoryCandidates: Map<string, StoredMemoryCandidate>;
  readonly memoryRecords: Map<string, MemoryRecord>;
  readonly memoryIdentities: Map<string, string>;
  readonly stateHeads: Map<string, StateHead>;
  readonly stateSnapshots: Map<string, StateSnapshot<JsonValue>>;
  readonly stateTransitions: Map<string, StateTransition<JsonValue>>;
  readonly operationKeys: Map<string, string>;
  readonly evaluatorRuns: Map<string, StoredEvaluatorRun>;
  readonly events: Map<string, DomainEventRecord>;
  readonly eventKeys: Map<string, string>;
  readonly outbox: Map<string, OutboxRecord>;
  readonly committed: Map<string, CommittedExecution>;
  readonly preparedCommits: Map<string, PreparedCommit>;
}

function emptyStore(): Store {
  return {
    executions: new Map(),
    requestKeys: new Map(),
    attempts: new Map(),
    modelCalls: new Map(),
    modelCallKeys: new Map(),
    documents: new Map(),
    documentKeys: new Map(),
    memoryCandidates: new Map(),
    memoryRecords: new Map(),
    memoryIdentities: new Map(),
    stateHeads: new Map(),
    stateSnapshots: new Map(),
    stateTransitions: new Map(),
    operationKeys: new Map(),
    evaluatorRuns: new Map(),
    events: new Map(),
    eventKeys: new Map(),
    outbox: new Map(),
    committed: new Map(),
    preparedCommits: new Map(),
  };
}

function stageStore(source: Store): Store {
  return {
    executions: new Map(source.executions),
    requestKeys: new Map(source.requestKeys),
    attempts: new Map(source.attempts),
    modelCalls: new Map(source.modelCalls),
    modelCallKeys: new Map(source.modelCallKeys),
    documents: new Map(source.documents),
    documentKeys: new Map(source.documentKeys),
    memoryCandidates: new Map(source.memoryCandidates),
    memoryRecords: new Map(source.memoryRecords),
    memoryIdentities: new Map(source.memoryIdentities),
    stateHeads: new Map(source.stateHeads),
    stateSnapshots: new Map(source.stateSnapshots),
    stateTransitions: new Map(source.stateTransitions),
    operationKeys: new Map(source.operationKeys),
    evaluatorRuns: new Map(source.evaluatorRuns),
    events: new Map(source.events),
    eventKeys: new Map(source.eventKeys),
    outbox: new Map(source.outbox),
    committed: new Map(source.committed),
    preparedCommits: new Map(source.preparedCommits),
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function clone<T>(value: T, hashing: Hashing): T {
  return deepFreeze(
    JSON.parse(hashing.canonicalJson(value as JsonValue)) as unknown as T,
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireText(value: string, field: string): void {
  if (value.trim().length === 0) {
    invalid(`${field} must be a non-empty string.`);
  }
}

function requireRevision(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    invalid(`${field} must be a non-negative safe integer.`);
  }
}

function invalid(message: string, details?: JsonValue): never {
  throw new AcmeError({
    code: 'INVALID_REQUEST',
    message,
    stage: 'preparing-commit',
    retryable: false,
    ...(details === undefined ? {} : { details }),
  });
}

function corruption(message: string, details?: JsonValue): never {
  throw new AcmeError({
    code: 'PERSISTENCE_CORRUPTION',
    message,
    stage: 'preparing-commit',
    retryable: false,
    ...(details === undefined ? {} : { details }),
  });
}

function stateConflict(expected: number, actual: number): never {
  throw new AcmeError({
    code: 'CONFLICT_STATE_REVISION',
    message: `Expected state revision ${expected}, found ${actual}.`,
    stage: 'preparing-commit',
    retryable: false,
    details: { expectedRevision: expected, actualRevision: actual },
  });
}

function memoryConflict(
  memoryId: string,
  expected: number,
  actual: number,
): never {
  throw new AcmeError({
    code: 'CONFLICT_MEMORY_VERSION',
    message: `Expected memory ${memoryId} version ${expected}, found ${actual}.`,
    stage: 'preparing-commit',
    retryable: false,
    details: {
      memoryId,
      expectedRecordVersion: expected,
      actualRecordVersion: actual,
    },
  });
}

function requestKey(namespace: string, key: string): string {
  return `${namespace}\u0000${key}`;
}

function scopeKey(namespace: string, entityId: string): string {
  return `${namespace}\u0000${entityId}`;
}

function scopedIdentity(record: MemoryRecord): string {
  return `${scopeKey(record.namespace, record.entityId)}\u0000${record.identityKey}`;
}

function equivalent(left: unknown, right: unknown, hashing: Hashing): boolean {
  return (
    hashing.canonicalJson(left as JsonValue) ===
    hashing.canonicalJson(right as JsonValue)
  );
}

function assertUniqueKeys(
  values: readonly { readonly key: string }[],
  description: string,
): void {
  const seen = new Set<string>();
  for (const value of values) {
    requireText(value.key, `${description}.key`);
    if (seen.has(value.key)) {
      invalid(`Duplicate ${description} key.`, { key: value.key });
    }
    seen.add(value.key);
  }
}

function assertKnownExecution(
  store: Store,
  executionId: string,
): ExecutionRecord {
  const execution = store.executions.get(executionId);
  if (execution === undefined) {
    invalid('Execution does not exist.', { executionId });
  }
  return execution;
}

function assertMutableExecution(execution: ExecutionRecord): void {
  if (
    execution.status === 'committed' ||
    execution.status === 'blocked' ||
    execution.status === 'conflicted' ||
    execution.status === 'cancelled' ||
    execution.status === 'failed'
  ) {
    corruption('A terminal execution cannot be mutated.', {
      executionId: execution.executionId,
      status: execution.status,
    });
  }
}

export class InMemoryExecutionRepository implements ExecutionRepository {
  readonly #ids: IdGenerator;
  readonly #hashing: Hashing;
  #store: Store = emptyStore();

  constructor(options: InMemoryExecutionRepositoryOptions) {
    this.#ids = options.ids;
    this.#hashing = options.hashing ?? nodeHashing;
  }

  async accept(input: AcceptedExecution): Promise<AcceptResult> {
    const accepted = clone(input, this.#hashing);
    requireText(accepted.executionId, 'executionId');
    requireText(accepted.request.requestKey, 'request.requestKey');
    requireText(accepted.request.namespace, 'request.namespace');
    requireText(accepted.request.entityId, 'request.entityId');
    requireText(accepted.requestFingerprint, 'requestFingerprint');
    requireText(accepted.inputHash, 'inputHash');
    requireRevision(
      accepted.request.expectedRevision,
      'request.expectedRevision',
    );

    const key = requestKey(
      accepted.request.namespace,
      accepted.request.requestKey,
    );
    const existingId = this.#store.requestKeys.get(key);
    if (existingId !== undefined) {
      const existing = this.#store.executions.get(existingId);
      if (existing === undefined) {
        corruption('Request-key index references a missing execution.', {
          executionId: existingId,
        });
      }
      if (existing.requestFingerprint !== accepted.requestFingerprint) {
        return clone(
          { kind: 'conflict', existingExecutionId: existing.executionId },
          this.#hashing,
        );
      }
      return clone({ kind: 'existing', execution: existing }, this.#hashing);
    }

    const record: ExecutionRecord = clone(
      {
        executionId: accepted.executionId,
        request: accepted.request,
        requestFingerprint: accepted.requestFingerprint,
        inputHash: accepted.inputHash,
        contract: accepted.contract,
        contractFingerprint: accepted.contractFingerprint,
        policy: accepted.effectivePolicy,
        status: 'accepted',
        currentStage: 'accepted',
        createdAt: accepted.createdAt,
        updatedAt: accepted.createdAt,
      },
      this.#hashing,
    );
    const sameId = this.#store.executions.get(record.executionId);
    if (sameId !== undefined) {
      corruption('Execution ID was reused for a different request.', {
        executionId: record.executionId,
      });
    }

    const staged = stageStore(this.#store);
    staged.executions.set(record.executionId, record);
    staged.requestKeys.set(key, record.executionId);
    this.#store = staged;
    return clone({ kind: 'created', execution: record }, this.#hashing);
  }

  async get(executionId: string): Promise<ExecutionRecord | null> {
    const record = this.#store.executions.get(executionId);
    return record === undefined ? null : clone(record, this.#hashing);
  }

  async appendAttempt(input: ExecutionAttempt): Promise<void> {
    const attempt = clone(input, this.#hashing);
    requireRevision(attempt.attemptNumber, 'attemptNumber');
    if (attempt.attemptNumber === 0) {
      invalid('attemptNumber must be greater than zero.');
    }
    const execution = assertKnownExecution(this.#store, attempt.executionId);
    assertMutableExecution(execution);
    const key = `${attempt.executionId}\u0000${attempt.attemptNumber}\u0000${attempt.stage}`;
    const existing = this.#store.attempts.get(key);
    if (existing !== undefined) {
      if (!equivalent(existing, attempt, this.#hashing)) {
        corruption('Divergent execution attempt key was reused.', { key });
      }
      return;
    }

    const staged = stageStore(this.#store);
    staged.attempts.set(key, attempt);
    staged.executions.set(
      execution.executionId,
      clone(
        {
          ...execution,
          status: attempt.stage,
          currentStage: attempt.stage,
          updatedAt: attempt.occurredAt,
        },
        this.#hashing,
      ),
    );
    this.#store = staged;
  }

  async reserveModelCall(
    input: ModelCallReservation,
  ): Promise<ModelCallRecord> {
    const reservation = clone(input, this.#hashing);
    requireText(reservation.modelCallId, 'modelCallId');
    requireText(reservation.callKey, 'callKey');
    requireRevision(reservation.attempt, 'attempt');
    if (reservation.attempt === 0) {
      invalid('Model-call attempt must be greater than zero.');
    }
    const execution = assertKnownExecution(
      this.#store,
      reservation.executionId,
    );
    assertMutableExecution(execution);
    const logicalKey = `${reservation.executionId}\u0000${reservation.callKey}\u0000${reservation.attempt}`;
    const existingId = this.#store.modelCallKeys.get(logicalKey);
    if (existingId !== undefined) {
      const existing = this.#store.modelCalls.get(existingId);
      if (existing === undefined) {
        corruption('Model-call index references a missing record.', {
          modelCallId: existingId,
        });
      }
      const original: ModelCallReservation = {
        modelCallId: existing.modelCallId,
        executionId: existing.executionId,
        callKey: existing.callKey,
        attempt: existing.attempt,
        purpose: existing.purpose,
        selection: existing.selection,
        requestHash: existing.requestHash,
        ...(existing.protectedRequest === undefined
          ? {}
          : { protectedRequest: existing.protectedRequest }),
        startedAt: existing.startedAt,
      };
      if (!equivalent(original, reservation, this.#hashing)) {
        corruption('Divergent model-call key was reused.', { logicalKey });
      }
      return clone(existing, this.#hashing);
    }
    if (this.#store.modelCalls.has(reservation.modelCallId)) {
      corruption('Model-call ID was reused.', {
        modelCallId: reservation.modelCallId,
      });
    }

    const record: ModelCallRecord = clone(
      { ...reservation, status: 'reserved' },
      this.#hashing,
    );
    const staged = stageStore(this.#store);
    staged.modelCalls.set(record.modelCallId, record);
    staged.modelCallKeys.set(logicalKey, record.modelCallId);
    this.#store = staged;
    return clone(record, this.#hashing);
  }

  async completeModelCall(input: CompletedModelCall): Promise<void> {
    const completed = clone(input, this.#hashing);
    const existing = this.#store.modelCalls.get(completed.modelCallId);
    if (existing === undefined) {
      invalid('Model call does not exist.', {
        modelCallId: completed.modelCallId,
      });
    }
    if (existing.status === 'succeeded') {
      if (
        existing.responseHash === undefined ||
        existing.completedAt === undefined
      ) {
        corruption('Succeeded model-call evidence is incomplete.', {
          modelCallId: existing.modelCallId,
        });
      }
      const prior: CompletedModelCall = {
        modelCallId: existing.modelCallId,
        response: completed.response,
        responseHash: existing.responseHash,
        ...(existing.protectedResponse === undefined
          ? {}
          : { protectedResponse: existing.protectedResponse }),
        completedAt: existing.completedAt,
      };
      if (!equivalent(prior, completed, this.#hashing)) {
        corruption('Divergent model-call completion was attempted.', {
          modelCallId: completed.modelCallId,
        });
      }
      return;
    }
    if (existing.status === 'failed' || existing.status === 'ambiguous') {
      corruption('A failed model call cannot be completed.', {
        modelCallId: completed.modelCallId,
      });
    }
    const execution = assertKnownExecution(this.#store, existing.executionId);
    const retainPayload = execution.policy.retention === 'encrypted-payload';
    const record: ModelCallRecord = clone(
      {
        ...existing,
        status: 'succeeded',
        ...(retainPayload ? { response: completed.response } : {}),
        responseHash: completed.responseHash,
        ...(retainPayload && completed.protectedResponse !== undefined
          ? { protectedResponse: completed.protectedResponse }
          : {}),
        completedAt: completed.completedAt,
      },
      this.#hashing,
    );
    const staged = stageStore(this.#store);
    staged.modelCalls.set(record.modelCallId, record);
    this.#store = staged;
  }

  async failModelCall(input: FailedModelCall): Promise<void> {
    const failed = clone(input, this.#hashing);
    const existing = this.#store.modelCalls.get(failed.modelCallId);
    if (existing === undefined) {
      invalid('Model call does not exist.', {
        modelCallId: failed.modelCallId,
      });
    }
    const status = failed.ambiguous ? 'ambiguous' : 'failed';
    if (existing.status === 'failed' || existing.status === 'ambiguous') {
      if (existing.error === undefined || existing.completedAt === undefined) {
        corruption('Failed model-call evidence is incomplete.', {
          modelCallId: existing.modelCallId,
        });
      }
      const prior: FailedModelCall = {
        modelCallId: existing.modelCallId,
        error: existing.error,
        ambiguous: existing.status === 'ambiguous',
        completedAt: existing.completedAt,
      };
      if (!equivalent(prior, failed, this.#hashing)) {
        corruption('Divergent model-call failure was attempted.', {
          modelCallId: failed.modelCallId,
        });
      }
      return;
    }
    if (existing.status === 'succeeded') {
      corruption('A completed model call cannot be failed.', {
        modelCallId: failed.modelCallId,
      });
    }
    const record: ModelCallRecord = clone(
      {
        ...existing,
        status,
        error: failed.error,
        completedAt: failed.completedAt,
      },
      this.#hashing,
    );
    const staged = stageStore(this.#store);
    staged.modelCalls.set(record.modelCallId, record);
    this.#store = staged;
  }

  async loadContext(queryInput: ContextQuery): Promise<ExecutionReadSet> {
    const query = clone(queryInput, this.#hashing);
    requireRevision(query.expectedRevision, 'expectedRevision');
    if (
      query.memory.namespace !== query.namespace ||
      query.memory.entityId !== query.entityId
    ) {
      invalid('Memory query scope must match the context scope.');
    }
    const scope = scopeKey(query.namespace, query.entityId);
    const head = this.#store.stateHeads.get(scope);
    const actualRevision = head?.revision ?? 0;
    if (actualRevision !== query.expectedRevision) {
      stateConflict(query.expectedRevision, actualRevision);
    }
    const state =
      actualRevision === 0
        ? null
        : (this.#store.stateSnapshots.get(`${scope}\u0000${actualRevision}`) ??
          corruption('State head references a missing snapshot.', { scope }));
    const allowedMemoryKinds =
      query.memory.kinds === undefined ? null : new Set(query.memory.kinds);
    const memories = [...this.#store.memoryRecords.values()]
      .filter(
        (record) =>
          record.namespace === query.namespace &&
          record.entityId === query.entityId &&
          record.status !== 'forgotten' &&
          record.status !== 'superseded' &&
          (allowedMemoryKinds === null || allowedMemoryKinds.has(record.kind)),
      )
      .sort(
        (left, right) =>
          compareText(left.identityKey, right.identityKey) ||
          compareText(left.memoryId, right.memoryId),
      );
    const allowedDocumentKinds =
      query.documentKinds === undefined ? null : new Set(query.documentKinds);
    const documents = [...this.#store.documents.values()]
      .filter(
        (document) =>
          document.namespace === query.namespace &&
          document.entityId === query.entityId &&
          (allowedDocumentKinds === null ||
            allowedDocumentKinds.has(document.kind)),
      )
      .sort(
        (left, right) =>
          compareText(left.key, right.key) ||
          compareText(left.documentId, right.documentId),
      );
    return clone({ state, memories, documents }, this.#hashing);
  }

  async commit(input: PreparedCommit): Promise<CommittedExecution> {
    const prepared = clone(input, this.#hashing);
    requireRevision(prepared.expectedRevision, 'expectedRevision');
    const computedDigest = computeOperationDigest(prepared, this.#hashing);
    if (computedDigest !== prepared.operationDigest) {
      invalid('Prepared commit operation digest does not match its content.', {
        supplied: prepared.operationDigest,
        computed: computedDigest,
      });
    }

    const execution = assertKnownExecution(this.#store, prepared.executionId);
    const priorCommit = this.#store.committed.get(prepared.executionId);
    if (priorCommit !== undefined) {
      if (priorCommit.operationDigest !== prepared.operationDigest) {
        corruption(
          'A committed execution was retried with divergent content.',
          {
            executionId: prepared.executionId,
          },
        );
      }
      return clone(priorCommit, this.#hashing);
    }
    assertMutableExecution(execution);
    if (execution.request.expectedRevision !== prepared.expectedRevision) {
      invalid('Prepared commit revision differs from the accepted request.');
    }

    const scope = scopeKey(
      execution.request.namespace,
      execution.request.entityId,
    );
    const head = this.#store.stateHeads.get(scope);
    const actualRevision = head?.revision ?? 0;
    if (actualRevision !== prepared.expectedRevision) {
      stateConflict(prepared.expectedRevision, actualRevision);
    }

    assertUniqueKeys(prepared.documents, 'document');
    assertUniqueKeys(prepared.memoryCandidates, 'memory candidate');
    assertUniqueKeys(prepared.events, 'event');
    this.#validateEvidence(prepared);
    this.#validateReplayEvidence(prepared, execution);
    this.#validateState(prepared, execution, head, scope);

    const staged = stageStore(this.#store);
    this.#applyMemory(staged, prepared, execution);

    const documentIds = new Map<string, string>();
    for (const candidate of [...prepared.documents].sort((left, right) =>
      compareText(left.key, right.key),
    )) {
      const contentHash = this.#hashing.sha256(
        this.#hashing.canonicalJson(candidate.value),
      );
      if (contentHash !== candidate.contentHash) {
        invalid('Document content hash does not match its value.', {
          key: candidate.key,
        });
      }
      const logicalKey = `${prepared.executionId}\u0000${candidate.key}`;
      if (staged.documentKeys.has(logicalKey)) {
        corruption('Document key was already persisted.', {
          key: candidate.key,
        });
      }
      const documentId = this.#nextId('document');
      if (staged.documents.has(documentId)) {
        corruption('Generated document ID collided with persisted data.', {
          documentId,
        });
      }
      documentIds.set(candidate.key, documentId);
      const record: StoredDocument = clone(
        {
          documentId,
          executionId: prepared.executionId,
          namespace: execution.request.namespace,
          entityId: execution.request.entityId,
          key: candidate.key,
          kind: candidate.kind,
          schemaVersion: candidate.schemaVersion,
          value: candidate.value,
          contentHash: candidate.contentHash,
          createdAt: prepared.committedAt,
        },
        this.#hashing,
      );
      staged.documents.set(documentId, record);
      staged.documentKeys.set(logicalKey, documentId);
    }

    const eventIds: string[] = [];
    for (const candidate of [...prepared.events].sort((left, right) =>
      compareText(left.key, right.key),
    )) {
      const logicalKey = `${prepared.executionId}\u0000${candidate.key}`;
      if (staged.eventKeys.has(logicalKey)) {
        corruption('Event key was already persisted.', { key: candidate.key });
      }
      const eventId = this.#nextId('event');
      if (staged.events.has(eventId)) {
        corruption('Generated event ID collided with persisted data.', {
          eventId,
        });
      }
      eventIds.push(eventId);
      const event: DomainEventRecord = clone(
        {
          eventId,
          executionId: prepared.executionId,
          key: candidate.key,
          namespace: execution.request.namespace,
          entityId: execution.request.entityId,
          type: candidate.type,
          schemaVersion: candidate.schemaVersion,
          payload: candidate.payload,
          occurredAt: prepared.committedAt,
        },
        this.#hashing,
      );
      const outbox: OutboxRecord = clone(
        {
          eventId,
          status: 'pending',
          attemptCount: 0,
          availableAt: prepared.committedAt,
        },
        this.#hashing,
      );
      staged.events.set(eventId, event);
      staged.eventKeys.set(logicalKey, eventId);
      staged.outbox.set(eventId, outbox);
    }

    for (const candidate of prepared.memoryCandidates) {
      const decision = prepared.memory.decisions.find(
        (entry) => entry.candidateKey === candidate.key,
      );
      if (decision === undefined) {
        corruption('Validated memory decision correlation was lost.', {
          candidateKey: candidate.key,
        });
      }
      const record: StoredMemoryCandidate = clone(
        {
          executionId: prepared.executionId,
          candidate,
          decision,
          createdAt: prepared.committedAt,
        },
        this.#hashing,
      );
      staged.memoryCandidates.set(
        `${prepared.executionId}\u0000${candidate.key}`,
        record,
      );
    }
    for (const evaluator of prepared.evaluatorRuns) {
      const record: StoredEvaluatorRun = clone(
        {
          ...evaluator,
          executionId: prepared.executionId,
          createdAt: prepared.committedAt,
        },
        this.#hashing,
      );
      staged.evaluatorRuns.set(
        `${prepared.executionId}\u0000${evaluator.evaluatorId}\u0000${evaluator.attempt}`,
        record,
      );
    }

    if (prepared.state !== null) {
      const snapshot = clone(prepared.state.snapshot, this.#hashing);
      const transition = clone(prepared.state.transition, this.#hashing);
      staged.stateSnapshots.set(`${scope}\u0000${snapshot.revision}`, snapshot);
      staged.stateTransitions.set(transition.transitionId, transition);
      staged.operationKeys.set(
        `${scope}\u0000${transition.operationKey}`,
        transition.transitionId,
      );
      staged.stateHeads.set(scope, {
        revision: snapshot.revision,
        valueHash: snapshot.valueHash,
      });
    }

    const revision =
      prepared.state?.snapshot.revision ?? prepared.expectedRevision;
    const committed: CommittedExecution = clone(
      {
        executionId: prepared.executionId,
        revision,
        documentKeys: [...documentIds.keys()].sort(compareText),
        eventIds,
        operationDigest: prepared.operationDigest,
      },
      this.#hashing,
    );
    staged.committed.set(prepared.executionId, committed);
    staged.preparedCommits.set(prepared.executionId, prepared);
    staged.executions.set(
      prepared.executionId,
      clone(
        {
          ...execution,
          status: 'committed',
          currentStage: 'committed',
          result: {
            status: 'committed',
            executionId: prepared.executionId,
            replayed: false,
            revision,
            documentKeys: committed.documentKeys,
            eventIds: committed.eventIds,
          },
          updatedAt: prepared.committedAt,
        },
        this.#hashing,
      ),
    );
    this.#store = staged;
    return clone(committed, this.#hashing);
  }

  async loadReplayEvidence(
    executionId: string,
  ): Promise<ExecutionReplayEvidence | null> {
    const execution = this.#store.executions.get(executionId);
    const prepared = this.#store.preparedCommits.get(executionId);
    if (
      execution === undefined ||
      prepared === undefined ||
      prepared.replayEvidence === undefined
    ) {
      return null;
    }
    const modelCalls = [...this.#store.modelCalls.values()]
      .filter((call) => call.executionId === executionId)
      .sort(
        (left, right) =>
          compareText(left.callKey, right.callKey) ||
          left.attempt - right.attempt,
      );
    return clone(
      {
        executionId,
        request: execution.request,
        requestFingerprint: execution.requestFingerprint,
        inputHash: execution.inputHash,
        contract: execution.contract,
        contractFingerprint: execution.contractFingerprint,
        effectivePolicy: execution.policy,
        taskInput: prepared.replayEvidence.taskInput,
        readSet: prepared.replayEvidence.readSet,
        modelCalls,
        preparedCommit: prepared,
      },
      this.#hashing,
    );
  }

  async markTerminal(input: NonCommitTerminalRecord): Promise<void> {
    const terminal = clone(input, this.#hashing);
    const execution = assertKnownExecution(this.#store, terminal.executionId);
    if (execution.status === terminal.status) {
      if (
        execution.error !== undefined &&
        equivalent(execution.error, terminal.error, this.#hashing) &&
        execution.updatedAt === terminal.terminalAt
      ) {
        return;
      }
      corruption('Divergent terminal outcome was attempted.', {
        executionId: terminal.executionId,
      });
    }
    assertMutableExecution(execution);
    const staged = stageStore(this.#store);
    staged.executions.set(
      execution.executionId,
      clone(
        {
          ...execution,
          status: terminal.status,
          currentStage: terminal.status,
          result: {
            status: terminal.status,
            executionId: terminal.executionId,
            error: terminal.error,
          },
          error: terminal.error,
          updatedAt: terminal.terminalAt,
        },
        this.#hashing,
      ),
    );
    this.#store = staged;
  }

  snapshot(): RepositoryEvidence {
    const byExecution = <T extends { readonly executionId: string }>(
      left: T,
      right: T,
    ): number => compareText(left.executionId, right.executionId);
    return clone(
      {
        executions: [...this.#store.executions.values()].sort(byExecution),
        attempts: [...this.#store.attempts.values()].sort(
          (left, right) =>
            byExecution(left, right) ||
            left.attemptNumber - right.attemptNumber ||
            compareText(left.stage, right.stage),
        ),
        modelCalls: [...this.#store.modelCalls.values()].sort(
          (left, right) =>
            byExecution(left, right) ||
            compareText(left.callKey, right.callKey) ||
            left.attempt - right.attempt,
        ),
        documents: [...this.#store.documents.values()].sort(
          (left, right) =>
            byExecution(left, right) || compareText(left.key, right.key),
        ),
        memoryCandidates: [...this.#store.memoryCandidates.values()].sort(
          (left, right) =>
            byExecution(left, right) ||
            compareText(left.candidate.key, right.candidate.key),
        ),
        memoryRecords: [...this.#store.memoryRecords.values()].sort(
          (left, right) =>
            compareText(left.namespace, right.namespace) ||
            compareText(left.entityId, right.entityId) ||
            compareText(left.identityKey, right.identityKey) ||
            compareText(left.memoryId, right.memoryId),
        ),
        state: {
          snapshots: [...this.#store.stateSnapshots.values()].sort(
            (left, right) =>
              compareText(left.namespace, right.namespace) ||
              compareText(left.entityId, right.entityId) ||
              left.revision - right.revision,
          ),
          transitions: [...this.#store.stateTransitions.values()].sort(
            (left, right) =>
              compareText(left.namespace, right.namespace) ||
              compareText(left.entityId, right.entityId) ||
              left.toRevision - right.toRevision,
          ),
        },
        evaluatorRuns: [...this.#store.evaluatorRuns.values()].sort(
          (left, right) =>
            byExecution(left, right) ||
            compareText(left.evaluatorId, right.evaluatorId) ||
            left.attempt - right.attempt,
        ),
        events: [...this.#store.events.values()].sort(
          (left, right) =>
            byExecution(left, right) || compareText(left.key, right.key),
        ),
        outbox: [...this.#store.outbox.values()].sort((left, right) =>
          compareText(left.eventId, right.eventId),
        ),
      },
      this.#hashing,
    );
  }

  #validateEvidence(prepared: PreparedCommit): void {
    const decisions = new Map<string, string>();
    for (const decision of prepared.memory.decisions) {
      requireText(decision.candidateKey, 'memory decision candidateKey');
      if (decision.resolution.candidateKey !== decision.candidateKey) {
        invalid('Memory decision and resolution candidate keys differ.', {
          candidateKey: decision.candidateKey,
        });
      }
      if (decisions.has(decision.candidateKey)) {
        invalid('Duplicate memory decision candidate key.', {
          candidateKey: decision.candidateKey,
        });
      }
      decisions.set(decision.candidateKey, decision.identityKey);
    }
    if (decisions.size !== prepared.memoryCandidates.length) {
      invalid('Every memory candidate must have exactly one decision.');
    }
    for (const candidate of prepared.memoryCandidates) {
      if (!decisions.has(candidate.key)) {
        invalid('Memory candidate is missing its decision.', {
          candidateKey: candidate.key,
        });
      }
    }

    const evaluators = new Set<string>();
    for (const evaluator of prepared.evaluatorRuns) {
      requireText(evaluator.evaluatorId, 'evaluatorId');
      requireRevision(evaluator.attempt, 'evaluator attempt');
      const key = `${evaluator.evaluatorId}\u0000${evaluator.attempt}`;
      if (evaluators.has(key)) {
        invalid('Duplicate evaluator run identity.', { key });
      }
      evaluators.add(key);
    }
  }

  #validateReplayEvidence(
    prepared: PreparedCommit,
    execution: ExecutionRecord,
  ): void {
    const replay = prepared.replayEvidence;
    if (replay === undefined) {
      return;
    }
    if (!equivalent(replay.taskInput, execution.request.input, this.#hashing)) {
      invalid('Replay task input differs from the accepted request input.');
    }
    const { readSet } = replay;
    const stateRevision = readSet.state?.revision ?? 0;
    if (stateRevision !== prepared.expectedRevision) {
      invalid('Replay read-set state revision is inconsistent.', {
        expectedRevision: prepared.expectedRevision,
        stateRevision,
      });
    }
    const loadedById = new Map(
      readSet.loadedMemories.map((record) => [record.memoryId, record]),
    );
    for (const [index, ranked] of readSet.retrievedMemories.entries()) {
      if (ranked.rank !== index + 1) {
        invalid('Replay ranked memory evidence has an invalid rank.', {
          memoryId: ranked.record.memoryId,
          rank: ranked.rank,
        });
      }
      const loaded = loadedById.get(ranked.record.memoryId);
      if (
        loaded === undefined ||
        !equivalent(loaded, ranked.record, this.#hashing)
      ) {
        invalid(
          'Replay ranked memory evidence is absent from the loaded read set.',
          { memoryId: ranked.record.memoryId },
        );
      }
    }
  }

  #validateState(
    prepared: PreparedCommit,
    execution: ExecutionRecord,
    head: StateHead | undefined,
    scope: string,
  ): void {
    if (prepared.state === null) {
      return;
    }
    const { snapshot, transition } = prepared.state;
    const nextRevision = prepared.expectedRevision + 1;
    if (
      snapshot.namespace !== execution.request.namespace ||
      snapshot.entityId !== execution.request.entityId ||
      transition.namespace !== execution.request.namespace ||
      transition.entityId !== execution.request.entityId ||
      snapshot.executionId !== prepared.executionId ||
      transition.executionId !== prepared.executionId
    ) {
      invalid('Prepared state scope or execution correlation is invalid.');
    }
    if (
      snapshot.revision !== nextRevision ||
      transition.fromRevision !== prepared.expectedRevision ||
      transition.toRevision !== nextRevision
    ) {
      invalid('Prepared state revisions are not a single revision increment.');
    }
    const computedHash = this.#hashing.sha256(
      this.#hashing.canonicalJson(snapshot.value),
    );
    if (
      snapshot.valueHash !== computedHash ||
      transition.nextHash !== computedHash ||
      transition.previousHash !== (head?.valueHash ?? null)
    ) {
      invalid('Prepared state hash chain is invalid.');
    }
    requireText(transition.transitionId, 'transitionId');
    requireText(transition.operationKey, 'operationKey');
    const priorTransition = this.#store.stateTransitions.get(
      transition.transitionId,
    );
    if (priorTransition !== undefined) {
      corruption('Transition ID collides with persisted state.', {
        transitionId: transition.transitionId,
      });
    }
    const operationIdentity = `${scope}\u0000${transition.operationKey}`;
    if (this.#store.operationKeys.has(operationIdentity)) {
      corruption('Operation key collides with persisted state.', {
        operationKey: transition.operationKey,
      });
    }
  }

  #applyMemory(
    staged: Store,
    prepared: PreparedCommit,
    execution: ExecutionRecord,
  ): void {
    for (const mutation of prepared.memory.mutations) {
      const record = clone(mutation.record, this.#hashing);
      if (
        record.namespace !== execution.request.namespace ||
        record.entityId !== execution.request.entityId
      ) {
        invalid('Memory mutation is outside the execution scope.', {
          memoryId: record.memoryId,
        });
      }
      requireText(record.memoryId, 'memoryId');
      requireText(record.identityKey, 'memory identityKey');
      const identity = scopedIdentity(record);
      if (mutation.action === 'create') {
        if (record.recordVersion !== 1) {
          invalid('Created memory records must start at version 1.', {
            memoryId: record.memoryId,
          });
        }
        if (
          staged.memoryRecords.has(record.memoryId) ||
          staged.memoryIdentities.has(identity)
        ) {
          corruption('Created memory identity collides with persisted data.', {
            memoryId: record.memoryId,
            identityKey: record.identityKey,
          });
        }
        staged.memoryRecords.set(record.memoryId, record);
        staged.memoryIdentities.set(identity, record.memoryId);
        continue;
      }

      const existing = staged.memoryRecords.get(record.memoryId);
      if (existing === undefined) {
        corruption('Updated memory record does not exist.', {
          memoryId: record.memoryId,
        });
      }
      if (existing.recordVersion !== mutation.expectedRecordVersion) {
        memoryConflict(
          record.memoryId,
          mutation.expectedRecordVersion,
          existing.recordVersion,
        );
      }
      if (
        record.recordVersion !== existing.recordVersion + 1 ||
        record.namespace !== existing.namespace ||
        record.entityId !== existing.entityId ||
        record.identityKey !== existing.identityKey ||
        record.kind !== existing.kind ||
        record.schemaVersion !== existing.schemaVersion
      ) {
        invalid('Memory update changed immutable identity or version fields.', {
          memoryId: record.memoryId,
        });
      }
      const indexedId = staged.memoryIdentities.get(identity);
      if (indexedId !== record.memoryId) {
        corruption('Memory identity index is inconsistent.', {
          memoryId: record.memoryId,
        });
      }
      staged.memoryRecords.set(record.memoryId, record);
    }
  }

  #nextId(kind: 'document' | 'event'): string {
    let id: string;
    try {
      id = this.#ids.next(kind);
    } catch (cause) {
      throw new AcmeError(
        {
          code: 'INTERNAL',
          message: `ID generator failed for ${kind}.`,
          stage: 'preparing-commit',
          retryable: false,
        },
        { cause },
      );
    }
    requireText(id, `${kind} ID`);
    return id;
  }
}

export function createInMemoryExecutionRepository(
  options: InMemoryExecutionRepositoryOptions,
): InMemoryExecutionRepository {
  return new InMemoryExecutionRepository(options);
}
