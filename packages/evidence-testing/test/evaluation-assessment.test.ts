import { describe, expect, it } from 'vitest';

import { computeModelRequestHash, createContractRegistry } from '@acme/core';
import {
  evidenceProposeAssessmentContract,
  evidenceProposeAssessmentContractV1,
  evidenceProposeAssessmentContractV2,
} from '@acme/module-evidence';

import { evaluationAssessmentCases } from '../src/evaluation-assessment.js';
import { loadIdentityVectors } from '../src/corpus.js';
import { loadSealedEvaluationTruth } from '../src/evaluation.js';

describe('evaluation assessment candidates', () => {
  it('versions explicit sorted-set instructions without historical drift', () => {
    const first = evaluationAssessmentCases()[0];
    if (first === undefined) throw new Error('Missing E-A01 assessment case.');
    const context = {
      executionId: 'hash-only',
      now: '2026-08-11T00:00:00.000Z',
    };
    const historicalV1 = evidenceProposeAssessmentContractV1.buildRequest(
      first.input,
      context,
    );
    const historicalV2 = evidenceProposeAssessmentContractV2.buildRequest(
      first.input,
      context,
    );
    const active = evidenceProposeAssessmentContract.buildRequest(
      first.input,
      context,
    );

    expect(computeModelRequestHash(historicalV1)).toBe(
      '2532333356e475a2caa405aaa5eda3867e9682049262f9156590891dd6fd49a0',
    );
    expect(computeModelRequestHash(historicalV2)).toBe(
      'a7504dcf2ff5d33578688e9f73d2b3b76e21a7007d22460e094526d047e51c90',
    );
    expect(computeModelRequestHash(active)).toBe(
      'c4e140c6742d06ab038f87fd323eccc81d96fa52bcde85d5f5bf37a2c342fb48',
    );
    expect(JSON.stringify(historicalV1)).not.toContain(
      'ascending lexicographic order',
    );
    expect(JSON.stringify(historicalV2)).not.toContain(
      'ascending lexicographic order',
    );
    expect(JSON.stringify(active)).toContain('ascending lexicographic order');
    expect(historicalV1.output.schemaName).toBe(
      'evidence_propose_assessment_1_0_0',
    );
    expect(historicalV2.output.schemaName).toBe(
      'evidence_propose_assessment_1_1_0',
    );
    expect(active.output.schemaName).toBe('evidence_propose_assessment_1_2_0');
    const registry = createContractRegistry([
      evidenceProposeAssessmentContractV1,
      evidenceProposeAssessmentContractV2,
      evidenceProposeAssessmentContract,
    ]);
    expect(registry.has(evidenceProposeAssessmentContractV1.ref)).toBe(true);
    expect(registry.has(evidenceProposeAssessmentContractV2.ref)).toBe(true);
    expect(registry.has(evidenceProposeAssessmentContract.ref)).toBe(true);
  });

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
