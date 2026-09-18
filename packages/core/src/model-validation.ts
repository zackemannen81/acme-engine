import type { JsonValue } from './common.js';
import { AcmeError, type AcmeErrorData } from './errors.js';
import { canonicalJson } from './hashing.js';
import type {
  GatewayCallContext,
  ModelCapabilities,
  ModelContentPart,
  ModelFunctionTool,
  ModelMessage,
  ModelOutputSpec,
  ModelRequest,
  ModelSelection,
  ModelStreamEvent,
  NormalizedModelResponse,
  NormalizedToolCall,
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
  'enableThinking',
  'maxOutputTokens',
  'messages',
  'output',
  'reasoningBudget',
  'reasoningEffort',
  'seed',
  'stop',
  'stream',
  'temperature',
  'tools',
  'topP',
] as const;
const responseKeys = [
  'finishReason',
  'metadata',
  'model',
  'provider',
  'providerResponseId',
  'receivedAt',
  'text',
  'toolCalls',
  'usage',
] as const;
const toolDefinitionKeys = [
  'description',
  'name',
  'parameters',
  'type',
] as const;
const toolCallKeys = ['arguments', 'name', 'toolCallId'] as const;
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

function nonEmptyString(value: JsonValue | undefined, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
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
  if (type === 'tool-call') {
    exactKeys(
      candidate,
      ['arguments', 'name', 'toolCallId', 'type'],
      ['arguments', 'name', 'toolCallId', 'type'],
      label,
    );
    return deepFreeze({
      type,
      toolCallId: text(candidate.toolCallId, `${label} toolCallId`),
      name: text(candidate.name, `${label} name`),
      arguments: candidate.arguments as JsonValue,
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

function validateOutput(value: JsonValue): ModelOutputSpec {
  const output = object(value, 'Model request output');
  if (output.mode === 'text') {
    exactKeys(output, ['mode'], ['mode'], 'Model request output');
    return deepFreeze({ mode: 'text' as const });
  }
  exactKeys(
    output,
    ['jsonSchema', 'mode', 'schemaName'],
    ['jsonSchema', 'mode', 'schemaName'],
    'Model request output',
  );
  if (output.mode !== 'json') {
    invalid('Model request output mode must be "json" or "text".');
  }
  object(output.jsonSchema, 'Model request output jsonSchema');
  return deepFreeze({
    mode: 'json' as const,
    schemaName: text(output.schemaName, 'Model request output schemaName'),
    jsonSchema: output.jsonSchema as JsonValue,
  });
}

function validateTool(value: JsonValue, index: number): ModelFunctionTool {
  const label = `Model request tool ${index}`;
  const candidate = object(value, label);
  exactKeys(
    candidate,
    toolDefinitionKeys,
    ['name', 'parameters', 'type'],
    label,
  );
  if (candidate.type !== 'function') {
    invalid(`${label} type must be "function".`);
  }
  object(candidate.parameters, `${label} parameters`);
  return deepFreeze({
    type: 'function' as const,
    name: text(candidate.name, `${label} name`),
    ...(Object.hasOwn(candidate, 'description')
      ? { description: text(candidate.description, `${label} description`) }
      : {}),
    parameters: candidate.parameters as JsonValue,
  });
}

function validateRequestValue(value: JsonObject): ModelRequest {
  exactKeys(value, requestKeys, ['messages', 'output'], 'Model request');
  if (!Array.isArray(value.messages) || value.messages.length === 0) {
    invalid('Model request messages must be a non-empty array.');
  }

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

  let topP: number | undefined;
  if (Object.hasOwn(value, 'topP')) {
    if (
      typeof value.topP !== 'number' ||
      !Number.isFinite(value.topP) ||
      value.topP < 0 ||
      value.topP > 1
    ) {
      invalid('Model request topP must be a finite number from 0 to 1.');
    }
    topP = value.topP;
  }

  let reasoningBudget: number | undefined;
  if (Object.hasOwn(value, 'reasoningBudget')) {
    if (
      !Number.isSafeInteger(value.reasoningBudget) ||
      (value.reasoningBudget as number) < -1
    ) {
      invalid(
        'Model request reasoningBudget must be a safe integer greater than or equal to -1.',
      );
    }
    reasoningBudget = value.reasoningBudget as number;
  }

  let enableThinking: boolean | undefined;
  if (Object.hasOwn(value, 'enableThinking')) {
    if (typeof value.enableThinking !== 'boolean') {
      invalid('Model request enableThinking must be a boolean.');
    }
    enableThinking = value.enableThinking;
  }

  let reasoningEffort: string | undefined;
  if (Object.hasOwn(value, 'reasoningEffort')) {
    reasoningEffort = text(
      value.reasoningEffort,
      'Model request reasoningEffort',
    );
  }

  let seed: number | undefined;
  if (Object.hasOwn(value, 'seed')) {
    seed = nonNegativeInteger(value.seed, 'Model request seed');
  }

  let stream: boolean | undefined;
  if (Object.hasOwn(value, 'stream')) {
    stream = boolean(value.stream, 'Model request stream');
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

  let tools: readonly ModelFunctionTool[] | undefined;
  if (Object.hasOwn(value, 'tools')) {
    if (!Array.isArray(value.tools) || value.tools.length === 0) {
      invalid('Model request tools must be a non-empty array.');
    }
    tools = value.tools.map((tool, index) => validateTool(tool, index));
  }

  return deepFreeze({
    messages: value.messages.map((message, index) =>
      validateMessage(message, index),
    ),
    output: validateOutput(value.output as JsonValue),
    ...(tools === undefined ? {} : { tools }),
    ...(temperature === undefined ? {} : { temperature }),
    ...(topP === undefined ? {} : { topP }),
    ...(Object.hasOwn(value, 'maxOutputTokens')
      ? {
          maxOutputTokens: positiveInteger(
            value.maxOutputTokens,
            'Model request maxOutputTokens',
          ),
        }
      : {}),
    ...(stop === undefined ? {} : { stop }),
    ...(reasoningBudget === undefined ? {} : { reasoningBudget }),
    ...(enableThinking === undefined ? {} : { enableThinking }),
    ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
    ...(seed === undefined ? {} : { seed }),
    ...(stream === undefined ? {} : { stream }),
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

function validateToolCall(value: JsonValue, index: number): NormalizedToolCall {
  const label = `Normalized model response toolCall ${index}`;
  const candidate = object(value, label);
  exactKeys(candidate, toolCallKeys, toolCallKeys, label);
  return deepFreeze({
    toolCallId: text(candidate.toolCallId, `${label} toolCallId`),
    name: text(candidate.name, `${label} name`),
    arguments: candidate.arguments as JsonValue,
  });
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
  let toolCalls: readonly NormalizedToolCall[] | undefined;
  if (Object.hasOwn(value, 'toolCalls')) {
    if (!Array.isArray(value.toolCalls) || value.toolCalls.length === 0) {
      invalid('Normalized model response toolCalls must be a non-empty array.');
    }
    toolCalls = value.toolCalls.map((call, index) =>
      validateToolCall(call, index),
    );
  }
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
    ...(toolCalls === undefined ? {} : { toolCalls }),
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

function validateStreamEventValue(value: JsonObject): ModelStreamEvent {
  const type = value.type;
  const sequence = nonNegativeInteger(
    value.sequence,
    'Model stream event sequence',
  );
  if (type === 'reasoning-delta' || type === 'content-delta') {
    exactKeys(
      value,
      ['sequence', 'text', 'type'],
      ['sequence', 'text', 'type'],
      'Model stream event',
    );
    if (typeof value.text !== 'string') {
      invalid('Model stream event text must be a string.');
    }
    return deepFreeze({ type, sequence, text: value.text });
  }
  if (type === 'tool-call-delta') {
    exactKeys(
      value,
      ['argumentsDelta', 'index', 'name', 'sequence', 'toolCallId', 'type'],
      ['index', 'sequence', 'type'],
      'Model stream event',
    );
    return deepFreeze({
      type,
      sequence,
      index: nonNegativeInteger(value.index, 'Model stream event index'),
      ...(Object.hasOwn(value, 'toolCallId')
        ? {
            toolCallId: text(value.toolCallId, 'Model stream event toolCallId'),
          }
        : {}),
      ...(Object.hasOwn(value, 'name')
        ? { name: text(value.name, 'Model stream event name') }
        : {}),
      ...(Object.hasOwn(value, 'argumentsDelta')
        ? {
            argumentsDelta: nonEmptyString(
              value.argumentsDelta,
              'Model stream event argumentsDelta',
            ),
          }
        : {}),
    });
  }
  if (type === 'completed') {
    exactKeys(
      value,
      ['response', 'sequence', 'type'],
      ['response', 'sequence', 'type'],
      'Model stream event',
    );
    return deepFreeze({
      type,
      sequence,
      response: validateResponseValue(
        object(value.response, 'Model stream event response'),
      ),
    });
  }
  if (type === 'failed') {
    exactKeys(
      value,
      ['error', 'sequence', 'type'],
      ['error', 'sequence', 'type'],
      'Model stream event',
    );
    const error = object(value.error, 'Model stream event error');
    exactKeys(
      error,
      ['causeRef', 'code', 'details', 'message', 'retryable', 'stage'],
      ['code', 'message', 'retryable', 'stage'],
      'Model stream event error',
    );
    if (typeof error.code !== 'string' || typeof error.message !== 'string') {
      invalid('Model stream event error is invalid.');
    }
    if (
      typeof error.stage !== 'string' ||
      typeof error.retryable !== 'boolean'
    ) {
      invalid('Model stream event error is invalid.');
    }
    return deepFreeze({
      type,
      sequence,
      error: deepFreeze({
        code: error.code as AcmeErrorData['code'],
        message: error.message,
        stage: error.stage as AcmeErrorData['stage'],
        retryable: error.retryable,
        ...(Object.hasOwn(error, 'details')
          ? { details: error.details as JsonValue }
          : {}),
        ...(Object.hasOwn(error, 'causeRef')
          ? {
              causeRef: text(
                error.causeRef,
                'Model stream event error causeRef',
              ),
            }
          : {}),
      }),
    });
  }
  invalid('Model stream event type is invalid.');
}

export function validateModelStreamEvent(
  value: ModelStreamEvent,
): ModelStreamEvent {
  const cloned = cloneJson(value, 'Model stream event');
  return validateStreamEventValue(object(cloned, 'Model stream event'));
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
