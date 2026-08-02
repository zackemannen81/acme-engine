import type { DiagnosticFact, ReplayReport } from '@acme/core';

import type { RedactionOptions } from '../redaction.js';
import {
  available,
  unavailable,
  REPLAY_VIEW_VERSION,
  VIEW_UNAVAILABLE,
  type ViewSection,
} from '../view.js';
import { diagnosticView, type DiagnosticView } from './shared.js';

/**
 * S7 — replay and digest comparison (ADR-0019).
 *
 * The status is the engine's verdict, copied. `ReplayReport` produces
 * `match | different | unavailable` and nothing else, so this view adds no
 * fourth outcome. "No replay was run" is a missing section, not a verdict.
 */

export interface ReplayEvidence {
  readonly executionId: string;
  /** `null` when no replay has been run for this execution. */
  readonly report?: ReplayReport | null;
  /** The digest recorded at commit, when the caller loaded it. */
  readonly recordedOperationDigest?: string | null;
}

export type ReplayViewOptions = RedactionOptions;

export interface DigestComparisonView {
  readonly recorded: string | null;
  readonly replayed: string | null;
  /**
   * `equal` and `different` are stated only when both digests exist.
   * Otherwise the comparison is `unavailable`, never a guessed match.
   */
  readonly comparison: 'equal' | 'different' | 'unavailable';
}

export interface ReplayView {
  readonly view: typeof REPLAY_VIEW_VERSION;
  readonly executionId: string;
  readonly outcome: ViewSection<{
    /** The engine's exact vocabulary. */
    readonly status: ReplayReport['status'];
    readonly mode: ReplayReport['mode'];
    readonly digest: DigestComparisonView;
    readonly differences: readonly DiagnosticView[];
    readonly differenceCount: number;
  }>;
  /** The commit-time digest, independent of whether a replay was run. */
  readonly recordedOperationDigest: string | null;
}

function compare(
  recorded: string | null,
  replayed: string | null,
): DigestComparisonView['comparison'] {
  if (recorded === null || replayed === null) {
    return 'unavailable';
  }
  return recorded === replayed ? 'equal' : 'different';
}

export function buildReplayView(
  evidence: ReplayEvidence,
  options: ReplayViewOptions = {},
): ReplayView {
  const report = evidence.report ?? null;
  const recordedDigest = evidence.recordedOperationDigest ?? null;
  if (report === null) {
    return {
      view: REPLAY_VIEW_VERSION,
      executionId: evidence.executionId,
      outcome: unavailable(VIEW_UNAVAILABLE.replayNotRun),
      recordedOperationDigest: recordedDigest,
    };
  }

  const recorded = report.recordedDigest ?? recordedDigest;
  const replayed = report.replayDigest ?? null;
  return {
    view: REPLAY_VIEW_VERSION,
    executionId: evidence.executionId,
    outcome: available({
      status: report.status,
      mode: report.mode,
      digest: {
        recorded: recorded ?? null,
        replayed,
        comparison: compare(recorded ?? null, replayed),
      },
      differences: report.differences.map((difference: DiagnosticFact) =>
        diagnosticView(difference, options),
      ),
      differenceCount: report.differences.length,
    }),
    recordedOperationDigest: recordedDigest,
  };
}
