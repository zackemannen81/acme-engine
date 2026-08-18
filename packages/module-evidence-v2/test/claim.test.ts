import { describe, expect, it } from 'vitest';

import {
  EvidenceV2ClaimGroupingDecisionSchema,
  deriveEvidenceV2ClaimMemberships,
  projectEvidenceV2Claim,
  type EvidenceV2Claim,
  type EvidenceV2ClaimGroupingAction,
  type EvidenceV2ClaimGroupingDecision,
  type EvidenceV2ClaimOccurrenceInput,
} from '../src/claim.js';
import { deriveEvidenceV2Standings } from '../src/review.js';

const CLAIM: EvidenceV2Claim = {
  schemaVersion: 'evidence-v2-claim/1',
  claimId: 'claim-1',
  caseId: 'case-1',
  label: 'The blue car',
  statement:
    'Statements about the colour of the car on the evening in question.',
  createdBy: 'principal-a',
  createdAt: '2026-08-18T10:00:00.000Z',
};

function grouping(
  occurrenceId: string,
  action: EvidenceV2ClaimGroupingAction,
  overrides: Partial<EvidenceV2ClaimGroupingDecision> = {},
): EvidenceV2ClaimGroupingDecision {
  return {
    schemaVersion: 'evidence-v2-claim-grouping/1',
    decisionId: `grouping-${occurrenceId}-${action}`,
    caseId: 'case-1',
    claimId: 'claim-1',
    artifactId: 'artifact-1',
    instanceKey: 'instance-1',
    occurrenceId,
    action,
    supersedes: null,
    principal: 'principal-a',
    decidedAt: '2026-08-18T10:00:00.000Z',
    rationale: 'Concerns the same proposition.',
    ...overrides,
  };
}

function occurrence(
  occurrenceId: string,
  overrides: Partial<EvidenceV2ClaimOccurrenceInput> = {},
): EvidenceV2ClaimOccurrenceInput {
  return {
    occurrenceId,
    artifactId: 'artifact-1',
    instanceKey: 'instance-1',
    partId: 'part-000001',
    startLine: 10,
    endLine: 10,
    exactQuote: 'Han beskriver bilen som blå.',
    ...overrides,
  };
}

