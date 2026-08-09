/**
 * Interface-owned run records (ADR-0021).
 *
 * A record says what a run was and where its evidence lives. The evidence
 * itself stays in whichever repository the composition selected, so deleting
 * the workspace loses history and nothing canonical.
 */

export const RUN_RECORD_VERSION = 'acme-run-record/1' as const;

export interface RunCaseRecord {
  readonly alias: string;
  /** Links a case back to the ledger the S4 inspector reads. */
  readonly executionId: string;
}

export interface RunStepRecord {
  readonly index: number;
  readonly kind: string;
  readonly status: 'passed' | 'failed' | 'skipped';
}

/**
 * Optional metadata for a live (non-mock) run (ADR-0023).
 * Never holds credentials.
 */
export interface LiveRunMetadata {
  readonly provider: string;
  readonly model: string;
  readonly confirmer: string;
  readonly maxModelCalls: number;
  readonly costCeilingMinor: number | null;
  readonly usage?: {
    readonly inputTokens?: number;
    readonly outputTokens?: number;
    readonly totalTokens?: number;
    readonly estimatedCostMinor?: number;
    readonly currency?: string;
  };
}

export interface RunRecord {
  readonly version: typeof RUN_RECORD_VERSION;
  readonly runId: string;
  readonly planName: string;
  readonly scenarioName: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly composition: {
    readonly repository: string;
    readonly gateway: string;
  };
  /** `cancelled` is additive (ADR-0027); older records are passed|failed only. */
  readonly status: 'passed' | 'failed' | 'cancelled';
  readonly steps: readonly RunStepRecord[];
  readonly cases: readonly RunCaseRecord[];
  readonly failure: {
    readonly stepIndex: number;
    readonly message: string;
  } | null;
  /** Present only for live-series runs. */
  readonly live?: LiveRunMetadata;
}

/**
 * A run identifier becomes a file name, so it is validated as one before any
 * path is built. This is the traversal defence for writes; reads use the
 * phase-2 reference rules.
 */
const SAFE_RUN_ID = /^[A-Za-z0-9._-]+$/u;

export function isSafeRunId(runId: string): boolean {
  return (
    runId.length > 0 &&
    runId !== '.' &&
    runId !== '..' &&
    SAFE_RUN_ID.test(runId)
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function stepStatus(value: unknown): RunStepRecord['status'] | null {
  return value === 'passed' || value === 'failed' || value === 'skipped'
    ? value
    : null;
}

/**
 * Read a stored record back.
 *
 * Returns `null` rather than throwing, so a caller can report one unreadable
 * record without losing the rest of the history. A format change must be
 * visible, never a silently shorter list.
 */
export function parseRunRecord(raw: unknown): RunRecord | null {
  if (!isObject(raw) || raw['version'] !== RUN_RECORD_VERSION) {
    return null;
  }
  const runId = text(raw['runId']);
  const planName = text(raw['planName']);
  const scenarioName = text(raw['scenarioName']);
  const startedAt = text(raw['startedAt']);
  const finishedAt = text(raw['finishedAt']);
  const composition = raw['composition'];
  const status = raw['status'];
  const steps = raw['steps'];
  const cases = raw['cases'];

  if (
    runId === null ||
    !isSafeRunId(runId) ||
    planName === null ||
    scenarioName === null ||
    startedAt === null ||
    finishedAt === null ||
    !isObject(composition) ||
    (status !== 'passed' && status !== 'failed' && status !== 'cancelled') ||
    !Array.isArray(steps) ||
    !Array.isArray(cases)
  ) {
    return null;
  }

  const repository = text(composition['repository']);
  const gateway = text(composition['gateway']);
  if (repository === null || gateway === null) {
    return null;
  }

  const parsedSteps: RunStepRecord[] = [];
  for (const entry of steps) {
    if (!isObject(entry)) {
      return null;
    }
    const kind = text(entry['kind']);
    const parsedStatus = stepStatus(entry['status']);
    const index = entry['index'];
    if (kind === null || parsedStatus === null || typeof index !== 'number') {
      return null;
    }
    parsedSteps.push({ index, kind, status: parsedStatus });
  }

  const parsedCases: RunCaseRecord[] = [];
  for (const entry of cases) {
    if (!isObject(entry)) {
      return null;
    }
    const alias = text(entry['alias']);
    const executionId = text(entry['executionId']);
    if (alias === null || executionId === null) {
      return null;
    }
    parsedCases.push({ alias, executionId });
  }

  const failure = raw['failure'];
  let parsedFailure: RunRecord['failure'] = null;
  if (isObject(failure)) {
    const message = text(failure['message']);
    const stepIndex = failure['stepIndex'];
    if (message === null || typeof stepIndex !== 'number') {
      return null;
    }
    parsedFailure = { stepIndex, message };
  }

  const liveRaw = raw['live'];
  let live: LiveRunMetadata | undefined;
  if (liveRaw !== undefined) {
    if (!isObject(liveRaw)) {
      return null;
    }
    const provider = text(liveRaw['provider']);
    const model = text(liveRaw['model']);
    const confirmer = text(liveRaw['confirmer']);
    const maxModelCalls = liveRaw['maxModelCalls'];
    const costCeilingMinor = liveRaw['costCeilingMinor'];
    if (
      provider === null ||
      model === null ||
      confirmer === null ||
      typeof maxModelCalls !== 'number' ||
      (costCeilingMinor !== null && typeof costCeilingMinor !== 'number')
    ) {
      return null;
    }
    const usageRaw = liveRaw['usage'];
    let usage: LiveRunMetadata['usage'];
    if (usageRaw !== undefined) {
      if (!isObject(usageRaw)) {
        return null;
      }
      usage = {
        ...(typeof usageRaw['inputTokens'] === 'number'
          ? { inputTokens: usageRaw['inputTokens'] }
          : {}),
        ...(typeof usageRaw['outputTokens'] === 'number'
          ? { outputTokens: usageRaw['outputTokens'] }
          : {}),
        ...(typeof usageRaw['totalTokens'] === 'number'
          ? { totalTokens: usageRaw['totalTokens'] }
          : {}),
        ...(typeof usageRaw['estimatedCostMinor'] === 'number'
          ? { estimatedCostMinor: usageRaw['estimatedCostMinor'] }
          : {}),
        ...(typeof usageRaw['currency'] === 'string'
          ? { currency: usageRaw['currency'] }
          : {}),
      };
    }
    live = {
      provider,
      model,
      confirmer,
      maxModelCalls,
      costCeilingMinor:
        costCeilingMinor === null || costCeilingMinor === undefined
          ? null
          : costCeilingMinor,
      ...(usage === undefined ? {} : { usage }),
    };
  }

  return {
    version: RUN_RECORD_VERSION,
    runId,
    planName,
    scenarioName,
    startedAt,
    finishedAt,
    composition: { repository, gateway },
    status,
    steps: parsedSteps,
    cases: parsedCases,
    failure: parsedFailure,
    ...(live === undefined ? {} : { live }),
  };
}
