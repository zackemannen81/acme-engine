import { describe, expect, it } from 'vitest';

import { computeModelRequestHash } from '@acme/core';
import {
  deriveEvidenceRelationId,
  evidenceRelateObservationsContract,
} from '@acme/module-evidence';

import {
  evaluationRelateCase,
  evaluationRelateExpectedOpenQuestionIds,
  evaluationRelateExpectedRelationIds,
} from '../src/evaluation-relate.js';
import {
  buildGoldenMaterial,
  loadSealedEvaluationTruth,
} from '../src/evaluation.js';
import { loadIdentityVectors } from '../src/corpus.js';

describe('evaluation relate candidates', () => {
  it('matches sealed golden relation and open-question identities', () => {
    const relate = evaluationRelateCase();
    const material = buildGoldenMaterial(loadSealedEvaluationTruth());
    const vectors = loadIdentityVectors();

    expect(relate.output.relations).toHaveLength(8);
    expect(relate.output.openQuestions).toHaveLength(3);
    expect(
      computeModelRequestHash(
        evidenceRelateObservationsContract.buildRequest(relate.input, {
          executionId: 'hash-only',
          now: '2026-08-11T00:00:00.000Z',
        }),
      ),
    ).toBe(relate.requestHash);

    const derivedRelationIds = relate.output.relations
      .map((candidate) => {
        const temporalBounds =
          candidate.comparableScope.temporalObservationIds.map(
            (observationId) => {
              const observation = relate.input.observations.find(
                (item) => item.observationId === observationId,
              );
              if (observation?.temporalBound == null) {
                throw new Error(`Missing temporal bound for ${observationId}`);
              }
              return observation.temporalBound;
            },
          );
        return deriveEvidenceRelationId({
          relationKind: candidate.relationKind,
          endpoints: candidate.endpoints,
          comparableScope: {
            subject: candidate.comparableScope.subject,
            aspect: candidate.comparableScope.aspect,
            actorReferenceKeys: candidate.comparableScope.actorReferenceKeys,
            temporalBounds,
          },
          rationale: candidate.rationale,
          predecessorRelationId: null,
        });
      })
      .sort();

    expect(derivedRelationIds).toEqual([
      ...evaluationRelateExpectedRelationIds(),
    ]);
    expect(material.relations.get('E-R05')?.relationId).toBe(
      vectors.relation.expected,
    );
    expect(derivedRelationIds).toContain(vectors.relation.expected);
    expect(evaluationRelateExpectedOpenQuestionIds()).toContain(
      vectors.openQuestion.expected,
    );
  });
});