describe('evidence v2 claim grouping', () => {
  it('folds an include into membership and an exclude back out', () => {
    const included = deriveEvidenceV2ClaimMemberships('claim-1', [
      grouping('a', 'include'),
    ]);
    expect(included.map((item) => item.occurrenceId)).toEqual(['a']);

    const excluded = deriveEvidenceV2ClaimMemberships('claim-1', [
      grouping('a', 'include'),
      grouping('a', 'exclude', {
        decisionId: 'grouping-second',
        supersedes: 'grouping-a-include',
        decidedAt: '2026-08-18T11:00:00.000Z',
      }),
    ]);
    expect(excluded).toHaveLength(0);
  });

  it('keeps the superseded decision in the log an exclusion was folded from', () => {
    const log = [
      grouping('a', 'include'),
      grouping('a', 'exclude', {
        decisionId: 'grouping-second',
        supersedes: 'grouping-a-include',
      }),
    ];
    deriveEvidenceV2ClaimMemberships('claim-1', log);
    // Excluding removes the occurrence from the claim and from nowhere else.
    expect(log).toHaveLength(2);
    expect(log[0]?.action).toBe('include');
  });

  it('re-includes after an exclusion without resurrecting anything', () => {
    const members = deriveEvidenceV2ClaimMemberships('claim-1', [
      grouping('a', 'include'),
      grouping('a', 'exclude', { decisionId: 'g2' }),
      grouping('a', 'include', { decisionId: 'g3' }),
    ]);
    expect(members).toHaveLength(1);
  });

  it('ignores decisions belonging to another claim', () => {
    const members = deriveEvidenceV2ClaimMemberships('claim-1', [
      grouping('a', 'include'),
      grouping('b', 'include', { claimId: 'claim-2', decisionId: 'other' }),
    ]);
    expect(members.map((item) => item.occurrenceId)).toEqual(['a']);
  });

  it('orders membership deterministically', () => {
    const forward = deriveEvidenceV2ClaimMemberships('claim-1', [
      grouping('c', 'include'),
      grouping('a', 'include'),
      grouping('b', 'include'),
    ]);
    const backward = deriveEvidenceV2ClaimMemberships('claim-1', [
      grouping('b', 'include'),
      grouping('a', 'include'),
      grouping('c', 'include'),
    ]);
    expect(forward.map((item) => item.occurrenceId)).toEqual(['a', 'b', 'c']);
    expect(forward).toEqual(backward);
  });

  it('refuses a grouping decision without a rationale or with an unknown action', () => {
    expect(
      EvidenceV2ClaimGroupingDecisionSchema.safeParse(grouping('a', 'include'))
        .success,
    ).toBe(true);
    for (const broken of [
      { ...grouping('a', 'include'), rationale: '' },
      { ...grouping('a', 'include'), principal: '' },
      { ...grouping('a', 'include'), action: 'merge' },
      { ...grouping('a', 'include'), action: 'delete' },
    ])
      expect(
        EvidenceV2ClaimGroupingDecisionSchema.safeParse(broken).success,
        String(broken.action),
      ).toBe(false);
  });

  it('never merges two occurrences that quote the same words', () => {
    // The defining invariant. Identical text from two sources is two pieces of
    // evidence, and a claim that collapsed them would report one source where
    // there are two.
    const same = 'Han beskriver bilen som blå.';
    const projection = projectEvidenceV2Claim({
      claim: CLAIM,
      memberships: deriveEvidenceV2ClaimMemberships('claim-1', [
        grouping('a', 'include'),
        grouping('b', 'include', {
          decisionId: 'g-b',
          instanceKey: 'instance-2',
        }),
      ]),
      occurrences: [
        occurrence('a', { exactQuote: same, instanceKey: 'instance-1' }),
        occurrence('b', {
          exactQuote: same,
          instanceKey: 'instance-2',
          partId: 'part-000002',
          startLine: 88,
          endLine: 88,
        }),
      ],
      standings: deriveEvidenceV2Standings(['a', 'b'], []),
    });
    expect(projection.contributorCount).toBe(2);
    expect(projection.contributors.map((item) => item.occurrenceId)).toEqual([
      'a',
      'b',
    ]);
    // Each keeps its own locator.
    expect(projection.contributors[0]?.startLine).toBe(10);
    expect(projection.contributors[1]?.startLine).toBe(88);
    expect(projection.distinctInstances).toBe(2);
    expect(projection.crossInstance).toBe(true);
  });

  it('reports each contributor its own standing rather than flattening them', () => {
    const standings = deriveEvidenceV2Standings(
      ['a', 'b', 'c'],
      [
        {
          schemaVersion: 'evidence-v2-review/1',
          decisionId: 'r1',
          artifactId: 'artifact-1',
          instanceKey: 'instance-1',
          occurrenceId: 'a',
          action: 'accept',
          supersedes: null,
          principal: 'principal-a',
          decidedAt: '2026-08-18T10:00:00.000Z',
          rationale: 'Verified.',
        },
        {
          schemaVersion: 'evidence-v2-review/1',
          decisionId: 'r2',
          artifactId: 'artifact-1',
          instanceKey: 'instance-1',
          occurrenceId: 'b',
          action: 'reject',
          supersedes: null,
          principal: 'principal-a',
          decidedAt: '2026-08-18T10:00:00.000Z',
          rationale: 'Index line.',
        },
      ],
    );
    const projection = projectEvidenceV2Claim({
      claim: CLAIM,
      memberships: deriveEvidenceV2ClaimMemberships('claim-1', [
        grouping('a', 'include'),
        grouping('b', 'include', { decisionId: 'g-b' }),
        grouping('c', 'include', { decisionId: 'g-c' }),
      ]),
      occurrences: [occurrence('a'), occurrence('b'), occurrence('c')],
      standings,
    });
    expect(projection.standingCounts).toEqual({
      accepted: 1,
      rejected: 1,
      'needs-revision': 0,
      pending: 1,
    });
    // A rejected contributor stays visible in the claim. Hiding it would make
    // the group look cleaner than the evidence is.
    expect(
      projection.contributors.find((item) => item.occurrenceId === 'b')
        ?.standing,
    ).toBe('rejected');
  });

  it('states that an emptied claim is empty rather than asserting anything', () => {
    const projection = projectEvidenceV2Claim({
      claim: CLAIM,
      memberships: deriveEvidenceV2ClaimMemberships('claim-1', [
        grouping('a', 'include'),
        grouping('a', 'exclude', { decisionId: 'g2' }),
      ]),
      occurrences: [occurrence('a')],
      standings: deriveEvidenceV2Standings(['a'], []),
    });
    expect(projection.empty).toBe(true);
    expect(projection.contributorCount).toBe(0);
    expect(projection.crossInstance).toBe(false);
    // The claim record itself is untouched by having nothing in it.
    expect(projection.claim).toEqual(CLAIM);
  });

  it('skips a membership whose occurrence was not supplied rather than inventing one', () => {
    const projection = projectEvidenceV2Claim({
      claim: CLAIM,
      memberships: deriveEvidenceV2ClaimMemberships('claim-1', [
        grouping('a', 'include'),
        grouping('missing', 'include', { decisionId: 'g-missing' }),
      ]),
      occurrences: [occurrence('a')],
      standings: deriveEvidenceV2Standings(['a'], []),
    });
    expect(projection.contributorCount).toBe(1);
  });

  it('is deterministic: the same inputs project the same bytes', () => {
    const build = () =>
      projectEvidenceV2Claim({
        claim: CLAIM,
        memberships: deriveEvidenceV2ClaimMemberships('claim-1', [
          grouping('b', 'include', { decisionId: 'g-b' }),
          grouping('a', 'include'),
        ]),
        occurrences: [occurrence('b'), occurrence('a')],
        standings: deriveEvidenceV2Standings(['a', 'b'], []),
      });
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  it('carries no score, weight or verdict', () => {
    const projection = projectEvidenceV2Claim({
      claim: CLAIM,
      memberships: [],
      occurrences: [],
      standings: [],
    });
    for (const forbidden of [
      'score',
      'weight',
      'confidence',
      'rank',
      'verdict',
      'supported',
      'credibility',
    ])
      expect(Object.keys(projection)).not.toContain(forbidden);
  });
});
