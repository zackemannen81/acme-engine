import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { Clock, JsonValue, PayloadEncryptor } from '@acme/core';
import { runScenario, seededIdGenerator } from '@acme/testing';

import { resolveReference } from '../catalog/paths.js';
import {
  emptyJobProgress,
  isTerminalJobStatus,
  JOB_RECORD_VERSION,
  type JobRecord,
  type JobStatus,
} from '../job-record.js';
import { compileTestPlan, type CompiledScenario } from '../plan/compile.js';
import { parseTestPlan } from '../plan/schema.js';
import {
  RUN_RECORD_VERSION,
  isSafeRunId,
  type RunCaseRecord,
  type RunRecord,
  type RunStepRecord,
} from '../run-record.js';
import {
  createInterfaceComposition,
  type InterfaceComposition,
} from './composition.js';
import type { Workspace } from './workspace.js';

/**
 * In-process plan job runner (ADR-0027).
 *
 * The workbench process owns workers: one running job at a time, cooperative
 * AbortSignal cancel, job files under the interface workspace. Never writes
 * the ledger except through runScenario → engine.
 */

export interface EnqueuePlanOptions {
  readonly plan: unknown;
  readonly scenarioRoot: string;
  readonly workspace: Workspace;
  readonly runId: string;
  readonly clock: Clock;
  readonly database?: string;
  readonly payloadEncryptor?: PayloadEncryptor;
}

export interface EnqueuePlanResult {
  readonly job: JobRecord;
}

export interface CancelJobResult {
  readonly job: JobRecord;
  readonly outcome: 'cancelled' | 'cancel-requested' | 'already-terminal';
}

