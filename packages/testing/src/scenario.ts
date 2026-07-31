import {
  AcmeError,
  computeModelRequestHash,
  deriveExecutionId,
  type ExecutionEngine,
  type ExecutionRepository,
  type ExecutionRequest,
  type GatewayCallContext,
  type IdGenerator,
  type JsonValue,
  type ModelCapabilities,
  type ModelGateway,
  type ModelRequest,
  type ModelSelection,
  type NormalizedModelResponse,
} from '@acme/core';

export const SCENARIO_SCHEMA_VERSION = 'acme-scenario/1' as const;
export const SCENARIO_REPORT_VERSION = 'acme-scenario-report/1' as const;

/**
 * A scenario sequences executions against the bounded ExecutionEngine. It is a
 * caller of the engine, never an extension of it: there is no branching, no
 * retry, no loop and no way to run arbitrary code.
 */
export interface ScenarioDocument {
  readonly schemaVersion: typeof SCENARIO_SCHEMA_VERSION;
  readonly name: string;
  readonly seed: ScenarioSeed;
  readonly composition: {
    readonly repository: 'memory' | 'sqlite';
    readonly gateway: 'mock';
  };
  readonly steps: readonly ScenarioStep[];
}

/**
 * Fixes everything a run would otherwise take from the environment.
 *
 * A scenario that pins an operation digest must also pin its ID scheme,
 * because memory record IDs are part of the digest preimage. Specification
 * 18.1 names `ids: sequential` without defining what it emits, so the shape is
 * defined here: `<kind>-<prefix>-<n>` when a prefix is given and `<kind>-<n>`
 * otherwise, with `idPadding` zero-padding the counter.
 */
export interface ScenarioSeed {
  readonly clock: string;
  readonly ids: 'sequential';
  readonly idPrefix?: string;
  readonly idPadding?: number;
}

export interface ExecuteStep {
  readonly as: string;
  readonly requestKey: string;
  readonly namespace: string;
  readonly task: string;
  readonly entityId: string;
  readonly expectedRevision: number;
  readonly fixture: string;
  readonly mockResponse: string;
  readonly policy?: JsonValue;
  /**
   * Pinning makes the model mock assert the exact request. Leaving it out
   * records the observed hash and marks the call unpinned instead; the runner
   * never computes a hash and then asserts it against itself.
   */
  readonly expectedRequestHash?: string;
}

export interface AssertStep {
  readonly execution: string;
  readonly status: string;
  readonly revision?: number;
  readonly documentKeys?: readonly string[];
}

export interface ReplayStep {
  readonly execution: string;
  readonly mode: 'verify';
  readonly expect?: 'match' | 'different' | 'unavailable';
}

export interface AssertDigestStep {
  readonly execution: string;
  readonly operationDigest?: string;
  readonly fixture?: string;
}

export type ScenarioStep =
  | { readonly execute: ExecuteStep }
  | { readonly assert: AssertStep }
  | { readonly replay: ReplayStep }
  | { readonly assertDigest: AssertDigestStep };

export interface ScenarioStepReport {
  readonly index: number;
  readonly kind: string;
  readonly status: 'passed' | 'failed' | 'skipped';
  readonly detail: JsonValue;
}

export interface ScenarioReport {
  readonly version: typeof SCENARIO_REPORT_VERSION;
  readonly name: string;
  readonly status: 'passed' | 'failed';
  readonly steps: readonly ScenarioStepReport[];
  readonly failure?: { readonly stepIndex: number; readonly message: string };
}

/** The deterministic generator `seed.ids: sequential` describes. */
export function seededIdGenerator(seed: ScenarioSeed): IdGenerator {
  const counts: Record<string, number> = {};
  const padding = seed.idPadding ?? 1;
  return {
    next(kind) {
      counts[kind] = (counts[kind] ?? 0) + 1;
      const ordinal = String(counts[kind]).padStart(padding, '0');
      return seed.idPrefix === undefined
        ? `${kind}-${ordinal}`
        : `${kind}-${seed.idPrefix}-${ordinal}`;
    },
  };
}

/** Supplied by the caller so the runner never reads a file itself. */
export type ScenarioFixtureLoader = (path: string) => Promise<JsonValue>;

/**
 * Supplied by the caller so the runner never imports a concrete adapter and
 * `@acme/testing` keeps depending on `@acme/core` alone.
 */
export interface ScenarioComposition {
  readonly repository: ExecutionRepository;
  engine(gateway: ModelGateway): ExecutionEngine;
}

export interface ScenarioRunOptions {
  readonly document: unknown;
  /**
   * Built from the parsed seed, so the clock and ID allocation a scenario
   * declares are the ones the run actually uses.
   */
  readonly composition: (seed: ScenarioSeed) => ScenarioComposition;
  readonly loadFixture: ScenarioFixtureLoader;
}

