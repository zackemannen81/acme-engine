import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { ProviderTransport } from '@acme/adapter-model-openai';

import {
  EVIDENCE_LIVE_CONFIRMATION_VERSION,
  EVIDENCE_LIVE_REFUSAL,
  EVIDENCE_POC1_LIVE_PROFILE_VERSION,
  EVIDENCE_STAGE_A_DATA_CLASS,
  createEvidenceLiveCapability,
  parseEvidenceLiveConfirmation,
} from '../src/live.js';
import { createLocalEvidenceWorkbench } from '../src/local.js';

const now = '2026-08-15T01:30:00.000Z';
const confirmation = {
  version: EVIDENCE_LIVE_CONFIRMATION_VERSION,
  optIn: true,
  provider: 'openai',
  model: 'gpt-live-test',
  caseId: 'case-1',
  maxModelCalls: 3,
  costCeilingMinor: 100,
  currency: 'SEK',
  rationale: 'Bounded Stage A proof.',
} as const;
const authorization = {
  schemaVersion: 'evidence-case-authorization-context/1',
  principalRef: 'principal-1',
  organizationId: 'organization-1',
  organizationMembershipId: 'organization-membership-1',
  effectiveOrganizationRole: 'organization-admin',
  caseId: 'case-1',
  workspaceId: 'workspace-1',
  caseMembershipId: 'case-membership-1',
  effectiveCaseRole: 'case-admin',
  action: 'live-model.run',
  policyVersion: 'evidence-case-auth-policy/1',
  decidedAt: now,
} as const;
const source = {
  sourceOrigin: 'authorized-external',
  dataClass: EVIDENCE_STAGE_A_DATA_CLASS,
  artifactVersionId: 'artifact-version-1',
  externalSourceRef: 'sha256:external-parent',
  authorityAttested: true,
} as const;
const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0)
    rmSync(roots.pop() ?? '', { recursive: true, force: true });
});

function capability(overrides: Record<string, unknown> = {}) {
  return createEvidenceLiveCapability({
    liveOptIn: true,
    hosted: true,
    profile: EVIDENCE_POC1_LIVE_PROFILE_VERSION,
    persistence: 'durable-postgresql',
    modelGateway: 'live-provider',
    model: 'gpt-live-test',
    apiKey: 'test-only-key',
    payloadKey: new Uint8Array(32).fill(7),
    payloadKeyId: 'payload-key-1',
    deploymentBudget: { maxModelCalls: 3, costCeilingMinor: 100 },
    deploymentCurrency: 'SEK',
    clock: { now: () => now },
    ...overrides,
  });
}

