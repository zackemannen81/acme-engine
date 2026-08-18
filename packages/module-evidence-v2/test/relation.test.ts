import { describe, expect, it } from 'vitest';

import {
  EvidenceV2RelationReviewDecisionSchema,
  EvidenceV2RelationSchema,
  deriveEvidenceV2RelationStandings,
  evidenceV2ContradictionScopeIssues,
  projectEvidenceV2Relation,
  type EvidenceV2ComparableScope,
  type EvidenceV2Relation,
  type EvidenceV2RelationEndpointInput,
  type EvidenceV2RelationReviewAction,
  type EvidenceV2RelationReviewDecision,
  type EvidenceV2RelationType,
} from '../src/relation.js';

const COMPARABLE: EvidenceV2ComparableScope = {
  actor: 'comparable',
  time: 'comparable',
  location: 'unknown',
  entity: 'comparable',
};

function relation(
  type: EvidenceV2RelationType = 'supports',
  overrides: Partial<EvidenceV2Relation> = {},
): EvidenceV2Relation {
  return {
    schemaVersion: 'evidence-v2-relation/1',
    relationId: 'relation-1',
    caseId: 'case-1',
    artifactId: 'artifact-1',
    chainId: 'chain-1',
    from: { kind: 'occurrence', id: 'occ-current' },
    to: { kind: 'occurrence', id: 'occ-prior' },
    type,
    comparableScope: COMPARABLE,
    rationale: 'Same actor, same evening.',
    provenance: 'reviewer-authored',
    createdBy: 'principal-a',
    createdAt: '2026-08-18T12:00:00.000Z',
    executionId: null,
    contractVersion: null,
    windowId: null,
    ...overrides,
  };
}

function review(
  action: EvidenceV2RelationReviewAction,
  overrides: Partial<EvidenceV2RelationReviewDecision> = {},
): EvidenceV2RelationReviewDecision {
  return {
    schemaVersion: 'evidence-v2-relation-review/1',
    decisionId: `review-${action}`,
    caseId: 'case-1',
    relationId: 'relation-1',
    action,
    supersedes: null,
    principal: 'principal-a',
    decidedAt: '2026-08-18T12:00:00.000Z',
    rationale: 'Reviewed.',
    ...overrides,
  };
}

function standingOf(
  item: EvidenceV2Relation,
  decisions: readonly EvidenceV2RelationReviewDecision[] = [],
) {
  const [standing] = deriveEvidenceV2RelationStandings([item], decisions);
  if (standing === undefined) throw new Error('expected standing');
  return standing;
}

function endpoint(
  id: string,
  overrides: Partial<EvidenceV2RelationEndpointInput> = {},
): EvidenceV2RelationEndpointInput {
  return {
    kind: 'occurrence',
    id,
    artifactId: 'artifact-1',
    instanceKey: id === 'occ-current' ? 'instance-2' : 'instance-1',
    partId: 'part-000001',
    startLine: id === 'occ-current' ? 40 : 10,
    endLine: id === 'occ-current' ? 40 : 10,
    exactQuote:
      id === 'occ-current'
        ? 'Han säger att bilen var grön.'
        : 'Han beskriver bilen som blå.',
    standing: 'accepted',
    ...overrides,
  };
}

