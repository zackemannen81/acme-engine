import type {
  GatewayCallContext,
  ModelRequest,
  ModelSelection,
} from '@acme-engine/core';

import type { ChatCompletionsModelProfile } from '../src/gateway.js';
import type {
  ProviderTransport,
  ProviderTransportRequest,
  ProviderTransportResult,
  ProviderTransportStreamEvent,
} from '../src/transport.js';

export const fixtureNow = '2026-09-15T12:00:00.000Z';

export const fixtureSelection: ModelSelection = Object.freeze({
  profile: 'default',
  providerHint: 'nvidia',
  modelHint: 'nemotron',
});

export const fixtureModel = 'nvidia/llama-fixture-1';

export const fixtureCapabilities = Object.freeze({
  structuredOutput: false,
  tools: true,
  vision: false,
  maxInputTokens: 100_000,
  maxOutputTokens: 8_000,
});

export const fixtureControls = Object.freeze({
  temperature: true,
  topP: true,
  maxOutputTokens: true,
  stop: true,
  reasoningBudget: true,
  enableThinking: 'enable_thinking' as const,
  reasoningEffort: true,
  seed: true,
});

export const fixtureProfile: ChatCompletionsModelProfile = Object.freeze({
  selection: fixtureSelection,
  provider: 'nvidia',
  model: fixtureModel,
  endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
  capabilities: fixtureCapabilities,
  controls: fixtureControls,
});

export const fixtureRequest: ModelRequest = Object.freeze({
  messages: Object.freeze([
    Object.freeze({
      role: 'user' as const,
      content: Object.freeze([
        Object.freeze({ type: 'text' as const, text: 'Say hello.' }),
      ]),
    }),
  ]),
  output: Object.freeze({ mode: 'text' as const }),
  temperature: 0.2,
  topP: 0.9,
  maxOutputTokens: 1024,
  seed: 7,
});

export function callContext(
  overrides: Partial<GatewayCallContext> = {},
): GatewayCallContext {
  return {
    executionId: 'execution-chat-fixture',
    callKey: 'model:0',
    selection: fixtureSelection,
    requiredCapabilities: {},
    timeoutMs: 30_000,
    signal: new AbortController().signal,
    ...overrides,
  };
}

export const completedResponseBody = JSON.stringify({
  id: 'chatcmpl_fixture_001',
  model: fixtureModel,
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'Hello' },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 8, completion_tokens: 1, total_tokens: 9 },
});

export function errorBody(message: string): string {
  return JSON.stringify({
    error: { message, type: 'invalid_request_error' },
  });
}

export interface RecordingTransport extends ProviderTransport {
  readonly sent: ProviderTransportRequest[];
}

export function fixtureTransport(
  ...results: readonly ProviderTransportResult[]
): RecordingTransport {
  const sent: ProviderTransportRequest[] = [];
  let index = 0;
  const nextResult = (
    request: ProviderTransportRequest,
  ): ProviderTransportResult => {
    sent.push(request);
    const result = results[Math.min(index, results.length - 1)];
    index += 1;
    if (result === undefined) {
      throw new Error('The fixture transport has no scripted result.');
    }
    return result;
  };
  return {
    sent,
    async send(request) {
      return nextResult(request);
    },
    async *stream(request): AsyncIterable<ProviderTransportStreamEvent> {
      const result = nextResult(request);
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

export function sseBody(events: readonly string[]): string {
  return `${events.join('\n\n')}\n\n`;
}

export function ok(body: string): ProviderTransportResult {
  return { kind: 'response', status: 200, headers: {}, body };
}

export function status(
  code: number,
  body = errorBody('fixture failure'),
): ProviderTransportResult {
  return { kind: 'response', status: code, headers: {}, body };
}

export function noResponse(
  reason: 'timeout' | 'aborted' | 'network',
  delivery: 'not-sent' | 'sent' | 'unknown',
): ProviderTransportResult {
  return { kind: 'no-response', reason, delivery };
}
