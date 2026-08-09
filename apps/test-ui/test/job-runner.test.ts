import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  JOB_RECORD_VERSION,
  emptyJobProgress,
  parseJobRecord,
  type JobRecord,
} from '../src/job-record.js';
import { createJobRunner } from '../src/local/job-runner.js';
import { createFileWorkspace } from '../src/local/workspace.js';
import { buildRunsView } from '../src/read-model/runs.js';
import { isAvailable } from '../src/view.js';

const clock = {
  now: () => '2026-08-09T12:00:00.000Z',
};

const scenarioRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'tests',
  'scenario',
  'files',
);

/** Valid plan that compiles and runs against narrative fixtures offline. */
const narrativePlan = {
  schemaVersion: 'acme-test-plan/1',
  name: 'async-plan',
  composition: { repository: 'memory', gateway: 'mock' },
  seed: {
    clock: '2026-08-09T12:00:00.000Z',
    ids: 'sequential' as const,
    idPrefix: 'async-job',
    idPadding: 3,
  },
  cases: [
    {
      id: 'observe',
      namespace: 'narrative',
      task: 'observe-document',
      entityId: 'story-async-job',
      expectedRevision: 0,
      input: 'inputs/chapter-1.json',
      mockResponse: 'responses/chapter-1.json',
    },
  ],
};

describe('job record parse', () => {
  it('accepts a well-formed job and rejects wrong versions', () => {
    const job: JobRecord = {
      version: JOB_RECORD_VERSION,
      jobId: 'job-1',
      runId: 'job-1',
      planName: 'p',
      scenarioName: 's',
      status: 'queued',
      queuedAt: '2026-08-09T12:00:00.000Z',
      startedAt: null,
      updatedAt: '2026-08-09T12:00:00.000Z',
      finishedAt: null,
      composition: { repository: 'memory', gateway: 'mock' },
      progress: {
        stepIndex: null,
        stepKind: null,
        stepTotal: 1,
        message: 'queued',
      },
      cancelRequestedAt: null,
      runRecordWritten: false,
      failure: null,
    };
    expect(parseJobRecord(job)?.jobId).toBe('job-1');
    expect(parseJobRecord({ ...job, version: 'acme-job-record/2' })).toBeNull();
    expect(parseJobRecord({ ...job, status: 'maybe' })).toBeNull();
  });
});

describe('JobRunner', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  async function tempWorkspace() {
    const root = await mkdtemp(join(tmpdir(), 'acme-job-'));
    dirs.push(root);
    const workspace = createFileWorkspace({ root });
    return { root, workspace };
  }

  it('enqueues, completes, and writes a terminal run record', async () => {
    const { workspace } = await tempWorkspace();
    const runner = createJobRunner({ workspace, clock });

    const { job: accepted } = await runner.enqueue({
      plan: narrativePlan,
      scenarioRoot,
      workspace,
      runId: 'run-ok',
      clock,
    });
    expect(accepted.status).toBe('queued');

    await runner.whenIdle();

    const job = await workspace.loadJob('run-ok');
    expect(job?.status).toBe('completed');
    expect(job?.runRecordWritten).toBe(true);
    const run = await workspace.loadRun('run-ok');
    expect(run?.status).toBe('passed');
    expect(run?.cases.length).toBeGreaterThan(0);
  });

  it('fails a job when fixtures are missing and still writes history', async () => {
    const { workspace } = await tempWorkspace();
    const runner = createJobRunner({ workspace, clock });

    await runner.enqueue({
      plan: narrativePlan,
      scenarioRoot: workspace.root, // empty — no fixtures
      workspace,
      runId: 'run-missing-fixtures',
      clock,
    });

    await runner.whenIdle();

    const job = await workspace.loadJob('run-missing-fixtures');
    expect(job?.status).toBe('failed');
    expect(job?.runRecordWritten).toBe(true);
    const run = await workspace.loadRun('run-missing-fixtures');
    expect(run?.status).toBe('failed');
  });

  it('cancels a queued job without starting work and writes cancelled history', async () => {
    const { workspace } = await tempWorkspace();
    const runner = createJobRunner({ workspace, clock });

    // Deterministic path: job is on disk as queued and not in the runner's
    // wait queue (payload never registered). Exercises cancel-while-queued
    // without racing the background pump.
    const queued: JobRecord = {
      version: JOB_RECORD_VERSION,
      jobId: 'run-cancel-q',
      runId: 'run-cancel-q',
      planName: 'async-plan',
      scenarioName: 'async-plan',
      status: 'queued',
      queuedAt: '2026-08-09T12:00:00.000Z',
      startedAt: null,
      updatedAt: '2026-08-09T12:00:00.000Z',
      finishedAt: null,
      composition: { repository: 'memory', gateway: 'mock' },
      progress: { ...emptyJobProgress(), stepTotal: 1, message: 'queued' },
      cancelRequestedAt: null,
      runRecordWritten: false,
      failure: null,
    };
    await workspace.saveJob(queued);

    const result = await runner.cancel('run-cancel-q');
    expect(result.outcome).toBe('cancelled');
    expect(result.job.status).toBe('cancelled');

    const finalJob = await workspace.loadJob('run-cancel-q');
    expect(finalJob).not.toBeNull();
    expect(finalJob?.status).toBe('cancelled');
    const run = await workspace.loadRun('run-cancel-q');
    expect(run?.status).toBe('cancelled');
  });

  it('marks non-terminal jobs interrupted on recover', async () => {
    const { workspace } = await tempWorkspace();
    const stranded: JobRecord = {
      version: JOB_RECORD_VERSION,
      jobId: 'orphaned',
      runId: 'orphaned',
      planName: 'p',
      scenarioName: 's',
      status: 'running',
      queuedAt: '2026-08-09T11:00:00.000Z',
      startedAt: '2026-08-09T11:00:01.000Z',
      updatedAt: '2026-08-09T11:00:01.000Z',
      finishedAt: null,
      composition: { repository: 'memory', gateway: 'mock' },
      progress: {
        stepIndex: 0,
        stepKind: 'execute',
        stepTotal: 1,
        message: 'running',
      },
      cancelRequestedAt: null,
      runRecordWritten: false,
      failure: null,
    };
    await workspace.saveJob(stranded);
    const runner = createJobRunner({ workspace, clock });
    const recovered = await runner.recoverInterrupted();
    expect(recovered).toHaveLength(1);
    expect(recovered[0]?.status).toBe('interrupted');
    expect((await workspace.loadJob('orphaned'))?.status).toBe('interrupted');
  });

  it('projects progress from job evidence without inventing verdicts', () => {
    const job: JobRecord = {
      version: JOB_RECORD_VERSION,
      jobId: 'j1',
      runId: 'j1',
      planName: 'p',
      scenarioName: 's',
      status: 'running',
      queuedAt: '2026-08-09T12:00:00.000Z',
      startedAt: '2026-08-09T12:00:01.000Z',
      updatedAt: '2026-08-09T12:00:02.000Z',
      finishedAt: null,
      composition: { repository: 'memory', gateway: 'mock' },
      progress: {
        stepIndex: 0,
        stepKind: 'execute',
        stepTotal: 3,
        message: 'starting execute',
      },
      cancelRequestedAt: null,
      runRecordWritten: false,
      failure: null,
    };
    const view = buildRunsView({ records: [], jobs: [job] });
    if (!isAvailable(view.progress)) {
      throw new Error('expected progress');
    }
    expect(view.progress.activeCount).toBe(1);
    expect(view.progress.jobs[0]?.stepKind).toBe('execute');
    expect(view.progress.jobs[0]?.status).toBe('running');
  });
});
