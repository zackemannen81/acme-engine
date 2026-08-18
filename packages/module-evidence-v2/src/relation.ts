/**
 * `Relation`: an L3 typed statement about two endpoints.
 *
 * A relation never deletes an endpoint. Creating one, accepting one or
 * rejecting one leaves both occurrences (or claims) and their standings
 * untouched. The four verbs are the requested model: contradicts, adds,
 * supports, qualifies. Comparable scope is recorded on four axes; a
 * contradiction whose actor or time is not comparable is unrepresentable
 * rather than merely discouraged.
 *
 * Standing is folded from an append-only review log, exactly as occurrence
 * standing is. The relation does not store a standing field.
 */

import { nodeHashing } from '@acme/core';
import { z } from 'zod';

import type { EvidenceV2Standing } from './review.js';

export const EVIDENCE_V2_RELATION_SCHEMA_VERSION = 'evidence-v2-relation/1';
export const EVIDENCE_V2_RELATION_REVIEW_SCHEMA_VERSION =
  'evidence-v2-relation-review/1';

export const EvidenceV2RelationTypeSchema = z.enum([
  'contradicts',
  'adds',
  'supports',
  'qualifies',
]);

export type EvidenceV2RelationType = z.infer<
  typeof EvidenceV2RelationTypeSchema
>;

export const EvidenceV2RelationEndpointKindSchema = z.enum([
  'occurrence',
  'claim',
]);

export type EvidenceV2RelationEndpointKind = z.infer<
  typeof EvidenceV2RelationEndpointKindSchema
>;

export const EvidenceV2RelationEndpointSchema = z
  .object({
    kind: EvidenceV2RelationEndpointKindSchema,
    id: z.string().min(1),
  })
  .strict();

export type EvidenceV2RelationEndpoint = z.infer<
  typeof EvidenceV2RelationEndpointSchema
>;

/**
 * Whether the two endpoints are comparable on one axis.
 *
 * `unknown` is a real answer: the source did not supply the axis. It is not
 * a missing field and not an invitation to infer one.
 */
export const EvidenceV2ScopeComparabilitySchema = z.enum([
  'comparable',
  'incomparable',
  'unknown',
]);

export type EvidenceV2ScopeComparability = z.infer<
  typeof EvidenceV2ScopeComparabilitySchema
>;

export const EvidenceV2ComparableScopeSchema = z
  .object({
    actor: EvidenceV2ScopeComparabilitySchema,
    time: EvidenceV2ScopeComparabilitySchema,
    location: EvidenceV2ScopeComparabilitySchema,
    entity: EvidenceV2ScopeComparabilitySchema,
  })
  .strict();

export type EvidenceV2ComparableScope = z.infer<
  typeof EvidenceV2ComparableScopeSchema
>;

export const EvidenceV2RelationProvenanceSchema = z.enum([
  'model-proposed',
  'reviewer-authored',
]);

export type EvidenceV2RelationProvenance = z.infer<
  typeof EvidenceV2RelationProvenanceSchema
>;

export const EvidenceV2RelationSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_V2_RELATION_SCHEMA_VERSION),
    relationId: z.string().min(1),
    caseId: z.string().min(1),
    artifactId: z.string().min(1),
    chainId: z.string().min(1),
    from: EvidenceV2RelationEndpointSchema,
    to: EvidenceV2RelationEndpointSchema,
    type: EvidenceV2RelationTypeSchema,
    comparableScope: EvidenceV2ComparableScopeSchema,
    rationale: z.string().min(1),
    provenance: EvidenceV2RelationProvenanceSchema,
    createdBy: z.string().min(1),
    createdAt: z.string().min(1),
    executionId: z.string().min(1).nullable(),
    contractVersion: z.string().min(1).nullable(),
    windowId: z.string().min(1).nullable(),
  })
  .strict();

export type EvidenceV2Relation = z.infer<typeof EvidenceV2RelationSchema>;

export const EvidenceV2RelationReviewActionSchema = z.enum([
  'accept',
  'reject',
  'revise',
]);

export type EvidenceV2RelationReviewAction = z.infer<
  typeof EvidenceV2RelationReviewActionSchema
>;

export const EvidenceV2RelationReviewDecisionSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_V2_RELATION_REVIEW_SCHEMA_VERSION),
    decisionId: z.string().min(1),
    caseId: z.string().min(1),
    relationId: z.string().min(1),
    action: EvidenceV2RelationReviewActionSchema,
    supersedes: z.string().min(1).nullable(),
    principal: z.string().min(1),
    decidedAt: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

export type EvidenceV2RelationReviewDecision = z.infer<
  typeof EvidenceV2RelationReviewDecisionSchema
>;

const STANDING_OF: Readonly<
  Record<EvidenceV2RelationReviewAction, EvidenceV2Standing>
> = {
  accept: 'accepted',
  reject: 'rejected',
  revise: 'needs-revision',
};

export function deriveEvidenceV2RelationId(input: {
  readonly caseId: string;
  readonly fromKind: EvidenceV2RelationEndpointKind;
  readonly fromId: string;
  readonly toKind: EvidenceV2RelationEndpointKind;
  readonly toId: string;
  readonly type: EvidenceV2RelationType;
  readonly createdAt: string;
}): string {
  const digest = nodeHashing.sha256(
    [
      input.caseId,
      input.fromKind,
      input.fromId,
      input.toKind,
      input.toId,
      input.type,
      input.createdAt,
    ].join('\n'),
  );
  return `relation-${digest.slice(0, 32)}`;
}

