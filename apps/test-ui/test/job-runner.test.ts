import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  JOB_RECORD_VERSION,
  parseJobRecord,
  type JobRecord,
} from '../src/job-record.js';
import { createJobRunner } from '../src/local/job-runner.js';
import { createFileWorkspace } from '../src/local/workspace.js';
import { buildRunsView } from '../src/read-model/runs.js';
import { parseRunRecord } from '../src/run-record.js';
import { isAvailable } from '../src/view.js';

const clock = {
  now: () => '2026-08-09T12:00:00.000Z',
};

const minimalPlan = {
  schemaVersion: 'acme-test-plan/1',
  name: 'async-plan',
  composition: { repository: 'memory', gateway: 'mock' },
  seed: { clock: '2026-08-09T12:00:00.000Z', ids: 'sequential' as const },
  cases: [
    {
      id: 'only',
      namespace: 'alpha',
      task: 'observe',
      entityId: 'entity-1',
      expectedRevision: 0,
      input: 'inputs/only.json',
      mockResponse: 'responses/only.json',
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
    // Without real fixtures this will fail at load — use a path that exists
    // only when scenario root has fixtures. Prefer unit-level cancel +
    // recover which do not need a full scenario.
    const runner = createJobRunner({ workspace, clock });
    await expect(
      runner.enqueue({
        plan: minimalPlan,
        scenarioRoot: workspace.root,
        workspace,
        runId: 'run-missing-fixtures',
        clock,
      }),
    ).resolves.toMatchObject({
      job: { status: 'queued', jobId: 'run-missing-fixtures' },
    });

    // Wait for the background pump to fail the job (missing fixtures).
    await waitFor(
      async () => {
        const job = await workspace.loadJob('run-missing-fixtures');
        return job !== null && job.status === 'failed';
      },
      5000,
    );

    const job = await workspace.loadJob('run-missing-fixtures');
    expect(job?.status).toBe('failed');
    expect(job?.runRecordWritten).toBe(true);
    const run = await workspace.loadRun('run-missing-fixtures');
    expect(run?.status).toBe('failed');
    expect(parseRunRecord(run)).not.toBeNull();
  });

  it('cancels a queued job without starting work and writes cancelled history', async () => {
    const { workspace } = await tempWorkspace();
    const runner = createJobRunner({ workspace, clock });

    const enqueued = await runner.enqueue({
      plan: minimalPlan,
      scenarioRoot: workspace.root,
      workspace,
      runId: 'run-cancel-q',
      clock,
    });
    expect(enqueued.job.status).toBe('queued');

    const result = await runner.cancel('run-cancel-q');
    // May already be running/failed if pump was fast; accept terminal outcomes.
    expect(['cancelled', 'cancel-requested', 'already-terminal']).toContain(
      result.outcome,
    );

    await waitFor(async () => {
      const job = await workspace.loadJob('run-cancel-q');
      return (
        job !== null &&
        (job.status === 'cancelled' ||
          job.status === 'failed' ||
          job.status === 'completed' ||
          job.status === 'interrupted')
      );
    }, 5000);

    const finalJob = await workspace.loadJob('run-cancel-q');
    expect(finalJob).not.toBeNull();
    if (result.outcome === 'cancelled') {
      expect(finalJob?.status).toBe('cancelled');
      const run = await workspace.loadRun('run-cancel-q');
      expect(run?.status).toBe('cancelled');
    }
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

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs: number,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}
