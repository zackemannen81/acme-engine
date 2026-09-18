import { canonicalJson, type ModelRequest } from '@acme-engine/core';
import { describe, expect, it } from 'vitest';

import {
  AmbiguousModelCallError,
  createOpenAiResponsesGateway,
  buildResponsesBody,
} from '../src/index.js';
import {
  callContext,
  completedResponseBody,
  errorBody,
  failedResponseBody,
  fixtureCapabilities,
  fixtureModel,
  fixtureNow,
  fixtureRequest,
  fixtureSelection,
  fixtureTransport,
  noResponse,
  ok,
  refusedResponseBody,
  sseBody,
  status,
  truncatedResponseBody,
  unknownItemResponseBody,
} from './fixtures.js';
import type { ProviderTransport } from '../src/transport.js';

function gateway(transport: ProviderTransport) {
  return createOpenAiResponsesGateway({
    transport,
    now: () => fixtureNow,
    profiles: [
      {
        selection: fixtureSelection,
        model: fixtureModel,
        capabilities: fixtureCapabilities,
      },
    ],
  });
}

describe('OpenAI Responses request mapping', () => {
  it('maps system messages to instructions and keeps supplied order', () => {
    const { body } = buildResponsesBody(fixtureRequest, fixtureModel);
    expect(body).toEqual({
      model: fixtureModel,
      instructions: 'Return only JSON.',
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: '{"documentKey":"a"}' }],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'fixture_output_1',
          schema:
            fixtureRequest.output.mode === 'json'
              ? fixtureRequest.output.jsonSchema
              : undefined,
          strict: true,
        },
      },
      temperature: 0,
      max_output_tokens: 2048,
    });
  });

  it('maps prior assistant text as output_text in multi-turn history', () => {
    const request: ModelRequest = {
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'First' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'Answer' }] },
        { role: 'user', content: [{ type: 'text', text: 'Second' }] },
      ],
      output: { mode: 'text' },
    };
    const { body } = buildResponsesBody(request, fixtureModel);
    expect((body as { input: readonly unknown[] }).input).toEqual([
      { role: 'user', content: [{ type: 'input_text', text: 'First' }] },
      { role: 'assistant', content: [{ type: 'output_text', text: 'Answer' }] },
      { role: 'user', content: [{ type: 'input_text', text: 'Second' }] },
    ]);
  });

  it('is deterministic for the same request', () => {
    expect(
      canonicalJson(buildResponsesBody(fixtureRequest, fixtureModel).body),
    ).toBe(
      canonicalJson(buildResponsesBody(fixtureRequest, fixtureModel).body),
    );
  });

  it('rejects stop sequences rather than silently dropping them', () => {
    expect(() =>
      buildResponsesBody({ ...fixtureRequest, stop: ['\n\n'] }, fixtureModel),
    ).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'INVALID_REQUEST' }),
      }),
    );
  });

  it('maps topP and reasoningEffort onto Responses fields', () => {
    const { body } = buildResponsesBody(
      { ...fixtureRequest, topP: 0.9, reasoningEffort: 'high' },
      fixtureModel,
    );
    expect(body).toMatchObject({
      top_p: 0.9,
      reasoning: { effort: 'high' },
    });
  });

  it.each(['seed', 'enableThinking', 'reasoningBudget'] as const)(
    'refuses %s rather than silently dropping it',
    (control) => {
      expect(() =>
        buildResponsesBody(
          {
            ...fixtureRequest,
            ...(control === 'seed'
              ? { seed: 7 }
              : control === 'enableThinking'
                ? { enableThinking: true }
                : { reasoningBudget: 256 }),
          },
          fixtureModel,
        ),
      ).toThrowError(
        expect.objectContaining({
          data: expect.objectContaining({
            code: 'UNSUPPORTED_CAPABILITY',
            message: expect.stringContaining(control),
          }),
        }),
      );
    },
  );

  it('maps user image content to Responses input_image', () => {
    const dataRef = 'data:image/png;base64,iVBORw0KGgo=';
    const { body } = buildResponsesBody(
      {
        ...fixtureRequest,
        messages: [
          {
            role: 'user',
            content: [{ type: 'image', mediaType: 'image/png', dataRef }],
          },
        ],
      },
      fixtureModel,
    );
    expect((body as { input: readonly unknown[] }).input).toEqual([
      {
        role: 'user',
        content: [{ type: 'input_image', image_url: dataRef }],
      },
    ]);
  });

  it('preserves mixed user text/image content order', () => {
    const first = 'data:image/png;base64,AAAA';
    const second = 'data:image/jpeg;base64,BBBB';
    const { body } = buildResponsesBody(
      {
        ...fixtureRequest,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'before' },
              { type: 'image', mediaType: 'image/png', dataRef: first },
              { type: 'text', text: 'between' },
              { type: 'image', mediaType: 'image/jpeg', dataRef: second },
            ],
          },
        ],
      },
      fixtureModel,
    );
    expect((body as { input: readonly unknown[] }).input).toEqual([
      {
        role: 'user',
        content: [
          { type: 'input_text', text: 'before' },
          { type: 'input_image', image_url: first },
          { type: 'input_text', text: 'between' },
          { type: 'input_image', image_url: second },
        ],
      },
    ]);
  });

  it('rejects an empty user image dataRef before transport', () => {
    expect(() =>
      buildResponsesBody(
        {
          ...fixtureRequest,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', mediaType: 'image/png', dataRef: '   ' },
              ],
            },
          ],
        },
        fixtureModel,
      ),
    ).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'INVALID_REQUEST',
          message: expect.stringContaining('non-empty dataRef'),
        }),
      }),
    );
  });

  it('continues to reject assistant image history', () => {
    expect(() =>
      buildResponsesBody(
        {
          ...fixtureRequest,
          messages: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'image',
                  mediaType: 'image/png',
                  dataRef: 'data:image/png;base64,AAAA',
                },
              ],
            },
          ],
        },
        fixtureModel,
      ),
    ).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'INVALID_REQUEST' }),
      }),
    );
  });

  it('refuses an unlowerable schema before any transport call', async () => {
    const transport = fixtureTransport(ok(completedResponseBody));
    const unlowerable = {
      ...fixtureRequest,
      output: {
        ...fixtureRequest.output,
        jsonSchema: {
          type: 'object',
          properties: {
            value: {
              oneOf: [{ type: 'string' }, { type: 'number' }],
            },
          },
          required: ['value'],
          additionalProperties: false,
        },
      },
    };

    await expect(
      gateway(transport).generate(unlowerable, callContext()),
    ).rejects.toMatchObject({
      data: {
        code: 'UNSUPPORTED_CAPABILITY',
        details: { construct: 'oneOf' },
      },
    });
    expect(transport.sent).toHaveLength(0);
  });
});

