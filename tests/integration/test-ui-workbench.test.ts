import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { RUN_RECORD_VERSION } from '../../apps/test-ui/src/index.js';
import {
  createFileWorkspace,
  startWorkbenchServer,
  WorkbenchServeRefused,
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
});
