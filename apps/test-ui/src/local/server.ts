import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { URL } from 'node:url';

import type { Clock, IdGenerator } from '@acme/core';

import {
  CATALOG_VIEW_VERSION,
  EXECUTION_VIEW_VERSION,
  FIXTURE_REVIEW_VIEW_VERSION,
  LIVE_EVALUATION_VIEW_VERSION,
  MEASUREMENT_VIEW_VERSION,
  MEMORY_DECISION_VIEW_VERSION,
  PLAN_VIEW_VERSION,
  REPLAY_VIEW_VERSION,
  RUNS_VIEW_VERSION,
  STATE_VIEW_VERSION,
  buildExecutionView,
  buildRunsView,
} from '../index.js';
import { renderExecutionViewHtml } from '../web/render-execution.js';
import { renderRunsViewHtml } from '../web/render-runs.js';
import { renderStubSurface, type WorkbenchSurface } from '../web/shell.js';
import {
  createInterfaceComposition,
  type InterfaceComposition,
} from './composition.js';
import { createFileWorkspace } from './workspace.js';

/**
 * Loopback-only workbench server (ADR-0024).
 */

export class WorkbenchServeRefused extends Error {
  readonly reason: string;

  constructor(reason: string, message: string) {
    super(message);
    this.name = 'WorkbenchServeRefused';
    this.reason = reason;
  }
}

export const WORKBENCH_SERVE_REFUSAL = {
  host: 'WORKBENCH_HOST_NOT_LOOPBACK',
} as const;

export interface WorkbenchServerOptions {
  readonly workspaceRoot: string;
  /** Must be loopback. Default `127.0.0.1`. */
  readonly host?: string;
  readonly port: number;
  /**
   * Optional SQLite ledger used to resolve S4 for a run's execution id.
   * When omitted, `/s4` serves a message that evidence is not configured.
   */
  readonly ledgerDatabase?: string;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

export interface WorkbenchServer {
  readonly host: string;
  readonly port: number;
  readonly url: string;
  close(): Promise<void>;
}

const STUBS: readonly {
  readonly id: WorkbenchSurface;
  readonly title: string;
  readonly contractVersion: string;
}[] = [
  { id: 's1', title: 'S1 Catalog', contractVersion: CATALOG_VIEW_VERSION },
  { id: 's2', title: 'S2 Plan designer', contractVersion: PLAN_VIEW_VERSION },
  {
    id: 's5',
    title: 'S5 Memory decisions',
    contractVersion: MEMORY_DECISION_VIEW_VERSION,
  },
  { id: 's6', title: 'S6 State', contractVersion: STATE_VIEW_VERSION },
  { id: 's7', title: 'S7 Replay', contractVersion: REPLAY_VIEW_VERSION },
  {
    id: 's8',
    title: 'S8 Measurement',
    contractVersion: MEASUREMENT_VIEW_VERSION,
  },
  {
    id: 's9',
    title: 'S9 Fixture review',
    contractVersion: FIXTURE_REVIEW_VIEW_VERSION,
  },
  {
    id: 's10',
    title: 'S10 Live evaluation',
    contractVersion: LIVE_EVALUATION_VIEW_VERSION,
  },
];

function assertLoopbackHost(host: string): string {
  const normalized = host.trim().toLowerCase();
  if (
    normalized === '127.0.0.1' ||
    normalized === 'localhost' ||
    normalized === '::1'
  ) {
    return normalized === 'localhost' ? '127.0.0.1' : host.trim();
  }
  throw new WorkbenchServeRefused(
    WORKBENCH_SERVE_REFUSAL.host,
    `Workbench may bind loopback only; refused host ${JSON.stringify(host)}.`,
  );
}

function send(
  response: ServerResponse,
  status: number,
  body: string,
  contentType: string,
): void {
  response.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store',
  });
  response.end(body);
}

function sendJson(
  response: ServerResponse,
  status: number,
  value: unknown,
): void {
  send(
    response,
    status,
    JSON.stringify(value),
    'application/json; charset=utf-8',
  );
}

async function readRuns(workspaceRoot: string) {
  const workspace = createFileWorkspace({ root: workspaceRoot });
  return workspace.listRuns();
}

