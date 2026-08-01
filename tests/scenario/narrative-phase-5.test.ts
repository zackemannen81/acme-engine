import {
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
  type IdGenerator,
} from '../../packages/core/src/index.js';
import { createInMemoryExecutionRepository } from '../../packages/adapter-memory/src/index.js';
import { createTestPayloadEncryptor } from '../../packages/testing/src/index.js';
import { createScriptedModelGateway } from '../../packages/adapter-model-mock/src/index.js';
import {
  NARRATIVE_STATE_SCHEMA_VERSION,
  narrativeModule,
  narrativeObserveDocumentContract,
  narrativeObserveDocumentTask,
  type NarrativeContractOutput,
  type NarrativeObserveInput,
  type NarrativeState,
} from '../../packages/module-narrative/src/index.js';
import { describe, expect, it, vi } from 'vitest';

const now = '2026-07-31T12:00:00.000Z';
const responseNow = '2026-07-31T12:00:01.000Z';
const entityId = 'story-phase-5';
const requestKey = 'narrative-phase-5-request-1';
const selection = Object.freeze({
  profile: 'offline-json',
  providerHint: 'fixture',
  modelHint: 'fixture-json-1',
});
const input: NarrativeObserveInput = Object.freeze({
  documentKey: 'chapter-phase-5',
  title: 'Northern Light',
  text: 'Mira tells Ion that her eyes are green. The northern light reveals hidden paths.',
});
const output: NarrativeContractOutput = {
  observations: [
    {
      type: 'character-fact' as const,
      subject: 'Mira',
      predicate: 'eye color',
      value: 'green',
      confidence: 0.9,
    },
    {
      type: 'relationship' as const,
      subject: 'Mira',
      relation: 'mentors',
      object: 'Ion',
      confidence: 0.8,
    },
    {
      type: 'world-rule' as const,
      rule: 'The northern light reveals hidden paths.',
      confidence: 0.75,
    },
  ],
  scene: {
    location: 'Observatory',
    time: 'Night',
    summary: 'Mira shares the northern-light rule with Ion.',
  },
};

function createIds() {
  let memory = 0;
  const next = vi.fn((kind: Parameters<IdGenerator['next']>[0]) => {
    switch (kind) {
      case 'execution':
        throw new Error('Execution ID must be derived.');
      case 'call':
        return 'call-narrative-phase-5';
      case 'document':
        return 'document-narrative-phase-5-001';
      case 'memory':
        memory += 1;
        return `memory-narrative-phase-5-${String(memory).padStart(3, '0')}`;
      case 'event':
        throw new Error('Narrative Phase 5 emits no event.');
    }
  });
  return { ids: { next } satisfies IdGenerator, next };
}

