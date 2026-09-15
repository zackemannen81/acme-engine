import {
  AcmeError,
  assertRequiredModelCapabilities,
  canonicalJson,
  computeModelRequestHash,
  validateGatewayCallContext,
  validateModelCapabilities,
  validateModelRequest,
  validateModelSelection,
  validateNormalizedModelResponse,
  type AcmeErrorData,
  type GatewayCallContext,
  type JsonValue,
  type ModelCapabilities,
  type ModelGateway,
  type ModelRequest,
  type ModelSelection,
  type NormalizedModelResponse,
} from '@acme/core';

export interface ScriptedModelProfile {
  readonly selection: ModelSelection;
  readonly capabilities: ModelCapabilities;
}

export type ScriptedModelOutcome =
  | {
      readonly kind: 'response';
      readonly response: NormalizedModelResponse;
    }
  | {
      readonly kind: 'error';
      readonly error: AcmeErrorData;
    };

export interface ScriptedModelCall {
  readonly executionId: string;
  readonly callKey: string;
  readonly selection: ModelSelection;
  readonly expectedRequestHash: string;
  readonly outcome: ScriptedModelOutcome;
}

export interface ScriptedModelGatewayOptions {
  readonly profiles: readonly ScriptedModelProfile[];
  readonly calls: readonly ScriptedModelCall[];
}

export interface ModelInvocationEvidence {
  readonly ordinal: number;
  readonly executionId: string;
  readonly callKey: string;
  readonly selection: ModelSelection;
  readonly requestHash: string;
  readonly outcome: 'response' | 'error';
}

export interface ScriptedModelGateway extends ModelGateway {
  invocations(): readonly ModelInvocationEvidence[];
  unconsumedCalls(): readonly ScriptedModelCall[];
  assertAllConsumed(): void;
}

interface ScriptState {
  readonly call: ScriptedModelCall;
  consumed: boolean;
}

type JsonObject = { readonly [key: string]: JsonValue };

const modelErrorCodes = new Set([
  'TIMEOUT',
  'MODEL_RATE_LIMIT',
  'MODEL_AUTH',
  'MODEL_UNAVAILABLE',
  'MODEL_CONTENT_FILTER',
  'MODEL_INVALID_RESPONSE',
]);

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

function json(value: unknown): JsonValue {
  return value as JsonValue;
}

function invalid(message: string, details?: JsonValue): never {
  throw new AcmeError({
    code: 'INVALID_REQUEST',
    message,
    stage: 'calling-model',
    retryable: false,
    ...(details === undefined ? {} : { details }),
  });
}

function harnessFailure(message: string, details?: JsonValue): never {
  throw new AcmeError({
    code: 'INTERNAL',
    message,
    stage: 'calling-model',
    retryable: false,
    ...(details === undefined ? {} : { details }),
  });
}

function unsupportedSelection(selection: ModelSelection): never {
  throw new AcmeError({
    code: 'UNSUPPORTED_CAPABILITY',
    message: 'No model profile matches the supplied selection.',
    stage: 'calling-model',
    retryable: false,
    details: json({ selection }),
  });
}

function cloneCanonical<T>(value: T, label: string): T {
  try {
    return deepFreeze(JSON.parse(canonicalJson(json(value))) as unknown as T);
  } catch (error) {
    invalid(`${label} must contain only canonical JSON data.`, {
      reason:
        error instanceof Error ? error.message : 'unknown validation error',
    });
  }
}

function object(value: unknown, label: string): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalid(`${label} must be an object.`);
  }
  return value as JsonObject;
}

function exactKeys(
  value: JsonObject,
  allowed: readonly string[],
  required: readonly string[],
  label: string,
): void {
  const keys = Object.keys(value);
  const unexpected = keys.filter((key) => !allowed.includes(key)).sort();
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  if (unexpected.length > 0 || missing.length > 0) {
    invalid(`${label} has an invalid shape.`, { missing, unexpected });
  }
}

function text(value: JsonValue | undefined, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    invalid(`${label} must be a non-empty string.`);
  }
  return value;
}

function selectionKey(selection: ModelSelection): string {
  return canonicalJson(json(selection));
}

function callIdentity(executionId: string, callKey: string): string {
  return canonicalJson([executionId, callKey]);
}

