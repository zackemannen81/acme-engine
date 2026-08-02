import {
  available,
  unavailable,
  MEASUREMENT_VIEW_VERSION,
  VIEW_UNAVAILABLE,
  type ViewSection,
} from '../view.js';
import type { RunRecord } from '../run-record.js';

/**
 * S8 — results and measurement (ADR-0022).
 *
 * The first surface that computes rather than projects, so the boundary is
 * drawn narrowly: a measure is a rate over recorded run records, it always
 * states its sample size, and it carries a threshold outcome only where a
 * human configured a threshold.
 *
 * There is no score, no weighting and no composite. Those are models, and a
 * lens is not entitled to invent one.
 */

export const MEASURE_IDS = [
  'runPassRate',
  'stepPassRate',
  'replayMatchRate',
] as const;

export type MeasureId = (typeof MEASURE_IDS)[number];

export interface MeasureThreshold {
  readonly min?: number;
  readonly max?: number;
}

export type MeasurementThresholds = Partial<
  Record<MeasureId, MeasureThreshold>
>;

export const BASELINE_VERSION = 'acme-measurement-baseline/1' as const;

export interface MeasurementBaseline {
  readonly version: typeof BASELINE_VERSION;
  readonly name: string;
  readonly capturedAt: string;
  /** Recorded values by measure; a measure that was unavailable is absent. */
  readonly values: Partial<Record<MeasureId, number>>;
}

export interface MeasurementEvidence {
  readonly records: readonly RunRecord[];
  readonly thresholds?: MeasurementThresholds;
  /** `null` or absent means no comparison is possible. */
  readonly baseline?: MeasurementBaseline | null;
}

export type ThresholdOutcome = 'met' | 'not-met' | 'unavailable';

export type BaselineComparison = 'improved' | 'unchanged' | 'regressed';

export interface MeasureView {
  readonly id: MeasureId;
  /** How many observations the rate stands on. Always stated. */
  readonly sampleSize: number;
  /** The numerator, so a reader can see the rate rather than trust it. */
  readonly observed: number;
  /** `unavailable` when the sample is empty; never a rate over nothing. */
  readonly rate: ViewSection<{ readonly value: number }>;
  /** `null` when nobody configured a bound; the measure then has no outcome. */
  readonly threshold: MeasureThreshold | null;
  readonly outcome: ThresholdOutcome | null;
  readonly baseline: ViewSection<{
    readonly value: number;
    readonly delta: number;
    readonly comparison: BaselineComparison;
  }>;
}

export interface MeasurementSeriesView {
  readonly runCount: number;
  readonly measures: readonly MeasureView[];
}

export interface MeasurementView {
  readonly view: typeof MEASUREMENT_VIEW_VERSION;
  readonly baselineName: string | null;
  /** Runs whose gateway was the deterministic mock. */
  readonly deterministic: MeasurementSeriesView;
  /**
   * Runs against any other gateway. Always empty today, because
   * `acme-test-plan/1` permits only `mock` — the partition exists so a live
   * run can never be aggregated into the deterministic series later.
   */
  readonly live: MeasurementSeriesView;
}

interface Tally {
  readonly observed: number;
  readonly sampleSize: number;
}

function tallyFor(measure: MeasureId, records: readonly RunRecord[]): Tally {
  if (measure === 'runPassRate') {
    return {
      observed: records.filter((record) => record.status === 'passed').length,
      sampleSize: records.length,
    };
  }

  const steps = records.flatMap((record) => record.steps);
  const considered =
    measure === 'replayMatchRate'
      ? steps.filter((step) => step.kind === 'replay')
      : steps;
  return {
    observed: considered.filter((step) => step.status === 'passed').length,
    sampleSize: considered.length,
  };
}

function outcomeFor(
  threshold: MeasureThreshold | null,
  rate: number | null,
): ThresholdOutcome | null {
  if (threshold === null) {
    // Nobody said what passing means, so nothing passed or failed.
    return null;
  }
  if (rate === null) {
    return 'unavailable';
  }
  if (threshold.min !== undefined && rate < threshold.min) {
    return 'not-met';
  }
  if (threshold.max !== undefined && rate > threshold.max) {
    return 'not-met';
  }
  return 'met';
}

function compare(current: number, previous: number): BaselineComparison {
  if (current === previous) {
    return 'unchanged';
  }
  return current > previous ? 'improved' : 'regressed';
}

function measureView(
  id: MeasureId,
  records: readonly RunRecord[],
  thresholds: MeasurementThresholds,
  baseline: MeasurementBaseline | null,
): MeasureView {
  const tally = tallyFor(id, records);
  const rate =
    tally.sampleSize === 0 ? null : tally.observed / tally.sampleSize;
  const threshold = thresholds[id] ?? null;
  const previous = baseline?.values[id];

  return {
    id,
    sampleSize: tally.sampleSize,
    observed: tally.observed,
    rate:
      rate === null
        ? unavailable(VIEW_UNAVAILABLE.measurementSampleEmpty)
        : available({ value: rate }),
    threshold,
    outcome: outcomeFor(threshold, rate),
    baseline:
      baseline === null || previous === undefined || rate === null
        ? unavailable(VIEW_UNAVAILABLE.baseline)
        : available({
            value: previous,
            delta: rate - previous,
            comparison: compare(rate, previous),
          }),
  };
}

function series(
  records: readonly RunRecord[],
  thresholds: MeasurementThresholds,
  baseline: MeasurementBaseline | null,
): MeasurementSeriesView {
  return {
    runCount: records.length,
    measures: MEASURE_IDS.map((id) =>
      measureView(id, records, thresholds, baseline),
    ),
  };
}

export function buildMeasurementView(
  evidence: MeasurementEvidence,
): MeasurementView {
  const thresholds = evidence.thresholds ?? {};
  const baseline = evidence.baseline ?? null;

  // Partitioned at the source: a live run is never in the deterministic
  // array, so it cannot be aggregated into a deterministic number.
  const deterministic = evidence.records.filter(
    (record) => record.composition.gateway === 'mock',
  );
  const live = evidence.records.filter(
    (record) => record.composition.gateway !== 'mock',
  );

  return {
    view: MEASUREMENT_VIEW_VERSION,
    baselineName: baseline?.name ?? null,
    deterministic: series(deterministic, thresholds, baseline),
    // A baseline captured from deterministic runs must not grade live ones.
    live: series(live, thresholds, null),
  };
}

/**
 * Capture the current deterministic measures as a baseline.
 *
 * Nothing promotes a baseline automatically (ADR-0022); a caller takes one
 * deliberately and stores it.
 */
export function captureBaseline(options: {
  readonly name: string;
  readonly capturedAt: string;
  readonly view: MeasurementView;
}): MeasurementBaseline {
  const values: Partial<Record<MeasureId, number>> = {};
  for (const measure of options.view.deterministic.measures) {
    if (measure.rate.availability === 'available') {
      values[measure.id] = measure.rate.value;
    }
  }
  return {
    version: BASELINE_VERSION,
    name: options.name,
    capturedAt: options.capturedAt,
    values,
  };
}