describe('OpenAI Responses normalization', () => {
  it('normalizes a completed response exactly', async () => {
    const transport = fixtureTransport(ok(completedResponseBody));
    const response = await gateway(transport).generate(
      fixtureRequest,
      callContext(),
    );

    const { providerWireSchemaHash } = buildResponsesBody(
      fixtureRequest,
      fixtureModel,
    );
    expect(response).toEqual({
      provider: 'openai',
      model: fixtureModel,
      providerResponseId: 'resp_fixture_001',
      receivedAt: fixtureNow,
      finishReason: 'stop',
      text: '{"ok":true}',
      usage: { inputTokens: 120, outputTokens: 8, totalTokens: 128 },
      metadata: {
        providerStatus: 'completed',
        providerWireSchemaHash,
      },
    });
    expect(Object.isFrozen(response)).toBe(true);
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]?.url).toBe('https://api.openai.com/v1/responses');
  });

  it('maps a truncated response to length and keeps the partial text', async () => {
    const response = await gateway(
      fixtureTransport(ok(truncatedResponseBody)),
    ).generate(fixtureRequest, callContext());

    const { providerWireSchemaHash } = buildResponsesBody(
      fixtureRequest,
      fixtureModel,
    );
    expect(response.finishReason).toBe('length');
    expect(response.text).toBe('{"ok":tr');
    expect(response.metadata).toEqual({
      providerStatus: 'incomplete',
      providerWireSchemaHash,
      incompleteReason: 'max_output_tokens',
    });
  });

  it('concatenates text parts in order and ignores unknown output items', async () => {
    const response = await gateway(
      fixtureTransport(ok(unknownItemResponseBody)),
    ).generate(fixtureRequest, callContext());

    expect(response.text).toBe('{"ok":true}');
    expect(response.finishReason).toBe('stop');
  });

  it('omits usage fields the provider did not report', async () => {
    const body = JSON.stringify({
      id: 'resp_fixture_006',
      model: fixtureModel,
      status: 'completed',
      output: [
        { type: 'message', content: [{ type: 'output_text', text: '{}' }] },
      ],
    });
    const response = await gateway(fixtureTransport(ok(body))).generate(
      fixtureRequest,
      callContext(),
    );
    expect(response.usage).toEqual({});
  });
});

