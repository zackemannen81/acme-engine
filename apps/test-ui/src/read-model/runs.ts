import {
  available,
  unavailable,
  RUNS_VIEW_VERSION,
  VIEW_UNAVAILABLE,
  type ViewSection,
} from '../view.js';
import type { RunRecord } from '../run-record.js';

/**
 * S3 — run console and history (ADR-0021).
 *
 * The historical half is available. The live half is not: launching is a
 * synchronous call, nothing runs in the background, and there is no queue to
 * project. Reporting `unavailable` says that; a queue of depth one and a
 * progress value pinned at complete would describe a system that does not
 * exist.
 *
 * Status is copied from the runner's report. The console computes no verdict
 * and never retries on anyone's behalf.
 */

export interface RunsEvidence {
  /** Records the workspace could read, in any order. */
  readonly records: readonly RunRecord[];
  /**
   * Files that exist but could not be read or decoded. Surfaced so a format
   * change shows up instead of silently shortening the history.
   */
  readonly unreadable?: readonly string[];
}

export interface RunSummaryView {
  readonly runId: string;
  readonly planName: string;
  readonly scenarioName: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly status: 'passed' | 'failed';
  readonly repository: string;
  readonly gateway: string;
  readonly stepCount: number;
  readonly passedSteps: number;
  readonly failedSteps: number;
  readonly caseCount: number;
  /** Execution ids the S4 inspector can be pointed at. */
  readonly executionIds: readonly string[];
  readonly failure: {
    readonly stepIndex: number;
    readonly message: string;
  } | null;
}

export interface RunDetailView extends RunSummaryView {
  readonly steps: readonly {
    readonly index: number;
    readonly kind: string;
    readonly status: string;
  }[];
  readonly cases: readonly {
    readonly alias: string;
    readonly executionId: string;
  }[];
}

export interface RunsView {
  readonly view: typeof RUNS_VIEW_VERSION;
  /** Nothing runs in the background, so there is no queue to show. */
  readonly progress: ViewSection<never>;
  readonly history: ViewSection<{
    readonly runs: readonly RunSummaryView[];
    readonly runCount: number;
    readonly passedCount: number;
    readonly failedCount: number;
    readonly unreadable: readonly string[];
  }>;
}

function summary(record: RunRecord): RunSummaryView {
  return {
    runId: record.runId,
    planName: record.planName,
    scenarioName: record.scenarioName,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    status: record.status,
    repository: record.composition.repository,
    gateway: record.composition.gateway,
    stepCount: record.steps.length,
    passedSteps: record.steps.filter((step) => step.status === 'passed').length,
    failedSteps: record.steps.filter((step) => step.status === 'failed').length,
    caseCount: record.cases.length,
    executionIds: record.cases.map((entry) => entry.executionId),
    failure: record.failure,
  };
}

/** Newest last, with `runId` breaking ties so equal instants still order. */
function compareRecords(left: RunRecord, right: RunRecord): number {
  if (left.startedAt !== right.startedAt) {
    return left.startedAt < right.startedAt ? -1 : 1;
  }
  return left.runId < right.runId ? -1 : left.runId > right.runId ? 1 : 0;
}

export function buildRunsView(evidence: RunsEvidence): RunsView {
  const ordered = [...evidence.records].sort(compareRecords);
  const runs = ordered.map(summary);

  return {
    view: RUNS_VIEW_VERSION,
    progress: unavailable(VIEW_UNAVAILABLE.runProgress),
    history: available({
      runs,
      runCount: runs.length,
      passedCount: runs.filter((entry) => entry.status === 'passed').length,
      failedCount: runs.filter((entry) => entry.status === 'failed').length,
      unreadable: [...(evidence.unreadable ?? [])].sort(),
    }),
  };
}

/** One run in full, for the console's detail pane. */
export function buildRunDetailView(record: RunRecord): RunDetailView {
  return {
    ...summary(record),
    steps: record.steps.map((step) => ({
      index: step.index,
      kind: step.kind,
      status: step.status,
    })),
    cases: record.cases.map((entry) => ({
      alias: entry.alias,
      executionId: entry.executionId,
    })),
  };
}
