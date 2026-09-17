import {
  AcmeError,
  AmbiguousModelCallError,
  assertRequiredModelCapabilities,
  validateGatewayCallContext,
  validateModelCapabilities,
  validateModelRequest,
  validateModelSelection,
  validateNormalizedModelResponse,
  type AcmeErrorCode,
  type GatewayCallContext,
  type JsonValue,
  type ModelCapabilities,
  type ModelGateway,
  type ModelRequest,
  type ModelSelection,
  type ModelStreamEvent,
  type NormalizedModelResponse,
  type NormalizedToolCall,
  type NormalizedUsage,
} from '@acme-engine/core';

import type {
  ProviderTransport,
  ProviderTransportResult,
} from './transport.js';
export type ThinkingTemplateMode = 'enable_thinking' | 'thinking';

export interface ChatCompletionsControls {
  readonly temperature?: boolean;
  readonly topP?: boolean;
  readonly maxOutputTokens?: boolean;
  readonly stop?: boolean;
  readonly reasoningBudget?: boolean;
  readonly enableThinking?: ThinkingTemplateMode | false;
  readonly reasoningEffort?: boolean;
  readonly seed?: boolean;
}

export interface ChatCompletionsModelProfile {
  readonly selection: ModelSelection;
  readonly provider: string;
  readonly model: string;
  readonly endpoint: string;
  readonly capabilities: ModelCapabilities;
  readonly controls?: ChatCompletionsControls;
  readonly headers?: () => Readonly<Record<string, string>>;
}

export interface ChatCompletionsGatewayOptions {
  readonly transport: ProviderTransport;
  readonly profiles: readonly ChatCompletionsModelProfile[];
  readonly now: () => string;
}

type JsonObject = Record<string, unknown>;
function selectionKey(selection: ModelSelection): string {
  return [
    selection.profile,
    selection.providerHint ?? '',
    selection.modelHint ?? '',
  ].join('\0');
}

function freezeJson(value: JsonValue): JsonValue {
  if (value !== null && typeof value === 'object') {
    if (Array.isArray(value)) {
      return Object.freeze(value.map((entry) => freezeJson(entry)));
    }
    const frozen: Record<string, JsonValue> = {};
    for (const [key, child] of Object.entries(value)) {
      frozen[key] = freezeJson(child);
    }
    return Object.freeze(frozen);
  }
  return value;
}

function fail(
  code: AcmeErrorCode,
  message: string,
  retryable: boolean,
  details?: JsonValue,
): never {
  throw new AcmeError({
    code,
    message,
    stage: 'calling-model',
    retryable,
    ...(details === undefined ? {} : { details: freezeJson(details) }),
  });
}

function failAmbiguous(
  code: AcmeErrorCode,
  message: string,
  details: JsonValue,
): never {
  throw new AmbiguousModelCallError({
    code,
    message,
    stage: 'calling-model',
    retryable: false,
    details: freezeJson(details),
  });
}

function record(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}
function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function boundedProviderMessage(raw: string): string | undefined {
  const parsed = record(safeJson(raw));
  const error = record(parsed?.error);
  const candidate = error?.message ?? parsed?.message ?? parsed?.msg;
  return typeof candidate === 'string' && candidate.trim().length > 0
    ? candidate.replace(/\s+/gu, ' ').trim().slice(0, 800)
    : undefined;
}

function classifyStatus(status: number, body: string): never {
  const providerMessage = boundedProviderMessage(body);
  const details: JsonValue = {
    status,
    ...(providerMessage === undefined ? {} : { providerMessage }),
  };
  if (status === 400 || status === 404 || status === 422) {
    fail(
      'INVALID_REQUEST',
      'The provider rejected the request.',
      false,
      details,
    );
  }
  if (status === 401 || status === 403) {
    fail(
      'MODEL_AUTH',
      'The provider rejected the credentials.',
      false,
      details,
    );
  }
  if (status === 408)
    fail('TIMEOUT', 'The provider reported a request timeout.', true, details);
  if (status === 429)
    fail(
      'MODEL_RATE_LIMIT',
      'The provider rate limited the call.',
      true,
      details,
    );
  fail('MODEL_UNAVAILABLE', 'The provider was unavailable.', true, details);
}