describe('OpenAI Responses failure classification', () => {
  it.each([
    [400, 'INVALID_REQUEST', false],
    [404, 'INVALID_REQUEST', false],
    [422, 'INVALID_REQUEST', false],
    [401, 'MODEL_AUTH', false],
    [403, 'MODEL_AUTH', false],
    [408, 'TIMEOUT', true],
    [429, 'MODEL_RATE_LIMIT', true],
    [500, 'MODEL_UNAVAILABLE', true],
    [503, 'MODEL_UNAVAILABLE', true],
    [418, 'MODEL_UNAVAILABLE', true],
  ])(
    'classifies HTTP %i as %s without ambiguity',
    async (code, expected, retryable) => {
      const call = gateway(
        fixtureTransport(status(code, errorBody('nope'))),
      ).generate(fixtureRequest, callContext());

      await expect(call).rejects.toMatchObject({
        data: { code: expected, stage: 'calling-model', retryable },
      });
      await expect(call).rejects.not.toBeInstanceOf(AmbiguousModelCallError);
    },
  );

  it('classifies an unparsable body as an invalid response', async () => {
    await expect(
      gateway(fixtureTransport(ok('not json'))).generate(
        fixtureRequest,
        callContext(),
      ),
    ).rejects.toMatchObject({
      data: { code: 'MODEL_INVALID_RESPONSE', retryable: false },
    });
  });

  it('classifies a provider-reported failed response as unavailable', async () => {
    await expect(
      gateway(fixtureTransport(ok(failedResponseBody))).generate(
        fixtureRequest,
        callContext(),
      ),
    ).rejects.toMatchObject({
      data: { code: 'MODEL_UNAVAILABLE', retryable: true },
    });
  });

  it('classifies a refusal with no output as a content filter', async () => {
    await expect(
      gateway(fixtureTransport(ok(refusedResponseBody))).generate(
        fixtureRequest,
        callContext(),
      ),
    ).rejects.toMatchObject({
      data: { code: 'MODEL_CONTENT_FILTER', retryable: false },
    });
  });
});

describe('OpenAI Responses ambiguity', () => {
  it.each([
    ['timeout', 'sent', 'TIMEOUT'],
    ['timeout', 'unknown', 'TIMEOUT'],
    ['network', 'sent', 'MODEL_UNAVAILABLE'],
    ['network', 'unknown', 'MODEL_UNAVAILABLE'],
    ['aborted', 'unknown', 'MODEL_UNAVAILABLE'],
  ] as const)(
    'treats %s with delivery %s as ambiguous',
    async (reason, delivery, expected) => {
      const call = gateway(
        fixtureTransport(noResponse(reason, delivery)),
      ).generate(fixtureRequest, callContext());

      await expect(call).rejects.toBeInstanceOf(AmbiguousModelCallError);
      await expect(call).rejects.toMatchObject({
        ambiguous: true,
        data: { code: expected, details: { delivery } },
      });
    },
  );

  it('treats proven non-delivery as a clean failure', async () => {
    const call = gateway(
      fixtureTransport(noResponse('network', 'not-sent')),
    ).generate(fixtureRequest, callContext());

    await expect(call).rejects.not.toBeInstanceOf(AmbiguousModelCallError);
    await expect(call).rejects.toMatchObject({
      data: { code: 'MODEL_UNAVAILABLE', retryable: true },
    });
  });

  it('treats a cancellation that never left as cancelled, not ambiguous', async () => {
    const call = gateway(
      fixtureTransport(noResponse('aborted', 'not-sent')),
    ).generate(fixtureRequest, callContext());

    await expect(call).rejects.not.toBeInstanceOf(AmbiguousModelCallError);
    await expect(call).rejects.toMatchObject({ data: { code: 'CANCELLED' } });
  });
});

