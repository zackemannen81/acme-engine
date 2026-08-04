import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { basename, isAbsolute, resolve } from 'node:path';
import { URL } from 'node:url';

import type { Clock, IdGenerator } from '@acme/core';
import { parseScenario } from '@acme/testing';
import { parse as parseYaml } from 'yaml';

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
  buildCatalogView,
  buildExecutionView,
  buildMemoryDecisionsView,
  buildPlanView,
  buildRunsView,
  isSafeRunId,
  type PlanView,
} from '../index.js';
import { discoverCatalogSources } from '../node-source.js';
import { renderCatalogViewHtml } from '../web/render-catalog.js';
import { escapeHtml } from '../web/escape.js';
import { renderExecutionViewHtml } from '../web/render-execution.js';
import { renderMemoryDecisionsViewHtml } from '../web/render-memory-decisions.js';
import {
  renderPlanViewHtml,
  type PlanWorkbenchNotice,
} from '../web/render-plan.js';
import { renderRunsViewHtml } from '../web/render-runs.js';
import {
  renderShell,
  renderStubSurface,
  type WorkbenchSurface,
} from '../web/shell.js';
import {
  createInterfaceComposition,
  createInterfaceRegistries,
  type InterfaceComposition,
} from './composition.js';
import { launchPlan } from './launch.js';
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
  /** Configured fixture root for S2 preview/launch. Never browser supplied. */
  readonly scenarioRoot?: string;
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

const MAX_FORM_BYTES = 256 * 1024;

class WorkbenchFormRefused extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'WorkbenchFormRefused';
    this.status = status;
  }
}

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
    'content-security-policy':
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
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