class ScenarioError extends AcmeError {}

function invalid(message: string, details?: JsonValue): never {
  throw new ScenarioError({
    code: 'INVALID_REQUEST',
    message,
    stage: 'accepted',
    retryable: false,
    ...(details === undefined ? {} : { details }),
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    invalid(`${field} must be a non-empty string.`);
  }
  return value;
}

function revision(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    invalid(`${field} must be a non-negative integer.`);
  }
  return value;
}

function parseExecute(raw: unknown): ExecuteStep {
  if (!isObject(raw)) {
    invalid('An execute step must be an object.');
  }
  const hash = raw['expectedRequestHash'];
  if (hash !== undefined && !/^[a-f0-9]{64}$/u.test(String(hash))) {
    invalid('expectedRequestHash must be a lowercase SHA-256 digest.');
  }
  return {
    as: text(raw['as'], 'execute.as'),
    requestKey: text(raw['requestKey'], 'execute.requestKey'),
    namespace: text(raw['namespace'], 'execute.namespace'),
    task: text(raw['task'], 'execute.task'),
    entityId: text(raw['entityId'], 'execute.entityId'),
    expectedRevision: revision(
      raw['expectedRevision'],
      'execute.expectedRevision',
    ),
    fixture: text(raw['fixture'], 'execute.fixture'),
    mockResponse: text(raw['mockResponse'], 'execute.mockResponse'),
    ...(raw['policy'] === undefined
      ? {}
      : { policy: raw['policy'] as JsonValue }),
    ...(hash === undefined ? {} : { expectedRequestHash: String(hash) }),
  };
}

function parseStep(raw: unknown, index: number): ScenarioStep {
  if (!isObject(raw)) {
    invalid(`Step ${String(index)} must be an object.`);
  }
  const keys = Object.keys(raw);
  if (keys.length !== 1) {
    invalid(`Step ${String(index)} must name exactly one step kind.`, {
      keys,
    });
  }
  const kind = keys[0] as string;
  const body = raw[kind];

  switch (kind) {
    case 'execute':
      return { execute: parseExecute(body) };
    case 'assert': {
      if (!isObject(body)) {
        invalid('An assert step must be an object.');
      }
      const documentKeys = body['documentKeys'];
      if (documentKeys !== undefined && !Array.isArray(documentKeys)) {
        invalid('assert.documentKeys must be an array.');
      }
      return {
        assert: {
          execution: text(body['execution'], 'assert.execution'),
          status: text(body['status'], 'assert.status'),
          ...(body['revision'] === undefined
            ? {}
            : { revision: revision(body['revision'], 'assert.revision') }),
          ...(documentKeys === undefined
            ? {}
            : { documentKeys: documentKeys.map(String) }),
        },
      };
    }
    case 'replay': {
      if (!isObject(body)) {
        invalid('A replay step must be an object.');
      }
      if (body['mode'] !== 'verify') {
        invalid('replay.mode must be verify.');
      }
      const expect = body['expect'];
      if (
        expect !== undefined &&
        expect !== 'match' &&
        expect !== 'different' &&
        expect !== 'unavailable'
      ) {
        invalid('replay.expect must be match, different or unavailable.');
      }
      return {
        replay: {
          execution: text(body['execution'], 'replay.execution'),
          mode: 'verify',
          ...(expect === undefined
            ? {}
            : { expect: expect as Exclude<ReplayStep['expect'], undefined> }),
        },
      };
    }
    case 'assertDigest': {
      if (!isObject(body)) {
        invalid('An assertDigest step must be an object.');
      }
      const digest = body['operationDigest'];
      const fixture = body['fixture'];
      if ((digest === undefined) === (fixture === undefined)) {
        invalid(
          'assertDigest requires exactly one of operationDigest or fixture.',
        );
      }
      return {
        assertDigest: {
          execution: text(body['execution'], 'assertDigest.execution'),
          ...(digest === undefined
            ? {}
            : {
                operationDigest: text(digest, 'assertDigest.operationDigest'),
              }),
          ...(fixture === undefined
            ? {}
            : { fixture: text(fixture, 'assertDigest.fixture') }),
        },
      };
    }
    default:
      invalid(`Unknown step kind "${kind}" at step ${String(index)}.`);
  }
}

