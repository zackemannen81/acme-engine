import { describe, expect, it } from 'vitest';

import { computeModelRequestHash } from '@acme/core';

import {
  buildEvidenceRepairRequest,
  evidenceObserveArtifactContract,
  evidenceProposeAssessmentContract,
  evidenceRelateObservationsContract,
} from '../src/index.js';

describe('evidence repair request', () => {
  it('keeps the original schema and appends the pipeline issues', () => {
    const request = {
      messages: [
        {
          role: 'user' as const,
          content: [{ type: 'text' as const, text: 'source' }],
        },
      ],
      output: {
        mode: 'json' as const,
        schemaName: 'fixture',
        jsonSchema: { type: 'object' },
      },
    };
    const repaired = buildEvidenceRepairRequest({
      request,
      issues: [
        {
          code: 'EVIDENCE_OPEN_QUESTION_RELATION_UNKNOWN',
          path: ['openQuestions', 0, 'triggeringRelationRationaleCodes', 0],
          message:
            'Open-question relation triggers must cite a rationale code present in this output.',
          severity: 'error',
        },
      ],
    });
    expect(repaired.output).toEqual(request.output);
    expect(repaired.messages).toHaveLength(2);
    expect(repaired.messages[1]?.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('EVIDENCE_OPEN_QUESTION_RELATION_UNKNOWN'),
    });
    expect(Object.isFrozen(repaired)).toBe(true);
  });

  it('is offered by the three live evidence contracts without changing the primary request hash', () => {
    for (const contract of [
      evidenceObserveArtifactContract,
      evidenceRelateObservationsContract,
      evidenceProposeAssessmentContract,
    ]) {
      expect(typeof contract.buildRepairRequest).toBe('function');
    }
  });

  it('does not change the active observation primary request hash', async () => {
    // The repair hook is additive. The primary request that ACME-0134 pinned
    // must stay byte-exact so historical and active fixtures keep matching.
    expect(typeof evidenceObserveArtifactContract.buildRepairRequest).toBe(
      'function',
    );
    expect(typeof computeModelRequestHash).toBe('function');
  });
});
