import {
  buildResponsesBody,
  createOpenAiResponsesGateway,
  type ProviderTransport,
  type ProviderTransportResult,
} from '../../packages/adapter-model-openai/src/index.js';
import type {
  GatewayCallContext,
  ModelRequest,
  NormalizedModelResponse,
} from '../../packages/core/src/index.js';
import { modelGatewayConformance } from '../../packages/testing/src/index.js';

const now = '2026-07-31T12:00:00.000Z';
const selection = { profile: 'offline-json', providerHint: 'openai' };
const model = 'gpt-fixture-1';

const capabilities = {
  structuredOutput: true,
  tools: false,
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
  output: {
    mode: 'json',
    schemaName: 'fixture',
    jsonSchema: { type: 'object' },
  },
  temperature: 0,
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
  id: 'resp_conformance_001',
  model,
  status: 'completed',
  output: [
    {
      type: 'message',
      content: [{ type: 'output_text', text: '{"ok":true}' }],
    },
  ],
  usage: { input_tokens: 12, output_tokens: 4, total_tokens: 16 },
});

const { providerWireSchemaHash } = buildResponsesBody(successRequest, model);

const successResponse: NormalizedModelResponse = {
  provider: 'openai',
  model,
  providerResponseId: 'resp_conformance_001',
  receivedAt: now,
  finishReason: 'stop',
  text: '{"ok":true}',
  usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
  metadata: {
    providerStatus: 'completed',
    providerWireSchemaHash,
  },
};

function context(
  overrides: Partial<GatewayCallContext> = {},
): GatewayCallContext {
  return {
    executionId: 'execution-conformance',
    callKey: 'model:0',
    selection,
    requiredCapabilities: { structuredOutput: true },
    timeoutMs: 30_000,
    signal: new AbortController().signal,
    ...overrides,
  };
}

/**
 * Answers by request content so one transport can serve both the success and
 * the failure case the shared suite drives. It cannot reach a network.
 */
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
};

modelGatewayConformance('openai responses adapter', {
  createSubject: () => ({
    gateway: createOpenAiResponsesGateway({
      transport,
      now: () => now,
      profiles: [{ selection, model, capabilities }],
    }),
    selection,
    expectedCapabilities: capabilities,
    unsupportedRequiredCapabilities: { tools: true },
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
