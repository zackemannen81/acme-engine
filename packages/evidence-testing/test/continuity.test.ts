import { describe, expect, it } from 'vitest';

import { evidenceRelateObservationsContract } from '@acme/module-evidence';

import { evaluationRelateCase } from '../src/evaluation-relate.js';

describe('continuity and information exposure', () => {
  it('can represent changes_certainty and prompted_by without deleting the earlier occurrence', () => {
    const relate = evaluationRelateCase();
    const first = relate.input.observations[0];
    const second = relate.input.observations[1];
    const question = relate.input.observations[2];
    if (first === undefined || second === undefined || question === undefined) {
      throw new Error('Expected three frozen occurrences.');
    }
    const pair = (left: string, right: string) =>
      [
        { kind: 'observation' as const, id: left },
        { kind: 'observation' as const, id: right },
      ].sort(
        (a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id),
      );
    const output = {
      schemaVersion: 'evidence-relate-observations-output/2' as const,
      propositions: [],
      events: [],
      relations: [
        {
          relationKind: 'changes_certainty' as const,
          endpoints: pair(first.observationId, second.observationId),
          comparableScope: {
            subject: 'vehicle colour',
            aspect: 'certainty',
            actorReferenceKeys: [],
            temporalObservationIds: [],
          },
          rationaleCode: 'CONTINUITY_CHANGES_CERTAINTY',
          rationale:
            'The later statement changes certainty from unknown colour to maybe red Volvo.',
        },
        {
          relationKind: 'prompted_by' as const,
          endpoints: pair(question.observationId, second.observationId),
          comparableScope: {
            subject: 'vehicle colour',
            aspect: 'question exposure',
            actorReferenceKeys: [],
            temporalObservationIds: [],
          },
          rationaleCode: 'EXPOSURE_PROMPTED_BY',
          rationale:
            'The later colour statement follows a question that named the colour.',
        },
      ],
      openQuestions: [],
    };
    expect(
      evidenceRelateObservationsContract.validateSemantics(
        output,
        relate.input,
      ),
    ).toEqual([]);
    expect(
      relate.input.observations.map(({ observationId }) => observationId),
    ).toEqual(
      expect.arrayContaining([
        first.observationId,
        second.observationId,
        question.observationId,
      ]),
    );
    const request = evidenceRelateObservationsContract.buildRequest(
      relate.input,
      {
        executionId: 'continuity',
        now: '2026-08-16T00:00:00.000Z',
      },
    );
    expect(JSON.stringify(request)).toContain('changes_certainty');
    expect(JSON.stringify(request)).toContain('Do not infer corroborates');
  });
});