function tokenMatches(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function assertSameServerRequest(
  request: IncomingMessage,
  csrfToken: string,
  submittedToken: string,
  port: number,
): void {
  if (!tokenMatches(submittedToken, csrfToken)) {
    throw new WorkbenchFormRefused(
      403,
      'The form token is missing or no longer valid. Reload S2 and try again.',
    );
  }
  if (request.headers['sec-fetch-site'] === 'cross-site') {
    throw new WorkbenchFormRefused(403, 'Cross-site form submission refused.');
  }
  const origin = request.headers.origin;
  if (origin === undefined) {
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new WorkbenchFormRefused(403, 'Invalid form origin refused.');
  }
  const loopback =
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === 'localhost' ||
    parsed.hostname === '[::1]' ||
    parsed.hostname === '::1';
  const originPort = Number(parsed.port === '' ? '80' : parsed.port);
  if (parsed.protocol !== 'http:' || !loopback || originPort !== port) {
    throw new WorkbenchFormRefused(
      403,
      'Cross-origin form submission refused.',
    );
  }
}

async function readForm(request: IncomingMessage): Promise<URLSearchParams> {
  const contentType = request.headers['content-type'] ?? '';
  if (!contentType.startsWith('application/x-www-form-urlencoded')) {
    throw new WorkbenchFormRefused(
      415,
      'S2 accepts application/x-www-form-urlencoded form submissions only.',
    );
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_FORM_BYTES) {
      throw new WorkbenchFormRefused(
        413,
        `The submitted plan exceeds the ${String(MAX_FORM_BYTES)} byte limit.`,
      );
    }
    chunks.push(buffer);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function requiredFormField(form: URLSearchParams, name: string): string {
  const value = form.get(name);
  if (value === null || value.trim().length === 0) {
    throw new WorkbenchFormRefused(400, `${name} is required.`);
  }
  return value;
}

function parsePlanSource(
  source: string,
):
  | { readonly raw: unknown; readonly error: null }
  | { readonly raw: null; readonly error: string } {
  try {
    return { raw: parseYaml(source) as unknown, error: null };
  } catch (error: unknown) {
    return {
      raw: null,
      error:
        error instanceof Error
          ? error.message
          : 'The YAML could not be parsed.',
    };
  }
}

export async function startWorkbenchServer(
  options: WorkbenchServerOptions,
): Promise<WorkbenchServer> {
  const host = assertLoopbackHost(options.host ?? '127.0.0.1');
  const workspaceRoot = resolve(options.workspaceRoot);
  const scenarioRoot =
    options.scenarioRoot === undefined
      ? undefined
      : resolve(options.scenarioRoot);
  const ledgerDatabase =
    options.ledgerDatabase === undefined
      ? undefined
      : resolve(options.ledgerDatabase);
  const csrfToken = randomBytes(32).toString('hex');
  const activeRunIds = new Set<string>();
  const registries = createInterfaceRegistries();
  const catalogRoot =
    options.scenarioRoot === undefined
      ? 'not configured'
      : isAbsolute(options.scenarioRoot)
        ? basename(options.scenarioRoot)
        : options.scenarioRoot.replaceAll('\\', '/');
  let boundPort = options.port;

  let composition: InterfaceComposition | undefined;
  if (ledgerDatabase !== undefined) {
    composition = createInterfaceComposition({
      repository: 'sqlite',
      database: ledgerDatabase,
      clock: options.clock,
      ids: options.ids,
    });
  }

  const server = createServer((request, response) => {
    void handle(request, response);
  });

  async function catalogView() {
    if (scenarioRoot === undefined) {
      return buildCatalogView(
        {
          root: catalogRoot,
          modules: registries.modules,
          contracts: registries.contracts,
        },
        { validateScenario: parseScenario },
      );
    }
    const discovered = await discoverCatalogSources({
      directory: scenarioRoot,
      root: catalogRoot,
    });
    return buildCatalogView(
      {
        root: discovered.root,
        modules: registries.modules,
        contracts: registries.contracts,
        scenarios: discovered.scenarios,
        fixtures: discovered.fixtures,
        diagnostics: discovered.diagnostics,
      },
      { validateScenario: parseScenario },
    );
  }

  async function handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    try {
      const url = new URL(request.url ?? '/', `http://${host}:${boundPort}`);
      const path = url.pathname;

      if (request.method === 'GET' && path === '/api/health') {
        sendJson(response, 200, {
          ok: true,
          host,
          viewContracts: {
            catalog: CATALOG_VIEW_VERSION,
            plan: PLAN_VIEW_VERSION,
            runs: RUNS_VIEW_VERSION,
            execution: EXECUTION_VIEW_VERSION,
            memoryDecisions: MEMORY_DECISION_VIEW_VERSION,
          },
        });
        return;
      }

      if (request.method === 'GET' && path === '/api/catalog') {
        sendJson(response, 200, await catalogView());
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

      if (request.method === 'GET' && path === '/api/memory-decisions') {
        const executionId = url.searchParams.get('executionId');
        if (executionId === null || executionId.length === 0) {
          sendJson(response, 400, {
            error: 'executionId is required.',
            view: MEMORY_DECISION_VIEW_VERSION,
          });
          return;
        }
        if (composition === undefined) {
          sendJson(response, 409, {
            error: 'S5 requires a configured durable ledger.',
            view: MEMORY_DECISION_VIEW_VERSION,
          });
          return;
        }
        const evidence = composition.repository.snapshot();
        const execution = evidence.executions.find(
          (entry) => entry.executionId === executionId,
        );
        if (execution === undefined) {
          sendJson(response, 404, {
            error: 'Execution not found.',
            executionId,
            view: MEMORY_DECISION_VIEW_VERSION,
          });
          return;
        }
        const replayEvidence =
          (await composition.repository.loadReplayEvidence(executionId)) ??
          null;
        sendJson(
          response,
          200,
          buildMemoryDecisionsView({
            executionId,
            preparedCommit: replayEvidence?.preparedCommit ?? null,
          }),
        );
        return;
      }

      if (request.method === 'GET' && path === '/') {
        response.writeHead(302, { location: '/s3' });
        response.end();
        return;
      }

      if (request.method === 'GET' && path === '/s1') {
        send(
          response,
          200,
          renderCatalogViewHtml(await catalogView()),
          'text/html; charset=utf-8',
        );
        return;
      }

      if (request.method === 'GET' && path === '/s2') {
        send(
          response,
          200,
          renderPlanViewHtml(null, {
            source: '',
            runId: '',
            csrfToken,
            launchAvailable: scenarioRoot !== undefined,
            ...(scenarioRoot === undefined
              ? {
                  launchUnavailableReason:
                    'start the workbench with --scenario-root <fixture-directory>',
                }
              : {}),
          }),
          'text/html; charset=utf-8',
        );
        return;
      }

      if (
        request.method === 'POST' &&
        (path === '/s2/preview' || path === '/s2/launch')
      ) {
        const form = await readForm(request);
        const submittedToken = requiredFormField(form, 'csrfToken');
        assertSameServerRequest(request, csrfToken, submittedToken, boundPort);
        const source = requiredFormField(form, 'planSource');
        const runId = requiredFormField(form, 'runId');
        const parsed = parsePlanSource(source);
        if (parsed.error !== null) {
          send(
            response,
            400,
            renderPlanViewHtml(null, {
              source,
              runId,
              csrfToken,
              launchAvailable: scenarioRoot !== undefined,
              notice: { level: 'error', message: parsed.error },
            }),
            'text/html; charset=utf-8',
          );
          return;
        }

        const planView = buildPlanView(parsed.raw);
        if (path === '/s2/preview' || planView.status === 'invalid') {
          send(
            response,
            planView.status === 'valid' ? 200 : 400,
            renderPlanViewHtml(planView, {
              source,
              runId,
              csrfToken,
              launchAvailable: scenarioRoot !== undefined,
              ...(planView.status === 'valid'
                ? {
                    notice: {
                      level: 'info' as const,
                      message:
                        'Plan validated. Review the compiled scenario before launch.',
                    },
                  }
                : {}),
            }),
            'text/html; charset=utf-8',
          );
          return;
        }

        if (scenarioRoot === undefined) {
          sendPlanRefusal(
            response,
            409,
            planView,
            source,
            runId,
            'Launch requires a configured scenario root.',
          );
          return;
        }
        if (!isSafeRunId(runId)) {
          sendPlanRefusal(
            response,
            400,
            planView,
            source,
            runId,
            'The run identifier must be a safe file name.',
          );
          return;
        }
        const workspace = createFileWorkspace({ root: workspaceRoot });
        if (
          activeRunIds.has(runId) ||
          (await workspace.loadRun(runId)) !== null
        ) {
          sendPlanRefusal(
            response,
            409,
            planView,
            source,
            runId,
            `Run ${JSON.stringify(runId)} already exists; existing history is never overwritten.`,
          );
          return;
        }
        if (
          planView.plan.availability === 'available' &&
          planView.plan.composition.repository === 'sqlite' &&
          ledgerDatabase === undefined
        ) {
          sendPlanRefusal(
            response,
            409,
            planView,
            source,
            runId,
            'This SQLite plan requires the workbench to start with --ledger <sqlite-file>.',
          );
          return;
        }

        let launched: Awaited<ReturnType<typeof launchPlan>> | undefined;
        activeRunIds.add(runId);
        try {
          launched = await launchPlan({
            plan: parsed.raw,
            scenarioRoot,
            workspace,
            runId,
            clock: options.clock,
            ...(ledgerDatabase === undefined
              ? {}
              : { database: ledgerDatabase }),
          });
        } catch (error: unknown) {
          sendPlanRefusal(
            response,
            400,
            planView,
            source,
            runId,
            error instanceof Error
              ? error.message
              : 'The run could not be launched.',
          );
          return;
        } finally {
          activeRunIds.delete(runId);
          launched?.composition.close();
        }
        response.writeHead(303, {
          location: `/s3/${encodeURIComponent(runId)}`,
          'cache-control': 'no-store',
        });
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
        if (record.composition.repository === 'memory') {
          send(
            response,
            200,
            renderShell({
              surface: 's4',
              title: 'Memory execution evidence unavailable',
              subtitle:
                'The run record is durable; its in-memory ledger was not.',
              body: `<section class="card"><p>The run used the memory repository. After synchronous launch returns, there is no durable execution ledger for S4 to inspect.</p></section>`,
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

      if (request.method === 'GET' && path === '/s5') {
        const executionId = url.searchParams.get('executionId');
        if (executionId === null || executionId.length === 0) {
          send(
            response,
            200,
            renderShell({
              surface: 's5',
              title: 'S5 Memory decisions',
              subtitle: `View ${MEMORY_DECISION_VIEW_VERSION}`,
              body: '<section class="card"><p>Choose an execution in S4, then follow <strong>Inspect memory decisions</strong>.</p></section>',
            }),
            'text/html; charset=utf-8',
          );
          return;
        }
        if (composition === undefined) {
          send(
            response,
            200,
            renderShell({
              surface: 's5',
              title: 'S5 needs a ledger path',
              subtitle: `View ${MEMORY_DECISION_VIEW_VERSION}`,
              body: '<section class="card"><p>Start the workbench with <code>--ledger &lt;sqlite-file&gt;</code> to inspect durable memory evidence.</p></section>',
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
            renderShell({
              surface: 's5',
              title: 'Execution not found',
              subtitle: `View ${MEMORY_DECISION_VIEW_VERSION}`,
              body: `<section class="card"><p>No durable execution matched <code>${escapeHtml(executionId)}</code>.</p></section>`,
            }),
            'text/html; charset=utf-8',
          );
          return;
        }
        const replayEvidence =
          (await composition.repository.loadReplayEvidence(executionId)) ??
          null;
        const view = buildMemoryDecisionsView({
          executionId,
          preparedCommit: replayEvidence?.preparedCommit ?? null,
        });
        send(
          response,
          200,
          renderMemoryDecisionsViewHtml(view),
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
      if (error instanceof WorkbenchFormRefused) {
        send(
          response,
          error.status,
          error.message,
          'text/plain; charset=utf-8',
        );
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Internal workbench error';
      send(response, 500, message, 'text/plain; charset=utf-8');
    }
  }

  function sendPlanRefusal(
    response: ServerResponse,
    status: number,
    view: PlanView,
    source: string,
    runId: string,
    message: string,
  ): void {
    const notice: PlanWorkbenchNotice = { level: 'error', message };
    send(
      response,
      status,
      renderPlanViewHtml(view, {
        source,
        runId,
        csrfToken,
        launchAvailable: scenarioRoot !== undefined,
        notice,
      }),
      'text/html; charset=utf-8',
    );
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
  boundPort = port;

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