describe('OpenAI Responses gateway guards', () => {
  it('reports configured capabilities without touching the transport', async () => {
    const transport = fixtureTransport(ok(completedResponseBody));
    await expect(
      gateway(transport).capabilities(fixtureSelection),
    ).resolves.toEqual(fixtureCapabilities);
    expect(transport.sent).toEqual([]);
  });

  it('rejects an unsupported required capability before sending', async () => {
    const transport = fixtureTransport(ok(completedResponseBody));
    await expect(
      gateway(transport).generate(
        fixtureRequest,
        callContext({ requiredCapabilities: { tools: true } }),
      ),
    ).rejects.toMatchObject({ data: { code: 'UNSUPPORTED_CAPABILITY' } });
    expect(transport.sent).toEqual([]);
  });

  it('rejects pre-call cancellation before sending', async () => {
    const controller = new AbortController();
    controller.abort();
    const transport = fixtureTransport(ok(completedResponseBody));
    await expect(
      gateway(transport).generate(
        fixtureRequest,
        callContext({ signal: controller.signal }),
      ),
    ).rejects.toMatchObject({ data: { code: 'CANCELLED' } });
    expect(transport.sent).toEqual([]);
  });

  it('rejects an unconfigured selection', async () => {
    await expect(
      gateway(fixtureTransport(ok(completedResponseBody))).generate(
        fixtureRequest,
        callContext({ selection: { profile: 'missing' } }),
      ),
    ).rejects.toMatchObject({ data: { code: 'INVALID_REQUEST' } });
  });

  it('sends no credential unless the composition root supplies one', async () => {
    const transport = fixtureTransport(ok(completedResponseBody));
    await gateway(transport).generate(fixtureRequest, callContext());
    expect(transport.sent[0]?.headers).toEqual({
      'content-type': 'application/json',
    });
  });
});

const textRequest = Object.freeze({
  messages: Object.freeze([
    Object.freeze({
      role: 'user' as const,
      content: Object.freeze([
        Object.freeze({ type: 'text' as const, text: 'Say hello.' }),
      ]),
    }),
  ]),
  output: Object.freeze({ mode: 'text' as const }),
});

const textBody = JSON.stringify({
  id: 'resp_text_001',
  model: fixtureModel,
  status: 'completed',
  output: [
    {
      type: 'message',
      content: [{ type: 'output_text', text: 'Hello' }],
    },
  ],
  usage: { input_tokens: 3, output_tokens: 1, total_tokens: 4 },
});

const toolRequest = Object.freeze({
  messages: Object.freeze([
    Object.freeze({
      role: 'user' as const,
      content: Object.freeze([
        Object.freeze({ type: 'text' as const, text: 'Weather?' }),
      ]),
    }),
  ]),
  output: Object.freeze({ mode: 'text' as const }),
  tools: Object.freeze([
    Object.freeze({
      type: 'function' as const,
      name: 'get_weather',
      parameters: Object.freeze({
        type: 'object',
        properties: Object.freeze({
          city: Object.freeze({ type: 'string' }),
        }),
        required: Object.freeze(['city']),
        additionalProperties: false,
      }),
    }),
  ]),
});

const toolBody = JSON.stringify({
  id: 'resp_tool_001',
  model: fixtureModel,
  status: 'completed',
  output: [
    {
      type: 'function_call',
      id: 'fc_1',
      call_id: 'call_1',
      name: 'get_weather',
      arguments: '{"city":"Paris"}',
    },
  ],
  usage: { input_tokens: 8, output_tokens: 6, total_tokens: 14 },
});

function toolsGateway(transport: ProviderTransport) {
  return createOpenAiResponsesGateway({
    transport,
    now: () => fixtureNow,
    profiles: [
      {
        selection: fixtureSelection,
        model: fixtureModel,
        capabilities: { ...fixtureCapabilities, tools: true },
      },
    ],
  });
}

describe('OpenAI Responses text and tools', () => {
  it('maps text output without a json schema', () => {
    const { body, providerWireSchemaHash } = buildResponsesBody(
      textRequest,
      fixtureModel,
    );
    expect(providerWireSchemaHash).toBeUndefined();
    expect(body).toMatchObject({
      model: fixtureModel,
      text: { format: { type: 'text' } },
    });
    expect(body).not.toHaveProperty('tools');
  });

  it('maps function tools and tool-result continuation', () => {
    const continued = {
      ...toolRequest,
      messages: [
        ...toolRequest.messages,
        {
          role: 'assistant' as const,
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: 'call_1',
              name: 'get_weather',
              arguments: { city: 'Paris' },
            },
          ],
        },
        {
          role: 'tool' as const,
          content: [
            {
              type: 'tool-result' as const,
              toolCallId: 'call_1',
              value: { celsius: 18 },
            },
          ],
        },
      ],
    };
    const { body } = buildResponsesBody(continued, fixtureModel);
    expect(body).toMatchObject({
      tools: [
        expect.objectContaining({
          type: 'function',
          name: 'get_weather',
          strict: true,
        }),
      ],
    });
    const input = (body as { input: readonly unknown[] }).input;
    expect(input).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'function_call',
          call_id: 'call_1',
          name: 'get_weather',
        }),
        expect.objectContaining({
          type: 'function_call_output',
          call_id: 'call_1',
        }),
      ]),
    );
  });

  it('normalizes a tool call without executing it', async () => {
    const response = await toolsGateway(
      fixtureTransport(ok(toolBody)),
    ).generate(
      toolRequest,
      callContext({ requiredCapabilities: { tools: true } }),
    );
    expect(response.finishReason).toBe('tool');
    expect(response.toolCalls).toEqual([
      {
        toolCallId: 'call_1',
        name: 'get_weather',
        arguments: { city: 'Paris' },
      },
    ]);
  });

  it('rejects malformed tool-call arguments instead of guessing', async () => {
    const body = JSON.stringify({
      id: 'resp_tool_bad',
      model: fixtureModel,
      status: 'completed',
      output: [
        {
          type: 'function_call',
          call_id: 'call_1',
          name: 'get_weather',
          arguments: '{',
        },
      ],
    });
    await expect(
      toolsGateway(fixtureTransport(ok(body))).generate(
        toolRequest,
        callContext({ requiredCapabilities: { tools: true } }),
      ),
    ).rejects.toMatchObject({
      data: { code: 'MODEL_INVALID_RESPONSE' },
    });
  });
});