interface PendingPayload {
  readonly options: EnqueuePlanOptions;
  readonly scenario: CompiledScenario;
  readonly planName: string;
  readonly repository: 'memory' | 'sqlite';
  readonly gateway: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function caseRecords(
  steps: readonly { readonly kind: string; readonly detail: JsonValue }[],
): readonly RunCaseRecord[] {
  const cases: RunCaseRecord[] = [];
  for (const step of steps) {
    if (step.kind !== 'execute' || !isObject(step.detail)) {
      continue;
    }
    const alias = step.detail['alias'];
    const executionId = step.detail['executionId'];
    if (typeof alias === 'string' && typeof executionId === 'string') {
      cases.push({ alias, executionId });
    }
  }
  return cases;
}

function fixturePath(root: string, requested: string): string {
  const resolved = resolveReference(requested);
  if (resolved.status === 'refused') {
    throw new Error(
      `A fixture reference must stay below the scenario root: ${requested}`,
    );
  }
  return join(root, ...resolved.path.split('/'));
}

export interface JobRunner {
  /** Mark non-terminal jobs left by a previous process as interrupted. */
  recoverInterrupted(): Promise<readonly JobRecord[]>;
  enqueue(options: EnqueuePlanOptions): Promise<EnqueuePlanResult>;
  cancel(jobId: string): Promise<CancelJobResult>;
  get(jobId: string): Promise<JobRecord | null>;
  list(): Promise<readonly JobRecord[]>;
  /**
   * Resolves when the wait queue is empty and no job is active. Used by tests
   * and hosts that need a barrier after enqueue without polling disk.
   */
  whenIdle(): Promise<void>;
}

export interface JobRunnerOptions {
  readonly workspace: Workspace;
  readonly clock: Clock;
}

export function createJobRunner(runnerOptions: JobRunnerOptions): JobRunner {
  const { workspace, clock } = runnerOptions;
  const active = new Map<string, AbortController>();
  const waitQueue: string[] = [];
  const pending = new Map<string, PendingPayload>();
  let pumping = false;
  let pumpCycle: Promise<void> = Promise.resolve();
  const idleWaiters: Array<() => void> = [];

  function notifyIdle(): void {
    if (waitQueue.length === 0 && active.size === 0 && !pumping) {
      while (idleWaiters.length > 0) {
        idleWaiters.shift()?.();
      }
    }
  }

  function whenIdle(): Promise<void> {
    if (waitQueue.length === 0 && active.size === 0 && !pumping) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      idleWaiters.push(resolve);
    });
  }

  async function writeJob(job: JobRecord): Promise<JobRecord> {
    await workspace.saveJob(job);
    return job;
  }

  /**
   * Serialize job-file updates per id so fire-and-forget progress patches
   * cannot clobber a later terminal write (read-modify-write race).
   */
  const patchTails = new Map<string, Promise<void>>();

  async function patch(
    jobId: string,
    update: (current: JobRecord) => JobRecord,
  ): Promise<JobRecord | null> {
    const previous = patchTails.get(jobId) ?? Promise.resolve();
    let release!: () => void;
    const done = new Promise<void>((resolve) => {
      release = resolve;
    });
    patchTails.set(
      jobId,
      previous.then(
        () => done,
        () => done,
      ),
    );
    await previous.catch(() => undefined);
    try {
      const current = await workspace.loadJob(jobId);
      if (current === null) {
        return null;
      }
      const next = update(current);
      // A stale progress patch must never revive a finished job.
      if (
        isTerminalJobStatus(current.status) &&
        !isTerminalJobStatus(next.status)
      ) {
        return current;
      }
      return await writeJob(next);
    } finally {
      release();
    }
  }

  async function recoverInterrupted(): Promise<readonly JobRecord[]> {
    const listed = await workspace.listJobs();
    const now = clock.now();
    const out: JobRecord[] = [];
    for (const job of listed.records) {
      if (isTerminalJobStatus(job.status)) {
        continue;
      }
      const next: JobRecord = {
        ...job,
        status: 'interrupted',
        updatedAt: now,
        finishedAt: now,
        failure: {
          message:
            'The workbench process stopped before this job finished; the ledger was not rewritten.',
        },
        progress: {
          ...job.progress,
          message: 'interrupted on host restart',
        },
      };
      await workspace.saveJob(next);
      out.push(next);
    }
    return out;
  }

  async function enqueue(
    enqueueOptions: EnqueuePlanOptions,
  ): Promise<EnqueuePlanResult> {
    if (!isSafeRunId(enqueueOptions.runId)) {
      throw new Error(
        `A run identifier must be a safe file name: ${JSON.stringify(enqueueOptions.runId)}`,
      );
    }
    if (
      active.has(enqueueOptions.runId) ||
      waitQueue.includes(enqueueOptions.runId)
    ) {
      throw new Error(
        `Run ${JSON.stringify(enqueueOptions.runId)} is already active.`,
      );
    }
    if ((await workspace.loadRun(enqueueOptions.runId)) !== null) {
      throw new Error(
        `Run ${JSON.stringify(enqueueOptions.runId)} already exists; existing history is never overwritten.`,
      );
    }
    const existingJob = await workspace.loadJob(enqueueOptions.runId);
    if (existingJob !== null && !isTerminalJobStatus(existingJob.status)) {
      throw new Error(
        `Job ${JSON.stringify(enqueueOptions.runId)} already exists.`,
      );
    }
    if (existingJob !== null && isTerminalJobStatus(existingJob.status)) {
      throw new Error(
        `Job ${JSON.stringify(enqueueOptions.runId)} already exists.`,
      );
    }

    const plan = parseTestPlan(enqueueOptions.plan);
    const compiled = compileTestPlan(plan);
    const now = clock.now();
    const job: JobRecord = {
      version: JOB_RECORD_VERSION,
      jobId: enqueueOptions.runId,
      runId: enqueueOptions.runId,
      planName: plan.name,
      scenarioName: compiled.scenario.name,
      status: 'queued',
      queuedAt: now,
      startedAt: null,
      updatedAt: now,
      finishedAt: null,
      composition: {
        repository: plan.composition.repository,
        gateway: plan.composition.gateway,
      },
      progress: {
        ...emptyJobProgress(),
        stepTotal: compiled.scenario.steps.length,
        message: 'queued',
      },
      cancelRequestedAt: null,
      runRecordWritten: false,
      failure: null,
    };

    pending.set(job.jobId, {
      options: enqueueOptions,
      scenario: compiled.scenario,
      planName: plan.name,
      repository: plan.composition.repository,
      gateway: plan.composition.gateway,
    });

    await writeJob(job);
    waitQueue.push(job.jobId);
    void pump();
    return { job };
  }

  async function cancel(jobId: string): Promise<CancelJobResult> {
    const job = await workspace.loadJob(jobId);
    if (job === null) {
      throw new Error(`Unknown job ${JSON.stringify(jobId)}.`);
    }
    if (isTerminalJobStatus(job.status)) {
      return { job, outcome: 'already-terminal' };
    }

    const now = clock.now();
    if (job.status === 'queued') {
      const idx = waitQueue.indexOf(jobId);
      if (idx >= 0) {
        waitQueue.splice(idx, 1);
      }
      pending.delete(jobId);
      const runRecord: RunRecord = {
        version: RUN_RECORD_VERSION,
        runId: job.runId,
        planName: job.planName,
        scenarioName: job.scenarioName,
        startedAt: job.queuedAt,
        finishedAt: now,
        composition: job.composition,
        status: 'cancelled',
        steps: [],
        cases: [],
        failure: {
          stepIndex: 0,
          message: 'Cancelled before the job started.',
        },
      };
      // Prefer writing the job terminal state even if history already exists
      // (e.g. a racing worker already recorded a run).
      let runRecordWritten = false;
      try {
        if ((await workspace.loadRun(job.runId)) === null) {
          await workspace.recordRun(runRecord);
        }
        runRecordWritten = true;
      } catch {
        runRecordWritten = (await workspace.loadRun(job.runId)) !== null;
      }
      const cancelled: JobRecord = {
        ...job,
        status: 'cancelled',
        updatedAt: now,
        finishedAt: now,
        cancelRequestedAt: now,
        failure: { message: 'Cancelled before the job started.' },
        progress: { ...job.progress, message: 'cancelled while queued' },
        runRecordWritten,
      };
      await writeJob(cancelled);
      notifyIdle();
      return { job: cancelled, outcome: 'cancelled' };
    }

    active.get(jobId)?.abort();
    const next: JobRecord = {
      ...job,
      status: 'cancelling',
      updatedAt: now,
      cancelRequestedAt: now,
      progress: { ...job.progress, message: 'cancel requested' },
    };
    await writeJob(next);
    return { job: next, outcome: 'cancel-requested' };
  }

  async function pump(): Promise<void> {
    if (pumping) {
      return pumpCycle;
    }
    pumping = true;
    pumpCycle = (async () => {
      try {
        while (waitQueue.length > 0 && active.size === 0) {
          const jobId = waitQueue.shift();
          if (jobId === undefined) {
            break;
          }
          try {
            await runOne(jobId);
          } catch {
            // Isolate one job failure from the queue pump.
          }
        }
      } finally {
        pumping = false;
        notifyIdle();
        if (waitQueue.length > 0 && active.size === 0) {
          void pump();
        }
      }
    })();
    return pumpCycle;
  }

  async function runOne(jobId: string): Promise<void> {
    const current = await workspace.loadJob(jobId);
    if (current === null || isTerminalJobStatus(current.status)) {
      pending.delete(jobId);
      return;
    }

    const payload = pending.get(jobId);
    pending.delete(jobId);
    if (payload === undefined) {
      // Cancel (or host) removed the payload after dequeue — do not leave
      // a permanent queued/running ghost.
      const now = clock.now();
      await patch(jobId, (job) => {
        if (isTerminalJobStatus(job.status)) {
          return job;
        }
        return {
          ...job,
          status: 'cancelled',
          updatedAt: now,
          finishedAt: now,
          cancelRequestedAt: job.cancelRequestedAt ?? now,
          failure: {
            message: 'Job was cancelled before the worker could start it.',
          },
          progress: { ...job.progress, message: 'cancelled' },
        };
      });
      return;
    }

    const controller = new AbortController();
    active.set(jobId, controller);
    const startedAt = clock.now();
    let composition: InterfaceComposition | undefined;

    await patch(jobId, (job) => ({
      ...job,
      status: 'running',
      startedAt,
      updatedAt: startedAt,
      progress: { ...job.progress, message: 'running' },
    }));

    try {
      const root = resolve(payload.options.scenarioRoot);
      const report = await runScenario({
        document: payload.scenario,
        signal: controller.signal,
        onStep(progress) {
          void patch(jobId, (job) => {
            if (isTerminalJobStatus(job.status)) {
              return job;
            }
            return {
              ...job,
              updatedAt: clock.now(),
              progress: {
                stepIndex: progress.index,
                stepKind: progress.kind,
                stepTotal: progress.stepTotal,
                message:
                  progress.phase === 'start'
                    ? `starting ${progress.kind}`
                    : `${progress.kind} ${progress.status ?? 'done'}`,
              },
            };
          });
        },
        composition(seed) {
          const built = createInterfaceComposition({
            repository: payload.repository,
            clock: { now: () => seed.clock },
            ids: seededIdGenerator(seed),
            ...(payload.options.database === undefined
              ? {}
              : { database: payload.options.database }),
            ...(payload.options.payloadEncryptor === undefined
              ? {}
              : { payloadEncryptor: payload.options.payloadEncryptor }),
          });
          composition = built;
          return built;
        },
        async loadFixture(requested) {
          const raw = await readFile(fixturePath(root, requested), 'utf8');
          return JSON.parse(raw) as JsonValue;
        },
      });

      const finishedAt = clock.now();
      const cancelled = controller.signal.aborted;
      const runStatus: RunRecord['status'] = cancelled
        ? 'cancelled'
        : report.status === 'passed'
          ? 'passed'
          : 'failed';

      const steps: readonly RunStepRecord[] = report.steps.map((step) => ({
        index: step.index,
        kind: step.kind,
        status: step.status,
      }));

      const failure =
        runStatus === 'cancelled'
          ? (report.failure ?? {
              stepIndex: 0,
              message: 'Cancelled while the scenario was running.',
            })
          : (report.failure ?? null);

      const record: RunRecord = {
        version: RUN_RECORD_VERSION,
        runId: jobId,
        planName: payload.planName,
        scenarioName: report.name,
        startedAt,
        finishedAt,
        composition: {
          repository: payload.repository,
          gateway: payload.gateway,
        },
        status: runStatus,
        steps,
        cases: caseRecords(report.steps),
        failure,
      };

      await workspace.recordRun(record);

      const terminal: JobStatus =
        runStatus === 'cancelled'
          ? 'cancelled'
          : runStatus === 'failed'
            ? 'failed'
            : 'completed';

      await patch(jobId, (job) => ({
        ...job,
        status: terminal,
        updatedAt: finishedAt,
        finishedAt,
        runRecordWritten: true,
        failure:
          terminal === 'completed'
            ? null
            : {
                message:
                  failure?.message ??
                  (terminal === 'cancelled'
                    ? 'Cancelled while the scenario was running.'
                    : 'Scenario failed.'),
              },
        progress: {
          ...job.progress,
          message: terminal,
        },
      }));
    } catch (error: unknown) {
      const finishedAt = clock.now();
      const message =
        error instanceof Error ? error.message : 'The job failed unexpectedly.';
      const cancelled = controller.signal.aborted;
      const runStatus: RunRecord['status'] = cancelled ? 'cancelled' : 'failed';
      const record: RunRecord = {
        version: RUN_RECORD_VERSION,
        runId: jobId,
        planName: payload.planName,
        scenarioName: payload.scenario.name,
        startedAt,
        finishedAt,
        composition: {
          repository: payload.repository,
          gateway: payload.gateway,
        },
        status: runStatus,
        steps: [],
        cases: [],
        failure: { stepIndex: 0, message },
      };
      let runWritten = false;
      try {
        if ((await workspace.loadRun(jobId)) === null) {
          await workspace.recordRun(record);
          runWritten = true;
        } else {
          runWritten = true;
        }
      } catch {
        // History write best-effort; job terminal state still matters.
      }
      await patch(jobId, (job) => ({
        ...job,
        status: cancelled ? 'cancelled' : 'failed',
        updatedAt: finishedAt,
        finishedAt,
        runRecordWritten: runWritten,
        failure: { message },
        progress: {
          ...job.progress,
          message: cancelled ? 'cancelled' : 'failed',
        },
      }));
    } finally {
      // Drain in-flight progress patches before releasing the active slot so
      // whenIdle cannot observe a still-running job file.
      await (patchTails.get(jobId) ?? Promise.resolve()).catch(() => undefined);
      composition?.close();
      active.delete(jobId);
    }
  }

  return {
    recoverInterrupted,
    enqueue,
    cancel,
    get: (jobId) => workspace.loadJob(jobId),
    list: async () => (await workspace.listJobs()).records,
    whenIdle,
  };
}

/** Convenience wrapper matching launchPlan's options shape (ADR-0027). */
export async function enqueuePlan(
  options: EnqueuePlanOptions,
  runner: JobRunner,
): Promise<EnqueuePlanResult> {
  return runner.enqueue(options);
}
