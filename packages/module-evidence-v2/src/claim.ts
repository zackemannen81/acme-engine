/**
 * `Claim`: an L2 grouping target over occurrences.
 *
 * A claim never merges, never absorbs and never owns. Two occurrences grouped
 * under one claim remain two immutable occurrences with their own sources,
 * standings and provenance; the claim is a lens over them, and excluding one
 * changes nothing about it. Grouping is a recorded decision, not a mutation,
 * which is why membership is folded from an append-only log here exactly as
 * chain membership and standing are.
 *
 * A claim carries no truth value. It has a label and a statement of what it
 * groups, and nothing that reads as support, confidence or weight: consensus
 * is a separate projection with its own vocabulary, and a claim that scored
 * itself would pre-empt it.
 */

import { nodeHashing } from '@acme/core';
import { z } from 'zod';

import type {
  EvidenceV2EffectiveStanding,
  EvidenceV2Standing,
} from './review.js';

export const EVIDENCE_V2_CLAIM_SCHEMA_VERSION = 'evidence-v2-claim/1';

export const EvidenceV2ClaimSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_V2_CLAIM_SCHEMA_VERSION),
    claimId: z.string().min(1),
    caseId: z.string().min(1),
    /** What a person calls it. Short, and not an assertion. */
    label: z.string().min(1),
    /** What it groups, in the author's words. Still not an assertion. */
    statement: z.string().min(1),
    createdBy: z.string().min(1),
    createdAt: z.string().min(1),
  })
  .strict();

export type EvidenceV2Claim = z.infer<typeof EvidenceV2ClaimSchema>;

export const EvidenceV2ClaimGroupingActionSchema = z.enum([
  'include',
  'exclude',
]);

export type EvidenceV2ClaimGroupingAction = z.infer<
  typeof EvidenceV2ClaimGroupingActionSchema
>;

