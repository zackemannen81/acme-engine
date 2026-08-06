import { describe, expect, it } from 'vitest';

import {
  assertWithinBudget,
  buildLiveEvaluationView,
  isAvailable,
  isLiveOptInEnv,
  LIVE_CONFIRMATION_VERSION,
  LIVE_EVALUATION_VIEW_VERSION,
  LIVE_GATE_REFUSAL,
  LiveGateRefused,
  parseLiveConfirmation,
  requireLiveGate,
  RUN_RECORD_VERSION,
  VIEW_UNAVAILABLE,
  type LiveEvaluationConfirmation,
  type RunRecord,
} from '../src/index.js';

const validConfirmation = {
  version: LIVE_CONFIRMATION_VERSION,
  optIn: true,
  provider: 'openai',
  model: 'gpt-5.6-luna',
  caseCount: 1,
  maxModelCalls: 1,
  costCeilingMinor: 50,
  currency: 'USD',
  confirmer: 'alice',
  rationale: 'Budgeted smoke of narrative observe against OpenAI.',
} as const;

function liveRecord(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    version: RUN_RECORD_VERSION,
    runId: 'live-001',
    planName: 'live-evaluation',
    scenarioName: 'live-evaluation',
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z',
    composition: { repository: 'memory', gateway: 'openai' },
    status: 'passed',
    steps: [{ index: 0, kind: 'execute', status: 'passed' }],
    cases: [{ alias: 'live', executionId: 'execution_live' }],
    failure: null,
    live: {
      provider: 'openai',
      model: 'gpt-5.6-luna',
      confirmer: 'alice',
      maxModelCalls: 1,
      costCeilingMinor: 50,
      usage: { totalTokens: 100, estimatedCostMinor: 2, currency: 'USD' },
    },
    ...overrides,
  };
}

describe('live confirmation gate', () => {
  it('accepts a valid confirmation', () => {
    const parsed = parseLiveConfirmation(validConfirmation);
    expect(parsed).toMatchObject({
      version: LIVE_CONFIRMATION_VERSION,
      optIn: true,
      provider: 'openai',
      caseCount: 1,
      confirmer: 'alice',
    });
  });

  it('refuses missing opt-in', () => {
    expect(() =>
      parseLiveConfirmation({ ...validConfirmation, optIn: false }),
    ).toThrow(LiveGateRefused);
    try {
      parseLiveConfirmation({ ...validConfirmation, optIn: false });
    } catch (error) {
      expect(error).toBeInstanceOf(LiveGateRefused);
      expect((error as LiveGateRefused).reason).toBe(LIVE_GATE_REFUSAL.optIn);
    }
  });

  it('refuses credential-shaped fields', () => {
    expect(() =>
      parseLiveConfirmation({
        ...validConfirmation,
        apiKey: 'sk-secret',
      }),
    ).toThrowError(/credential/i);
  });

  it('refuses caseCount other than 1', () => {
    expect(() =>
      parseLiveConfirmation({ ...validConfirmation, caseCount: 2 }),
    ).toThrowError(/caseCount/);
  });

  it('refuses empty confirmer and rationale', () => {
    expect(() =>
      parseLiveConfirmation({ ...validConfirmation, confirmer: '  ' }),
    ).toThrow(LiveGateRefused);
    expect(() =>
      parseLiveConfirmation({ ...validConfirmation, rationale: '' }),
    ).toThrow(LiveGateRefused);
  });

  it('requireLiveGate needs process opt-in', () => {
    expect(() =>
      requireLiveGate({ liveOptIn: false, confirmation: validConfirmation }),
    ).toThrowError(/ACME_TEST_UI_LIVE/);
    expect(
      requireLiveGate({ liveOptIn: true, confirmation: validConfirmation })
        .confirmer,
    ).toBe('alice');
  });

  it('assertWithinBudget refuses an oversized request', () => {
    const confirmation = parseLiveConfirmation(validConfirmation);
    expect(() => assertWithinBudget(confirmation, 2)).toThrowError(/ceiling/);
    expect(() => assertWithinBudget(confirmation, 1)).not.toThrow();
  });

  it('isLiveOptInEnv accepts 1/true/yes only', () => {
    expect(isLiveOptInEnv(undefined)).toBe(false);
    expect(isLiveOptInEnv('0')).toBe(false);
    expect(isLiveOptInEnv('1')).toBe(true);
    expect(isLiveOptInEnv('true')).toBe(true);
    expect(isLiveOptInEnv('YES')).toBe(true);
  });
});

describe('S10 live evaluation view', () => {
  it('labels the series live and excludes mock runs', () => {
    const mockOnly: RunRecord = {
      version: RUN_RECORD_VERSION,
      runId: 'mock-001',
      planName: 'plan',
      scenarioName: 'plan',
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:00:01.000Z',
      composition: { repository: 'memory', gateway: 'mock' },
      status: 'passed',
      steps: [{ index: 0, kind: 'execute', status: 'passed' }],
      cases: [{ alias: 'a', executionId: 'e1' }],
      failure: null,
    };

    const confirmation = parseLiveConfirmation(
      validConfirmation,
    ) as LiveEvaluationConfirmation;
    const view = buildLiveEvaluationView({
      confirmation,
      records: [mockOnly, liveRecord()],
    });

    expect(view.view).toBe(LIVE_EVALUATION_VIEW_VERSION);
    expect(view.series).toBe('live');
    expect(view.runs.runCount).toBe(1);
    expect(view.runs.items[0]?.runId).toBe('live-001');
    if (!isAvailable(view.confirmation)) {
      throw new Error('confirmation should be available');
    }
    expect(view.confirmation.confirmer).toBe('alice');
    // No credentials on the view (provider name "openai" is not a secret).
    expect(JSON.stringify(view)).not.toMatch(
      /sk-|apiKey|api_key|OPENAI_API_KEY/i,
    );
    expect(JSON.parse(JSON.stringify(view)) as unknown).toStrictEqual(view);
  });

  it('reports unavailable confirmation and cost when absent', () => {
    const view = buildLiveEvaluationView({ records: [] });
    expect(view.confirmation).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.liveConfirmation,
    });
    expect(view.cost).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.liveCost,
    });
    expect(view.runs.runCount).toBe(0);
  });

  it('aggregates cost only from live records that retained usage', () => {
    const view = buildLiveEvaluationView({
      records: [
        liveRecord({ runId: 'live-a' }),
        liveRecord({
          runId: 'live-b',
          live: {
            provider: 'openai',
            model: 'gpt-5.6-luna',
            confirmer: 'alice',
            maxModelCalls: 1,
            costCeilingMinor: null,
            usage: { totalTokens: 50, estimatedCostMinor: 3, currency: 'USD' },
          },
        }),
      ],
    });
    if (!isAvailable(view.cost)) {
      throw new Error('cost should be available');
    }
    expect(view.cost.totalTokens).toBe(150);
    expect(view.cost.estimatedCostMinor).toBe(5);
    expect(view.cost.sampleSize).toBe(2);
  });
});
