import type {
  GatewayCallContext,
  ModelRequest,
  ModelSelection,
} from '@acme/core';

import type {
  ProviderTransport,
  ProviderTransportRequest,
  ProviderTransportResult,
} from '../src/transport.js';

export const fixtureNow = '2026-07-31T12:00:00.000Z';

export const fixtureSelection: ModelSelection = Object.freeze({
  profile: 'offline-json',
  providerHint: 'openai',
  modelHint: 'responses',
});

export const fixtureModel = 'gpt-fixture-1';

export const fixtureCapabilities = Object.freeze({
  structuredOutput: true,
  tools: false,
  vision: false,
  maxInputTokens: 100_000,
  maxOutputTokens: 8_000,
});

export const fixtureRequest: ModelRequest = Object.freeze({
  messages: Object.freeze([
    Object.freeze({
      role: 'system' as const,
      content: Object.freeze([
        Object.freeze({ type: 'text' as const, text: 'Return only JSON.' }),
      ]),
    }),
    Object.freeze({
      role: 'user' as const,
      content: Object.freeze([
        Object.freeze({ type: 'text' as const, text: '{"documentKey":"a"}' }),
      ]),
    }),
  ]),
  output: Object.freeze({
    mode: 'json' as const,
    schemaName: 'fixture_output_1',
    jsonSchema: Object.freeze({
      type: 'object',
      properties: Object.freeze({ ok: Object.freeze({ type: 'boolean' }) }),
      required: Object.freeze(['ok']),
      additionalProperties: false,
    }),
  }),
  temperature: 0,
  maxOutputTokens: 2048,
});

export function callContext(
  overrides: Partial<GatewayCallContext> = {},
): GatewayCallContext {
  return {
    executionId: 'execution-openai-fixture',
    callKey: 'model:0',
    selection: fixtureSelection,
    requiredCapabilities: { structuredOutput: true },
    timeoutMs: 30_000,
    signal: new AbortController().signal,
    ...overrides,
  };
}

/**
 * A recorded successful Responses payload. Hand-written per ADR-0014, not
 * captured from a live call.
 */
export const completedResponseBody = JSON.stringify({
  id: 'resp_fixture_001',
  object: 'response',
  created_at: 1_784_000_000,
  model: fixtureModel,
  status: 'completed',
  incomplete_details: null,
  error: null,
  output: [
    {
      type: 'message',
      id: 'msg_fixture_001',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text: '{"ok":true}', annotations: [] }],
    },
  ],
  usage: { input_tokens: 120, output_tokens: 8, total_tokens: 128 },
});

export const truncatedResponseBody = JSON.stringify({
  id: 'resp_fixture_002',
  model: fixtureModel,
  status: 'incomplete',
  incomplete_details: { reason: 'max_output_tokens' },
  output: [
    {
      type: 'message',
      content: [{ type: 'output_text', text: '{"ok":tr' }],
    },
  ],
  usage: { input_tokens: 120, output_tokens: 2048, total_tokens: 2168 },
});

export const refusedResponseBody = JSON.stringify({
  id: 'resp_fixture_003',
  model: fixtureModel,
  status: 'completed',
  output: [
    {
      type: 'message',
      content: [{ type: 'refusal', refusal: 'I cannot help with that.' }],
    },
  ],
  usage: { input_tokens: 120, output_tokens: 4, total_tokens: 124 },
});

export const failedResponseBody = JSON.stringify({
  id: 'resp_fixture_004',
  model: fixtureModel,
  status: 'failed',
  error: { code: 'server_error', message: 'upstream failure' },
  output: [],
});

/** An unknown output item type must not break normalization. */
export const unknownItemResponseBody = JSON.stringify({
  id: 'resp_fixture_005',
  model: fixtureModel,
  status: 'completed',
  output: [
    { type: 'reasoning', id: 'rs_1', summary: [] },
    {
      type: 'message',
      content: [
        { type: 'output_text', text: '{"ok":' },
        { type: 'output_text', text: 'true}' },
      ],
    },
  ],
  usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
});

export function errorBody(message: string): string {
  return JSON.stringify({
    error: { message, type: 'invalid_request_error', code: 'fixture' },
  });
}

export interface RecordingTransport extends ProviderTransport {
  readonly sent: ProviderTransportRequest[];
}

/** A transport that answers from a fixture and can never reach a network. */
export function fixtureTransport(
  ...results: readonly ProviderTransportResult[]
): RecordingTransport {
  const sent: ProviderTransportRequest[] = [];
  let index = 0;
  return {
    sent,
    async send(request) {
      sent.push(request);
      const result = results[Math.min(index, results.length - 1)];
      index += 1;
      if (result === undefined) {
        throw new Error('The fixture transport has no scripted result.');
      }
      return result;
    },
  };
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
