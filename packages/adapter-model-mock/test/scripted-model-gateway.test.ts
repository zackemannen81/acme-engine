import { readFile } from 'node:fs/promises';

import {
  AcmeError,
  computeModelRequestHash,
  type GatewayCallContext,
  type ModelCapabilities,
  type ModelRequest,
  type ModelSelection,
  type NormalizedModelResponse,
} from '@acme/core';
import { describe, expect, it } from 'vitest';

import {
  createScriptedModelGateway,
  type ScriptedModelGatewayOptions,
} from '../src/index.js';

const selection: ModelSelection = {
  profile: 'fixture',
  providerHint: 'fixture-provider',
  modelHint: 'fixture-model',
};

const capabilities: ModelCapabilities = {
  structuredOutput: true,
  tools: false,
  vision: false,
  maxInputTokens: 8_192,
  maxOutputTokens: 512,
};

function request(text = 'Return fixture JSON.'): ModelRequest {
  return {
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text }],
      },
    ],
    output: {
      mode: 'json',
      schemaName: 'fixture',
      jsonSchema: {
        additionalProperties: false,
        properties: { value: { type: 'string' } },
        required: ['value'],
        type: 'object',
      },
    },
    temperature: 0,
    maxOutputTokens: 64,
  };
}

function response(text = '{"value":"fixture"}'): NormalizedModelResponse {
  return {
    provider: 'fixture-provider',
    model: 'fixture-model',
    providerResponseId: 'fixture-response',
    receivedAt: '2026-07-30T11:00:00.000Z',
    finishReason: 'stop',
    text,
    usage: {
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    },
    metadata: { fixture: true, nested: { stable: true } },
  };
}

function context(
  executionId = 'execution-1',
  callKey = 'model:0',
  overrides: Partial<GatewayCallContext> = {},
): GatewayCallContext {
  return {
    executionId,
    callKey,
    selection,
    requiredCapabilities: { structuredOutput: true, maxOutputTokens: 64 },
    timeoutMs: 1_000,
    signal: new AbortController().signal,
    ...overrides,
  };
}

function options(
  calls: ScriptedModelGatewayOptions['calls'] = [
    {
      executionId: 'execution-1',
      callKey: 'model:0',
      selection,
      expectedRequestHash: computeModelRequestHash(request()),
      outcome: { kind: 'response', response: response() },
    },
  ],
): ScriptedModelGatewayOptions {
  return {
    profiles: [
      { selection: { ...selection }, capabilities: { ...capabilities } },
    ],
    calls,
  };
}

function errorCode(error: unknown): string | undefined {
  return error instanceof AcmeError ? error.data.code : undefined;
}

function defaultCall() {
  const call = options().calls[0];
  if (call === undefined) {
    throw new Error('Default fixture call is missing.');
  }
  return call;
}

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== 'object') {
    return;
  }
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) {
    expectDeeplyFrozen(child);
  }
}

