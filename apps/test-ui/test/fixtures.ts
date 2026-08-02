import type {
  AcmeErrorData,
  ExecutionAttempt,
  ExecutionPolicy,
  ExecutionRecord,
  ExecutionReplayEvidence,
  JsonValue,
  MemoryCandidate,
  MemoryRecord,
  ModelCallRecord,
  PreparedCommit,
  ReplayReport,
  StateSnapshot,
  StateTransition,
  StoredDocument,
} from '@acme/core';

/**
 * Handcrafted recorded evidence.
 *
 * These are deliberately literal values, not engine output, so a view test
 * fails when the read model changes rather than when the engine does. The
 * engine-backed proof lives in `tests/integration/test-ui-read-model.test.ts`.
 */

export const executionId = 'exec-view-1';
export const namespace = 'fixture';
export const entityId = 'entity-1';
export const acceptedAt = '2026-01-01T00:00:00.000Z';
export const committedAt = '2026-01-01T00:00:02.000Z';

export const policy: ExecutionPolicy = {
  timeoutMs: 30_000,
  maxModelCalls: 1,
  maxRepairCalls: 1,
  maxRevisionCalls: 0,
  retention: 'hash-only',
};

const request = {
  requestKey: 'request-1',
  namespace,
  task: 'observe',
  entityId,
  expectedRevision: 0,
  input: { text: 'confidential source text' },
  model: { profile: 'offline', providerHint: 'fixture' },
} as const;

export const committedExecution: ExecutionRecord = {
  executionId,
  request,
  requestFingerprint: 'fingerprint-request-1',
  inputHash: 'hash-input-1',
  contract: { id: 'fixture.observe', version: '1.0.0' },
  contractFingerprint: 'fingerprint-contract-1',
  policy,
  status: 'committed',
  currentStage: 'committed',
  result: {
    status: 'committed',
    executionId,
    replayed: false,
    revision: 1,
    documentKeys: ['document-1'],
    eventIds: [],
  },
  createdAt: acceptedAt,
  updatedAt: committedAt,
};

export const attempts: readonly ExecutionAttempt[] = [
  {
    executionId,
    attemptNumber: 1,
    stage: 'loading',
    outcome: 'started',
    occurredAt: acceptedAt,
  },
  {
    executionId,
    attemptNumber: 1,
    stage: 'calling-model',
    outcome: 'started',
    occurredAt: acceptedAt,
  },
  {
    executionId,
    attemptNumber: 1,
    stage: 'validating',
    outcome: 'started',
    occurredAt: acceptedAt,
  },
  {
    executionId,
    attemptNumber: 1,
    stage: 'interpreting',
    outcome: 'started',
    occurredAt: acceptedAt,
  },
  {
    executionId,
    attemptNumber: 1,
    stage: 'evaluating',
    outcome: 'started',
    occurredAt: acceptedAt,
  },
  {
    executionId,
    attemptNumber: 1,
    stage: 'preparing-commit',
    outcome: 'started',
    occurredAt: acceptedAt,
  },
  {
    executionId,
    attemptNumber: 1,
    stage: 'committed',
    outcome: 'succeeded',
    occurredAt: committedAt,
  },
];

/** Retention `hash-only`, so the response is legitimately not stored. */
export const hashOnlyModelCall: ModelCallRecord = {
  modelCallId: 'call-1',
  executionId,
  callKey: 'primary:1',
  attempt: 1,
  purpose: 'primary',
  selection: { profile: 'offline', providerHint: 'fixture' },
  requestHash: 'hash-request-1',
  startedAt: acceptedAt,
  status: 'succeeded',
  responseHash: 'hash-response-1',
  completedAt: committedAt,
};

export const retainedModelCall: ModelCallRecord = {
  ...hashOnlyModelCall,
  response: {
    provider: 'fixture',
    model: 'fixture-json-1',
    receivedAt: committedAt,
    finishReason: 'stop',
    text: '{"fact":"alpha"}',
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    metadata: {},
  },
};

export const ambiguousModelCall: ModelCallRecord = {
  ...hashOnlyModelCall,
  modelCallId: 'call-2',
  callKey: 'primary:2',
  status: 'ambiguous',
  error: {
    code: 'MODEL_UNAVAILABLE',
    message: 'Transport could not prove the request was not sent.',
    stage: 'calling-model',
    retryable: false,
  },
};

const loadedMemory: MemoryRecord = {
  memoryId: 'memory-existing-1',
  namespace,
  entityId,
  identityKey: 'fixture:alpha',
  kind: 'fixture.fact',
  schemaVersion: 'fixture-memory/1',
  value: { fact: 'alpha' },
  strength: 0.5,
  status: 'active',
  firstSeenAt: acceptedAt,
  lastSeenAt: acceptedAt,
  lastReinforcedAt: acceptedAt,
  provenance: [
    {
      executionId: 'exec-view-0',
      contract: { id: 'fixture.observe', version: '1.0.0' },
      documentKeys: ['document-0'],
    },
  ],
  recordVersion: 1,
};