function classifyNoResponse(
  result: Extract<ProviderTransportResult, { kind: 'no-response' }>,
): never {
  const code: AcmeErrorCode =
    result.reason === 'timeout' ? 'TIMEOUT' : 'MODEL_UNAVAILABLE';
  const details: JsonValue = {
    reason: result.reason,
    delivery: result.delivery,
    ...(result.message === undefined
      ? {}
      : { transportMessage: result.message }),
  };
  if (result.reason === 'aborted' && result.delivery === 'not-sent') {
    fail(
      'CANCELLED',
      'The call was cancelled before it was sent.',
      false,
      details,
    );
  }
  if (result.delivery === 'not-sent')
    fail(code, 'The request never reached the provider.', true, details);
  failAmbiguous(
    code,
    'The provider may have executed this call; no response was received.',
    details,
  );
}
function requireControl(
  profile: ChatCompletionsModelProfile,
  key: keyof ChatCompletionsControls,
  supplied: boolean,
): void {
  if (supplied && !profile.controls?.[key]) {
    fail(
      'UNSUPPORTED_CAPABILITY',
      `The selected model cannot honor ${key}.`,
      false,
      {
        provider: profile.provider,
        model: profile.model,
        control: key,
      },
    );
  }
}

function validateControls(
  request: ModelRequest,
  profile: ChatCompletionsModelProfile,
): void {
  requireControl(profile, 'temperature', request.temperature !== undefined);
  requireControl(profile, 'topP', request.topP !== undefined);
  requireControl(
    profile,
    'maxOutputTokens',
    request.maxOutputTokens !== undefined,
  );
  requireControl(profile, 'stop', request.stop !== undefined);
  requireControl(
    profile,
    'reasoningBudget',
    request.reasoningBudget !== undefined,
  );
  requireControl(
    profile,
    'enableThinking',
    request.enableThinking !== undefined,
  );
  requireControl(
    profile,
    'reasoningEffort',
    request.reasoningEffort !== undefined,
  );
  requireControl(profile, 'seed', request.seed !== undefined);
}

function jsonString(value: JsonValue): string {
  return JSON.stringify(value);
}

function textContent(
  parts: ModelRequest['messages'][number]['content'],
  label: string,
): string {
  let text = '';
  for (const part of parts) {
    if (part.type !== 'text') {
      fail(
        'INVALID_REQUEST',
        `${label} contains a content part this provider surface cannot map.`,
        false,
        { partType: part.type },
      );
    }
    text += part.text;
  }
  return text;
}