export function deriveEvidenceV2RelationReviewDecisionId(input: {
  readonly relationId: string;
  readonly action: EvidenceV2RelationReviewAction;
  readonly principal: string;
  readonly decidedAt: string;
}): string {
  const digest = nodeHashing.sha256(
    [input.relationId, input.action, input.principal, input.decidedAt].join(
      '\n',
    ),
  );
  return `relation-review-${digest.slice(0, 32)}`;
}

/**
 * A `contradicts` relation requires comparable actor and time.
 *
 * That is the product definition's scoped-relation rule. Location and entity
 * may be unknown; actor or time that is incomparable or unknown is not
 * enough to call two statements a contradiction.
 */
export function evidenceV2ContradictionScopeIssues(
  scope: EvidenceV2ComparableScope,
): readonly string[] {
  const issues: string[] = [];
  if (scope.actor !== 'comparable')
    issues.push('EVIDENCE_V2_CONTRADICTION_ACTOR_NOT_COMPARABLE');
  if (scope.time !== 'comparable')
    issues.push('EVIDENCE_V2_CONTRADICTION_TIME_NOT_COMPARABLE');
  return issues;
}

export interface EvidenceV2EffectiveRelationStanding {
  readonly relationId: string;
  readonly standing: EvidenceV2Standing;
  readonly decisionId: string | null;
  readonly principal: string | null;
  readonly decidedAt: string | null;
  readonly rationale: string | null;
  readonly decisionCount: number;
}

/**
 * Fold the relation-review log to effective standing.
 *
 * Pure and total. The latest decision per relation wins. A relation with no
 * decision is pending — including a model-proposed one nobody has looked at.
 * Reviewer authorship records an accept, so a human-authored relation is
 * never left pending by this fold.
 */
export function deriveEvidenceV2RelationStandings(
  relations: readonly Pick<EvidenceV2Relation, 'relationId'>[],
  decisions: readonly EvidenceV2RelationReviewDecision[],
): readonly EvidenceV2EffectiveRelationStanding[] {
  const latest = new Map<string, EvidenceV2RelationReviewDecision[]>();
  for (const decision of decisions) {
    const held = latest.get(decision.relationId) ?? [];
    held.push(decision);
    latest.set(decision.relationId, held);
  }
  return relations
    .map((relation) => {
      const history = latest.get(relation.relationId) ?? [];
      const last = history.at(-1);
      if (last === undefined) {
        return {
          relationId: relation.relationId,
          standing: 'pending' as const,
          decisionId: null,
          principal: null,
          decidedAt: null,
          rationale: null,
          decisionCount: 0,
        };
      }
      return {
        relationId: relation.relationId,
        standing: STANDING_OF[last.action],
        decisionId: last.decisionId,
        principal: last.principal,
        decidedAt: last.decidedAt,
        rationale: last.rationale,
        decisionCount: history.length,
      };
    })
    .sort((left, right) => left.relationId.localeCompare(right.relationId));
}

export interface EvidenceV2ResolvedEndpoint {
  readonly kind: EvidenceV2RelationEndpointKind;
  readonly id: string;
  readonly artifactId: string | null;
  readonly instanceKey: string | null;
  readonly partId: string | null;
  readonly startLine: number | null;
  readonly endLine: number | null;
  readonly exactQuote: string | null;
  readonly claimLabel: string | null;
  readonly standing: EvidenceV2Standing;
}

export interface EvidenceV2RelationProjection {
  readonly relation: EvidenceV2Relation;
  readonly standing: EvidenceV2Standing;
  readonly from: EvidenceV2ResolvedEndpoint;
  readonly to: EvidenceV2ResolvedEndpoint;
  readonly decisionCount: number;
}

export interface EvidenceV2RelationEndpointInput {
  readonly kind: EvidenceV2RelationEndpointKind;
  readonly id: string;
  readonly artifactId?: string;
  readonly instanceKey?: string;
  readonly partId?: string;
  readonly startLine?: number;
  readonly endLine?: number;
  readonly exactQuote?: string;
  readonly claimLabel?: string;
  readonly standing: EvidenceV2Standing;
}

function resolveEndpoint(
  endpoint: EvidenceV2RelationEndpoint,
  supplied: readonly EvidenceV2RelationEndpointInput[],
): EvidenceV2ResolvedEndpoint | undefined {
  const match = supplied.find(
    (item) => item.kind === endpoint.kind && item.id === endpoint.id,
  );
  if (match === undefined) return undefined;
  return {
    kind: match.kind,
    id: match.id,
    artifactId: match.artifactId ?? null,
    instanceKey: match.instanceKey ?? null,
    partId: match.partId ?? null,
    startLine: match.startLine ?? null,
    endLine: match.endLine ?? null,
    exactQuote: match.exactQuote ?? null,
    claimLabel: match.claimLabel ?? null,
    standing: match.standing,
  };
}

/**
 * Project one relation: both endpoints resolved, each with its own standing.
 *
 * Deterministic, recomputed on read, no model and no spend. A missing
 * endpoint is not invented — the caller must supply both or the projection
 * is refused. That is the same rule a claim uses for a missing contributor.
 */
export function projectEvidenceV2Relation(input: {
  readonly relation: EvidenceV2Relation;
  readonly standing: EvidenceV2EffectiveRelationStanding;
  readonly endpoints: readonly EvidenceV2RelationEndpointInput[];
}): EvidenceV2RelationProjection | undefined {
  const from = resolveEndpoint(input.relation.from, input.endpoints);
  const to = resolveEndpoint(input.relation.to, input.endpoints);
  if (from === undefined || to === undefined) return undefined;
  return {
    relation: input.relation,
    standing: input.standing.standing,
    from,
    to,
    decisionCount: input.standing.decisionCount,
  };
}