const storedDocument: StoredDocument = {
  documentId: 'document-id-0',
  executionId: 'exec-view-0',
  namespace,
  entityId,
  key: 'document-0',
  kind: 'fixture.source',
  schemaVersion: 'fixture-source/1',
  value: { text: 'previous confidential text' },
  contentHash: 'hash-document-0',
  createdAt: acceptedAt,
};

export const priorSnapshot: StateSnapshot<JsonValue> = {
  namespace,
  entityId,
  schemaVersion: 'fixture-state/1',
  revision: 1,
  value: { count: 1 },
  valueHash: 'hash-state-1',
  createdAt: acceptedAt,
  executionId: 'exec-view-0',
};

export const nextSnapshot: StateSnapshot<JsonValue> = {
  namespace,
  entityId,
  schemaVersion: 'fixture-state/1',
  revision: 2,
  value: { count: 2 },
  valueHash: 'hash-state-2',
  createdAt: committedAt,
  executionId,
};

export const nextTransition: StateTransition<JsonValue> = {
  transitionId: 'transition-2',
  operationKey: 'operation-1',
  namespace,
  entityId,
  fromRevision: 1,
  toRevision: 2,
  deltaSchemaVersion: 'fixture-delta/1',
  delta: { increment: 1 },
  previousHash: 'hash-state-1',
  nextHash: 'hash-state-2',
  executionId,
  createdAt: committedAt,
};

/** A transition whose `previousHash` does not match the prior snapshot. */
export const brokenTransition: StateTransition<JsonValue> = {
  ...nextTransition,
  previousHash: 'hash-state-elsewhere',
};

const createdCandidate: MemoryCandidate = {
  key: 'candidate-created',
  kind: 'fixture.fact',
  schemaVersion: 'fixture-memory/1',
  value: { fact: 'beta' },
  confidence: 0.8,
  source: {
    executionId,
    contract: { id: 'fixture.observe', version: '1.0.0' },
    modelCallId: 'call-1',
    documentKeys: ['document-1'],
  },
};

const ignoredCandidate: MemoryCandidate = {
  key: 'candidate-ignored',
  kind: 'fixture.fact',
  schemaVersion: 'fixture-memory/1',
  value: { fact: 'gamma' },
  source: {
    executionId,
    contract: { id: 'fixture.observe', version: '1.0.0' },
    documentKeys: ['document-1'],
  },
};

const reinforcedCandidate: MemoryCandidate = {
  key: 'candidate-reinforced',
  kind: 'fixture.fact',
  schemaVersion: 'fixture-memory/1',
  value: { fact: 'alpha' },
  source: {
    executionId,
    contract: { id: 'fixture.observe', version: '1.0.0' },
    documentKeys: ['document-1'],
  },
};

const createdRecord: MemoryRecord = {
  memoryId: 'memory-created-1',
  namespace,
  entityId,
  identityKey: 'fixture:beta',
  kind: 'fixture.fact',
  schemaVersion: 'fixture-memory/1',
  value: { fact: 'beta' },
  strength: 0.8,
  status: 'active',
  firstSeenAt: committedAt,
  lastSeenAt: committedAt,
  lastReinforcedAt: committedAt,
  provenance: [createdCandidate.source],
  recordVersion: 1,
};

const reinforcedRecord: MemoryRecord = {
  ...loadedMemory,
  strength: 0.6,
  lastSeenAt: committedAt,
  lastReinforcedAt: committedAt,
  recordVersion: 2,
};