function userContent(
  parts: ModelRequest['messages'][number]['content'],
  label: string,
): JsonValue {
  if (parts.every((part) => part.type === 'text')) {
    return textContent(parts, label);
  }
  const content: JsonValue[] = [];
  for (const part of parts) {
    if (part.type === 'text') {
      content.push({ type: 'text', text: part.text });
      continue;
    }
    if (part.type === 'image') {
      if (part.dataRef.trim().length === 0) {
        fail(
          'INVALID_REQUEST',
          `${label} contains an empty image dataRef.`,
          false,
        );
      }
      content.push({ type: 'image_url', image_url: { url: part.dataRef } });
      continue;
    }
    fail(
      'INVALID_REQUEST',
      `${label} contains a content part this provider surface cannot map.`,
      false,
      { partType: part.type },
    );
  }
  return content;
}
function wireMessages(request: ModelRequest): readonly JsonObject[] {
  const result: JsonObject[] = [];
  request.messages.forEach((message, messageIndex) => {
    if (message.role === 'tool') {
      for (const part of message.content) {
        if (part.type !== 'tool-result') {
          fail(
            'INVALID_REQUEST',
            'Tool messages may only contain tool-result parts.',
            false,
            {
              messageIndex,
              partType: part.type,
            },
          );
        }
        result.push({
          role: 'tool',
          tool_call_id: part.toolCallId,
          content: jsonString(part.value),
        });
      }
      return;
    }

    if (message.role !== 'assistant') {
      result.push({
        role: message.role,
        content:
          message.role === 'user'
            ? userContent(message.content, `Model message ${messageIndex}`)
            : textContent(message.content, `Model message ${messageIndex}`),
      });
      return;
    }

    const texts = message.content.filter((part) => part.type === 'text');
    const calls = message.content.filter((part) => part.type === 'tool-call');
    const unsupported = message.content.find(
      (part) => part.type !== 'text' && part.type !== 'tool-call',
    );
    if (unsupported !== undefined) {
      fail(
        'INVALID_REQUEST',
        'Assistant message contains an unsupported content part.',
        false,
        {
          messageIndex,
          partType: unsupported.type,
        },
      );
    }
    result.push({
      role: 'assistant',
      content:
        texts.length === 0
          ? null
          : texts
              .map((part) => (part.type === 'text' ? part.text : ''))
              .join(''),
      ...(calls.length === 0
        ? {}
        : {
            tool_calls: calls.map((part) =>
              part.type === 'tool-call'
                ? {
                    id: part.toolCallId,
                    type: 'function',
                    function: {
                      name: part.name,
                      arguments: jsonString(part.arguments),
                    },
                  }
                : undefined,
            ),
          }),
    });
  });
  return result;
}
export function buildChatCompletionsBody(
  request: ModelRequest,
  profile: ChatCompletionsModelProfile,
  stream: boolean,
): JsonObject {
  if (request.output.mode !== 'text') {
    fail(
      'UNSUPPORTED_CAPABILITY',
      'This Chat Completions profile does not expose ACME structured output.',
      false,
      {
        provider: profile.provider,
        model: profile.model,
      },
    );
  }
  validateControls(request, profile);
  const body: JsonObject = {
    model: profile.model,
    messages: wireMessages(request),
    stream,
  };
  if (request.tools !== undefined) {
    body.tools = request.tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        ...(tool.description === undefined
          ? {}
          : { description: tool.description }),
        parameters: tool.parameters,
      },
    }));
    body.tool_choice = 'auto';
  }
  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (request.topP !== undefined) body.top_p = request.topP;
  if (request.maxOutputTokens !== undefined) {
    body.max_tokens = request.maxOutputTokens;
  }
  if (request.stop !== undefined) body.stop = [...request.stop];
  if (request.reasoningBudget !== undefined) {
    body.reasoning_budget = request.reasoningBudget;
  }
  if (request.reasoningEffort !== undefined) {
    body.reasoning_effort = request.reasoningEffort;
  }
  if (request.seed !== undefined) body.seed = request.seed;
  if (request.enableThinking !== undefined) {
    const mode = profile.controls?.enableThinking;
    if (mode === 'enable_thinking') {
      body.chat_template_kwargs = { enable_thinking: request.enableThinking };
    } else if (mode === 'thinking') {
      body.chat_template_kwargs = { thinking: request.enableThinking };
    } else {
      fail(
        'UNSUPPORTED_CAPABILITY',
        'The selected model cannot honor enableThinking.',
        false,
        {
          provider: profile.provider,
          model: profile.model,
          control: 'enableThinking',
        },
      );
    }
  }
  if (stream) {
    body.stream_options = { include_usage: true };
  }
  return body;
}
function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function usageOf(value: unknown): NormalizedUsage {
  const root = record(value);
  const usage = record(root?.usage);
  if (usage === undefined) return {};
  const inputTokens = optionalNumber(usage.prompt_tokens);
  const outputTokens = optionalNumber(usage.completion_tokens);
  const totalTokens = optionalNumber(usage.total_tokens);
  return {
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
    ...(totalTokens === undefined ? {} : { totalTokens }),
  };
}

function parseToolArguments(raw: string, toolCallId: string): JsonValue {
  const parsed = safeJson(raw);
  if (parsed === undefined) {
    fail(
      'MODEL_INVALID_RESPONSE',
      'A tool call had malformed JSON arguments.',
      false,
      { toolCallId },
    );
  }
  return parsed as JsonValue;
}

function normalizedToolCalls(value: unknown): readonly NormalizedToolCall[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value))
    fail(
      'MODEL_INVALID_RESPONSE',
      'Provider tool_calls must be an array.',
      false,
    );
  const seen = new Set<string>();
  return value.map((item, index) => {
    const call = record(item);
    const fn = record(call?.function);
    const id = optionalString(call?.id);
    const name = optionalString(fn?.name);
    const args = optionalString(fn?.arguments);
    if (
      !id ||
      !name ||
      args === undefined ||
      call?.type !== 'function' ||
      seen.has(id)
    ) {
      fail(
        'MODEL_INVALID_RESPONSE',
        'Provider returned an invalid or duplicate tool call.',
        false,
        { index },
      );
    }
    seen.add(id);
    return { toolCallId: id, name, arguments: parseToolArguments(args, id) };
  });
}
function normalizedFinishReason(
  raw: unknown,
  calls: readonly NormalizedToolCall[],
): NormalizedModelResponse['finishReason'] {
  if (calls.length > 0 || raw === 'tool_calls' || raw === 'function_call')
    return 'tool';
  if (raw === 'stop') return 'stop';
  if (raw === 'length') return 'length';
  if (raw === 'content_filter') return 'content-filter';
  return 'unknown';
}

