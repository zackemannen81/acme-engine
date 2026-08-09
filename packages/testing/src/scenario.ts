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
import {
  createQualityEvaluationInput,
  recordedExternalEvaluator,
  type QualityEvaluationHarness,
  type QualityEvaluationRecord,
  type QualityEvaluatorRef,
  type QualityVerdict,
} from '@acme/evaluation';

export const SCENARIO_SCHEMA_VERSION = 'acme-scenario/1' as const;
export const SCENARIO_SCHEMA_VERSION_V2 = 'acme-scenario/2' as const;
export const SCENARIO_REPORT_VERSION = 'acme-scenario-report/1' as const;
export type ScenarioSchemaVersion =
  typeof SCENARIO_SCHEMA_VERSION | typeof SCENARIO_SCHEMA_VERSION_V2;

/**
 * A scenario sequences executions against the bounded ExecutionEngine. It is a
 * caller of the engine, never an extension of it: there is no branching, no
 * retry, no loop and no way to run arbitrary code.
 */
/** How the runner obtains a ModelGateway for execute steps (ACME-0063/0064). */
export type ScenarioGatewayKind = 'mock' | 'openai';

export interface ScenarioDocument {
  readonly schemaVersion: ScenarioSchemaVersion;
  readonly name: string;
  readonly seed: ScenarioSeed;
  readonly composition: {
    readonly repository: 'memory' | 'sqlite';
    readonly gateway: ScenarioGatewayKind;
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
  /**
   * Mock response fixture providing selection + response for gateway mock.
   * Optional when `model` is set and composition.gateway is openai (live).
   */
  readonly mockResponse?: string;
  /**
   * Explicit model selection (ACME-0063). When present, becomes
   * ExecutionRequest.model; otherwise selection is read from mockResponse.
   */
  readonly model?: ModelSelection;
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

export interface EvaluateStep {
  readonly as: string;
  readonly execution: string;
  readonly evaluator: QualityEvaluatorRef;
  readonly artifact: {
    readonly kind: string;
    readonly id: string;
    readonly fixture: string;
    readonly digest: string;
  };
  /** Required only for recorded-external evaluators. */
  readonly recording?: string;
}

export interface AssertEvaluationStep {
  readonly evaluation: string;
  readonly verdict: QualityVerdict;
}

export type ScenarioStep =
  | { readonly execute: ExecuteStep }
  | { readonly assert: AssertStep }
  | { readonly replay: ReplayStep }
  | { readonly assertDigest: AssertDigestStep }
  | { readonly evaluate: EvaluateStep }
  | { readonly assertEvaluation: AssertEvaluationStep };

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
  /**
   * Required when the scenario document declares composition.gateway openai
   * (ACME-0064). Builds a live (or injected) gateway for the execute selection.
   */
  readonly liveGateway?: (selection: ModelSelection) => ModelGateway;
}

export interface ScenarioStepProgress {
  readonly index: number;
  readonly kind: string;
  readonly stepTotal: number;
  readonly phase: 'start' | 'complete';
  readonly status?: 'passed' | 'failed' | 'skipped';
}

export interface ScenarioRunOptions {
  readonly document: unknown;
  /**
   * Built from the parsed seed, so the clock and ID allocation a scenario
   * declares are the ones the run actually uses.
   */
  readonly composition: (seed: ScenarioSeed) => ScenarioComposition;
  readonly loadFixture: ScenarioFixtureLoader;
  /** Required only when an acme-scenario/2 document contains evaluate steps. */
  readonly quality?: {
    readonly runId: string;
    readonly harness: Pick<QualityEvaluationHarness, 'run' | 'runWith'>;
  };
  /**
   * Cooperative cancellation (ADR-0027). Checked before each step and passed
   * into engine model calls when present.
   */
  readonly signal?: AbortSignal;
  /** Optional progress hook for interface job runners; never affects outcomes. */
  readonly onStep?: (progress: ScenarioStepProgress) => void;
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

function parseModelSelection(
  raw: unknown,
  field: string,
): ModelSelection | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isObject(raw)) {
    invalid(`${field} must be an object.`);
  }
  const profile = text(raw['profile'], `${field}.profile`);
  const providerHint =
    raw['providerHint'] === undefined
      ? undefined
      : text(raw['providerHint'], `${field}.providerHint`);
  const modelHint =
    raw['modelHint'] === undefined
      ? undefined
      : text(raw['modelHint'], `${field}.modelHint`);
  return {
    profile,
    ...(providerHint === undefined ? {} : { providerHint }),
    ...(modelHint === undefined ? {} : { modelHint }),
  };
}

