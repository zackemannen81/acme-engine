import { describe, expect, it } from 'vitest';

import {
  APPROVAL_REFUSAL,
  ApprovalRefused,
  BASELINE_VERSION,
  buildFixtureReviewView,
  buildMeasurementView,
  captureBaseline,
  decideFixtureChange,
  FIXTURE_APPROVAL_VERSION,
  FIXTURE_REVIEW_VIEW_VERSION,
  isAvailable,
  MEASUREMENT_VIEW_VERSION,
  MEASURE_IDS,
  parseFixtureApproval,
  RUN_RECORD_VERSION,
  VIEW_UNAVAILABLE,
  type FixtureChangeProposal,
  type MeasureId,
  type MeasureView,
  type RunRecord,
} from '../src/index.js';

function record(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    version: RUN_RECORD_VERSION,
    runId: 'run-001',
    planName: 'plan',
    scenarioName: 'plan',
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z',
    composition: { repository: 'memory', gateway: 'mock' },
    status: 'passed',
    steps: [
      { index: 0, kind: 'execute', status: 'passed' },
      { index: 1, kind: 'replay', status: 'passed' },
    ],
    cases: [{ alias: 'only', executionId: 'execution_a' }],
    failure: null,
    ...overrides,
  };
}

function measure(
  view: ReturnType<typeof buildMeasurementView>,
  id: MeasureId,
): MeasureView {
  const found = view.deterministic.measures.find((entry) => entry.id === id);
  if (found === undefined) {
    throw new Error(`missing measure ${id}`);
  }
  return found;
}

const proposal: FixtureChangeProposal = {
  proposalId: 'proposal-001',
  fixturePath: 'digests/narrative.json',
  expectedDigest: 'aaa',
  proposedDigest: 'bbb',
  runId: 'run-001',
  executionId: 'execution_a',
};