function validateError(value: JsonValue, label: string): AcmeErrorData {
  const candidate = object(value, label);
  exactKeys(
    candidate,
    ['causeRef', 'code', 'details', 'message', 'retryable', 'stage'],
    ['code', 'message', 'retryable', 'stage'],
    label,
  );
  if (
    typeof candidate.code !== 'string' ||
    !modelErrorCodes.has(candidate.code)
  ) {
    invalid(`${label} code must be TIMEOUT or a MODEL_* gateway error code.`);
  }
  if (candidate.stage !== 'calling-model') {
    invalid(`${label} stage must be "calling-model".`);
  }
  if (typeof candidate.retryable !== 'boolean') {
    invalid(`${label} retryable must be a boolean.`);
  }
  return deepFreeze({
    code: candidate.code as AcmeErrorData['code'],
    message: text(candidate.message, `${label} message`),
    stage: 'calling-model',
    retryable: candidate.retryable,
    ...(Object.hasOwn(candidate, 'details')
      ? { details: candidate.details as JsonValue }
      : {}),
    ...(Object.hasOwn(candidate, 'causeRef')
      ? { causeRef: text(candidate.causeRef, `${label} causeRef`) }
      : {}),
  });
}

function validateOutcome(
  value: JsonValue,
  index: number,
): ScriptedModelOutcome {
  const label = `Scripted call ${index} outcome`;
  const candidate = object(value, label);
  if (candidate.kind === 'response') {
    exactKeys(candidate, ['kind', 'response'], ['kind', 'response'], label);
    return deepFreeze({
      kind: 'response',
      response: validateNormalizedModelResponse(
        candidate.response as unknown as NormalizedModelResponse,
      ),
    });
  }
  if (candidate.kind === 'error') {
    exactKeys(candidate, ['error', 'kind'], ['error', 'kind'], label);
    return deepFreeze({
      kind: 'error',
      error: validateError(candidate.error as JsonValue, `${label} error`),
    });
  }
  invalid(`${label} kind must be "response" or "error".`);
}

function validateOptions(
  options: ScriptedModelGatewayOptions,
): ScriptedModelGatewayOptions {
  const cloned = cloneCanonical(options, 'Scripted model gateway options');
  const candidate = object(cloned, 'Scripted model gateway options');
  exactKeys(candidate, ['calls', 'profiles'], ['calls', 'profiles'], 'Options');
  if (!Array.isArray(candidate.profiles) || candidate.profiles.length === 0) {
    invalid('Scripted model gateway profiles must be a non-empty array.');
  }
  if (!Array.isArray(candidate.calls)) {
    invalid('Scripted model gateway calls must be an array.');
  }

  const profileKeys = new Set<string>();
  const profiles = candidate.profiles.map((value, index) => {
    const label = `Scripted model profile ${index}`;
    const profile = object(value, label);
    exactKeys(
      profile,
      ['capabilities', 'selection'],
      ['capabilities', 'selection'],
      label,
    );
    const validated = deepFreeze({
      selection: validateModelSelection(
        profile.selection as unknown as ModelSelection,
      ),
      capabilities: validateModelCapabilities(
        profile.capabilities as unknown as ModelCapabilities,
      ),
    });
    const key = selectionKey(validated.selection);
    if (profileKeys.has(key)) {
      invalid(
        'Scripted model profiles contain a duplicate selection.',
        json({
          selection: validated.selection,
        }),
      );
    }
    profileKeys.add(key);
    return validated;
  });

  const callKeys = new Set<string>();
  const calls = candidate.calls.map((value, index) => {
    const label = `Scripted model call ${index}`;
    const call = object(value, label);
    exactKeys(
      call,
      ['callKey', 'executionId', 'expectedRequestHash', 'outcome', 'selection'],
      ['callKey', 'executionId', 'expectedRequestHash', 'outcome', 'selection'],
      label,
    );
    const executionId = text(call.executionId, `${label} executionId`);
    const key = text(call.callKey, `${label} callKey`);
    const selection = validateModelSelection(
      call.selection as unknown as ModelSelection,
    );
    const expectedRequestHash = text(
      call.expectedRequestHash,
      `${label} expectedRequestHash`,
    );
    if (!/^[a-f0-9]{64}$/u.test(expectedRequestHash)) {
      invalid(
        `${label} expectedRequestHash must be a lowercase SHA-256 digest.`,
      );
    }
    const identity = callIdentity(executionId, key);
    if (callKeys.has(identity)) {
      invalid('Scripted model calls contain a duplicate call identity.', {
        executionId,
        callKey: key,
      });
    }
    callKeys.add(identity);
    if (!profileKeys.has(selectionKey(selection))) {
      invalid(
        `${label} references an undeclared model selection.`,
        json({
          selection,
        }),
      );
    }
    return deepFreeze({
      executionId,
      callKey: key,
      selection,
      expectedRequestHash,
      outcome: validateOutcome(call.outcome as JsonValue, index),
    });
  });

  return deepFreeze({ profiles, calls });
}

