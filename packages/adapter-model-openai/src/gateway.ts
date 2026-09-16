import {
  AcmeError,
  AmbiguousModelCallError,
  isJsonModelOutput,
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
} from '@acme-engine/core';

import { immutableJson } from './immutable.js';
import { buildResponsesBody } from './request.js';
import { parseSseFrames } from './sse.js';
import type {
  ProviderTransport,
  ProviderTransportResult,
  ProviderTransportStreamEvent,
} from './transport.js';
import {
  OPENAI_PROVIDER,
  OPENAI_RESPONSES_PATH,
  OpenAiErrorBodySchema,
  OpenAiResponseSchema,
  collectOutputText,
  collectToolCalls,
  hasRefusal,
  type OpenAiResponse,
} from './wire.js';

export { AmbiguousModelCallError };

export interface OpenAiModelProfile {
  readonly selection: ModelSelection;
  /** Provider model identifier sent on the wire. */
  readonly model: string;
  readonly capabilities: ModelCapabilities;
}

export interface OpenAiGatewayOptions {
  readonly transport: ProviderTransport;
  readonly profiles: readonly OpenAiModelProfile[];
  /** Injected so normalization stays deterministic under test. */
  readonly now: () => string;
  readonly baseUrl?: string;
  /**
   * Header factory. Credentials never reach this package's source; the
   * composition root supplies them, and no default reads the environment.
   */
  readonly headers?: () => Readonly<Record<string, string>>;
}

function selectionKey(selection: ModelSelection): string {
  return [
    selection.profile,
    selection.providerHint ?? '',
    selection.modelHint ?? '',
  ].join('\0');
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
    ...(details === undefined ? {} : { details: immutableJson(details) }),
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
    details: immutableJson(details),
  });
}

function classifyStatus(status: number, body: string): never {
  const parsed = OpenAiErrorBodySchema.safeParse(safeJson(body));
  const detail: JsonValue = {
    status,
    ...(parsed.success && parsed.data.error.message !== undefined
      ? { providerMessage: parsed.data.error.message }
      : {}),
  };

  if (status === 400 || status === 404 || status === 422) {
    fail(
      'INVALID_REQUEST',
      'The provider rejected the request.',
      false,
      detail,
    );
  }
  if (status === 401 || status === 403) {
    fail('MODEL_AUTH', 'The provider rejected the credentials.', false, detail);
  }
  if (status === 408) {
    fail('TIMEOUT', 'The provider reported a request timeout.', true, detail);
  }
  if (status === 429) {
    fail(
      'MODEL_RATE_LIMIT',
      'The provider rate limited the call.',
      true,
      detail,
    );
  }
  fail('MODEL_UNAVAILABLE', 'The provider was unavailable.', true, detail);
}

function safeJson(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}

function classifyNoResponse(
  result: Extract<ProviderTransportResult, { kind: 'no-response' }>,
): never {
  const code: AcmeErrorCode =
    result.reason === 'timeout' ? 'TIMEOUT' : 'MODEL_UNAVAILABLE';
  const detail: JsonValue = {
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
      detail,
    );
  }
  if (result.delivery === 'not-sent') {
    fail(code, 'The request never reached the provider.', true, detail);
  }
  failAmbiguous(
    code,
    'The provider may have executed this call; no response was received.',
    detail,
  );
}