describe('S8 measurement', () => {
  it('states a sample size beside every rate', () => {
    const view = buildMeasurementView({
      records: [record(), record({ runId: 'run-002', status: 'failed' })],
    });

    expect(view.view).toBe(MEASUREMENT_VIEW_VERSION);
    expect(view.deterministic.measures.map((entry) => entry.id)).toStrictEqual([
      ...MEASURE_IDS,
    ]);

    const runs = measure(view, 'runPassRate');
    expect(runs.sampleSize).toBe(2);
    expect(runs.observed).toBe(1);
    if (!isAvailable(runs.rate)) {
      throw new Error('rate should be available');
    }
    expect(runs.rate.value).toBe(0.5);
    expect(JSON.parse(JSON.stringify(view)) as unknown).toStrictEqual(view);
  });

  it('reports an empty series as unavailable, not as a perfect rate', () => {
    const view = buildMeasurementView({ records: [] });

    for (const entry of view.deterministic.measures) {
      // A replay match rate of 100 percent across zero replays is not good
      // news, and showing it as good news is worse than showing nothing.
      expect(entry.rate).toStrictEqual({
        availability: 'unavailable',
        reason: VIEW_UNAVAILABLE.measurementSampleEmpty,
      });
      expect(entry.sampleSize).toBe(0);
    }
  });

  it('counts only replay steps for the replay match rate', () => {
    const view = buildMeasurementView({
      records: [
        record({
          steps: [
            { index: 0, kind: 'execute', status: 'passed' },
            { index: 1, kind: 'replay', status: 'failed' },
            { index: 2, kind: 'assert', status: 'passed' },
          ],
        }),
      ],
    });

    const replay = measure(view, 'replayMatchRate');
    expect(replay.sampleSize).toBe(1);
    expect(replay.observed).toBe(0);
    const steps = measure(view, 'stepPassRate');
    expect(steps.sampleSize).toBe(3);
    expect(steps.observed).toBe(2);
  });

  it('has no outcome where no threshold was configured', () => {
    const view = buildMeasurementView({ records: [record()] });

    const runs = measure(view, 'runPassRate');
    // Nobody said what passing means, so nothing passed or failed.
    expect(runs.threshold).toBeNull();
    expect(runs.outcome).toBeNull();
  });

  it('states met and not-met only against a configured threshold', () => {
    const met = buildMeasurementView({
      records: [record()],
      thresholds: { runPassRate: { min: 1 } },
    });
    const missed = buildMeasurementView({
      records: [record(), record({ runId: 'run-002', status: 'failed' })],
      thresholds: { runPassRate: { min: 1 } },
    });

    expect(measure(met, 'runPassRate').outcome).toBe('met');
    expect(measure(missed, 'runPassRate').outcome).toBe('not-met');
  });

  it('cannot meet a threshold with no sample', () => {
    const view = buildMeasurementView({
      records: [],
      thresholds: { runPassRate: { min: 1 } },
    });

    expect(measure(view, 'runPassRate').outcome).toBe('unavailable');
  });

  it('makes no comparison without a baseline', () => {
    const view = buildMeasurementView({ records: [record()] });

    expect(view.baselineName).toBeNull();
    // A series measured once has not improved and has not regressed.
    expect(measure(view, 'runPassRate').baseline).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.baseline,
    });
  });

  it('compares against a captured baseline', () => {
    const first = buildMeasurementView({
      records: [record(), record({ runId: 'run-002', status: 'failed' })],
    });
    const baseline = captureBaseline({
      name: 'nightly',
      capturedAt: '2026-01-01T00:00:00.000Z',
      view: first,
    });
    expect(baseline.version).toBe(BASELINE_VERSION);
    expect(baseline.values.runPassRate).toBe(0.5);

    const better = buildMeasurementView({ records: [record()], baseline });
    const runs = measure(better, 'runPassRate');

    expect(better.baselineName).toBe('nightly');
    if (!isAvailable(runs.baseline)) {
      throw new Error('baseline should be available');
    }
    expect(runs.baseline.value).toBe(0.5);
    expect(runs.baseline.delta).toBe(0.5);
    expect(runs.baseline.comparison).toBe('improved');
  });

  it('never aggregates a live run into the deterministic series', () => {
    const view = buildMeasurementView({
      records: [
        record(),
        record({
          runId: 'run-live',
          status: 'failed',
          composition: { repository: 'memory', gateway: 'openai' },
        }),
      ],
      thresholds: { runPassRate: { min: 1 } },
    });

    expect(view.deterministic.runCount).toBe(1);
    expect(view.live.runCount).toBe(1);
    // The failing live run must not drag the deterministic rate below its
    // threshold.
    expect(measure(view, 'runPassRate').outcome).toBe('met');
    const liveRuns = view.live.measures.find(
      (entry) => entry.id === 'runPassRate',
    );
    expect(liveRuns?.sampleSize).toBe(1);
    expect(liveRuns?.observed).toBe(0);
    // A baseline captured from deterministic runs does not grade live ones.
    expect(liveRuns?.baseline.availability).toBe('unavailable');
  });

  it('produces the same numbers for the same records', () => {
    const records = [record(), record({ runId: 'run-002', status: 'failed' })];
    const once = buildMeasurementView({ records });
    const twice = buildMeasurementView({ records: [...records].reverse() });

    expect(twice).toStrictEqual(once);
  });
});