export async function startWorkbenchServer(
  options: WorkbenchServerOptions,
): Promise<WorkbenchServer> {
  const host = assertLoopbackHost(options.host ?? '127.0.0.1');
  const workspaceRoot = options.workspaceRoot;

  let composition: InterfaceComposition | undefined;
  if (options.ledgerDatabase !== undefined) {
    composition = createInterfaceComposition({
      repository: 'sqlite',
      database: options.ledgerDatabase,
      clock: options.clock,
      ids: options.ids,
    });
  }

  const server = createServer((request, response) => {
    void handle(request, response);
  });

  async function handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    try {
      const url = new URL(request.url ?? '/', `http://${host}:${options.port}`);
      const path = url.pathname;

      if (request.method === 'GET' && path === '/api/health') {
        sendJson(response, 200, {
          ok: true,
          host,
          viewContracts: {
            runs: RUNS_VIEW_VERSION,
            execution: EXECUTION_VIEW_VERSION,
          },
        });
        return;
      }

      if (request.method === 'GET' && path === '/api/runs') {
        const history = await readRuns(workspaceRoot);
        const view = buildRunsView({
          records: history.records,
          unreadable: history.unreadable,
        });
        sendJson(response, 200, view);
        return;
      }

      if (request.method === 'GET' && path === '/') {
        response.writeHead(302, { location: '/s3' });
        response.end();
        return;
      }

      if (request.method === 'GET' && path === '/s3') {
        const history = await readRuns(workspaceRoot);
        const view = buildRunsView({
          records: history.records,
          unreadable: history.unreadable,
        });
        send(
          response,
          200,
          renderRunsViewHtml(view),
          'text/html; charset=utf-8',
        );
        return;
      }

      if (request.method === 'GET' && path.startsWith('/s3/')) {
        const runId = decodeURIComponent(path.slice('/s3/'.length));
        const history = await readRuns(workspaceRoot);
        const record = history.records.find((entry) => entry.runId === runId);
        if (record === undefined) {
          send(
            response,
            404,
            renderStubSurface({
              surface: 's3',
              title: 'Run not found',
              contractVersion: RUNS_VIEW_VERSION,
            }),
            'text/html; charset=utf-8',
          );
          return;
        }
        const executionId = record.cases[0]?.executionId;
        if (executionId === undefined) {
          send(
            response,
            200,
            renderStubSurface({
              surface: 's4',
              title: 'No execution linked',
              contractVersion: EXECUTION_VIEW_VERSION,
            }),
            'text/html; charset=utf-8',
          );
          return;
        }
        response.writeHead(302, {
          location: `/s4?executionId=${encodeURIComponent(executionId)}`,
        });
        response.end();
        return;
      }

      if (request.method === 'GET' && path === '/s4') {
        const executionId = url.searchParams.get('executionId');
        if (executionId === null || executionId.length === 0) {
          send(
            response,
            200,
            renderStubSurface({
              surface: 's4',
              title: 'S4 Execution inspector',
              contractVersion: EXECUTION_VIEW_VERSION,
            }),
            'text/html; charset=utf-8',
          );
          return;
        }
        if (composition === undefined) {
          send(
            response,
            200,
            renderStubSurface({
              surface: 's4',
              title: 'S4 needs a ledger path',
              contractVersion: EXECUTION_VIEW_VERSION,
            }),
            'text/html; charset=utf-8',
          );
          return;
        }
        const evidence = composition.repository.snapshot();
        const execution = evidence.executions.find(
          (entry) => entry.executionId === executionId,
        );
        if (execution === undefined) {
          send(
            response,
            404,
            renderStubSurface({
              surface: 's4',
              title: 'Execution not found',
              contractVersion: EXECUTION_VIEW_VERSION,
            }),
            'text/html; charset=utf-8',
          );
          return;
        }
        const attempts = evidence.attempts.filter(
          (entry) => entry.executionId === executionId,
        );
        const modelCalls = evidence.modelCalls.filter(
          (entry) => entry.executionId === executionId,
        );
        const replayEvidence =
          (await composition.repository.loadReplayEvidence(executionId)) ??
          null;
        const view = buildExecutionView({
          execution,
          attempts,
          modelCalls,
          replayEvidence,
        });
        send(
          response,
          200,
          renderExecutionViewHtml(view),
          'text/html; charset=utf-8',
        );
        return;
      }

      const stub = STUBS.find((entry) => path === `/${entry.id}`);
      if (request.method === 'GET' && stub !== undefined) {
        send(
          response,
          200,
          renderStubSurface({
            surface: stub.id,
            title: stub.title,
            contractVersion: stub.contractVersion,
          }),
          'text/html; charset=utf-8',
        );
        return;
      }

      send(response, 404, 'Not found', 'text/plain; charset=utf-8');
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Internal workbench error';
      send(response, 500, message, 'text/plain; charset=utf-8');
    }
  }

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  const port =
    typeof address === 'object' && address !== null
      ? address.port
      : options.port;

  return {
    host,
    port,
    url: `http://${host}:${port}`,
    async close() {
      composition?.close();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
