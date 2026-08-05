import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  RUN_RECORD_VERSION,
  buildMeasurementView,
  captureBaseline,
  type RunRecord,
} from '../../apps/test-ui/src/index.js';
import {
  createFileWorkspace,
  startWorkbenchServer,
  WorkbenchServeRefused,
} from '../../apps/test-ui/src/local.js';
import { createTestPayloadEncryptor } from '../../packages/testing/src/index.js';

const roots: string[] = [];
const servers: { close(): Promise<void> }[] = [];
const scenarioFiles = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'scenario',
  'files',
);

const browserPlan = {
  schemaVersion: 'acme-test-plan/1',
  name: 'browser-launch',
  seed: {
    clock: '2026-08-04T12:00:00.000Z',
    ids: 'sequential',
    idPrefix: 'browser-launch',
    idPadding: 3,
  },
  composition: { repository: 'sqlite', gateway: 'mock' },
  policy: { retention: 'hash-only' },
  cases: [
    {
      id: 'observe',
      namespace: 'narrative',
      task: 'observe-document',
      entityId: 'story-browser-launch',
      expectedRevision: 0,
      input: 'inputs/chapter-1.json',
      mockResponse: 'responses/chapter-1.json',
      expect: {
        status: 'committed',
        revision: 1,
        documentKeys: ['chapter-phase-5'],
      },
    },
  ],
};

const encryptedBrowserPlan = {
  ...browserPlan,
  policy: { retention: 'encrypted-payload' },
};

async function formToken(url: string): Promise<string> {
  const page = await fetch(`${url}/s2`);
  const html = await page.text();
  const match = /name="csrfToken" value="([a-f0-9]+)"/u.exec(html);
  if (match?.[1] === undefined) {
    throw new Error('S2 did not render a form token.');
  }
  return match[1];
}

function tokenFromHtml(html: string): string {
  const match = /name="csrfToken" value="([a-f0-9]+)"/u.exec(html);
  if (match?.[1] === undefined) {
    throw new Error('The page did not render a form token.');
  }
  return match[1];
}