describe('Evidence live composition', () => {
  it('keeps the default product composition scripted and live-disabled', async () => {
    const root = mkdtempSync(join(tmpdir(), 'acme-evidence-live-default-'));
    roots.push(root);
    const composition = await createLocalEvidenceWorkbench({
      dataFile: join(root, 'product.json'),
      seedMode: 'none',
      live: { liveOptIn: false },
    });
    try {
      expect(composition.liveCapability).toBeNull();
      expect(typeof composition.gateway.assertAllConsumed).toBe('function');
      expect(composition.gateway.invocations()).toEqual([]);
    } finally {
      await composition.close();
    }
  });

  it('keeps credentials alone disabled and provider unreachable', () => {
    expect(
      createEvidenceLiveCapability({
        liveOptIn: false,
        hosted: true,
        profile: EVIDENCE_POC1_LIVE_PROFILE_VERSION,
        persistence: 'durable-postgresql',
        modelGateway: 'live-provider',
        model: 'gpt-live-test',
        apiKey: 'ambient-key',
        payloadKey: new Uint8Array(32),
        payloadKeyId: 'payload-key-1',
        deploymentBudget: { maxModelCalls: 3, costCeilingMinor: null },
        deploymentCurrency: null,
        clock: { now: () => now },
      }),
    ).toBeNull();
  });

  it.each([
    ['hosted', { hosted: false }, EVIDENCE_LIVE_REFUSAL.hosted],
    ['postgres', { persistence: 'file' }, EVIDENCE_LIVE_REFUSAL.persistence],
    [
      'provider',
      { modelGateway: 'scripted-mock' },
      EVIDENCE_LIVE_REFUSAL.gateway,
    ],
    [
      'payload key',
      { payloadKey: new Uint8Array(31) },
      EVIDENCE_LIVE_REFUSAL.payloadKey,
    ],
  ])('refuses a mixed composition without %s', (_label, override, reason) => {
    expect(() => capability(override)).toThrowError(
      expect.objectContaining({ reason }),
    );
  });

  it('rejects actor and credential fields from the confirmation', () => {
    expect(() =>
      parseEvidenceLiveConfirmation({ ...confirmation, actor: 'browser' }),
    ).toThrowError(
      expect.objectContaining({ reason: EVIDENCE_LIVE_REFUSAL.confirmation }),
    );
    expect(() =>
      parseEvidenceLiveConfirmation({
        ...confirmation,
        nested: { apiKey: 'never-echo' },
      }),
    ).toThrowError(/credential/i);
  });

  it('requires case-admin authority and authorized Stage A origin', () => {
    const live = capability();
    if (live === null) throw new Error('expected live capability');
    expect(JSON.stringify(live)).not.toContain('test-only-key');
    expect(() =>
      live.authorize({
        confirmation,
        authorization: {
          ...authorization,
          effectiveCaseRole: 'case-reviewer',
        },
        source,
        requestedBudget: { maxModelCalls: 1, costCeilingMinor: 50 },
      }),
    ).toThrowError(
      expect.objectContaining({
        reason: EVIDENCE_LIVE_REFUSAL.executionAuthority,
      }),
    );
    expect(() =>
      live.authorize({
        confirmation,
        authorization,
        source: {
          ...source,
          dataClass: 'synthetic-utf8-plain-text/1' as never,
        },
        requestedBudget: { maxModelCalls: 1, costCeilingMinor: 50 },
      }),
    ).toThrowError(
      expect.objectContaining({ reason: EVIDENCE_LIVE_REFUSAL.dataClass }),
    );
  });

  it('reaches the OpenAI adapter only after the full tuple is authorized', async () => {
    let sends = 0;
    const transport: ProviderTransport = {
      async send() {
        sends += 1;
        return {
          kind: 'response',
          status: 200,
          headers: {},
          body: JSON.stringify({
            id: 'response-1',
            model: 'gpt-live-test',
            status: 'completed',
            output: [
              {
                type: 'message',
                content: [{ type: 'output_text', text: '{"observations":[]}' }],
              },
            ],
            usage: { input_tokens: 2, output_tokens: 1, total_tokens: 3 },
          }),
        };
      },
    };
    const live = capability({ transport });
    if (live === null) throw new Error('expected live capability');
    expect(sends).toBe(0);
    const run = live.authorize({
      confirmation,
      authorization,
      source,
      requestedBudget: { maxModelCalls: 1, costCeilingMinor: 50 },
    });
    expect(sends).toBe(0);
    const selection = run.selection('observe-artifact');
    await run.gateway.generate(
      {
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Bounded source request.' }],
          },
        ],
        output: {
          mode: 'json',
          schemaName: 'evidence_observations',
          jsonSchema: {
            type: 'object',
            properties: {
              observations: { type: 'array', items: { type: 'string' } },
            },
            required: ['observations'],
            additionalProperties: false,
          },
        },
      },
      {
        executionId: 'execution-1',
        callKey: 'model:0',
        selection,
        requiredCapabilities: { structuredOutput: true },
        timeoutMs: 1_000,
        signal: new AbortController().signal,
      },
    );
    expect(sends).toBe(1);
  });

  it('resolves with no configured campaign ceiling and still bounds a run', () => {
    // ADR-0044: an absent deployment ceiling is a valid live deployment.
    const uncapped = capability({
      deploymentBudget: { maxModelCalls: null, costCeilingMinor: null },
      deploymentCurrency: null,
    });
    expect(uncapped?.deployment.budget.maxModelCalls).toBeNull();

    const run = uncapped?.authorize({
      confirmation: {
        ...confirmation,
        maxModelCalls: 9,
        costCeilingMinor: null,
        currency: null,
      },
      authorization,
      source,
      requestedBudget: { maxModelCalls: 9, costCeilingMinor: null },
    });
    expect(run?.confirmation.maxModelCalls).toBe(9);

    // The execution bound still holds: a run may not exceed its confirmation.
    expect(() =>
      uncapped?.authorize({
        confirmation: {
          ...confirmation,
          maxModelCalls: 1,
          costCeilingMinor: null,
          currency: null,
        },
        authorization,
        source,
        requestedBudget: { maxModelCalls: 2, costCeilingMinor: null },
      }),
    ).toThrow();
  });
});
