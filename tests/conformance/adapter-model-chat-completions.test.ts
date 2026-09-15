import {
  createChatCompletionsGateway,
  type ProviderTransport,
  type ProviderTransportResult,
} from '../../packages/adapter-model-chat-completions/src/index.js';
import type {
  GatewayCallContext,
  ModelRequest,
  NormalizedModelResponse,
} from '../../packages/core/src/index.js';
import { modelGatewayConformance } from '../../packages/testing/src/index.js';

const now = '2026-09-15T12:00:00.000Z';
const selection = { profile: 'offline-text', providerHint: 'nvidia' };
const model = 'nvidia/llama-fixture-1';
const endpoint = 'https://example.invalid/v1/chat/completions';

const capabilities = {
  structuredOutput: false,
  tools: true,
  vision: false,
  maxInputTokens: 100_000,
  maxOutputTokens: 8_000,
};

const successRequest: ModelRequest = {
  messages: [
    {
      role: 'user',
      content: [{ type: 'text', text: 'Return a fixture result.' }],
    },
  ],
  output: { mode: 'text' },
};

const failureRequest: ModelRequest = {
  ...successRequest,
  messages: [
    {
      role: 'user',
      content: [{ type: 'text', text: 'Trigger the fixture failure.' }],
    },
  ],
};

const successBody = JSON.stringify({
  id: 'chatcmpl_conformance_001',
  model,
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'ok' },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
});

const successResponse: NormalizedModelResponse = {
  provider: 'nvidia',
  model,
  providerResponseId: 'chatcmpl_conformance_001',
  receivedAt: now,
  finishReason: 'stop',
  text: 'ok',
  usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
  metadata: {
    providerFinishReason: 'stop',
  },
};

function context(
  overrides: Partial<GatewayCallContext> = {},
): GatewayCallContext {
  return {
    executionId: 'execution-conformance',
    callKey: 'model:0',
    selection,
    requiredCapabilities: {},
    timeoutMs: 30_000,
    signal: new AbortController().signal,
    ...overrides,
  };
}

const transport: ProviderTransport = {
  async send(request): Promise<ProviderTransportResult> {
    if (request.body.includes('Trigger the fixture failure.')) {
      return {
        kind: 'response',
        status: 429,
        headers: {},
        body: JSON.stringify({ error: { message: 'slow down' } }),
      };
    }
    return { kind: 'response', status: 200, headers: {}, body: successBody };
  },
  async *stream(request) {
    if (request.body.includes('Trigger the fixture failure.')) {
      yield {
        kind: 'response-start',
        status: 429,
        headers: {},
      };
      yield {
        kind: 'chunk',
        text: JSON.stringify({ error: { message: 'slow down' } }),
      };
      yield { kind: 'response-end' };
      return;
    }
    yield { kind: 'response-start', status: 200, headers: {} };
    yield {
      kind: 'chunk',
      text: `data: ${JSON.stringify({
        id: 'chatcmpl_conformance_001',
        model,
        choices: [
          {
            index: 0,
            delta: { content: 'ok' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
      })}\n\ndata: [DONE]\n\n`,
    };
    yield { kind: 'response-end' };
  },
};

modelGatewayConformance('chat completions adapter', {
  createSubject: () => ({
    gateway: createChatCompletionsGateway({
      transport,
      now: () => now,
      profiles: [
        {
          selection,
          provider: 'nvidia',
          model,
          endpoint,
          capabilities,
        },
      ],
    }),
    selection,
    expectedCapabilities: capabilities,
    unsupportedRequiredCapabilities: { structuredOutput: true },
    success: {
      request: successRequest,
      context: context(),
      expectedResponse: successResponse,
    },
    failure: {
      request: failureRequest,
      context: context({ callKey: 'model:1' }),
      expectedError: {
        code: 'MODEL_RATE_LIMIT',
        message: 'The provider rate limited the call.',
        stage: 'calling-model',
        retryable: true,
        details: { status: 429, providerMessage: 'slow down' },
      },
    },
  }),
});
