import { createScriptedModelGateway } from '../../packages/adapter-model-mock/src/index.js';
import {
  computeModelRequestHash,
  type AcmeErrorData,
  type GatewayCallContext,
  type ModelRequest,
  type NormalizedModelResponse,
} from '../../packages/core/src/index.js';
import { modelGatewayConformance } from '../../packages/testing/src/index.js';

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

const successResponse: NormalizedModelResponse = {
  provider: 'fixture-provider',
  model: 'fixture-model',
  providerResponseId: 'response-1',
  receivedAt: '2026-07-30T10:00:00.000Z',
  finishReason: 'stop',
  text: '{"ok":true}',
  usage: {
    inputTokens: 8,
    outputTokens: 4,
    totalTokens: 12,
    estimatedCostMinor: 0,
    currency: 'USD',
  },
  metadata: { transport: 'fixture' },
};

const failureError: AcmeErrorData = {
  code: 'MODEL_UNAVAILABLE',
  message: 'Fixture provider unavailable.',
  stage: 'calling-model',
  retryable: true,
  details: { status: 503 },
  causeRef: 'fixture-cause-1',
};

function context(executionId: string, callKey: string): GatewayCallContext {
  return {
    executionId,
    callKey,
    selection: { profile: 'conformance' },
    requiredCapabilities: { structuredOutput: true, maxOutputTokens: 64 },
    timeoutMs: 1_000,
    signal: new AbortController().signal,
  };
}

modelGatewayConformance('deterministic scripted mock', {
  createSubject: () => {
    const successContext = context('execution-success', 'model:0');
    const failureContext = context('execution-failure', 'model:0');
    const gateway = createScriptedModelGateway({
      profiles: [
        {
          selection: { profile: 'conformance' },
          capabilities: {
            structuredOutput: true,
            tools: false,
            vision: false,
            maxInputTokens: 4_096,
            maxOutputTokens: 256,
          },
        },
      ],
      calls: [
        {
          executionId: successContext.executionId,
          callKey: successContext.callKey,
          selection: successContext.selection,
          expectedRequestHash: computeModelRequestHash(successRequest),
          outcome: { kind: 'response', response: successResponse },
        },
        {
          executionId: failureContext.executionId,
          callKey: failureContext.callKey,
          selection: failureContext.selection,
          expectedRequestHash: computeModelRequestHash(failureRequest),
          outcome: { kind: 'error', error: failureError },
        },
      ],
    });

    return {
      gateway,
      selection: { profile: 'conformance' },
      expectedCapabilities: {
        structuredOutput: true,
        tools: false,
        vision: false,
        maxInputTokens: 4_096,
        maxOutputTokens: 256,
      },
      unsupportedRequiredCapabilities: { tools: true },
      success: {
        request: successRequest,
        context: successContext,
        expectedResponse: successResponse,
      },
      failure: {
        request: failureRequest,
        context: failureContext,
        expectedError: failureError,
      },
    };
  },
});
