import { immutableEvidence } from './immutable.js';
import type { EvidenceTemporalBound } from './schemas.js';

export type EvidenceTemporalInterval =
  | {
      readonly kind: 'exact' | 'range' | 'approximate';
      readonly fromMs: number;
      readonly toMs: number;
    }
  | { readonly kind: 'unknown' };

function parseMs(value: string): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new RangeError(`Invalid temporal bound timestamp: ${value}`);
  }
  return ms;
}

/** evidence-temporal-overlap-1 closed intervals; unknown never overlaps. */
export function evidenceTemporalInterval(
  bound: EvidenceTemporalBound,
): EvidenceTemporalInterval {
  switch (bound.kind) {
    case 'exact': {
      const at = parseMs(bound.at);
      return { kind: 'exact', fromMs: at, toMs: at };
    }
    case 'range':
      return {
        kind: 'range',
        fromMs: parseMs(bound.from),
        toMs: parseMs(bound.to),
      };
    case 'approximate': {
      const center = parseMs(bound.center);
      const pad = bound.toleranceMinutes * 60_000;
      return {
        kind: 'approximate',
        fromMs: center - pad,
        toMs: center + pad,
      };
    }
    case 'unknown':
      return { kind: 'unknown' };
  }
}

export function evidenceTemporalOverlap(
  left: EvidenceTemporalBound,
  right: EvidenceTemporalBound,
): boolean {
  const a = evidenceTemporalInterval(left);
  const b = evidenceTemporalInterval(right);
  if (a.kind === 'unknown' || b.kind === 'unknown') return false;
  return a.fromMs <= b.toMs && b.fromMs <= a.toMs;
}

export interface EvidenceTimelineEntryInput {
  readonly observationId: string;
  readonly temporalBound: EvidenceTemporalBound;
}

export type EvidenceTimelineBandKind =
  'exact' | 'range' | 'approximate' | 'unknown' | 'ambiguity';

export interface EvidenceTimelineEntry {
  readonly entryId: string;
  readonly bandKind: EvidenceTimelineBandKind;
  readonly observationIds: readonly string[];
  readonly sortKey: string;
  readonly display: string;
  readonly temporalBound: EvidenceTemporalBound | null;
}

function displayBound(bound: EvidenceTemporalBound): string {
  switch (bound.kind) {
    case 'exact':
      return bound.at;
    case 'range':
      return `${bound.from} – ${bound.to}`;
    case 'approximate':
      return `${bound.center} ± ${String(bound.toleranceMinutes)} min`;
    case 'unknown':
      return `unknown (${bound.reason})`;
  }
}

function sortRank(bound: EvidenceTemporalBound): {
  readonly tier: number;
  readonly fromMs: number;
  readonly toMs: number;
} {
  const interval = evidenceTemporalInterval(bound);
  if (interval.kind === 'unknown') {
    return {
      tier: 3,
      fromMs: Number.POSITIVE_INFINITY,
      toMs: Number.POSITIVE_INFINITY,
    };
  }
  if (bound.kind === 'exact') {
    return { tier: 0, fromMs: interval.fromMs, toMs: interval.toMs };
  }
  if (bound.kind === 'range') {
    return { tier: 1, fromMs: interval.fromMs, toMs: interval.toMs };
  }
  return { tier: 2, fromMs: interval.fromMs, toMs: interval.toMs };
}

/**
 * Pure timeline ordering for evidence.build-timeline@1.0.0:
 * exact first, then non-overlapping ranges by start, then approximate,
 * then unknown; equal keys fall back to observation id. Overlapping
 * non-exact bounds form ambiguity bands. Precision is never invented.
 */
export function buildEvidenceTimelineEntries(
  inputs: readonly EvidenceTimelineEntryInput[],
): readonly EvidenceTimelineEntry[] {
  const sorted = [...inputs]
    .filter((item) => item.temporalBound !== null)
    .map((item) => ({
      observationId: item.observationId,
      temporalBound: item.temporalBound,
      rank: sortRank(item.temporalBound),
    }))
    .sort(
      (left, right) =>
        left.rank.tier - right.rank.tier ||
        left.rank.fromMs - right.rank.fromMs ||
        left.rank.toMs - right.rank.toMs ||
        left.observationId.localeCompare(right.observationId),
    );

  const entries: EvidenceTimelineEntry[] = [];
  let index = 0;
  while (index < sorted.length) {
    const current = sorted[index];
    if (current === undefined) break;
    if (current.temporalBound.kind === 'exact') {
      entries.push({
        entryId: `timeline:${current.observationId}`,
        bandKind: 'exact',
        observationIds: [current.observationId],
        sortKey: `${String(current.rank.tier)}:${String(current.rank.fromMs)}:${current.observationId}`,
        display: displayBound(current.temporalBound),
        temporalBound: current.temporalBound,
      });
      index += 1;
      continue;
    }
    if (current.temporalBound.kind === 'unknown') {
      entries.push({
        entryId: `timeline:${current.observationId}`,
        bandKind: 'unknown',
        observationIds: [current.observationId],
        sortKey: `${String(current.rank.tier)}:${current.observationId}`,
        display: displayBound(current.temporalBound),
        temporalBound: current.temporalBound,
      });
      index += 1;
      continue;
    }

    const group = [current];
    let cursor = index + 1;
    while (cursor < sorted.length) {
      const next = sorted[cursor];
      if (next === undefined) break;
      if (
        next.temporalBound.kind === 'exact' ||
        next.temporalBound.kind === 'unknown'
      ) {
        break;
      }
      const overlapsSome = group.some((member) =>
        evidenceTemporalOverlap(member.temporalBound, next.temporalBound),
      );
      if (!overlapsSome) break;
      group.push(next);
      cursor += 1;
    }

    if (group.length === 1) {
      entries.push({
        entryId: `timeline:${current.observationId}`,
        bandKind: current.temporalBound.kind,
        observationIds: [current.observationId],
        sortKey: `${String(current.rank.tier)}:${String(current.rank.fromMs)}:${current.observationId}`,
        display: displayBound(current.temporalBound),
        temporalBound: current.temporalBound,
      });
    } else {
      const observationIds = group
        .map(({ observationId }) => observationId)
        .sort();
      entries.push({
        entryId: `timeline-ambiguity:${observationIds.join(',')}`,
        bandKind: 'ambiguity',
        observationIds,
        sortKey: `${String(current.rank.tier)}:${String(current.rank.fromMs)}:${observationIds[0] ?? ''}`,
        display: `Ambiguity band spanning ${String(group.length)} bounds`,
        temporalBound: null,
      });
    }
    index = cursor;
  }

  return immutableEvidence(entries);
}
