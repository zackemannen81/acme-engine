import {
  AcmeError,
  resolveExecutionPolicy,
  type ExecutionPolicy,
  type JsonValue,
} from '@acme/core';

import { resolveReference } from '../catalog/paths.js';

/**
 * `acme-test-plan/1` (ADR-0020).
 *
 * A thin authoring convenience over `acme-scenario/1`. A case is written once
 * instead of as up to four cross-referenced steps; the compiled scenario is
 * the reviewable unit.
 *
 * The validator is strict on purpose. An unknown field is a refusal, not a
 * value to ignore: a plan that silently drops a misspelled expectation would
 * pass while asserting less than its author wrote.
 */

export const TEST_PLAN_SCHEMA_VERSION = 'acme-test-plan/1' as const;

export interface TestPlanSeed {
  readonly clock: string;
  readonly ids: 'sequential';
  readonly idPrefix?: string;
  readonly idPadding?: number;
}

export interface TestPlanComposition {
  readonly repository: 'memory' | 'sqlite';
  readonly gateway: 'mock';
}

export interface TestPlanExpectation {
  readonly status: string;
  readonly revision?: number;
  readonly documentKeys?: readonly string[];
  /** Fixture path holding the expected operation digest. */
  readonly digest?: string;
  /** Literal expected operation digest. */
  readonly operationDigest?: string;
}

export interface TestPlanReplay {
  readonly mode: 'verify';
  readonly expect?: 'match' | 'different' | 'unavailable';
}

export interface TestPlanCase {
  readonly id: string;
  readonly namespace: string;
  readonly task: string;
  readonly entityId: string;
  readonly expectedRevision: number;
  readonly input: string;
  readonly mockResponse: string;
  /** Defaults to `<plan name>-<case id>`. */
  readonly requestKey?: string;
  readonly policy?: Partial<ExecutionPolicy>;
  readonly expectRequestHash?: string;
  readonly expect?: TestPlanExpectation;
  readonly replay?: TestPlanReplay;
}

export interface TestPlan {
  readonly schemaVersion: typeof TEST_PLAN_SCHEMA_VERSION;
  readonly name: string;
  readonly seed: TestPlanSeed;
  readonly composition: TestPlanComposition;
  readonly policy?: Partial<ExecutionPolicy>;
  readonly cases: readonly TestPlanCase[];
}

const PLAN_KEYS = [
  'schemaVersion',
  'name',
  'seed',
  'composition',
  'policy',
  'cases',
];
const SEED_KEYS = ['clock', 'ids', 'idPrefix', 'idPadding'];
const COMPOSITION_KEYS = ['repository', 'gateway'];
const CASE_KEYS = [
  'id',
  'namespace',
  'task',
  'entityId',
  'expectedRevision',
  'input',
  'mockResponse',
  'requestKey',
  'policy',
  'expectRequestHash',
  'expect',
  'replay',
];
const EXPECT_KEYS = [
  'status',
  'revision',
  'documentKeys',
  'digest',
  'operationDigest',
];
const REPLAY_KEYS = ['mode', 'expect'];

function invalid(message: string, details?: JsonValue): never {
  throw new AcmeError(
    details === undefined
      ? {
          code: 'INVALID_REQUEST',
          message,
          stage: 'accepted',
          retryable: false,
        }
      : {
          code: 'INVALID_REQUEST',
          message,
          stage: 'accepted',
          retryable: false,
          details,
        },
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!isObject(value)) {
    invalid(`${label} must be an object.`);
  }
  return value;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  const unexpected = Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .sort();
  if (unexpected.length > 0) {
    invalid(`${label} contains unexpected fields.`, { unexpected });
  }
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    invalid(`${label} must be a non-empty string.`);
  }
  return value;
}

function optionalText(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : text(value, label);
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    invalid(`${label} must be a non-negative integer.`);
  }
  return value;
}

const SHA_256_HEX = /^[a-f0-9]{64}$/u;

