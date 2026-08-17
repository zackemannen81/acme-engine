import { describe, expect, it } from 'vitest';

import { summarizeModelCallUsage } from '../src/model-call-usage.js';
import type { ModelCallMetadata } from '../src/payload-encryptor.js';
import type { ModelCallRecord } from '../src/repository-model-call.js';

const base = {
  executionId: 'execution-1',
  callKey: 'model:0',
  attempt: 1,
  purpose: 'primary',
  selection: { profile: 'fixture' },
  requestHash: 'request-hash',
  startedAt: '2026-08-16T08:00:00.000Z',
} as const;

function call(
  modelCallId: string,
  overrides: Partial<ModelCallRecord> = {},
): ModelCallRecord {
  return {
    ...base,
    modelCallId,
    status: 'succeeded',
    ...overrides,
  } as ModelCallRecord;
}

function metadata(usage: Record<string, unknown>): ModelCallMetadata {
  return {
    provider: 'openai',
    model: 'gpt-5.6-luna',
    finishReason: 'stop',
    usage,
  } as ModelCallMetadata;
}

describe('summarizeModelCallUsage', () => {
  it('sums reported usage and names the models that were called', () => {
    const summary = summarizeModelCallUsage([
      call('call-1', {
        callMetadata: metadata({ inputTokens: 66_819, outputTokens: 650 }),
      }),
      call('call-2', {
        callMetadata: metadata({ inputTokens: 2_925, outputTokens: 2_990 }),
      }),
    ]);

    expect(summary.calls).toBe(2);
    expect(summary.succeeded).toBe(2);
    expect(summary.callsReportingUsage).toBe(2);
    expect(summary.inputTokens).toBe(69_744);
    expect(summary.outputTokens).toBe(3_640);
    expect(summary.models).toEqual([
      { provider: 'openai', model: 'gpt-5.6-luna', calls: 2 },
    ]);
  });

  it('reports absent usage as absent rather than as zero', () => {
    const summary = summarizeModelCallUsage([
      call('call-1', { callMetadata: metadata({}) }),
    ]);

    // A provider that reports nothing must not read as a free call.
    expect(summary.calls).toBe(1);
    expect(summary.callsReportingUsage).toBe(0);
    expect(summary.inputTokens).toBeNull();
    expect(summary.outputTokens).toBeNull();
    expect(summary.estimatedCostMinor).toBeNull();
    expect(summary.currency).toBeNull();
  });

  it('says how much of the set the totals cover', () => {
    const summary = summarizeModelCallUsage([
      call('call-1', { callMetadata: metadata({ inputTokens: 100 }) }),
      call('call-2', { callMetadata: metadata({}) }),
    ]);

    expect(summary.calls).toBe(2);
    expect(summary.callsReportingUsage).toBe(1);
    expect(summary.inputTokens).toBe(100);
  });

  it('refuses to sum costs across currencies', () => {
    const summary = summarizeModelCallUsage([
      call('call-1', {
        callMetadata: metadata({ estimatedCostMinor: 100, currency: 'SEK' }),
      }),
      call('call-2', {
        callMetadata: metadata({ estimatedCostMinor: 100, currency: 'USD' }),
      }),
    ]);

    expect(summary.estimatedCostMinor).toBeNull();
    expect(summary.currency).toBeNull();
  });

  it('counts every outcome and falls back to a retained response', () => {
    const summary = summarizeModelCallUsage([
      call('call-1', { callMetadata: metadata({ inputTokens: 10 }) }),
      call('call-2', { status: 'failed' }),
      call('call-3', { status: 'ambiguous' }),
      call('call-4', { status: 'reserved' }),
      call('call-5', {
        response: {
          provider: 'mock',
          model: 'scripted',
          receivedAt: '2026-08-16T08:00:00.000Z',
          finishReason: 'stop',
          text: '{}',
          usage: { inputTokens: 5 },
          metadata: {},
        },
      } as Partial<ModelCallRecord>),
    ]);

    expect(summary).toMatchObject({
      calls: 5,
      succeeded: 2,
      failed: 1,
      ambiguous: 1,
      pending: 1,
      inputTokens: 15,
    });
    expect(summary.models).toEqual([
      { provider: 'mock', model: 'scripted', calls: 1 },
      { provider: 'openai', model: 'gpt-5.6-luna', calls: 1 },
    ]);
  });
});
