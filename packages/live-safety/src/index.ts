/** Provider-neutral, pure live-execution safety primitives. */

export const LIVE_SAFETY_REFUSAL = {
  credentials: 'LIVE_CREDENTIALS_FORBIDDEN',
  envOptIn: 'LIVE_ENV_OPT_IN_REQUIRED',
  credentialMissing: 'LIVE_API_KEY_REQUIRED',
  callBudget: 'LIVE_BUDGET_EXCEEDED',
  costBudget: 'LIVE_COST_BUDGET_EXCEEDED',
  deploymentBudget: 'LIVE_DEPLOYMENT_BUDGET_INVALID',
} as const;

export class LiveSafetyRefused extends Error {
  constructor(
    readonly reason: string,
    message: string,
  ) {
    super(message);
    this.name = 'LiveSafetyRefused';
  }
}

const FORBIDDEN_CREDENTIAL_KEYS = new Set([
  'apikey',
  'api_key',
  'token',
  'secret',
  'password',
  'authorization',
  'openai_api_key',
  'bearer',
  'credential',
  'credentials',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reject credential-shaped fields recursively without ever echoing values. */
export function assertNoLiveCredentialFields(value: unknown): void {
  function visit(raw: Record<string, unknown>, path: string): void {
    for (const [key, child] of Object.entries(raw)) {
      const normalized = key.replaceAll('-', '').toLowerCase();
      if (
        FORBIDDEN_CREDENTIAL_KEYS.has(key.toLowerCase()) ||
        FORBIDDEN_CREDENTIAL_KEYS.has(normalized)
      ) {
        throw new LiveSafetyRefused(
          LIVE_SAFETY_REFUSAL.credentials,
          `A live confirmation must not carry credential field ${path}${key}.`,
        );
      }
      if (isObject(child)) visit(child, `${path}${key}.`);
    }
  }

  if (isObject(value)) visit(value, '');
}

export function isLiveOptInValue(value: string | undefined): boolean {
  if (value === undefined) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export function requireLiveOptIn(
  enabled: boolean,
  message = 'Live execution requires explicit deployment opt-in.',
): void {
  if (!enabled)
    throw new LiveSafetyRefused(LIVE_SAFETY_REFUSAL.envOptIn, message);
}

/** Resolve an injected/environment credential without including it in errors. */
export function requireLiveCredential(
  value: string | undefined,
  message = 'Live execution requires a provider credential in the environment.',
): string {
  if (value === undefined || value.trim().length === 0)
    throw new LiveSafetyRefused(LIVE_SAFETY_REFUSAL.credentialMissing, message);
  return value.trim();
}

export interface LiveBudget {
  readonly maxModelCalls: number;
  readonly costCeilingMinor: number | null;
}

/**
 * A deployment may decline to cap the campaign; an execution may not.
 *
 * Bounding one execution is runaway protection and stays mandatory. Capping
 * how many calls a deployment may ever make is a phase control that ADR-0044
 * retired: how many calls a case needs is measured from recorded evidence, not
 * refused at a threshold. `null` means no campaign cap, never "zero calls".
 */
export interface LiveDeploymentBudget {
  readonly maxModelCalls: number | null;
  readonly costCeilingMinor: number | null;
}

function positiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1)
    throw new LiveSafetyRefused(
      LIVE_SAFETY_REFUSAL.deploymentBudget,
      `${label} must be a positive integer.`,
    );
}

function cost(value: number | null, label: string): void {
  if (value !== null && (!Number.isInteger(value) || value < 0))
    throw new LiveSafetyRefused(
      LIVE_SAFETY_REFUSAL.deploymentBudget,
      `${label} must be null or a non-negative integer.`,
    );
}

/**
 * Prove a deployment budget is well formed on its own.
 *
 * An absent call ceiling is valid and means the deployment declines to cap the
 * campaign. A present one must still be a positive integer, and a cost ceiling
 * must still be null or non-negative.
 */
export function assertLiveDeploymentBudget(
  deployment: LiveDeploymentBudget,
): void {
  if (deployment.maxModelCalls !== null)
    positiveInteger(deployment.maxModelCalls, 'deployment.maxModelCalls');
  cost(deployment.costCeilingMinor, 'deployment.costCeilingMinor');
}

/** Prove a run/operation ceiling is inside both confirmation and deployment. */
export function assertLiveBudget(input: {
  readonly requested: LiveBudget;
  readonly confirmed: LiveBudget;
  readonly deployment: LiveDeploymentBudget;
}): void {
  positiveInteger(input.requested.maxModelCalls, 'requested.maxModelCalls');
  positiveInteger(input.confirmed.maxModelCalls, 'confirmed.maxModelCalls');
  if (input.deployment.maxModelCalls !== null)
    positiveInteger(input.deployment.maxModelCalls, 'deployment.maxModelCalls');
  cost(input.requested.costCeilingMinor, 'requested.costCeilingMinor');
  cost(input.confirmed.costCeilingMinor, 'confirmed.costCeilingMinor');
  cost(input.deployment.costCeilingMinor, 'deployment.costCeilingMinor');

  if (
    (input.deployment.maxModelCalls !== null &&
      input.confirmed.maxModelCalls > input.deployment.maxModelCalls) ||
    input.requested.maxModelCalls > input.confirmed.maxModelCalls
  )
    throw new LiveSafetyRefused(
      LIVE_SAFETY_REFUSAL.callBudget,
      'The live model-call ceiling exceeds an enclosing ceiling.',
    );

  const requestedCost = input.requested.costCeilingMinor;
  const confirmedCost = input.confirmed.costCeilingMinor;
  const deploymentCost = input.deployment.costCeilingMinor;
  if (
    (deploymentCost !== null &&
      (confirmedCost === null || confirmedCost > deploymentCost)) ||
    (confirmedCost !== null &&
      (requestedCost === null || requestedCost > confirmedCost))
  )
    throw new LiveSafetyRefused(
      LIVE_SAFETY_REFUSAL.costBudget,
      'The live cost ceiling exceeds an enclosing ceiling.',
    );
}
