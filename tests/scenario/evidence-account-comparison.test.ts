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
  EvidenceDeltaSchema,
  EvidenceStateSchema,
  evidenceModule,
  evidenceObserveArtifactContract,
} from '../../packages/module-evidence/src/index.js';
import { createTestPayloadEncryptor } from '../../packages/testing/src/index.js';

const now = '2026-08-11T12:00:00.000Z';
const selection = {
  profile: 'evidence-evaluation-fixture',
  providerHint: 'deterministic-fixture',
  modelHint: 'evidence-observe-1',
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

describe('Evidence account-comparison evaluation scenario', () => {
  it('loads sealed truth only after generation and retains 8 current plus 2 superseded observations', async () => {
    const cases = evaluationObserveCases();
    const idSource = ids();
    const repository = createInMemoryExecutionRepository({
      ids: idSource,
      payloadEncryptor: createTestPayloadEncryptor(),
    });
    const gateway = createScriptedModelGateway({
      profiles: [
        {
          selection,
          capabilities: {
            structuredOutput: true,
            tools: false,
            vision: false,
            maxInputTokens: 32_000,
            maxOutputTokens: 4_096,
          },
        },
      ],
      calls: cases.map((item) => ({
        executionId: deriveExecutionId('evidence', item.caseId),
        callKey: 'model:0',
        selection,
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
    });
    const engine = createExecutionEngine({
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

    for (const [index, item] of cases.entries()) {
      await expect(
        engine.execute({
          requestKey: item.caseId,
          namespace: 'evidence',
          task: 'observe-artifact',
          entityId: 'workspace-evaluation',
          expectedRevision: index,
          input: item.input,
          model: selection,
          policy: { retention: 'encrypted-payload' },
        }),
      ).resolves.toMatchObject({
        status: 'committed',
        replayed: false,
        revision: index + 1,
      });
    }

    expect(gateway.invocations()).toHaveLength(5);
    const duplicate = cases[0];
    if (duplicate === undefined) throw new Error('Missing evaluation case.');
    await expect(
      engine.execute({
        requestKey: duplicate.caseId,
        namespace: 'evidence',
        task: 'observe-artifact',
        entityId: 'workspace-evaluation',
        expectedRevision: 0,
        input: duplicate.input,
        model: selection,
        policy: { retention: 'encrypted-payload' },
      }),
    ).resolves.toMatchObject({ status: 'committed', revision: 1 });
    expect(gateway.invocations()).toHaveLength(5);

    const snapshot = repository.snapshot();
    expect(snapshot.memoryRecords).toHaveLength(10);
    const latestStateRecord = snapshot.state.snapshots.at(-1);
    if (latestStateRecord === undefined)
      throw new Error('Missing final Evidence state.');
    const latestState = EvidenceStateSchema.parse(latestStateRecord.value);
    const observationStandings = latestState.standings.filter(
      ({ objectKind }) =>
        ['statement-occurrence', 'exhibit-assertion'].includes(objectKind),
    );
    expect(
      observationStandings.filter(({ standing }) => standing === 'current'),
    ).toHaveLength(8);
    expect(
      observationStandings.filter(({ standing }) => standing === 'superseded'),
    ).toHaveLength(2);
    expect(latestState.memoryIds).toHaveLength(10);

    const correctionTransition = snapshot.state.transitions.find(
      ({ toRevision }) => toRevision === 2,
    );
    if (correctionTransition === undefined)
      throw new Error('Missing correction transition.');
    const correctionDelta = EvidenceDeltaSchema.parse(
      correctionTransition.delta,
    );
    const correctionPairs = correctionDelta.standingChanges
      .filter(({ transition }) => transition === 'correction')
      .map(({ objectId, correctionLineage }) => ({
        predecessor: objectId,
        successor: correctionLineage?.successorObjectId,
      }))
      .sort((left, right) => left.predecessor.localeCompare(right.predecessor));

    // The truth boundary is crossed only after every candidate has been
    // generated, validated and committed above.
    const { buildGoldenMaterial, loadSealedEvaluationTruth } =
      await import('../../packages/evidence-testing/src/evaluation.js');
    const material = buildGoldenMaterial(loadSealedEvaluationTruth());
    expect(
      snapshot.memoryRecords.map(({ identityKey }) => identityKey).sort(),
    ).toEqual(
      [...material.observations.values()]
        .map(({ observationId }) => observationId)
        .sort(),
    );
    const expectedCorrectionPairs = (
      [
        ['E-O01', 'E-O03'],
        ['E-O02', 'E-O04'],
      ] as const
    )
      .map(([before, after]) => ({
        predecessor: material.observations.get(before)?.observationId,
        successor: material.observations.get(after)?.observationId,
      }))
      .sort((left, right) =>
        String(left.predecessor).localeCompare(String(right.predecessor)),
      );
    expect(correctionPairs).toEqual(expectedCorrectionPairs);
    expect(
      correctionDelta.standingChanges
        .filter(({ transition }) => transition === 'correction')
        .every(
          ({ correctionLineage }) =>
            correctionLineage?.logicalArtifactId === 'EVAL-T01',
        ),
    ).toBe(true);
    const changedAccountIds = ['E-O05', 'E-O06'].map(
      (truthId) => material.observations.get(truthId)?.observationId,
    );
    expect(
      correctionPairs.some(
        ({ predecessor, successor }) =>
          changedAccountIds.includes(predecessor) ||
          changedAccountIds.includes(successor),
      ),
    ).toBe(false);
  });
});
