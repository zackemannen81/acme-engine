import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { basename, isAbsolute, resolve } from 'node:path';
import { URL } from 'node:url';

import type {
  Clock,
  ExecutionRequest,
  IdGenerator,
  ModelGateway,
  PayloadEncryptor,
} from '@acme/core';
import type { ProviderTransport } from '@acme/adapter-model-openai';
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
  ApprovalRefused,
  buildCatalogView,
  buildExecutionView,
  buildFixtureReviewView,
  buildLiveEvaluationView,
  buildMemoryDecisionsView,
  buildMeasurementView,
  buildPlanView,
  buildReplayView,
  buildRunsView,
  buildStateView,
  decideFixtureChange,
  isLiveOptInEnv,
  isSafeRunId,
  LIVE_CONFIRMATION_VERSION,
  LIVE_GATE_REFUSAL,
  LiveGateRefused,
  type FixtureApprovalRecord,
  type FixtureChangeProposal,
  type FixtureReviewView,
  type LiveEvaluationConfirmation,
  type LiveEvaluationView,
  type MeasureId,
  type MeasurementThresholds,
  type MeasurementView,
  type PlanView,
} from '../index.js';
import { discoverCatalogSources } from '../node-source.js';
import { resolveReference } from '../catalog/paths.js';
import { renderCatalogViewHtml } from '../web/render-catalog.js';
import { escapeHtml } from '../web/escape.js';
import { renderExecutionViewHtml } from '../web/render-execution.js';
import { renderFixtureReviewViewHtml } from '../web/render-fixture-review.js';
import {
  renderLiveEvaluationViewHtml,
  type LiveEvaluationFormValues,
} from '../web/render-live-evaluation.js';
import { renderMemoryDecisionsViewHtml } from '../web/render-memory-decisions.js';
import { renderMeasurementViewHtml } from '../web/render-measurement.js';
import {
  renderPlanViewHtml,
  type PlanWorkbenchNotice,
} from '../web/render-plan.js';
import { renderRunsViewHtml } from '../web/render-runs.js';
import { renderReplayViewHtml } from '../web/render-replay.js';
import { renderStateViewHtml } from '../web/render-state.js';
import { renderShell, renderStubSurface } from '../web/shell.js';
import {
  createInterfaceComposition,
  createInterfaceRegistries,
  type InterfaceComposition,
} from './composition.js';
import { createJobRunner } from './job-runner.js';
import { launchLiveExecution } from './live-launch.js';
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
  /** Optional key boundary for encrypted-payload launch and replay. */
  readonly payloadEncryptor?: PayloadEncryptor;
  /** Test-only override. Production reads ACME_TEST_UI_LIVE. */
  readonly liveOptIn?: boolean;
  /** Test-only transport injection. Production uses fetch. */
  readonly liveOpenAiTransport?: ProviderTransport;
  /** Test-only API-key injection. Production reads OPENAI_API_KEY. */
  readonly liveApiKey?: string;
}

export interface WorkbenchServer {
  readonly host: string;
  readonly port: number;
  readonly url: string;
  close(): Promise<void>;
}

const MAX_FORM_BYTES = 256 * 1024;

const REPLAY_GATEWAY_GUARD: ModelGateway = {
  async capabilities() {
    throw new Error('Replay must not call a gateway.');
  },
  async generate() {
    throw new Error('Replay must not call a gateway.');
  },
};

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

async function readJobs(workspaceRoot: string) {
  const workspace = createFileWorkspace({ root: workspaceRoot });
  return workspace.listJobs();
}

async function buildWorkbenchRunsView(workspaceRoot: string) {
  const history = await readRuns(workspaceRoot);
  const jobs = await readJobs(workspaceRoot);
  return buildRunsView({
    records: history.records,
    unreadable: history.unreadable,
    jobs: jobs.records,
    unreadableJobs: jobs.unreadable,
  });
}

const MEASUREMENT_QUERY_FIELDS: readonly {
  readonly id: MeasureId;
  readonly min: string;
  readonly max: string;
}[] = [
  {
    id: 'runPassRate',
    min: 'runPassRate.min',
    max: 'runPassRate.max',
  },
  {
    id: 'stepPassRate',
    min: 'stepPassRate.min',
    max: 'stepPassRate.max',
  },
  {
    id: 'replayMatchRate',
    min: 'replayMatchRate.min',
    max: 'replayMatchRate.max',
  },
];

