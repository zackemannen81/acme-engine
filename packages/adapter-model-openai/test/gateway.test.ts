import { canonicalJson } from '@acme/core';
import { describe, expect, it } from 'vitest';

import {
  AmbiguousModelCallError,
  createOpenAiResponsesGateway,
  buildResponsesBody,
} from '../src/index.js';
import {
  callContext,
  completedResponseBody,
  errorBody,
  failedResponseBody,
  fixtureCapabilities,
  fixtureModel,
  fixtureNow,
  fixtureRequest,
  fixtureSelection,
  fixtureTransport,
  noResponse,
  ok,
  refusedResponseBody,
  status,
  truncatedResponseBody,
  unknownItemResponseBody,
} from './fixtures.js';
import type { ProviderTransport } from '../src/transport.js';

function gateway(transport: ProviderTransport) {
  return createOpenAiResponsesGateway({
    transport,
    now: () => fixtureNow,
    profiles: [
      {
        selection: fixtureSelection,
        model: fixtureModel,
        capabilities: fixtureCapabilities,
      },
    ],
  });
}

describe('OpenAI Responses request mapping', () => {
  it('maps system messages to instructions and keeps supplied order', () => {
    const body = buildResponsesBody(fixtureRequest, fixtureModel);
    expect(body).toEqual({
      model: fixtureModel,
      instructions: 'Return only JSON.',
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: '{"documentKey":"a"}' }],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'fixture_output_1',
          schema: fixtureRequest.output.jsonSchema,
          strict: true,
        },
      },
      temperature: 0,
      max_output_tokens: 2048,
    });
  });

  it('is deterministic for the same request', () => {
    expect(
      canonicalJson(buildResponsesBody(fixtureRequest, fixtureModel)),
    ).toBe(canonicalJson(buildResponsesBody(fixtureRequest, fixtureModel)));
  });

  it('rejects stop sequences rather than silently dropping them', () => {
    expect(() =>
      buildResponsesBody({ ...fixtureRequest, stop: ['\n\n'] }, fixtureModel),
    ).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'INVALID_REQUEST' }),
      }),
    );
  });

  it('rejects non-text content rather than silently dropping it', () => {
    expect(() =>
      buildResponsesBody(
        {
          ...fixtureRequest,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', mediaType: 'image/png', dataRef: 'ref' },
              ],
            },
          ],
        },
        fixtureModel,
      ),
    ).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'INVALID_REQUEST' }),
      }),
    );
  });
});

describe('OpenAI Responses normalization', () => {
  it('normalizes a completed response exactly', async () => {
    const transport = fixtureTransport(ok(completedResponseBody));
    const response = await gateway(transport).generate(
      fixtureRequest,
      callContext(),
    );

    expect(response).toEqual({
      provider: 'openai',
      model: fixtureModel,
      providerResponseId: 'resp_fixture_001',
      receivedAt: fixtureNow,
      finishReason: 'stop',
      text: '{"ok":true}',
      usage: { inputTokens: 120, outputTokens: 8, totalTokens: 128 },
      metadata: { providerStatus: 'completed' },
    });
    expect(Object.isFrozen(response)).toBe(true);
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]?.url).toBe('https://api.openai.com/v1/responses');
  });

  it('maps a truncated response to length and keeps the partial text', async () => {
    const response = await gateway(
      fixtureTransport(ok(truncatedResponseBody)),
    ).generate(fixtureRequest, callContext());

    expect(response.finishReason).toBe('length');
    expect(response.text).toBe('{"ok":tr');
    expect(response.metadata).toEqual({
      providerStatus: 'incomplete',
      incompleteReason: 'max_output_tokens',
    });
  });

  it('concatenates text parts in order and ignores unknown output items', async () => {
    const response = await gateway(
      fixtureTransport(ok(unknownItemResponseBody)),
    ).generate(fixtureRequest, callContext());

    expect(response.text).toBe('{"ok":true}');
    expect(response.finishReason).toBe('stop');
  });

  it('omits usage fields the provider did not report', async () => {
    const body = JSON.stringify({
      id: 'resp_fixture_006',
      model: fixtureModel,
      status: 'completed',
      output: [
        { type: 'message', content: [{ type: 'output_text', text: '{}' }] },
      ],
    });
    const response = await gateway(fixtureTransport(ok(body))).generate(
      fixtureRequest,
      callContext(),
    );
    expect(response.usage).toEqual({});
  });
});

