import { describe, expect, it } from 'vitest';

import {
  buildPlanView,
  buildRunDetailView,
  buildRunsView,
  isAvailable,
  isSafeRunId,
  parseRunRecord,
  PLAN_VIEW_VERSION,
  RUNS_VIEW_VERSION,
  RUN_RECORD_VERSION,
  VIEW_UNAVAILABLE,
  type RunRecord,
} from '../src/index.js';

const plan = {
  schemaVersion: 'acme-test-plan/1',
  name: 'designer',
  seed: { clock: '2026-01-01T00:00:00.000Z', ids: 'sequential' },
  composition: { repository: 'memory', gateway: 'mock' },
  policy: { retention: 'hash-only' },
  cases: [
    {
      id: 'only',
      namespace: 'alpha',
      task: 'observe',
      entityId: 'entity-1',
      expectedRevision: 0,
      input: 'inputs/only.json',
      mockResponse: 'responses/only.json',
      expect: { status: 'committed', revision: 1 },
      replay: { mode: 'verify', expect: 'match' },
    },
  ],
};

function record(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    version: RUN_RECORD_VERSION,
    runId: 'run-001',
    planName: 'designer',
    scenarioName: 'designer',
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z',
    composition: { repository: 'memory', gateway: 'mock' },
    status: 'passed',
    steps: [
      { index: 0, kind: 'execute', status: 'passed' },
      { index: 1, kind: 'assert', status: 'passed' },
    ],
    cases: [{ alias: 'only', executionId: 'execution_abc' }],
    failure: null,
    ...overrides,
  };
}

describe('S2 plan designer', () => {
  it('previews the compiled artifact, not just the plan', () => {
    const view = buildPlanView(plan);

    expect(view.view).toBe(PLAN_VIEW_VERSION);
    expect(PLAN_VIEW_VERSION).toBe('acme-view-plan/1');
    expect(view.status).toBe('valid');
    if (!isAvailable(view.plan)) {
      throw new Error('plan should be available');
    }
    // What the runner will execute is on the surface, because that is the
    // artifact a reviewer approves.
    expect(view.plan.compiled.schemaVersion).toBe('acme-scenario/1');
    expect(view.plan.stepCount).toBe(3);
    expect(view.plan.caseCount).toBe(1);
    expect(JSON.parse(JSON.stringify(view)) as unknown).toStrictEqual(view);
  });

  it('shows the derived request key and the resolved policy per case', () => {
    const view = buildPlanView(plan);
    if (!isAvailable(view.plan)) {
      throw new Error('plan should be available');
    }
    const entry = view.plan.cases[0];

    expect(entry?.requestKey).toBe('designer-only');
    expect(entry?.policy).toMatchObject({ retention: 'hash-only' });
    expect(entry?.expectsStatus).toBe('committed');
    expect(entry?.replayExpect).toBe('match');
  });

  it('reports an invalid plan instead of throwing', () => {
    // A designer that crashes on a typo cannot show where the typo is.
    const view = buildPlanView({ ...plan, nonsense: true });

    expect(view.status).toBe('invalid');
    expect(view.error?.message).toContain('unexpected fields');
    expect(view.plan).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.planInvalid,
    });
  });

  it('states whether a request preview could be built', () => {
    expect(
      isAvailable(buildPlanView(plan).plan) &&
        buildPlanView(plan).plan.availability === 'available',
    ).toBe(true);

    const withoutFixtures = buildPlanView(plan);
    const withFixtures = buildPlanView(plan, {
      fixtures: {
        'inputs/only.json': { text: 'hello' },
        'responses/only.json': { selection: { profile: 'offline' } },
      },
    });

    if (!isAvailable(withoutFixtures.plan) || !isAvailable(withFixtures.plan)) {
      throw new Error('plans should be available');
    }
    expect(withoutFixtures.plan.requestPreviewAvailable).toBe(false);
    expect(withFixtures.plan.requestPreviewAvailable).toBe(true);
  });
});

