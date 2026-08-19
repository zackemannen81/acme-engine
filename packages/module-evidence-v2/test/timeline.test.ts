import { describe, expect, it } from 'vitest';

import {
  deriveEvidenceV2CaseRevision,
  projectEvidenceV2Timeline,
  type EvidenceV2TimelineOccurrenceInput,
} from '../src/timeline.js';
import type { EvidenceV2Claim } from '../src/claim.js';

const CLAIM: EvidenceV2Claim = {
  schemaVersion: 'evidence-v2-claim/1',
  claimId: 'claim-1',
  caseId: 'case-1',
  label: 'The car colour',
  statement: 'What colour the car was.',
  createdBy: 'principal-a',
  createdAt: '2026-08-18T10:00:00.000Z',
};

function occurrence(
  id: string,
  from: string | null,
  kind: 'exact' | 'range' | 'unknown' | null = 'range',
): EvidenceV2TimelineOccurrenceInput {
  return {
    occurrenceId: id,
    artifactId: 'artifact-1',
    instanceKey: 'instance-1',
    partId: 'part-000001',
    startLine: 10,
    endLine: 10,
    exactQuote: `Quote ${id}`,
    temporalBound:
      kind === null
        ? null
        : {
            kind,
            from,
            to: from,
            zone: null,
          },
    standing: 'accepted',
  };
}

describe('evidence v2 timeline', () => {
  it('orders dated items by from and leaves unknown time unordered at the end', () => {
    const revision = deriveEvidenceV2CaseRevision({
      caseId: 'case-1',
      occurrenceIds: ['c', 'a', 'b'],
      reviewDecisionIds: [],
      claimIds: [],
      groupingDecisionIds: [],
      relationIds: [],
      relationReviewIds: [],
    });
    const projection = projectEvidenceV2Timeline({
      caseId: 'case-1',
      revision,
      occurrences: [
        occurrence('c', '2007-05-01'),
        occurrence('a', null, 'unknown'),
        occurrence('b', '2007-04-25'),
        occurrence('d', null, null),
      ],
      claims: [],
    });
    expect(
      projection.items.filter((item) => item.ordered).map((item) => item.id),
    ).toEqual(['b', 'c']);
    expect(
      projection.items.filter((item) => !item.ordered).map((item) => item.id),
    ).toEqual(['a', 'd']);
    expect(projection.datedCount).toBe(2);
    expect(projection.unorderedCount).toBe(2);
    expect(projection.items.find((item) => item.id === 'b')?.temporalKind).toBe(
      'range',
    );
  });

  it('keeps two identical quotes as two rows', () => {
    const revision = deriveEvidenceV2CaseRevision({
      caseId: 'case-1',
      occurrenceIds: ['a', 'b'],
      reviewDecisionIds: [],
      claimIds: [],
      groupingDecisionIds: [],
      relationIds: [],
      relationReviewIds: [],
    });
    const same = occurrence('a', '2007-04-25');
    const projection = projectEvidenceV2Timeline({
      caseId: 'case-1',
      revision,
      occurrences: [same, { ...same, occurrenceId: 'b', startLine: 88 }],
      claims: [],
    });
    expect(projection.items).toHaveLength(2);
    expect(projection.items.map((item) => item.startLine)).toEqual([10, 88]);
  });

  it('places a claim with no dated members in the unordered tail', () => {
    const revision = deriveEvidenceV2CaseRevision({
      caseId: 'case-1',
      occurrenceIds: [],
      reviewDecisionIds: [],
      claimIds: ['claim-1'],
      groupingDecisionIds: [],
      relationIds: [],
      relationReviewIds: [],
    });
    const projection = projectEvidenceV2Timeline({
      caseId: 'case-1',
      revision,
      occurrences: [],
      claims: [{ claim: CLAIM, acceptedBounds: [null] }],
    });
    expect(projection.items).toHaveLength(1);
    expect(projection.items[0]?.kind).toBe('claim');
    expect(projection.items[0]?.ordered).toBe(false);
  });

  it('is deterministic and states a stable revision digest', () => {
    const build = () => {
      const revision = deriveEvidenceV2CaseRevision({
        caseId: 'case-1',
        occurrenceIds: ['b', 'a'],
        reviewDecisionIds: ['r1'],
        claimIds: ['claim-1'],
        groupingDecisionIds: ['g1'],
        relationIds: [],
        relationReviewIds: [],
      });
      return projectEvidenceV2Timeline({
        caseId: 'case-1',
        revision,
        occurrences: [
          occurrence('b', '2007-04-25'),
          occurrence('a', '2007-04-24'),
        ],
        claims: [{ claim: CLAIM, acceptedBounds: [] }],
      });
    };
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
    expect(build().revision.digest).toHaveLength(64);
  });
});
