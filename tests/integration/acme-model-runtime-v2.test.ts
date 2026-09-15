import { describe, expect, it } from 'vitest';

import type {
  ProviderTransport as ChatTransport,
  ProviderTransportRequest,
  ProviderTransportResult,
  ProviderTransportStreamEvent,
} from '../../packages/adapter-model-chat-completions/src/index.js';
import type { ProviderTransport as OpenAiTransport } from '../../packages/adapter-model-openai/src/index.js';
import {
  NVIDIA_CHAT_COMPLETIONS_ENDPOINT,
  startAcmeModelRuntimeService,
} from '../../apps/cli/src/acme-model-runtime-service.js';
import {
  ACME_MODEL_RUNTIME_HEADER,
  ACME_MODEL_RUNTIME_V2_PROTOCOL_VERSION,
} from '../../apps/cli/src/acme-model-runtime-wire.js';

const now = '2026-09-15T12:00:00.000Z';
const bearerToken = 'model-runtime-test-bearer-token-012345';

const lunaRequest = {
  protocolVersion: ACME_MODEL_RUNTIME_V2_PROTOCOL_VERSION,
  requestKey: 'luna-1',
  model: {
    profile: 'default',
    providerHint: 'openai',
    modelHint: 'luna',
  },
  request: {
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'Hello Luna' }] },
    ],
    output: { mode: 'text' },
    temperature: 0.2,
    topP: 0.9,
    maxOutputTokens: 1024,
    reasoningEffort: 'high',
  },
};

const nemotronRequest = {
  protocolVersion: ACME_MODEL_RUNTIME_V2_PROTOCOL_VERSION,
  requestKey: 'nemotron-1',
  model: {
    profile: 'default',
    providerHint: 'nvidia',
    modelHint: 'nemotron',
  },
  request: {
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'Hello Nemotron' }] },
    ],
    output: { mode: 'text' },
    temperature: 0.6,
    topP: 0.95,
    maxOutputTokens: 2048,
    enableThinking: true,
    reasoningBudget: 4096,
    seed: 11,
  },
};

const kimiRequest = {
  protocolVersion: ACME_MODEL_RUNTIME_V2_PROTOCOL_VERSION,
  requestKey: 'kimi-1',
  model: {
    profile: 'default',
    providerHint: 'nvidia',
    modelHint: 'kimi',
  },
  request: {
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'Hello Kimi' }] },
    ],
    output: { mode: 'text' },
    temperature: 0.3,
    topP: 0.8,
    maxOutputTokens: 512,
    enableThinking: true,
    seed: 3,
  },
};

function openAiSse(): string {
  return [
    'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hi"}\n\n',
    'event: response.completed\ndata: {"type":"response.completed","response":{"id":"resp_luna","model":"gpt-fixture-luna","status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"Hi"}]}],"usage":{"input_tokens":3,"output_tokens":1,"total_tokens":4}}}\n\n',
  ].join('');
}

function chatSse(id: string, model: string, text: string): string {
  return (
    [
      `data: ${JSON.stringify({ id, model, choices: [{ index: 0, delta: { content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 5 } })}`,
      'data: [DONE]',
    ].join('\n\n') + '\n\n'
  );
}

function recordingTransport(
  respond: (request: ProviderTransportRequest) => ProviderTransportResult,
): ChatTransport &
  OpenAiTransport & { readonly sent: ProviderTransportRequest[] } {
  const sent: ProviderTransportRequest[] = [];
  const next = (request: ProviderTransportRequest): ProviderTransportResult => {
    sent.push(request);
    return respond(request);
  };
  return {
    sent,
    async send(request) {
      return next(request);
    },
    async *stream(request): AsyncIterable<ProviderTransportStreamEvent> {
      const result = next(request);
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
    },
  };
}

