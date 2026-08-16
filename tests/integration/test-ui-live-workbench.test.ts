import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ProviderTransport } from '../../packages/adapter-model-openai/src/index.js';
import { afterEach, describe, expect, it } from 'vitest';

import {
  RUN_RECORD_VERSION,
  type RunRecord,
} from '../../apps/test-ui/src/index.js';
import {
  createFileWorkspace,
  startWorkbenchServer,
} from '../../apps/test-ui/src/local.js';

const roots: string[] = [];
const servers: { close(): Promise<void> }[] = [];

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

function root(): string {
  const value = mkdtempSync(join(tmpdir(), 'acme-wb-live-'));
  roots.push(value);
  return value;
}

const narrativeOutput = {
  observations: [
    {
      type: 'character-fact',
      subject: 'Mira',
      predicate: 'eye color',
      value: 'green',
      confidence: 0.9,
    },
  ],
  scene: {
    location: 'Observatory',
    time: 'Night',
    summary: 'Mira records the northern light rule.',
  },
};

const executionRequest = {
  requestKey: 'browser-live-request',
  namespace: 'narrative',
  task: 'observe-document',
  entityId: 'story-browser-live',
  expectedRevision: 0,
  input: {
    documentKey: 'chapter-browser-live',
    title: 'Northern Light',
    text: 'Mira says her eyes are green. The northern light reveals hidden paths.',
  },
  model: {
    profile: 'offline-json',
    providerHint: 'openai',
    modelHint: 'responses',
  },
  policy: {
    retention: 'hash-only',
    maxModelCalls: 1,
    maxRepairCalls: 0,
    maxRevisionCalls: 0,
  },
};

function responseBody(): string {
  return JSON.stringify({
    id: 'resp_browser_live',
    model: 'gpt-fixture-live',
    status: 'completed',
    output: [
      {
        type: 'message',
        content: [
          {
            type: 'output_text',
            text: JSON.stringify(narrativeOutput),
          },
        ],
      },
    ],
    usage: { input_tokens: 11, output_tokens: 7, total_tokens: 18 },
  });
}

function form(
  token: string,
  overrides: Readonly<Record<string, string>> = {},
): URLSearchParams {
  return new URLSearchParams({
    csrfToken: token,
    runId: 'browser-live-001',
    optIn: 'true',
    provider: 'openai',
    model: 'gpt-fixture-live',
    caseCount: '1',
    maxModelCalls: '1',
    costCeilingMinor: '50',
    currency: 'USD',
    confirmer: 'browser-integration',
    rationale: 'Bounded offline-transport proof of the browser live gate.',
    requestSource: JSON.stringify(executionRequest),
    ...overrides,
  });
}

async function token(url: string): Promise<string> {
  const html = await (await fetch(`${url}/s10`)).text();
  const match = /name="csrfToken" value="([a-f0-9]+)"/u.exec(html);
  if (match?.[1] === undefined) {
    throw new Error('S10 did not render a CSRF token.');
  }
  return match[1];
}

function recordedRun(runId: string, gateway: string): RunRecord {
  return {
    version: RUN_RECORD_VERSION,
    runId,
    planName: gateway === 'mock' ? 'offline' : 'live-evaluation',
    scenarioName: gateway === 'mock' ? 'offline' : 'live-evaluation',
    startedAt: '2026-08-05T10:00:00.000Z',
    finishedAt: '2026-08-05T10:00:01.000Z',
    composition: { repository: 'memory', gateway },
    status: 'passed',
    steps: [{ index: 0, kind: 'execute', status: 'passed' }],
    cases: [{ alias: 'only', executionId: `execution-${runId}` }],
    failure: null,
    ...(gateway === 'mock'
      ? {}
      : {
          live: {
            provider: 'openai',
            model: 'gpt-fixture-live',
            confirmer: 'seed',
            maxModelCalls: 1,
            costCeilingMinor: 50,
          },
        }),
  };
}

