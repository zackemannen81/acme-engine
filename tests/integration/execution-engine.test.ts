import {
  canonicalJson,
  AcmeError,
  computeModelRequestHash,
  createContractRegistry,
  createExecutionEngine,
  createMemoryEngine,
  createModuleRegistry,
  createResponsePipeline,
  createStateEngine,
  deriveExecutionId,
  sha256,
  type AcmeErrorData,
  type ExecutionRequest,
  type ExecutionRepository,
  type IdGenerator,
} from '../../packages/core/src/index.js';
import { createInMemoryExecutionRepository } from '../../packages/adapter-memory/src/index.js';
import { createTestPayloadEncryptor } from '../../packages/testing/src/index.js';
import { createScriptedModelGateway } from '../../packages/adapter-model-mock/src/index.js';
import { describe, expect, it, vi } from 'vitest';

import {
  neutralContract,
  neutralInput,
  neutralModule,
  neutralNow,
  neutralResponse,
  neutralSelection,
} from '../fixtures/neutral-execution.js';
import { processLossAt } from '../fixtures/process-loss.js';

function createIds() {
  const counts = {
    call: 0,
    document: 0,
    event: 0,
    memory: 0,
  };
  const next = vi.fn((kind: Parameters<IdGenerator['next']>[0]) => {
    if (kind === 'execution') {
      throw new Error('Execution IDs must be derived.');
    }
    counts[kind] += 1;
    return `${kind}-${counts[kind]}`;
  });
  return { ids: { next } satisfies IdGenerator, next };
}

function request(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    requestKey: 'neutral-request-1',
    namespace: 'neutral',
    task: 'observe',
    entityId: 'neutral-entity-1',
    expectedRevision: 0,
    input: neutralInput,
    model: neutralSelection,
    policy: { retention: 'encrypted-payload' },
    ...overrides,
  };
}

function fixture(
  options: {
    readonly request?: ExecutionRequest;
    readonly responseText?: string;
    readonly calls?: boolean;
    readonly additionalRequests?: readonly ExecutionRequest[];
    readonly modelError?: AcmeErrorData;
  } = {},
) {
  const executionRequest = options.request ?? request();
  const scriptedRequests = [
    executionRequest,
    ...(options.additionalRequests ?? []),
  ];
  const executionId = deriveExecutionId(
    executionRequest.namespace,
    executionRequest.requestKey,
  );
  const gateway = createScriptedModelGateway({
    profiles: [
      {
        selection: neutralSelection,
        capabilities: {
          structuredOutput: true,
          tools: false,
          vision: false,
        },
      },
    ],
    calls:
      options.calls === false
        ? []
        : scriptedRequests.map((scriptedRequest) => {
            const scriptedExecutionId = deriveExecutionId(
              scriptedRequest.namespace,
              scriptedRequest.requestKey,
            );
            return {
              executionId: scriptedExecutionId,
              callKey: 'model:0',
              selection: neutralSelection,
              expectedRequestHash: computeModelRequestHash(
                neutralContract.buildRequest(neutralInput, {
                  executionId: scriptedExecutionId,
                  now: neutralNow,
                }),
              ),
              outcome:
                options.modelError === undefined
                  ? {
                      kind: 'response' as const,
                      response: {
                        ...neutralResponse,
                        text: options.responseText ?? neutralResponse.text,
                      },
                    }
                  : { kind: 'error' as const, error: options.modelError },
            };
          }),
  });
  const id = createIds();
  const repository = createInMemoryExecutionRepository({
    ids: id.ids,
    payloadEncryptor: createTestPayloadEncryptor(),
  });
  const clock = { now: vi.fn(() => neutralNow) };
  const engine = createExecutionEngine({
    clock,
    ids: id.ids,
    modules: createModuleRegistry([neutralModule]),
    contracts: createContractRegistry([neutralContract]),
    pipeline: createResponsePipeline(),
    gateway,
    memory: createMemoryEngine({ ids: id.ids }),
    state: createStateEngine(),
    repository,
  });
  return {
    engine,
    gateway,
    repository,
    request: executionRequest,
    executionId,
    ids: id.next,
    clock: clock.now,
  };
}