async function readSse(
  response: Response,
): Promise<readonly Record<string, unknown>[]> {
  const text = await response.text();
  return text
    .split('\n\n')
    .map((block) => {
      const line = block
        .split('\n')
        .find((entry) => entry.startsWith('data: '));
      return line === undefined ? undefined : line.slice(6);
    })
    .filter((line): line is string => line !== undefined && line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('acme-model-runtime/2 multi-provider composition', () => {
  it('routes Luna/OpenAI and Nemotron/Kimi NVIDIA selections with caller controls', async () => {
    const openAi = recordingTransport(() => ({
      kind: 'response',
      status: 200,
      headers: {},
      body: openAiSse(),
    }));
    const nvidia = recordingTransport((request) => ({
      kind: 'response',
      status: 200,
      headers: {},
      body: request.body.includes('kimi-k2')
        ? chatSse('chatcmpl_kimi', 'moonshotai/kimi-k2-instruct', 'Kimi')
        : chatSse('chatcmpl_nemo', 'nvidia/llama-fixture', 'Nemotron'),
    }));

    const service = await startAcmeModelRuntimeService({
      now: () => now,
      openAiTransport: openAi,
      chatCompletionsTransport: nvidia,
      config: {
        hostname: '127.0.0.1',
        port: 0,
        bearerToken,
        engineBuild: 'model-runtime-v2-test',
        openAi: {
          apiKey: 'openai-test-key-should-not-leak',
          profiles: [
            {
              selection: {
                profile: 'default',
                providerHint: 'openai',
                modelHint: 'luna',
              },
              model: 'gpt-fixture-luna',
            },
          ],
        },
        nvidia: {
          apiKey: 'nvidia-test-key-should-not-leak',
          profiles: [
            {
              selection: {
                profile: 'default',
                providerHint: 'nvidia',
                modelHint: 'nemotron',
              },
              model: 'nvidia/llama-fixture',
              controls: {
                temperature: true,
                topP: true,
                maxOutputTokens: true,
                enableThinking: 'enable_thinking',
                reasoningBudget: true,
                seed: true,
              },
            },
            {
              selection: {
                profile: 'default',
                providerHint: 'nvidia',
                modelHint: 'kimi',
              },
              model: 'moonshotai/kimi-k2-instruct',
              controls: {
                temperature: true,
                topP: true,
                maxOutputTokens: true,
                enableThinking: 'thinking',
                seed: true,
              },
            },
          ],
        },
      },
    });

    try {
      const headers = {
        authorization: `Bearer ${bearerToken}`,
        [ACME_MODEL_RUNTIME_HEADER]: ACME_MODEL_RUNTIME_V2_PROTOCOL_VERSION,
        'content-type': 'application/json',
      };

      const compatibility = await fetch(
        `${service.address.origin}/v1/model/compatibility`,
        { headers },
      );
      await expect(compatibility.json()).resolves.toEqual({
        protocolVersion: ACME_MODEL_RUNTIME_V2_PROTOCOL_VERSION,
        engineBuild: 'model-runtime-v2-test',
        executePath: '/v1/model/execute',
      });
      expect(service.providers).toEqual(['nvidia', 'openai']);
      expect(
        JSON.stringify({
          kind: 'acme-model-runtime-listening',
          protocolVersion: service.protocolVersion,
          engineBuild: service.engineBuild,
          origin: service.address.origin,
          hostname: service.address.hostname,
          port: service.address.port,
          providers: service.providers,
        }),
      ).not.toMatch(/openai-test-key|nvidia-test-key/u);

      const luna = await fetch(`${service.address.origin}/v1/model/execute`, {
        method: 'POST',
        headers,
        body: JSON.stringify(lunaRequest),
      });
      expect(luna.status).toBe(200);
      const lunaEvents = await readSse(luna);
      expect(lunaEvents.at(-1)?.protocolVersion).toBe(
        ACME_MODEL_RUNTIME_V2_PROTOCOL_VERSION,
      );
      expect(lunaEvents.at(-1)?.type).toBe('completed');
      expect(JSON.parse(openAi.sent[0]?.body ?? '{}')).toMatchObject({
        temperature: 0.2,
        top_p: 0.9,
        max_output_tokens: 1024,
        reasoning: { effort: 'high' },
      });

      const nemotron = await fetch(
        `${service.address.origin}/v1/model/execute`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(nemotronRequest),
        },
      );
      const nemotronEvents = await readSse(nemotron);
      expect(nemotronEvents.at(-1)?.type).toBe('completed');
      expect(JSON.parse(nvidia.sent[0]?.body ?? '{}')).toMatchObject({
        model: 'nvidia/llama-fixture',
        temperature: 0.6,
        top_p: 0.95,
        max_tokens: 2048,
        reasoning_budget: 4096,
        seed: 11,
        chat_template_kwargs: { enable_thinking: true },
      });
      expect(nvidia.sent[0]?.url).toBe(NVIDIA_CHAT_COMPLETIONS_ENDPOINT);

      const kimi = await fetch(`${service.address.origin}/v1/model/execute`, {
        method: 'POST',
        headers,
        body: JSON.stringify(kimiRequest),
      });
      const kimiEvents = await readSse(kimi);
      expect(kimiEvents.at(-1)?.type).toBe('completed');
      expect(JSON.parse(nvidia.sent[1]?.body ?? '{}')).toMatchObject({
        model: 'moonshotai/kimi-k2-instruct',
        top_p: 0.8,
        seed: 3,
        chat_template_kwargs: { thinking: true },
      });

      const unknown = await fetch(
        `${service.address.origin}/v1/model/execute`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...lunaRequest,
            requestKey: 'missing-route',
            model: {
              profile: 'default',
              providerHint: 'missing',
              modelHint: 'luna',
            },
          }),
        },
      );
      const unknownEvents = await readSse(unknown);
      expect(unknownEvents.at(-1)?.type).toBe('failed');
      expect(
        (unknownEvents.at(-1)?.error as { code?: string } | undefined)?.code,
      ).toBe('INVALID_REQUEST');
      expect(openAi.sent).toHaveLength(1);
      expect(nvidia.sent).toHaveLength(2);
    } finally {
      await service.close();
    }
  });
});
