/**
 * J4 compare windows: what one comparison execution is asked about.
 *
 * A window pairs a bounded batch of the current instance's accepted
 * occurrences with a bounded batch of one earlier instance's accepted
 * occurrences. Extraction stays blind: this planner never runs during J3,
 * and its input is frozen accepted material, not raw source units.
 *
 * The call count is derived from those two sets before anything is spent,
 * and a window's identity is content-derived so a re-run addresses the same
 * execution (R-09, ADR-0048 §7 applied to compare).
 */

import { nodeHashing } from '@acme/core';

/** One side of a compare window. A single occurrence is never split. */
export const EVIDENCE_V2_COMPARE_MAX_CURRENT = 12;
export const EVIDENCE_V2_COMPARE_MAX_PRIOR = 12;
export const EVIDENCE_V2_COMPARE_TARGET_WORDS = 800;

export interface EvidenceV2CompareOccurrence {
  readonly occurrenceId: string;
  readonly instanceKey: string;
  readonly instanceOrdinal: number;
  readonly partId: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly exactQuote: string;
}

export interface EvidenceV2ComparePriorInstance {
  readonly instanceKey: string;
  readonly instanceOrdinal: number;
  readonly occurrences: readonly EvidenceV2CompareOccurrence[];
}

export interface EvidenceV2CompareWindow {
  readonly windowId: string;
  readonly ordinal: number;
  readonly currentInstanceKey: string;
  readonly priorInstanceKey: string;
  readonly current: readonly EvidenceV2CompareOccurrence[];
  readonly prior: readonly EvidenceV2CompareOccurrence[];
}

function words(value: string): number {
  const trimmed = value.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/u).length;
}

function batchOccurrences(
  items: readonly EvidenceV2CompareOccurrence[],
  maxItems: number,
): readonly (readonly EvidenceV2CompareOccurrence[])[] {
  const batches: EvidenceV2CompareOccurrence[][] = [];
  let batch: EvidenceV2CompareOccurrence[] = [];
  let batchWords = 0;

  const flush = (): void => {
    if (batch.length === 0) return;
    batches.push(batch);
    batch = [];
    batchWords = 0;
  };

  for (const item of items) {
    const itemWords = words(item.exactQuote);
    const full =
      batch.length >= maxItems ||
      (batch.length > 0 &&
        batchWords + itemWords > EVIDENCE_V2_COMPARE_TARGET_WORDS);
    if (full) flush();
    batch.push(item);
    batchWords += itemWords;
  }
  flush();
  return batches;
}

function windowIdOf(
  currentInstanceKey: string,
  priorInstanceKey: string,
  currentIds: readonly string[],
  priorIds: readonly string[],
): string {
  const digest = nodeHashing.sha256(
    [
      currentInstanceKey,
      priorInstanceKey,
      ...currentIds,
      '|',
      ...priorIds,
    ].join('\n'),
  );
  return `compare-${digest.slice(0, 32)}`;
}

/**
 * Plan every compare window for one current instance against earlier ones.
 *
 * Prior instances are visited in ordinal order. Each is crossed with the
 * current accepted set, both sides batched. An empty current set or an
 * empty prior set produces no window: there is nothing to compare, and that
 * is not a contradiction.
 *
 * The function is total over the supplied occurrences. It does not look up
 * standing — the caller supplies only accepted material.
 */
export function planEvidenceV2CompareWindows(input: {
  readonly currentInstanceKey: string;
  readonly current: readonly EvidenceV2CompareOccurrence[];
  readonly priors: readonly EvidenceV2ComparePriorInstance[];
}): readonly EvidenceV2CompareWindow[] {
  if (input.current.length === 0) return [];
  const currentSorted = [...input.current].sort((left, right) =>
    left.occurrenceId.localeCompare(right.occurrenceId),
  );
  const currentBatches = batchOccurrences(
    currentSorted,
    EVIDENCE_V2_COMPARE_MAX_CURRENT,
  );
  const priors = [...input.priors].sort(
    (left, right) => left.instanceOrdinal - right.instanceOrdinal,
  );

  const windows: EvidenceV2CompareWindow[] = [];
  let ordinal = 0;
  for (const prior of priors) {
    if (prior.occurrences.length === 0) continue;
    const priorSorted = [...prior.occurrences].sort((left, right) =>
      left.occurrenceId.localeCompare(right.occurrenceId),
    );
    const priorBatches = batchOccurrences(
      priorSorted,
      EVIDENCE_V2_COMPARE_MAX_PRIOR,
    );
    for (const currentBatch of currentBatches) {
      for (const priorBatch of priorBatches) {
        ordinal += 1;
        windows.push({
          windowId: windowIdOf(
            input.currentInstanceKey,
            prior.instanceKey,
            currentBatch.map((item) => item.occurrenceId),
            priorBatch.map((item) => item.occurrenceId),
          ),
          ordinal,
          currentInstanceKey: input.currentInstanceKey,
          priorInstanceKey: prior.instanceKey,
          current: currentBatch,
          prior: priorBatch,
        });
      }
    }
  }
  return windows;
}

export function deriveEvidenceV2CompareRequestKey(input: {
  readonly artifactId: string;
  readonly windowId: string;
  readonly contractVersion: string;
}): string {
  const digest = nodeHashing.sha256(
    [input.artifactId, input.windowId, input.contractVersion].join('\n'),
  );
  return `evidence-v2-compare:${digest.slice(0, 32)}`;
}