describe('deterministic scripted model gateway', () => {
  it('validates all profiles and calls before use', () => {
    expect(() =>
      createScriptedModelGateway({
        ...options(),
        profiles: [
          { selection, capabilities },
          { selection: { ...selection }, capabilities },
        ],
      }),
    ).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'INVALID_REQUEST' }),
      }),
    );

    const call = defaultCall();
    expect(() =>
      createScriptedModelGateway(options([call, { ...call }])),
    ).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'INVALID_REQUEST' }),
      }),
    );

    expect(() =>
      createScriptedModelGateway(
        options([
          {
            ...call,
            selection: { profile: 'undeclared' },
          },
        ]),
      ),
    ).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'INVALID_REQUEST' }),
      }),
    );

    expect(() =>
      createScriptedModelGateway(
        options([{ ...call, expectedRequestHash: 'not-a-hash' }]),
      ),
    ).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'INVALID_REQUEST' }),
      }),
    );
  });

  it('rejects malformed response envelopes and unsupported scripted errors', () => {
    const base = defaultCall();
    expect(() =>
      createScriptedModelGateway(
        options([
          {
            ...base,
            outcome: {
              kind: 'response',
              response: {
                ...response(),
                receivedAt: 'not-a-timestamp',
              },
            },
          },
        ]),
      ),
    ).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'INVALID_REQUEST' }),
      }),
    );

    expect(() =>
      createScriptedModelGateway(
        options([
          {
            ...base,
            outcome: {
              kind: 'error',
              error: {
                code: 'PERSISTENCE_TRANSIENT',
                message: 'wrong layer',
                stage: 'calling-model',
                retryable: true,
              },
            },
          },
        ]),
      ),
    ).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'INVALID_REQUEST' }),
      }),
    );
  });

  it('reports capabilities for the exact selection and rejects unknown identities', async () => {
    const gateway = createScriptedModelGateway(options());
    const first = await gateway.capabilities(selection);
    const second = await gateway.capabilities({ ...selection });

    expect(first).toEqual(capabilities);
    expect(first).not.toBe(capabilities);
    expect(second).toEqual(first);
    expectDeeplyFrozen(first);
    await expect(
      gateway.capabilities({ profile: 'fixture' }),
    ).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'UNSUPPORTED_CAPABILITY',
    );
  });

  it('matches identity, selection, and request hash exactly and consumes once', async () => {
    const gateway = createScriptedModelGateway(options());
    await expect(gateway.generate(request(), context())).resolves.toEqual(
      response(),
    );
    expect(gateway.unconsumedCalls()).toEqual([]);
    expect(() => gateway.assertAllConsumed()).not.toThrow();
    await expect(gateway.generate(request(), context())).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'INTERNAL',
    );
    expect(gateway.invocations()).toHaveLength(1);
  });

  it('does not consume or record cancellation and capability rejection', async () => {
    const gateway = createScriptedModelGateway(options());
    const controller = new AbortController();
    controller.abort();
    await expect(
      gateway.generate(
        request(),
        context('execution-1', 'model:0', { signal: controller.signal }),
      ),
    ).rejects.toSatisfy((error: unknown) => errorCode(error) === 'CANCELLED');
    await expect(
      gateway.generate(
        request(),
        context('execution-1', 'model:0', {
          requiredCapabilities: { tools: true },
        }),
      ),
    ).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'UNSUPPORTED_CAPABILITY',
    );
    expect(gateway.invocations()).toEqual([]);
    expect(gateway.unconsumedCalls()).toHaveLength(1);
    await expect(gateway.generate(request(), context())).resolves.toEqual(
      response(),
    );
  });

  it('does not consume unexpected, selection-mismatched, or hash-mismatched calls', async () => {
    const fixtureOptions = options();
    const alternateSelection = { profile: 'alternate' };
    const gateway = createScriptedModelGateway({
      profiles: [
        ...fixtureOptions.profiles,
        { selection: alternateSelection, capabilities },
      ],
      calls: fixtureOptions.calls,
    });
    await expect(
      gateway.generate(request(), context('unexpected', 'model:0')),
    ).rejects.toSatisfy((error: unknown) => errorCode(error) === 'INTERNAL');
    await expect(
      gateway.generate(
        request(),
        context('execution-1', 'model:0', {
          selection: alternateSelection,
        }),
      ),
    ).rejects.toSatisfy((error: unknown) => errorCode(error) === 'INTERNAL');
    await expect(
      gateway.generate(request('Changed request.'), context()),
    ).rejects.toSatisfy((error: unknown) => errorCode(error) === 'INTERNAL');

    expect(gateway.invocations()).toEqual([]);
    expect(gateway.unconsumedCalls()).toHaveLength(1);
  });

  it('consumes scripted model errors and preserves exact deeply frozen data', async () => {
    const scriptedError = {
      code: 'MODEL_RATE_LIMIT' as const,
      message: 'Rate limited by fixture.',
      stage: 'calling-model' as const,
      retryable: true,
      details: { retryAfterMs: 250 },
      causeRef: 'fixture-rate-limit',
    };
    const gateway = createScriptedModelGateway(
      options([
        {
          executionId: 'execution-1',
          callKey: 'model:0',
          selection,
          expectedRequestHash: computeModelRequestHash(request()),
          outcome: { kind: 'error', error: scriptedError },
        },
      ]),
    );
    let caught: unknown;
    try {
      await gateway.generate(request(), context());
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AcmeError);
    expect((caught as AcmeError).data).toEqual(scriptedError);
    expectDeeplyFrozen((caught as AcmeError).data);
    expect(gateway.invocations()).toMatchObject([{ outcome: 'error' }]);
    expect(gateway.unconsumedCalls()).toEqual([]);
  });

  it('records deterministic invocation order and reports sorted unconsumed calls', async () => {
    const firstRequest = request('First.');
    const secondRequest = request('Second.');
    const gateway = createScriptedModelGateway(
      options([
        {
          executionId: 'execution-z',
          callKey: 'model:1',
          selection,
          expectedRequestHash: computeModelRequestHash(secondRequest),
          outcome: {
            kind: 'response',
            response: response('{"value":"second"}'),
          },
        },
        {
          executionId: 'execution-a',
          callKey: 'model:0',
          selection,
          expectedRequestHash: computeModelRequestHash(firstRequest),
          outcome: {
            kind: 'response',
            response: response('{"value":"first"}'),
          },
        },
      ]),
    );

    await gateway.generate(secondRequest, context('execution-z', 'model:1'));
    expect(gateway.invocations()).toMatchObject([
      { ordinal: 1, executionId: 'execution-z', callKey: 'model:1' },
    ]);
    expect(gateway.unconsumedCalls()).toMatchObject([
      { executionId: 'execution-a', callKey: 'model:0' },
    ]);
    expect(() => gateway.assertAllConsumed()).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'INTERNAL', retryable: false }),
      }),
    );
  });

  it('detaches configuration, responses, and inspection values from callers', async () => {
    const mutableResponse = response();
    const mutableOptions = options([
      {
        executionId: 'execution-1',
        callKey: 'model:0',
        selection,
        expectedRequestHash: computeModelRequestHash(request()),
        outcome: { kind: 'response', response: mutableResponse },
      },
    ]);
    const gateway = createScriptedModelGateway(mutableOptions);
    (mutableResponse as { text: string }).text = 'mutated';
    const mutableProfile = mutableOptions.profiles[0];
    if (mutableProfile === undefined) {
      throw new Error('Mutable fixture profile is missing.');
    }
    (
      mutableProfile.capabilities as {
        structuredOutput: boolean;
      }
    ).structuredOutput = false;

    const actual = await gateway.generate(request(), context());
    expect(actual.text).toBe('{"value":"fixture"}');
    expect((await gateway.capabilities(selection)).structuredOutput).toBe(true);
    expectDeeplyFrozen(actual);

    const evidence = gateway.invocations();
    expectDeeplyFrozen(evidence);
    expect(() => {
      (evidence[0] as { callKey: string }).callKey = 'mutated';
    }).toThrow();
    expect(gateway.invocations()[0]?.callKey).toBe('model:0');
  });

  it('produces byte-equivalent responses and evidence across identical runs', async () => {
    const first = createScriptedModelGateway(options());
    const second = createScriptedModelGateway(options());
    const firstResponse = await first.generate(request(), context());
    const secondResponse = await second.generate(request(), context());

    expect(JSON.stringify(firstResponse)).toBe(JSON.stringify(secondResponse));
    expect(JSON.stringify(first.invocations())).toBe(
      JSON.stringify(second.invocations()),
    );
  });

  it('contains no provider, network, environment, time, random, or filesystem runtime dependency', async () => {
    const source = await readFile(
      new URL('../src/scripted-model-gateway.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(
      /node:(?:fs|http|https|net|tls)|process\.env|Date\.now|new Date|Math\.random|fetch\(/u,
    );
    expect(source).not.toMatch(/from ['"](?:openai|@anthropic-ai|aws-sdk)/u);
  });
});
