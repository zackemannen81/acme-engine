/**
 * Observe windows: what one execution is asked about.
 *
 * A window is a bounded slice of one source part's citable units. ADR-0048 §4
 * bounds it at 24 units and roughly 800 quoted words — not to make an
 * enumeration obligation survivable, since §3 removed that obligation, but so
 * one request stays small and one refusal costs one small call.
 *
 * Windows are planned deterministically from stored units, so the call count is
 * known before anything is spent (R-09) and a window's identity is stable
 * enough to resume against (ADR-0048 §7).
 */

import { nodeHashing } from '@acme/core';

/** ADR-0048 §4. */
export const EVIDENCE_V2_WINDOW_MAX_UNITS = 24;

/** ADR-0048 §4. A soft target: one unit is never split to satisfy it. */
export const EVIDENCE_V2_WINDOW_TARGET_WORDS = 800;

export interface EvidenceV2WindowUnit {
  readonly unitId: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly exactQuote: string;
}

export interface EvidenceV2ObserveWindow {
  readonly windowId: string;
  readonly ordinal: number;
  readonly partId: string;
  readonly units: readonly EvidenceV2WindowUnit[];
}

export interface EvidenceV2WindowPart {
  readonly partId: string;
  readonly units: readonly EvidenceV2WindowUnit[];
}

function words(value: string): number {
  const trimmed = value.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/u).length;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/**
 * Plan every window for one chain instance, in part order then unit order.
 *
 * A part with no units contributes no window. The result is total over the
 * supplied units: every unit appears in exactly one window.
 */
export function planEvidenceV2ObserveWindows(
  parts: readonly EvidenceV2WindowPart[],
): readonly EvidenceV2ObserveWindow[] {
  const windows: EvidenceV2ObserveWindow[] = [];
  let ordinal = 0;

  for (const part of parts) {
    let batch: EvidenceV2WindowUnit[] = [];
    let batchWords = 0;

    const flush = (): void => {
      if (batch.length === 0) return;
      ordinal += 1;
      windows.push({
        windowId: `${part.partId}-window-${pad(windows.length + 1, 4)}`,
        ordinal,
        partId: part.partId,
        units: batch,
      });
      batch = [];
      batchWords = 0;
    };

    for (const unit of part.units) {
      const unitWords = words(unit.exactQuote);
      const full =
        batch.length >= EVIDENCE_V2_WINDOW_MAX_UNITS ||
        (batch.length > 0 &&
          batchWords + unitWords > EVIDENCE_V2_WINDOW_TARGET_WORDS);
      if (full) flush();
      batch.push(unit);
      batchWords += unitWords;
    }
    flush();
  }

  return windows;
}

/**
 * A window's request key.
 *
 * Derived from the artifact version, the part, the window ordinal and the
 * contract version, so re-running an extraction addresses the same execution
 * and a committed window is never re-sent (ADR-0048 §7).
 */
export function deriveEvidenceV2WindowRequestKey(input: {
  readonly artifactId: string;
  readonly windowId: string;
  readonly contractVersion: string;
}): string {
  const digest = nodeHashing.sha256(
    [input.artifactId, input.windowId, input.contractVersion].join('\n'),
  );
  return `evidence-v2-observe:${digest.slice(0, 32)}`;
}
