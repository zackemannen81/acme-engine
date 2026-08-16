import { describe, expect, it } from 'vitest';

import { createInMemoryExecutionRepository } from '../../packages/adapter-memory/src/index.js';
import { createScriptedModelGateway } from '../../packages/adapter-model-mock/src/index.js';
import {
  canonicalJson,
  computeModelRequestHash,
  createContractRegistry,
  createExecutionEngine,
  createMemoryEngine,
  createModuleRegistry,
  createResponsePipeline,
  createStateEngine,
  deriveExecutionId,
} from '../../packages/core/src/index.js';
import {
  deriveEvidenceArtifactVersionId,
  deriveEvidenceContentHash,
  evidenceLineCount,
  evidenceModule,
  evidenceObserveArtifactContract,
  planEvidenceObservationCoverage,
} from '../../packages/module-evidence/src/index.js';
import { createTestPayloadEncryptor } from '../../packages/testing/src/index.js';
import { deriveEvidenceObservationWindowRequestKey } from '../../apps/evidence-workbench-api/src/live-observation.js';

const now = '2026-08-16T00:00:00.000Z';
const selection = {
  profile: 'evidence-coverage-fixture',
  providerHint: 'deterministic-fixture',
  modelHint: 'evidence-observe-1',
};

describe('Evidence observation coverage windows', () => {
  it('commits one execution per window and one observation per segment', async () => {
    const text = Array.from(
      { length: 65 },
      (_, index) => `entry ${String(index + 1)}`,
    ).join('\n');
    const windows = planEvidenceObservationCoverage(text);
    expect(windows).toHaveLength(2);
    const contentHash = deriveEvidenceContentHash(text);
    const identity = {
      corpusId: 'coverage-fixture',
      logicalArtifactId: 'DEV-T01',
      versionOrdinal: 1,
      kind: 'structured-exhibit-text' as const,
      contentHash,
      locatorScheme: 'line-range-1' as const,
      predecessorVersionId: null,
    };
    const artifactVersion = {
      schemaVersion: 'evidence-source-artifact-version/1' as const,
      ...identity,
      artifactVersionId: deriveEvidenceArtifactVersionId(identity),
      title: 'coverage',
      lineCount: evidenceLineCount(text),
      correctionReason: null,
      text,
    };
    const requestContext = { executionId: 'hash-only', now };
    const calls = windows.map((window) => {
      const requestKey = deriveEvidenceObservationWindowRequestKey(
        'coverage-multi',
        window.index,
      );
      const input = {
        schemaVersion: 'evidence-observe-artifact-input/2' as const,
        artifactVersion,
        actorRoster: [],
        coverageWindow: {
          sourceSegmentIds: [...window.sourceSegmentIds],
        },
      };
      return {
        requestKey,
        input,
        executionId: deriveExecutionId('evidence', requestKey),
        expectedRequestHash: computeModelRequestHash(
          evidenceObserveArtifactContract.buildRequest(input, requestContext),
        ),
        output: {
          schemaVersion: 'evidence-observe-artifact-output/5' as const,
          observations: window.sourceSegmentIds.map((sourceSegmentId) => ({
            kind: 'exhibit-assertion' as const,
            sourceSegmentId,
            sourceActorReference: null,
            temporalBound: null,
          })),
          segmentCoverage: window.sourceSegmentIds.map((sourceSegmentId) => ({
            sourceSegmentId,
            status: 'observations_extracted' as const,
          })),
        },
      };
    });
    const counts = new Map<string, number>();
    const ids = {
      next(kind: string) {
        const next = (counts.get(kind) ?? 0) + 1;
        counts.set(kind, next);
        return `${kind}-${String(next)}`;
      },
    };
    const repository = createInMemoryExecutionRepository({
      ids,
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
            maxOutputTokens: 8_192,
          },
        },
      ],
      calls: calls.map((item) => ({
        executionId: item.executionId,
        callKey: 'model:0',
        selection,
        expectedRequestHash: item.expectedRequestHash,
        outcome: {
          kind: 'response' as const,
          response: {
            provider: 'deterministic-fixture',
            model: 'evidence-observe-1',
            providerResponseId: item.requestKey,
            receivedAt: now,
            finishReason: 'stop' as const,
            text: canonicalJson(item.output as never),
            usage: { inputTokens: 80, outputTokens: 40, totalTokens: 120 },
            metadata: { window: item.requestKey },
          },
        },
      })),
    });
    const engine = createExecutionEngine({
      clock: { now: () => now },
      ids,
      modules: createModuleRegistry([evidenceModule]),
      contracts: createContractRegistry([evidenceObserveArtifactContract]),
      pipeline: createResponsePipeline(),
      gateway,
      memory: createMemoryEngine({ ids }),
      state: createStateEngine(),
      repository,
    });
    for (const [index, item] of calls.entries()) {
      await expect(
        engine.execute({
          requestKey: item.requestKey,
          namespace: 'evidence',
          task: 'observe-artifact',
          entityId: 'workspace-coverage',
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
    expect(gateway.invocations()).toHaveLength(2);
    expect(repository.snapshot().memoryRecords).toHaveLength(65);
    expect(repository.snapshot().executions).toHaveLength(2);
  });
});