describe('OpenAI Responses failure classification', () => {
  it.each([
    [400, 'INVALID_REQUEST', false],
    [404, 'INVALID_REQUEST', false],
    [422, 'INVALID_REQUEST', false],
    [401, 'MODEL_AUTH', false],
    [403, 'MODEL_AUTH', false],
    [408, 'TIMEOUT', true],
    [429, 'MODEL_RATE_LIMIT', true],
    [500, 'MODEL_UNAVAILABLE', true],
    [503, 'MODEL_UNAVAILABLE', true],
    [418, 'MODEL_UNAVAILABLE', true],
  ])(
    'classifies HTTP %i as %s without ambiguity',
    async (code, expected, retryable) => {
      const call = gateway(
        fixtureTransport(status(code, errorBody('nope'))),
      ).generate(fixtureRequest, callContext());

      await expect(call).rejects.toMatchObject({
        data: { code: expected, stage: 'calling-model', retryable },
      });
      await expect(call).rejects.not.toBeInstanceOf(AmbiguousModelCallError);
    },
  );

  it('classifies an unparsable body as an invalid response', async () => {
    await expect(
      gateway(fixtureTransport(ok('not json'))).generate(
        fixtureRequest,
        callContext(),
      ),
    ).rejects.toMatchObject({
      data: { code: 'MODEL_INVALID_RESPONSE', retryable: false },
    });
  });

  it('classifies a provider-reported failed response as unavailable', async () => {
    await expect(
      gateway(fixtureTransport(ok(failedResponseBody))).generate(
        fixtureRequest,
        callContext(),
      ),
    ).rejects.toMatchObject({
      data: { code: 'MODEL_UNAVAILABLE', retryable: true },
    });
  });

  it('classifies a refusal with no output as a content filter', async () => {
    await expect(
      gateway(fixtureTransport(ok(refusedResponseBody))).generate(
        fixtureRequest,
        callContext(),
      ),
    ).rejects.toMatchObject({
      data: { code: 'MODEL_CONTENT_FILTER', retryable: false },
    });
  });
});

describe('OpenAI Responses ambiguity', () => {
  it.each([
    ['timeout', 'sent', 'TIMEOUT'],
    ['timeout', 'unknown', 'TIMEOUT'],
    ['network', 'sent', 'MODEL_UNAVAILABLE'],
    ['network', 'unknown', 'MODEL_UNAVAILABLE'],
    ['aborted', 'unknown', 'MODEL_UNAVAILABLE'],
  ] as const)(
    'treats %s with delivery %s as ambiguous',
    async (reason, delivery, expected) => {
      const call = gateway(
        fixtureTransport(noResponse(reason, delivery)),
      ).generate(fixtureRequest, callContext());

      await expect(call).rejects.toBeInstanceOf(AmbiguousModelCallError);
      await expect(call).rejects.toMatchObject({
        ambiguous: true,
        data: { code: expected, details: { delivery } },
      });
    },
  );

  it('treats proven non-delivery as a clean failure', async () => {
    const call = gateway(
      fixtureTransport(noResponse('network', 'not-sent')),
    ).generate(fixtureRequest, callContext());

    await expect(call).rejects.not.toBeInstanceOf(AmbiguousModelCallError);
    await expect(call).rejects.toMatchObject({
      data: { code: 'MODEL_UNAVAILABLE', retryable: true },
    });
  });

  it('treats a cancellation that never left as cancelled, not ambiguous', async () => {
    const call = gateway(
      fixtureTransport(noResponse('aborted', 'not-sent')),
    ).generate(fixtureRequest, callContext());

    await expect(call).rejects.not.toBeInstanceOf(AmbiguousModelCallError);
    await expect(call).rejects.toMatchObject({ data: { code: 'CANCELLED' } });
  });
});

describe('OpenAI Responses gateway guards', () => {
  it('reports configured capabilities without touching the transport', async () => {
    const transport = fixtureTransport(ok(completedResponseBody));
    await expect(
      gateway(transport).capabilities(fixtureSelection),
    ).resolves.toEqual(fixtureCapabilities);
    expect(transport.sent).toEqual([]);
  });

  it('rejects an unsupported required capability before sending', async () => {
    const transport = fixtureTransport(ok(completedResponseBody));
    await expect(
      gateway(transport).generate(
        fixtureRequest,
        callContext({ requiredCapabilities: { tools: true } }),
      ),
    ).rejects.toMatchObject({ data: { code: 'UNSUPPORTED_CAPABILITY' } });
    expect(transport.sent).toEqual([]);
  });

  it('rejects pre-call cancellation before sending', async () => {
    const controller = new AbortController();
    controller.abort();
    const transport = fixtureTransport(ok(completedResponseBody));
    await expect(
      gateway(transport).generate(
        fixtureRequest,
        callContext({ signal: controller.signal }),
      ),
    ).rejects.toMatchObject({ data: { code: 'CANCELLED' } });
    expect(transport.sent).toEqual([]);
  });

  it('rejects an unconfigured selection', async () => {
    await expect(
      gateway(fixtureTransport(ok(completedResponseBody))).generate(
        fixtureRequest,
        callContext({ selection: { profile: 'missing' } }),
      ),
    ).rejects.toMatchObject({ data: { code: 'INVALID_REQUEST' } });
  });

  it('sends no credential unless the composition root supplies one', async () => {
    const transport = fixtureTransport(ok(completedResponseBody));
    await gateway(transport).generate(fixtureRequest, callContext());
    expect(transport.sent[0]?.headers).toEqual({
      'content-type': 'application/json',
    });
  });
});
