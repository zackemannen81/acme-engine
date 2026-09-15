import { describe, expect, it } from 'vitest';

import { validateAcmeModelRuntimeRequest } from '../src/acme-model-runtime-host.js';
import {
  ACME_MODEL_RUNTIME_PROTOCOL_VERSION,
  ACME_MODEL_RUNTIME_V2_PROTOCOL_VERSION,
} from '../src/acme-model-runtime-wire.js';

const baseRequest = {
  requestKey: 'req-1',
  model: { profile: 'default', providerHint: 'openai', modelHint: 'luna' },
  request: {
    messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
    output: { mode: 'text' },
    temperature: 0.2,
    maxOutputTokens: 1024,
  },
};

describe('acme-model-runtime request versions', () => {
  it('keeps v1 closed to the additive generation controls', () => {
    expect(() =>
      validateAcmeModelRuntimeRequest(
        {
          protocolVersion: ACME_MODEL_RUNTIME_PROTOCOL_VERSION,
          ...baseRequest,
          request: { ...baseRequest.request, topP: 0.9 },
        },
        ACME_MODEL_RUNTIME_PROTOCOL_VERSION,
      ),
    ).toThrowError(/invalid shape/u);
  });

  it('accepts v2 generation controls and rejects unknown fields', () => {
    const parsed = validateAcmeModelRuntimeRequest(
      {
        protocolVersion: ACME_MODEL_RUNTIME_V2_PROTOCOL_VERSION,
        ...baseRequest,
        request: {
          ...baseRequest.request,
          topP: 0.9,
          reasoningBudget: 256,
          enableThinking: true,
          reasoningEffort: 'high',
          seed: 7,
        },
      },
      ACME_MODEL_RUNTIME_V2_PROTOCOL_VERSION,
    );
    expect(parsed.protocolVersion).toBe(ACME_MODEL_RUNTIME_V2_PROTOCOL_VERSION);
    expect(parsed.request).toMatchObject({
      topP: 0.9,
      reasoningBudget: 256,
      enableThinking: true,
      reasoningEffort: 'high',
      seed: 7,
    });
    expect(() =>
      validateAcmeModelRuntimeRequest(
        {
          protocolVersion: ACME_MODEL_RUNTIME_V2_PROTOCOL_VERSION,
          ...baseRequest,
          extra: true,
        },
        ACME_MODEL_RUNTIME_V2_PROTOCOL_VERSION,
      ),
    ).toThrowError(/invalid shape/u);
  });
});