describe('evidence v2 relation', () => {
  it('refuses a contradiction whose actor or time is not comparable', () => {
    expect(
      evidenceV2ContradictionScopeIssues({
        ...COMPARABLE,
        actor: 'incomparable',
      }),
    ).toEqual(['EVIDENCE_V2_CONTRADICTION_ACTOR_NOT_COMPARABLE']);
    expect(
      evidenceV2ContradictionScopeIssues({
        ...COMPARABLE,
        time: 'unknown',
      }),
    ).toEqual(['EVIDENCE_V2_CONTRADICTION_TIME_NOT_COMPARABLE']);
    expect(evidenceV2ContradictionScopeIssues(COMPARABLE)).toEqual([]);
  });

  it('accepts the four verbs and no others', () => {
    for (const type of ['contradicts', 'adds', 'supports', 'qualifies'])
      expect(EvidenceV2RelationSchema.parse(relation(type as never)).type).toBe(
        type,
      );
    expect(
      EvidenceV2RelationSchema.safeParse(
        relation('supports', { type: 'duplicate' as never }),
      ).success,
    ).toBe(false);
  });

  it('folds review to standing and keeps the superseded decision in the log', () => {
    const first = review('accept');
    const second = review('reject', {
      decisionId: 'review-reject',
      supersedes: first.decisionId,
      decidedAt: '2026-08-18T13:00:00.000Z',
    });
    const standings = deriveEvidenceV2RelationStandings(
      [relation()],
      [first, second],
    );
    expect(standings).toHaveLength(1);
    expect(standings[0]?.standing).toBe('rejected');
    expect(standings[0]?.decisionCount).toBe(2);
    expect(standings[0]?.decisionId).toBe('review-reject');
    expect(second.supersedes).toBe(first.decisionId);
    expect(EvidenceV2RelationReviewDecisionSchema.parse(first)).toEqual(first);
  });

  it('treats a relation with no decision as pending', () => {
    const [standing] = deriveEvidenceV2RelationStandings([relation()], []);
    expect(standing?.standing).toBe('pending');
    expect(standing?.decisionCount).toBe(0);
  });

  it('never deletes either endpoint when a relation is created or rejected', () => {
    const from = endpoint('occ-current');
    const to = endpoint('occ-prior');
    const created = projectEvidenceV2Relation({
      relation: relation(),
      standing: standingOf(relation(), [review('accept')]),
      endpoints: [from, to],
    });
    const rejected = projectEvidenceV2Relation({
      relation: relation(),
      standing: standingOf(relation(), [
        review('accept'),
        review('reject', {
          decisionId: 'review-reject',
          supersedes: 'review-accept',
        }),
      ]),
      endpoints: [from, to],
    });
    expect(created?.from.id).toBe('occ-current');
    expect(created?.to.id).toBe('occ-prior');
    expect(rejected?.from.exactQuote).toBe(from.exactQuote);
    expect(rejected?.to.exactQuote).toBe(to.exactQuote);
    expect(rejected?.from.standing).toBe('accepted');
    expect(rejected?.to.standing).toBe('accepted');
    expect(rejected?.standing).toBe('rejected');
  });

  it('keeps two types between the same pair as two relations', () => {
    const supports = relation('supports', { relationId: 'r-supports' });
    const qualifies = relation('qualifies', { relationId: 'r-qualifies' });
    const standings = deriveEvidenceV2RelationStandings(
      [supports, qualifies],
      [],
    );
    expect(standings.map((item) => item.relationId)).toEqual([
      'r-qualifies',
      'r-supports',
    ]);
    expect(supports.from).toEqual(qualifies.from);
    expect(supports.to).toEqual(qualifies.to);
    expect(supports.type).not.toBe(qualifies.type);
  });

  it('refuses to invent a missing endpoint', () => {
    const standing = standingOf(relation());
    expect(
      projectEvidenceV2Relation({
        relation: relation(),
        standing,
        endpoints: [endpoint('occ-current')],
      }),
    ).toBeUndefined();
  });

  it('resolves a claim endpoint to its label, not a quote', () => {
    const claimed = relation('adds', {
      to: { kind: 'claim', id: 'claim-1' },
    });
    const projection = projectEvidenceV2Relation({
      relation: claimed,
      standing: standingOf(claimed),
      endpoints: [
        endpoint('occ-current'),
        {
          kind: 'claim',
          id: 'claim-1',
          claimLabel: 'The colour of the car',
          standing: 'accepted',
        },
      ],
    });
    expect(projection?.to.kind).toBe('claim');
    expect(projection?.to.claimLabel).toBe('The colour of the car');
    expect(projection?.to.exactQuote).toBeNull();
  });

  it('is deterministic: the same inputs project the same bytes', () => {
    const build = () =>
      projectEvidenceV2Relation({
        relation: relation(),
        standing: standingOf(relation(), [review('accept')]),
        endpoints: [endpoint('occ-prior'), endpoint('occ-current')],
      });
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  it('carries no score, weight or verdict', () => {
    const projection = projectEvidenceV2Relation({
      relation: relation(),
      standing: standingOf(relation()),
      endpoints: [endpoint('occ-current'), endpoint('occ-prior')],
    });
    for (const forbidden of [
      'score',
      'weight',
      'confidence',
      'rank',
      'verdict',
      'credibility',
    ])
      expect(Object.keys(projection ?? {})).not.toContain(forbidden);
  });
});
