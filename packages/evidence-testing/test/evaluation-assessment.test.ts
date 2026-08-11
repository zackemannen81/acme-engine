import { describe, expect, it } from 'vitest';

import { computeModelRequestHash } from '@acme/core';
import { evidenceProposeAssessmentContract } from '@acme/module-evidence';

import { evaluationAssessmentCases } from '../src/evaluation-assessment.js';
import { loadIdentityVectors } from '../src/corpus.js';

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
});