export const preparedCommit: PreparedCommit = {
  executionId,
  expectedRevision: 1,
  operationDigest: 'digest-operation-1',
  documents: [
    {
      key: 'document-1',
      kind: 'fixture.source',
      schemaVersion: 'fixture-source/1',
      value: { text: 'confidential source text' },
      contentHash: 'hash-document-1',
    },
  ],
  // Candidate order is the module's order; decision order must match it.
  memoryCandidates: [createdCandidate, ignoredCandidate, reinforcedCandidate],
  memory: {
    decisions: [
      {
        candidateKey: 'candidate-created',
        identityKey: 'fixture:beta',
        resolution: {
          candidateKey: 'candidate-created',
          action: 'create',
          value: { fact: 'beta' },
          strength: 0.8,
        },
        affectedMemoryIds: ['memory-created-1'],
      },
      {
        candidateKey: 'candidate-ignored',
        identityKey: 'fixture:gamma',
        resolution: {
          candidateKey: 'candidate-ignored',
          action: 'ignore',
          reason: 'below domain confidence floor',
        },
        affectedMemoryIds: [],
      },
      {
        candidateKey: 'candidate-reinforced',
        identityKey: 'fixture:alpha',
        resolution: {
          candidateKey: 'candidate-reinforced',
          action: 'reinforce',
          memoryId: 'memory-existing-1',
          strength: 0.6,
        },
        affectedMemoryIds: ['memory-existing-1'],
      },
    ],
    mutations: [
      { action: 'create', record: createdRecord },
      {
        action: 'update',
        expectedRecordVersion: 1,
        record: reinforcedRecord,
      },
    ],
  },
  state: {
    snapshot: nextSnapshot,
    transition: nextTransition,
  },
  evaluatorRuns: [
    {
      evaluatorId: 'fixture.evaluator',
      evaluatorVersion: '1.0.0',
      attempt: 1,
      subjectHash: 'hash-subject-1',
      decision: { outcome: 'allow', scores: { quality: 1 } },
    },
  ],
  events: [],
  committedAt,
  replayEvidence: {
    taskInput: { text: 'confidential source text' },
    readSet: {
      state: priorSnapshot,
      loadedMemories: [loadedMemory],
      retrievedMemories: [
        { rank: 0, score: 0.5, reasons: ['strength'], record: loadedMemory },
      ],
      documents: [storedDocument],
    },
  },
};

export const replayEvidence: ExecutionReplayEvidence = {
  executionId,
  request,
  requestFingerprint: 'fingerprint-request-1',
  inputHash: 'hash-input-1',
  contract: { id: 'fixture.observe', version: '1.0.0' },
  contractFingerprint: 'fingerprint-contract-1',
  effectivePolicy: policy,
  taskInput: { text: 'confidential source text' },
  readSet: {
    state: priorSnapshot,
    loadedMemories: [loadedMemory],
    retrievedMemories: [
      { rank: 0, score: 0.5, reasons: ['strength'], record: loadedMemory },
    ],
    documents: [storedDocument],
  },
  modelCalls: [hashOnlyModelCall],
  preparedCommit,
};

/** A schema failure inside the bounded response pipeline. */
export const schemaFailure: AcmeErrorData = {
  code: 'MODEL_INVALID_RESPONSE',
  message: 'Model response failed the bounded response pipeline.',
  stage: 'validating',
  retryable: false,
  details: {
    pipelineStage: 'schema',
    repairable: true,
    issues: [
      {
        code: 'MODEL_RESPONSE_SCHEMA',
        path: ['fact'],
        message: 'Expected string, received number.',
        severity: 'error',
      },
    ],
  },
};

/** A non-repairable contract input failure (ADR-0010). */
export const contractInputFailure: AcmeErrorData = {
  code: 'MODEL_INVALID_RESPONSE',
  message: 'Model response failed the bounded response pipeline.',
  stage: 'validating',
  retryable: false,
  details: {
    pipelineStage: 'input',
    repairable: false,
    issues: [
      {
        code: 'CONTRACT_INPUT_SCHEMA',
        path: ['text'],
        message: 'Required.',
        severity: 'error',
      },
    ],
  },
};

/** A prepare-commit failure that does not name its substage. */
export const prepareCommitFailure: AcmeErrorData = {
  code: 'CONFLICT_STATE_REVISION',
  message: 'Expected revision did not match the state head.',
  stage: 'preparing-commit',
  retryable: false,
};

export function failedExecution(error: AcmeErrorData): ExecutionRecord {
  return {
    ...committedExecution,
    status: 'failed',
    currentStage: error.stage,
    result: { status: 'failed', executionId, error },
    error,
    updatedAt: committedAt,
  };
}

export function failedAttempts(
  through: ExecutionAttempt['stage'],
): readonly ExecutionAttempt[] {
  const order = attempts.map((attempt) => attempt.stage);
  const cut = order.indexOf(through);
  return attempts.slice(0, cut + 1);
}

export const matchReport: ReplayReport = {
  executionId,
  mode: 'verify',
  status: 'match',
  recordedDigest: 'digest-operation-1',
  replayDigest: 'digest-operation-1',
  differences: [],
};

export const differentReport: ReplayReport = {
  executionId,
  mode: 'verify',
  status: 'different',
  recordedDigest: 'digest-operation-1',
  replayDigest: 'digest-operation-2',
  differences: [
    {
      code: 'REPLAY_MODEL_RESPONSE_HASH_DIFFERENT',
      severity: 'warning',
      value: { recorded: 'hash-response-1', current: 'hash-response-9' },
    },
  ],
};

export const unavailableReport: ReplayReport = {
  executionId,
  mode: 'verify',
  status: 'unavailable',
  differences: [],
};
