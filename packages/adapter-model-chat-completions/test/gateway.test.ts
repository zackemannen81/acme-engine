import { AmbiguousModelCallError, type ModelRequest } from '@acme-engine/core';
import { describe, expect, it } from 'vitest';

import {
  buildChatCompletionsBody,
  createChatCompletionsGateway,
} from '../src/index.js';
import {
  callContext,
  completedResponseBody,
  errorBody,
  fixtureModel,
  fixtureNow,
  fixtureProfile,
  fixtureRequest,
  fixtureTransport,
  noResponse,
  ok,
  sseBody,
  status,
} from './fixtures.js';
import type { ProviderTransport } from '../src/transport.js';

function gateway(transport: ProviderTransport) {
  return createChatCompletionsGateway({
    transport,
    now: () => fixtureNow,
    profiles: [fixtureProfile],
  });
}

const toolRequest: ModelRequest = Object.freeze({
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

describe('Chat Completions request mapping', () => {
  it('maps A008 generation controls onto the Chat Completions body', () => {
    const body = buildChatCompletionsBody(
      {
        ...fixtureRequest,
        enableThinking: true,
        reasoningBudget: 2048,
        reasoningEffort: 'high',
        stop: ['END'],
      },
      fixtureProfile,
      false,
    );
    expect(body).toEqual({
      model: fixtureModel,
      messages: [{ role: 'user', content: 'Say hello.' }],
      stream: false,
      temperature: 0.2,
      top_p: 0.9,
      max_tokens: 1024,
      stop: ['END'],
      reasoning_budget: 2048,
      reasoning_effort: 'high',
      seed: 7,
      chat_template_kwargs: { enable_thinking: true },
    });
  });

  it('can map output budget to max_completion_tokens for profiles that require it', () => {
    const body = buildChatCompletionsBody(
      fixtureRequest,
      {
        ...fixtureProfile,
        maxOutputTokensParameter: 'max_completion_tokens',
      },
      false,
    );
    expect(body.max_completion_tokens).toBe(1024);
    expect(body).not.toHaveProperty('max_tokens');
  });

  it('maps ordered user text and image parts to Chat Completions multimodal content', () => {
    const body = buildChatCompletionsBody(
      {
        ...fixtureRequest,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is shown?' },
              {
                type: 'image',
                mediaType: 'image/png',
                dataRef: 'data:image/png;base64,AAAA',
              },
              { type: 'text', text: 'Be concise.' },
            ],
          },
        ],
      },
      fixtureProfile,
      false,
    );
    expect(body.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is shown?' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,AAAA' },
          },
          { type: 'text', text: 'Be concise.' },
        ],
      },
    ]);
  });

  it('keeps text-only user content as the existing plain string wire shape', () => {
    const body = buildChatCompletionsBody(
      fixtureRequest,
      fixtureProfile,
      false,
    );
    expect(body.messages).toEqual([{ role: 'user', content: 'Say hello.' }]);
  });

  it('rejects an empty image data reference before provider dispatch', () => {
    expect(() =>
      buildChatCompletionsBody(
        {
          ...fixtureRequest,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Inspect this.' },
                { type: 'image', mediaType: 'image/png', dataRef: '   ' },
              ],
            },
          ],
        },
        fixtureProfile,
        false,
      ),
    ).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'INVALID_REQUEST' }),
      }),
    );
  });

  it('maps thinking template mode thinking rather than enable_thinking', () => {
    const body = buildChatCompletionsBody(
      { ...fixtureRequest, enableThinking: true },
      {
        ...fixtureProfile,
        controls: { ...fixtureProfile.controls, enableThinking: 'thinking' },
      },
      false,
    );
    expect(body.chat_template_kwargs).toEqual({ thinking: true });
  });

  it('maps function tools and tool-result continuation', () => {
    const continued: ModelRequest = {
      ...toolRequest,
      messages: [
        ...toolRequest.messages,
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call_1',
              name: 'get_weather',
              arguments: { city: 'Paris' },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_1',
              value: { celsius: 18 },
            },
          ],
        },
      ],
    };
    const body = buildChatCompletionsBody(continued, fixtureProfile, false);
    expect(body.tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'get_weather',
          parameters: toolRequest.tools?.[0]?.parameters,
        },
      },
    ]);
    expect(body.messages).toEqual([
      { role: 'user', content: 'Weather?' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{"city":"Paris"}',
            },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'call_1',
        content: '{"celsius":18}',
      },
    ]);
  });

  it('refuses JSON structured output rather than silently dropping it', () => {
    expect(() =>
      buildChatCompletionsBody(
        {
          messages: fixtureRequest.messages,
          output: {
            mode: 'json',
            schemaName: 'fixture',
            jsonSchema: { type: 'object' },
          },
        },
        fixtureProfile,
        false,
      ),
    ).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'UNSUPPORTED_CAPABILITY' }),
      }),
    );
  });

  it('refuses supplied controls the profile cannot honor', async () => {
    const transport = fixtureTransport(ok(completedResponseBody));
    const subject = createChatCompletionsGateway({
      transport,
      now: () => fixtureNow,
      profiles: [
        {
          ...fixtureProfile,
          controls: { temperature: true, maxOutputTokens: true },
        },
      ],
    });
    await expect(
      subject.generate({ ...fixtureRequest, topP: 0.5 }, callContext()),
    ).rejects.toMatchObject({
      data: { code: 'UNSUPPORTED_CAPABILITY', details: { control: 'topP' } },
    });
    expect(transport.sent).toHaveLength(0);
  });
});

