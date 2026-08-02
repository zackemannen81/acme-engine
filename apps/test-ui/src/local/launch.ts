import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { Clock, JsonValue, PayloadEncryptor } from '@acme/core';
import { runScenario, seededIdGenerator } from '@acme/testing';

import { resolveReference } from '../catalog/paths.js';
import { compileTestPlan } from '../plan/compile.js';
import { parseTestPlan } from '../plan/schema.js';
import {
  RUN_RECORD_VERSION,
  isSafeRunId,
  type RunCaseRecord,
  type RunRecord,
  type RunStepRecord,
} from '../run-record.js';
import {
  createInterfaceComposition,
  type InterfaceComposition,
} from './composition.js';
import type { Workspace } from './workspace.js';

/**
 * Launching a plan (ADR-0021).
 *
 * Compile, run through the existing ScenarioRunner, record. Synchronous: no
 * worker, no queue, no retry, no cancellation. When it returns, the run is
 * over and the record is on disk.
 *
 * The interface writes nothing into the ledger. It reaches the engine only
 * through `runScenario`, the same entry point the CLI uses.
 */

export interface LaunchOptions {
  /** The raw plan document, validated here. */
  readonly plan: unknown;
  /** Directory the plan's fixture references resolve under. */
  readonly scenarioRoot: string;
  readonly workspace: Workspace;
  /** Must be a safe file name; it becomes one. */
  readonly runId: string;
  /** Supplies `startedAt` and `finishedAt`; the run's own clock is the seed's. */
  readonly clock: Clock;
  readonly database?: string;
  readonly payloadEncryptor?: PayloadEncryptor;
}

export interface LaunchResult {
  readonly record: RunRecord;
  readonly composition: InterfaceComposition;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function caseRecords(
  steps: readonly { readonly kind: string; readonly detail: JsonValue }[],
): readonly RunCaseRecord[] {
  const cases: RunCaseRecord[] = [];
  for (const step of steps) {
    if (step.kind !== 'execute' || !isObject(step.detail)) {
      continue;
    }
    const alias = step.detail['alias'];
    const executionId = step.detail['executionId'];
    if (typeof alias === 'string' && typeof executionId === 'string') {
      cases.push({ alias, executionId });
    }
  }
  return cases;
}

/**
 * A fixture path must stay below the scenario root. The plan validator
 * already refused escaping references; this repeats the check at the point a
 * real path is built, because that is where the mistake would matter.
 */
function fixturePath(root: string, requested: string): string {
  const resolved = resolveReference(requested);
  if (resolved.status === 'refused') {
    throw new Error(
      `A fixture reference must stay below the scenario root: ${requested}`,
    );
  }
  return join(root, ...resolved.path.split('/'));
}

export async function launchPlan(
  options: LaunchOptions,
): Promise<LaunchResult> {
  if (!isSafeRunId(options.runId)) {
    throw new Error(
      `A run identifier must be a safe file name: ${JSON.stringify(options.runId)}`,
    );
  }

  const plan = parseTestPlan(options.plan);
  const compiled = compileTestPlan(plan);
  const root = resolve(options.scenarioRoot);
  const startedAt = options.clock.now();

  let composition: InterfaceComposition | undefined;
  const report = await runScenario({
    document: compiled.scenario,
    composition(seed) {
      // The scenario's own seed owns clock and ID allocation, so a pinned
      // digest stays reproducible no matter when the run was launched.
      const built = createInterfaceComposition({
        repository: plan.composition.repository,
        clock: { now: () => seed.clock },
        ids: seededIdGenerator(seed),
        ...(options.database === undefined
          ? {}
          : { database: options.database }),
        ...(options.payloadEncryptor === undefined
          ? {}
          : { payloadEncryptor: options.payloadEncryptor }),
      });
      composition = built;
      return built;
    },
    async loadFixture(requested) {
      const raw = await readFile(fixturePath(root, requested), 'utf8');
      return JSON.parse(raw) as JsonValue;
    },
    // No gateway is passed: the runner builds one from each step's mock
    // fixture, which is where acme-scenario/1 keeps the selection and the
    // scripted response, and hands it to composition.engine().
  });

  if (composition === undefined) {
    throw new Error('The scenario runner did not build a composition.');
  }

  const steps: readonly RunStepRecord[] = report.steps.map((step) => ({
    index: step.index,
    kind: step.kind,
    status: step.status,
  }));

  const record: RunRecord = {
    version: RUN_RECORD_VERSION,
    runId: options.runId,
    planName: plan.name,
    scenarioName: report.name,
    startedAt,
    finishedAt: options.clock.now(),
    composition: {
      repository: plan.composition.repository,
      gateway: plan.composition.gateway,
    },
    status: report.status,
    steps,
    cases: caseRecords(report.steps),
    failure: report.failure ?? null,
  };

  await options.workspace.recordRun(record);
  return { record, composition };
}
