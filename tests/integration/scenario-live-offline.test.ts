import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { ProviderTransport } from '../../packages/adapter-model-openai/src/index.js';
import {
  computeModelRequestHash,
  deriveExecutionId,
  type IdGenerator,
} from '../../packages/core/src/index.js';
import {
  narrativeObserveDocumentContract,
  narrativeObserveDocumentTask,
} from '../../packages/module-narrative/src/index.js';
import { createTestPayloadEncryptor } from '../../packages/testing/src/index.js';
import { EXIT_OK, run, type RunOptions } from '../../apps/cli/src/index.js';

/**
 * ACME-0064: multi-step scenario with composition.gateway openai, proven
 * offline through an injected transport (no network, no credentials).
 */

const now = '2026-08-06T15:00:00.000Z';
const entityId = 'story-live-offline';
const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop() ?? '', { recursive: true, force: true });
  }
});

function workspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'acme-scenario-live-'));
  roots.push(root);
  return root;
}

function createIds(): IdGenerator {
  const counts: Record<string, number> = {};
  return {
    next(kind) {
      counts[kind] = (counts[kind] ?? 0) + 1;
      return `${kind}-live-${String(counts[kind]).padStart(3, '0')}`;
    },
  };
}

function capture(): {
  readonly options: RunOptions;
  readonly out: string[];
  readonly err: string[];
} {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    options: {
      io: {
        stdout: (line) => out.push(line),
        stderr: (line) => err.push(line),
      },
      clock: { now: () => now },
      ids: createIds(),
      payloadEncryptor: createTestPayloadEncryptor(),
    },
  };
}

const output = {
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
    summary: 'Mira shares a rule with Ion.',
  },
};

describe('ScenarioRunner multi-step live gateway (offline injected transport)', () => {
  it('runs two execute steps through openai gateway without a network', async () => {
    const root = workspace();
    const input1 = {
      documentKey: 'chapter-live-1',
      title: 'Signal',
      text: 'Mira tells Ion that her eyes are green.',
    };
    const input2 = {
      documentKey: 'chapter-live-2',
      title: 'Echo',
      text: 'Ion trusts the northern light.',
    };
    writeFileSync(join(root, 'input-1.json'), JSON.stringify(input1));
    writeFileSync(join(root, 'input-2.json'), JSON.stringify(input2));

    const scenarioPath = join(root, 'live-multi.yaml');
    writeFileSync(
      scenarioPath,
      `schemaVersion: acme-scenario/1
name: live-multi-offline
seed:
  clock: '${now}'
  ids: sequential
  idPrefix: live-multi
  idPadding: 3
composition:
  repository: memory
  gateway: openai
steps:
  - execute:
      as: first
      requestKey: live-multi-1
      namespace: narrative
      task: observe-document
      entityId: ${entityId}
      expectedRevision: 0
      fixture: input-1.json
      model:
        profile: live-openai
      policy:
        retention: hash-only
  - assert:
      execution: first
      status: committed
      revision: 1
  - execute:
      as: second
      requestKey: live-multi-2
      namespace: narrative
      task: observe-document
      entityId: ${entityId}
      expectedRevision: 1
      fixture: input-2.json
      model:
        profile: live-openai
      policy:
        retention: hash-only
  - assert:
      execution: second
      status: committed
      revision: 2
`,
    );

    const body = JSON.stringify({
      id: 'resp_live_offline_multi',
      model: 'gpt-fixture-1',
      status: 'completed',
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: JSON.stringify(output) }],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
    });
    let sends = 0;
    const transport: ProviderTransport = {
      async send() {
        sends += 1;
        return { kind: 'response', status: 200, headers: {}, body };
      },
    };

    const io = capture();
    // ACME_LIVE_TEST is not required when transport is injected.
    await expect(
      run(['scenario', 'run', scenarioPath, '--json'], {
        ...io.options,
        openAiTransport: transport,
        openAiModel: 'gpt-fixture-1',
      }),
    ).resolves.toBe(EXIT_OK);

    const report = JSON.parse(io.out.join('\n')) as {
      report: {
        status: string;
        steps: { kind: string; status: string; detail: { gateway?: string } }[];
      };
    };
    expect(report.report.status).toBe('passed');
    expect(report.report.steps.map((s) => s.kind)).toEqual([
      'execute',
      'assert',
      'execute',
      'assert',
    ]);
    expect(report.report.steps.every((s) => s.status === 'passed')).toBe(true);
    expect(report.report.steps[0]?.detail.gateway).toBe('openai');
    expect(sends).toBe(2);

    // Prove request hashes are real (engine built requests against the contract).
    const executionId = deriveExecutionId('narrative', 'live-multi-1');
    const projected = await narrativeObserveDocumentTask.project(input1, {
      executionId,
      entityId,
      now,
      state: null,
      memories: [],
      documents: [],
    });
    const hash = computeModelRequestHash(
      narrativeObserveDocumentContract.buildRequest(projected, {
        executionId,
        now,
      }),
    );
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
