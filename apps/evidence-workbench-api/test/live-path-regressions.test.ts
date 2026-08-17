import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { createEvidenceWorkbenchWorker } from '@acme/evidence-workbench-worker';
import type { EvidenceProductRepository } from '@acme/evidence-product-contracts';

import { listenEvidenceWorkbenchApi } from '../src/index.js';
import { createLocalEvidenceWorkbench } from '../src/local.js';

const directories: string[] = [];

afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

async function scratch(prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
  directories.push(directory);
  return directory;
}

async function login(
  address: string,
  credentials: {
    readonly email: string;
    readonly password: string | undefined;
  },
): Promise<(pathname: string, init?: RequestInit) => Promise<Response>> {
  const origin = address.slice(0, -1);
  const response = await fetch(`${address}auth/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(credentials),
  });
  expect(response.status, await response.clone().text()).toBe(201);
  const cookies = response.headers.getSetCookie();
  const cookie = cookies.map((value) => value.split(';')[0]).join('; ');
  const csrfCookie = cookies
    .map((value) => value.split(';')[0])
    .find((value) => value?.startsWith('acme_csrf='));
  if (csrfCookie === undefined) throw new Error('Missing CSRF cookie.');
  const csrf = decodeURIComponent(csrfCookie.slice('acme_csrf='.length));
  return (pathname, init = {}) => {
    const method = init.method ?? 'GET';
    const headers = new Headers(init.headers);
    headers.set('cookie', cookie);
    if (!['GET', 'HEAD'].includes(method)) {
      headers.set('origin', origin);
      headers.set('x-acme-csrf', csrf);
    }
    return fetch(`${address}${pathname}`, { ...init, headers });
  };
}

describe('Live path regressions (ACME-0131)', () => {
  it('keeps a session issued after the process has outlived one upstream lifetime', async () => {
    const directory = await scratch('evidence-session-lifetime-');
    const base = Date.parse('2026-08-15T08:00:00.000Z');
    let offsetMs = 0;
    const clock = { now: () => new Date(base + offsetMs).toISOString() };
    const local = await createLocalEvidenceWorkbench({
      dataFile: path.join(directory, 'product.json'),
      seedMode: 'none',
      clock,
    });
    const address = await listenEvidenceWorkbenchApi(local.server, { port: 0 });
    try {
      // Well past the 15-minute upstream lifetime granted at composition.
      offsetMs = 20 * 60 * 1_000;
      const request = await login(address.url, local.authCredentials);
      const signedIn = await request('api/session');
      expect(signedIn.status, await signedIn.clone().text()).toBe(200);

      // Past this session's own upstream expiry, so resolve must refresh.
      offsetMs = 40 * 60 * 1_000;
      const refreshed = await request('api/session');
      expect(refreshed.status, await refreshed.clone().text()).toBe(200);
    } finally {
      await new Promise<void>((resolve, reject) =>
        local.server.close((error) => (error ? reject(error) : resolve())),
      );
      await local.close();
    }
  });

  it('writes no observation when the live projection guard refuses', async () => {
    const directory = await scratch('evidence-projection-order-');
    const local = await createLocalEvidenceWorkbench({
      dataFile: path.join(directory, 'product.json'),
      seedMode: 'development',
    });
    try {
      const before = await local.productRepository.caseSnapshot(
        local.caseId,
        local.workspaceId,
      );
      const source = before.sources[0];
      if (source === undefined) throw new Error('The seed produced no source.');
      const observationsBefore = before.observations.length;
      const revisionBefore = before.workspaces.find(
        (item) => item.workspaceId === local.workspaceId,
      )?.evidenceRevision;
      expect(observationsBefore).toBeGreaterThan(0);

      const writes: string[] = [];
      const repository = new Proxy(local.productRepository, {
        get(target, property, receiver) {
          const value = Reflect.get(target, property, receiver) as unknown as
            ((...args: unknown[]) => unknown) | unknown;
          if (typeof value !== 'function') return value;
          const bound = (value as (...args: unknown[]) => unknown).bind(target);
          if (property !== 'putObservations') return bound;
          return (...args: unknown[]) => {
            writes.push('putObservations');
            return bound(...args);
          };
        },
      }) as EvidenceProductRepository;

      const worker = createEvidenceWorkbenchWorker({
        repository,
        clock: { now: () => new Date().toISOString() },
        executor: {
          observe() {
            throw new Error('The import executor must not run here.');
          },
        },
      });

      const scope = {
        caseId: local.caseId,
        workspaceId: local.workspaceId,
        boundAt: new Date().toISOString(),
      };
      const job = await worker.startLiveObservation(
        {
          schemaVersion: 'evidence-live-observation-command/1',
          workspaceId: local.workspaceId,
          modelId: 'test-only-model',
          currency: null,
          commandKey: 'acme-0131-refused-projection',
          artifactVersionId: source.artifactVersionId,
          actorRoster: [],
          requestedBudget: { maxModelCalls: 1, costCeilingMinor: null },
          confirmation: {},
        },
        {
          // The engine advanced; the product workspace did not.
          async observe() {
            return {
              executionId: 'execution-acme-0131',
              evidenceRevision: 99,
              observations: [],
              replayed: false,
              actualModelCalls: 1,
            };
          },
        },
        scope,
      );

      const settled = await worker.wait(job.jobId, scope);
      expect(settled.phase).toBe('failed');
      expect((settled as { readonly reasonCode?: string }).reasonCode).toBe(
        'EVIDENCE_PRODUCT_COMMAND_COLLISION',
      );
      expect(writes).toEqual([]);

      const after = await local.productRepository.caseSnapshot(
        local.caseId,
        local.workspaceId,
      );
      expect(after.observations).toHaveLength(observationsBefore);
      expect(
        after.workspaces.find((item) => item.workspaceId === local.workspaceId)
          ?.evidenceRevision,
      ).toBe(revisionBefore);
    } finally {
      await local.close();
    }
  });

  it('projects observations when the product revision is ahead of the engine', async () => {
    const directory = await scratch('evidence-projection-import-ahead-');
    const local = await createLocalEvidenceWorkbench({
      dataFile: path.join(directory, 'product.json'),
      seedMode: 'development',
    });
    try {
      const before = await local.productRepository.caseSnapshot(
        local.caseId,
        local.workspaceId,
      );
      const source = before.sources[0];
      if (source === undefined) throw new Error('The seed produced no source.');
      const revisionBefore = before.workspaces.find(
        (item) => item.workspaceId === local.workspaceId,
      )?.evidenceRevision;
      expect(revisionBefore).toBeGreaterThan(0);

      const writes: string[] = [];
      const repository = new Proxy(local.productRepository, {
        get(target, property, receiver) {
          const value = Reflect.get(target, property, receiver) as unknown as
            ((...args: unknown[]) => unknown) | unknown;
          if (typeof value !== 'function') return value;
          const bound = (value as (...args: unknown[]) => unknown).bind(target);
          if (property !== 'putObservations') return bound;
          return (...args: unknown[]) => {
            writes.push('putObservations');
            return bound(...args);
          };
        },
      }) as EvidenceProductRepository;

      const worker = createEvidenceWorkbenchWorker({
        repository,
        clock: { now: () => new Date().toISOString() },
        executor: {
          observe() {
            throw new Error('The import executor must not run here.');
          },
        },
      });

      const scope = {
        caseId: local.caseId,
        workspaceId: local.workspaceId,
        boundAt: new Date().toISOString(),
      };
      const job = await worker.startLiveObservation(
        {
          schemaVersion: 'evidence-live-observation-command/1',
          workspaceId: local.workspaceId,
          modelId: 'test-only-model',
          currency: null,
          commandKey: 'acme-0136-product-ahead',
          artifactVersionId: source.artifactVersionId,
          actorRoster: [],
          requestedBudget: { maxModelCalls: 1, costCeilingMinor: null },
          confirmation: {},
        },
        {
          async observe() {
            return {
              executionId: 'execution-acme-0136-ahead',
              // One behind the product: the shape after two imports and one
              // engine observation. The previous `!==` guard refused this.
              evidenceRevision: Math.max(0, (revisionBefore ?? 1) - 1),
              observations: [],
              replayed: false,
              actualModelCalls: 1,
            };
          },
        },
        scope,
      );

      const settled = await worker.wait(job.jobId, scope);
      expect({
        phase: settled.phase,
        reasonCode: (settled as { readonly reasonCode?: string }).reasonCode,
        message: settled.message,
      }).toEqual({
        phase: 'completed',
        reasonCode: 'LIVE_OBSERVATION_COMPLETED',
        message: expect.any(String),
      });
      expect(writes).toEqual(['putObservations']);
    } finally {
      await local.close();
    }
  });

  it('reads each case through its own evidence projection', async () => {
    const directory = await scratch('evidence-projection-scope-');
    const local = await createLocalEvidenceWorkbench({
      dataFile: path.join(directory, 'product.json'),
      seedMode: 'development',
    });
    const address = await listenEvidenceWorkbenchApi(local.server, { port: 0 });
    try {
      const request = await login(address.url, local.authCredentials);
      const session = (await (await request('api/session')).json()) as {
        readonly memberships: readonly { readonly organizationId: string }[];
      };
      const organizationId = session.memberships[0]?.organizationId;
      expect(organizationId).toBeTypeOf('string');

      const seeded = await request(
        `api/cases/${encodeURIComponent(local.caseId)}/observations`,
      );
      expect(seeded.status, await seeded.clone().text()).toBe(200);
      const seededView = (await seeded.json()) as {
        readonly entries: readonly unknown[];
      };
      expect(seededView.entries.length).toBeGreaterThan(0);

      const created = await request(
        `api/organizations/${encodeURIComponent(organizationId as string)}/cases`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            schemaVersion: 'evidence-create-case-command/2',
            commandKey: 'acme-0131-second-case',
            title: 'Second case',
            caseReference: 'ACME-0131-2',
            metadata: {},
            dataPolicy: 'synthetic-only',
          }),
        },
      );
      expect(created.status, await created.clone().text()).toBe(201);
      const secondCase = (await created.json()) as { readonly caseId: string };

      // The seeded workspace committed last. A case-scoped read must still
      // resolve its own projection rather than the globally latest snapshot.
      const second = await request(
        `api/cases/${encodeURIComponent(secondCase.caseId)}/observations`,
      );
      expect(second.status, await second.clone().text()).toBe(200);
      const secondView = (await second.json()) as {
        readonly entries: readonly unknown[];
        readonly workspace: { readonly evidenceRevision: number };
      };
      expect(secondView.entries).toEqual([]);
      expect(secondView.workspace.evidenceRevision).toBe(0);

      // Case-scoped read models must resolve the requested case, not the
      // composition default. Reading the default here would disclose another
      // case's counts under this case's heading.
      const overview = await request(
        `api/cases/${encodeURIComponent(secondCase.caseId)}/overview`,
      );
      expect(overview.status, await overview.clone().text()).toBe(200);
      const overviewView = (await overview.json()) as {
        readonly counts: Record<string, number>;
      };
      expect(overviewView.counts['sources']).toBe(0);

      const report = await request(
        `api/cases/${encodeURIComponent(secondCase.caseId)}/integrity-report`,
      );
      expect(report.status, await report.clone().text()).toBe(200);

      const policy = await request(
        `api/cases/${encodeURIComponent(secondCase.caseId)}/export-policy`,
      );
      expect(policy.status, await policy.clone().text()).toBe(200);
    } finally {
      await new Promise<void>((resolve, reject) =>
        local.server.close((error) => (error ? reject(error) : resolve())),
      );
      await local.close();
    }
  });
});
