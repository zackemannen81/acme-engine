import { describe, expect, it } from 'vitest';

import {
  createRoutedModelGateway,
  type GatewayCallContext,
  type ModelCapabilities,
  type ModelGateway,
  type ModelRequest,
  type ModelSelection,
  type NormalizedModelResponse,
} from '../src/index.js';

const now = '2026-09-15T12:00:00.000Z';

const openaiSelection: ModelSelection = {
  profile: 'default',
  providerHint: 'openai',
  modelHint: 'luna',
};

const nvidiaSelection: ModelSelection = {
  profile: 'default',
  providerHint: 'nvidia',
  modelHint: 'nemotron',
};

const request: ModelRequest = {
  messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
  output: { mode: 'text' },
};

function response(provider: string): NormalizedModelResponse {
  return {
    provider,
    model: `${provider}-fixture`,
    receivedAt: now,
    finishReason: 'stop',
    text: provider,
    usage: {},
    metadata: {},
  };
}

function context(selection: ModelSelection): GatewayCallContext {
  return {
    executionId: 'execution-router',
    callKey: 'model:0',
    selection,
    requiredCapabilities: {},
    timeoutMs: 30_000,
    signal: new AbortController().signal,
  };
}

function recordingGateway(
  provider: string,
  capabilities: ModelCapabilities,
): ModelGateway & { readonly calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async capabilities() {
      calls.push('capabilities');
      return capabilities;
    },
    async generate() {
      calls.push('generate');
      return response(provider);
    },
    async *stream() {
      calls.push('stream');
      yield { type: 'completed', sequence: 0, response: response(provider) };
    },
  };
}

describe('createRoutedModelGateway', () => {
  it('delegates only to the route matching providerHint', async () => {
    const openai = recordingGateway('openai', {
      structuredOutput: true,
      tools: true,
      vision: false,
    });
    const nvidia = recordingGateway('nvidia', {
      structuredOutput: false,
      tools: true,
      vision: false,
    });
    const gateway = createRoutedModelGateway({
      routes: { openai, nvidia },
    });

    await expect(gateway.capabilities(openaiSelection)).resolves.toEqual({
      structuredOutput: true,
      tools: true,
      vision: false,
    });
    await expect(
      gateway.generate(request, context(openaiSelection)),
    ).resolves.toMatchObject({ provider: 'openai' });
    await expect(
      gateway.generate(request, context(nvidiaSelection)),
    ).resolves.toMatchObject({ provider: 'nvidia' });
    expect(openai.calls).toEqual(['capabilities', 'generate']);
    expect(nvidia.calls).toEqual(['generate']);
  });

  it('fails closed before dispatch when providerHint is missing or unknown', async () => {
    const openai = recordingGateway('openai', {
      structuredOutput: true,
      tools: false,
      vision: false,
    });
    const gateway = createRoutedModelGateway({ routes: { openai } });

    await expect(
      gateway.generate(request, context({ profile: 'default' })),
    ).rejects.toMatchObject({
      data: {
        code: 'INVALID_REQUEST',
        message: 'Routed model execution requires an explicit providerHint.',
      },
    });
    await expect(
      gateway.generate(
        request,
        context({ profile: 'default', providerHint: 'kimi' }),
      ),
    ).rejects.toMatchObject({
      data: {
        code: 'INVALID_REQUEST',
        details: { providerHint: 'kimi', configured: ['openai'] },
      },
    });
    expect(openai.calls).toEqual([]);
  });

  it('rejects empty or duplicate route keys at construction', () => {
    const openai = recordingGateway('openai', {
      structuredOutput: true,
      tools: false,
      vision: false,
    });
    expect(() => createRoutedModelGateway({ routes: {} })).toThrowError(
      /at least one route/u,
    );
    expect(() =>
      createRoutedModelGateway({ routes: { '': openai } }),
    ).toThrowError(/non-empty/u);
  });
});
