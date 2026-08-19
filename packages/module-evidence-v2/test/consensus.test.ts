import { describe, expect, it } from 'vitest';

import { projectEvidenceV2Consensus, verdictOf } from '../src/consensus.js';
import type { EvidenceV2Claim } from '../src/claim.js';
import type { EvidenceV2Relation } from '../src/relation.js';
import { deriveEvidenceV2CaseRevision } from '../src/timeline.js';

const CLAIM: EvidenceV2Claim = {
  schemaVersion: 'evidence-v2-claim/1',
  claimId: 'claim-1',
  caseId: 'case-1',
  label: 'The car colour',
  statement: 'What colour the car was.',
  createdBy: 'principal-a',
  createdAt: '2026-08-18T10:00:00.000Z',
};

function member(id: string) {
  return {
    occurrenceId: id,
    artifactId: 'artifact-1',
    instanceKey: 'instance-1',
    partId: 'part-000001',
    startLine: 10,
    endLine: 10,
    exactQuote: `Quote ${id}`,
  };
}

function relation(
  type: EvidenceV2Relation['type'],
  id = `relation-${type}`,
): EvidenceV2Relation {
  return {
    schemaVersion: 'evidence-v2-relation/1',
    relationId: id,
    caseId: 'case-1',
    artifactId: 'artifact-1',
    chainId: 'chain-1',
    from: { kind: 'occurrence', id: 'occ-current' },
    to: { kind: 'occurrence', id: 'occ-a' },
    type,
    comparableScope: {
      actor: 'comparable',
      time: 'comparable',
      location: 'unknown',
      entity: 'unknown',
    },
    rationale: 'Recorded.',
    provenance: 'reviewer-authored',
    createdBy: 'principal-a',
    createdAt: '2026-08-18T12:00:00.000Z',
    executionId: null,
    contractVersion: null,
    windowId: null,
  };
}

describe('evidence v2 consensus', () => {
  it('maps the four verbs and absence as specified', () => {
    expect(
      verdictOf({ acceptedMemberCount: 0, relationTypes: ['supports'] }),
    ).toBe('insufficient-material');
    expect(
      verdictOf({ acceptedMemberCount: 1, relationTypes: ['contradicts'] }),
    ).toBe('contested');
    expect(
      verdictOf({
        acceptedMemberCount: 1,
        relationTypes: ['supports', 'qualifies'],
      }),
    ).toBe('qualified');
    expect(
      verdictOf({ acceptedMemberCount: 1, relationTypes: ['supports'] }),
    ).toBe('supported');
    expect(verdictOf({ acceptedMemberCount: 1, relationTypes: ['adds'] })).toBe(
      'unresolved',
    );
    expect(verdictOf({ acceptedMemberCount: 2, relationTypes: [] })).toBe(
      'unresolved',
    );
  });

  it('projects one claim and never invents a case-level verdict', () => {
    const revision = deriveEvidenceV2CaseRevision({
      caseId: 'case-1',
      occurrenceIds: ['occ-a'],
      reviewDecisionIds: [],
      claimIds: ['claim-1'],
      groupingDecisionIds: [],
      relationIds: ['relation-supports'],
      relationReviewIds: [],
    });
    const projection = projectEvidenceV2Consensus({
      caseId: 'case-1',
      revision,
      claims: [{ claim: CLAIM, acceptedMembers: [member('occ-a')] }],
      acceptedRelations: [relation('supports')],
    });
    expect(projection.claims).toHaveLength(1);
    expect(projection.claims[0]?.verdict).toBe('supported');
    expect(projection.aggregates.verdictCounts.supported).toBe(1);
    expect(projection).not.toHaveProperty('verdict');
    expect(projection.aggregates).not.toHaveProperty('verdict');
    for (const forbidden of ['score', 'weight', 'confidence', 'rank']) {
      expect(Object.keys(projection)).not.toContain(forbidden);
      expect(Object.keys(projection.claims[0] ?? {})).not.toContain(forbidden);
    }
  });

  it('treats an emptied claim as insufficient-material', () => {
    const revision = deriveEvidenceV2CaseRevision({
      caseId: 'case-1',
      occurrenceIds: [],
      reviewDecisionIds: [],
      claimIds: ['claim-1'],
      groupingDecisionIds: [],
      relationIds: [],
      relationReviewIds: [],
    });
    const projection = projectEvidenceV2Consensus({
      caseId: 'case-1',
      revision,
      claims: [{ claim: CLAIM, acceptedMembers: [] }],
      acceptedRelations: [relation('contradicts')],
    });
    expect(projection.claims[0]?.verdict).toBe('insufficient-material');
  });

  it('is deterministic', () => {
    const build = () =>
      projectEvidenceV2Consensus({
        caseId: 'case-1',
        revision: deriveEvidenceV2CaseRevision({
          caseId: 'case-1',
          occurrenceIds: ['occ-b', 'occ-a'],
          reviewDecisionIds: [],
          claimIds: ['claim-1'],
          groupingDecisionIds: [],
          relationIds: ['r2', 'r1'],
          relationReviewIds: [],
        }),
        claims: [
          {
            claim: CLAIM,
            acceptedMembers: [member('occ-b'), member('occ-a')],
          },
        ],
        acceptedRelations: [
          relation('qualifies', 'r2'),
          relation('adds', 'r1'),
        ],
      });
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
    expect(build().claims[0]?.verdict).toBe('qualified');
  });
});