describe('Chat Completions normalization', () => {
  it('normalizes a completed chat response exactly', async () => {
    const transport = fixtureTransport(ok(completedResponseBody));
    const response = await gateway(transport).generate(
      fixtureRequest,
      callContext(),
    );
    expect(response).toEqual({
      provider: 'nvidia',
      model: fixtureModel,
      providerResponseId: 'chatcmpl_fixture_001',
      receivedAt: fixtureNow,
      finishReason: 'stop',
      text: 'Hello',
      usage: { inputTokens: 8, outputTokens: 1, totalTokens: 9 },
      metadata: { providerFinishReason: 'stop' },
    });
    expect(Object.isFrozen(response)).toBe(true);
    expect(JSON.parse(transport.sent[0]?.body ?? '{}')).toMatchObject({
      model: fixtureModel,
      stream: false,
      top_p: 0.9,
      seed: 7,
    });
  });

  it('normalizes a tool call without executing it', async () => {
    const body = JSON.stringify({
      id: 'chatcmpl_tool_001',
      model: fixtureModel,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'get_weather',
                  arguments: '{"city":"Paris"}',
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 6, total_tokens: 16 },
    });
    const response = await gateway(fixtureTransport(ok(body))).generate(
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
});

describe('Chat Completions failure classification', () => {
  it.each([
    [400, 'INVALID_REQUEST', false],
    [401, 'MODEL_AUTH', false],
    [403, 'MODEL_AUTH', false],
    [408, 'TIMEOUT', true],
    [429, 'MODEL_RATE_LIMIT', true],
    [500, 'MODEL_UNAVAILABLE', true],
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

  it('treats unknown delivery as ambiguous', async () => {
    const call = gateway(
      fixtureTransport(noResponse('timeout', 'unknown')),
    ).generate(fixtureRequest, callContext());
    await expect(call).rejects.toBeInstanceOf(AmbiguousModelCallError);
    await expect(call).rejects.toMatchObject({
      data: { code: 'TIMEOUT', details: { delivery: 'unknown' } },
    });
  });

  it('treats proven non-delivery as cancelled when aborted before send', async () => {
    await expect(
      gateway(fixtureTransport(noResponse('aborted', 'not-sent'))).generate(
        fixtureRequest,
        callContext(),
      ),
    ).rejects.toMatchObject({ data: { code: 'CANCELLED' } });
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
});

async function drainStream(
  subject: ReturnType<typeof gateway>,
  request: ModelRequest,
  context = callContext(),
) {
  if (subject.stream === undefined) {
    throw new Error('Expected Chat Completions gateway stream support.');
  }
  const events = [];
  for await (const event of subject.stream(request, context)) {
    events.push(event);
  }
  return events;
}

describe('Chat Completions SSE', () => {
  it('preserves timeout classification after a successful response start', async () => {
    const transport: ProviderTransport = {
      async send() {
        return ok(completedResponseBody);
      },
      async *stream() {
        yield { kind: 'response-start' as const, status: 200, headers: {} };
        yield {
          kind: 'no-response' as const,
          reason: 'timeout' as const,
          delivery: 'unknown' as const,
        };
      },
    };
    await expect(
      drainStream(gateway(transport), fixtureRequest),
    ).rejects.toMatchObject({ data: { code: 'TIMEOUT' } });
  });

  it('keeps non-timeout interruption after a successful response start invalid', async () => {
    const transport: ProviderTransport = {
      async send() {
        return ok(completedResponseBody);
      },
      async *stream() {
        yield { kind: 'response-start' as const, status: 200, headers: {} };
        yield {
          kind: 'no-response' as const,
          reason: 'network' as const,
          delivery: 'unknown' as const,
        };
      },
    };
    await expect(
      drainStream(gateway(transport), fixtureRequest),
    ).rejects.toMatchObject({ data: { code: 'MODEL_INVALID_RESPONSE' } });
  });

  it('emits reasoning and content deltas then a completed response', async () => {
    const sse = sseBody([
      `data: ${JSON.stringify({ id: 'chatcmpl_s', model: fixtureModel, choices: [{ index: 0, delta: { reasoning_content: 'plan' } }] })}`,
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: 'Hel' } }] })}`,
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: 'lo' } }] })}`,
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 8, completion_tokens: 1, total_tokens: 9 } })}`,
      'data: [DONE]',
    ]);
    const transport = fixtureTransport(ok(sse));
    const events = await drainStream(gateway(transport), fixtureRequest);
    expect(events.map((event) => event.type)).toEqual([
      'reasoning-delta',
      'content-delta',
      'content-delta',
      'completed',
    ]);
    const terminal = events.at(-1);
    expect(terminal?.type).toBe('completed');
    if (terminal?.type === 'completed') {
      expect(terminal.response.text).toBe('Hello');
      expect(terminal.response.usage).toEqual({
        inputTokens: 8,
        outputTokens: 1,
        totalTokens: 9,
      });
    }
    expect(JSON.parse(transport.sent[0]?.body ?? '{}')).toMatchObject({
      stream: true,
      stream_options: { include_usage: true },
    });
  });

  it('assembles fragmented tool-call argument deltas', async () => {
    const sse = sseBody([
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '' } }] } }] })}`,
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '{"city":' } }] } }] })}`,
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '"Paris"}' } }] }, finish_reason: 'tool_calls' }] })}`,
      'data: [DONE]',
    ]);
    const events = await drainStream(
      gateway(fixtureTransport(ok(sse))),
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
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: 'Hel' } }] })}`,
    ]);
    await expect(
      drainStream(gateway(fixtureTransport(ok(sse))), fixtureRequest),
    ).rejects.toMatchObject({
      data: { code: 'MODEL_INVALID_RESPONSE' },
    });
    await expect(
      drainStream(gateway(fixtureTransport(ok(sse))), fixtureRequest),
    ).rejects.not.toBeInstanceOf(AmbiguousModelCallError);
  });

  it('keeps HTTP failures non-ambiguous on the stream path', async () => {
    await expect(
      drainStream(
        gateway(fixtureTransport(status(401, errorBody('nope')))),
        fixtureRequest,
      ),
    ).rejects.toMatchObject({
      data: { code: 'MODEL_AUTH', retryable: false },
    });
  });
});