export function parseScenario(raw: unknown): ScenarioDocument {
  if (!isObject(raw)) {
    invalid('A scenario must be an object.');
  }
  if (raw['schemaVersion'] !== SCENARIO_SCHEMA_VERSION) {
    invalid(`A scenario requires schemaVersion ${SCENARIO_SCHEMA_VERSION}.`);
  }
  const seed = raw['seed'];
  if (!isObject(seed) || seed['ids'] !== 'sequential') {
    invalid('scenario.seed requires a clock and ids: sequential.');
  }
  const idPrefix = seed['idPrefix'];
  if (idPrefix !== undefined) {
    text(idPrefix, 'scenario.seed.idPrefix');
  }
  const idPadding = seed['idPadding'];
  if (idPadding !== undefined) {
    revision(idPadding, 'scenario.seed.idPadding');
  }
  const composition = raw['composition'];
  if (
    !isObject(composition) ||
    (composition['repository'] !== 'memory' &&
      composition['repository'] !== 'sqlite') ||
    composition['gateway'] !== 'mock'
  ) {
    invalid(
      'scenario.composition requires repository memory|sqlite and gateway mock.',
    );
  }
  const steps = raw['steps'];
  if (!Array.isArray(steps) || steps.length === 0) {
    invalid('A scenario requires at least one step.');
  }

  return {
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    name: text(raw['name'], 'scenario.name'),
    seed: {
      clock: text(seed['clock'], 'scenario.seed.clock'),
      ids: 'sequential',
      ...(idPrefix === undefined ? {} : { idPrefix: String(idPrefix) }),
      ...(idPadding === undefined ? {} : { idPadding: Number(idPadding) }),
    },
    composition: {
      repository: composition['repository'],
      gateway: 'mock',
    },
    steps: steps.map((step, index) => parseStep(step, index)),
  };
}

interface MockFixture {
  readonly selection: ModelSelection;
  readonly capabilities: ModelCapabilities;
  readonly response: NormalizedModelResponse;
}

function parseMockFixture(raw: JsonValue, path: string): MockFixture {
  if (!isObject(raw)) {
    invalid(`The mock fixture ${path} must be an object.`);
  }
  const selection = raw['selection'];
  const response = raw['response'];
  if (!isObject(selection) || !isObject(response)) {
    invalid(`The mock fixture ${path} requires a selection and a response.`);
  }
  const capabilities = isObject(raw['capabilities'])
    ? (raw['capabilities'] as unknown as ModelCapabilities)
    : { structuredOutput: true, tools: false, vision: false };
  return {
    selection: selection as unknown as ModelSelection,
    capabilities,
    response: response as unknown as NormalizedModelResponse,
  };
}

/**
 * Answers one scripted call and records the request hash it observed. Used
 * only when the step did not pin a hash, so the report can say the call was
 * unpinned rather than implying an assertion that never happened.
 */
function capturingGateway(fixture: MockFixture): {
  readonly gateway: ModelGateway;
  observedHash(): string | undefined;
} {
  let observed: string | undefined;
  return {
    observedHash: () => observed,
    gateway: {
      async capabilities(): Promise<ModelCapabilities> {
        return fixture.capabilities;
      },
      async generate(
        request: ModelRequest,
        context: GatewayCallContext,
      ): Promise<NormalizedModelResponse> {
        if (context.signal.aborted) {
          throw new ScenarioError({
            code: 'CANCELLED',
            message: 'The scenario call was cancelled before dispatch.',
            stage: 'calling-model',
            retryable: false,
          });
        }
        observed = computeModelRequestHash(request);
        return fixture.response;
      },
    },
  };
}

class StepFailure extends Error {}

function fail(message: string): never {
  throw new StepFailure(message);
}

