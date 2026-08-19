/**
 * J6: consensus per claim.
 *
 * Pure derivation from accepted occurrences and accepted relations. The claim
 * is the only subject. Chain and case levels may count verdicts; they may
 * not invent one. Absence of accepted members is insufficient-material,
 * never a refutation. `adds` is material, not a stance.
 */

import type { EvidenceV2Claim } from './claim.js';
import type { EvidenceV2Relation } from './relation.js';
import type { EvidenceV2CaseRevision } from './timeline.js';

export const EVIDENCE_V2_CONSENSUS_SCHEMA_VERSION = 'evidence-v2-consensus/1';

export const EvidenceV2ConsensusVerdicts = [
  'supported',
  'contested',
  'qualified',
  'unresolved',
  'insufficient-material',
] as const;

export type EvidenceV2ConsensusVerdict =
  (typeof EvidenceV2ConsensusVerdicts)[number];

export interface EvidenceV2ConsensusContributor {
  readonly occurrenceId: string;
  readonly artifactId: string;
  readonly instanceKey: string;
  readonly partId: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly exactQuote: string;
}

export interface EvidenceV2ConsensusRelation {
  readonly relationId: string;
  readonly type: EvidenceV2Relation['type'];
}

export interface EvidenceV2ClaimConsensus {
  readonly claim: EvidenceV2Claim;
  readonly verdict: EvidenceV2ConsensusVerdict;
  readonly acceptedContributorCount: number;
  readonly acceptedRelationCounts: {
    readonly contradicts: number;
    readonly adds: number;
    readonly supports: number;
    readonly qualifies: number;
  };
  readonly contributors: readonly EvidenceV2ConsensusContributor[];
  readonly relations: readonly EvidenceV2ConsensusRelation[];
}

export interface EvidenceV2ConsensusProjection {
  readonly schemaVersion: typeof EVIDENCE_V2_CONSENSUS_SCHEMA_VERSION;
  readonly caseId: string;
  readonly revision: EvidenceV2CaseRevision;
  readonly claims: readonly EvidenceV2ClaimConsensus[];
  readonly aggregates: {
    readonly claimCount: number;
    readonly verdictCounts: Readonly<
      Record<EvidenceV2ConsensusVerdict, number>
    >;
  };
}

export interface EvidenceV2ConsensusClaimInput {
  readonly claim: EvidenceV2Claim;
  readonly acceptedMembers: readonly EvidenceV2ConsensusContributor[];
}

function emptyCounts(): {
  contradicts: number;
  adds: number;
  supports: number;
  qualifies: number;
} {
  return { contradicts: 0, adds: 0, supports: 0, qualifies: 0 };
}

export function verdictOf(input: {
  readonly acceptedMemberCount: number;
  readonly relationTypes: readonly EvidenceV2Relation['type'][];
}): EvidenceV2ConsensusVerdict {
  if (input.acceptedMemberCount === 0) return 'insufficient-material';
  const types = new Set(input.relationTypes);
  if (types.has('contradicts')) return 'contested';
  if (types.has('qualifies')) return 'qualified';
  if (types.has('supports')) return 'supported';
  return 'unresolved';
}

function relationTouchesClaim(
  relation: EvidenceV2Relation,
  claimId: string,
  memberIds: ReadonlySet<string>,
): boolean {
  const end = (endpoint: EvidenceV2Relation['from']): boolean =>
    (endpoint.kind === 'claim' && endpoint.id === claimId) ||
    (endpoint.kind === 'occurrence' && memberIds.has(endpoint.id));
  return end(relation.from) || end(relation.to);
}

export function projectEvidenceV2ClaimConsensus(input: {
  readonly claim: EvidenceV2Claim;
  readonly acceptedMembers: readonly EvidenceV2ConsensusContributor[];
  readonly acceptedRelations: readonly EvidenceV2Relation[];
}): EvidenceV2ClaimConsensus {
  const memberIds = new Set(
    input.acceptedMembers.map((item) => item.occurrenceId),
  );
  const touching = input.acceptedRelations.filter((relation) =>
    relationTouchesClaim(relation, input.claim.claimId, memberIds),
  );
  const counts = emptyCounts();
  for (const relation of touching) counts[relation.type] += 1;
  const contributors = [...input.acceptedMembers].sort((left, right) =>
    left.occurrenceId.localeCompare(right.occurrenceId),
  );
  const relations = touching
    .map((relation) => ({
      relationId: relation.relationId,
      type: relation.type,
    }))
    .sort((left, right) => left.relationId.localeCompare(right.relationId));
  return {
    claim: input.claim,
    verdict: verdictOf({
      acceptedMemberCount: contributors.length,
      relationTypes: touching.map((item) => item.type),
    }),
    acceptedContributorCount: contributors.length,
    acceptedRelationCounts: counts,
    contributors,
    relations,
  };
}

export function projectEvidenceV2Consensus(input: {
  readonly caseId: string;
  readonly revision: EvidenceV2CaseRevision;
  readonly claims: readonly EvidenceV2ConsensusClaimInput[];
  readonly acceptedRelations: readonly EvidenceV2Relation[];
}): EvidenceV2ConsensusProjection {
  const claims = input.claims
    .map((item) =>
      projectEvidenceV2ClaimConsensus({
        claim: item.claim,
        acceptedMembers: item.acceptedMembers,
        acceptedRelations: input.acceptedRelations,
      }),
    )
    .sort((left, right) =>
      left.claim.claimId.localeCompare(right.claim.claimId),
    );
  const verdictCounts: Record<EvidenceV2ConsensusVerdict, number> = {
    supported: 0,
    contested: 0,
    qualified: 0,
    unresolved: 0,
    'insufficient-material': 0,
  };
  for (const claim of claims) verdictCounts[claim.verdict] += 1;
  return {
    schemaVersion: EVIDENCE_V2_CONSENSUS_SCHEMA_VERSION,
    caseId: input.caseId,
    revision: input.revision,
    claims,
    aggregates: {
      claimCount: claims.length,
      verdictCounts,
    },
  };
}
