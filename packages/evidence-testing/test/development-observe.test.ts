import { describe, expect, it } from 'vitest';

import { computeModelRequestHash, type ExecutionReadContext } from '@acme/core';
import {
  evidenceObserveArtifactContract,
  evidenceObserveArtifactTask,
  type EvidenceState,
} from '@acme/module-evidence';

import {
  EVIDENCE_DEVELOPMENT_OBSERVE_METRIC_TARGETS,
  EVIDENCE_DEVELOPMENT_OBSERVE_REQUEST_HASH,
  developmentObserveArtifactInput,
  developmentObserveArtifactOutput,
  loadGoldenForPartition,
} from '../src/index.js';

const context: ExecutionReadContext<EvidenceState> = {
  executionId: 'execution-development-observe-1',
  entityId: 'workspace-development-1',
  now: '2026-08-11T10:00:00.000Z',
  state: null,
  memories: [],
  documents: [],
};

describe('development observe fixture', () => {
  it('pins the deterministic request and the two open-truth observations', async () => {
    const input = developmentObserveArtifactInput();
    const output = developmentObserveArtifactOutput();
    const projected = await evidenceObserveArtifactTask.project(input, context);
    const request = evidenceObserveArtifactContract.buildRequest(projected, {
      executionId: context.executionId,
      now: context.now,
    });
    expect(computeModelRequestHash(request)).toBe(
      EVIDENCE_DEVELOPMENT_OBSERVE_REQUEST_HASH,
    );
    expect(
      evidenceObserveArtifactContract.validateSemantics(output, input),
    ).toEqual([]);

    const result = await evidenceObserveArtifactTask.interpret(
      output,
      input,
      context,
    );
    const golden = loadGoldenForPartition('development');
    const observed = result.memories
      .map((candidate) => candidate.value)
      .filter(
        (value): value is { readonly observationId: string } =>
          typeof value === 'object' &&
          value !== null &&
          'observationId' in value,
      )
      .map(({ observationId }) => observationId)
      .sort();
    expect(observed).toEqual(
      golden.expectedObservationIds.filter(
        (id) => id === observed[0] || id === observed[1],
      ),
    );
    expect(EVIDENCE_DEVELOPMENT_OBSERVE_METRIC_TARGETS).toEqual({
      exactQuoteBinding: { passed: 2, total: 2 },
      actorResolution: { passed: 2, total: 2 },
      temporalNormalization: { passed: 2, total: 2 },
    });
  });
});
