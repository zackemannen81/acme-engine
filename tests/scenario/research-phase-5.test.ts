import {
  ACME_MEMORY_RETRIEVAL_LIMIT,
  computeModelRequestHash,
  computeModelResponseHash,
  createContractRegistry,
  createExecutionEngine,
  createMemoryEngine,
  createModuleRegistry,
  createResponsePipeline,
  createStateEngine,
  deriveExecutionId,
  type ExecutionReadContext,
  type ExecutionRepository,
  type ExecutionRequest,
  type IdGenerator,
  type NormalizedModelResponse,
} from '../../packages/core/src/index.js';
import { createInMemoryExecutionRepository } from '../../packages/adapter-memory/src/index.js';
import { createScriptedModelGateway } from '../../packages/adapter-model-mock/src/index.js';
import {
  RESEARCH_STATE_SCHEMA_VERSION,
  researchModule,
  researchObserveEvidenceContract,
  researchObserveEvidenceTask,
  type ResearchContractOutput,
  type ResearchEvidenceInput,
  type ResearchState,
} from '../../packages/module-research/src/index.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const now = '2026-07-31T12:00:00.000Z';
const responseNow = '2026-07-31T12:00:01.000Z';
const entityId = 'research-topic-phase-5';
const namespace = 'research';
const task = 'observe-evidence';

const selection = Object.freeze({
  profile: 'offline-json',
  providerHint: 'fixture',
  modelHint: 'fixture-json-1',
});

const PROPOSITION = 'Water boils at 100 °C at standard atmospheric pressure.';
const SUPPORTING = 'Water boils at 100 °C at standard atmospheric pressure.';
const CONTRADICTING = 'Water boils at 93 °C at standard atmospheric pressure.';
const QUESTION = 'Does altitude change the measurement?';

/** Three hand-written offline sources. No URI is ever dereferenced. */
const sourceA: ResearchEvidenceInput = Object.freeze({
  documentKey: 'research-phase-5-a',
  source: Object.freeze({
    uri: 'https://alpha.example.org/reports/boiling?id=1',
    title: 'Alpha boiling-point report',
    retrievedAt: '2026-07-30T08:00:00.000Z',
    publisher: 'Alpha Institute Press',
    independence: Object.freeze({
      authority: 'Alpha Institute',
      basis: 'publisher' as const,
    }),
  }),
  text: 'Alpha measured that water boils at 100 °C at standard atmospheric pressure.',
});

const sourceB: ResearchEvidenceInput = Object.freeze({
  documentKey: 'research-phase-5-b',
  source: Object.freeze({
    uri: 'https://beta.example.net/notes/boiling',
    retrievedAt: '2026-07-30T10:00:00.000Z',
    publisher: 'Beta Journal',
    independence: Object.freeze({
      authority: 'Beta Journal',
      basis: 'publisher' as const,
    }),
  }),
  text: 'Beta confirmed that water boils at 100 °C at standard atmospheric pressure.',
});

const sourceC: ResearchEvidenceInput = Object.freeze({
  documentKey: 'research-phase-5-c',
  source: Object.freeze({
    uri: 'https://gamma.example.com/review/boiling',
    retrievedAt: '2026-07-30T11:00:00.000Z',
    publisher: 'Gamma Review',
    independence: Object.freeze({
      authority: 'Gamma Review',
      basis: 'editorial-group' as const,
    }),
  }),
  text: 'Gamma reported that water boils at 93 °C at standard atmospheric pressure.',
});

const outputA: ResearchContractOutput = {
  claims: [
    {
      proposition: PROPOSITION,
      statement: SUPPORTING,
      position: 'supports',
      evidenceQuote: 'water boils at 100 °C at standard atmospheric pressure',
      sourceLocator: 'paragraph 1',
      confidence: 0.9,
    },
  ],
  openQuestions: [QUESTION],
};

const outputB: ResearchContractOutput = {
  claims: [
    {
      proposition: PROPOSITION,
      statement: SUPPORTING,
      position: 'supports',
      evidenceQuote: 'water boils at 100 °C at standard atmospheric pressure',
      confidence: 0.85,
    },
  ],
  openQuestions: [],
};

const outputC: ResearchContractOutput = {
  claims: [
    {
      proposition: PROPOSITION,
      statement: CONTRADICTING,
      position: 'contradicts',
      evidenceQuote: 'water boils at 93 °C at standard atmospheric pressure',
      confidence: 0.8,
    },
  ],
  openQuestions: [],
};

function createIds() {
  const counts = { call: 0, document: 0, memory: 0 };
  const next = vi.fn((kind: Parameters<IdGenerator['next']>[0]) => {
    switch (kind) {
      case 'execution':
        throw new Error('Execution ID must be derived.');
      case 'event':
        throw new Error('Research Phase 5 emits no event.');
      case 'call':
      case 'document':
      case 'memory':
        counts[kind] += 1;
        return `${kind}-research-phase-5-${String(counts[kind]).padStart(3, '0')}`;
    }
  });
  return { ids: { next } satisfies IdGenerator, next };
}

