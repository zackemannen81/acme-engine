import {
  available,
  unavailable,
  RUNS_VIEW_VERSION,
  VIEW_UNAVAILABLE,
  type ViewSection,
} from '../view.js';
import type { JobRecord } from '../job-record.js';
import type { RunRecord } from '../run-record.js';
import { isTerminalJobStatus } from '../job-record.js';

/**
 * S3 — run console and history (ADR-0021, ADR-0027).
 *
 * History is always a projection over terminal run records. Live progress is
 * available only when the host supplies job evidence (including an empty
 * list). Without job evidence the section stays unavailable — same honesty as
 * ADR-0021 for pure history-only callers.
 *
 * Status is copied from the runner's report or job record. The console
 * computes no verdict and never retries on anyone's behalf.
 */

export interface RunsEvidence {
  /** Records the workspace could read, in any order. */
  readonly records: readonly RunRecord[];
  /**
   * Files that exist but could not be read or decoded. Surfaced so a format
   * change shows up instead of silently shortening the history.
   */
  readonly unreadable?: readonly string[];
  /**
   * When present (even empty), progress is available (ADR-0027). Omit entirely
   * for pure history-only builds that have no job runner.
   */
  readonly jobs?: readonly JobRecord[];
  readonly unreadableJobs?: readonly string[];
}

export interface RunSummaryView {
  readonly runId: string;
  readonly planName: string;
  readonly scenarioName: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly status: 'passed' | 'failed' | 'cancelled';
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

export interface JobProgressView {
  readonly jobId: string;
  readonly runId: string;
  readonly planName: string;
  readonly scenarioName: string;
  readonly status: string;
  readonly queuedAt: string;
  readonly startedAt: string | null;
  readonly updatedAt: string;
  readonly finishedAt: string | null;
  readonly repository: string;
  readonly gateway: string;
  readonly stepIndex: number | null;
  readonly stepKind: string | null;
  readonly stepTotal: number | null;
  readonly message: string | null;
  readonly cancelRequestedAt: string | null;
  readonly runRecordWritten: boolean;
  readonly failureMessage: string | null;
}

export interface RunsView {
  readonly view: typeof RUNS_VIEW_VERSION;
  readonly progress: ViewSection<{
    readonly jobs: readonly JobProgressView[];
    readonly activeCount: number;
    readonly queuedCount: number;
    readonly unreadable: readonly string[];
  }>;
  readonly history: ViewSection<{
    readonly runs: readonly RunSummaryView[];
    readonly runCount: number;
    readonly passedCount: number;
    readonly failedCount: number;
    readonly cancelledCount: number;
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

function jobView(job: JobRecord): JobProgressView {
  return {
    jobId: job.jobId,
    runId: job.runId,
    planName: job.planName,
    scenarioName: job.scenarioName,
    status: job.status,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    finishedAt: job.finishedAt,
    repository: job.composition.repository,
    gateway: job.composition.gateway,
    stepIndex: job.progress.stepIndex,
    stepKind: job.progress.stepKind,
    stepTotal: job.progress.stepTotal,
    message: job.progress.message,
    cancelRequestedAt: job.cancelRequestedAt,
    runRecordWritten: job.runRecordWritten,
    failureMessage: job.failure?.message ?? null,
  };
}

/** Newest last, with `runId` breaking ties so equal instants still order. */
function compareRecords(left: RunRecord, right: RunRecord): number {
  if (left.startedAt !== right.startedAt) {
    return left.startedAt < right.startedAt ? -1 : 1;
  }
  return left.runId < right.runId ? -1 : left.runId > right.runId ? 1 : 0;
}

function compareJobs(left: JobRecord, right: JobRecord): number {
  if (left.queuedAt !== right.queuedAt) {
    return left.queuedAt < right.queuedAt ? -1 : 1;
  }
  return left.jobId < right.jobId ? -1 : left.jobId > right.jobId ? 1 : 0;
}

export function buildRunsView(evidence: RunsEvidence): RunsView {
  const ordered = [...evidence.records].sort(compareRecords);
  const runs = ordered.map(summary);

  const progress =
    evidence.jobs === undefined
      ? unavailable(VIEW_UNAVAILABLE.runProgress)
      : (() => {
          const jobs = [...evidence.jobs].sort(compareJobs).map(jobView);
          return available({
            jobs,
            activeCount: evidence.jobs.filter(
              (job) =>
                job.status === 'running' || job.status === 'cancelling',
            ).length,
            queuedCount: evidence.jobs.filter((job) => job.status === 'queued')
              .length,
            unreadable: [...(evidence.unreadableJobs ?? [])].sort(),
          });
        })();

  return {
    view: RUNS_VIEW_VERSION,
    progress,
    history: available({
      runs,
      runCount: runs.length,
      passedCount: runs.filter((entry) => entry.status === 'passed').length,
      failedCount: runs.filter((entry) => entry.status === 'failed').length,
      cancelledCount: runs.filter((entry) => entry.status === 'cancelled')
        .length,
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

/** Active (non-terminal) jobs first for console detail helpers. */
export function listActiveJobs(jobs: readonly JobRecord[]): readonly JobRecord[] {
  return jobs.filter((job) => !isTerminalJobStatus(job.status));
}
