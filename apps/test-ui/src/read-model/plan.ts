import type { ExecutionPolicy, JsonValue } from '@acme/core';

import { compileTestPlan, type CompiledScenario } from '../plan/compile.js';
import { parseTestPlan, type TestPlan } from '../plan/schema.js';
import {
  available,
  unavailable,
  PLAN_VIEW_VERSION,
  VIEW_UNAVAILABLE,
  type ViewSection,
} from '../view.js';

/**
 * S2 — test plan designer (ADR-0019, ADR-0020, ADR-0021).
 *
 * Answers "what exactly will run, against what composition?" before anything
 * launches. The designer shows the **compiled** artifact, because that is what
 * the runner will execute; the plan is only how a person wrote it down.
 *
 * An invalid plan is reported, not thrown. A designer that crashes on a typo
 * cannot show the author where the typo is.
 */

export interface PlanViewOptions {
  /** Loaded fixture contents, when the caller wants the request preview. */
  readonly fixtures?: Readonly<Record<string, JsonValue>>;
}

export interface PlanCaseView {
  readonly id: string;
  readonly namespace: string;
  readonly task: string;
  readonly entityId: string;
  readonly expectedRevision: number;
  readonly requestKey: string;
  readonly input: string;
  readonly mockResponse: string | null;
  /** Pinned model selection when present (ACME-0063). */
  readonly model: {
    readonly profile: string;
    readonly providerHint: string | null;
    readonly modelHint: string | null;
  } | null;
  readonly policy: ExecutionPolicy;
  readonly expectsStatus: string | null;
  readonly expectsRevision: number | null;
  readonly expectsDigest: string | null;
  readonly replayMode: string | null;
  readonly replayExpect: string | null;
}

export interface PlanDetailView {
  readonly name: string;
  readonly schemaVersion: string;
  readonly seed: {
    readonly clock: string;
    readonly ids: string;
    readonly idPrefix: string | null;
    readonly idPadding: number | null;
  };
  readonly composition: {
    readonly repository: string;
    readonly gateway: string;
  };
  readonly caseCount: number;
  readonly cases: readonly PlanCaseView[];
  /** What the runner will actually execute. */
  readonly compiled: CompiledScenario;
  readonly stepCount: number;
  readonly requestPreviewAvailable: boolean;
}

export interface PlanView {
  readonly view: typeof PLAN_VIEW_VERSION;
  readonly status: 'valid' | 'invalid';
  /** The validator's own error. The designer never rewrites it. */
  readonly error: { readonly code: string; readonly message: string } | null;
  readonly plan: ViewSection<PlanDetailView>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Read a thrown validator error structurally, never with `instanceof`. */
function validatorError(error: unknown): {
  readonly code: string;
  readonly message: string;
} {
  if (isObject(error) && isObject(error['data'])) {
    const data = error['data'];
    const code = text(data['code']);
    const message = text(data['message']);
    if (code !== null && message !== null) {
      return { code, message };
    }
  }
  return {
    code: 'INVALID_REQUEST',
    message: error instanceof Error ? error.message : 'The plan was rejected.',
  };
}

function caseViews(
  plan: TestPlan,
  compiled: CompiledScenario,
): readonly PlanCaseView[] {
  const policies = new Map<string, ExecutionPolicy>();
  const requestKeys = new Map<string, string>();
  for (const step of compiled.steps) {
    if ('execute' in step) {
      policies.set(step.execute.as, step.execute.policy);
      requestKeys.set(step.execute.as, step.execute.requestKey);
    }
  }

  return plan.cases.map((entry) => {
    const policy = policies.get(entry.id);
    const requestKey = requestKeys.get(entry.id);
    if (policy === undefined || requestKey === undefined) {
      // Unreachable for compiler output; asserting beats a silent default.
      throw new Error(`Compiled scenario is missing case ${entry.id}.`);
    }
    return {
      id: entry.id,
      namespace: entry.namespace,
      task: entry.task,
      entityId: entry.entityId,
      expectedRevision: entry.expectedRevision,
      requestKey,
      input: entry.input,
      mockResponse: entry.mockResponse ?? null,
      model:
        entry.model === undefined
          ? null
          : {
              profile: entry.model.profile,
              providerHint: entry.model.providerHint ?? null,
              modelHint: entry.model.modelHint ?? null,
            },
      policy,
      expectsStatus: entry.expect?.status ?? null,
      expectsRevision: entry.expect?.revision ?? null,
      expectsDigest:
        entry.expect?.digest ?? entry.expect?.operationDigest ?? null,
      replayMode: entry.replay?.mode ?? null,
      replayExpect: entry.replay?.expect ?? null,
    };
  });
}

/**
 * Build the designer view from a raw, unvalidated plan document.
 *
 * Validation and compilation both happen here so the surface can show a
 * refusal in the same shape it shows a preview.
 */
export function buildPlanView(
  raw: unknown,
  options: PlanViewOptions = {},
): PlanView {
  let plan: TestPlan;
  try {
    plan = parseTestPlan(raw);
  } catch (error: unknown) {
    return {
      view: PLAN_VIEW_VERSION,
      status: 'invalid',
      error: validatorError(error),
      plan: unavailable(VIEW_UNAVAILABLE.planInvalid),
    };
  }

  const compiled = compileTestPlan(
    plan,
    options.fixtures === undefined ? {} : { fixtures: options.fixtures },
  );

  return {
    view: PLAN_VIEW_VERSION,
    status: 'valid',
    error: null,
    plan: available<PlanDetailView>({
      name: plan.name,
      schemaVersion: plan.schemaVersion,
      seed: {
        clock: plan.seed.clock,
        ids: plan.seed.ids,
        idPrefix: plan.seed.idPrefix ?? null,
        idPadding: plan.seed.idPadding ?? null,
      },
      composition: {
        repository: plan.composition.repository,
        gateway: plan.composition.gateway,
      },
      caseCount: plan.cases.length,
      cases: caseViews(plan, compiled.scenario),
      compiled: compiled.scenario,
      stepCount: compiled.scenario.steps.length,
      requestPreviewAvailable: compiled.requests.availability === 'available',
    }),
  };
}
