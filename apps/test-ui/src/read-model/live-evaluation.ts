import type { LiveEvaluationConfirmation } from '../live-gate.js';
import type { RunRecord } from '../run-record.js';
import {
  available,
  unavailable,
  LIVE_EVALUATION_VIEW_VERSION,
  VIEW_UNAVAILABLE,
  type ViewSection,
} from '../view.js';

/**
 * S10 — live evaluation (ADR-0023).
 *
 * Always a live-series surface. Deterministic mock runs do not appear here.
 * There is no quality score — only gate summary, outcomes and usage when
 * recorded.
 */

export interface LiveEvaluationEvidence {
  /** Validated confirmation, or null when the caller has none. */
  readonly confirmation?: LiveEvaluationConfirmation | null;
  readonly records: readonly RunRecord[];
  readonly unreadable?: readonly string[];
}

export interface LiveConfirmationView {
  readonly provider: string;
  readonly model: string;
  readonly caseCount: number;
  readonly maxModelCalls: number;
  readonly costCeilingMinor: number | null;
  readonly currency: string | null;
  readonly confirmer: string;
  readonly rationale: string;
}

export interface LiveRunSummaryView {
  readonly runId: string;
  readonly status: 'passed' | 'failed' | 'cancelled';
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly gateway: string;
  readonly provider: string | null;
  readonly model: string | null;
  readonly executionIds: readonly string[];
  readonly failureMessage: string | null;
}

export interface LiveCostView {
  readonly totalTokens: number | null;
  readonly estimatedCostMinor: number | null;
  readonly currency: string | null;
  readonly sampleSize: number;
}

export interface LiveEvaluationView {
  readonly view: typeof LIVE_EVALUATION_VIEW_VERSION;
  /** Fixed: this surface never mixes deterministic history. */
  readonly series: 'live';
  readonly confirmation: ViewSection<LiveConfirmationView>;
  readonly runs: {
    readonly runCount: number;
    readonly items: readonly LiveRunSummaryView[];
  };
  readonly cost: ViewSection<LiveCostView>;
  readonly unreadable: readonly string[];
}

function isLiveRecord(record: RunRecord): boolean {
  return record.composition.gateway !== 'mock';
}

function runSummary(record: RunRecord): LiveRunSummaryView {
  return {
    runId: record.runId,
    status: record.status,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    gateway: record.composition.gateway,
    provider: record.live?.provider ?? null,
    model: record.live?.model ?? null,
    executionIds: record.cases.map((entry) => entry.executionId),
    failureMessage: record.failure?.message ?? null,
  };
}

function costSection(
  liveRecords: readonly RunRecord[],
): ViewSection<LiveCostView> {
  let totalTokens = 0;
  let estimatedCostMinor = 0;
  let currency: string | null = null;
  let withTokens = 0;
  let withCost = 0;

  for (const record of liveRecords) {
    const usage = record.live?.usage;
    if (usage === undefined) {
      continue;
    }
    if (typeof usage.totalTokens === 'number') {
      totalTokens += usage.totalTokens;
      withTokens += 1;
    }
    if (typeof usage.estimatedCostMinor === 'number') {
      estimatedCostMinor += usage.estimatedCostMinor;
      withCost += 1;
      if (currency === null && usage.currency !== undefined) {
        currency = usage.currency;
      }
    }
  }

  if (withTokens === 0 && withCost === 0) {
    return unavailable(VIEW_UNAVAILABLE.liveCost);
  }

  return available({
    totalTokens: withTokens > 0 ? totalTokens : null,
    estimatedCostMinor: withCost > 0 ? estimatedCostMinor : null,
    currency,
    sampleSize: Math.max(withTokens, withCost),
  });
}

export function buildLiveEvaluationView(
  evidence: LiveEvaluationEvidence,
): LiveEvaluationView {
  const confirmation = evidence.confirmation ?? null;
  const liveRecords = [...evidence.records]
    .filter(isLiveRecord)
    .sort((left, right) =>
      left.runId < right.runId ? -1 : left.runId > right.runId ? 1 : 0,
    );

  return {
    view: LIVE_EVALUATION_VIEW_VERSION,
    series: 'live',
    confirmation:
      confirmation === null
        ? unavailable(VIEW_UNAVAILABLE.liveConfirmation)
        : available({
            provider: confirmation.provider,
            model: confirmation.model,
            caseCount: confirmation.caseCount,
            maxModelCalls: confirmation.maxModelCalls,
            costCeilingMinor: confirmation.costCeilingMinor,
            currency: confirmation.currency,
            confirmer: confirmation.confirmer,
            rationale: confirmation.rationale,
          }),
    runs: {
      runCount: liveRecords.length,
      items: liveRecords.map(runSummary),
    },
    cost: costSection(liveRecords),
    unreadable: [...(evidence.unreadable ?? [])].sort(),
  };
}
