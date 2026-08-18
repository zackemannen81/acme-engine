/**
 * `Review` / `Standing` over `ObservationOccurrence`.
 *
 * Decisions are appended and never updated; effective standing is folded from
 * the history on read and is never stored as a field. That is the domain
 * specification's rule, and it is what makes "who decided this, when, and on
 * what grounds" answerable for every occurrence rather than for the most
 * recent one only.
 *
 * Three actions, not four. The specification's vocabulary is "accept, reject,
 * revise or move", but §2.3 states that an occurrence belongs to a chain
 * instance by reference only and that re-chaining never touches it — moving is
 * already exercised by the chain membership decisions, and a second way to
 * re-chain could disagree with the first. `revise` edits nothing either: an
 * occurrence is immutable, and `revise` records that a reviewer wants it looked
 * at again.
 */

import { nodeHashing } from '@acme/core';
import { z } from 'zod';

export const EVIDENCE_V2_REVIEW_SCHEMA_VERSION = 'evidence-v2-review/1';

export const EvidenceV2ReviewActionSchema = z.enum([
  'accept',
  'reject',
  'revise',
]);

export type EvidenceV2ReviewAction = z.infer<
  typeof EvidenceV2ReviewActionSchema
>;

/**
 * `pending` is a state, not an absence.
 *
 * An occurrence nobody has looked at is materially different from one a
 * reviewer accepted, and a surface that renders both as blank says the same
 * thing about both.
 */
export const EvidenceV2StandingSchema = z.enum([
  'pending',
  'accepted',
  'rejected',
  'needs-revision',
]);

export type EvidenceV2Standing = z.infer<typeof EvidenceV2StandingSchema>;

const STANDING_OF: Readonly<
  Record<EvidenceV2ReviewAction, EvidenceV2Standing>
> = {
  accept: 'accepted',
  reject: 'rejected',
  revise: 'needs-revision',
};

export const EvidenceV2ReviewDecisionSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_V2_REVIEW_SCHEMA_VERSION),
    decisionId: z.string().min(1),
    artifactId: z.string().min(1),
    instanceKey: z.string().min(1),
    occurrenceId: z.string().min(1),
    action: EvidenceV2ReviewActionSchema,
    /** The decision this replaces. Null for the first decision on an occurrence. */
    supersedes: z.string().min(1).nullable(),
    /**
     * Server-derived. This layer invents no principal and reads no clock; a
     * principal named in a request body is not a principal.
     */
    principal: z.string().min(1),
    decidedAt: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

export type EvidenceV2ReviewDecision = z.infer<
  typeof EvidenceV2ReviewDecisionSchema
>;

/** Content-derived, so an identical retry is the same decision. */
export function deriveEvidenceV2ReviewDecisionId(input: {
  readonly occurrenceId: string;
  readonly action: EvidenceV2ReviewAction;
  readonly principal: string;
  readonly decidedAt: string;
  readonly rationale: string;
}): string {
  const digest = nodeHashing.sha256(
    [
      input.occurrenceId,
      input.action,
      input.principal,
      input.decidedAt,
      input.rationale,
    ].join('\n'),
  );
  return `review-${digest.slice(0, 32)}`;
}

export interface EvidenceV2EffectiveStanding {
  readonly occurrenceId: string;
  readonly standing: EvidenceV2Standing;
  /** The decision that produced it, or null while nobody has decided. */
  readonly decisionId: string | null;
  readonly principal: string | null;
  readonly decidedAt: string | null;
  readonly rationale: string | null;
  /** How many decisions this occurrence has accumulated. */
  readonly decisionCount: number;
}

/**
 * Fold the log to effective standing.
 *
 * Pure and total. Order comes from the stored append sequence the caller
 * supplies; `supersedes` makes the replacement explicit in the record rather
 * than leaving it implied by position alone, and a decision naming a
 * predecessor that is not in the log is still applied — the log is the
 * authority, and refusing to fold would hide history rather than protect it.
 */
export function deriveEvidenceV2Standings(
  occurrenceIds: readonly string[],
  decisions: readonly EvidenceV2ReviewDecision[],
): readonly EvidenceV2EffectiveStanding[] {
  const latest = new Map<string, EvidenceV2ReviewDecision>();
  const counts = new Map<string, number>();
  for (const decision of decisions) {
    latest.set(decision.occurrenceId, decision);
    counts.set(
      decision.occurrenceId,
      (counts.get(decision.occurrenceId) ?? 0) + 1,
    );
  }
  return occurrenceIds.map((occurrenceId) => {
    const decision = latest.get(occurrenceId);
    if (decision === undefined)
      return {
        occurrenceId,
        standing: 'pending' as const,
        decisionId: null,
        principal: null,
        decidedAt: null,
        rationale: null,
        decisionCount: 0,
      };
    return {
      occurrenceId,
      standing: STANDING_OF[decision.action],
      decisionId: decision.decisionId,
      principal: decision.principal,
      decidedAt: decision.decidedAt,
      rationale: decision.rationale,
      decisionCount: counts.get(occurrenceId) ?? 1,
    };
  });
}

/**
 * What a reviewer still has to do with one chain instance.
 *
 * Three distinct states, because collapsing them loses the difference between
 * "nothing has been extracted here" and "everything extracted here has been
 * decided" — and an instance that legitimately states nothing is in the second
 * group, not the first.
 */
export type EvidenceV2InstanceReviewState =
  'not-extracted' | 'pending-review' | 'reviewed';

export interface EvidenceV2InstanceCompletion {
  readonly instanceKey: string;
  readonly state: EvidenceV2InstanceReviewState;
  readonly occurrenceCount: number;
  readonly pendingCount: number;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly needsRevisionCount: number;
}

export function deriveEvidenceV2InstanceCompletion(input: {
  readonly instanceKey: string;
  readonly hasCommittedWindow: boolean;
  readonly standings: readonly EvidenceV2EffectiveStanding[];
}): EvidenceV2InstanceCompletion {
  const count = (standing: EvidenceV2Standing): number =>
    input.standings.filter((item) => item.standing === standing).length;
  const pendingCount = count('pending');
  const state: EvidenceV2InstanceReviewState = !input.hasCommittedWindow
    ? 'not-extracted'
    : pendingCount > 0
      ? 'pending-review'
      : 'reviewed';
  return {
    instanceKey: input.instanceKey,
    state,
    occurrenceCount: input.standings.length,
    pendingCount,
    acceptedCount: count('accepted'),
    rejectedCount: count('rejected'),
    needsRevisionCount: count('needs-revision'),
  };
}

/**
 * "Markera beviskedjan som klar", derived.
 *
 * A chain is complete when every one of its instances is `reviewed`. Nothing
 * is stored: a flag would be a second source of truth that the decision log
 * could contradict, and the log is the authority.
 */
export function deriveEvidenceV2ChainCompletion(
  instances: readonly EvidenceV2InstanceCompletion[],
): {
  readonly complete: boolean;
  readonly instanceCount: number;
  readonly reviewedCount: number;
  readonly pendingReviewCount: number;
  readonly notExtractedCount: number;
} {
  const of = (state: EvidenceV2InstanceReviewState): number =>
    instances.filter((item) => item.state === state).length;
  const reviewedCount = of('reviewed');
  return {
    complete: instances.length > 0 && reviewedCount === instances.length,
    instanceCount: instances.length,
    reviewedCount,
    pendingReviewCount: of('pending-review'),
    notExtractedCount: of('not-extracted'),
  };
}
