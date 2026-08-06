import {
  resolveExecutionPolicy,
  type ExecutionPolicy,
  type ExecutionRequest,
  type JsonValue,
  type ModelSelection,
} from '@acme/core';

import {
  available,
  unavailable,
  VIEW_UNAVAILABLE,
  type ViewSection,
} from '../view.js';
import {
  defaultRequestKey,
  type TestPlan,
  type TestPlanCase,
} from './schema.js';

/**
 * `acme-test-plan/1` compiler (ADR-0020).
 *
 * Pure and total: no filesystem, no network, no clock, no environment. The
 * same plan always produces the same bytes, which is what makes the compiled
 * scenario — not the plan — the artifact worth reviewing.
 *
 * The output set is fixed by ADR-0019 gate 3: `acme-scenario/1` and
 * `ExecutionRequest`. Nothing else is emitted.
 */

export const SCENARIO_SCHEMA_VERSION = 'acme-scenario/1' as const;

/**
 * Structural `acme-scenario/1`, declared here rather than imported so the app
 * needs no runtime dependency on `@acme/testing`. The compile-and-run gate
 * proves the shape by feeding real `parseScenario`.
 */
export interface CompiledExecuteStep {
  readonly as: string;
  readonly requestKey: string;
  readonly namespace: string;
  readonly task: string;
  readonly entityId: string;
  readonly expectedRevision: number;
  readonly fixture: string;
  readonly mockResponse?: string;
  readonly model?: ModelSelection;
  readonly policy: ExecutionPolicy;
  readonly expectedRequestHash?: string;
}

export interface CompiledAssertStep {
  readonly execution: string;
  readonly status: string;
  readonly revision?: number;
  readonly documentKeys?: readonly string[];
}

export interface CompiledReplayStep {
  readonly execution: string;
  readonly mode: 'verify';
  readonly expect?: 'match' | 'different' | 'unavailable';
}

export interface CompiledAssertDigestStep {
  readonly execution: string;
  readonly operationDigest?: string;
  readonly fixture?: string;
}

export type CompiledStep =
  | { readonly execute: CompiledExecuteStep }
  | { readonly assert: CompiledAssertStep }
  | { readonly replay: CompiledReplayStep }
  | { readonly assertDigest: CompiledAssertDigestStep };

export interface CompiledScenario {
  readonly schemaVersion: typeof SCENARIO_SCHEMA_VERSION;
  readonly name: string;
  readonly seed: {
    readonly clock: string;
    readonly ids: 'sequential';
    readonly idPrefix?: string;
    readonly idPadding?: number;
  };
  readonly composition: {
    readonly repository: 'memory' | 'sqlite';
    readonly gateway: 'mock' | 'openai';
  };
  readonly steps: readonly CompiledStep[];
}

export interface CompileOptions {
  /**
   * Already-loaded fixture contents, keyed by the path the plan references.
   * Supplied by a caller that has read them; the compiler never reads a file.
   */
  readonly fixtures?: Readonly<Record<string, JsonValue>>;
}

export interface CompiledPlan {
  readonly planName: string;
  readonly scenario: CompiledScenario;
  /**
   * Materialized requests, available only when fixtures were supplied. A
   * request needs the task input and the model selection, and both are file
   * contents the plan only references.
   */
  readonly requests: ViewSection<{
    readonly requests: readonly ExecutionRequest[];
  }>;
}

/** Case policy overrides plan policy field by field; the engine resolves it. */
function effectivePolicy(plan: TestPlan, entry: TestPlanCase): ExecutionPolicy {
  return resolveExecutionPolicy({ ...plan.policy, ...entry.policy });
}

function executeStep(plan: TestPlan, entry: TestPlanCase): CompiledExecuteStep {
  return {
    as: entry.id,
    requestKey: entry.requestKey ?? defaultRequestKey(plan.name, entry.id),
    namespace: entry.namespace,
    task: entry.task,
    entityId: entry.entityId,
    expectedRevision: entry.expectedRevision,
    fixture: entry.input,
    ...(entry.mockResponse === undefined
      ? {}
      : { mockResponse: entry.mockResponse }),
    ...(entry.model === undefined ? {} : { model: entry.model }),
    policy: effectivePolicy(plan, entry),
    ...(entry.expectRequestHash === undefined
      ? {}
      : { expectedRequestHash: entry.expectRequestHash }),
  };
}

