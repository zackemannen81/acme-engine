import { describe, expect, it } from 'vitest';

import {
  LIVE_SAFETY_REFUSAL,
  LiveSafetyRefused,
  assertLiveBudget,
  assertLiveDeploymentBudget,
  assertNoLiveCredentialFields,
  isLiveOptInValue,
  requireLiveCredential,
} from '../src/index.js';

describe('live safety', () => {
  it('rejects nested credential fields without echoing their value', () => {
    let error: unknown;
    try {
      assertNoLiveCredentialFields({ nested: { apiKey: 'never-echo-me' } });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(LiveSafetyRefused);
    expect((error as LiveSafetyRefused).reason).toBe(
      LIVE_SAFETY_REFUSAL.credentials,
    );
    expect((error as Error).message).not.toContain('never-echo-me');
  });

  it('recognizes only explicit opt-in spellings', () => {
    expect(isLiveOptInValue(' yes ')).toBe(true);
    expect(isLiveOptInValue('0')).toBe(false);
    expect(isLiveOptInValue(undefined)).toBe(false);
  });

  it('never includes a missing or supplied credential in its refusal', () => {
    expect(() => requireLiveCredential('')).toThrow(LiveSafetyRefused);
    expect(requireLiveCredential('  secret-value  ')).toBe('secret-value');
  });

  it('enforces run, confirmation and deployment call/cost ceilings', () => {
    expect(() =>
      assertLiveBudget({
        requested: { maxModelCalls: 1, costCeilingMinor: 20 },
        confirmed: { maxModelCalls: 2, costCeilingMinor: 40 },
        deployment: { maxModelCalls: 3, costCeilingMinor: 50 },
      }),
    ).not.toThrow();
    expect(() =>
      assertLiveBudget({
        requested: { maxModelCalls: 1, costCeilingMinor: null },
        confirmed: { maxModelCalls: 1, costCeilingMinor: 40 },
        deployment: { maxModelCalls: 1, costCeilingMinor: 50 },
      }),
    ).toThrowError(
      expect.objectContaining({ reason: LIVE_SAFETY_REFUSAL.costBudget }),
    );
    expect(() =>
      assertLiveBudget({
        requested: { maxModelCalls: 2, costCeilingMinor: null },
        confirmed: { maxModelCalls: 1, costCeilingMinor: null },
        deployment: { maxModelCalls: 1, costCeilingMinor: null },
      }),
    ).toThrowError(
      expect.objectContaining({ reason: LIVE_SAFETY_REFUSAL.callBudget }),
    );
  });

  it('accepts a deployment that declines to cap the campaign', () => {
    // ADR-0044 retired the campaign cap. An absent deployment ceiling is a
    // valid deployment, not a refusal, and never means zero calls.
    expect(() =>
      assertLiveDeploymentBudget({
        maxModelCalls: null,
        costCeilingMinor: null,
      }),
    ).not.toThrow();
    expect(() =>
      assertLiveBudget({
        requested: { maxModelCalls: 4, costCeilingMinor: null },
        confirmed: { maxModelCalls: 9, costCeilingMinor: null },
        deployment: { maxModelCalls: null, costCeilingMinor: null },
      }),
    ).not.toThrow();
  });

  it('still bounds one execution when the campaign is uncapped', () => {
    // Bounding an execution is runaway protection and survives the retirement.
    expect(() =>
      assertLiveBudget({
        requested: { maxModelCalls: 2, costCeilingMinor: null },
        confirmed: { maxModelCalls: 1, costCeilingMinor: null },
        deployment: { maxModelCalls: null, costCeilingMinor: null },
      }),
    ).toThrowError(
      expect.objectContaining({ reason: LIVE_SAFETY_REFUSAL.callBudget }),
    );
    expect(() =>
      assertLiveBudget({
        requested: { maxModelCalls: 0, costCeilingMinor: null },
        confirmed: { maxModelCalls: 1, costCeilingMinor: null },
        deployment: { maxModelCalls: null, costCeilingMinor: null },
      }),
    ).toThrowError(
      expect.objectContaining({ reason: LIVE_SAFETY_REFUSAL.deploymentBudget }),
    );
  });

  it('still enforces a deployment ceiling when one is configured', () => {
    expect(() =>
      assertLiveBudget({
        requested: { maxModelCalls: 1, costCeilingMinor: null },
        confirmed: { maxModelCalls: 4, costCeilingMinor: null },
        deployment: { maxModelCalls: 3, costCeilingMinor: null },
      }),
    ).toThrowError(
      expect.objectContaining({ reason: LIVE_SAFETY_REFUSAL.callBudget }),
    );
    expect(() =>
      assertLiveDeploymentBudget({
        maxModelCalls: 0,
        costCeilingMinor: null,
      }),
    ).toThrowError(
      expect.objectContaining({ reason: LIVE_SAFETY_REFUSAL.deploymentBudget }),
    );
  });
});
