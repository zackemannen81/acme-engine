import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildExecutionView,
  buildFixtureReviewView,
  buildMeasurementView,
  buildPlanView,
  buildRunsView,
  captureBaseline,
  decideFixtureChange,
  isAvailable,
} from '../../apps/test-ui/src/index.js';
import {
  createFileWorkspace,
  launchPlan,
} from '../../apps/test-ui/src/local.js';
import { createTestPayloadEncryptor } from '../../packages/testing/src/index.js';

/**
 * Phase 4's exit condition (ADR-0021).
 *
 * A domain engineer configures a run, launches it, finds it again and
 * inspects what the engine did — offline, without a browser and without the
 * CLI. This test is that sentence, executed.
 */

const scenarioFiles = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'scenario',
  'files',
);

const plan = {
  schemaVersion: 'acme-test-plan/1',
  name: 'narrative-phase-5',
  seed: {
    clock: '2026-07-31T12:00:00.000Z',
    ids: 'sequential',
    idPrefix: 'narrative-phase-5',
    idPadding: 3,
  },
  composition: { repository: 'memory', gateway: 'mock' },
  policy: { retention: 'encrypted-payload' },
  cases: [
    {
      id: 'first',
      requestKey: 'narrative-phase-5-request-1',
      namespace: 'narrative',
      task: 'observe-document',
      entityId: 'story-phase-5',
      expectedRevision: 0,
      input: 'inputs/chapter-1.json',
      mockResponse: 'responses/chapter-1.json',
      expect: {
        status: 'committed',
        revision: 1,
        documentKeys: ['chapter-phase-5'],
        digest: 'digests/narrative-phase-5.json',
      },
      replay: { mode: 'verify', expect: 'match' },
    },
  ],
};

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop() ?? '', { recursive: true, force: true });
  }
});