describe('test-ui S10 live workbench', () => {
  it('renders live-only history and refuses launch before transport when the process gate is closed', async () => {
    const workspaceRoot = root();
    const workspace = createFileWorkspace({ root: workspaceRoot });
    await workspace.recordRun(recordedRun('offline-hidden', 'mock'));
    await workspace.recordRun(recordedRun('live-visible', 'openai'));
    let transportCalls = 0;
    const server = await startWorkbenchServer({
      workspaceRoot,
      host: '127.0.0.1',
      port: 0,
      clock: { now: () => '2026-08-05T10:00:02.000Z' },
      ids: { next: (kind) => `${kind}-closed` },
      liveOptIn: false,
      liveApiKey: 'test-browser-secret',
      liveOpenAiTransport: {
        async send() {
          transportCalls += 1;
          return {
            kind: 'response',
            status: 200,
            headers: {},
            body: responseBody(),
          };
        },
      },
    });
    servers.push(server);

    const page = await fetch(`${server.url}/s10`);
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain('Process gate disabled');
    expect(html).toContain('live-visible');
    expect(html).not.toContain('offline-hidden');
    expect(html).not.toContain('name="apiKey"');
    expect(html).not.toContain('test-browser-secret');

    const api = await fetch(`${server.url}/api/live-evaluation`);
    const view = (await api.json()) as {
      view: string;
      series: string;
      runs: { runCount: number; items: { runId: string }[] };
    };
    expect(view).toMatchObject({
      view: 'acme-view-live-evaluation/1',
      series: 'live',
      runs: { runCount: 1 },
    });
    expect(view.runs.items[0]?.runId).toBe('live-visible');
    expect(JSON.stringify(view)).not.toContain('test-browser-secret');

    const refused = await fetch(`${server.url}/s10/launch`, {
      method: 'POST',
      headers: { origin: server.url },
      body: form(await token(server.url)),
      redirect: 'manual',
    });
    expect(refused.status).toBe(403);
    expect(await refused.text()).toContain('ACME_TEST_UI_LIVE');
    expect(transportCalls).toBe(0);
  });

  it('launches once through the injected transport and refuses malformed, duplicate and concurrent submissions', async () => {
    const workspaceRoot = root();
    let releaseTransport: (() => void) | undefined;
    let enteredTransport: (() => void) | undefined;
    const entered = new Promise<void>((resolve) => {
      enteredTransport = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseTransport = resolve;
    });
    let transportCalls = 0;
    const transport: ProviderTransport = {
      async send() {
        transportCalls += 1;
        enteredTransport?.();
        await release;
        return {
          kind: 'response',
          status: 200,
          headers: {},
          body: responseBody(),
        };
      },
    };
    let sequence = 0;
    const server = await startWorkbenchServer({
      workspaceRoot,
      host: '127.0.0.1',
      port: 0,
      clock: { now: () => '2026-08-05T10:00:02.000Z' },
      ids: {
        next(kind) {
          sequence += 1;
          return `${kind}-browser-${String(sequence)}`;
        },
      },
      liveOptIn: true,
      liveApiKey: 'test-browser-secret',
      liveOpenAiTransport: transport,
    });
    servers.push(server);
    const csrf = await token(server.url);

    const badToken = await fetch(`${server.url}/s10/launch`, {
      method: 'POST',
      headers: { origin: server.url },
      body: form('wrong-token'),
    });
    expect(badToken.status).toBe(403);

    const crossSite = await fetch(`${server.url}/s10/launch`, {
      method: 'POST',
      headers: { origin: 'http://example.test' },
      body: form(csrf),
    });
    expect(crossSite.status).toBe(403);

    const unconfirmed = await fetch(`${server.url}/s10/launch`, {
      method: 'POST',
      headers: { origin: server.url },
      body: form(csrf, { runId: 'browser-live-unconfirmed', optIn: '' }),
    });
    expect(unconfirmed.status).toBe(400);
    expect(await unconfirmed.text()).toContain('confirmation.optIn');
    expect(transportCalls).toBe(0);

    const badRequest = await fetch(`${server.url}/s10/launch`, {
      method: 'POST',
      headers: { origin: server.url },
      body: form(csrf, {
        runId: 'browser-live-bad',
        requestSource: '{"unexpected":true}',
      }),
    });
    expect(badRequest.status).toBe(400);
    expect(await badRequest.text()).toContain('invalid shape');
    expect(transportCalls).toBe(0);

    const overBudget = await fetch(`${server.url}/s10/launch`, {
      method: 'POST',
      headers: { origin: server.url },
      body: form(csrf, {
        runId: 'browser-live-over-budget',
        requestSource: JSON.stringify({
          ...executionRequest,
          policy: { ...executionRequest.policy, maxModelCalls: 2 },
        }),
      }),
    });
    expect(overBudget.status).toBe(400);
    expect(await overBudget.text()).toContain(
      'exactly one model call and zero revision calls',
    );
    expect(transportCalls).toBe(0);

    const first = fetch(`${server.url}/s10/launch`, {
      method: 'POST',
      headers: { origin: server.url },
      body: form(csrf),
      redirect: 'manual',
    });
    await entered;
    const concurrent = await fetch(`${server.url}/s10/launch`, {
      method: 'POST',
      headers: { origin: server.url },
      body: form(csrf),
      redirect: 'manual',
    });
    expect(concurrent.status).toBe(409);
    expect(await concurrent.text()).toContain('in progress');
    releaseTransport?.();
    const launched = await first;
    expect(launched.status).toBe(303);
    expect(launched.headers.get('location')).toBe(
      '/s10?launched=browser-live-001',
    );
    expect(transportCalls).toBe(1);

    const duplicate = await fetch(`${server.url}/s10/launch`, {
      method: 'POST',
      headers: { origin: server.url },
      body: form(csrf),
      redirect: 'manual',
    });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.text()).toContain('never overwritten');
    expect(transportCalls).toBe(1);

    const stored = readFileSync(
      join(workspaceRoot, 'runs', 'browser-live-001.json'),
      'utf8',
    );
    expect(stored).toContain('"gateway": "openai"');
    expect(stored).toContain('browser-integration');
    expect(stored).not.toContain('test-browser-secret');
    expect(stored).not.toMatch(/apiKey|OPENAI_API_KEY/u);

    const history = await fetch(`${server.url}/s10?launched=browser-live-001`);
    const historyHtml = await history.text();
    expect(history.status).toBe(200);
    expect(historyHtml).toContain('browser-live-001');
    expect(historyHtml).toContain('passed');
    expect(historyHtml).not.toContain('test-browser-secret');
  });
});