function compareCalls(
  left: ScriptedModelCall,
  right: ScriptedModelCall,
): number {
  const leftIdentity = callIdentity(left.executionId, left.callKey);
  const rightIdentity = callIdentity(right.executionId, right.callKey);
  return leftIdentity < rightIdentity
    ? -1
    : leftIdentity > rightIdentity
      ? 1
      : 0;
}

class DeterministicScriptedModelGateway implements ScriptedModelGateway {
  readonly #profiles = new Map<string, ScriptedModelProfile>();
  readonly #scripts = new Map<string, ScriptState>();
  readonly #invocations: ModelInvocationEvidence[] = [];

  constructor(options: ScriptedModelGatewayOptions) {
    const validated = validateOptions(options);
    for (const profile of validated.profiles) {
      this.#profiles.set(selectionKey(profile.selection), profile);
    }
    for (const call of validated.calls) {
      this.#scripts.set(callIdentity(call.executionId, call.callKey), {
        call,
        consumed: false,
      });
    }
  }

  async capabilities(selection: ModelSelection): Promise<ModelCapabilities> {
    const validated = validateModelSelection(selection);
    const profile = this.#profiles.get(selectionKey(validated));
    if (profile === undefined) {
      unsupportedSelection(validated);
    }
    return cloneCanonical(profile.capabilities, 'Model capabilities');
  }

  async generate(
    request: ModelRequest,
    context: GatewayCallContext,
  ): Promise<NormalizedModelResponse> {
    const validatedContext = validateGatewayCallContext(context);
    if (validatedContext.signal.aborted) {
      throw new AcmeError({
        code: 'CANCELLED',
        message: 'Model call was cancelled before invocation.',
        stage: 'calling-model',
        retryable: false,
      });
    }

    const validatedRequest = validateModelRequest(request);
    const profile = this.#profiles.get(
      selectionKey(validatedContext.selection),
    );
    if (profile === undefined) {
      unsupportedSelection(validatedContext.selection);
    }
    assertRequiredModelCapabilities(
      profile.capabilities,
      validatedContext.requiredCapabilities,
    );

    const identity = callIdentity(
      validatedContext.executionId,
      validatedContext.callKey,
    );
    const state = this.#scripts.get(identity);
    if (state === undefined) {
      harnessFailure('No scripted model call matches the supplied identity.', {
        executionId: validatedContext.executionId,
        callKey: validatedContext.callKey,
      });
    }
    if (state.consumed) {
      harnessFailure('Scripted model call was already consumed.', {
        executionId: validatedContext.executionId,
        callKey: validatedContext.callKey,
      });
    }
    if (
      selectionKey(state.call.selection) !==
      selectionKey(validatedContext.selection)
    ) {
      harnessFailure(
        'Scripted model call selection does not match.',
        json({
          executionId: validatedContext.executionId,
          callKey: validatedContext.callKey,
          expectedSelection: state.call.selection,
          actualSelection: validatedContext.selection,
        }),
      );
    }

    const requestHash = computeModelRequestHash(validatedRequest);
    if (state.call.expectedRequestHash !== requestHash) {
      harnessFailure('Scripted model call request hash does not match.', {
        executionId: validatedContext.executionId,
        callKey: validatedContext.callKey,
        expectedRequestHash: state.call.expectedRequestHash,
        actualRequestHash: requestHash,
      });
    }

    state.consumed = true;
    const evidence = deepFreeze({
      ordinal: this.#invocations.length + 1,
      executionId: validatedContext.executionId,
      callKey: validatedContext.callKey,
      selection: validatedContext.selection,
      requestHash,
      outcome: state.call.outcome.kind,
    });
    this.#invocations.push(evidence);

    if (state.call.outcome.kind === 'error') {
      throw new AcmeError(state.call.outcome.error);
    }
    return cloneCanonical(
      state.call.outcome.response,
      'Scripted normalized model response',
    );
  }

  invocations(): readonly ModelInvocationEvidence[] {
    return cloneCanonical(this.#invocations, 'Model invocation evidence');
  }

  unconsumedCalls(): readonly ScriptedModelCall[] {
    const calls = [...this.#scripts.values()]
      .filter((state) => !state.consumed)
      .map((state) => state.call)
      .sort(compareCalls);
    return cloneCanonical(calls, 'Unconsumed scripted model calls');
  }

  assertAllConsumed(): void {
    const unconsumed = this.unconsumedCalls();
    if (unconsumed.length > 0) {
      harnessFailure('Not all scripted model calls were consumed.', {
        unconsumed: unconsumed.map(({ executionId, callKey }) => ({
          executionId,
          callKey,
        })),
      });
    }
  }
}

export function createScriptedModelGateway(
  options: ScriptedModelGatewayOptions,
): ScriptedModelGateway {
  return new DeterministicScriptedModelGateway(options);
}
