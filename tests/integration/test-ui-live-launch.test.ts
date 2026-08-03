import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ProviderTransport } from '../../packages/adapter-model-openai/src/index.js';
import type { ExecutionRequest } from '../../packages/core/src/index.js';
import { afterEach, describe, expect, it } from 'vitest';

import {
  buildLiveEvaluationView,
  buildMeasurementView,
  isAvailable,
  LIVE_CONFIRMATION_VERSION,
  LiveGateRefused,
} from '../../apps/test-ui/src/index.js';
import {
  createFileWorkspace,
  launchLiveExecution,
} from '../../apps/test-ui/src/local.js';

/**
 * Phase 6 exit (ADR-0023): live launch is gated; offline transport proves the
 * path without a network call; the recorded run enters only the live
 * measurement series.
 */

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root !== undefined) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

function workspaceRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'acme-test-ui-live-'));
  roots.push(root);
  return root;
}

const confirmation = {
  version: LIVE_CONFIRMATION_VERSION,
  optIn: true,
  provider: 'openai',
  model: 'gpt-fixture-1',
  caseCount: 1,
  maxModelCalls: 1,
  costCeilingMinor: 100,
  currency: 'USD',
  confirmer: 'integration-tester',
  rationale: 'Offline transport proof of gated live launch.',
};

const narrativeOutput = {
  observations: [
    {
      type: 'character-fact',
      subject: 'Mira',
      predicate: 'eye color',
      value: 'green',
      confidence: 0.9,
    },
  ],
  scene: {
    location: 'Observatory',
    time: 'Night',
    summary: 'Mira notes the northern light rule.',
  },
};

const request: ExecutionRequest = {
  requestKey: 'test-ui-live-1',
  namespace: 'narrative',
  task: 'observe-document',
  entityId: 'story-live-1',
  expectedRevision: 0,
  input: {
    documentKey: 'chapter-live-1',
    title: 'Northern Light',
    text: 'Mira tells Ion that her eyes are green. The northern light reveals hidden paths.',
  },
  model: {
    profile: 'offline-json',
    providerHint: 'openai',
    modelHint: 'responses',
  },
  policy: {
    retention: 'hash-only',
    maxModelCalls: 1,
    maxRepairCalls: 0,
    maxRevisionCalls: 0,
  },
};

function offlineTransport(): ProviderTransport {
  const body = JSON.stringify({
    id: 'resp_test_ui_live',
    model: 'gpt-fixture-1',
    status: 'completed',
    output: [
      {
        type: 'message',
        content: [
          {
            type: 'output_text',
            text: JSON.stringify(narrativeOutput),
          },
        ],
      },
    ],
    usage: { input_tokens: 11, output_tokens: 7, total_tokens: 18 },
  });
  return {
    async send() {
      return { kind: 'response', status: 200, headers: {}, body };
    },
  };
}

describe('test-ui gated live launch', () => {
  it('refuses without env opt-in', async () => {
    const root = workspaceRoot();
    const workspace = createFileWorkspace({ root });
    await expect(
      launchLiveExecution({
        confirmation,
        request,
        workspace,
        runId: 'live-refused',
        clock: { now: () => '2026-08-02T12:00:00.000Z' },
        ids: {
          next(kind) {
            return `${kind}-live-refused`;
          },
        },
        repository: 'memory',
        liveOptIn: false,
        openAiTransport: offlineTransport(),
        apiKey: 'test-not-a-real-key',
      }),
    ).rejects.toBeInstanceOf(LiveGateRefused);
  });

  it('refuses a confirmation that embeds credentials', async () => {
    const root = workspaceRoot();
    const workspace = createFileWorkspace({ root });
    await expect(
      launchLiveExecution({
        confirmation: { ...confirmation, apiKey: 'sk-leak' },
        request,
        workspace,
        runId: 'live-cred',
        clock: { now: () => '2026-08-02T12:00:00.000Z' },
        ids: {
          next(kind) {
            return `${kind}-live-cred`;
          },
        },
        repository: 'memory',
        liveOptIn: true,
        openAiTransport: offlineTransport(),
        apiKey: 'test-not-a-real-key',
      }),
    ).rejects.toThrow(/credential/i);
  });

  it('launches through an offline transport and partitions measurement', async () => {
    const root = workspaceRoot();
    const workspace = createFileWorkspace({ root });
    let seq = 0;
    const result = await launchLiveExecution({
      confirmation,
      request,
      workspace,
      runId: 'live-ok',
      clock: {
        now: () => {
          seq += 1;
          return `2026-08-02T12:00:0${seq}.000Z`;
        },
      },
      ids: {
        next(kind) {
          return `${kind}-live-ok`;
        },
      },
      repository: 'memory',
      liveOptIn: true,
      openAiTransport: offlineTransport(),
      apiKey: 'test-not-a-real-key',
    });

    expect(result.record.status).toBe('passed');
    expect(result.record.composition.gateway).toBe('openai');
    expect(result.record.live?.confirmer).toBe('integration-tester');
    expect(result.executionId.length).toBeGreaterThan(0);

    const history = await workspace.listRuns();
    expect(history.records).toHaveLength(1);

    const liveView = buildLiveEvaluationView({
      confirmation: result.confirmation,
      records: history.records,
    });
    expect(liveView.series).toBe('live');
    expect(liveView.runs.runCount).toBe(1);
    if (isAvailable(liveView.cost)) {
      expect(liveView.cost.totalTokens).toBeGreaterThan(0);
    }

    const measurement = buildMeasurementView({ records: history.records });
    expect(measurement.deterministic.runCount).toBe(0);
    expect(measurement.live.runCount).toBe(1);
    const livePass = measurement.live.measures.find(
      (entry) => entry.id === 'runPassRate',
    );
    expect(livePass?.sampleSize).toBe(1);
    expect(livePass?.observed).toBe(1);

    result.composition.close();
  });
});
