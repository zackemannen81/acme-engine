import { describe, expect, it } from 'vitest';

import {
  buildQualityEvaluationDetailView,
  buildQualityEvaluationListView,
  isAvailable,
  QUALITY_EVALUATION_UNAVAILABLE,
  QUALITY_EVALUATION_VIEW_VERSION,
  type QualityEvaluationRecordShape,
} from '../src/index.js';

const sample: QualityEvaluationRecordShape = {
  version: 'acme-quality-evaluation/1',
  evaluationId: 'quality_evaluation_aaa',
  subjectDigest: 's'.repeat(64),
  resultDigest: 'r'.repeat(64),
  subject: {
    runId: 'run-1',
    executionId: 'execution-1',
    operationDigest: 'o'.repeat(64),
    artifact: { kind: 'document', id: 'doc', digest: 'a'.repeat(64) },
    contract: {
      id: 'narrative.observe-document',
      version: '1.0.0',
      fingerprint: 'c'.repeat(64),
    },
  },
  evaluator: {
    id: 'quality.chapter-structure',
    version: '1.0.0',
    kind: 'deterministic',
  },
  result: {
    verdict: 'pass',
    scores: [
      {
        id: 'required-fields',
        value: 1,
        scale: { min: 0, max: 1 },
        interpretation: 'higher-is-better',
      },
    ],
    findings: [],
  },
};

describe('quality evaluation view (S11)', () => {
  it('lists evaluations in evaluationId order without inventing verdicts', () => {
    const second = {
      ...sample,
      evaluationId: 'quality_evaluation_bbb',
      result: { ...sample.result, verdict: 'fail' },
    };
    const view = buildQualityEvaluationListView([second, sample]);
    expect(view.view).toBe(QUALITY_EVALUATION_VIEW_VERSION);
    expect(view.surface).toBe('list');
    if (!isAvailable(view.evaluations)) {
      throw new Error('expected available');
    }
    expect(view.evaluations.count).toBe(2);
    expect(view.evaluations.items.map((item) => item.evaluationId)).toEqual([
      'quality_evaluation_aaa',
      'quality_evaluation_bbb',
    ]);
    expect(view.evaluations.items[1]?.verdict).toBe('fail');
  });

  it('marks missing evidence and missing ids as unavailable', () => {
    const empty = buildQualityEvaluationListView(undefined);
    expect(empty.evaluations).toMatchObject({
      availability: 'unavailable',
      reason: QUALITY_EVALUATION_UNAVAILABLE.qualityEvidence,
    });
    const missing = buildQualityEvaluationDetailView([sample], 'missing');
    expect(missing.evaluation).toMatchObject({
      availability: 'unavailable',
      reason: QUALITY_EVALUATION_UNAVAILABLE.evaluationNotFound,
    });
  });

  it('details copy scores and findings from the record', () => {
    const view = buildQualityEvaluationDetailView(
      [sample],
      sample.evaluationId,
    );
    if (!isAvailable(view.evaluation)) {
      throw new Error('expected available');
    }
    expect(view.evaluation.verdict).toBe('pass');
    expect(view.evaluation.scores).toHaveLength(1);
    expect(view.evaluation.executionId).toBe('execution-1');
  });
});