function parseExecute(raw: unknown): ExecuteStep {
  if (!isObject(raw)) {
    invalid('An execute step must be an object.');
  }
  const hash = raw['expectedRequestHash'];
  if (hash !== undefined && !/^[a-f0-9]{64}$/u.test(String(hash))) {
    invalid('expectedRequestHash must be a lowercase SHA-256 digest.');
  }
  const mockResponse =
    raw['mockResponse'] === undefined
      ? undefined
      : text(raw['mockResponse'], 'execute.mockResponse');
  const model = parseModelSelection(raw['model'], 'execute.model');
  if (mockResponse === undefined && model === undefined) {
    invalid(
      'execute requires mockResponse and/or model (model alone is for live gateway steps).',
    );
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
    ...(mockResponse === undefined ? {} : { mockResponse }),
    ...(model === undefined ? {} : { model }),
    ...(raw['policy'] === undefined
      ? {}
      : { policy: raw['policy'] as JsonValue }),
    ...(hash === undefined ? {} : { expectedRequestHash: String(hash) }),
  };
}

function qualityVerdict(value: unknown, field: string): QualityVerdict {
  if (value !== 'pass' && value !== 'fail' && value !== 'inconclusive') {
    invalid(`${field} must be pass, fail or inconclusive.`);
  }
  return value;
}

function parseEvaluate(raw: unknown): EvaluateStep {
  if (!isObject(raw)) {
    invalid('An evaluate step must be an object.');
  }
  const evaluator = raw['evaluator'];
  if (!isObject(evaluator)) {
    invalid('evaluate.evaluator must be an object.');
  }
  const kind = evaluator['kind'];
  if (kind !== 'deterministic' && kind !== 'recorded-external') {
    invalid(
      'evaluate.evaluator.kind must be deterministic or recorded-external.',
    );
  }
  const artifact = raw['artifact'];
  if (!isObject(artifact)) {
    invalid('evaluate.artifact must be an object.');
  }
  const digest = text(artifact['digest'], 'evaluate.artifact.digest');
  if (!/^[a-f0-9]{64}$/u.test(digest)) {
    invalid('evaluate.artifact.digest must be a lowercase SHA-256 digest.');
  }
  const recording = raw['recording'];
  if ((kind === 'recorded-external') !== (recording !== undefined)) {
    invalid(
      'evaluate.recording is required exactly for recorded-external evaluators.',
    );
  }
  return {
    as: text(raw['as'], 'evaluate.as'),
    execution: text(raw['execution'], 'evaluate.execution'),
    evaluator: {
      id: text(evaluator['id'], 'evaluate.evaluator.id'),
      version: text(evaluator['version'], 'evaluate.evaluator.version'),
      kind,
    },
    artifact: {
      kind: text(artifact['kind'], 'evaluate.artifact.kind'),
      id: text(artifact['id'], 'evaluate.artifact.id'),
      fixture: text(artifact['fixture'], 'evaluate.artifact.fixture'),
      digest,
    },
    ...(recording === undefined
      ? {}
      : { recording: text(recording, 'evaluate.recording') }),
  };
}

