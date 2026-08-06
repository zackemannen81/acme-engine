/**
 * Live evaluation confirmation gate (ADR-0023).
 *
 * Pure: no environment, no network, no credentials. The local composition
 * root combines a valid confirmation with process opt-in before building a
 * gateway.
 */

export const LIVE_CONFIRMATION_VERSION = 'acme-live-confirmation/1' as const;

export type LiveProvider = 'openai';

export interface LiveEvaluationConfirmation {
  readonly version: typeof LIVE_CONFIRMATION_VERSION;
  /** Must be the boolean true; absent or false is refused. */
  readonly optIn: true;
  readonly provider: LiveProvider;
  /** Non-secret model id (e.g. gpt-5.6-luna). */
  readonly model: string;
  /** v1: exactly one case / one ExecutionRequest. */
  readonly caseCount: number;
  readonly maxModelCalls: number;
  /** Declared cost bound in minor units; null means no monetary ceiling. */
  readonly costCeilingMinor: number | null;
  readonly currency: string | null;
  readonly confirmer: string;
  readonly rationale: string;
}

export class LiveGateRefused extends Error {
  readonly reason: string;

  constructor(reason: string, message: string) {
    super(message);
    this.name = 'LiveGateRefused';
    this.reason = reason;
  }
}

export const LIVE_GATE_REFUSAL = {
  version: 'LIVE_CONFIRMATION_VERSION',
  optIn: 'LIVE_OPT_IN_REQUIRED',
  provider: 'LIVE_PROVIDER_UNSUPPORTED',
  model: 'LIVE_MODEL_REQUIRED',
  caseCount: 'LIVE_CASE_COUNT_INVALID',
  maxModelCalls: 'LIVE_MAX_MODEL_CALLS_INVALID',
  costCeiling: 'LIVE_COST_CEILING_INVALID',
  confirmer: 'LIVE_CONFIRMER_REQUIRED',
  rationale: 'LIVE_RATIONALE_REQUIRED',
  credentials: 'LIVE_CREDENTIALS_FORBIDDEN',
  budget: 'LIVE_BUDGET_EXCEEDED',
  envOptIn: 'LIVE_ENV_OPT_IN_REQUIRED',
  apiKey: 'LIVE_API_KEY_REQUIRED',
} as const;

/** Field names that must never appear on a confirmation document. */
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

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNoCredentialFields(
  raw: Record<string, unknown>,
  path: string,
): void {
  for (const [key, value] of Object.entries(raw)) {
    const normalized = key.replaceAll(/[-]/gu, '').toLowerCase();
    if (
      FORBIDDEN_CREDENTIAL_KEYS.has(key.toLowerCase()) ||
      FORBIDDEN_CREDENTIAL_KEYS.has(normalized)
    ) {
      throw new LiveGateRefused(
        LIVE_GATE_REFUSAL.credentials,
        `A live confirmation must not carry credential field ${path}${key}.`,
      );
    }
    if (isObject(value)) {
      assertNoCredentialFields(value, `${path}${key}.`);
    }
  }
}

/**
 * Validate a live confirmation document.
 *
 * Does not read the environment. Pair with `liveOptIn` at the composition
 * root before launching.
 */