interface MeasurementRouteFailure {
  readonly ok: false;
  readonly status: 400 | 404 | 409;
  readonly message: string;
}

type MeasurementRouteResult =
  | { readonly ok: true; readonly view: MeasurementView }
  | MeasurementRouteFailure;

const FIXTURE_PROPOSAL_FIELDS: readonly (keyof FixtureChangeProposal)[] = [
  'proposalId',
  'fixturePath',
  'expectedDigest',
  'proposedDigest',
  'runId',
  'executionId',
];

interface FixtureReviewRouteFailure {
  readonly ok: false;
  readonly status: 400 | 404 | 409;
  readonly message: string;
}

type FixtureReviewRouteResult =
  | {
      readonly ok: true;
      readonly view: FixtureReviewView;
      readonly proposal: FixtureChangeProposal | null;
      readonly alreadyDecided: boolean;
    }
  | FixtureReviewRouteFailure;

function proposalFromApproval(
  approval: FixtureApprovalRecord,
): FixtureChangeProposal {
  return {
    proposalId: approval.proposalId,
    fixturePath: approval.fixturePath,
    expectedDigest: approval.expectedDigest,
    proposedDigest: approval.proposedDigest,
    runId: approval.runId,
    executionId: approval.executionId,
  };
}

function sameProposal(
  left: FixtureChangeProposal,
  right: FixtureChangeProposal,
): boolean {
  return FIXTURE_PROPOSAL_FIELDS.every((field) => left[field] === right[field]);
}

function fixtureProposal(
  search: URLSearchParams,
): FixtureChangeProposal | null | FixtureReviewRouteFailure {
  const values = Object.fromEntries(
    FIXTURE_PROPOSAL_FIELDS.map((field) => [
      field,
      search.get(field)?.trim() ?? '',
    ]),
  ) as Record<keyof FixtureChangeProposal, string>;
  const supplied = FIXTURE_PROPOSAL_FIELDS.filter(
    (field) => values[field].length > 0,
  );
  if (supplied.length === 0) {
    return null;
  }
  if (supplied.length !== FIXTURE_PROPOSAL_FIELDS.length) {
    const missing = FIXTURE_PROPOSAL_FIELDS.filter(
      (field) => values[field].length === 0,
    );
    return {
      ok: false,
      status: 400,
      message: `A fixture proposal requires every field; missing: ${missing.join(', ')}.`,
    };
  }

  const proposal: FixtureChangeProposal = values;
  if (!isSafeRunId(proposal.proposalId)) {
    return {
      ok: false,
      status: 400,
      message: 'The proposal identifier must be a safe file name.',
    };
  }
  if (!isSafeRunId(proposal.runId)) {
    return {
      ok: false,
      status: 400,
      message: 'The run identifier must be a safe file name.',
    };
  }
  if (resolveReference(proposal.fixturePath).status === 'refused') {
    return {
      ok: false,
      status: 400,
      message: 'The fixture path must stay below the scenario root.',
    };
  }
  if (proposal.expectedDigest === proposal.proposedDigest) {
    return {
      ok: false,
      status: 400,
      message:
        'The proposed digest equals the pinned digest; there is nothing to decide.',
    };
  }
  return proposal;
}

function fixtureProposalQuery(proposal: FixtureChangeProposal): string {
  return new URLSearchParams(
    Object.fromEntries(
      FIXTURE_PROPOSAL_FIELDS.map((field) => [field, proposal[field]]),
    ),
  ).toString();
}

function measurementRate(
  search: URLSearchParams,
  name: string,
): number | undefined | MeasurementRouteFailure {
  const source = search.get(name);
  if (source === null || source.trim().length === 0) {
    return undefined;
  }
  const value = Number(source);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    return {
      ok: false,
      status: 400,
      message: `${name} must be a finite rate between 0 and 1.`,
    };
  }
  return value;
}