function parseStep(
  raw: unknown,
  index: number,
  schemaVersion: ScenarioSchemaVersion,
): ScenarioStep {
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
    case 'evaluate': {
      if (schemaVersion !== SCENARIO_SCHEMA_VERSION_V2) {
        invalid('The evaluate step requires acme-scenario/2.');
      }
      return { evaluate: parseEvaluate(body) };
    }
    case 'assertEvaluation': {
      if (schemaVersion !== SCENARIO_SCHEMA_VERSION_V2) {
        invalid('The assertEvaluation step requires acme-scenario/2.');
      }
      if (!isObject(body)) {
        invalid('An assertEvaluation step must be an object.');
      }
      return {
        assertEvaluation: {
          evaluation: text(body['evaluation'], 'assertEvaluation.evaluation'),
          verdict: qualityVerdict(body['verdict'], 'assertEvaluation.verdict'),
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
  const schemaVersion = raw['schemaVersion'];
  if (
    schemaVersion !== SCENARIO_SCHEMA_VERSION &&
    schemaVersion !== SCENARIO_SCHEMA_VERSION_V2
  ) {
    invalid(
      `A scenario requires schemaVersion ${SCENARIO_SCHEMA_VERSION} or ${SCENARIO_SCHEMA_VERSION_V2}.`,
    );
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
    (composition['gateway'] !== 'mock' && composition['gateway'] !== 'openai')
  ) {
    invalid(
      'scenario.composition requires repository memory|sqlite and gateway mock|openai.',
    );
  }
  const gateway = composition['gateway'] as ScenarioGatewayKind;
  const steps = raw['steps'];
  if (!Array.isArray(steps) || steps.length === 0) {
    invalid('A scenario requires at least one step.');
  }

  const parsedSteps = steps.map((step, index) =>
    parseStep(step, index, schemaVersion),
  );
  if (gateway === 'mock') {
    for (const step of parsedSteps) {
      if ('execute' in step && step.execute.mockResponse === undefined) {
        invalid(
          'execute.mockResponse is required when composition.gateway is mock.',
        );
      }
    }
  }
  if (gateway === 'openai') {
    for (const step of parsedSteps) {
      if (
        'execute' in step &&
        step.execute.model === undefined &&
        step.execute.mockResponse === undefined
      ) {
        invalid(
          'execute requires model (or mockResponse selection) when composition.gateway is openai.',
        );
      }
    }
  }

  return {
    schemaVersion,
    name: text(raw['name'], 'scenario.name'),
    seed: {
      clock: text(seed['clock'], 'scenario.seed.clock'),
      ids: 'sequential',
      ...(idPrefix === undefined ? {} : { idPrefix: String(idPrefix) }),
      ...(idPadding === undefined ? {} : { idPadding: Number(idPadding) }),
    },
    composition: {
      repository: composition['repository'],
      gateway,
    },
    steps: parsedSteps,
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
  const evaluationAliases = new Map<string, QualityEvaluationRecord>();
  const steps: ScenarioStepReport[] = [];
  let failure: ScenarioReport['failure'];

  function resolve(alias: string, field: string): string {
    const executionId = aliases.get(alias);
    if (executionId === undefined) {
      fail(`${field} refers to unknown execution alias "${alias}".`);
    }
    return executionId;
  }

  const stepTotal = document.steps.length;
  const signal = options.signal;

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

    if (signal?.aborted) {
      failure = {
        stepIndex: index,
        message: 'The scenario was cancelled before this step started.',
      };
      steps.push({
        index,
        kind: Object.keys(step)[0] ?? 'unknown',
        status: 'skipped',
        detail: null,
      });
      for (let rest = index + 1; rest < document.steps.length; rest += 1) {
        steps.push({
          index: rest,
          kind: Object.keys(document.steps[rest]!)[0] ?? 'unknown',
          status: 'skipped',
          detail: null,
        });
      }
      break;
    }

    const kind = Object.keys(step)[0] as string;
    options.onStep?.({
      index,
      kind,
      stepTotal,
      phase: 'start',
    });
    try {
      let detail: JsonValue = null;

      if ('execute' in step) {
        const spec = step.execute;
        const input = await options.loadFixture(spec.fixture);
        const mockFixture =
          spec.mockResponse === undefined
            ? undefined
            : parseMockFixture(
                await options.loadFixture(spec.mockResponse),
                spec.mockResponse,
              );
        const selection =
          spec.model ??
          mockFixture?.selection ??
          fail(
            `execute "${spec.as}" has no model selection (set execute.model or mockResponse.selection).`,
          );
        const executionId = deriveExecutionId(spec.namespace, spec.requestKey);
        const gatewayKind = document.composition.gateway;
        let gateway: ModelGateway;
        let observedHash: (() => string | undefined) | undefined;
        if (gatewayKind === 'openai') {
          if (composition.liveGateway === undefined) {
            fail(
              'composition.gateway is openai but the runner composition did not supply liveGateway.',
            );
          }
          gateway = composition.liveGateway(selection);
        } else {
          if (mockFixture === undefined) {
            fail(
              `execute "${spec.as}" requires mockResponse when composition.gateway is mock.`,
            );
          }
          const capture = capturingGateway(mockFixture);
          gateway = capture.gateway;
          observedHash = capture.observedHash;
        }
        const request: ExecutionRequest = {
          requestKey: spec.requestKey,
          namespace: spec.namespace,
          task: spec.task,
          entityId: spec.entityId,
          expectedRevision: spec.expectedRevision,
          input,
          model: selection,
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
          .engine(gateway)
          .execute(
            request,
            signal === undefined ? undefined : { signal },
          );
        aliases.set(spec.as, executionId);

        const observed = observedHash?.();
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
          gateway: gatewayKind,
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
      } else if ('evaluate' in step) {
        const spec = step.evaluate;
        if (options.quality === undefined) {
          fail('evaluate requires ScenarioRunOptions.quality.');
        }
        if (evaluationAliases.has(spec.as)) {
          fail(`evaluate.as ${JSON.stringify(spec.as)} is already defined.`);
        }
        const executionId = resolve(spec.execution, 'evaluate.execution');
        const execution = await composition.repository.get(executionId);
        if (execution?.result === undefined) {
          fail(`evaluate found no terminal result for "${spec.execution}".`);
        }
        const replayEvidence =
          await composition.repository.loadReplayEvidence(executionId);
        const artifact = await options.loadFixture(spec.artifact.fixture);
        const input = createQualityEvaluationInput({
          runId: options.quality.runId,
          executionResult: execution.result,
          operationDigest:
            replayEvidence?.preparedCommit.operationDigest ?? null,
          artifact: {
            kind: spec.artifact.kind,
            id: spec.artifact.id,
            value: artifact,
            expectedDigest: spec.artifact.digest,
          },
          contract: {
            ...execution.contract,
            fingerprint: execution.contractFingerprint,
          },
        });
        let evaluated: readonly QualityEvaluationRecord[];
        if (spec.evaluator.kind === 'recorded-external') {
          if (spec.recording === undefined) {
            fail('recorded-external evaluate step has no recording fixture.');
          }
          const recording = await options.loadFixture(spec.recording);
          const evaluator = recordedExternalEvaluator(recording);
          if (
            evaluator.id !== spec.evaluator.id ||
            evaluator.version !== spec.evaluator.version
          ) {
            fail(
              `Recorded evaluator was ${evaluator.id}@${evaluator.version}, expected ${spec.evaluator.id}@${spec.evaluator.version}.`,
            );
          }
          evaluated = await options.quality.harness.runWith(input, [evaluator]);
        } else {
          evaluated = await options.quality.harness.run(input, [
            spec.evaluator,
          ]);
        }
        const evaluation = evaluated[0];
        if (evaluation === undefined) {
          fail('evaluate produced no quality record.');
        }
        evaluationAliases.set(spec.as, evaluation);
        detail = {
          alias: spec.as,
          evaluationId: evaluation.evaluationId,
          executionId,
          evaluator: evaluation.evaluator,
          qualityVerdict: evaluation.result.verdict,
          scoreCount: evaluation.result.scores.length,
          findingCount: evaluation.result.findings.length,
        } as unknown as JsonValue;
      } else if ('assertEvaluation' in step) {
        const spec = step.assertEvaluation;
        const evaluation = evaluationAliases.get(spec.evaluation);
        if (evaluation === undefined) {
          fail(
            `assertEvaluation refers to unknown evaluation alias "${spec.evaluation}".`,
          );
        }
        if (evaluation.result.verdict !== spec.verdict) {
          fail(
            `Quality evaluation "${spec.evaluation}" was ${evaluation.result.verdict}, expected ${spec.verdict}.`,
          );
        }
        detail = {
          evaluationId: evaluation.evaluationId,
          qualityVerdict: evaluation.result.verdict,
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
      options.onStep?.({
        index,
        kind,
        stepTotal,
        phase: 'complete',
        status: 'passed',
      });
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
      options.onStep?.({
        index,
        kind,
        stepTotal,
        phase: 'complete',
        status: 'failed',
      });
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