function caseSteps(plan: TestPlan, entry: TestPlanCase): CompiledStep[] {
  const steps: CompiledStep[] = [{ execute: executeStep(plan, entry) }];

  if (entry.expect !== undefined) {
    steps.push({
      assert: {
        execution: entry.id,
        status: entry.expect.status,
        ...(entry.expect.revision === undefined
          ? {}
          : { revision: entry.expect.revision }),
        ...(entry.expect.documentKeys === undefined
          ? {}
          : { documentKeys: [...entry.expect.documentKeys] }),
      },
    });
  }

  if (entry.replay !== undefined) {
    steps.push({
      replay: {
        execution: entry.id,
        mode: entry.replay.mode,
        ...(entry.replay.expect === undefined
          ? {}
          : { expect: entry.replay.expect }),
      },
    });
  }

  // A digest assertion runs last, because it compares the effect the earlier
  // steps produced.
  if (entry.expect?.digest !== undefined) {
    steps.push({
      assertDigest: { execution: entry.id, fixture: entry.expect.digest },
    });
  } else if (entry.expect?.operationDigest !== undefined) {
    steps.push({
      assertDigest: {
        execution: entry.id,
        operationDigest: entry.expect.operationDigest,
      },
    });
  }

  return steps;
}

function isObject(
  value: JsonValue,
): value is { readonly [k: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Prefer case.model (ACME-0063); fall back to mock-response fixture selection.
 */
function selectionFrom(
  entry: TestPlanCase,
  fixtures: Readonly<Record<string, JsonValue>>,
): ModelSelection | null {
  if (entry.model !== undefined) {
    return entry.model;
  }
  if (entry.mockResponse === undefined) {
    return null;
  }
  const fixture = fixtures[entry.mockResponse];
  if (fixture === undefined || !isObject(fixture)) {
    return null;
  }
  const selection = fixture['selection'];
  if (selection === undefined || !isObject(selection)) {
    return null;
  }
  return selection as unknown as ModelSelection;
}

function materializeRequests(
  plan: TestPlan,
  fixtures: Readonly<Record<string, JsonValue>>,
): readonly ExecutionRequest[] | null {
  const requests: ExecutionRequest[] = [];
  for (const entry of plan.cases) {
    const input = fixtures[entry.input];
    const selection = selectionFrom(entry, fixtures);
    if (input === undefined || selection === null) {
      return null;
    }
    requests.push({
      requestKey: entry.requestKey ?? defaultRequestKey(plan.name, entry.id),
      namespace: entry.namespace,
      task: entry.task,
      entityId: entry.entityId,
      expectedRevision: entry.expectedRevision,
      input,
      model: selection,
      policy: effectivePolicy(plan, entry),
    });
  }
  return requests;
}

export function compileTestPlan(
  plan: TestPlan,
  options: CompileOptions = {},
): CompiledPlan {
  const scenario: CompiledScenario = {
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    name: plan.name,
    seed: {
      clock: plan.seed.clock,
      ids: plan.seed.ids,
      ...(plan.seed.idPrefix === undefined
        ? {}
        : { idPrefix: plan.seed.idPrefix }),
      ...(plan.seed.idPadding === undefined
        ? {}
        : { idPadding: plan.seed.idPadding }),
    },
    composition: {
      repository: plan.composition.repository,
      gateway: plan.composition.gateway,
    },
    // Case declaration order is step order. Nothing is re-sorted.
    steps: plan.cases.flatMap((entry) => caseSteps(plan, entry)),
  };

  if (options.fixtures === undefined) {
    return {
      planName: plan.name,
      scenario,
      requests: unavailable(VIEW_UNAVAILABLE.planFixtures),
    };
  }

  const requests = materializeRequests(plan, options.fixtures);
  return {
    planName: plan.name,
    scenario,
    requests:
      requests === null
        ? unavailable(VIEW_UNAVAILABLE.planFixtures)
        : available({ requests }),
  };
}