/**
 * `acme-scenario/1` requires `expectedRequestHash` to be a lowercase SHA-256
 * digest, so a plan that offers anything else must be refused here. Emitting
 * it and letting the runner reject the compiled artifact would move the error
 * away from the file the author can fix.
 *
 * `operationDigest` deliberately keeps the runner's weaker rule — non-empty
 * text — rather than inventing a stricter one the runner does not enforce.
 */
function requestHash(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const raw = text(value, label);
  if (!SHA_256_HEX.test(raw)) {
    invalid(`${label} must be a lowercase SHA-256 digest.`);
  }
  return raw;
}

/**
 * A fixture reference must stay below the scenario root. The rule is the
 * phase-2 one, so the compiler and the catalog agree on what "below" means.
 */
function reference(value: unknown, label: string): string {
  const raw = text(value, label);
  const resolved = resolveReference(raw);
  if (resolved.status === 'refused') {
    invalid(`${label} must stay below the scenario root.`, {
      requested: raw,
      reason: resolved.reason,
    });
  }
  return resolved.path;
}

function policy(
  value: unknown,
  label: string,
): Partial<ExecutionPolicy> | undefined {
  if (value === undefined) {
    return undefined;
  }
  const supplied = object(value, label);
  try {
    // The engine's own resolver decides what a policy may say. There is no
    // second policy schema here that could drift away from it.
    resolveExecutionPolicy(supplied as Partial<ExecutionPolicy>);
  } catch (error: unknown) {
    invalid(
      `${label} is not a policy the engine accepts.`,
      error instanceof AcmeError
        ? { code: error.data.code, reason: error.data.message }
        : undefined,
    );
  }
  return supplied as Partial<ExecutionPolicy>;
}

function seed(value: unknown): TestPlanSeed {
  const raw = object(value, 'plan.seed');
  exactKeys(raw, SEED_KEYS, 'plan.seed');
  if (raw['ids'] !== 'sequential') {
    invalid("plan.seed.ids must be 'sequential'.");
  }
  const idPrefix = optionalText(raw['idPrefix'], 'plan.seed.idPrefix');
  const idPadding =
    raw['idPadding'] === undefined
      ? undefined
      : nonNegativeInteger(raw['idPadding'], 'plan.seed.idPadding');
  return {
    clock: text(raw['clock'], 'plan.seed.clock'),
    ids: 'sequential',
    ...(idPrefix === undefined ? {} : { idPrefix }),
    ...(idPadding === undefined ? {} : { idPadding }),
  };
}

function composition(value: unknown): TestPlanComposition {
  const raw = object(value, 'plan.composition');
  exactKeys(raw, COMPOSITION_KEYS, 'plan.composition');
  const repository = raw['repository'];
  if (repository !== 'memory' && repository !== 'sqlite') {
    invalid("plan.composition.repository must be 'memory' or 'sqlite'.");
  }
  if (raw['gateway'] !== 'mock') {
    invalid("plan.composition.gateway must be 'mock'.");
  }
  return { repository, gateway: 'mock' };
}

function expectation(
  value: unknown,
  label: string,
): TestPlanExpectation | undefined {
  if (value === undefined) {
    return undefined;
  }
  const raw = object(value, label);
  exactKeys(raw, EXPECT_KEYS, label);
  if (raw['digest'] !== undefined && raw['operationDigest'] !== undefined) {
    invalid(`${label} must not set both digest and operationDigest.`);
  }
  const documentKeys = raw['documentKeys'];
  if (documentKeys !== undefined && !Array.isArray(documentKeys)) {
    invalid(`${label}.documentKeys must be an array.`);
  }
  const revision =
    raw['revision'] === undefined
      ? undefined
      : nonNegativeInteger(raw['revision'], `${label}.revision`);
  const digest =
    raw['digest'] === undefined
      ? undefined
      : reference(raw['digest'], `${label}.digest`);
  const operationDigest = optionalText(
    raw['operationDigest'],
    `${label}.operationDigest`,
  );
  return {
    status: text(raw['status'], `${label}.status`),
    ...(revision === undefined ? {} : { revision }),
    ...(documentKeys === undefined
      ? {}
      : {
          documentKeys: documentKeys.map((entry, index) =>
            text(entry, `${label}.documentKeys[${String(index)}]`),
          ),
        }),
    ...(digest === undefined ? {} : { digest }),
    ...(operationDigest === undefined ? {} : { operationDigest }),
  };
}