describe('S3 run console and history', () => {
  it('reports no live progress when job evidence is omitted', () => {
    const view = buildRunsView({ records: [] });

    expect(view.view).toBe(RUNS_VIEW_VERSION);
    expect(view.progress).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.runProgress,
    });
    // History is available and empty, which is a different fact from a
    // history that could not be read.
    if (!isAvailable(view.history)) {
      throw new Error('history should be available');
    }
    expect(view.history.runCount).toBe(0);
    expect(view.history.cancelledCount).toBe(0);
  });

  it('reports available empty progress when a job runner supplies evidence', () => {
    const view = buildRunsView({ records: [], jobs: [] });

    if (!isAvailable(view.progress)) {
      throw new Error('progress should be available');
    }
    expect(view.progress.activeCount).toBe(0);
    expect(view.progress.queuedCount).toBe(0);
    expect(view.progress.jobs).toStrictEqual([]);
  });

  it('orders history by start time with the run id breaking ties', () => {
    const view = buildRunsView({
      records: [
        record({ runId: 'run-c', startedAt: '2026-01-02T00:00:00.000Z' }),
        record({ runId: 'run-b', startedAt: '2026-01-01T00:00:00.000Z' }),
        record({ runId: 'run-a', startedAt: '2026-01-01T00:00:00.000Z' }),
      ],
    });

    if (!isAvailable(view.history)) {
      throw new Error('history should be available');
    }
    expect(view.history.runs.map((entry) => entry.runId)).toStrictEqual([
      'run-a',
      'run-b',
      'run-c',
    ]);
  });

  it('counts outcomes and surfaces unreadable records', () => {
    const view = buildRunsView({
      records: [
        record({ runId: 'ok' }),
        record({
          runId: 'bad',
          status: 'failed',
          steps: [{ index: 0, kind: 'assert', status: 'failed' }],
          failure: { stepIndex: 0, message: 'status was blocked' },
        }),
      ],
      unreadable: ['broken.json'],
    });

    if (!isAvailable(view.history)) {
      throw new Error('history should be available');
    }
    expect(view.history.passedCount).toBe(1);
    expect(view.history.failedCount).toBe(1);
    expect(view.history.cancelledCount).toBe(0);
    // A record that would not parse is named, never quietly dropped.
    expect(view.history.unreadable).toStrictEqual(['broken.json']);
    expect(view.history.runs[0]?.failure?.message).toBe('status was blocked');
  });

  it('links a run to the executions the S4 inspector reads', () => {
    const detail = buildRunDetailView(record());

    expect(detail.executionIds).toStrictEqual(['execution_abc']);
    expect(detail.cases[0]).toStrictEqual({
      alias: 'only',
      executionId: 'execution_abc',
    });
    expect(detail.steps).toHaveLength(2);
  });
});

describe('run records', () => {
  it('refuses an identifier that is not a safe file name', () => {
    expect(isSafeRunId('run-001')).toBe(true);
    expect(isSafeRunId('run.2026_01')).toBe(true);
    expect(isSafeRunId('../escape')).toBe(false);
    expect(isSafeRunId('with/slash')).toBe(false);
    expect(isSafeRunId('..')).toBe(false);
    expect(isSafeRunId('')).toBe(false);
  });

  it('round-trips a record through JSON', () => {
    const parsed = parseRunRecord(
      JSON.parse(JSON.stringify(record())) as unknown,
    );

    expect(parsed).toStrictEqual(record());
  });

  it('returns null for an unknown version or malformed record', () => {
    expect(
      parseRunRecord({ ...record(), version: 'acme-run-record/2' }),
    ).toBeNull();
    expect(parseRunRecord({ ...record(), status: 'maybe' })).toBeNull();
    expect(parseRunRecord({ ...record(), runId: '../escape' })).toBeNull();
    expect(parseRunRecord('not an object')).toBeNull();
  });
});