export async function runScenario(
  options: ScenarioRunOptions,
): Promise<ScenarioReport> {
  const document = parseScenario(options.document);
  const composition = options.composition(document.seed);
  const aliases = new Map<string, string>();
  const steps: ScenarioStepReport[] = [];
  let failure: ScenarioReport['failure'];

  function resolve(alias: string, field: string): string {
    const executionId = aliases.get(alias);
    if (executionId === undefined) {
      fail(`${field} refers to unknown execution alias "${alias}".`);
    }
    return executionId;
  }

  for (const [index, step] of document.steps.entries()) {
    if (failure !== undefined) {
      steps.push({
        index,
        kind: Object.keys(step)[0] ?? 'unknown',
        status: 'skipped',
        detail: null,
      });
      continue;
    }

    const kind = Object.keys(step)[0] as string;
    try {
      let detail: JsonValue = null;

      if ('execute' in step) {
        const spec = step.execute;
        const input = await options.loadFixture(spec.fixture);
        const fixture = parseMockFixture(
          await options.loadFixture(spec.mockResponse),
          spec.mockResponse,
        );
        const executionId = deriveExecutionId(spec.namespace, spec.requestKey);
        const capture = capturingGateway(fixture);
        const request: ExecutionRequest = {
          requestKey: spec.requestKey,
          namespace: spec.namespace,
          task: spec.task,
          entityId: spec.entityId,
          expectedRevision: spec.expectedRevision,
          input,
          model: fixture.selection,
          ...(spec.policy === undefined
            ? {}
            : {
                policy: spec.policy as Exclude<
                  ExecutionRequest['policy'],
                  undefined
                >,
              }),
        };
        const result = await composition
          .engine(capture.gateway)
          .execute(request);
        aliases.set(spec.as, executionId);

        const observed = capture.observedHash();
        if (
          spec.expectedRequestHash !== undefined &&
          observed !== undefined &&
          observed !== spec.expectedRequestHash
        ) {
          fail(
            `Model request hash for "${spec.as}" was ${observed}, expected ${spec.expectedRequestHash}.`,
          );
        }
        detail = {
          alias: spec.as,
          executionId,
          status: result.status,
          // A non-committed outcome must say why, or the report sends the
          // reader back to the engine to find out what it already knew.
          ...(result.status === 'committed'
            ? {}
            : { error: result.error as unknown as JsonValue }),
          ...(observed === undefined ? {} : { modelRequestHash: observed }),
          hashPinned: spec.expectedRequestHash !== undefined,
        };
      } else if ('assert' in step) {
        const spec = step.assert;
        const executionId = resolve(spec.execution, 'assert.execution');
        const record = await composition.repository.get(executionId);
        if (record === null) {
          fail(`assert found no execution for alias "${spec.execution}".`);
        }
        if (record.status !== spec.status) {
          fail(
            `Execution "${spec.execution}" was ${record.status}, expected ${spec.status}.`,
          );
        }
        const result = record.result;
        if (spec.revision !== undefined) {
          const actual =
            result !== undefined && result.status === 'committed'
              ? result.revision
              : undefined;
          if (actual !== spec.revision) {
            fail(
              `Execution "${spec.execution}" reached revision ${String(actual)}, expected ${String(spec.revision)}.`,
            );
          }
        }
        if (spec.documentKeys !== undefined) {
          const actual =
            result !== undefined && result.status === 'committed'
              ? [...result.documentKeys]
              : [];
          if (actual.join('|') !== [...spec.documentKeys].join('|')) {
            fail(
              `Execution "${spec.execution}" produced documents ${actual.join(', ')}.`,
            );
          }
        }
        detail = { executionId, status: record.status };
      } else if ('replay' in step) {
        const spec = step.replay;
        const executionId = resolve(spec.execution, 'replay.execution');
        const report = await composition
          .engine({
            async capabilities() {
              throw new Error('Replay must not call a gateway.');
            },
            async generate() {
              throw new Error('Replay must not call a gateway.');
            },
          })
          .replayVerify(executionId);
        const expected = spec.expect ?? 'match';
        if (report.status !== expected) {
          fail(
            `Replay of "${spec.execution}" was ${report.status}, expected ${expected}.`,
          );
        }
        detail = {
          executionId,
          status: report.status,
          ...(report.recordedDigest === undefined
            ? {}
            : { recordedDigest: report.recordedDigest }),
        };
      } else {
        const spec = step.assertDigest;
        const executionId = resolve(spec.execution, 'assertDigest.execution');
        const evidence =
          await composition.repository.loadReplayEvidence(executionId);
        if (evidence === null) {
          fail(
            `assertDigest found no replay evidence for "${spec.execution}".`,
          );
        }
        let expected = spec.operationDigest;
        if (expected === undefined && spec.fixture !== undefined) {
          const loaded = await options.loadFixture(spec.fixture);
          if (!isObject(loaded)) {
            invalid(`The digest fixture ${spec.fixture} must be an object.`);
          }
          expected = text(
            loaded['operationDigest'],
            `${spec.fixture}.operationDigest`,
          );
        }
        const actual = evidence.preparedCommit.operationDigest;
        if (actual !== expected) {
          fail(
            `Operation digest for "${spec.execution}" was ${actual}, expected ${String(expected)}.`,
          );
        }
        detail = { executionId, operationDigest: actual };
      }

      steps.push({ index, kind, status: 'passed', detail });
    } catch (error: unknown) {
      const message =
        error instanceof StepFailure
          ? error.message
          : error instanceof AcmeError
            ? `${error.data.code}: ${error.data.message}`
            : error instanceof Error
              ? error.message
              : 'Unexpected scenario failure.';
      steps.push({ index, kind, status: 'failed', detail: { message } });
      failure = { stepIndex: index, message };
    }
  }

  return {
    version: SCENARIO_REPORT_VERSION,
    name: document.name,
    status: failure === undefined ? 'passed' : 'failed',
    steps,
    ...(failure === undefined ? {} : { failure }),
  };
}