function replay(value: unknown, label: string): TestPlanReplay | undefined {
  if (value === undefined) {
    return undefined;
  }
  const raw = object(value, label);
  exactKeys(raw, REPLAY_KEYS, label);
  if (raw['mode'] !== 'verify') {
    invalid(`${label}.mode must be 'verify'.`);
  }
  const expect = raw['expect'];
  if (
    expect !== undefined &&
    expect !== 'match' &&
    expect !== 'different' &&
    expect !== 'unavailable'
  ) {
    invalid(`${label}.expect must be match, different or unavailable.`);
  }
  return {
    mode: 'verify',
    ...(expect === undefined ? {} : { expect }),
  };
}

function planCase(value: unknown, index: number): TestPlanCase {
  const label = `plan.cases[${String(index)}]`;
  const raw = object(value, label);
  exactKeys(raw, CASE_KEYS, label);
  const requestKey = optionalText(raw['requestKey'], `${label}.requestKey`);
  const casePolicy = policy(raw['policy'], `${label}.policy`);
  const expectRequestHash = requestHash(
    raw['expectRequestHash'],
    `${label}.expectRequestHash`,
  );
  const expect = expectation(raw['expect'], `${label}.expect`);
  const caseReplay = replay(raw['replay'], `${label}.replay`);
  return {
    id: text(raw['id'], `${label}.id`),
    namespace: text(raw['namespace'], `${label}.namespace`),
    task: text(raw['task'], `${label}.task`),
    entityId: text(raw['entityId'], `${label}.entityId`),
    expectedRevision: nonNegativeInteger(
      raw['expectedRevision'],
      `${label}.expectedRevision`,
    ),
    input: reference(raw['input'], `${label}.input`),
    mockResponse: reference(raw['mockResponse'], `${label}.mockResponse`),
    ...(requestKey === undefined ? {} : { requestKey }),
    ...(casePolicy === undefined ? {} : { policy: casePolicy }),
    ...(expectRequestHash === undefined ? {} : { expectRequestHash }),
    ...(expect === undefined ? {} : { expect }),
    ...(caseReplay === undefined ? {} : { replay: caseReplay }),
  };
}

/** The request key a case compiles to when it does not set one. */
export function defaultRequestKey(planName: string, caseId: string): string {
  return `${planName}-${caseId}`;
}

export function parseTestPlan(raw: unknown): TestPlan {
  const plan = object(raw, 'A test plan');
  if (plan['schemaVersion'] !== TEST_PLAN_SCHEMA_VERSION) {
    invalid(`A test plan requires schemaVersion ${TEST_PLAN_SCHEMA_VERSION}.`);
  }
  exactKeys(plan, PLAN_KEYS, 'plan');

  const name = text(plan['name'], 'plan.name');
  const cases = plan['cases'];
  if (!Array.isArray(cases) || cases.length === 0) {
    invalid('plan.cases must be a non-empty array.');
  }

  const parsed = cases.map((entry, index) => planCase(entry, index));

  const ids = new Set<string>();
  const requestKeys = new Set<string>();
  for (const entry of parsed) {
    if (ids.has(entry.id)) {
      invalid('plan.cases ids must be unique.', { id: entry.id });
    }
    ids.add(entry.id);
    // Duplicate request keys would make two cases the same execution, so the
    // second would replay the first instead of running.
    const key = entry.requestKey ?? defaultRequestKey(name, entry.id);
    if (requestKeys.has(key)) {
      invalid('plan.cases request keys must be unique.', { requestKey: key });
    }
    requestKeys.add(key);
  }

  const planPolicy = policy(plan['policy'], 'plan.policy');
  return {
    schemaVersion: TEST_PLAN_SCHEMA_VERSION,
    name,
    seed: seed(plan['seed']),
    composition: composition(plan['composition']),
    ...(planPolicy === undefined ? {} : { policy: planPolicy }),
    cases: parsed,
  };
}