function request(
  requestKey: string,
  input: ResearchEvidenceInput,
  expectedRevision: number,
): ExecutionRequest<ResearchEvidenceInput> {
  return {
    requestKey,
    namespace,
    task,
    entityId,
    expectedRevision,
    input,
    model: selection,
    policy: { retention: 'encrypted-payload' as const },
  };
}

function scriptedResponse(
  output: ResearchContractOutput,
  fixture: string,
): NormalizedModelResponse {
  return Object.freeze({
    provider: 'fixture',
    model: 'fixture-json-1',
    providerResponseId: `fixture-response-${fixture}`,
    receivedAt: responseNow,
    finishReason: 'stop' as const,
    text: JSON.stringify(output),
    usage: Object.freeze({
      inputTokens: 140,
      outputTokens: 110,
      totalTokens: 250,
    }),
    metadata: Object.freeze({ fixture }),
  });
}

/**
 * Reproduces the read path the ExecutionEngine will take, so the scripted
 * gateway can pin an exact request hash for a step whose contract input
 * depends on everything the earlier steps committed.
 */
async function expectedRequestHash(
  repository: ExecutionRepository,
  executionId: string,
  input: ResearchEvidenceInput,
  expectedRevision: number,
): Promise<string> {
  const query = {
    namespace,
    entityId,
    task,
    limit: ACME_MEMORY_RETRIEVAL_LIMIT,
  };
  const loaded = await repository.loadContext({
    namespace,
    entityId,
    expectedRevision,
    memory: query,
  });
  const ranked = createMemoryEngine({
    ids: {
      next() {
        throw new Error('Retrieval must not allocate IDs.');
      },
    },
  }).retrieve(researchModule.memoryPolicy, query, loaded.memories);
  const context: ExecutionReadContext<ResearchState> = {
    executionId,
    entityId,
    now,
    state: loaded.state as ExecutionReadContext<ResearchState>['state'],
    memories: ranked.map(({ record }) => record),
    documents: loaded.documents,
  };
  const contractInput = await researchObserveEvidenceTask.project(
    input,
    context,
  );
  return computeModelRequestHash(
    researchObserveEvidenceContract.buildRequest(contractInput, {
      executionId,
      now,
    }),
  );
}

interface Harness {
  readonly repository: ReturnType<typeof createInMemoryExecutionRepository>;
  readonly ids: ReturnType<typeof createIds>;
}

function createEngine(
  harness: Harness,
  gateway: ReturnType<typeof createScriptedModelGateway>,
) {
  return createExecutionEngine({
    clock: { now: () => now },
    ids: harness.ids.ids,
    modules: createModuleRegistry([researchModule]),
    contracts: createContractRegistry([researchObserveEvidenceContract]),
    pipeline: createResponsePipeline(),
    gateway,
    memory: createMemoryEngine({ ids: harness.ids.ids }),
    state: createStateEngine(),
    repository: harness.repository,
  });
}

async function observe(
  harness: Harness,
  options: {
    readonly requestKey: string;
    readonly input: ResearchEvidenceInput;
    readonly expectedRevision: number;
    readonly output: ResearchContractOutput;
    readonly fixture: string;
  },
) {
  const executionId = deriveExecutionId(namespace, options.requestKey);
  const gateway = createScriptedModelGateway({
    profiles: [
      {
        selection,
        capabilities: { structuredOutput: true, tools: false, vision: false },
      },
    ],
    calls: [
      {
        executionId,
        callKey: 'model:0',
        selection,
        expectedRequestHash: await expectedRequestHash(
          harness.repository,
          executionId,
          options.input,
          options.expectedRevision,
        ),
        outcome: {
          kind: 'response',
          response: scriptedResponse(options.output, options.fixture),
        },
      },
    ],
  });
  const engine = createEngine(harness, gateway);
  const executionRequest = request(
    options.requestKey,
    options.input,
    options.expectedRevision,
  );
  const result = await engine.execute(executionRequest);
  return { executionId, gateway, engine, request: executionRequest, result };
}

function researchState(
  harness: Harness,
  revision: number,
): ResearchState | undefined {
  const snapshot = harness.repository
    .snapshot()
    .state.snapshots.find((entry) => entry.revision === revision);
  return snapshot?.value as ResearchState | undefined;
}

