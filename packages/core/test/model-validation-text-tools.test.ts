import {
  validateModelRequest,
  validateNormalizedModelResponse,
  type ModelRequest,
} from '../src/index.js';
import { describe, expect, it } from 'vitest';

describe('model request text and tools', () => {
  it('accepts text output without a schema', () => {
    const request: ModelRequest = {
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'Say hello.' }] },
      ],
      output: { mode: 'text' },
    };
    expect(validateModelRequest(request)).toEqual(request);
    expect(Object.isFrozen(validateModelRequest(request))).toBe(true);
  });

  it('accepts function tools and assistant tool-call parts', () => {
    const request: ModelRequest = {
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Weather in Paris?' }],
        },
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
      output: { mode: 'text' },
      tools: [
        {
          type: 'function',
          name: 'get_weather',
          description: 'Look up weather',
          parameters: { type: 'object' },
        },
      ],
    };
    expect(validateModelRequest(request)).toEqual(request);
  });

  it('rejects empty tools arrays', () => {
    expect(() =>
      validateModelRequest({
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
        output: { mode: 'text' },
        tools: [],
      }),
    ).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'INVALID_REQUEST' }),
      }),
    );
  });

  it('accepts normalized toolCalls and omits them when absent', () => {
    const withCalls = validateNormalizedModelResponse({
      provider: 'fixture',
      model: 'fixture',
      receivedAt: '2026-09-15T12:00:00.000Z',
      finishReason: 'tool',
      text: '',
      toolCalls: [
        {
          toolCallId: 'call_1',
          name: 'get_weather',
          arguments: { city: 'Paris' },
        },
      ],
      usage: {},
      metadata: {},
    });
    expect(withCalls.toolCalls?.[0]?.name).toBe('get_weather');
    const withoutCalls = validateNormalizedModelResponse({
      provider: 'fixture',
      model: 'fixture',
      receivedAt: '2026-09-15T12:00:00.000Z',
      finishReason: 'stop',
      text: 'ok',
      usage: {},
      metadata: {},
    });
    expect(withoutCalls).not.toHaveProperty('toolCalls');
  });
});
