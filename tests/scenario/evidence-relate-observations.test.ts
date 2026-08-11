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
  type IdGenerator,
} from '../../packages/core/src/index.js';
import { evaluationObserveCases } from '../../packages/evidence-testing/src/evaluation-candidates.js';
import {
  evaluationRelateCase,
  evaluationRelateExpectedOpenQuestionIds,
  evaluationRelateExpectedRelationIds,
} from '../../packages/evidence-testing/src/evaluation-relate.js';
import {
  EvidenceMemoryValueSchema,
  EvidenceRelationSchema,
  EvidenceStateSchema,
  evidenceModule,
  evidenceObserveArtifactContract,
  evidenceRelateObservationsContract,
} from '../../packages/module-evidence/src/index.js';
import { createTestPayloadEncryptor } from '../../packages/testing/src/index.js';

const now = '2026-08-11T12:00:00.000Z';
const observeSelection = {
  profile: 'evidence-evaluation-fixture',
  providerHint: 'deterministic-fixture',
  modelHint: 'evidence-observe-1',
};
const relateSelection = {
  profile: 'evidence-evaluation-fixture',
  providerHint: 'deterministic-fixture',
  modelHint: 'evidence-relate-1',
};

function ids(): IdGenerator {
  const counts = new Map<string, number>();
  return {
    next(kind) {
      const next = (counts.get(kind) ?? 0) + 1;
      counts.set(kind, next);
      return `${kind}-evaluation-${String(next)}`;
    },
  };
}

describe('Evidence relation evaluation scenario', () => {
  it('commits eight golden relations, three open questions and contests changed accounts', async () => {
    const observeCases = evaluationObserveCases();
    const relate = evaluationRelateCase();
    const idSource = ids();
    const repository = createInMemoryExecutionRepository({
      ids: idSource,
      payloadEncryptor: createTestPayloadEncryptor(),
    });
    const gateway = createScriptedModelGateway({
      profiles: [
        {
          selection: observeSelection,
          capabilities: {
            structuredOutput: true,
            tools: false,
            vision: false,
            maxInputTokens: 32_000,
            maxOutputTokens: 4_096,
          },
        },
        {
          selection: relateSelection,
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
        ...observeCases.map((item) => ({
          executionId: deriveExecutionId('evidence', item.caseId),
          callKey: 'model:0',
          selection: observeSelection,
          expectedRequestHash: item.requestHash,
          outcome: {
            kind: 'response' as const,
            response: {
              provider: 'deterministic-fixture',
              model: 'evidence-observe-1',
              providerResponseId: item.caseId,
              receivedAt: now,
              finishReason: 'stop' as const,
              text: canonicalJson(item.output as never),
              usage: { inputTokens: 500, outputTokens: 200, totalTokens: 700 },
              metadata: { fixture: item.caseId },
            },
          },
        })),
        {
          executionId: deriveExecutionId('evidence', relate.caseId),
          callKey: 'model:0',
          selection: relateSelection,
          expectedRequestHash: relate.requestHash,
          outcome: {
            kind: 'response' as const,
            response: {
              provider: 'deterministic-fixture',
              model: 'evidence-relate-1',
              providerResponseId: relate.caseId,
              receivedAt: now,
              finishReason: 'stop' as const,
              text: canonicalJson(relate.output as never),
              usage: { inputTokens: 800, outputTokens: 600, totalTokens: 1400 },
              metadata: { fixture: relate.caseId },
            },
          },
        },
      ],
    });
    const engine = createExecutionEngine({
      clock: { now: () => now },
      ids: idSource,
      modules: createModuleRegistry([evidenceModule]),
      contracts: createContractRegistry([
        evidenceObserveArtifactContract,
        evidenceRelateObservationsContract,
      ]),
      pipeline: createResponsePipeline(),
      gateway,
      memory: createMemoryEngine({ ids: idSource }),
      state: createStateEngine(),
      repository,
    });

    for (const [index, item] of observeCases.entries()) {
      await expect(
        engine.execute({
          requestKey: item.caseId,
          namespace: 'evidence',
          task: 'observe-artifact',
          entityId: 'workspace-evaluation',
          expectedRevision: index,
          input: item.input,
          model: observeSelection,
          policy: { retention: 'encrypted-payload' },
        }),
      ).resolves.toMatchObject({
        status: 'committed',
        replayed: false,
        revision: index + 1,
      });
    }

    await expect(
      engine.execute({
        requestKey: relate.caseId,
        namespace: 'evidence',
        task: 'relate-observations',
        entityId: 'workspace-evaluation',
        expectedRevision: observeCases.length,
        input: relate.input,
        model: relateSelection,
        policy: { retention: 'encrypted-payload' },
      }),
    ).resolves.toMatchObject({
      status: 'committed',
      replayed: false,
      revision: observeCases.length + 1,
    });

    expect(gateway.invocations()).toHaveLength(observeCases.length + 1);

    const snapshot = repository.snapshot();
    const relationIds = snapshot.memoryRecords
      .map((record) => EvidenceRelationSchema.safeParse(record.value))
      .flatMap((parsed) => (parsed.success ? [parsed.data.relationId] : []))
      .sort();
    expect(relationIds).toEqual([...evaluationRelateExpectedRelationIds()]);

    const openQuestionIds = snapshot.memoryRecords
      .map((record) => EvidenceMemoryValueSchema.safeParse(record.value))
      .flatMap((parsed) =>
        parsed.success && parsed.data.kind === 'open-question'
          ? [parsed.data.openQuestionId]
          : [],
      )
      .sort();
    expect(openQuestionIds).toEqual([
      ...evaluationRelateExpectedOpenQuestionIds(),
    ]);

    const state = EvidenceStateSchema.parse(
      snapshot.state.snapshots.at(-1)?.value,
    );
    expect(state.currentRelationVersionIds).toHaveLength(8);
    expect(state.currentOpenQuestionIds).toHaveLength(3);
    expect(
      state.standings.filter(({ standing }) => standing === 'contested'),
    ).toHaveLength(3);
    expect(
      state.standings.filter(({ standing }) => standing === 'superseded'),
    ).toHaveLength(2);

    const unresolved = snapshot.memoryRecords
      .map((record) => EvidenceRelationSchema.safeParse(record.value))
      .flatMap((parsed) =>
        parsed.success && parsed.data.relationKind === 'unresolved'
          ? [parsed.data]
          : [],
      );
    expect(unresolved).toHaveLength(1);

    await expect(
      engine.execute({
        requestKey: relate.caseId,
        namespace: 'evidence',
        task: 'relate-observations',
        entityId: 'workspace-evaluation',
        expectedRevision: observeCases.length,
        input: relate.input,
        model: relateSelection,
        policy: { retention: 'encrypted-payload' },
      }),
    ).resolves.toMatchObject({
      status: 'committed',
      replayed: true,
      revision: state.evidenceRevision,
    });
    expect(gateway.invocations()).toHaveLength(observeCases.length + 1);
  });
});
