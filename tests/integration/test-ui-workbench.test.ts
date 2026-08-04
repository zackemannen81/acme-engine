import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { RUN_RECORD_VERSION } from '../../apps/test-ui/src/index.js';
import {
  createFileWorkspace,
  startWorkbenchServer,
  WorkbenchServeRefused,
} from '../../apps/test-ui/src/local.js';

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

async function formToken(url: string): Promise<string> {
  const page = await fetch(`${url}/s2`);
  const html = await page.text();
  const match = /name="csrfToken" value="([a-f0-9]+)"/u.exec(html);
  if (match?.[1] === undefined) {
    throw new Error('S2 did not render a form token.');
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
    });
    servers.push(server);

    const token = await formToken(server.url);
    const preview = await fetch(`${server.url}/s2/preview`, {
      method: 'POST',
      headers: { origin: server.url },
      body: submission(token),
    });
    expect(preview.status).toBe(200);
    const previewHtml = await preview.text();
    expect(previewHtml).toContain('browser-launch');
    expect(previewHtml).toContain('Compiled canonical scenario');
    expect(previewHtml).toContain('acme-scenario/1');

    const launch = await fetch(`${server.url}/s2/launch`, {
      method: 'POST',
      headers: { origin: server.url },
      body: submission(token),
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