function normalizeBuffered(
  raw: string,
  profile: ChatCompletionsModelProfile,
  receivedAt: string,
): NormalizedModelResponse {
  const parsed = record(safeJson(raw));
  if (parsed === undefined) {
    fail(
      'MODEL_INVALID_RESPONSE',
      'The provider returned invalid JSON.',
      false,
    );
  }
  const choices = parsed.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    fail(
      'MODEL_INVALID_RESPONSE',
      'The provider returned no chat choice.',
      false,
    );
  }
  const choice = record(choices[0]);
  const message = record(choice?.message);
  if (choice === undefined || message === undefined) {
    fail(
      'MODEL_INVALID_RESPONSE',
      'The provider returned an invalid chat choice.',
      false,
    );
  }
  const text = message.content === null ? '' : optionalString(message.content);
  if (text === undefined) {
    fail(
      'MODEL_INVALID_RESPONSE',
      'The provider returned invalid assistant content.',
      false,
    );
  }
  const toolCalls = normalizedToolCalls(message.tool_calls);
  const responseId = optionalString(parsed.id);
  const response: NormalizedModelResponse = {
    provider: profile.provider,
    model: optionalString(parsed.model) ?? profile.model,
    ...(responseId === undefined ? {} : { providerResponseId: responseId }),
    receivedAt,
    finishReason: normalizedFinishReason(choice.finish_reason, toolCalls),
    text,
    ...(toolCalls.length === 0 ? {} : { toolCalls }),
    usage: usageOf(parsed),
    metadata: {
      providerFinishReason: optionalString(choice.finish_reason) ?? 'unknown',
    },
  };
  return validateNormalizedModelResponse(response);
}
class SseDecoder {
  #buffer = '';

  push(chunk: string): readonly string[] {
    this.#buffer += chunk;
    const frames: string[] = [];
    while (true) {
      const match = /\r?\n\r?\n/u.exec(this.#buffer);
      if (match === null || match.index === undefined) break;
      const frame = this.#buffer.slice(0, match.index);
      this.#buffer = this.#buffer.slice(match.index + match[0].length);
      const data = frame
        .split(/\r?\n/u)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).replace(/^ /u, ''))
        .join('\n');
      if (data.length > 0) frames.push(data);
    }
    return frames;
  }

  finish(): readonly string[] {
    const tail = this.#buffer.trim();
    this.#buffer = '';
    if (tail.length === 0) return [];
    const data = tail
      .split(/\r?\n/u)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /u, ''))
      .join('\n');
    return data.length === 0 ? [] : [data];
  }
}

interface ToolAssembler {
  id: string;
  name: string;
  arguments: string;
}
export class ChatCompletionsGateway implements ModelGateway {
  readonly #transport: ProviderTransport;
  readonly #profiles = new Map<string, ChatCompletionsModelProfile>();
  readonly #now: () => string;

  constructor(options: ChatCompletionsGatewayOptions) {
    this.#transport = options.transport;
    this.#now = options.now;
    for (const input of options.profiles) {
      const selection = validateModelSelection(input.selection);
      const capabilities = validateModelCapabilities(input.capabilities);
      if (
        input.provider.trim().length === 0 ||
        input.model.trim().length === 0 ||
        input.endpoint.trim().length === 0
      ) {
        throw new Error(
          'Chat Completions profiles require provider, model and endpoint.',
        );
      }
      const key = selectionKey(selection);
      if (this.#profiles.has(key))
        throw new Error(`Duplicate Chat Completions profile: ${key}`);
      this.#profiles.set(
        key,
        Object.freeze({ ...input, selection, capabilities }),
      );
    }
  }

