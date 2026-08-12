import { describe, expect, it } from 'vitest';

import { computeModelRequestHash } from '@acme/core';
import { evidenceProposeAssessmentContract } from '@acme/module-evidence';

import { evaluationAssessmentCases } from '../src/evaluation-assessment.js';
import { loadIdentityVectors } from '../src/corpus.js';
import { loadSealedEvaluationTruth } from '../src/evaluation.js';

describe('evaluation assessment candidates', () => {
  it('pins E-A01 and E-A02 identities and request hashes', () => {
    const cases = evaluationAssessmentCases();
    const vectors = loadIdentityVectors();
    expect(cases).toHaveLength(2);
    const first = cases[0];
    const second = cases[1];
    if (first === undefined || second === undefined) {
      throw new Error('Missing assessment cases.');
    }
    expect(first.truthId).toBe('E-A01');
    expect(second.truthId).toBe('E-A02');
    expect(first.expectedAssessmentVersionId).toBe(
      vectors.assessment.expectedId,
    );
    for (const item of cases) {
      expect(
        evidenceProposeAssessmentContract.validateSemantics(
          item.output,
          item.input,
        ),
      ).toEqual([]);
      expect(
        computeModelRequestHash(
          evidenceProposeAssessmentContract.buildRequest(item.input, {
            executionId: 'hash-only',
            now: '2026-08-11T00:00:00.000Z',
          }),
        ),
      ).toBe(item.requestHash);
    }
  });

  it('keeps E-A01 open-question triggers within the pre-EVAL-E01 evidence set', () => {
    const truth = loadSealedEvaluationTruth();
    const first = truth.assessments.find(({ truthId }) => truthId === 'E-A01');
    if (first === undefined) throw new Error('Missing E-A01 truth.');
    const lateObservationIds = new Set(
      truth.observations
        .filter(({ logicalArtifactId }) => logicalArtifactId === 'EVAL-E01')
        .map(({ truthId }) => truthId),
    );
    const relations = new Map(
      truth.relations.map((relation) => [relation.truthId, relation]),
    );
    const questions = new Map(
      truth.openQuestions.map((question) => [question.truthId, question]),
    );
    const violations = first.openQuestionTruthIds.filter((questionTruthId) => {
      const question = questions.get(questionTruthId);
      if (question === undefined) return true;
      return question.triggeringTruthIds.some((triggerTruthId) => {
        if (lateObservationIds.has(triggerTruthId)) return true;
        return relations
          .get(triggerTruthId)
          ?.endpoints.some(
            ({ kind, ref }) =>
              kind === 'observation' && lateObservationIds.has(ref),
          );
      });
    });
    expect(violations).toEqual([]);
  });
});