describe('ResearchModule Phase 5 offline acceptance', () => {
  let harness: Harness;

  beforeEach(() => {
    const ids = createIds();
    harness = {
      ids,
      repository: createInMemoryExecutionRepository({ ids: ids.ids }),
    };
  });

  it('defers on one source, verifies on an independent second, and contests on a contradiction', async () => {
    const stepA = await observe(harness, {
      requestKey: 'research-phase-5-a',
      input: sourceA,
      expectedRevision: 0,
      output: outputA,
      fixture: 'research-phase-5-a',
    });
    expect(stepA.result).toEqual({
      status: 'committed',
      executionId: stepA.executionId,
      replayed: false,
      revision: 1,
      documentKeys: ['research-phase-5-a'],
      eventIds: [],
    });
    expect(stepA.gateway.invocations()).toHaveLength(1);

    // One source can never verify, however confident the model was.
    expect(researchState(harness, 1)).toEqual({
      identityPolicyVersion: 'research-identity-policy/1',
      verificationThreshold: 2,
      verifiedClaims: [],
      contestedClaims: [],
      openQuestions: [QUESTION],
    });

    const stepB = await observe(harness, {
      requestKey: 'research-phase-5-b',
      input: sourceB,
      expectedRevision: 1,
      output: outputB,
      fixture: 'research-phase-5-b',
    });
    expect(stepB.result).toMatchObject({ status: 'committed', revision: 2 });

    const afterB = researchState(harness, 2);
    expect(afterB?.verifiedClaims).toEqual([
      {
        identityKey: expect.stringMatching(/^claim:research_proposition_/u),
        statement: SUPPORTING,
        independentSourceCount: 2,
        memoryIds: ['memory-research-phase-5-001'],
      },
    ]);
    expect(afterB?.contestedClaims).toEqual([]);
    expect(afterB?.openQuestions).toEqual([QUESTION]);

    const stepC = await observe(harness, {
      requestKey: 'research-phase-5-c',
      input: sourceC,
      expectedRevision: 2,
      output: outputC,
      fixture: 'research-phase-5-c',
    });
    expect(stepC.result).toMatchObject({ status: 'committed', revision: 3 });

    const afterC = researchState(harness, 3);
    expect(afterC?.verifiedClaims).toEqual([]);
    expect(afterC?.contestedClaims).toEqual([
      {
        identityKey: expect.stringMatching(/^claim:research_proposition_/u),
        // Every wording survives the contradiction.
        variants: [CONTRADICTING, SUPPORTING].sort(),
        memoryIds: ['memory-research-phase-5-001'],
      },
    ]);
    expect(afterC?.openQuestions).toEqual([QUESTION]);

    // The contradicted claim record is contested, not overwritten, and the
    // three sources remain distinct auditable records.
    const evidence = harness.repository.snapshot();
    expect(
      [...evidence.memoryRecords]
        .map(({ memoryId, kind, status }) => ({ memoryId, kind, status }))
        .sort((left, right) => left.memoryId.localeCompare(right.memoryId)),
    ).toEqual([
      {
        memoryId: 'memory-research-phase-5-001',
        kind: 'research.claim',
        status: 'contested',
      },
      {
        memoryId: 'memory-research-phase-5-002',
        kind: 'research.question',
        status: 'active',
      },
      {
        memoryId: 'memory-research-phase-5-003',
        kind: 'research.source',
        status: 'active',
      },
      {
        memoryId: 'memory-research-phase-5-004',
        kind: 'research.source',
        status: 'active',
      },
      {
        memoryId: 'memory-research-phase-5-005',
        kind: 'research.source',
        status: 'active',
      },
    ]);
    // Repository evidence is ordered by execution ID, which is a hash, so the
    // document order is not the observation order.
    expect([...evidence.documents.map(({ key }) => key)].sort()).toEqual([
      'research-phase-5-a',
      'research-phase-5-b',
      'research-phase-5-c',
    ]);
    expect(evidence.events).toEqual([]);
  });

  it('rejects a stale expected revision before any model call or write', async () => {
    await observe(harness, {
      requestKey: 'research-phase-5-a',
      input: sourceA,
      expectedRevision: 0,
      output: outputA,
      fixture: 'research-phase-5-a',
    });
    const committedEvidence = harness.repository.snapshot();
    const callsBefore = harness.ids.next.mock.calls.length;

    const staleGateway = createScriptedModelGateway({
      profiles: [
        {
          selection,
          capabilities: { structuredOutput: true, tools: false, vision: false },
        },
      ],
      calls: [],
    });
    const stale = await createEngine(harness, staleGateway).execute(
      // Revision 5 never existed; the state head is at 1.
      request('research-phase-5-stale', sourceB, 5),
    );

    expect(stale).toMatchObject({
      status: 'conflicted',
      error: { code: 'CONFLICT_STATE_REVISION' },
    });
    expect(staleGateway.invocations()).toEqual([]);
    expect(harness.ids.next.mock.calls.length).toBe(callsBefore);
    expect(harness.repository.snapshot()).toMatchObject({
      documents: committedEvidence.documents,
      memoryRecords: committedEvidence.memoryRecords,
      state: committedEvidence.state,
    });
  });

  it('replays every execution offline with matching digests and no effects', async () => {
    const steps = [
      {
        requestKey: 'research-phase-5-a',
        input: sourceA,
        expectedRevision: 0,
        output: outputA,
        fixture: 'research-phase-5-a',
      },
      {
        requestKey: 'research-phase-5-b',
        input: sourceB,
        expectedRevision: 1,
        output: outputB,
        fixture: 'research-phase-5-b',
      },
      {
        requestKey: 'research-phase-5-c',
        input: sourceC,
        expectedRevision: 2,
        output: outputC,
        fixture: 'research-phase-5-c',
      },
    ];
    const executed = [];
    for (const step of steps) {
      executed.push(await observe(harness, step));
    }

    const committedEvidence = harness.repository.snapshot();
    const idCallsAfterCommit = harness.ids.next.mock.calls.length;

    for (const step of executed) {
      // Repeating a committed request returns the recorded result.
      const repeated = await step.engine.execute(step.request);
      expect(repeated).toEqual({ ...step.result, replayed: true });
      expect(step.gateway.invocations()).toHaveLength(1);
    }

    const forbiddenNext = vi.fn((): string => {
      throw new Error('Replay allocated an ID.');
    });
    const forbiddenClock = vi.fn((): string => {
      throw new Error('Replay read the clock.');
    });
    const forbiddenCapabilities = vi.fn(async () => {
      throw new Error('Replay asked the gateway for capabilities.');
    });
    const forbiddenGenerate = vi.fn(async () => {
      throw new Error('Replay invoked the gateway.');
    });
    const replayEngine = createExecutionEngine({
      clock: { now: forbiddenClock },
      ids: { next: forbiddenNext },
      modules: createModuleRegistry([researchModule]),
      contracts: createContractRegistry([researchObserveEvidenceContract]),
      pipeline: createResponsePipeline(),
      gateway: {
        capabilities: forbiddenCapabilities,
        generate: forbiddenGenerate,
      },
      memory: createMemoryEngine({ ids: { next: forbiddenNext } }),
      state: createStateEngine(),
      repository: harness.repository,
    });

    for (const step of executed) {
      const replay = await replayEngine.replayVerify(step.executionId);
      expect(replay).toMatchObject({ status: 'match', differences: [] });
      expect(replay.recordedDigest).toBe(replay.replayDigest);
    }

    expect(forbiddenNext).not.toHaveBeenCalled();
    expect(forbiddenClock).not.toHaveBeenCalled();
    expect(forbiddenCapabilities).not.toHaveBeenCalled();
    expect(forbiddenGenerate).not.toHaveBeenCalled();
    expect(harness.ids.next.mock.calls.length).toBe(idCallsAfterCommit);
    expect(harness.repository.snapshot()).toEqual(committedEvidence);
  });

  it('pins the deterministic identity, hash and digest goldens for the sequence', async () => {
    const stepA = await observe(harness, {
      requestKey: 'research-phase-5-a',
      input: sourceA,
      expectedRevision: 0,
      output: outputA,
      fixture: 'research-phase-5-a',
    });
    const evidence = await harness.repository.loadReplayEvidence(
      stepA.executionId,
    );
    expect(evidence).not.toBeNull();

    expect({
      executionId: stepA.executionId,
      requestFingerprint: evidence?.requestFingerprint,
      modelRequestHash: evidence?.modelCalls[0]?.requestHash,
      modelResponseHash: computeModelResponseHash(
        scriptedResponse(outputA, 'research-phase-5-a'),
      ),
      operationDigest: evidence?.preparedCommit.operationDigest,
      stateHash: harness.repository.snapshot().state.snapshots[0]?.valueHash,
      stateSchemaVersion:
        harness.repository.snapshot().state.snapshots[0]?.schemaVersion,
    }).toEqual({
      executionId:
        'execution_f011eaf6986d9ef4765e9bfe297b01bbc53e6f8e5abb2425a345ef7957b09bf0',
      requestFingerprint:
        '42ecf345c81b3a26ae8e6895aa1c7c02476de8c8822ba78ddd03ad43de15a0ff',
      modelRequestHash:
        '54cdd37ad37ebe0ed27f498985cb9baefff828b3a4e934855957cccfdfeedb09',
      modelResponseHash:
        '843141f0067f810e26efdee7d3565536107eecacc393ba7671855b384121a28b',
      operationDigest:
        'a5fc5947dbdb5af0da75c2cd797c887b5bd26ede5a873ae93581d717352a00aa',
      stateHash:
        '618636f955dbed7dbd2d5ddbea9c1b97a5b5526efbcf18b66e7f524634e2a406',
      stateSchemaVersion: RESEARCH_STATE_SCHEMA_VERSION,
    });
  });
});
