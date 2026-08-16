import { describe, expect, it } from 'vitest';

import { createInMemoryExecutionRepository } from '../../packages/adapter-memory/src/index.js';
import { createScriptedModelGateway } from '../../packages/adapter-model-mock/src/index.js';
import {
  canonicalJson,
  createContractRegistry,
  createExecutionEngine,
  createMemoryEngine,
  createModuleRegistry,
  createResponsePipeline,
  createStateEngine,
  deriveExecutionId,
  type ExecutionRepository,
  type IdGenerator,
  type ModelGateway,
} from '../../packages/core/src/index.js';
import {
  developmentObserveArtifactInput,
  EVIDENCE_DEVELOPMENT_OBSERVE_REQUEST_HASH,
  developmentObserveArtifactOutput,
} from '../../packages/evidence-testing/src/index.js';
import {
  evidenceModule,
  evidenceObserveArtifactContract,
} from '../../packages/module-evidence/src/index.js';
import { createTestPayloadEncryptor } from '../../packages/testing/src/index.js';
import { processLossAt } from '../fixtures/process-loss.js';

const now = '2026-08-11T10:00:00.000Z';
const selection = {
  profile: 'evidence-development-fixture',
  providerHint: 'deterministic-fixture',
  modelHint: 'evidence-observe-1',
};
const request = {
  requestKey: 'evidence-development-resume-1',
  namespace: 'evidence',
  task: 'observe-artifact',
  entityId: 'workspace-development-resume',
  expectedRevision: 0,
  input: developmentObserveArtifactInput(),
  model: selection,
  policy: { retention: 'encrypted-payload' as const },
};

function ids(): IdGenerator {
  const counts = new Map<string, number>();
  return {
    next(kind) {
      const next = (counts.get(kind) ?? 0) + 1;
      counts.set(kind, next);
      return `${kind}-${String(next)}`;
    },
  };
}

function engine(
  repository: ExecutionRepository,
  idSource: IdGenerator,
  gateway: ModelGateway,
) {
  return createExecutionEngine({
    clock: { now: () => now },
    ids: idSource,
    modules: createModuleRegistry([evidenceModule]),
    contracts: createContractRegistry([evidenceObserveArtifactContract]),
    pipeline: createResponsePipeline(),
    gateway,
    memory: createMemoryEngine({ ids: idSource }),
    state: createStateEngine(),
    repository,
  });
}

describe('Evidence observe execution reliability', () => {
  it('resumes the recorded development response with no second provider call and replay-matches', async () => {
    const repository = createInMemoryExecutionRepository({
      ids: ids(),
      payloadEncryptor: createTestPayloadEncryptor(),
    });
    const executionId = deriveExecutionId('evidence', request.requestKey);
    const gateway = createScriptedModelGateway({
      profiles: [
        {
          selection,
          capabilities: {
            structuredOutput: true,
            tools: false,
            vision: false,
            maxInputTokens: 32_000,
            maxOutputTokens: 8_192,
          },
        },
      ],
      calls: [
        {
          executionId,
          callKey: 'model:0',
          selection,
          expectedRequestHash: EVIDENCE_DEVELOPMENT_OBSERVE_REQUEST_HASH,
          outcome: {
            kind: 'response',
            response: {
              provider: 'deterministic-fixture',
              model: 'evidence-observe-1',
              providerResponseId: 'resume-fixture',
              receivedAt: now,
              finishReason: 'stop',
              text: canonicalJson(developmentObserveArtifactOutput() as never),
              usage: { inputTokens: 480, outputTokens: 190, totalTokens: 670 },
              metadata: { fixture: true },
            },
          },
        },
      ],
    });
    await expect(
      engine(processLossAt(repository, 'commit'), ids(), gateway).execute(
        request,
      ),
    ).rejects.toThrow('Simulated process loss.');
    expect(gateway.invocations()).toHaveLength(1);
    expect(repository.snapshot()).toMatchObject({
      executions: [{ status: 'preparing-commit' }],
      modelCalls: [{ status: 'succeeded' }],
      memoryRecords: [],
      state: { snapshots: [] },
    });

    const forbiddenGateway = {
      async capabilities() {
        throw new Error('Resume consulted the provider.');
      },
      async generate() {
        throw new Error('Resume called the provider.');
      },
    } as unknown as ModelGateway;
    const resumed = engine(repository, ids(), forbiddenGateway);
    await expect(resumed.execute(request)).resolves.toMatchObject({
      status: 'committed',
      replayed: false,
      revision: 1,
    });
    expect(gateway.invocations()).toHaveLength(1);
    await expect(resumed.replayVerify(executionId)).resolves.toMatchObject({
      status: 'match',
    });
    expect(repository.snapshot().memoryRecords).toHaveLength(2);
  });
});