describe('NarrativeModule Phase 5 offline acceptance', () => {
  it('commits three decisions once and replay-verifies the same effect without a gateway call', async () => {
    const executionId = deriveExecutionId('narrative', requestKey);
    const context: ExecutionReadContext<NarrativeState> = Object.freeze({
      executionId,
      entityId,
      now,
      state: null,
      memories: Object.freeze([]),
      documents: Object.freeze([]),
    });
    const contractInput = await narrativeObserveDocumentTask.project(
      input,
      context,
    );
    const modelRequest = narrativeObserveDocumentContract.buildRequest(
      contractInput,
      { executionId, now },
    );
    const response = Object.freeze({
      provider: 'fixture',
      model: 'fixture-json-1',
      providerResponseId: 'fixture-response-narrative-phase-5',
      receivedAt: responseNow,
      finishReason: 'stop' as const,
      text: JSON.stringify(output),
      usage: Object.freeze({
        inputTokens: 120,
        outputTokens: 90,
        totalTokens: 210,
      }),
      metadata: Object.freeze({ fixture: 'narrative-phase-5' }),
    });
    const gateway = createScriptedModelGateway({
      profiles: [
        {
          selection,
          capabilities: {
            structuredOutput: true,
            tools: false,
            vision: false,
          },
        },
      ],
      calls: [
        {
          executionId,
          callKey: 'model:0',
          selection,
          expectedRequestHash: computeModelRequestHash(modelRequest),
          outcome: { kind: 'response', response },
        },
      ],
    });
    const id = createIds();
    const repository = createInMemoryExecutionRepository({
      ids: id.ids,
      payloadEncryptor: createTestPayloadEncryptor(),
    });
    const engine = createExecutionEngine({
      clock: { now: () => now },
      ids: id.ids,
      modules: createModuleRegistry([narrativeModule]),
      contracts: createContractRegistry([narrativeObserveDocumentContract]),
      pipeline: createResponsePipeline(),
      gateway,
      memory: createMemoryEngine({ ids: id.ids }),
      state: createStateEngine(),
      repository,
    });
    const request = {
      requestKey,
      namespace: 'narrative',
      task: 'observe-document',
      entityId,
      expectedRevision: 0,
      input,
      model: selection,
      policy: { retention: 'encrypted-payload' as const },
    };

    const first = await engine.execute(request);
    expect(first).toEqual({
      status: 'committed',
      executionId,
      replayed: false,
      revision: 1,
      documentKeys: ['chapter-phase-5'],
      eventIds: [],
    });
    const committedEvidence = repository.snapshot();
    expect(committedEvidence).toMatchObject({
      documents: [
        {
          documentId: 'document-narrative-phase-5-001',
          key: 'chapter-phase-5',
        },
      ],
      memoryCandidates: [
        { candidate: { key: 'narrative-memory-0001' } },
        { candidate: { key: 'narrative-memory-0002' } },
        { candidate: { key: 'narrative-memory-0003' } },
      ],
      memoryRecords: [
        { memoryId: 'memory-narrative-phase-5-001' },
        { memoryId: 'memory-narrative-phase-5-002' },
        { memoryId: 'memory-narrative-phase-5-003' },
      ],
      state: {
        snapshots: [
          {
            namespace: 'narrative',
            entityId,
            schemaVersion: NARRATIVE_STATE_SCHEMA_VERSION,
            revision: 1,
          },
        ],
      },
    });
    expect(gateway.invocations()).toHaveLength(1);
    expect(id.next).toHaveBeenCalledTimes(5);

    const repeated = await engine.execute(request);
    expect(repeated).toEqual({ ...first, replayed: true });
    expect(repository.snapshot()).toEqual(committedEvidence);
    expect(gateway.invocations()).toHaveLength(1);
    expect(id.next).toHaveBeenCalledTimes(5);

    const replay = await engine.replayVerify(executionId);
    expect(replay).toMatchObject({
      status: 'match',
      differences: [],
    });
    expect(replay.recordedDigest).toBe(replay.replayDigest);
    expect(repository.snapshot()).toEqual(committedEvidence);
    expect(gateway.invocations()).toHaveLength(1);
    expect(id.next).toHaveBeenCalledTimes(5);

    const portableEvidence = await repository.loadReplayEvidence(executionId);
    expect(portableEvidence).not.toBeNull();
    expect({
      executionId,
      requestFingerprint: portableEvidence?.requestFingerprint,
      modelRequestHash: portableEvidence?.modelCalls[0]?.requestHash,
      modelResponseHash: computeModelResponseHash(response),
      operationDigest: portableEvidence?.preparedCommit.operationDigest,
      stateHash: committedEvidence.state.snapshots[0]?.valueHash,
    }).toEqual({
      executionId:
        'execution_2c3216d146d3c9c40668e70e0f81ec870e2652ecf8294e3bd96556010914cd27',
      requestFingerprint:
        'd7cc17c51745eaf68c6a326008ff36b4d57e8a62fc510952734bc2a92ad89402',
      modelRequestHash:
        'eff700f31f2ee9867db3a90bc9945bdd809d62aa038ba6ae7198fcbfccc843c2',
      modelResponseHash:
        'e7bc7256e9c6330675a2afaa7c840709757490eb10558e25ab2f89bea73ae40f',
      operationDigest:
        '15f143ba7991e04065ad1ed6bc9f2df6942e05372d18f5d4469b2eba4ae5c94f',
      stateHash:
        '086c05744c4cf0fe9469524b5f2ac52a430bf3edc115c95fb7f82c721bfbae54',
    });
  });
});