  async capabilities(selection: ModelSelection): Promise<ModelCapabilities> {
    return validateModelCapabilities(this.#profile(selection).capabilities);
  }

  async generate(
    request: ModelRequest,
    context: GatewayCallContext,
  ): Promise<NormalizedModelResponse> {
    const validatedContext = validateGatewayCallContext(context);
    const profile = this.#profile(validatedContext.selection);
    const validatedRequest = validateModelRequest(request);
    assertRequiredModelCapabilities(
      profile.capabilities,
      validatedContext.requiredCapabilities,
    );
    if (validatedContext.signal.aborted) {
      fail('CANCELLED', 'The call was cancelled before dispatch.', false, {
        executionId: validatedContext.executionId,
        callKey: validatedContext.callKey,
      });
    }
    const result = await this.#transport.send(
      this.#transportRequest(
        profile,
        buildChatCompletionsBody(validatedRequest, profile, false),
        validatedContext,
      ),
    );
    if (result.kind === 'no-response') classifyNoResponse(result);
    if (result.status < 200 || result.status >= 300)
      classifyStatus(result.status, result.body);
    return normalizeBuffered(result.body, profile, this.#now());
  }
  async *stream(
    request: ModelRequest,
    context: GatewayCallContext,
  ): AsyncIterable<ModelStreamEvent> {
    const validatedContext = validateGatewayCallContext(context);
    const profile = this.#profile(validatedContext.selection);
    const validatedRequest = validateModelRequest(request);
    assertRequiredModelCapabilities(
      profile.capabilities,
      validatedContext.requiredCapabilities,
    );
    if (validatedContext.signal.aborted) {
      fail('CANCELLED', 'The call was cancelled before dispatch.', false, {
        executionId: validatedContext.executionId,
        callKey: validatedContext.callKey,
      });
    }
    if (this.#transport.stream === undefined) {
      fail(
        'UNSUPPORTED_CAPABILITY',
        'The configured transport cannot stream.',
        false,
      );
    }

    const decoder = new SseDecoder();
    const toolState = new Map<number, ToolAssembler>();
    let sequence = 0;
    let responseStarted = false;
    let responseStatus: number | undefined;
    let errorBody = '';
    let text = '';
    let finishReason: string | undefined;
    let usage: NormalizedUsage = {};
    let responseId: string | undefined;
    let responseModel = profile.model;
    let sawDone = false;

    const parseData = (data: string): ModelStreamEvent[] => {
      if (data.trim() === '[DONE]') {
        sawDone = true;
        return [];
      }
      const parsed = record(safeJson(data));
      if (parsed === undefined) {
        fail(
          'MODEL_INVALID_RESPONSE',
          'The provider emitted malformed streaming JSON.',
          false,
        );
      }
      responseId = optionalString(parsed.id) ?? responseId;
      responseModel = optionalString(parsed.model) ?? responseModel;
      if (parsed.usage !== undefined) usage = usageOf(parsed);
      const choices = parsed.choices;
      if (!Array.isArray(choices) || choices.length === 0) return [];
      const choice = record(choices[0]);
      if (choice === undefined) {
        fail(
          'MODEL_INVALID_RESPONSE',
          'The provider emitted an invalid streaming choice.',
          false,
        );
      }
      if (typeof choice.finish_reason === 'string')
        finishReason = choice.finish_reason;
      const delta = record(choice.delta);
      if (delta === undefined) return [];
      const emitted: ModelStreamEvent[] = [];
      const reasoning = optionalString(delta.reasoning_content);
      if (reasoning !== undefined && reasoning.length > 0) {
        emitted.push({
          type: 'reasoning-delta',
          sequence: sequence++,
          text: reasoning,
        });
      }
      const content = optionalString(delta.content);
      if (content !== undefined && content.length > 0) {
        text += content;
        emitted.push({
          type: 'content-delta',
          sequence: sequence++,
          text: content,
        });
      }
      if (delta.tool_calls !== undefined) {
        if (!Array.isArray(delta.tool_calls)) {
          fail(
            'MODEL_INVALID_RESPONSE',
            'Provider tool-call delta must be an array.',
            false,
          );
        }
        for (const rawCall of delta.tool_calls) {
          const call = record(rawCall);
          if (
            call === undefined ||
            !Number.isSafeInteger(call.index) ||
            Number(call.index) < 0
          ) {
            fail(
              'MODEL_INVALID_RESPONSE',
              'Provider tool-call delta has an invalid index.',
              false,
            );
          }
          const index = Number(call.index);
          const state = toolState.get(index) ?? {
            id: '',
            name: '',
            arguments: '',
          };
          const idPart = optionalString(call.id);
          const fn = record(call.function);
          const namePart = optionalString(fn?.name);
          const argsPart = optionalString(fn?.arguments);
          if (idPart !== undefined) state.id += idPart;
          if (namePart !== undefined) state.name += namePart;
          if (argsPart !== undefined) state.arguments += argsPart;
          toolState.set(index, state);
          if (
            (idPart?.length ?? 0) > 0 ||
            (namePart?.length ?? 0) > 0 ||
            (argsPart?.length ?? 0) > 0
          ) {
            emitted.push({
              type: 'tool-call-delta',
              sequence: sequence++,
              index,
              ...(idPart !== undefined && idPart.length > 0
                ? { toolCallId: idPart }
                : {}),
              ...(namePart !== undefined && namePart.length > 0
                ? { name: namePart }
                : {}),
              ...(argsPart !== undefined && argsPart.length > 0
                ? { argumentsDelta: argsPart }
                : {}),
            });
          }
        }
      }
      return emitted;
    };
    const transportStream = this.#transport.stream(
      this.#transportRequest(
        profile,
        buildChatCompletionsBody(validatedRequest, profile, true),
        validatedContext,
      ),
    );
    for await (const event of transportStream) {
      if (event.kind === 'response-start') {
        responseStarted = true;
        responseStatus = event.status;
        continue;
      }
      if (event.kind === 'no-response') {
        if (
          responseStarted &&
          responseStatus !== undefined &&
          responseStatus >= 200 &&
          responseStatus < 300
        ) {
          fail(
            'MODEL_INVALID_RESPONSE',
            'The provider stream ended after HTTP success without a complete terminal response.',
            false,
            {
              transportReason: event.reason,
            },
          );
        }
        classifyNoResponse(event);
      }
      if (event.kind === 'chunk') {
        if (
          responseStatus !== undefined &&
          (responseStatus < 200 || responseStatus >= 300)
        ) {
          errorBody += event.text;
          continue;
        }
        for (const data of decoder.push(event.text)) {
          for (const output of parseData(data)) yield output;
        }
        continue;
      }
      if (event.kind === 'response-end') {
        continue;
      }
    }

    if (!responseStarted || responseStatus === undefined) {
      failAmbiguous(
        'MODEL_UNAVAILABLE',
        'The provider stream ended without an HTTP status.',
        {
          delivery: 'unknown',
        },
      );
    }
    if (responseStatus < 200 || responseStatus >= 300)
      classifyStatus(responseStatus, errorBody);
    for (const data of decoder.finish()) {
      for (const output of parseData(data)) yield output;
    }
    if (!sawDone && finishReason === undefined) {
      fail(
        'MODEL_INVALID_RESPONSE',
        'The provider stream was truncated before a terminal finish reason.',
        false,
      );
    }

    const toolCalls: NormalizedToolCall[] = [];
    for (const [index, state] of [...toolState.entries()].sort(
      ([a], [b]) => a - b,
    )) {
      if (state.id.length === 0 || state.name.length === 0) {
        fail(
          'MODEL_INVALID_RESPONSE',
          'A streamed tool call was structurally incomplete.',
          false,
          { index },
        );
      }
      toolCalls.push({
        toolCallId: state.id,
        name: state.name,
        arguments: parseToolArguments(state.arguments, state.id),
      });
    }
    const response = validateNormalizedModelResponse({
      provider: profile.provider,
      model: responseModel,
      ...(responseId === undefined ? {} : { providerResponseId: responseId }),
      receivedAt: this.#now(),
      finishReason: normalizedFinishReason(finishReason, toolCalls),
      text,
      ...(toolCalls.length === 0 ? {} : { toolCalls }),
      usage,
      metadata: { providerFinishReason: finishReason ?? 'unknown' },
    });
    yield { type: 'completed', sequence, response };
  }

  #profile(selection: ModelSelection): ChatCompletionsModelProfile {
    const normalized = validateModelSelection(selection);
    const profile = this.#profiles.get(selectionKey(normalized));
    if (profile === undefined) {
      fail(
        'INVALID_REQUEST',
        'No configured Chat Completions profile matches the selection.',
        false,
        {
          selection: normalized as unknown as JsonValue,
        },
      );
    }
    return profile;
  }

  #transportRequest(
    profile: ChatCompletionsModelProfile,
    body: JsonObject,
    context: GatewayCallContext,
  ) {
    return {
      method: 'POST' as const,
      url: profile.endpoint,
      headers: {
        ...(profile.headers?.() ?? {}),
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      timeoutMs: context.timeoutMs,
      signal: context.signal,
    };
  }
}

export function createChatCompletionsGateway(
  options: ChatCompletionsGatewayOptions,
): ModelGateway {
  return new ChatCompletionsGateway(options);
}