function submission(
  token: string,
  overrides: { readonly runId?: string; readonly source?: string } = {},
): URLSearchParams {
  return new URLSearchParams({
    csrfToken: token,
    runId: overrides.runId ?? 'browser-run-001',
    planSource: overrides.source ?? JSON.stringify(browserPlan),
  });
}

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (server !== undefined) {
      await server.close();
    }
  }
  while (roots.length > 0) {
    const root = roots.pop();
    if (root !== undefined) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe('test-ui local workbench server', () => {
  it('refuses a non-loopback host', async () => {
    await expect(
      startWorkbenchServer({
        workspaceRoot: mkdtempSync(join(tmpdir(), 'acme-wb-')),
        host: '0.0.0.0',
        port: 0,
        clock: { now: () => '2026-08-02T00:00:00.000Z' },
        ids: {
          next(kind) {
            return `${kind}-x`;
          },
        },
      }),
    ).rejects.toBeInstanceOf(WorkbenchServeRefused);
  });

  it('serves S3 HTML from workspace run records on loopback', async () => {
    const root = mkdtempSync(join(tmpdir(), 'acme-wb-'));
    roots.push(root);
    const workspace = createFileWorkspace({ root });
    await workspace.recordRun({
      version: RUN_RECORD_VERSION,
      runId: 'workbench-run-1',
      planName: 'demo-plan',
      scenarioName: 'demo-plan',
      startedAt: '2026-08-02T10:00:00.000Z',
      finishedAt: '2026-08-02T10:00:01.000Z',
      composition: { repository: 'memory', gateway: 'mock' },
      status: 'passed',
      steps: [{ index: 0, kind: 'execute', status: 'passed' }],
      cases: [{ alias: 'only', executionId: 'exec-wb-1' }],
      failure: null,
    });

    const server = await startWorkbenchServer({
      workspaceRoot: root,
      host: '127.0.0.1',
      port: 0,
      clock: { now: () => '2026-08-02T00:00:00.000Z' },
      ids: {
        next(kind) {
          return `${kind}-wb`;
        },
      },
    });
    servers.push(server);

    const health = await fetch(`${server.url}/api/health`);
    expect(health.status).toBe(200);
    const healthJson = (await health.json()) as { ok: boolean };
    expect(healthJson.ok).toBe(true);

    const runsJson = await fetch(`${server.url}/api/runs`);
    expect(runsJson.status).toBe(200);
    const body = (await runsJson.json()) as {
      history: { runCount: number };
    };
    expect(body.history).toMatchObject({ runCount: 1 });

    const page = await fetch(`${server.url}/s3`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('workbench-run-1');
    expect(html).toContain('S3 Run console');
    expect(html).toContain('demo-plan');
  });

  it('serves read-only S8 measurement with thresholds and a stored baseline', async () => {
    const root = mkdtempSync(join(tmpdir(), 'acme-wb-measurement-'));
    roots.push(root);
    const workspace = createFileWorkspace({ root });
    const deterministic: RunRecord = {
      version: RUN_RECORD_VERSION,
      runId: 'measurement-mock',
      planName: 'measurement-plan',
      scenarioName: 'measurement-plan',
      startedAt: '2026-08-05T10:00:00.000Z',
      finishedAt: '2026-08-05T10:00:01.000Z',
      composition: { repository: 'memory', gateway: 'mock' },
      status: 'passed',
      steps: [
        { index: 0, kind: 'execute', status: 'passed' },
        { index: 1, kind: 'replay', status: 'passed' },
      ],
      cases: [{ alias: 'only', executionId: 'exec-measurement-mock' }],
      failure: null,
    };
    const live: RunRecord = {
      ...deterministic,
      runId: 'measurement-live',
      composition: { repository: 'memory', gateway: 'openai' },
      status: 'failed',
      steps: [
        { index: 0, kind: 'execute', status: 'failed' },
        { index: 1, kind: 'replay', status: 'failed' },
      ],
      cases: [{ alias: 'only', executionId: 'exec-measurement-live' }],
      failure: { stepIndex: 0, message: 'recorded failure' },
    };
    await workspace.recordRun(deterministic);
    await workspace.recordRun(live);
    const baseline = captureBaseline({
      name: 'nightly',
      capturedAt: '2026-08-04T10:00:00.000Z',
      view: buildMeasurementView({
        records: [
          deterministic,
          { ...deterministic, runId: 'baseline-failed', status: 'failed' },
        ],
      }),
    });
    await workspace.saveBaseline(baseline);

    const server = await startWorkbenchServer({
      workspaceRoot: root,
      host: '127.0.0.1',
      port: 0,
      clock: { now: () => '2026-08-05T10:00:02.000Z' },
      ids: { next: (kind) => `${kind}-measurement` },
    });
    servers.push(server);

    const query = new URLSearchParams({
      baseline: 'nightly',
      'runPassRate.min': '1',
      'stepPassRate.min': '0.75',
      'replayMatchRate.min': '1',
    });
    const api = await fetch(`${server.url}/api/measurement?${query}`);
    expect(api.status).toBe(200);
    const view = (await api.json()) as {
      view: string;
      baselineName: string | null;
      deterministic: {
        runCount: number;
        measures: readonly {
          id: string;
          sampleSize: number;
          outcome: string | null;
          baseline: { availability: string; comparison?: string };
        }[];
      };
      live: {
        runCount: number;
        measures: readonly { id: string; outcome: string | null }[];
      };
    };
    expect(view).toMatchObject({
      view: 'acme-view-measurement/1',
      baselineName: 'nightly',
      deterministic: { runCount: 1 },
      live: { runCount: 1 },
    });
    expect(
      view.deterministic.measures.find(
        (measure) => measure.id === 'runPassRate',
      ),
    ).toMatchObject({
      sampleSize: 1,
      outcome: 'met',
      baseline: { availability: 'available', comparison: 'improved' },
    });
    expect(
      view.live.measures.find((measure) => measure.id === 'runPassRate'),
    ).toMatchObject({ outcome: 'not-met' });

    const page = await fetch(`${server.url}/s8?${query}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('S8 Results and measurement');
    expect(html).toContain('acme-view-measurement/1');
    expect(html).toContain('Deterministic series');
    expect(html).toContain('Live series');
    expect(html).toContain('100.0%');
    expect(html).toContain('0.0%');
    expect(html).toContain('improved');
    expect(html).toContain('not-met');
    expect(await workspace.loadBaseline('nightly')).toStrictEqual(baseline);
    expect((await workspace.listRuns()).records).toHaveLength(2);

    const defaultView = (await (
      await fetch(`${server.url}/api/measurement`)
    ).json()) as {
      baselineName: string | null;
      deterministic: { measures: readonly { outcome: string | null }[] };
    };
    expect(defaultView.baselineName).toBeNull();
    expect(
      defaultView.deterministic.measures.every(
        (entry) => entry.outcome === null,
      ),
    ).toBe(true);

    const invalidRate = await fetch(
      `${server.url}/api/measurement?runPassRate.min=1.1`,
    );
    expect(invalidRate.status).toBe(400);
    expect(await invalidRate.text()).toContain('between 0 and 1');
    const inverted = await fetch(
      `${server.url}/s8?runPassRate.min=0.9&runPassRate.max=0.8`,
    );
    expect(inverted.status).toBe(400);
    expect(await inverted.text()).toContain('minimum cannot exceed');
    const missingBaseline = await fetch(
      `${server.url}/api/measurement?baseline=missing`,
    );
    expect(missingBaseline.status).toBe(404);
    const unsafeBaseline = await fetch(
      `${server.url}/api/measurement?baseline=..%2Fescape`,
    );
    expect(unsafeBaseline.status).toBe(400);

    writeFileSync(join(root, 'runs', 'broken.json'), '{not-json', 'utf8');
    const incomplete = await fetch(`${server.url}/api/measurement`);
    expect(incomplete.status).toBe(409);
    expect(await incomplete.text()).toContain(
      'unreadable run records would shrink the evidence set',
    );
  });

  it('reviews and records one S9 decision without changing the fixture', async () => {
    const root = mkdtempSync(join(tmpdir(), 'acme-wb-fixture-review-'));
    roots.push(root);
    const workspace = createFileWorkspace({ root });
    const run: RunRecord = {
      version: RUN_RECORD_VERSION,
      runId: 'fixture-review-run',
      planName: 'fixture-review-plan',
      scenarioName: 'fixture-review-plan',
      startedAt: '2026-08-05T20:30:00.000Z',
      finishedAt: '2026-08-05T20:30:01.000Z',
      composition: { repository: 'memory', gateway: 'mock' },
      status: 'failed',
      steps: [{ index: 0, kind: 'assertDigest', status: 'failed' }],
      cases: [{ alias: 'only', executionId: 'exec-fixture-review' }],
      failure: { stepIndex: 0, message: 'recorded digest mismatch' },
    };
    await workspace.recordRun(run);
    const fixture = join(scenarioFiles, 'digests', 'narrative-phase-5.json');
    const fixtureBefore = readFileSync(fixture, 'utf8');

    const server = await startWorkbenchServer({
      workspaceRoot: root,
      scenarioRoot: scenarioFiles,
      host: '127.0.0.1',
      port: 0,
      clock: { now: () => '2026-08-05T20:31:00.000Z' },
      ids: { next: (kind) => `${kind}-fixture-review` },
    });
    servers.push(server);

    const proposal = new URLSearchParams({
      proposalId: 'proposal-browser-001',
      fixturePath: 'digests/narrative-phase-5.json',
      expectedDigest: 'digest-pinned',
      proposedDigest: 'digest-observed',
      runId: run.runId,
      executionId: 'exec-fixture-review',
    });
    const defaultApi = await fetch(`${server.url}/api/fixture-review`);
    expect(defaultApi.status).toBe(200);
    expect(await defaultApi.json()).toMatchObject({
      view: 'acme-view-fixture-review/1',
      proposalCount: 0,
      pendingCount: 0,
    });

    const pendingApi = await fetch(
      `${server.url}/api/fixture-review?${proposal}`,
    );
    expect(pendingApi.status).toBe(200);
    expect(await pendingApi.json()).toMatchObject({
      proposalCount: 1,
      pendingCount: 1,
      approvedCount: 0,
      rejectedCount: 0,
      proposals: [
        {
          proposalId: 'proposal-browser-001',
          status: 'pending',
          change: { applied: false },
        },
      ],
    });

    const pendingPage = await fetch(`${server.url}/s9?${proposal}`);
    expect(pendingPage.status).toBe(200);
    const pendingHtml = await pendingPage.text();
    const token = tokenFromHtml(pendingHtml);
    expect(pendingHtml).toContain('pending');
    expect(pendingHtml).toContain('Not applied');
    expect(pendingHtml).toContain('Approve proposed change');
    expect(pendingHtml).toContain('Reject proposed change');

    const decision = new URLSearchParams(proposal);
    decision.set('csrfToken', token);
    decision.set('decision', 'rejected');
    decision.set('approver', 'test-reviewer');
    decision.set('rationale', 'the observed digest lacks pinned evidence');
    const decided = await fetch(`${server.url}/s9/decision`, {
      method: 'POST',
      headers: { origin: server.url },
      body: decision,
      redirect: 'manual',
    });
    expect(decided.status).toBe(303);
    expect(decided.headers.get('location')).toContain('/s9?proposalId=');

    const decidedPage = await fetch(
      new URL(decided.headers.get('location') ?? '', server.url),
    );
    expect(decidedPage.status).toBe(200);
    const decidedHtml = await decidedPage.text();
    expect(decidedHtml).toContain('rejected');
    expect(decidedHtml).toContain('test-reviewer');
    expect(decidedHtml).toContain('the observed digest lacks pinned evidence');
    expect(decidedHtml).toContain('Not applied');
    expect(decidedHtml).not.toContain('action="/s9/decision"');
    expect(readFileSync(fixture, 'utf8')).toBe(fixtureBefore);

    const approvals = await workspace.listApprovals();
    expect(approvals.records).toHaveLength(1);
    expect(approvals.records[0]).toMatchObject({
      proposalId: 'proposal-browser-001',
      decision: 'rejected',
      approver: 'test-reviewer',
      decidedAt: '2026-08-05T20:31:00.000Z',
    });

    const overwrite = await fetch(`${server.url}/s9/decision`, {
      method: 'POST',
      headers: { origin: server.url },
      body: decision,
      redirect: 'manual',
    });
    expect(overwrite.status).toBe(409);
    expect((await workspace.listApprovals()).records).toStrictEqual(
      approvals.records,
    );

    const conflicting = new URLSearchParams(proposal);
    conflicting.set('proposedDigest', 'different-proposal');
    const conflict = await fetch(
      `${server.url}/api/fixture-review?${conflicting}`,
    );
    expect(conflict.status).toBe(409);
    expect(await conflict.text()).toContain('conflicts with its recorded');

    const missingRun = new URLSearchParams(proposal);
    missingRun.set('proposalId', 'proposal-missing-run');
    missingRun.set('runId', 'not-recorded');
    expect(
      (await fetch(`${server.url}/api/fixture-review?${missingRun}`)).status,
    ).toBe(404);
    const wrongExecution = new URLSearchParams(proposal);
    wrongExecution.set('proposalId', 'proposal-wrong-execution');
    wrongExecution.set('executionId', 'not-linked');
    expect(
      (await fetch(`${server.url}/api/fixture-review?${wrongExecution}`))
        .status,
    ).toBe(409);
    const partial = await fetch(
      `${server.url}/api/fixture-review?proposalId=partial`,
    );
    expect(partial.status).toBe(400);
    const unsafePath = new URLSearchParams(proposal);
    unsafePath.set('proposalId', 'proposal-unsafe-path');
    unsafePath.set('fixturePath', '../../secret.json');
    expect(
      (await fetch(`${server.url}/api/fixture-review?${unsafePath}`)).status,
    ).toBe(400);

    const second = new URLSearchParams(proposal);
    second.set('proposalId', 'proposal-missing-rationale');
    second.set('csrfToken', token);
    second.set('decision', 'approved');
    second.set('approver', 'test-reviewer');
    const missingRationale = await fetch(`${server.url}/s9/decision`, {
      method: 'POST',
      headers: { origin: server.url },
      body: second,
      redirect: 'manual',
    });
    expect(missingRationale.status).toBe(400);
    const badToken = new URLSearchParams(second);
    badToken.set('rationale', 'has a rationale');
    badToken.set('csrfToken', 'wrong-token');
    const refusedToken = await fetch(`${server.url}/s9/decision`, {
      method: 'POST',
      headers: { origin: server.url },
      body: badToken,
      redirect: 'manual',
    });
    expect(refusedToken.status).toBe(403);

    writeFileSync(
      join(root, 'approvals', 'proposal-unreadable.json'),
      '{not-json',
      'utf8',
    );
    const unreadableProposal = new URLSearchParams(proposal);
    unreadableProposal.set('proposalId', 'proposal-unreadable');
    expect(
      (await fetch(`${server.url}/api/fixture-review?${unreadableProposal}`))
        .status,
    ).toBe(409);
    const history = (await (
      await fetch(`${server.url}/api/fixture-review`)
    ).json()) as { unreadable: readonly string[] };
    expect(history.unreadable).toContain('proposal-unreadable.json');
    expect(readFileSync(fixture, 'utf8')).toBe(fixtureBefore);
  });

  it('serves S1 from static registries and bounded scenario discovery', async () => {
    const root = mkdtempSync(join(tmpdir(), 'acme-wb-catalog-'));
    roots.push(root);
    const server = await startWorkbenchServer({
      workspaceRoot: join(root, 'workspace'),
      scenarioRoot: scenarioFiles,
      host: '127.0.0.1',
      port: 0,
      clock: { now: () => '2026-08-04T12:00:03.000Z' },
      ids: { next: (kind) => `${kind}-catalog` },
    });
    servers.push(server);

    const response = await fetch(`${server.url}/api/catalog`);
    expect(response.status).toBe(200);
    const catalog = (await response.json()) as {
      view: string;
      root: string;
      modules: { availability: string; moduleCount: number };
      contracts: {
        availability: string;
        contractCount: number;
        contracts: readonly { fingerprint: string }[];
      };
      scenarios: {
        availability: string;
        scenarioCount: number;
        validCount: number;
      };
      fixtures: { availability: string; fixtureCount: number };
    };
    expect(catalog).toMatchObject({
      view: 'acme-view-catalog/1',
      root: 'files',
      modules: { availability: 'available', moduleCount: 2 },
      contracts: { availability: 'available', contractCount: 2 },
      scenarios: {
        availability: 'available',
        scenarioCount: 1,
        validCount: 1,
      },
      fixtures: { availability: 'available', fixtureCount: 3 },
    });

    const page = await fetch(`${server.url}/s1`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('S1 Catalog');
    expect(html).toContain('narrative');
    expect(html).toContain('research');
    expect(html).toContain('narrative-phase-5.yaml');
    expect(html).toContain('inputs/chapter-1.json');
    const fingerprint = catalog.contracts.contracts[0]?.fingerprint;
    if (fingerprint === undefined) {
      throw new Error('Catalog did not expose a contract fingerprint.');
    }
    expect(html).toContain(fingerprint);
    expect(html).not.toContain(scenarioFiles);
  });

  it('keeps S1 registries visible when discovery is not configured', async () => {
    const root = mkdtempSync(join(tmpdir(), 'acme-wb-catalog-empty-'));
    roots.push(root);
    const server = await startWorkbenchServer({
      workspaceRoot: join(root, 'workspace'),
      host: '127.0.0.1',
      port: 0,
      clock: { now: () => '2026-08-04T12:00:03.000Z' },
      ids: { next: (kind) => `${kind}-catalog-empty` },
    });
    servers.push(server);

    const page = await fetch(`${server.url}/s1`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('narrative');
    expect(html).toContain('research');
    expect(html).toContain('SCENARIO_DISCOVERY_UNAVAILABLE');
    expect(html).toContain('FIXTURE_DISCOVERY_UNAVAILABLE');
  });

  it('previews, launches and inspects one offline SQLite plan from S2', async () => {
    const root = mkdtempSync(join(tmpdir(), 'acme-wb-plan-'));
    roots.push(root);
    const workspaceRoot = join(root, 'workspace');
    const server = await startWorkbenchServer({
      workspaceRoot,
      scenarioRoot: scenarioFiles,
      ledgerDatabase: join(root, 'ledger.sqlite'),
      host: '127.0.0.1',
      port: 0,
      clock: { now: () => '2026-08-04T12:00:03.000Z' },
      ids: {
        next(kind) {
          return `${kind}-browser-server`;
        },
      },
      payloadEncryptor: createTestPayloadEncryptor(),
    });
    servers.push(server);

    const token = await formToken(server.url);
    const preview = await fetch(`${server.url}/s2/preview`, {
      method: 'POST',
      headers: { origin: server.url },
      body: submission(token, { source: JSON.stringify(encryptedBrowserPlan) }),
    });
    expect(preview.status).toBe(200);
    const previewHtml = await preview.text();
    expect(previewHtml).toContain('browser-launch');
    expect(previewHtml).toContain('Compiled canonical scenario');
    expect(previewHtml).toContain('acme-scenario/1');

    const launch = await fetch(`${server.url}/s2/launch`, {
      method: 'POST',
      headers: { origin: server.url },
      body: submission(token, { source: JSON.stringify(encryptedBrowserPlan) }),
      redirect: 'manual',
    });
    expect(launch.status).toBe(303);
    expect(launch.headers.get('location')).toBe('/s3/browser-run-001');

    const history = (await (await fetch(`${server.url}/api/runs`)).json()) as {
      history: {
        runs: readonly { runId: string; status: string }[];
      };
    };
    expect(history.history.runs).toContainEqual(
      expect.objectContaining({
        runId: 'browser-run-001',
        status: 'passed',
      }),
    );

    const detail = await fetch(`${server.url}/s3/browser-run-001`);
    expect(detail.status).toBe(200);
    expect(detail.url).toContain('/s4?executionId=');
    const detailHtml = await detail.text();
    expect(detailHtml).toContain('story-browser-launch');
    expect(detailHtml).toContain('Trust pipeline');
    expect(detailHtml).toContain('/s5?executionId=');
    expect(detailHtml).toContain(
      '/s6?namespace=narrative&amp;entityId=story-browser-launch',
    );
    expect(detailHtml).toContain('/s7?executionId=');

    const executionId = new URL(detail.url).searchParams.get('executionId');
    if (executionId === null) {
      throw new Error('S4 redirect did not preserve the execution id.');
    }
    const memoryApi = await fetch(
      `${server.url}/api/memory-decisions?executionId=${encodeURIComponent(executionId)}`,
    );
    expect(memoryApi.status).toBe(200);
    const memoryView = (await memoryApi.json()) as {
      view: string;
      executionId: string;
      decisions:
        | { availability: 'unavailable'; reason: string }
        | {
            availability: 'available';
            candidateCount: number;
            decisionCount: number;
            mutationCount: number;
            decisions: readonly {
              action: string;
              candidate: {
                availability: string;
                candidate?: { value: { disclosure: string } };
              };
              mutations: readonly { value: { disclosure: string } }[];
            }[];
          };
    };
    expect(memoryView).toMatchObject({
      view: 'acme-view-memory-decisions/1',
      executionId,
      decisions: { availability: 'available' },
    });
    if (memoryView.decisions.availability !== 'available') {
      throw new Error('Prepared memory evidence should be available.');
    }
    expect(memoryView.decisions.candidateCount).toBeGreaterThan(0);
    expect(memoryView.decisions.decisionCount).toBeGreaterThan(0);
    for (const decision of memoryView.decisions.decisions) {
      if (decision.candidate.availability === 'available') {
        expect(decision.candidate.candidate?.value.disclosure).toBe('redacted');
      }
      for (const mutation of decision.mutations) {
        expect(mutation.value.disclosure).toBe('redacted');
      }
    }

    const memoryPage = await fetch(
      `${server.url}/s5?executionId=${encodeURIComponent(executionId)}`,
    );
    expect(memoryPage.status).toBe(200);
    const memoryHtml = await memoryPage.text();
    expect(memoryHtml).toContain('S5 Memory decisions');
    expect(memoryHtml).toContain('acme-view-memory-decisions/1');
    expect(memoryHtml).toContain('redacted');
    expect(memoryHtml).not.toContain('The chapter opens');

    const stateApi = await fetch(
      `${server.url}/api/state?namespace=narrative&entityId=story-browser-launch`,
    );
    expect(stateApi.status).toBe(200);
    const stateView = (await stateApi.json()) as {
      view: string;
      namespace: string;
      entityId: string;
      lineage:
        | { availability: 'unavailable'; reason: string }
        | {
            availability: 'available';
            revisionCount: number;
            headRevision: number | null;
            revisions: readonly {
              continuity: string;
              value: { disclosure: string };
              transition:
                | { availability: 'unavailable'; reason: string }
                | {
                    availability: 'available';
                    delta: { disclosure: string };
                  };
            }[];
          };
    };
    expect(stateView).toMatchObject({
      view: 'acme-view-state/1',
      namespace: 'narrative',
      entityId: 'story-browser-launch',
      lineage: {
        availability: 'available',
        revisionCount: 1,
        headRevision: 1,
      },
    });
    if (stateView.lineage.availability !== 'available') {
      throw new Error('Recorded state lineage should be available.');
    }
    expect(stateView.lineage.revisions[0]).toMatchObject({
      continuity: 'linked',
      value: { disclosure: 'redacted' },
      transition: {
        availability: 'available',
        delta: { disclosure: 'redacted' },
      },
    });

    const statePage = await fetch(
      `${server.url}/s6?namespace=narrative&entityId=story-browser-launch`,
    );
    expect(statePage.status).toBe(200);
    const stateHtml = await statePage.text();
    expect(stateHtml).toContain('S6 State inspector');
    expect(stateHtml).toContain('acme-view-state/1');
    expect(stateHtml).toContain('Revision 1');
    expect(stateHtml).toContain('linked');
    expect(stateHtml).toContain('redacted');
    expect(stateHtml).not.toContain('<details>');

    const replayApi = await fetch(
      `${server.url}/api/replay?executionId=${encodeURIComponent(executionId)}`,
    );
    expect(replayApi.status).toBe(200);
    const replayView = (await replayApi.json()) as {
      view: string;
      executionId: string;
      recordedOperationDigest: string | null;
      outcome:
        | { availability: 'unavailable'; reason: string }
        | {
            availability: 'available';
            status: string;
            digest: { comparison: string };
            differenceCount: number;
          };
    };
    expect(replayView).toMatchObject({
      view: 'acme-view-replay/1',
      executionId,
      outcome: {
        availability: 'available',
        status: 'match',
        digest: { comparison: 'equal' },
      },
    });
    expect(replayView.recordedOperationDigest).not.toBeNull();

    const replayPage = await fetch(
      `${server.url}/s7?executionId=${encodeURIComponent(executionId)}`,
    );
    expect(replayPage.status).toBe(200);
    const replayHtml = await replayPage.text();
    expect(replayHtml).toContain('S7 Replay inspector');
    expect(replayHtml).toContain('acme-view-replay/1');
    expect(replayHtml).toContain('match');
    expect(replayHtml).toContain('equal');
    expect(replayHtml).toContain('No replay differences recorded.');
    expect(replayHtml).toContain(replayView.recordedOperationDigest ?? '');
    expect(replayHtml).not.toContain('<details>');

    const memoryAfterReplay = await (
      await fetch(
        `${server.url}/api/memory-decisions?executionId=${encodeURIComponent(executionId)}`,
      )
    ).json();
    const stateAfterReplay = await (
      await fetch(
        `${server.url}/api/state?namespace=narrative&entityId=story-browser-launch`,
      )
    ).json();
    expect(memoryAfterReplay).toStrictEqual(memoryView);
    expect(stateAfterReplay).toStrictEqual(stateView);

    const emptyState = await fetch(
      `${server.url}/api/state?namespace=narrative&entityId=not-recorded`,
    );
    expect(emptyState.status).toBe(200);
    expect(await emptyState.json()).toMatchObject({
      lineage: {
        availability: 'available',
        revisionCount: 0,
        headRevision: null,
      },
    });

    const missingSelection = await fetch(`${server.url}/s5`);
    expect(missingSelection.status).toBe(200);
    expect(await missingSelection.text()).toContain(
      'Choose an execution in S4',
    );
    const missingStateScope = await fetch(`${server.url}/s6`);
    expect(missingStateScope.status).toBe(200);
    expect(await missingStateScope.text()).toContain(
      'Choose an execution in S4',
    );
    const missingReplayExecution = await fetch(`${server.url}/s7`);
    expect(missingReplayExecution.status).toBe(200);
    expect(await missingReplayExecution.text()).toContain(
      'Choose an execution in S4',
    );
    const unknownExecution = await fetch(
      `${server.url}/api/memory-decisions?executionId=does-not-exist`,
    );
    expect(unknownExecution.status).toBe(404);
    expect(await unknownExecution.text()).toContain('Execution not found');
    const unknownReplayExecution = await fetch(
      `${server.url}/api/replay?executionId=does-not-exist`,
    );
    expect(unknownReplayExecution.status).toBe(404);
    expect(await unknownReplayExecution.text()).toContain(
      'Execution not found',
    );

    const duplicate = await fetch(`${server.url}/s2/launch`, {
      method: 'POST',
      headers: { origin: server.url },
      body: submission(token),
      redirect: 'manual',
    });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.text()).toContain(
      'existing history is never overwritten',
    );
  });

  it('refuses missing launch configuration, unsafe ids and foreign forms', async () => {
    const root = mkdtempSync(join(tmpdir(), 'acme-wb-refuse-'));
    roots.push(root);
    const server = await startWorkbenchServer({
      workspaceRoot: join(root, 'workspace'),
      host: '127.0.0.1',
      port: 0,
      clock: { now: () => '2026-08-04T12:00:03.000Z' },
      ids: { next: (kind) => `${kind}-refusal` },
    });
    servers.push(server);

    const page = await fetch(`${server.url}/s2`);
    const pageHtml = await page.text();
    expect(pageHtml).toContain('Launch unavailable');
    expect(pageHtml).toContain('disabled');
    const token = await formToken(server.url);

    const unconfigured = await fetch(`${server.url}/s2/launch`, {
      method: 'POST',
      headers: { origin: server.url },
      body: submission(token),
      redirect: 'manual',
    });
    expect(unconfigured.status).toBe(409);
    expect(await unconfigured.text()).toContain('configured scenario root');

    const foreign = await fetch(`${server.url}/s2/preview`, {
      method: 'POST',
      headers: { origin: 'http://example.test' },
      body: submission(token),
    });
    expect(foreign.status).toBe(403);

    const badToken = await fetch(`${server.url}/s2/preview`, {
      method: 'POST',
      headers: { origin: server.url },
      body: submission('wrong-token'),
    });
    expect(badToken.status).toBe(403);

    const configured = await startWorkbenchServer({
      workspaceRoot: join(root, 'configured-workspace'),
      scenarioRoot: scenarioFiles,
      host: '127.0.0.1',
      port: 0,
      clock: { now: () => '2026-08-04T12:00:03.000Z' },
      ids: { next: (kind) => `${kind}-configured` },
    });
    servers.push(configured);
    const configuredToken = await formToken(configured.url);
    const unsafe = await fetch(`${configured.url}/s2/launch`, {
      method: 'POST',
      headers: { origin: configured.url },
      body: submission(configuredToken, { runId: '../escape' }),
      redirect: 'manual',
    });
    expect(unsafe.status).toBe(400);
    expect(await unsafe.text()).toContain('safe file name');

    const missingMemoryId = await fetch(
      `${configured.url}/api/memory-decisions`,
    );
    expect(missingMemoryId.status).toBe(400);
    expect(await missingMemoryId.text()).toContain('executionId is required');

    const noLedger = await fetch(
      `${configured.url}/api/memory-decisions?executionId=unknown`,
    );
    expect(noLedger.status).toBe(409);
    expect(await noLedger.text()).toContain('configured durable ledger');

    const noStateLedger = await fetch(
      `${configured.url}/api/state?namespace=narrative&entityId=unknown`,
    );
    expect(noStateLedger.status).toBe(409);
    expect(await noStateLedger.text()).toContain('configured durable ledger');

    const missingStateQuery = await fetch(`${configured.url}/api/state`);
    expect(missingStateQuery.status).toBe(400);
    expect(await missingStateQuery.text()).toContain(
      'namespace and entityId are required',
    );
  });

  it('bounds S2 form bodies and labels memory evidence as non-durable', async () => {
    const root = mkdtempSync(join(tmpdir(), 'acme-wb-memory-'));
    roots.push(root);
    const server = await startWorkbenchServer({
      workspaceRoot: join(root, 'workspace'),
      scenarioRoot: scenarioFiles,
      host: '127.0.0.1',
      port: 0,
      clock: { now: () => '2026-08-04T12:00:03.000Z' },
      ids: { next: (kind) => `${kind}-memory` },
    });
    servers.push(server);
    const token = await formToken(server.url);

    const oversized = await fetch(`${server.url}/s2/preview`, {
      method: 'POST',
      headers: { origin: server.url },
      body: submission(token, { source: 'x'.repeat(300_000) }),
    });
    expect(oversized.status).toBe(413);

    const memoryPlan = {
      ...browserPlan,
      name: 'browser-memory',
      composition: { repository: 'memory', gateway: 'mock' },
      cases: [
        {
          ...browserPlan.cases[0],
          entityId: 'story-browser-memory',
          requestKey: 'browser-memory-request',
        },
      ],
    };
    const launched = await fetch(`${server.url}/s2/launch`, {
      method: 'POST',
      headers: { origin: server.url },
      body: submission(token, {
        runId: 'browser-memory-001',
        source: JSON.stringify(memoryPlan),
      }),
      redirect: 'manual',
    });
    expect(launched.status).toBe(303);
    const detail = await fetch(`${server.url}/s3/browser-memory-001`);
    expect(detail.status).toBe(200);
    expect(await detail.text()).toContain('in-memory ledger was not');
  });
});