export function parseLiveConfirmation(
  raw: unknown,
): LiveEvaluationConfirmation {
  if (!isObject(raw)) {
    throw new LiveGateRefused(
      LIVE_GATE_REFUSAL.version,
      'A live confirmation must be an object.',
    );
  }
  assertNoCredentialFields(raw, '');

  if (raw['version'] !== LIVE_CONFIRMATION_VERSION) {
    throw new LiveGateRefused(
      LIVE_GATE_REFUSAL.version,
      `Expected ${LIVE_CONFIRMATION_VERSION}.`,
    );
  }
  if (raw['optIn'] !== true) {
    throw new LiveGateRefused(
      LIVE_GATE_REFUSAL.optIn,
      'Live evaluation requires confirmation.optIn === true.',
    );
  }
  if (raw['provider'] !== 'openai') {
    throw new LiveGateRefused(
      LIVE_GATE_REFUSAL.provider,
      'Live evaluation v1 supports only provider "openai".',
    );
  }
  if (!nonEmpty(raw['model'])) {
    throw new LiveGateRefused(
      LIVE_GATE_REFUSAL.model,
      'A live confirmation requires a non-empty model id.',
    );
  }
  const caseCount = raw['caseCount'];
  if (
    typeof caseCount !== 'number' ||
    !Number.isInteger(caseCount) ||
    caseCount !== 1
  ) {
    throw new LiveGateRefused(
      LIVE_GATE_REFUSAL.caseCount,
      'Live evaluation v1 requires caseCount === 1 (single ExecutionRequest).',
    );
  }
  const maxModelCalls = raw['maxModelCalls'];
  if (
    typeof maxModelCalls !== 'number' ||
    !Number.isInteger(maxModelCalls) ||
    maxModelCalls < 1
  ) {
    throw new LiveGateRefused(
      LIVE_GATE_REFUSAL.maxModelCalls,
      'A live confirmation requires maxModelCalls as a positive integer.',
    );
  }

  const costCeilingMinor = raw['costCeilingMinor'];
  if (
    costCeilingMinor !== null &&
    costCeilingMinor !== undefined &&
    (typeof costCeilingMinor !== 'number' ||
      !Number.isFinite(costCeilingMinor) ||
      costCeilingMinor < 0)
  ) {
    throw new LiveGateRefused(
      LIVE_GATE_REFUSAL.costCeiling,
      'costCeilingMinor must be null or a non-negative finite number.',
    );
  }
  const currency = raw['currency'];
  if (
    currency !== null &&
    currency !== undefined &&
    (typeof currency !== 'string' || currency.trim().length === 0)
  ) {
    throw new LiveGateRefused(
      LIVE_GATE_REFUSAL.costCeiling,
      'currency must be null or a non-empty string.',
    );
  }
  if (!nonEmpty(raw['confirmer'])) {
    throw new LiveGateRefused(
      LIVE_GATE_REFUSAL.confirmer,
      'A live confirmation requires a confirmer identity.',
    );
  }
  if (!nonEmpty(raw['rationale'])) {
    throw new LiveGateRefused(
      LIVE_GATE_REFUSAL.rationale,
      'A live confirmation requires a non-empty rationale.',
    );
  }

  return {
    version: LIVE_CONFIRMATION_VERSION,
    optIn: true,
    provider: 'openai',
    model: raw['model'].trim(),
    caseCount: 1,
    maxModelCalls,
    costCeilingMinor:
      costCeilingMinor === undefined || costCeilingMinor === null
        ? null
        : costCeilingMinor,
    currency:
      currency === undefined || currency === null ? null : currency.trim(),
    confirmer: raw['confirmer'].trim(),
    rationale: raw['rationale'].trim(),
  };
}

/**
 * Combine process opt-in with a confirmation. Pure: the caller passes the
 * env-derived boolean.
 */
export function requireLiveGate(options: {
  readonly liveOptIn: boolean;
  readonly confirmation: unknown;
}): LiveEvaluationConfirmation {
  if (!options.liveOptIn) {
    throw new LiveGateRefused(
      LIVE_GATE_REFUSAL.envOptIn,
      'Live evaluation requires ACME_TEST_UI_LIVE=1 (or true) in the environment.',
    );
  }
  return parseLiveConfirmation(options.confirmation);
}

/** Refuse when the request's model-call budget exceeds the confirmation. */
export function assertWithinBudget(
  confirmation: LiveEvaluationConfirmation,
  requestMaxModelCalls: number,
): void {
  if (requestMaxModelCalls > confirmation.maxModelCalls) {
    throw new LiveGateRefused(
      LIVE_GATE_REFUSAL.budget,
      `Request maxModelCalls (${requestMaxModelCalls}) exceeds confirmed ceiling (${confirmation.maxModelCalls}).`,
    );
  }
}

export function isLiveOptInEnv(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}
