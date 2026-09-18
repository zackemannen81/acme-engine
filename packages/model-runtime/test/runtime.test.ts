import { describe, expect, it } from 'vitest';

import type {
  ProviderTransport,
  ProviderTransportRequest,
  ProviderTransportStreamEvent,
} from '@acme-engine/adapter-model-chat-completions';
import type { ModelStreamEvent } from '@acme-engine/core';

import { createAcmeModelRuntime } from '../src/index.js';

const now = '2026-09-16T12:00:00.000Z';

function chatSse(text: string): string {
  return (
    [
      `data: ${JSON.stringify({
        id: 'chatcmpl_embedded',
        model: 'nvidia/test-model',
        choices: [
          { index: 0, delta: { content: text }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 5 },
      })}`,
      'data: [DONE]',
    ].join('\n\n') + '\n\n'
  );
}

function transport(): ProviderTransport & {
  readonly sent: ProviderTransportRequest[];
} {
  const sent: ProviderTransportRequest[] = [];
  return {
    sent,
    async send(request) {
      sent.push(request);
      return {
        kind: 'response',
        status: 200,
        headers: {},
        body: JSON.stringify({
          id: 'chatcmpl_embedded',
          model: 'nvidia/test-model',
          choices: [
            { index: 0, message: { content: 'hello' }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 5 },
        }),
      };
    },
    async *stream(request): AsyncIterable<ProviderTransportStreamEvent> {
      sent.push(request);
      yield { kind: 'response-start', status: 200, headers: {} };
      yield { kind: 'chunk', text: chatSse('hello') };
      yield { kind: 'response-end' };
    },
  };
}

describe('embedded ACME model runtime', () => {
  it('executes a configured provider route without starting HTTP', async () => {
    const provider = transport();
    const runtime = createAcmeModelRuntime({
      now: () => now,
      ids: { next: (kind) => `${kind}-embedded-test` },
      chatCompletionsTransport: provider,
      config: {
        nvidia: {
          apiKey: 'test-api-key',
          profiles: [
            {
              selection: {
                profile: 'default',
                providerHint: 'nvidia',
                modelHint: 'test-model',
              },
              model: 'nvidia/test-model',
              controls: {
                temperature: true,
                maxOutputTokens: true,
              },
            },
          ],
        },
      },
    });
    const events: ModelStreamEvent[] = [];
    const result = await runtime.execute(
      {
        requestKey: 'embedded-request-1',
        model: {
          profile: 'default',
          providerHint: 'nvidia',
          modelHint: 'test-model',
        },
        request: {
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello' }],
            },
          ],
          output: { mode: 'text' },
          temperature: 0.2,
          maxOutputTokens: 128,
        },
      },
      {
        onEvent: (event) => {
          events.push(event);
        },
      },
    );

    expect(runtime.providers).toEqual(['nvidia']);
    expect(result.status).toBe('succeeded');
    if (result.status !== 'succeeded') {
      throw new Error(`expected success, received ${result.status}`);
    }
    expect(result.response.text).toBe('hello');
    expect(result.usage).toEqual({
      inputTokens: 4,
      outputTokens: 1,
      totalTokens: 5,
    });
    expect(events.map((event) => event.type)).toContain('content-delta');
    expect(events.at(-1)?.type).toBe('completed');
    expect(provider.sent).toHaveLength(1);
    expect(JSON.parse(provider.sent[0]?.body ?? '{}')).toMatchObject({
      model: 'nvidia/test-model',
      stream: true,
      max_tokens: 128,
    });
  });

  it('propagates a profile-specific output-token parameter to Chat Completions', async () => {
    const provider = transport();
    const runtime = createAcmeModelRuntime({
      now: () => now,
      ids: { next: (kind) => `${kind}-token-field-test` },
      chatCompletionsTransport: provider,
      config: {
        nvidia: {
          apiKey: 'test-api-key',
          profiles: [
            {
              selection: {
                profile: 'completion-token-field',
                providerHint: 'nvidia-completion-field',
                modelHint: 'test-model',
              },
              model: 'nvidia/test-model',
              controls: { maxOutputTokens: true },
              maxOutputTokensParameter: 'max_completion_tokens',
            },
          ],
        },
      },
    });

    const result = await runtime.execute({
      requestKey: 'embedded-token-field-request',
      model: {
        profile: 'completion-token-field',
        providerHint: 'nvidia-completion-field',
        modelHint: 'test-model',
      },
      request: {
        messages: [
          { role: 'user', content: [{ type: 'text', text: 'hello' }] },
        ],
        output: { mode: 'text' },
        maxOutputTokens: 128,
        stream: false,
      },
    });

    expect(result.status).toBe('succeeded');
    expect(provider.sent).toHaveLength(1);
    const body = JSON.parse(provider.sent[0]?.body ?? '{}') as Record<
      string,
      unknown
    >;
    expect(body.max_completion_tokens).toBe(128);
    expect(body).not.toHaveProperty('max_tokens');
  });

  it('honors explicit non-streaming intent with a JSON provider response', async () => {
    const provider = transport();
    const runtime = createAcmeModelRuntime({
      now: () => now,
      ids: { next: (kind) => `${kind}-non-stream-test` },
      chatCompletionsTransport: provider,
      config: {
        nvidia: {
          apiKey: 'test-api-key',
          profiles: [
            {
              selection: {
                profile: 'default',
                providerHint: 'nvidia',
                modelHint: 'test-model',
              },
              model: 'nvidia/test-model',
              controls: {
                temperature: true,
                maxOutputTokens: true,
              },
            },
          ],
        },
      },
    });

    const result = await runtime.execute({
      requestKey: 'embedded-non-stream-request',
      model: {
        profile: 'default',
        providerHint: 'nvidia',
        modelHint: 'test-model',
      },
      request: {
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'hello without SSE' }],
          },
        ],
        output: { mode: 'text' },
        temperature: 0,
        maxOutputTokens: 128,
        stream: false,
      },
    });

    expect(result.status).toBe('succeeded');
    if (result.status !== 'succeeded') {
      throw new Error(`expected success, received ${result.status}`);
    }
    expect(result.response.text).toBe('hello');
    expect(provider.sent).toHaveLength(1);
    expect(JSON.parse(provider.sent[0]?.body ?? '{}')).toMatchObject({
      model: 'nvidia/test-model',
      stream: false,
    });
  });
});
