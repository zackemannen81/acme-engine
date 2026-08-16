import { describe, expect, it } from 'vitest';

import {
  createEvidenceSingleCallGateway,
  EVIDENCE_LIVE_PROVIDER_CALL_CEILING,
  EVIDENCE_LIVE_REPAIR_BUDGET,
} from '../src/live-observation.js';
import type { ModelGateway, ModelRequest } from '@acme/core';

const request = {
  messages: [],
  output: { mode: 'json', schemaName: 'fixture', jsonSchema: {} },
} as ModelRequest;

describe('live repair budget', () => {
  it('admits one primary call plus one repair and refuses a third', async () => {
    expect(EVIDENCE_LIVE_REPAIR_BUDGET).toBe(1);
    expect(EVIDENCE_LIVE_PROVIDER_CALL_CEILING).toBe(2);
    const calls = { value: 0 };
    let generated = 0;
    const inner: ModelGateway = {
      async capabilities() {
        return { structuredOutput: true, tools: false, vision: false };
      },
      async generate() {
        generated += 1;
        return {
          provider: 'fixture',
          model: 'fixture',
          receivedAt: '2026-08-16T00:00:00.000Z',
          finishReason: 'stop',
          text: '{}',
          usage: {},
          metadata: {},
        };
      },
    };
    const gateway = createEvidenceSingleCallGateway({
      gateway: inner,
      calls,
      maxCalls: EVIDENCE_LIVE_PROVIDER_CALL_CEILING,
    });
    const context = {
      executionId: 'execution-fixture',
      callKey: 'model:0',
      selection: { profile: 'fixture' },
      requiredCapabilities: { structuredOutput: true },
      timeoutMs: 1_000,
      signal: new AbortController().signal,
    };
    await gateway.generate(request, context);
    await gateway.generate(request, { ...context, callKey: 'repair:1' });
    expect(generated).toBe(2);
    await expect(
      gateway.generate(request, { ...context, callKey: 'repair:2' }),
    ).rejects.toMatchObject({ code: 'LIVE_MODEL_CALL_BUDGET_EXHAUSTED' });
    expect(generated).toBe(2);
  });
});