async function drainStream(
  subject: ReturnType<typeof gateway>,
  request: ModelRequest,
  context = callContext({ requiredCapabilities: {} }),
) {
  if (subject.stream === undefined) {
    throw new Error('Expected OpenAI gateway stream support.');
  }
  const events = [];
  for await (const event of subject.stream(request, context)) {
    events.push(event);
  }
  return events;
}

describe('OpenAI Responses SSE', () => {
  it('emits ordered content deltas and a completed response', async () => {
    const sse = sseBody([
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hel"}',
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"lo"}',
      `event: response.completed\ndata: ${JSON.stringify({ type: 'response.completed', response: JSON.parse(textBody) })}`,
    ]);
    const transport = fixtureTransport(ok(sse));
    const events = await drainStream(gateway(transport), textRequest);
    expect(events.map((event) => event.type)).toEqual([
      'content-delta',
      'content-delta',
      'completed',
    ]);
    const terminal = events.at(-1);
    expect(terminal?.type).toBe('completed');
    if (terminal?.type === 'completed') {
      expect(terminal.response.text).toBe('Hello');
    }
    expect(JSON.parse(transport.sent[0]?.body ?? '{}')).toMatchObject({
      stream: true,
    });
  });

  it('assembles fragmented tool-call argument deltas', async () => {
    const sse = sseBody([
      'event: response.output_item.added\ndata: {"type":"response.output_item.added","output_index":0,"item":{"type":"function_call","call_id":"call_1","name":"get_weather","arguments":""}}',
      'event: response.function_call_arguments.delta\ndata: {"type":"response.function_call_arguments.delta","output_index":0,"delta":"{\\"city\\":"}',
      'event: response.function_call_arguments.delta\ndata: {"type":"response.function_call_arguments.delta","output_index":0,"delta":"\\"Paris\\"}"}',
      `event: response.completed\ndata: ${JSON.stringify({ type: 'response.completed', response: JSON.parse(toolBody) })}`,
    ]);
    const events = await drainStream(
      toolsGateway(fixtureTransport(ok(sse))),
      toolRequest,
      callContext({ requiredCapabilities: { tools: true } }),
    );
    expect(events.some((event) => event.type === 'tool-call-delta')).toBe(true);
    const terminal = events.at(-1);
    expect(terminal?.type).toBe('completed');
    if (terminal?.type === 'completed') {
      expect(terminal.response.toolCalls?.[0]?.arguments).toEqual({
        city: 'Paris',
      });
    }
  });

  it('classifies a truncated stream after HTTP 200 as invalid, not ambiguous', async () => {
    const sse = sseBody([
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hel"}',
    ]);
    await expect(
      drainStream(gateway(fixtureTransport(ok(sse))), textRequest),
    ).rejects.toMatchObject({
      data: { code: 'MODEL_INVALID_RESPONSE' },
    });
    await expect(
      drainStream(gateway(fixtureTransport(ok(sse))), textRequest),
    ).rejects.not.toBeInstanceOf(AmbiguousModelCallError);
  });

  it('keeps HTTP failures non-ambiguous on the stream path', async () => {
    await expect(
      drainStream(
        gateway(fixtureTransport(status(401, errorBody('nope')))),
        textRequest,
      ),
    ).rejects.toMatchObject({
      data: { code: 'MODEL_AUTH', retryable: false },
    });
  });

  it('treats stream no-response with unknown delivery as ambiguous', async () => {
    await expect(
      drainStream(
        gateway(fixtureTransport(noResponse('timeout', 'unknown'))),
        textRequest,
      ),
    ).rejects.toBeInstanceOf(AmbiguousModelCallError);
  });
});
