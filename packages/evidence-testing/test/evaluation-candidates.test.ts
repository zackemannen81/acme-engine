import { describe, expect, it } from 'vitest';

import { computeModelRequestHash } from '@acme/core';
import {
  evidenceObserveArtifactContract,
  pairEvidenceCorrectionObservations,
} from '@acme/module-evidence';

import { evaluationObserveCases } from '../src/evaluation-candidates.js';
import {
  buildGoldenMaterial,
  loadSealedEvaluationTruth,
} from '../src/evaluation.js';

describe('sealed evaluation observation candidates', () => {
  it('pins all five request hashes without importing truth into the fixture', () => {
    const cases = evaluationObserveCases();
    expect(cases).toHaveLength(5);
    for (const item of cases) {
      expect(
        evidenceObserveArtifactContract.validateSemantics(
          item.output,
          item.input,
        ),
      ).toEqual([]);
      expect(
        computeModelRequestHash(
          evidenceObserveArtifactContract.buildRequest(item.input, {
            executionId: 'hash-only',
            now: '2026-08-11T00:00:00.000Z',
          }),
        ),
      ).toBe(item.requestHash);
    }
  });

  it('pairs only explicit correction lineage and refuses changed or ambiguous accounts', () => {
    const cases = evaluationObserveCases();
    const material = buildGoldenMaterial(loadSealedEvaluationTruth());
    const sourceV1 = cases[0]?.input.artifactVersion;
    const sourceV2 = cases[1]?.input.artifactVersion;
    const changedSource = cases[2]?.input.artifactVersion;
    if (
      sourceV1 === undefined ||
      sourceV2 === undefined ||
      changedSource === undefined
    ) {
      throw new Error('Missing evaluation source fixture.');
    }
    const predecessors = ['E-O01', 'E-O02'].map((truthId) => {
      const value = material.observations.get(truthId);
      if (value === undefined) throw new Error(`Missing ${truthId}.`);
      return value;
    });
    const successors = ['E-O03', 'E-O04'].map((truthId) => {
      const value = material.observations.get(truthId);
      if (value === undefined) throw new Error(`Missing ${truthId}.`);
      return value;
    });
    expect(
      pairEvidenceCorrectionObservations({
        predecessorSource: sourceV1,
        successorSource: sourceV2,
        predecessorObservations: predecessors,
        successorObservations: successors,
      }).map(({ predecessor, successor }) => [
        predecessor.observationId,
        successor.observationId,
      ]),
    ).toHaveLength(2);

    const changed = ['E-O05', 'E-O06'].map((truthId) => {
      const value = material.observations.get(truthId);
      if (value === undefined) throw new Error(`Missing ${truthId}.`);
      return value;
    });
    expect(() =>
      pairEvidenceCorrectionObservations({
        predecessorSource: sourceV2,
        successorSource: changedSource,
        predecessorObservations: successors,
        successorObservations: changed,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: 'EVIDENCE_CORRECTION_LINEAGE_INVALID',
      }),
    );

    const duplicatePredecessor = {
      ...predecessors[0],
      observationId: `evidence_observation_${'a'.repeat(64)}`,
    };
    expect(() =>
      pairEvidenceCorrectionObservations({
        predecessorSource: sourceV1,
        successorSource: sourceV2,
        predecessorObservations: [
          predecessors[0] as (typeof predecessors)[number],
          duplicatePredecessor as (typeof predecessors)[number],
          predecessors[1] as (typeof predecessors)[number],
        ],
        successorObservations: successors,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: 'EVIDENCE_CORRECTION_PAIR_AMBIGUOUS',
      }),
    );
  });
});
