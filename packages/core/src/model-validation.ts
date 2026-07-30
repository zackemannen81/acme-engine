import type { JsonValue } from './common.js';
import { AcmeError } from './errors.js';
import { canonicalJson } from './hashing.js';
import type {
  GatewayCallContext,
  ModelCapabilities,
  ModelContentPart,
  ModelMessage,
  ModelRequest,
  ModelSelection,
  NormalizedModelResponse,
  NormalizedUsage,
} from './model.js';

const selectionKeys = ['modelHint', 'profile', 'providerHint'] as const;
const capabilityKeys = [
  'maxInputTokens',
  'maxOutputTokens',
  'structuredOutput',
  'tools',
  'vision',
] as const;
const requestKeys = [
  'maxOutputTokens',
  'messages',
  'output',
  'stop',
  'temperature',
] as const;
const responseKeys = [
  'finishReason',
  'metadata',
  'model',
  'provider',
  'providerResponseId',
  'receivedAt',
  'text',
  'usage',
] as const;
const usageKeys = [
  'currency',
  'estimatedCostMinor',
  'inputTokens',
  'outputTokens',
  'totalTokens',
] as const;

type JsonObject = { readonly [key: string]: JsonValue };

function invalid(message: string, details?: JsonValue): never {
  throw new AcmeError({
    code: 'INVALID_REQUEST',
    message,
    stage: 'calling-model',
    retryable: false,
    ...(details === undefined ? {} : { details }),
  });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

function cloneJson<T>(value: T, label: string): T {
  try {
    return deepFreeze(
      JSON.parse(canonicalJson(value as JsonValue)) as unknown as T,
    );
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

function boolean(value: JsonValue | undefined, label: string): boolean {
  if (typeof value !== 'boolean') {
    invalid(`${label} must be a boolean.`);
  }
  return value;
}

function positiveInteger(value: JsonValue | undefined, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    invalid(`${label} must be a positive safe integer.`);
  }
  return value as number;
}

function nonNegativeInteger(
  value: JsonValue | undefined,
  label: string,
): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    invalid(`${label} must be a non-negative safe integer.`);
  }
  return value as number;
}

function optionalText(
  value: JsonObject,
  key: string,
  label: string,
): string | undefined {
  return Object.hasOwn(value, key) ? text(value[key], label) : undefined;
}

function validateSelectionValue(value: JsonObject): ModelSelection {
  exactKeys(value, selectionKeys, ['profile'], 'Model selection');
  return deepFreeze({
    profile: text(value.profile, 'Model selection profile'),
    ...(Object.hasOwn(value, 'providerHint')
      ? {
          providerHint: text(
            value.providerHint,
            'Model selection providerHint',
          ),
        }
      : {}),
    ...(Object.hasOwn(value, 'modelHint')
      ? { modelHint: text(value.modelHint, 'Model selection modelHint') }
      : {}),
  });
}

function validateCapabilitiesValue(
  value: JsonObject,
  partial: boolean,
): Partial<ModelCapabilities> | ModelCapabilities {
  exactKeys(
    value,
    capabilityKeys,
    partial ? [] : ['structuredOutput', 'tools', 'vision'],
    partial ? 'Required model capabilities' : 'Model capabilities',
  );
  const result: {
    structuredOutput?: boolean;
    tools?: boolean;
    vision?: boolean;
    maxInputTokens?: number;
    maxOutputTokens?: number;
  } = {};

  for (const key of ['structuredOutput', 'tools', 'vision'] as const) {
    if (Object.hasOwn(value, key)) {
      result[key] = boolean(value[key], `Model capability ${key}`);
    }
  }
  for (const key of ['maxInputTokens', 'maxOutputTokens'] as const) {
    if (Object.hasOwn(value, key)) {
      result[key] = positiveInteger(value[key], `Model capability ${key}`);
    }
  }
  return deepFreeze(result);
}

function validateContentPart(
  value: JsonValue,
  messageIndex: number,
  partIndex: number,
): ModelContentPart {
  const candidate = object(
    value,
    `Model request message ${messageIndex} content part ${partIndex}`,
  );
  const type = candidate.type;
  const label = `Model request message ${messageIndex} content part ${partIndex}`;
  if (type === 'text') {
    exactKeys(candidate, ['text', 'type'], ['text', 'type'], label);
    return deepFreeze({ type, text: text(candidate.text, `${label} text`) });
  }
  if (type === 'image') {
    exactKeys(
      candidate,
      ['dataRef', 'mediaType', 'type'],
      ['dataRef', 'mediaType', 'type'],
      label,
    );
    return deepFreeze({
      type,
      mediaType: text(candidate.mediaType, `${label} mediaType`),
      dataRef: text(candidate.dataRef, `${label} dataRef`),
    });
  }
  if (type === 'tool-result') {
    exactKeys(
      candidate,
      ['toolCallId', 'type', 'value'],
      ['toolCallId', 'type', 'value'],
      label,
    );
    return deepFreeze({
      type,
      toolCallId: text(candidate.toolCallId, `${label} toolCallId`),
      value: candidate.value as JsonValue,
    });
  }
  invalid(`${label} has an unsupported type.`);
}

