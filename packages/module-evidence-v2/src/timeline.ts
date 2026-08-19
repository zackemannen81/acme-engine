/**
 * Timeline: the P3 temporal projection.
 *
 * Pure and total. It stores nothing. Dated items keep their typed bound.
 * Items with unknown or absent time sort last and are marked unordered so a
 * reader cannot mistake a stable identifier order for a clock.
 */

import { nodeHashing } from '@acme/core';

import type { EvidenceV2Claim } from './claim.js';
import type { EvidenceV2TemporalBound } from './occurrence.js';
import type { EvidenceV2Standing } from './review.js';

export const EVIDENCE_V2_CASE_REVISION_SCHEMA_VERSION =
  'evidence-v2-case-revision/1';

export interface EvidenceV2CaseRevision {
  readonly schemaVersion: typeof EVIDENCE_V2_CASE_REVISION_SCHEMA_VERSION;
  readonly caseId: string;
  readonly digest: string;
  readonly counts: {
    readonly occurrences: number;
    readonly reviewDecisions: number;
    readonly claims: number;
    readonly groupings: number;
    readonly relations: number;
    readonly relationReviews: number;
  };
}

export function deriveEvidenceV2CaseRevision(input: {
  readonly caseId: string;
  readonly occurrenceIds: readonly string[];
  readonly reviewDecisionIds: readonly string[];
  readonly claimIds: readonly string[];
  readonly groupingDecisionIds: readonly string[];
  readonly relationIds: readonly string[];
  readonly relationReviewIds: readonly string[];
}): EvidenceV2CaseRevision {
  const sort = (ids: readonly string[]): string[] => [...ids].sort();
  const digest = nodeHashing.sha256(
    [
      input.caseId,
      ...sort(input.occurrenceIds),
      ...sort(input.reviewDecisionIds),
      ...sort(input.claimIds),
      ...sort(input.groupingDecisionIds),
      ...sort(input.relationIds),
      ...sort(input.relationReviewIds),
    ].join('\n'),
  );
  return {
    schemaVersion: EVIDENCE_V2_CASE_REVISION_SCHEMA_VERSION,
    caseId: input.caseId,
    digest,
    counts: {
      occurrences: input.occurrenceIds.length,
      reviewDecisions: input.reviewDecisionIds.length,
      claims: input.claimIds.length,
      groupings: input.groupingDecisionIds.length,
      relations: input.relationIds.length,
      relationReviews: input.relationReviewIds.length,
    },
  };
}

export interface EvidenceV2TimelineOccurrenceInput {
  readonly occurrenceId: string;
  readonly artifactId: string;
  readonly instanceKey: string;
  readonly partId: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly exactQuote: string;
  readonly temporalBound: EvidenceV2TemporalBound | null;
  readonly standing: EvidenceV2Standing;
}

export interface EvidenceV2TimelineClaimInput {
  readonly claim: EvidenceV2Claim;
  readonly acceptedBounds: readonly (EvidenceV2TemporalBound | null)[];
}

export interface EvidenceV2TimelineItem {
  readonly kind: 'occurrence' | 'claim';
  readonly id: string;
  readonly label: string;
  readonly exactQuote: string | null;
  readonly artifactId: string | null;
  readonly partId: string | null;
  readonly startLine: number | null;
  readonly endLine: number | null;
  readonly instanceKey: string | null;
  readonly standing: EvidenceV2Standing | null;
  readonly temporalKind: EvidenceV2TemporalBound['kind'] | 'absent';
  readonly from: string | null;
  readonly to: string | null;
  readonly ordered: boolean;
}

export interface EvidenceV2TimelineProjection {
  readonly caseId: string;
  readonly revision: EvidenceV2CaseRevision;
  readonly items: readonly EvidenceV2TimelineItem[];
  readonly datedCount: number;
  readonly unorderedCount: number;
}

function claimBound(bounds: readonly (EvidenceV2TemporalBound | null)[]): {
  kind: EvidenceV2TemporalBound['kind'] | 'absent';
  from: string | null;
  to: string | null;
  ordered: boolean;
} {
  const dated = bounds.filter(
    (bound): bound is EvidenceV2TemporalBound =>
      bound !== null && bound.kind !== 'unknown' && bound.from !== null,
  );
  if (dated.length === 0) {
    return { kind: 'absent', from: null, to: null, ordered: false };
  }
  const froms = dated
    .map((item) => item.from)
    .filter((item): item is string => item !== null);
  const tos = dated
    .map((item) => item.to)
    .filter((item): item is string => item !== null);
  froms.sort();
  tos.sort();
  const kinds = new Set(dated.map((item) => item.kind));
  const kind = kinds.size === 1 ? (dated[0]?.kind ?? 'range') : 'range';
  return {
    kind,
    from: froms[0] ?? null,
    to: tos.at(-1) ?? froms.at(-1) ?? null,
    ordered: true,
  };
}

function occurrenceItem(
  occurrence: EvidenceV2TimelineOccurrenceInput,
): EvidenceV2TimelineItem {
  const bound = occurrence.temporalBound;
  const ordered =
    bound !== null && bound.kind !== 'unknown' && bound.from !== null;
  return {
    kind: 'occurrence',
    id: occurrence.occurrenceId,
    label: occurrence.occurrenceId,
    exactQuote: occurrence.exactQuote,
    artifactId: occurrence.artifactId,
    partId: occurrence.partId,
    startLine: occurrence.startLine,
    endLine: occurrence.endLine,
    instanceKey: occurrence.instanceKey,
    standing: occurrence.standing,
    temporalKind: bound?.kind ?? 'absent',
    from: bound?.from ?? null,
    to: bound?.to ?? null,
    ordered,
  };
}

function claimItem(
  input: EvidenceV2TimelineClaimInput,
): EvidenceV2TimelineItem {
  const bound = claimBound(input.acceptedBounds);
  return {
    kind: 'claim',
    id: input.claim.claimId,
    label: input.claim.label,
    exactQuote: null,
    artifactId: null,
    partId: null,
    startLine: null,
    endLine: null,
    instanceKey: null,
    standing: null,
    temporalKind: bound.kind,
    from: bound.from,
    to: bound.to,
    ordered: bound.ordered,
  };
}

function compareItems(
  left: EvidenceV2TimelineItem,
  right: EvidenceV2TimelineItem,
): number {
  if (left.ordered !== right.ordered) return left.ordered ? -1 : 1;
  if (left.ordered && right.ordered) {
    const from = (left.from ?? '').localeCompare(right.from ?? '');
    if (from !== 0) return from;
  }
  const kind = left.kind.localeCompare(right.kind);
  if (kind !== 0) return kind;
  return left.id.localeCompare(right.id);
}

/**
 * J6's sibling: the temporal projection. Deterministic, no spend.
 */
export function projectEvidenceV2Timeline(input: {
  readonly caseId: string;
  readonly revision: EvidenceV2CaseRevision;
  readonly occurrences: readonly EvidenceV2TimelineOccurrenceInput[];
  readonly claims: readonly EvidenceV2TimelineClaimInput[];
}): EvidenceV2TimelineProjection {
  const items = [
    ...input.occurrences.map(occurrenceItem),
    ...input.claims.map(claimItem),
  ].sort(compareItems);
  return {
    caseId: input.caseId,
    revision: input.revision,
    items,
    datedCount: items.filter((item) => item.ordered).length,
    unorderedCount: items.filter((item) => !item.ordered).length,
  };
}