function measurementThresholds(
  search: URLSearchParams,
): MeasurementThresholds | MeasurementRouteFailure {
  const thresholds: Partial<
    Record<MeasureId, { readonly min?: number; readonly max?: number }>
  > = {};
  for (const field of MEASUREMENT_QUERY_FIELDS) {
    const min = measurementRate(search, field.min);
    if (typeof min === 'object') {
      return min;
    }
    const max = measurementRate(search, field.max);
    if (typeof max === 'object') {
      return max;
    }
    if (min !== undefined && max !== undefined && min > max) {
      return {
        ok: false,
        status: 400,
        message: `${field.id} minimum cannot exceed its maximum.`,
      };
    }
    if (min !== undefined || max !== undefined) {
      thresholds[field.id] = {
        ...(min === undefined ? {} : { min }),
        ...(max === undefined ? {} : { max }),
      };
    }
  }
  return thresholds;
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
      'The form token is missing or no longer valid. Reload the page and try again.',
    );
  }
  const fetchSite = request.headers['sec-fetch-site'];

  if (fetchSite === 'cross-site') {
    throw new WorkbenchFormRefused(403, 'Cross-site form submission refused.');
  }
  const origin = request.headers.origin;
  if (origin === undefined) {
    return;
  }
  if (origin === 'null' && fetchSite === 'same-origin') {
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
      'Workbench forms accept application/x-www-form-urlencoded submissions only.',
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
        `The submitted form exceeds the ${String(MAX_FORM_BYTES)} byte limit.`,
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

function emptyLiveForm(): LiveEvaluationFormValues {
  return {
    runId: '',
    requestSource: '',
    optIn: false,
    provider: 'openai',
    model: '',
    caseCount: '1',
    maxModelCalls: '1',
    costCeilingMinor: '',
    currency: '',
    confirmer: '',
    rationale: '',
  };
}

function liveFormValues(form: URLSearchParams): LiveEvaluationFormValues {
  return {
    runId: form.get('runId') ?? '',
    requestSource: form.get('requestSource') ?? '',
    optIn: form.get('optIn') === 'true',
    provider: 'openai',
    model: form.get('model') ?? '',
    caseCount: form.get('caseCount') ?? '1',
    maxModelCalls: form.get('maxModelCalls') ?? '',
    costCeilingMinor: form.get('costCeilingMinor') ?? '',
    currency: form.get('currency') ?? '',
    confirmer: form.get('confirmer') ?? '',
    rationale: form.get('rationale') ?? '',
  };
}

function liveNumber(
  source: string,
  name: string,
  optional = false,
): number | null {
  if (source.trim().length === 0 && optional) {
    return null;
  }
  const value = Number(source);
  if (!Number.isFinite(value)) {
    throw new WorkbenchFormRefused(400, `${name} must be a finite number.`);
  }
  return value;
}

function liveConfirmationFromForm(values: LiveEvaluationFormValues): unknown {
  return {
    version: LIVE_CONFIRMATION_VERSION,
    optIn: values.optIn,
    provider: values.provider,
    model: values.model,
    caseCount: liveNumber(values.caseCount, 'caseCount'),
    maxModelCalls: liveNumber(values.maxModelCalls, 'maxModelCalls'),
    costCeilingMinor: liveNumber(
      values.costCeilingMinor,
      'costCeilingMinor',
      true,
    ),
    currency: values.currency.trim().length === 0 ? null : values.currency,
    confirmer: values.confirmer,
    rationale: values.rationale,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const EXECUTION_REQUEST_FIELDS = new Set([
  'requestKey',
  'namespace',
  'task',
  'entityId',
  'expectedRevision',
  'input',
  'model',
  'policy',
]);

/**
 * Adapt untrusted form data into the public request shape. The engine remains
 * the authoritative runtime validator for model, policy, task input and
 * domain semantics.
 */
function executionRequestFromSource(source: string): ExecutionRequest {
  let raw: unknown;
  try {
    raw = parseYaml(source) as unknown;
  } catch (error: unknown) {
    throw new WorkbenchFormRefused(
      400,
      error instanceof Error
        ? error.message
        : 'The execution request could not be parsed.',
    );
  }
  if (!isObject(raw)) {
    throw new WorkbenchFormRefused(400, 'ExecutionRequest must be an object.');
  }
  const unexpected = Object.keys(raw).filter(
    (field) => !EXECUTION_REQUEST_FIELDS.has(field),
  );
  const required = [
    'requestKey',
    'namespace',
    'task',
    'entityId',
    'expectedRevision',
    'input',
    'model',
  ] as const;
  const missing = required.filter((field) => !Object.hasOwn(raw, field));
  if (unexpected.length > 0 || missing.length > 0) {
    throw new WorkbenchFormRefused(
      400,
      `ExecutionRequest has an invalid shape (missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'}).`,
    );
  }
  return raw as unknown as ExecutionRequest;
}

function isFileExistsError(error: unknown): boolean {
  return (
    isObject(error) &&
    'code' in error &&
    (error as { readonly code?: unknown }).code === 'EEXIST'
  );
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
  const activeApprovalIds = new Set<string>();
  const processLiveOptIn =
    options.liveOptIn ?? isLiveOptInEnv(process.env['ACME_TEST_UI_LIVE']);
  const workspace = createFileWorkspace({ root: workspaceRoot });
  const jobRunner = createJobRunner({
    workspace,
    clock: options.clock,
  });
  await jobRunner.recoverInterrupted();
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
      ...(options.payloadEncryptor === undefined
        ? {}
        : { payloadEncryptor: options.payloadEncryptor }),
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

  async function replayView(executionId: string) {
    if (composition === undefined) {
      throw new Error('Replay requires a configured composition.');
    }
    const evidence =
      (await composition.repository.loadReplayEvidence(executionId)) ?? null;
    const report = await composition
      .engine(REPLAY_GATEWAY_GUARD)
      .replayVerify(executionId);
    return buildReplayView({
      executionId,
      report,
      recordedOperationDigest: evidence?.preparedCommit.operationDigest ?? null,
    });
  }

  async function measurementView(url: URL): Promise<MeasurementRouteResult> {
    const thresholds = measurementThresholds(url.searchParams);
    if ('ok' in thresholds) {
      return thresholds;
    }
    const workspace = createFileWorkspace({ root: workspaceRoot });
    const history = await workspace.listRuns();
    if (history.unreadable.length > 0) {
      return {
        ok: false,
        status: 409,
        message: `Measurement refused because unreadable run records would shrink the evidence set: ${history.unreadable.join(', ')}.`,
      };
    }

    const requestedBaseline = url.searchParams.get('baseline')?.trim() ?? '';
    if (requestedBaseline.length > 0 && !isSafeRunId(requestedBaseline)) {
      return {
        ok: false,
        status: 400,
        message: 'The baseline name must be a safe file name.',
      };
    }
    const baseline =
      requestedBaseline.length === 0
        ? null
        : await workspace.loadBaseline(requestedBaseline);
    if (requestedBaseline.length > 0 && baseline === null) {
      return {
        ok: false,
        status: 404,
        message: `Baseline ${JSON.stringify(requestedBaseline)} was not found or is unreadable.`,
      };
    }

    return {
      ok: true,
      view: buildMeasurementView({
        records: history.records,
        thresholds,
        baseline,
      }),
    };
  }

  async function fixtureReviewView(
    search: URLSearchParams,
  ): Promise<FixtureReviewRouteResult> {
    const staged = fixtureProposal(search);
    if (staged !== null && 'ok' in staged) {
      return staged;
    }

    const workspace = createFileWorkspace({ root: workspaceRoot });
    const approvals = await workspace.listApprovals();
    const proposals = approvals.records.map(proposalFromApproval);
    let alreadyDecided = false;

    if (staged !== null) {
      const unreadableName = `${staged.proposalId}.json`;
      if (approvals.unreadable.includes(unreadableName)) {
        return {
          ok: false,
          status: 409,
          message: `Approval ${JSON.stringify(unreadableName)} exists but is unreadable; it cannot be replaced.`,
        };
      }
      const run = await workspace.loadRun(staged.runId);
      if (run === null) {
        return {
          ok: false,
          status: 404,
          message: `Run ${JSON.stringify(staged.runId)} was not found or is unreadable.`,
        };
      }
      if (
        !run.cases.some((entry) => entry.executionId === staged.executionId)
      ) {
        return {
          ok: false,
          status: 409,
          message: `Execution ${JSON.stringify(staged.executionId)} is not linked to run ${JSON.stringify(staged.runId)}.`,
        };
      }

      const existing = approvals.records.find(
        (entry) => entry.proposalId === staged.proposalId,
      );
      if (existing === undefined) {
        proposals.push(staged);
      } else if (!sameProposal(proposalFromApproval(existing), staged)) {
        return {
          ok: false,
          status: 409,
          message: `Proposal ${JSON.stringify(staged.proposalId)} conflicts with its recorded decision.`,
        };
      } else {
        alreadyDecided = true;
      }
    }

    return {
      ok: true,
      view: buildFixtureReviewView({
        proposals,
        approvals: approvals.records,
        unreadable: approvals.unreadable,
      }),
      proposal: staged,
      alreadyDecided,
    };
  }

  async function liveEvaluationView(
    confirmation?: LiveEvaluationConfirmation | null,
  ): Promise<LiveEvaluationView> {
    const history = await readRuns(workspaceRoot);
    return buildLiveEvaluationView({
      records: history.records,
      unreadable: history.unreadable,
      ...(confirmation === undefined ? {} : { confirmation }),
    });
  }

  async function sendLivePage(
    response: ServerResponse,
    status: number,
    form: LiveEvaluationFormValues,
    notice?: { readonly level: 'info' | 'error'; readonly message: string },
    confirmation?: LiveEvaluationConfirmation,
  ): Promise<void> {
    send(
      response,
      status,
      renderLiveEvaluationViewHtml(await liveEvaluationView(confirmation), {
        csrfToken,
        form,
        processOptIn: processLiveOptIn,
        ...(notice === undefined ? {} : { notice }),
      }),
      'text/html; charset=utf-8',
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
            state: STATE_VIEW_VERSION,
            replay: REPLAY_VIEW_VERSION,
            measurement: MEASUREMENT_VIEW_VERSION,
            fixtureReview: FIXTURE_REVIEW_VIEW_VERSION,
            liveEvaluation: LIVE_EVALUATION_VIEW_VERSION,
          },
        });
        return;
      }

      if (request.method === 'GET' && path === '/api/catalog') {
        sendJson(response, 200, await catalogView());
        return;
      }

      if (request.method === 'GET' && path === '/api/runs') {
        sendJson(response, 200, await buildWorkbenchRunsView(workspaceRoot));
        return;
      }

      if (
        request.method === 'POST' &&
        path.startsWith('/api/jobs/') &&
        path.endsWith('/cancel')
      ) {
        const jobId = decodeURIComponent(
          path.slice('/api/jobs/'.length, path.length - '/cancel'.length),
        );
        if (!isSafeRunId(jobId)) {
          sendJson(response, 400, { error: 'Invalid job id.' });
          return;
        }
        const form = await readForm(request);
        const submittedToken = requiredFormField(form, 'csrfToken');
        assertSameServerRequest(request, csrfToken, submittedToken, boundPort);
        try {
          const result = await jobRunner.cancel(jobId);
          sendJson(response, 200, result);
        } catch (error: unknown) {
          sendJson(response, 404, {
            error:
              error instanceof Error ? error.message : 'Cancel failed.',
          });
        }
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

      if (request.method === 'GET' && path === '/api/state') {
        const namespace = url.searchParams.get('namespace');
        const entityId = url.searchParams.get('entityId');
        if (
          namespace === null ||
          namespace.length === 0 ||
          entityId === null ||
          entityId.length === 0
        ) {
          sendJson(response, 400, {
            error: 'namespace and entityId are required.',
            view: STATE_VIEW_VERSION,
          });
          return;
        }
        if (composition === undefined) {
          sendJson(response, 409, {
            error: 'S6 requires a configured durable ledger.',
            view: STATE_VIEW_VERSION,
          });
          return;
        }
        const evidence = composition.repository.snapshot();
        sendJson(
          response,
          200,
          buildStateView({
            namespace,
            entityId,
            snapshots: evidence.state.snapshots,
            transitions: evidence.state.transitions,
          }),
        );
        return;
      }

      if (request.method === 'GET' && path === '/api/replay') {
        const executionId = url.searchParams.get('executionId');
        if (executionId === null || executionId.length === 0) {
          sendJson(response, 400, {
            error: 'executionId is required.',
            view: REPLAY_VIEW_VERSION,
          });
          return;
        }
        if (composition === undefined) {
          sendJson(response, 409, {
            error: 'S7 requires a configured durable ledger.',
            view: REPLAY_VIEW_VERSION,
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
            view: REPLAY_VIEW_VERSION,
          });
          return;
        }
        sendJson(response, 200, await replayView(executionId));
        return;
      }

      if (request.method === 'GET' && path === '/api/measurement') {
        const result = await measurementView(url);
        if (!result.ok) {
          sendJson(response, result.status, {
            error: result.message,
            view: MEASUREMENT_VIEW_VERSION,
          });
          return;
        }
        sendJson(response, 200, result.view);
        return;
      }

      if (request.method === 'GET' && path === '/api/fixture-review') {
        const result = await fixtureReviewView(url.searchParams);
        if (!result.ok) {
          sendJson(response, result.status, {
            error: result.message,
            view: FIXTURE_REVIEW_VIEW_VERSION,
          });
          return;
        }
        sendJson(response, 200, result.view);
        return;
      }

      if (request.method === 'GET' && path === '/api/live-evaluation') {
        sendJson(response, 200, await liveEvaluationView());
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
        if (
          activeRunIds.has(runId) ||
          (await workspace.loadRun(runId)) !== null ||
          (await workspace.loadJob(runId)) !== null
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

        // Async accept (ADR-0027): return as soon as the job is queued.
        try {
          await jobRunner.enqueue({
            plan: parsed.raw,
            scenarioRoot,
            workspace,
            runId,
            clock: options.clock,
            ...(ledgerDatabase === undefined
              ? {}
              : { database: ledgerDatabase }),
            ...(options.payloadEncryptor === undefined
              ? {}
              : { payloadEncryptor: options.payloadEncryptor }),
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
        }
        response.writeHead(303, {
          location: `/s3/${encodeURIComponent(runId)}`,
          'cache-control': 'no-store',
        });
        response.end();
        return;
      }

      if (
        request.method === 'POST' &&
        path.startsWith('/s3/') &&
        path.endsWith('/cancel')
      ) {
        const runId = decodeURIComponent(
          path.slice('/s3/'.length, path.length - '/cancel'.length),
        );
        const form = await readForm(request);
        const submittedToken = requiredFormField(form, 'csrfToken');
        assertSameServerRequest(request, csrfToken, submittedToken, boundPort);
        try {
          await jobRunner.cancel(runId);
        } catch (error: unknown) {
          send(
            response,
            404,
            error instanceof Error ? error.message : 'Cancel failed.',
            'text/plain; charset=utf-8',
          );
          return;
        }
        response.writeHead(303, {
          location: `/s3/${encodeURIComponent(runId)}`,
          'cache-control': 'no-store',
        });
        response.end();
        return;
      }

      if (request.method === 'GET' && path === '/s3') {
        const view = await buildWorkbenchRunsView(workspaceRoot);
        send(
          response,
          200,
          renderRunsViewHtml(view, { csrfToken }),
          'text/html; charset=utf-8',
        );
        return;
      }

      if (request.method === 'GET' && path.startsWith('/s3/')) {
        const runId = decodeURIComponent(path.slice('/s3/'.length));
        const history = await readRuns(workspaceRoot);
        const jobs = await readJobs(workspaceRoot);
        const record = history.records.find((entry) => entry.runId === runId);
        const job = jobs.records.find((entry) => entry.runId === runId);
        if (record === undefined && job === undefined) {
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
        if (record === undefined && job !== undefined) {
          const view = buildRunsView({
            records: history.records,
            unreadable: history.unreadable,
            jobs: jobs.records,
            unreadableJobs: jobs.unreadable,
          });
          send(
            response,
            200,
            renderRunsViewHtml(view, {
              csrfToken,
              focusJobId: runId,
              refreshSeconds: 2,
            }),
            'text/html; charset=utf-8',
          );
          return;
        }
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

      if (request.method === 'GET' && path === '/s6') {
        const namespace = url.searchParams.get('namespace');
        const entityId = url.searchParams.get('entityId');
        if (
          namespace === null ||
          namespace.length === 0 ||
          entityId === null ||
          entityId.length === 0
        ) {
          send(
            response,
            200,
            renderShell({
              surface: 's6',
              title: 'S6 State inspector',
              subtitle: `View ${STATE_VIEW_VERSION}`,
              body: '<section class="card"><p>Choose an execution in S4, then follow <strong>Inspect state lineage</strong>.</p></section>',
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
              surface: 's6',
              title: 'S6 needs a ledger path',
              subtitle: `View ${STATE_VIEW_VERSION}`,
              body: '<section class="card"><p>Start the workbench with <code>--ledger &lt;sqlite-file&gt;</code> to inspect durable state evidence.</p></section>',
            }),
            'text/html; charset=utf-8',
          );
          return;
        }
        const evidence = composition.repository.snapshot();
        const view = buildStateView({
          namespace,
          entityId,
          snapshots: evidence.state.snapshots,
          transitions: evidence.state.transitions,
        });
        send(
          response,
          200,
          renderStateViewHtml(view),
          'text/html; charset=utf-8',
        );
        return;
      }

      if (request.method === 'GET' && path === '/s7') {
        const executionId = url.searchParams.get('executionId');
        if (executionId === null || executionId.length === 0) {
          send(
            response,
            200,
            renderShell({
              surface: 's7',
              title: 'S7 Replay inspector',
              subtitle: `View ${REPLAY_VIEW_VERSION}`,
              body: '<section class="card"><p>Choose an execution in S4, then follow <strong>Verify replay</strong>.</p></section>',
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
              surface: 's7',
              title: 'S7 needs a ledger path',
              subtitle: `View ${REPLAY_VIEW_VERSION}`,
              body: '<section class="card"><p>Start the workbench with <code>--ledger &lt;sqlite-file&gt;</code> to verify durable replay evidence.</p></section>',
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
              surface: 's7',
              title: 'Execution not found',
              subtitle: `View ${REPLAY_VIEW_VERSION}`,
              body: `<section class="card"><p>No durable execution matched <code>${escapeHtml(executionId)}</code>.</p></section>`,
            }),
            'text/html; charset=utf-8',
          );
          return;
        }
        send(
          response,
          200,
          renderReplayViewHtml(await replayView(executionId)),
          'text/html; charset=utf-8',
        );
        return;
      }

      if (request.method === 'GET' && path === '/s8') {
        const result = await measurementView(url);
        if (!result.ok) {
          send(
            response,
            result.status,
            renderShell({
              surface: 's8',
              title: 'S8 Measurement refused',
              subtitle: `View ${MEASUREMENT_VIEW_VERSION}`,
              body: `<section class="card error-banner"><p>${escapeHtml(result.message)}</p><p><a href="/s8">Return to an unconfigured measurement</a></p></section>`,
            }),
            'text/html; charset=utf-8',
          );
          return;
        }
        send(
          response,
          200,
          renderMeasurementViewHtml(result.view),
          'text/html; charset=utf-8',
        );
        return;
      }

      if (request.method === 'GET' && path === '/s9') {
        const result = await fixtureReviewView(url.searchParams);
        if (!result.ok) {
          send(
            response,
            result.status,
            renderShell({
              surface: 's9',
              title: 'S9 Fixture review refused',
              subtitle: `View ${FIXTURE_REVIEW_VIEW_VERSION}`,
              body: `<section class="card error-banner"><p>${escapeHtml(result.message)}</p><p><a href="/s9">Return to fixture review</a></p></section>`,
            }),
            'text/html; charset=utf-8',
          );
          return;
        }
        send(
          response,
          200,
          renderFixtureReviewViewHtml(result.view, {
            csrfToken,
            proposal: result.proposal,
          }),
          'text/html; charset=utf-8',
        );
        return;
      }

      if (request.method === 'POST' && path === '/s9/decision') {
        const form = await readForm(request);
        const submittedToken = requiredFormField(form, 'csrfToken');
        assertSameServerRequest(request, csrfToken, submittedToken, boundPort);
        const reviewed = await fixtureReviewView(form);
        if (!reviewed.ok) {
          send(
            response,
            reviewed.status,
            renderShell({
              surface: 's9',
              title: 'S9 Decision refused',
              subtitle: `View ${FIXTURE_REVIEW_VIEW_VERSION}`,
              body: `<section class="card error-banner"><p>${escapeHtml(reviewed.message)}</p><p><a href="/s9">Return to fixture review</a></p></section>`,
            }),
            'text/html; charset=utf-8',
          );
          return;
        }
        const proposal = reviewed.proposal;
        if (proposal === null) {
          throw new WorkbenchFormRefused(
            400,
            'A fixture proposal is required.',
          );
        }
        if (reviewed.alreadyDecided) {
          throw new WorkbenchFormRefused(
            409,
            `Proposal ${JSON.stringify(proposal.proposalId)} already has a recorded decision.`,
          );
        }
        if (activeApprovalIds.has(proposal.proposalId)) {
          throw new WorkbenchFormRefused(
            409,
            `Proposal ${JSON.stringify(proposal.proposalId)} already has a decision in progress.`,
          );
        }
        const decision = requiredFormField(form, 'decision');
        if (decision !== 'approved' && decision !== 'rejected') {
          throw new WorkbenchFormRefused(
            400,
            'decision must be approved or rejected.',
          );
        }
        const approver = requiredFormField(form, 'approver');
        const rationale = requiredFormField(form, 'rationale');

        activeApprovalIds.add(proposal.proposalId);
        try {
          const refreshed = await fixtureReviewView(form);
          if (!refreshed.ok || refreshed.alreadyDecided) {
            throw new WorkbenchFormRefused(
              409,
              `Proposal ${JSON.stringify(proposal.proposalId)} can no longer be decided.`,
            );
          }
          const approval = decideFixtureChange({
            proposal,
            decision,
            approver,
            rationale,
            decidedAt: options.clock.now(),
          });
          await createFileWorkspace({ root: workspaceRoot }).recordApproval(
            approval,
          );
        } catch (error: unknown) {
          if (error instanceof ApprovalRefused) {
            throw new WorkbenchFormRefused(400, error.message);
          }
          throw error;
        } finally {
          activeApprovalIds.delete(proposal.proposalId);
        }

        response.writeHead(303, {
          location: `/s9?${fixtureProposalQuery(proposal)}`,
          'cache-control': 'no-store',
        });
        response.end();
        return;
      }

      if (request.method === 'GET' && path === '/s10') {
        const launched = url.searchParams.get('launched');
        await sendLivePage(response, 200, emptyLiveForm(), {
          level: 'info',
          message:
            launched === null || launched.length === 0
              ? 'Live launch requires both the process gate and the per-run confirmation below.'
              : `Live run ${JSON.stringify(launched)} was recorded.`,
        });
        return;
      }

      if (request.method === 'POST' && path === '/s10/launch') {
        const submitted = await readForm(request);
        const submittedToken = requiredFormField(submitted, 'csrfToken');
        assertSameServerRequest(request, csrfToken, submittedToken, boundPort);
        const form = liveFormValues(submitted);

        try {
          const runId = requiredFormField(submitted, 'runId');
          const requestSource = requiredFormField(submitted, 'requestSource');
          if (requiredFormField(submitted, 'provider') !== 'openai') {
            throw new WorkbenchFormRefused(
              400,
              'Live evaluation v1 supports only provider "openai".',
            );
          }
          if (!isSafeRunId(runId)) {
            throw new WorkbenchFormRefused(
              400,
              'The run identifier must be a safe file name.',
            );
          }
          const workspace = createFileWorkspace({ root: workspaceRoot });
          const history = await workspace.listRuns();
          if (
            activeRunIds.has(runId) ||
            history.records.some((entry) => entry.runId === runId) ||
            history.unreadable.includes(`${runId}.json`)
          ) {
            throw new WorkbenchFormRefused(
              409,
              `Run ${JSON.stringify(runId)} already exists or is in progress; history is never overwritten.`,
            );
          }

          const confirmation = liveConfirmationFromForm(form);
          const executionRequest = executionRequestFromSource(requestSource);
          let launched:
            Awaited<ReturnType<typeof launchLiveExecution>> | undefined;
          activeRunIds.add(runId);
          try {
            launched = await launchLiveExecution({
              confirmation,
              request: executionRequest,
              workspace,
              runId,
              clock: options.clock,
              ids: options.ids,
              repository: ledgerDatabase === undefined ? 'memory' : 'sqlite',
              ...(ledgerDatabase === undefined
                ? {}
                : { database: ledgerDatabase }),
              ...(options.payloadEncryptor === undefined
                ? {}
                : { payloadEncryptor: options.payloadEncryptor }),
              ...(options.liveOptIn === undefined
                ? {}
                : { liveOptIn: options.liveOptIn }),
              ...(options.liveOpenAiTransport === undefined
                ? {}
                : { openAiTransport: options.liveOpenAiTransport }),
              ...(options.liveApiKey === undefined
                ? {}
                : { apiKey: options.liveApiKey }),
            });
          } finally {
            activeRunIds.delete(runId);
            launched?.composition.close();
          }

          response.writeHead(303, {
            location: `/s10?launched=${encodeURIComponent(runId)}`,
            'cache-control': 'no-store',
          });
          response.end();
          return;
        } catch (error: unknown) {
          const status =
            error instanceof WorkbenchFormRefused
              ? error.status
              : error instanceof LiveGateRefused &&
                  error.reason === LIVE_GATE_REFUSAL.envOptIn
                ? 403
                : error instanceof LiveGateRefused &&
                    error.reason === LIVE_GATE_REFUSAL.apiKey
                  ? 409
                  : isFileExistsError(error)
                    ? 409
                    : 400;
          await sendLivePage(response, status, form, {
            level: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'The live execution could not be launched.',
          });
          return;
        }
      }

      if (request.method === 'GET' && path === '/s10/launch') {
        send(response, 405, 'Method not allowed', 'text/plain; charset=utf-8');
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