function validateMessage(value: JsonValue, index: number): ModelMessage {
  const candidate = object(value, `Model request message ${index}`);
  exactKeys(
    candidate,
    ['content', 'role'],
    ['content', 'role'],
    `Model request message ${index}`,
  );
  if (
    candidate.role !== 'system' &&
    candidate.role !== 'user' &&
    candidate.role !== 'assistant' &&
    candidate.role !== 'tool'
  ) {
    invalid(`Model request message ${index} role is invalid.`);
  }
  if (!Array.isArray(candidate.content) || candidate.content.length === 0) {
    invalid(
      `Model request message ${index} content must be a non-empty array.`,
    );
  }
  return deepFreeze({
    role: candidate.role,
    content: candidate.content.map((part, partIndex) =>
      validateContentPart(part, index, partIndex),
    ),
  });
}

function validateRequestValue(value: JsonObject): ModelRequest {
  exactKeys(value, requestKeys, ['messages', 'output'], 'Model request');
  if (!Array.isArray(value.messages) || value.messages.length === 0) {
    invalid('Model request messages must be a non-empty array.');
  }
  const output = object(value.output, 'Model request output');
  exactKeys(
    output,
    ['jsonSchema', 'mode', 'schemaName'],
    ['jsonSchema', 'mode', 'schemaName'],
    'Model request output',
  );
  if (output.mode !== 'json') {
    invalid('Model request output mode must be "json".');
  }
  object(output.jsonSchema, 'Model request output jsonSchema');

  let temperature: number | undefined;
  if (Object.hasOwn(value, 'temperature')) {
    if (
      typeof value.temperature !== 'number' ||
      !Number.isFinite(value.temperature) ||
      value.temperature < 0
    ) {
      invalid(
        'Model request temperature must be a finite non-negative number.',
      );
    }
    temperature = value.temperature;
  }

  let stop: readonly string[] | undefined;
  if (Object.hasOwn(value, 'stop')) {
    if (!Array.isArray(value.stop) || value.stop.length === 0) {
      invalid('Model request stop must be a non-empty array.');
    }
    stop = value.stop.map((entry, index) =>
      text(entry, `Model request stop ${index}`),
    );
  }

  return deepFreeze({
    messages: value.messages.map((message, index) =>
      validateMessage(message, index),
    ),
    output: deepFreeze({
      mode: 'json' as const,
      schemaName: text(output.schemaName, 'Model request output schemaName'),
      jsonSchema: output.jsonSchema as JsonValue,
    }),
    ...(temperature === undefined ? {} : { temperature }),
    ...(Object.hasOwn(value, 'maxOutputTokens')
      ? {
          maxOutputTokens: positiveInteger(
            value.maxOutputTokens,
            'Model request maxOutputTokens',
          ),
        }
      : {}),
    ...(stop === undefined ? {} : { stop }),
  });
}

function validateUsage(value: JsonValue): NormalizedUsage {
  const candidate = object(value, 'Normalized model usage');
  exactKeys(candidate, usageKeys, [], 'Normalized model usage');
  const estimatedCostMinor = Object.hasOwn(candidate, 'estimatedCostMinor')
    ? nonNegativeInteger(
        candidate.estimatedCostMinor,
        'Normalized usage estimatedCostMinor',
      )
    : undefined;
  const currency = optionalText(
    candidate,
    'currency',
    'Normalized usage currency',
  );
  if ((estimatedCostMinor === undefined) !== (currency === undefined)) {
    invalid(
      'Normalized usage estimatedCostMinor and currency must be supplied together.',
    );
  }
  return deepFreeze({
    ...(Object.hasOwn(candidate, 'inputTokens')
      ? {
          inputTokens: nonNegativeInteger(
            candidate.inputTokens,
            'Normalized usage inputTokens',
          ),
        }
      : {}),
    ...(Object.hasOwn(candidate, 'outputTokens')
      ? {
          outputTokens: nonNegativeInteger(
            candidate.outputTokens,
            'Normalized usage outputTokens',
          ),
        }
      : {}),
    ...(Object.hasOwn(candidate, 'totalTokens')
      ? {
          totalTokens: nonNegativeInteger(
            candidate.totalTokens,
            'Normalized usage totalTokens',
          ),
        }
      : {}),
    ...(estimatedCostMinor === undefined
      ? {}
      : { estimatedCostMinor, currency: currency as string }),
  });
}

function isoTimestamp(value: JsonValue | undefined, label: string): string {
  const candidate = text(value, label);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(candidate) ||
    Number.isNaN(Date.parse(candidate)) ||
    new Date(candidate).toISOString() !== candidate
  ) {
    invalid(`${label} must be a canonical UTC ISO timestamp.`);
  }
  return candidate;
}