function engineOver(options: {
  readonly repository: ExecutionRepository;
  readonly ids: IdGenerator;
  readonly gateway: Parameters<typeof createExecutionEngine>[0]['gateway'];
}) {
  return createExecutionEngine({
    clock: { now: () => neutralNow },
    ids: options.ids,
    modules: createModuleRegistry([neutralModule]),
    contracts: createContractRegistry([neutralContract]),
    pipeline: createResponsePipeline(),
    gateway: options.gateway,
    memory: createMemoryEngine({ ids: options.ids }),
    state: createStateEngine(),
    repository: options.repository,
  });
}

const forbiddenGateway = {
  async capabilities() {
    throw new Error('Resume invoked gateway capabilities.');
  },
  async generate() {
    throw new Error('Resume invoked the provider.');
  },
} as unknown as Parameters<typeof createExecutionEngine>[0]['gateway'];

describe('ExecutionEngine neutral integration', () => {
  it('commits once, reuses the terminal result, and replay-verifies without effects', async () => {
    const subject = fixture();
    const first = await subject.engine.execute(subject.request);
    expect(first).toEqual({
      status: 'committed',
      executionId: subject.executionId,
      replayed: false,
      revision: 1,
      documentKeys: ['neutral-document-1'],
      eventIds: [],
    });
    expect(subject.gateway.invocations()).toHaveLength(1);
    expect(subject.ids.mock.calls.map(([kind]) => kind)).toEqual([
      'call',
      'memory',
      'document',
    ]);

    const beforeReplay = subject.repository.snapshot();
    const forbiddenNext = vi.fn((): string => {
      throw new Error('Replay invoked the external ID generator.');
    });
    const forbiddenClock = vi.fn((): string => {
      throw new Error('Replay invoked the external clock.');
    });
    const forbiddenCapabilities = vi.fn(async () => {
      throw new Error('Replay invoked gateway capabilities.');
    });
    const forbiddenGenerate = vi.fn(async () => {
      throw new Error('Replay invoked gateway generation.');
    });
    const replayEngine = createExecutionEngine({
      clock: { now: forbiddenClock },
      ids: { next: forbiddenNext },
      modules: createModuleRegistry([neutralModule]),
      contracts: createContractRegistry([neutralContract]),
      pipeline: createResponsePipeline(),
      gateway: {
        capabilities: forbiddenCapabilities,
        generate: forbiddenGenerate,
      },
      memory: createMemoryEngine({ ids: { next: forbiddenNext } }),
      state: createStateEngine(),
      repository: subject.repository,
    });
    const replay = await replayEngine.replayVerify(subject.executionId);
    expect(replay).toMatchObject({
      status: 'match',
      recordedDigest: expect.any(String),
      replayDigest: expect.any(String),
    });
    expect(replay.recordedDigest).toBe(replay.replayDigest);
    expect(subject.gateway.invocations()).toHaveLength(1);
    expect(subject.ids).toHaveBeenCalledTimes(3);
    expect(forbiddenNext).not.toHaveBeenCalled();
    expect(forbiddenClock).not.toHaveBeenCalled();
    expect(forbiddenCapabilities).not.toHaveBeenCalled();
    expect(forbiddenGenerate).not.toHaveBeenCalled();
    expect(subject.repository.snapshot()).toEqual(beforeReplay);

    const repeated = await subject.engine.execute({
      ...subject.request,
      policy: {
        timeoutMs: 90_000,
        maxInputTokens: 1_000,
        retention: 'none',
      },
    });
    expect(repeated).toEqual({ ...first, replayed: true });
    expect(subject.gateway.invocations()).toHaveLength(1);
    expect(subject.ids).toHaveBeenCalledTimes(3);
    expect(subject.repository.snapshot()).toEqual(beforeReplay);
  });

  it('rejects invalid input before repository, gateway, clock, or ID effects', async () => {
    const subject = fixture({ calls: false });
    await expect(
      subject.engine.execute({
        ...subject.request,
        input: { documentKey: '', text: '' },
      }),
    ).rejects.toMatchObject({
      data: { code: 'INVALID_REQUEST', stage: 'accepted' },
    });
    await expect(
      subject.engine.execute({
        ...subject.request,
        policy: { maxRepairCalls: 1 },
      }),
    ).rejects.toMatchObject({
      data: { code: 'INVALID_REQUEST', stage: 'accepted' },
    });
    await expect(
      subject.engine.execute({
        ...subject.request,
        policy: { maxRevisionCalls: 1 },
      }),
    ).rejects.toMatchObject({
      data: { code: 'INVALID_REQUEST', stage: 'accepted' },
    });
    expect(subject.repository.snapshot().executions).toEqual([]);
    expect(subject.gateway.invocations()).toEqual([]);
    expect(subject.ids).not.toHaveBeenCalled();
    expect(subject.clock).not.toHaveBeenCalled();
  });

  it('resolves module, task, and contract before acceptance effects', async () => {
    const subject = fixture({ calls: false });
    await expect(
      subject.engine.execute({
        ...subject.request,
        namespace: 'missing-module',
      }),
    ).rejects.toMatchObject({
      data: { code: 'NOT_FOUND_MODULE', stage: 'accepted' },
    });
    await expect(
      subject.engine.execute({
        ...subject.request,
        task: 'missing-task',
      }),
    ).rejects.toMatchObject({
      data: { code: 'NOT_FOUND_TASK', stage: 'accepted' },
    });

    const missingContractModule = {
      ...neutralModule,
      tasks: {
        observe: {
          ...neutralModule.tasks.observe,
          contract: { id: 'missing.contract', version: '1.0.0' },
        },
      },
    };
    const missingContractEngine = createExecutionEngine({
      clock: { now: subject.clock },
      ids: { next: subject.ids as unknown as IdGenerator['next'] },
      modules: createModuleRegistry([missingContractModule]),
      contracts: createContractRegistry([neutralContract]),
      pipeline: createResponsePipeline(),
      gateway: subject.gateway,
      memory: createMemoryEngine({
        ids: { next: subject.ids as unknown as IdGenerator['next'] },
      }),
      state: createStateEngine(),
      repository: subject.repository,
    });
    await expect(
      missingContractEngine.execute(subject.request),
    ).rejects.toMatchObject({
      data: { code: 'NOT_FOUND_CONTRACT', stage: 'accepted' },
    });

    expect(subject.repository.snapshot().executions).toEqual([]);
    expect(subject.gateway.invocations()).toEqual([]);
    expect(subject.ids).not.toHaveBeenCalled();
    expect(subject.clock).not.toHaveBeenCalled();
  });

  it('maps stale revision before the model call and invalid output before canonical effects', async () => {
    const stale = fixture({
      request: request({
        requestKey: 'neutral-stale',
        expectedRevision: 1,
      }),
      calls: false,
    });
    await expect(stale.engine.execute(stale.request)).resolves.toMatchObject({
      status: 'conflicted',
      error: { code: 'CONFLICT_STATE_REVISION' },
    });
    expect(stale.gateway.invocations()).toEqual([]);
    expect(stale.repository.snapshot()).toMatchObject({
      documents: [],
      memoryRecords: [],
      state: { snapshots: [] },
    });

    const invalidOutput = fixture({ responseText: '{}' });
    await expect(
      invalidOutput.engine.execute(invalidOutput.request),
    ).resolves.toMatchObject({
      status: 'failed',
      error: { code: 'MODEL_INVALID_RESPONSE', stage: 'validating' },
    });
    expect(invalidOutput.gateway.invocations()).toHaveLength(1);
    expect(invalidOutput.repository.snapshot()).toMatchObject({
      documents: [],
      memoryRecords: [],
      state: { snapshots: [] },
      modelCalls: [{ status: 'succeeded' }],
    });
  });

  it('durably records a structured primary-call failure before terminal mapping', async () => {
    const subject = fixture({
      modelError: {
        code: 'MODEL_UNAVAILABLE',
        message: 'fixture unavailable',
        stage: 'calling-model',
        retryable: true,
      },
    });
    await expect(
      subject.engine.execute(subject.request),
    ).resolves.toMatchObject({
      status: 'failed',
      error: {
        code: 'MODEL_UNAVAILABLE',
        stage: 'calling-model',
        retryable: true,
      },
    });
    expect(subject.repository.snapshot()).toMatchObject({
      modelCalls: [
        {
          callKey: 'model:0',
          status: 'failed',
          error: { code: 'MODEL_UNAVAILABLE' },
        },
      ],
      documents: [],
      memoryRecords: [],
      state: { snapshots: [] },
    });
  });

  it('maps a commit-time memory conflict without exposing partial effects', async () => {
    const subject = fixture();
    const base = subject.repository;
    const rejectingRepository: ExecutionRepository = {
      accept: base.accept.bind(base),
      get: base.get.bind(base),
      appendAttempt: base.appendAttempt.bind(base),
      reserveModelCall: base.reserveModelCall.bind(base),
      completeModelCall: base.completeModelCall.bind(base),
      failModelCall: base.failModelCall.bind(base),
      loadContext: base.loadContext.bind(base),
      loadResumeState: base.loadResumeState.bind(base),
      markTerminal: base.markTerminal.bind(base),
      loadReplayEvidence: base.loadReplayEvidence.bind(base),
      leaseOutbox: base.leaseOutbox.bind(base),
      markOutboxDelivered: base.markOutboxDelivered.bind(base),
      markOutboxFailed: base.markOutboxFailed.bind(base),
      listOutbox: base.listOutbox.bind(base),
      async commit() {
        throw new AcmeError({
          code: 'CONFLICT_MEMORY_VERSION',
          message: 'fixture memory conflict',
          stage: 'preparing-commit',
          retryable: false,
        });
      },
    };
    const engine = createExecutionEngine({
      clock: { now: () => neutralNow },
      ids: { next: subject.ids as unknown as IdGenerator['next'] },
      modules: createModuleRegistry([neutralModule]),
      contracts: createContractRegistry([neutralContract]),
      pipeline: createResponsePipeline(),
      gateway: subject.gateway,
      memory: createMemoryEngine({
        ids: { next: subject.ids as unknown as IdGenerator['next'] },
      }),
      state: createStateEngine(),
      repository: rejectingRepository,
    });

    await expect(engine.execute(subject.request)).resolves.toMatchObject({
      status: 'conflicted',
      error: { code: 'CONFLICT_MEMORY_VERSION' },
    });
    expect(base.snapshot()).toMatchObject({
      executions: [{ status: 'conflicted' }],
      documents: [],
      memoryCandidates: [],
      memoryRecords: [],
      state: { snapshots: [], transitions: [] },
      events: [],
      outbox: [],
    });
  });

  it('conflicts changed model identity and makes hash-only replay unavailable', async () => {
    const subject = fixture();
    await subject.engine.execute(subject.request);
    await expect(
      subject.engine.execute({
        ...subject.request,
        model: { profile: 'changed-model' },
      }),
    ).resolves.toMatchObject({
      status: 'conflicted',
      error: { code: 'CONFLICT_IDEMPOTENCY_KEY' },
    });
    expect(subject.gateway.invocations()).toHaveLength(1);

    const hashOnly = fixture({
      request: request({
        requestKey: 'neutral-hash-only',
        policy: { retention: 'hash-only' },
      }),
    });
    const result = await hashOnly.engine.execute(hashOnly.request);
    expect(result.status).toBe('committed');
    await expect(
      hashOnly.engine.replayVerify(hashOnly.executionId),
    ).resolves.toMatchObject({
      status: 'unavailable',
      differences: [{ code: 'REPLAY_MODEL_RESPONSE_UNAVAILABLE' }],
    });
  });

  it('replays the recorded retrieval set after canonical memory changes', async () => {
    const second = request({
      requestKey: 'neutral-request-2',
      expectedRevision: 1,
    });
    const subject = fixture({ additionalRequests: [second] });
    await expect(
      subject.engine.execute(subject.request),
    ).resolves.toMatchObject({
      status: 'committed',
      revision: 1,
    });
    const recorded = await subject.repository.loadReplayEvidence(
      subject.executionId,
    );
    expect(recorded?.readSet.loadedMemories).toEqual([]);
    expect(recorded?.readSet.retrievedMemories).toEqual([]);

    await expect(subject.engine.execute(second)).resolves.toMatchObject({
      status: 'committed',
      revision: 2,
    });
    expect(subject.repository.snapshot().memoryRecords).toMatchObject([
      { memoryId: 'memory-1', recordVersion: 2, strength: 0.9 },
    ]);

    await expect(
      subject.engine.replayVerify(subject.executionId),
    ).resolves.toMatchObject({
      status: 'match',
      differences: [],
    });
    expect(
      await subject.repository.loadReplayEvidence(subject.executionId),
    ).toEqual(recorded);
    expect(subject.gateway.invocations()).toHaveLength(2);
  });

  it('reports a different operation digest when current task behavior diverges', async () => {
    const subject = fixture();
    await subject.engine.execute(subject.request);
    const originalTask = neutralModule.tasks.observe;
    const changedTask = {
      ...originalTask,
      async interpret(...args: Parameters<typeof originalTask.interpret>) {
        const result = await originalTask.interpret(...args);
        const changedValue = { text: 'changed during replay' };
        return {
          ...result,
          documents: result.documents.map((document) => ({
            ...document,
            value: changedValue,
            contentHash: sha256(canonicalJson(changedValue)),
          })),
        };
      },
    };
    const changedModule = {
      ...neutralModule,
      tasks: { observe: changedTask },
    };
    const forbiddenIds: IdGenerator = {
      next() {
        throw new Error('Replay must not allocate external IDs.');
      },
    };
    const replayEngine = createExecutionEngine({
      clock: {
        now() {
          throw new Error('Replay must use recorded time.');
        },
      },
      ids: forbiddenIds,
      modules: createModuleRegistry([changedModule]),
      contracts: createContractRegistry([neutralContract]),
      pipeline: createResponsePipeline(),
      gateway: subject.gateway,
      memory: createMemoryEngine({ ids: forbiddenIds }),
      state: createStateEngine(),
      repository: subject.repository,
    });

    await expect(
      replayEngine.replayVerify(subject.executionId),
    ).resolves.toMatchObject({
      status: 'different',
      recordedDigest: expect.any(String),
      replayDigest: expect.any(String),
      differences: [{ code: 'REPLAY_OPERATION_DIGEST_DIFFERENT' }],
    });
    expect(subject.gateway.invocations()).toHaveLength(1);
  });

  it('resumes an interrupted execution from the recorded model call', async () => {
    const clean = fixture();
    const cleanResult = await clean.engine.execute(clean.request);
    const cleanDigest = (
      await clean.repository.loadReplayEvidence(clean.executionId)
    )?.preparedCommit.operationDigest;

    const subject = fixture();
    const interrupted = engineOver({
      repository: processLossAt(subject.repository, 'commit'),
      ids: { next: subject.ids as unknown as IdGenerator['next'] },
      gateway: subject.gateway,
    });
    await expect(interrupted.execute(subject.request)).rejects.toThrow(
      'Simulated process loss.',
    );
    expect(subject.gateway.invocations()).toHaveLength(1);
    expect(subject.repository.snapshot()).toMatchObject({
      executions: [{ status: 'preparing-commit' }],
      modelCalls: [{ callKey: 'model:0', status: 'succeeded' }],
      documents: [],
      memoryRecords: [],
      state: { snapshots: [] },
    });

    const resumed = engineOver({
      repository: subject.repository,
      ids: createIds().ids,
      gateway: forbiddenGateway,
    });
    await expect(resumed.execute(subject.request)).resolves.toEqual(
      cleanResult,
    );
    expect(subject.gateway.invocations()).toHaveLength(1);
    expect(
      (await subject.repository.loadReplayEvidence(subject.executionId))
        ?.preparedCommit.operationDigest,
    ).toBe(cleanDigest);
    // The resumed run is a separate attempt, so the ledger never claims one
    // uninterrupted pass.
    expect(
      subject.repository
        .snapshot()
        .attempts.map((attempt) => attempt.attemptNumber),
    ).toContain(2);
  });

  it('refuses to resume when retention kept no readable response', async () => {
    const subject = fixture({
      request: request({
        requestKey: 'neutral-resume-hash-only',
        policy: { retention: 'hash-only' },
      }),
    });
    const interrupted = engineOver({
      repository: processLossAt(subject.repository, 'commit'),
      ids: { next: subject.ids as unknown as IdGenerator['next'] },
      gateway: subject.gateway,
    });
    await expect(interrupted.execute(subject.request)).rejects.toThrow(
      'Simulated process loss.',
    );

    const resumed = engineOver({
      repository: subject.repository,
      ids: createIds().ids,
      gateway: forbiddenGateway,
    });
    await expect(resumed.execute(subject.request)).resolves.toMatchObject({
      status: 'failed',
      error: {
        code: 'RESUME_EVIDENCE_UNAVAILABLE',
        stage: 'calling-model',
        retryable: false,
      },
    });
    expect(subject.gateway.invocations()).toHaveLength(1);
    expect(subject.repository.snapshot()).toMatchObject({
      documents: [],
      memoryRecords: [],
      state: { snapshots: [] },
    });
  });

  it('refuses to resume a reservation whose outcome was never observed', async () => {
    const subject = fixture();
    const interrupted = engineOver({
      repository: processLossAt(subject.repository, 'completeModelCall'),
      ids: { next: subject.ids as unknown as IdGenerator['next'] },
      gateway: subject.gateway,
    });
    await expect(interrupted.execute(subject.request)).rejects.toThrow(
      'Simulated process loss.',
    );
    expect(subject.gateway.invocations()).toHaveLength(1);
    expect(subject.repository.snapshot()).toMatchObject({
      modelCalls: [{ callKey: 'model:0', status: 'reserved' }],
    });

    const resumed = engineOver({
      repository: subject.repository,
      ids: createIds().ids,
      gateway: forbiddenGateway,
    });
    await expect(resumed.execute(subject.request)).resolves.toMatchObject({
      status: 'failed',
      error: {
        code: 'MODEL_UNAVAILABLE',
        stage: 'calling-model',
        retryable: false,
      },
    });
    expect(subject.gateway.invocations()).toHaveLength(1);
  });

  it('re-raises a recorded model-call failure instead of calling again', async () => {
    const subject = fixture({
      modelError: {
        code: 'MODEL_UNAVAILABLE',
        message: 'fixture provider outage',
        stage: 'calling-model',
        retryable: true,
      },
    });
    // The terminal write is the only thing lost, so the recorded failure
    // survives without a terminal execution result.
    const interrupted = engineOver({
      repository: processLossAt(subject.repository),
      ids: { next: subject.ids as unknown as IdGenerator['next'] },
      gateway: subject.gateway,
    });
    await expect(interrupted.execute(subject.request)).rejects.toThrow(
      'Simulated process loss.',
    );
    expect(subject.repository.snapshot()).toMatchObject({
      modelCalls: [{ status: 'failed', error: { code: 'MODEL_UNAVAILABLE' } }],
    });

    const resumed = engineOver({
      repository: subject.repository,
      ids: createIds().ids,
      gateway: forbiddenGateway,
    });
    await expect(resumed.execute(subject.request)).resolves.toMatchObject({
      status: 'failed',
      error: {
        code: 'MODEL_UNAVAILABLE',
        message: 'fixture provider outage',
        stage: 'calling-model',
      },
    });
    expect(subject.gateway.invocations()).toHaveLength(1);
  });

  it('never retries a model call recorded as ambiguous', async () => {
    const subject = fixture({
      modelError: {
        code: 'TIMEOUT',
        message: 'fixture timeout after dispatch',
        stage: 'calling-model',
        retryable: true,
      },
    });
    const base = subject.repository;
    // The engine records `ambiguous: false` today; force the ADR-0014 outcome
    // a provider adapter reports when delivery cannot be disproven.
    const ambiguous: ExecutionRepository = {
      ...processLossAt(base),
      failModelCall: async (call) =>
        base.failModelCall({ ...call, ambiguous: true }),
    };
    const interrupted = engineOver({
      repository: ambiguous,
      ids: { next: subject.ids as unknown as IdGenerator['next'] },
      gateway: subject.gateway,
    });
    await expect(interrupted.execute(subject.request)).rejects.toThrow(
      'Simulated process loss.',
    );
    expect(base.snapshot()).toMatchObject({
      modelCalls: [{ status: 'ambiguous' }],
    });

    const resumed = engineOver({
      repository: base,
      ids: createIds().ids,
      gateway: forbiddenGateway,
    });
    await expect(resumed.execute(subject.request)).resolves.toMatchObject({
      status: 'failed',
      error: { code: 'TIMEOUT', stage: 'calling-model' },
    });
    expect(subject.gateway.invocations()).toHaveLength(1);
  });

  it('runs from the beginning when the crash preceded any reservation', async () => {
    const subject = fixture();
    const interrupted = engineOver({
      repository: processLossAt(subject.repository, 'reserveModelCall'),
      ids: { next: subject.ids as unknown as IdGenerator['next'] },
      gateway: subject.gateway,
    });
    await expect(interrupted.execute(subject.request)).rejects.toThrow(
      'Simulated process loss.',
    );
    expect(subject.gateway.invocations()).toHaveLength(0);
    expect(subject.repository.snapshot().modelCalls).toEqual([]);

    const resumed = engineOver({
      repository: subject.repository,
      ids: createIds().ids,
      gateway: subject.gateway,
    });
    await expect(resumed.execute(subject.request)).resolves.toMatchObject({
      status: 'committed',
      revision: 1,
    });
    expect(subject.gateway.invocations()).toHaveLength(1);
  });

  it('detaches, deeply freezes, and reuses the same validated task input', async () => {
    const executionRequest = request({
      requestKey: 'neutral-immutable-input',
      input: {
        documentKey: 'neutral-document-1',
        text: 'Alpha is stable.',
      },
    });
    const subject = fixture({ request: executionRequest });
    const originalTask = neutralModule.tasks.observe;
    let projectedInput: unknown;
    let interpretedInput: unknown;
    const observingTask = {
      ...originalTask,
      project(...args: Parameters<typeof originalTask.project>) {
        [projectedInput] = args;
        return originalTask.project(...args);
      },
      interpret(...args: Parameters<typeof originalTask.interpret>) {
        [, interpretedInput] = args;
        return originalTask.interpret(...args);
      },
    };
    const observingEngine = createExecutionEngine({
      clock: { now: () => neutralNow },
      ids: {
        next: subject.ids as unknown as IdGenerator['next'],
      },
      modules: createModuleRegistry([
        { ...neutralModule, tasks: { observe: observingTask } },
      ]),
      contracts: createContractRegistry([neutralContract]),
      pipeline: createResponsePipeline(),
      gateway: subject.gateway,
      memory: createMemoryEngine({
        ids: { next: subject.ids as unknown as IdGenerator['next'] },
      }),
      state: createStateEngine(),
      repository: subject.repository,
    });
    const callerInput = executionRequest.input as {
      documentKey: string;
      text: string;
    };
    const completion = observingEngine.execute(executionRequest);
    callerInput.text = 'caller mutation after acceptance started';
    await expect(completion).resolves.toMatchObject({ status: 'committed' });

    expect(projectedInput).toBe(interpretedInput);
    expect(projectedInput).not.toBe(callerInput);
    expect(projectedInput).toEqual(neutralInput);
    expect(Object.isFrozen(projectedInput)).toBe(true);
  });
});