function temporary(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

function fixtureRoot(): string {
  const root = temporary('acme-ui-scenario-');
  cpSync(scenarioFiles, root, { recursive: true });
  return root;
}

/** A fixed clock, so the record's timestamps are not wall-clock reads. */
function clockFrom(instants: readonly string[]) {
  let index = 0;
  return {
    now(): string {
      const value = instants[Math.min(index, instants.length - 1)] ?? '';
      index += 1;
      return value;
    },
  };
}

describe('Domain Test UI launch loop', () => {
  it('configures, launches, finds and inspects one offline run', async () => {
    // 1. Configure: the designer shows what will actually run.
    const preview = buildPlanView(plan);
    expect(preview.status).toBe('valid');
    if (!isAvailable(preview.plan)) {
      throw new Error('preview should be available');
    }
    expect(preview.plan.compiled.schemaVersion).toBe('acme-scenario/1');
    expect(preview.plan.stepCount).toBe(4);

    // 2. Launch through the existing ScenarioRunner.
    const workspaceRoot = temporary('acme-ui-workspace-');
    const workspace = createFileWorkspace({ root: workspaceRoot });
    const { record, composition } = await launchPlan({
      plan,
      scenarioRoot: fixtureRoot(),
      workspace,
      runId: 'run-0001',
      clock: clockFrom([
        '2026-08-02T09:00:00.000Z',
        '2026-08-02T09:00:03.000Z',
      ]),
      payloadEncryptor: createTestPayloadEncryptor(),
    });

    try {
      expect(record.status).toBe('passed');
      expect(record.steps.map((step) => step.kind)).toStrictEqual([
        'execute',
        'assert',
        'replay',
        'assertDigest',
      ]);
      expect(record.startedAt).toBe('2026-08-02T09:00:00.000Z');
      expect(record.finishedAt).toBe('2026-08-02T09:00:03.000Z');

      // 3. Find it again. History is derived from the recorded files.
      const history = buildRunsView(await workspace.listRuns());
      if (!isAvailable(history.history)) {
        throw new Error('history should be available');
      }
      expect(history.history.runCount).toBe(1);
      expect(history.history.passedCount).toBe(1);
      expect(history.history.unreadable).toStrictEqual([]);
      const summary = history.history.runs[0];
      expect(summary?.runId).toBe('run-0001');
      expect(summary?.planName).toBe('narrative-phase-5');
      expect(summary?.executionIds).toHaveLength(1);

      // 4. Inspect the evidence the engine recorded, through the phase-1
      //    read model, reached from the history entry.
      const executionId = summary?.executionIds[0] ?? '';
      const evidence = composition.repository.snapshot();
      const execution = await composition.repository.get(executionId);
      const replayEvidence =
        await composition.repository.loadReplayEvidence(executionId);
      if (execution === null || replayEvidence === null) {
        throw new Error('the committed run must have recorded evidence');
      }

      const inspector = buildExecutionView({
        execution,
        attempts: evidence.attempts,
        modelCalls: evidence.modelCalls,
        replayEvidence,
      });
      expect(inspector.header.namespace).toBe('narrative');
      expect(inspector.terminal.committed).toBe(true);
      expect(inspector.terminal.revision).toBe(1);
      for (const stage of inspector.trustPipeline) {
        expect(stage.outcome).toBe('passed');
      }
    } finally {
      composition.close();
    }
  });

  it('writes only interface-owned files under the workspace root', async () => {
    const workspaceRoot = temporary('acme-ui-workspace-');
    const workspace = createFileWorkspace({ root: workspaceRoot });
    const { composition } = await launchPlan({
      plan,
      scenarioRoot: fixtureRoot(),
      workspace,
      runId: 'run-0002',
      clock: clockFrom(['2026-08-02T09:00:00.000Z']),
      payloadEncryptor: createTestPayloadEncryptor(),
    });
    composition.close();

    // The ledger lives in the repository the composition selected, not here.
    expect(readdirSync(workspaceRoot)).toStrictEqual(['runs']);
    expect(readdirSync(join(workspaceRoot, 'runs'))).toStrictEqual([
      'run-0002.json',
    ]);

    const loaded = await workspace.loadRun('run-0002');
    expect(loaded?.runId).toBe('run-0002');
  });

  it('refuses a run identifier that is not a safe file name', async () => {
    const workspace = createFileWorkspace({ root: temporary('acme-ui-ws-') });

    await expect(
      launchPlan({
        plan,
        scenarioRoot: fixtureRoot(),
        workspace,
        runId: '../escape',
        clock: clockFrom(['2026-08-02T09:00:00.000Z']),
      }),
    ).rejects.toThrow('safe file name');
  });

  it('records a failed run rather than throwing it away', async () => {
    const workspaceRoot = temporary('acme-ui-workspace-');
    const workspace = createFileWorkspace({ root: workspaceRoot });
    const failing = {
      ...plan,
      cases: [
        {
          ...plan.cases[0],
          // The run commits, so asserting `blocked` fails the scenario.
          expect: { status: 'blocked' },
          replay: undefined,
        },
      ],
    };

    const { record, composition } = await launchPlan({
      plan: JSON.parse(JSON.stringify(failing)) as unknown,
      scenarioRoot: fixtureRoot(),
      workspace,
      runId: 'run-0003',
      clock: clockFrom(['2026-08-02T09:00:00.000Z']),
      payloadEncryptor: createTestPayloadEncryptor(),
    });
    composition.close();

    expect(record.status).toBe('failed');
    expect(record.failure).not.toBeNull();

    const history = buildRunsView(await workspace.listRuns());
    if (!isAvailable(history.history)) {
      throw new Error('history should be available');
    }
    expect(history.history.failedCount).toBe(1);
    expect(history.history.runs[0]?.failure?.message).toContain('blocked');
  });

  it('measures the recorded runs and stores a baseline', async () => {
    const workspaceRoot = temporary('acme-ui-workspace-');
    const workspace = createFileWorkspace({ root: workspaceRoot });
    const { composition } = await launchPlan({
      plan,
      scenarioRoot: fixtureRoot(),
      workspace,
      runId: 'run-measured',
      clock: clockFrom(['2026-08-02T09:00:00.000Z']),
      payloadEncryptor: createTestPayloadEncryptor(),
    });
    composition.close();

    const { records } = await workspace.listRuns();
    const view = buildMeasurementView({
      records,
      thresholds: { runPassRate: { min: 1 }, replayMatchRate: { min: 1 } },
    });

    // Measured over real recorded runs, not constructed records.
    expect(view.deterministic.runCount).toBe(1);
    expect(view.live.runCount).toBe(0);
    for (const measure of view.deterministic.measures) {
      expect(measure.sampleSize).toBeGreaterThan(0);
      if (!isAvailable(measure.rate)) {
        throw new Error(`${measure.id} should have a rate`);
      }
      expect(measure.rate.value).toBe(1);
    }
    expect(
      view.deterministic.measures
        .filter((measure) => measure.threshold !== null)
        .map((measure) => measure.outcome),
    ).toStrictEqual(['met', 'met']);

    // A baseline is taken deliberately and read back the same.
    const baseline = captureBaseline({
      name: 'nightly',
      capturedAt: '2026-08-02T09:00:05.000Z',
      view,
    });
    await workspace.saveBaseline(baseline);
    expect(await workspace.loadBaseline('nightly')).toStrictEqual(baseline);
  });

  it('records a fixture decision without touching the fixture', async () => {
    const scenarioRoot = fixtureRoot();
    const fixture = join(scenarioRoot, 'digests', 'narrative-phase-5.json');
    const before = readFileSync(fixture, 'utf8');

    const workspace = createFileWorkspace({
      root: temporary('acme-ui-workspace-'),
    });
    const approval = decideFixtureChange({
      proposal: {
        proposalId: 'proposal-0001',
        fixturePath: 'digests/narrative-phase-5.json',
        expectedDigest: 'aaa',
        proposedDigest: 'bbb',
        runId: 'run-measured',
        executionId: 'execution_a',
      },
      decision: 'approved',
      approver: 'mrwhite',
      rationale: 'confirmed the new digest against the recorded evidence',
      decidedAt: '2026-08-02T09:10:00.000Z',
    });
    await workspace.recordApproval(approval);

    // The decision is stored; the golden is untouched.
    expect(readFileSync(fixture, 'utf8')).toBe(before);

    const { records, unreadable } = await workspace.listApprovals();
    expect(unreadable).toStrictEqual([]);
    const review = buildFixtureReviewView({
      proposals: [
        {
          proposalId: approval.proposalId,
          fixturePath: approval.fixturePath,
          expectedDigest: approval.expectedDigest,
          proposedDigest: approval.proposedDigest,
          runId: approval.runId,
          executionId: approval.executionId,
        },
      ],
      approvals: records,
    });
    expect(review.approvedCount).toBe(1);
    expect(review.proposals[0]?.change.applied).toBe(false);
  });
});