function validateResponseValue(value: JsonObject): NormalizedModelResponse {
  exactKeys(
    value,
    responseKeys,
    [
      'finishReason',
      'metadata',
      'model',
      'provider',
      'receivedAt',
      'text',
      'usage',
    ],
    'Normalized model response',
  );
  if (
    value.finishReason !== 'stop' &&
    value.finishReason !== 'length' &&
    value.finishReason !== 'tool' &&
    value.finishReason !== 'content-filter' &&
    value.finishReason !== 'unknown'
  ) {
    invalid('Normalized model response finishReason is invalid.');
  }
  if (typeof value.text !== 'string') {
    invalid('Normalized model response text must be a string.');
  }
  const metadata = object(value.metadata, 'Normalized model response metadata');
  return deepFreeze({
    provider: text(value.provider, 'Normalized model response provider'),
    model: text(value.model, 'Normalized model response model'),
    ...(Object.hasOwn(value, 'providerResponseId')
      ? {
          providerResponseId: text(
            value.providerResponseId,
            'Normalized model response providerResponseId',
          ),
        }
      : {}),
    receivedAt: isoTimestamp(
      value.receivedAt,
      'Normalized model response receivedAt',
    ),
    finishReason: value.finishReason,
    text: value.text,
    usage: validateUsage(value.usage as JsonValue),
    metadata,
  });
}

export function validateModelSelection(value: ModelSelection): ModelSelection {
  const cloned = cloneJson(value, 'Model selection');
  return validateSelectionValue(object(cloned, 'Model selection'));
}

export function validateModelCapabilities(
  value: ModelCapabilities,
): ModelCapabilities {
  const cloned = cloneJson(value, 'Model capabilities');
  return validateCapabilitiesValue(
    object(cloned, 'Model capabilities'),
    false,
  ) as ModelCapabilities;
}

export function validateRequiredModelCapabilities(
  value: Partial<ModelCapabilities>,
): Partial<ModelCapabilities> {
  const cloned = cloneJson(value, 'Required model capabilities');
  return validateCapabilitiesValue(
    object(cloned, 'Required model capabilities'),
    true,
  );
}

export function validateModelRequest(value: ModelRequest): ModelRequest {
  const cloned = cloneJson(value, 'Model request');
  return validateRequestValue(object(cloned, 'Model request'));
}

export function validateNormalizedModelResponse(
  value: NormalizedModelResponse,
): NormalizedModelResponse {
  const cloned = cloneJson(value, 'Normalized model response');
  return validateResponseValue(object(cloned, 'Normalized model response'));
}

export function validateGatewayCallContext(
  value: GatewayCallContext,
): GatewayCallContext {
  if (value === null || typeof value !== 'object') {
    invalid('Gateway call context must be an object.');
  }
  const contextKeys = [
    'callKey',
    'executionId',
    'requiredCapabilities',
    'selection',
    'signal',
    'timeoutMs',
  ];
  const suppliedKeys = Object.keys(value);
  const unexpected = suppliedKeys
    .filter((key) => !contextKeys.includes(key))
    .sort();
  const missing = contextKeys.filter((key) => !Object.hasOwn(value, key));
  if (unexpected.length > 0 || missing.length > 0) {
    invalid('Gateway call context has an invalid shape.', {
      missing,
      unexpected,
    });
  }
  const signal = value.signal;
  if (
    signal === null ||
    typeof signal !== 'object' ||
    typeof signal.aborted !== 'boolean' ||
    typeof signal.addEventListener !== 'function'
  ) {
    invalid('Gateway call context signal must be an AbortSignal.');
  }
  if (!Number.isSafeInteger(value.timeoutMs) || value.timeoutMs <= 0) {
    invalid('Gateway call context timeoutMs must be a positive safe integer.');
  }
  return Object.freeze({
    executionId: text(
      value.executionId as JsonValue,
      'Gateway call context executionId',
    ),
    callKey: text(value.callKey, 'Gateway call context callKey'),
    selection: validateModelSelection(value.selection),
    requiredCapabilities: validateRequiredModelCapabilities(
      value.requiredCapabilities,
    ),
    timeoutMs: value.timeoutMs,
    signal,
  });
}

export function missingRequiredModelCapabilities(
  available: ModelCapabilities,
  required: Partial<ModelCapabilities>,
): readonly string[] {
  const normalizedAvailable = validateModelCapabilities(available);
  const normalizedRequired = validateRequiredModelCapabilities(required);
  const missing: string[] = [];

  for (const key of ['structuredOutput', 'tools', 'vision'] as const) {
    if (normalizedRequired[key] === true && normalizedAvailable[key] !== true) {
      missing.push(key);
    }
  }
  for (const key of ['maxInputTokens', 'maxOutputTokens'] as const) {
    const minimum = normalizedRequired[key];
    const supplied = normalizedAvailable[key];
    if (
      minimum !== undefined &&
      (supplied === undefined || supplied < minimum)
    ) {
      missing.push(key);
    }
  }
  return Object.freeze(missing);
}

export function assertRequiredModelCapabilities(
  available: ModelCapabilities,
  required: Partial<ModelCapabilities>,
): void {
  const missing = missingRequiredModelCapabilities(available, required);
  if (missing.length > 0) {
    throw new AcmeError({
      code: 'UNSUPPORTED_CAPABILITY',
      message: `Model selection does not satisfy required capabilities: ${missing.join(', ')}.`,
      stage: 'calling-model',
      retryable: false,
      details: { missing },
    });
  }
}