export const EvidenceV2ClaimGroupingDecisionSchema = z
  .object({
    schemaVersion: z.literal('evidence-v2-claim-grouping/1'),
    decisionId: z.string().min(1),
    caseId: z.string().min(1),
    claimId: z.string().min(1),
    artifactId: z.string().min(1),
    instanceKey: z.string().min(1),
    occurrenceId: z.string().min(1),
    action: EvidenceV2ClaimGroupingActionSchema,
    /** The decision this replaces. Null for the first on this pair. */
    supersedes: z.string().min(1).nullable(),
    /** Server-derived. This layer invents no principal and reads no clock. */
    principal: z.string().min(1),
    decidedAt: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

export type EvidenceV2ClaimGroupingDecision = z.infer<
  typeof EvidenceV2ClaimGroupingDecisionSchema
>;

export function deriveEvidenceV2ClaimId(input: {
  readonly caseId: string;
  readonly label: string;
  readonly createdAt: string;
}): string {
  const digest = nodeHashing.sha256(
    [input.caseId, input.label, input.createdAt].join('\n'),
  );
  return `claim-${digest.slice(0, 32)}`;
}

export function deriveEvidenceV2ClaimGroupingDecisionId(input: {
  readonly claimId: string;
  readonly occurrenceId: string;
  readonly action: EvidenceV2ClaimGroupingAction;
  readonly principal: string;
  readonly decidedAt: string;
}): string {
  const digest = nodeHashing.sha256(
    [
      input.claimId,
      input.occurrenceId,
      input.action,
      input.principal,
      input.decidedAt,
    ].join('\n'),
  );
  return `grouping-${digest.slice(0, 32)}`;
}

export interface EvidenceV2ClaimMembership {
  readonly occurrenceId: string;
  readonly artifactId: string;
  readonly instanceKey: string;
  readonly decisionId: string;
  readonly principal: string;
  readonly decidedAt: string;
  readonly rationale: string;
}

/**
 * Fold the grouping log to effective membership.
 *
 * Pure and total. The latest decision per (claim, occurrence) wins, and an
 * `exclude` removes the occurrence from the claim and from nowhere else — the
 * occurrence, its standing and its source are untouched, and the excluded
 * decision stays in the log.
 */
export function deriveEvidenceV2ClaimMemberships(
  claimId: string,
  decisions: readonly EvidenceV2ClaimGroupingDecision[],
): readonly EvidenceV2ClaimMembership[] {
  const latest = new Map<string, EvidenceV2ClaimGroupingDecision>();
  for (const decision of decisions) {
    if (decision.claimId !== claimId) continue;
    latest.set(decision.occurrenceId, decision);
  }
  const members: EvidenceV2ClaimMembership[] = [];
  for (const decision of latest.values()) {
    if (decision.action !== 'include') continue;
    members.push({
      occurrenceId: decision.occurrenceId,
      artifactId: decision.artifactId,
      instanceKey: decision.instanceKey,
      decisionId: decision.decisionId,
      principal: decision.principal,
      decidedAt: decision.decidedAt,
      rationale: decision.rationale,
    });
  }
  // Deterministic order, so the projection is byte-stable across reads.
  return members.sort((left, right) =>
    left.occurrenceId.localeCompare(right.occurrenceId),
  );
}

export interface EvidenceV2ClaimContributor {
  readonly occurrenceId: string;
  readonly artifactId: string;
  readonly instanceKey: string;
  readonly partId: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly exactQuote: string;
  readonly standing: EvidenceV2Standing;
  readonly groupedBy: string;
  readonly groupedAt: string;
  readonly rationale: string;
}

/**
 * J5: the claim projection.
 *
 * Deterministic, recomputed on read, no model and no spend. It reports what
 * the claim currently groups and where each contributor came from. It reports
 * no score, no weight and no verdict: what the grouped evidence adds up to is
 * the consensus projection's question, not this one's.
 */
export interface EvidenceV2ClaimProjection {
  readonly claim: EvidenceV2Claim;
  readonly contributors: readonly EvidenceV2ClaimContributor[];
  readonly contributorCount: number;
  /** How the grouped material is spread. This is what makes P2 visible. */
  readonly distinctInstances: number;
  readonly distinctArtifacts: number;
  readonly crossInstance: boolean;
  readonly standingCounts: Readonly<Record<EvidenceV2Standing, number>>;
  /**
   * An empty claim states that it is empty. It never reads as a claim that
   * asserts something with no evidence behind it.
   */
  readonly empty: boolean;
}

export interface EvidenceV2ClaimOccurrenceInput {
  readonly occurrenceId: string;
  readonly artifactId: string;
  readonly instanceKey: string;
  readonly partId: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly exactQuote: string;
}

export function projectEvidenceV2Claim(input: {
  readonly claim: EvidenceV2Claim;
  readonly memberships: readonly EvidenceV2ClaimMembership[];
  readonly occurrences: readonly EvidenceV2ClaimOccurrenceInput[];
  readonly standings: readonly EvidenceV2EffectiveStanding[];
}): EvidenceV2ClaimProjection {
  const occurrenceOf = new Map(
    input.occurrences.map((item) => [item.occurrenceId, item]),
  );
  const standingOf = new Map(
    input.standings.map((item) => [item.occurrenceId, item.standing]),
  );
  const contributors: EvidenceV2ClaimContributor[] = [];
  for (const membership of input.memberships) {
    const occurrence = occurrenceOf.get(membership.occurrenceId);
    // A membership whose occurrence the caller did not supply is skipped
    // rather than invented. The claim never owns the occurrence, so it cannot
    // reconstruct one that is not there.
    if (occurrence === undefined) continue;
    contributors.push({
      occurrenceId: occurrence.occurrenceId,
      artifactId: occurrence.artifactId,
      instanceKey: occurrence.instanceKey,
      partId: occurrence.partId,
      startLine: occurrence.startLine,
      endLine: occurrence.endLine,
      exactQuote: occurrence.exactQuote,
      standing: standingOf.get(occurrence.occurrenceId) ?? 'pending',
      groupedBy: membership.principal,
      groupedAt: membership.decidedAt,
      rationale: membership.rationale,
    });
  }
  const standingCounts: Record<EvidenceV2Standing, number> = {
    pending: 0,
    accepted: 0,
    rejected: 0,
    'needs-revision': 0,
  };
  for (const contributor of contributors)
    standingCounts[contributor.standing] += 1;
  const instances = new Set(contributors.map((item) => item.instanceKey));
  const artifacts = new Set(contributors.map((item) => item.artifactId));
  return {
    claim: input.claim,
    contributors,
    contributorCount: contributors.length,
    distinctInstances: instances.size,
    distinctArtifacts: artifacts.size,
    crossInstance: instances.size > 1,
    standingCounts,
    empty: contributors.length === 0,
  };
}