function finishReason(
  status: string,
  incompleteReason: string | undefined,
  refused: boolean,
  toolCalls: readonly NormalizedToolCall[],
): NormalizedModelResponse['finishReason'] {
  if (refused) {
    return 'content-filter';
  }
  if (toolCalls.length > 0) {
    return 'tool';
  }
  if (status === 'completed') {
    return 'stop';
  }
  if (incompleteReason === 'max_output_tokens') {
    return 'length';
  }
  if (incompleteReason === 'content_filter') {
    return 'content-filter';
  }
  return 'unknown';
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

function normalizeResponse(
  response: OpenAiResponse,
  receivedAt: string,
  providerWireSchemaHash: string | undefined,
  outputMode: 'json' | 'text',
): NormalizedModelResponse {
  const refused = hasRefusal(response);
  const text = collectOutputText(response);
  const rawCalls = collectToolCalls(response);
  const toolCalls = rawCalls.map((call) =>
    immutableJson({
      toolCallId: call.toolCallId,
      name: call.name,
      arguments: parseToolArguments(call.arguments, call.toolCallId),
    }),
  );
  const incompleteReason = response.incomplete_details?.reason;
  if (refused && text.length === 0 && toolCalls.length === 0) {
    fail(
      'MODEL_CONTENT_FILTER',
      'The provider refused to produce output for this request.',
      false,
      { providerResponseId: response.id },
    );
  }
  if (text.length === 0 && toolCalls.length === 0 && outputMode === 'json') {
    fail(
      'MODEL_INVALID_RESPONSE',
      'The provider returned no output text.',
      false,
      { providerResponseId: response.id, providerStatus: response.status },
    );
  }

  return immutableJson({
    provider: OPENAI_PROVIDER,
    model: response.model,
    providerResponseId: response.id,
    receivedAt,
    finishReason: finishReason(
      response.status,
      incompleteReason,
      refused,
      toolCalls,
    ),
    text,
    ...(toolCalls.length === 0 ? {} : { toolCalls }),
    usage: {
      ...(response.usage?.input_tokens === undefined
        ? {}
        : { inputTokens: response.usage.input_tokens }),
      ...(response.usage?.output_tokens === undefined
        ? {}
        : { outputTokens: response.usage.output_tokens }),
      ...(response.usage?.total_tokens === undefined
        ? {}
        : { totalTokens: response.usage.total_tokens }),
    },
    metadata: {
      providerStatus: response.status,
      ...(providerWireSchemaHash === undefined
        ? {}
        : { providerWireSchemaHash }),
      ...(incompleteReason === undefined ? {} : { incompleteReason }),
    },
  });
}

interface ToolCallAssembler {
  toolCallId?: string;
  name?: string;
  arguments: string;
}

class OpenAiResponsesGateway implements ModelGateway {
  readonly #transport: ProviderTransport;
  readonly #profiles = new Map<string, OpenAiModelProfile>();
  readonly #now: () => string;
  readonly #baseUrl: string;
  readonly #headers: () => Readonly<Record<string, string>>;

  constructor(options: OpenAiGatewayOptions) {
    this.#transport = options.transport;
    this.#now = options.now;
    this.#baseUrl = options.baseUrl ?? 'https://api.openai.com';
    this.#headers = options.headers ?? (() => ({}));
    for (const profile of options.profiles) {
      this.#profiles.set(selectionKey(profile.selection), profile);
    }
  }

  async capabilities(selection: ModelSelection): Promise<ModelCapabilities> {
    return immutableJson(this.#profile(selection).capabilities);
  }

  async generate(
    request: ModelRequest,
    context: GatewayCallContext,
  ): Promise<NormalizedModelResponse> {
    const profile = this.#profile(context.selection);
    this.#assertCapabilities(profile, context);
    if (context.signal.aborted) {
      fail('CANCELLED', 'The call was cancelled before dispatch.', false, {
        executionId: context.executionId,
        callKey: context.callKey,
      });
    }

    const built = buildResponsesBody(request, profile.model);
    const result = await this.#transport.send(
      this.#transportRequest(built.body, context),
    );

    if (result.kind === 'no-response') {
      classifyNoResponse(result);
    }
    if (result.status !== 200) {
      classifyStatus(result.status, result.body);
    }

    const parsed = OpenAiResponseSchema.safeParse(safeJson(result.body));
    if (!parsed.success) {
      fail(
        'MODEL_INVALID_RESPONSE',
        'The provider returned a body that is not a valid response object.',
        false,
        { status: result.status },
      );
    }
    const response = parsed.data;
    if (response.status === 'failed') {
      fail(
        'MODEL_UNAVAILABLE',
        'The provider reported a failed response.',
        true,
        {
          providerResponseId: response.id,
          ...(response.error?.code === null ||
          response.error?.code === undefined
            ? {}
            : { providerErrorCode: response.error.code }),
        },
      );
    }

    return normalizeResponse(
      response,
      this.#now(),
      built.providerWireSchemaHash,
      isJsonModelOutput(request.output) ? 'json' : 'text',
    );
  }

  async *stream(
    request: ModelRequest,
    context: GatewayCallContext,
  ): AsyncIterable<ModelStreamEvent> {
    const profile = this.#profile(context.selection);
    this.#assertCapabilities(profile, context);
    if (context.signal.aborted) {
      fail('CANCELLED', 'The call was cancelled before dispatch.', false, {
        executionId: context.executionId,
        callKey: context.callKey,
      });
    }
    const built = buildResponsesBody(request, profile.model);
    const body = immutableJson({
      ...(built.body as Record<string, JsonValue>),
      stream: true,
    });
    const events =
      this.#transport.stream === undefined
        ? this.#streamFromSend(this.#transportRequest(body, context))
        : this.#transport.stream(this.#transportRequest(body, context));

    let sequence = 0;
    let status: number | undefined;
    let buffer = '';
    let sawCompleted = false;
    let errorBody = '';
    const assemblers = new Map<number, ToolCallAssembler>();
    const emit = (event: ModelStreamEvent): ModelStreamEvent => {
      const numbered = immutableJson({ ...event, sequence });
      sequence += 1;
      return numbered;
    };

    for await (const event of events) {
      if (event.kind === 'no-response') {
        if (status === undefined) {
          classifyNoResponse(event);
        }
        fail(
          'MODEL_INVALID_RESPONSE',
          'The provider stream was truncated after a status line was received.',
          false,
          { status, reason: event.reason },
        );
      }
      if (event.kind === 'response-start') {
        status = event.status;
        continue;
      }
      if (event.kind === 'chunk') {
        if (status !== undefined && status !== 200) {
          errorBody += event.text;
          continue;
        }
        buffer += event.text;
        const parsed = parseSseFrames(buffer);
        buffer = parsed.rest;
        for (const frame of parsed.frames) {
          if (frame.data === '[DONE]') {
            continue;
          }
          const payload = safeJson(frame.data);
          if (payload === undefined || typeof payload !== 'object') {
            fail(
              'MODEL_INVALID_RESPONSE',
              'The provider stream contained a malformed SSE event.',
              false,
              { status: status ?? null },
            );
          }
          const type =
            typeof (payload as { type?: unknown }).type === 'string'
              ? (payload as { type: string }).type
              : frame.event;
          const emitted = this.#mapStreamPayload(
            type,
            payload as Record<string, unknown>,
            assemblers,
          );
          for (const mapped of emitted) {
            if (mapped.type === 'completed') {
              sawCompleted = true;
              const parsedResponse = OpenAiResponseSchema.safeParse(
                (payload as { response?: unknown }).response ?? payload,
              );
              if (!parsedResponse.success) {
                fail(
                  'MODEL_INVALID_RESPONSE',
                  'The provider stream completed without a valid response object.',
                  false,
                  { status: status ?? null },
                );
              }
              if (parsedResponse.data.status === 'failed') {
                fail(
                  'MODEL_UNAVAILABLE',
                  'The provider reported a failed response.',
                  true,
                  { providerResponseId: parsedResponse.data.id },
                );
              }
              yield emit({
                type: 'completed',
                sequence: 0,
                response: normalizeResponse(
                  parsedResponse.data,
                  this.#now(),
                  built.providerWireSchemaHash,
                  isJsonModelOutput(request.output) ? 'json' : 'text',
                ),
              });
              continue;
            }
            yield emit({ ...mapped, sequence: 0 });
          }
        }
        continue;
      }
      if (event.kind === 'response-end') {
        if (status !== undefined && status !== 200) {
          classifyStatus(status, errorBody);
        }
        if (!sawCompleted) {
          const buffered = OpenAiResponseSchema.safeParse(safeJson(buffer));
          if (buffered.success) {
            if (buffered.data.status === 'failed') {
              fail(
                'MODEL_UNAVAILABLE',
                'The provider reported a failed response.',
                true,
                { providerResponseId: buffered.data.id },
              );
            }
            const response = normalizeResponse(
              buffered.data,
              this.#now(),
              built.providerWireSchemaHash,
              isJsonModelOutput(request.output) ? 'json' : 'text',
            );
            if (response.text.length > 0) {
              yield emit({
                type: 'content-delta',
                sequence: 0,
                text: response.text,
              });
            }
            yield emit({
              type: 'completed',
              sequence: 0,
              response,
            });
            sawCompleted = true;
            continue;
          }
          fail(
            'MODEL_INVALID_RESPONSE',
            'The provider stream ended without a completed response; the stream was truncated.',
            false,
            { status: status ?? null },
          );
        }
      }
    }
  }

  #mapStreamPayload(
    type: string,
    payload: Record<string, unknown>,
    assemblers: Map<number, ToolCallAssembler>,
  ): readonly ModelStreamEvent[] {
    if (
      type === 'response.output_text.delta' ||
      type === 'response.content.delta'
    ) {
      const text =
        typeof payload.delta === 'string'
          ? payload.delta
          : typeof payload.text === 'string'
            ? payload.text
            : '';
      if (text.length === 0) {
        return [];
      }
      return [{ type: 'content-delta', sequence: 0, text }];
    }
    if (
      type === 'response.reasoning_summary_text.delta' ||
      type === 'response.reasoning_text.delta' ||
      type === 'response.reasoning.delta'
    ) {
      const text = typeof payload.delta === 'string' ? payload.delta : '';
      if (text.length === 0) {
        return [];
      }
      return [{ type: 'reasoning-delta', sequence: 0, text }];
    }
    if (type === 'response.output_item.added') {
      const item = payload.item;
      if (
        item !== null &&
        typeof item === 'object' &&
        (item as { type?: unknown }).type === 'function_call'
      ) {
        const index =
          typeof payload.output_index === 'number' ? payload.output_index : 0;
        const call = item as {
          call_id?: string;
          id?: string;
          name?: string;
        };
        const assembler = assemblers.get(index) ?? { arguments: '' };
        const toolCallId = call.call_id ?? call.id;
        if (toolCallId !== undefined) {
          assembler.toolCallId = toolCallId;
        }
        if (call.name !== undefined) {
          assembler.name = call.name;
        }
        assemblers.set(index, assembler);
        return [
          {
            type: 'tool-call-delta',
            sequence: 0,
            index,
            ...(assembler.toolCallId === undefined
              ? {}
              : { toolCallId: assembler.toolCallId }),
            ...(assembler.name === undefined ? {} : { name: assembler.name }),
          },
        ];
      }
      return [];
    }
    if (type === 'response.function_call_arguments.delta') {
      const index =
        typeof payload.output_index === 'number' ? payload.output_index : 0;
      const delta = typeof payload.delta === 'string' ? payload.delta : '';
      const assembler = assemblers.get(index) ?? { arguments: '' };
      assembler.arguments += delta;
      assemblers.set(index, assembler);
      if (delta.length === 0) {
        return [];
      }
      return [
        {
          type: 'tool-call-delta',
          sequence: 0,
          index,
          ...(assembler.toolCallId === undefined
            ? {}
            : { toolCallId: assembler.toolCallId }),
          ...(assembler.name === undefined ? {} : { name: assembler.name }),
          argumentsDelta: delta,
        },
      ];
    }
    if (type === 'response.completed' || type === 'response.incomplete') {
      return [
        {
          type: 'completed',
          sequence: 0,
          response: undefined as never,
        },
      ];
    }
    return [];
  }

  async *#streamFromSend(
    request: import('./transport.js').ProviderTransportRequest,
  ): AsyncIterable<ProviderTransportStreamEvent> {
    const result = await this.#transport.send(request);
    if (result.kind === 'no-response') {
      yield result;
      return;
    }
    yield {
      kind: 'response-start',
      status: result.status,
      headers: result.headers,
    };
    yield { kind: 'chunk', text: result.body };
    yield { kind: 'response-end' };
  }

  #transportRequest(
    body: JsonValue,
    context: GatewayCallContext,
  ): import('./transport.js').ProviderTransportRequest {
    return {
      method: 'POST',
      url: `${this.#baseUrl}${OPENAI_RESPONSES_PATH}`,
      headers: {
        'content-type': 'application/json',
        ...this.#headers(),
      },
      body: JSON.stringify(body),
      timeoutMs: context.timeoutMs,
      signal: context.signal,
    };
  }

  #profile(selection: ModelSelection): OpenAiModelProfile {
    const profile = this.#profiles.get(selectionKey(selection));
    if (profile === undefined) {
      fail(
        'INVALID_REQUEST',
        'No configured profile matches the selection.',
        false,
        {
          profile: selection.profile,
        },
      );
    }
    return profile;
  }

  #assertCapabilities(
    profile: OpenAiModelProfile,
    context: GatewayCallContext,
  ): void {
    for (const [name, required] of Object.entries(
      context.requiredCapabilities,
    )) {
      if (required === undefined) {
        continue;
      }
      const actual = (
        profile.capabilities as unknown as Record<string, unknown>
      )[name];
      let satisfied = false;
      if (typeof required === 'boolean') {
        satisfied = actual === true || required === false;
      } else if (typeof required === 'number' && typeof actual === 'number') {
        satisfied = actual >= required;
      }
      if (!satisfied) {
        fail(
          'UNSUPPORTED_CAPABILITY',
          `The configured model does not satisfy required capability ${name}.`,
          false,
          { capability: name },
        );
      }
    }
  }
}

export function createOpenAiResponsesGateway(
  options: OpenAiGatewayOptions,
): ModelGateway {
  return new OpenAiResponsesGateway(options);
}