describe('S9 fixture review', () => {
  it('refuses an approval without an approver or a rationale', () => {
    const base = {
      proposal,
      decision: 'approved' as const,
      decidedAt: '2026-01-01T00:00:00.000Z',
    };

    expect(() =>
      decideFixtureChange({ ...base, approver: '  ', rationale: 'because' }),
    ).toThrow(ApprovalRefused);
    expect(() =>
      decideFixtureChange({ ...base, approver: 'mrwhite', rationale: '   ' }),
    ).toThrow(ApprovalRefused);

    try {
      decideFixtureChange({ ...base, approver: 'mrwhite', rationale: '' });
    } catch (error: unknown) {
      expect((error as ApprovalRefused).reason).toBe(
        APPROVAL_REFUSAL.rationale,
      );
    }
  });

  it('refuses an unsafe proposal id and an escaping fixture path', () => {
    const base = {
      decision: 'approved' as const,
      approver: 'mrwhite',
      rationale: 'checked by hand',
      decidedAt: '2026-01-01T00:00:00.000Z',
    };

    expect(() =>
      decideFixtureChange({
        ...base,
        proposal: { ...proposal, proposalId: '../escape' },
      }),
    ).toThrow('safe file name');
    expect(() =>
      decideFixtureChange({
        ...base,
        proposal: { ...proposal, fixturePath: '../../secrets.json' },
      }),
    ).toThrow('below the scenario root');
  });

  it('refuses a decision when the digests are identical', () => {
    expect(() =>
      decideFixtureChange({
        proposal: { ...proposal, proposedDigest: proposal.expectedDigest },
        decision: 'approved',
        approver: 'mrwhite',
        rationale: 'nothing changed',
        decidedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow('nothing to decide');
  });

  it('records an approval that applies nothing', () => {
    const approval = decideFixtureChange({
      proposal,
      decision: 'approved',
      approver: 'mrwhite',
      rationale: 'verified the new digest against the recorded evidence',
      decidedAt: '2026-01-02T00:00:00.000Z',
    });

    expect(approval.version).toBe(FIXTURE_APPROVAL_VERSION);
    expect(approval.decision).toBe('approved');
    expect(
      parseFixtureApproval(JSON.parse(JSON.stringify(approval))),
    ).toStrictEqual(approval);

    const view = buildFixtureReviewView({
      proposals: [proposal],
      approvals: [approval],
    });
    expect(view.view).toBe(FIXTURE_REVIEW_VIEW_VERSION);
    expect(view.approvedCount).toBe(1);
    // The approval says a human accepted the change; it did not make it.
    expect(view.proposals[0]?.change.applied).toBe(false);
    expect(view.proposals[0]?.change.instruction).toContain(
      'digests/narrative.json',
    );
  });

  it('leaves an undecided proposal pending rather than implying acceptance', () => {
    const view = buildFixtureReviewView({ proposals: [proposal] });

    expect(view.pendingCount).toBe(1);
    expect(view.approvedCount).toBe(0);
    expect(view.proposals[0]?.status).toBe('pending');
    expect(view.proposals[0]?.decision).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.proposalPending,
    });
  });

  it('keeps a rejection visible with its reason', () => {
    const rejection = decideFixtureChange({
      proposal,
      decision: 'rejected',
      approver: 'mrwhite',
      rationale: 'the new digest came from an unpinned request hash',
      decidedAt: '2026-01-02T00:00:00.000Z',
    });
    const view = buildFixtureReviewView({
      proposals: [proposal],
      approvals: [rejection],
      unreadable: ['broken.json'],
    });

    expect(view.rejectedCount).toBe(1);
    if (
      !isAvailable(
        view.proposals[0]?.decision ?? {
          availability: 'unavailable',
          reason: '',
        },
      )
    ) {
      throw new Error('decision should be available');
    }
    expect(view.unreadable).toStrictEqual(['broken.json']);
  });

  it('rejects a stored approval with an unknown version or empty rationale', () => {
    const approval = decideFixtureChange({
      proposal,
      decision: 'approved',
      approver: 'mrwhite',
      rationale: 'checked',
      decidedAt: '2026-01-02T00:00:00.000Z',
    });

    expect(
      parseFixtureApproval({ ...approval, version: 'acme-fixture-approval/2' }),
    ).toBeNull();
    expect(parseFixtureApproval({ ...approval, rationale: '  ' })).toBeNull();
    expect(parseFixtureApproval({ ...approval, decision: 'maybe' })).toBeNull();
  });
});
