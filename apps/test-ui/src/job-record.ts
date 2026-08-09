/**
 * Interface-owned job records (ADR-0027).
 *
 * A job tracks one background plan launch. It is never canonical ledger
 * state: deleting the workspace loses jobs and run history together and no
 * engine fact.
 */

export const JOB_RECORD_VERSION = 'acme-job-record/1' as const;

export type JobStatus =
  | 'queued'
  | 'running'
  | 'cancelling'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

export interface JobProgressSnapshot {
  readonly stepIndex: number | null;
  readonly stepKind: string | null;
  readonly stepTotal: number | null;
  readonly message: string | null;
}

export interface JobRecord {
  readonly version: typeof JOB_RECORD_VERSION;
  readonly jobId: string;
  /** Same as jobId for T1 (ADR-0027). */
  readonly runId: string;
  readonly planName: string;
  readonly scenarioName: string;
  readonly status: JobStatus;
  readonly queuedAt: string;
  readonly startedAt: string | null;
  readonly updatedAt: string;
  readonly finishedAt: string | null;
  readonly composition: {
    readonly repository: string;
    readonly gateway: string;
  };
  readonly progress: JobProgressSnapshot;
  readonly cancelRequestedAt: string | null;
  readonly runRecordWritten: boolean;
  readonly failure: {
    readonly message: string;
  } | null;
}

const SAFE_ID = /^[A-Za-z0-9._-]+$/u;

export function isSafeJobId(jobId: string): boolean {
  return (
    jobId.length > 0 && jobId !== '.' && jobId !== '..' && SAFE_ID.test(jobId)
  );
}

const STATUSES: ReadonlySet<string> = new Set([
  'queued',
  'running',
  'cancelling',
  'completed',
  'failed',
  'cancelled',
  'interrupted',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function optionalText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'string' ? value : null;
}

/**
 * Read a stored job back. Returns `null` rather than throwing so one
 * unreadable file cannot hide the rest of the queue.
 */
export function parseJobRecord(raw: unknown): JobRecord | null {
  if (!isObject(raw) || raw['version'] !== JOB_RECORD_VERSION) {
    return null;
  }
  const jobId = text(raw['jobId']);
  const runId = text(raw['runId']);
  const planName = text(raw['planName']);
  const scenarioName = text(raw['scenarioName']);
  const status = raw['status'];
  const queuedAt = text(raw['queuedAt']);
  const updatedAt = text(raw['updatedAt']);
  const composition = raw['composition'];
  const progress = raw['progress'];
  const runRecordWritten = raw['runRecordWritten'];

  if (
    jobId === null ||
    !isSafeJobId(jobId) ||
    runId === null ||
    !isSafeJobId(runId) ||
    planName === null ||
    scenarioName === null ||
    typeof status !== 'string' ||
    !STATUSES.has(status) ||
    queuedAt === null ||
    updatedAt === null ||
    !isObject(composition) ||
    !isObject(progress) ||
    typeof runRecordWritten !== 'boolean'
  ) {
    return null;
  }

  const repository = text(composition['repository']);
  const gateway = text(composition['gateway']);
  if (repository === null || gateway === null) {
    return null;
  }

  const stepIndex = progress['stepIndex'];
  const stepKind = progress['stepKind'];
  const stepTotal = progress['stepTotal'];
  const message = progress['message'];
  if (
    !(stepIndex === null || typeof stepIndex === 'number') ||
    !(stepKind === null || typeof stepKind === 'string') ||
    !(stepTotal === null || typeof stepTotal === 'number') ||
    !(message === null || typeof message === 'string')
  ) {
    return null;
  }

  const startedAt = optionalText(raw['startedAt']);
  const finishedAt = optionalText(raw['finishedAt']);
  const cancelRequestedAt = optionalText(raw['cancelRequestedAt']);

  // optionalText treats missing as null; empty string is invalid.
  if (raw['startedAt'] !== undefined && raw['startedAt'] !== null) {
    if (typeof raw['startedAt'] !== 'string' || raw['startedAt'].length === 0) {
      return null;
    }
  }
  if (raw['finishedAt'] !== undefined && raw['finishedAt'] !== null) {
    if (
      typeof raw['finishedAt'] !== 'string' ||
      raw['finishedAt'].length === 0
    ) {
      return null;
    }
  }
  if (
    raw['cancelRequestedAt'] !== undefined &&
    raw['cancelRequestedAt'] !== null
  ) {
    if (
      typeof raw['cancelRequestedAt'] !== 'string' ||
      raw['cancelRequestedAt'].length === 0
    ) {
      return null;
    }
  }

  const failureRaw = raw['failure'];
  let failure: JobRecord['failure'] = null;
  if (failureRaw !== null && failureRaw !== undefined) {
    if (!isObject(failureRaw)) {
      return null;
    }
    const failureMessage = text(failureRaw['message']);
    if (failureMessage === null) {
      return null;
    }
    failure = { message: failureMessage };
  }

  return {
    version: JOB_RECORD_VERSION,
    jobId,
    runId,
    planName,
    scenarioName,
    status: status as JobStatus,
    queuedAt,
    startedAt,
    updatedAt,
    finishedAt,
    composition: { repository, gateway },
    progress: {
      stepIndex: stepIndex === undefined ? null : stepIndex,
      stepKind: stepKind === undefined ? null : stepKind,
      stepTotal: stepTotal === undefined ? null : stepTotal,
      message: message === undefined ? null : message,
    },
    cancelRequestedAt,
    runRecordWritten,
    failure,
  };
}

export function emptyJobProgress(): JobProgressSnapshot {
  return {
    stepIndex: null,
    stepKind: null,
    stepTotal: null,
    message: null,
  };
}

export function isTerminalJobStatus(status: JobStatus): boolean {
  return (
    status === 'completed' ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'interrupted'
  );
}
