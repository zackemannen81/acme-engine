import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  EXIT_OK,
  run,
  type RunOptions,
} from '../../apps/cli/src/index.js';
import { createTestPayloadEncryptor } from '../../packages/testing/src/index.js';

/**
 * ACME-0064 live multi-step ScenarioRunner path.
 * Excluded from default vitest; requires ACME_LIVE_TEST + OPENAI_API_KEY.
 */
const OPT_IN = process.env['ACME_LIVE_TEST'];
const API_KEY = process.env['OPENAI_API_KEY'];
const MODEL = process.env['ACME_LIVE_MODEL'] ?? 'gpt-5.6-luna';

const roots: string[] = [];
afterAll(() => {
  while (roots.length > 0) {
    rmSync(roots.pop() ?? '', { recursive: true, force: true });
  }
});

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
      payloadEncryptor: createTestPayloadEncryptor(),
      openAiModel: MODEL,
    },
  };
}

describe('ScenarioRunner multi-step live OpenAI', () => {
  it('runs two serial narrative executes against a live model', async () => {
    if (OPT_IN === undefined || OPT_IN.trim().length === 0) {
      throw new Error(
        'Refusing multi-step live scenario: set ACME_LIVE_TEST=1 explicitly.',
      );
    }
    if (API_KEY === undefined || API_KEY.trim().length === 0) {
      throw new Error(
        'Refusing multi-step live scenario: OPENAI_API_KEY is required.',
      );
    }

    const root = mkdtempSync(join(tmpdir(), 'acme-live-scenario-'));
    roots.push(root);
    writeFileSync(
      join(root, 'input-1.json'),
      JSON.stringify({
        documentKey: 'live-scenario-ch-1',
        title: 'Live Signal',
        text: 'Mira tells Ion that water freezes at zero Celsius under standard pressure.',
      }),
    );
    writeFileSync(
      join(root, 'input-2.json'),
      JSON.stringify({
        documentKey: 'live-scenario-ch-2',
        title: 'Live Echo',
        text: 'Ion notes that Mira stated a freezing-point rule about water.',
      }),
    );
    const scenarioPath = join(root, 'live-multi.yaml');
    const stamp = Date.now().toString(36);
    writeFileSync(
      scenarioPath,
      `schemaVersion: acme-scenario/1
name: live-multi-openai
seed:
  clock: '2026-08-06T16:00:00.000Z'
  ids: sequential
  idPrefix: live-ms
  idPadding: 3
composition:
  repository: memory
  gateway: openai
steps:
  - execute:
      as: first
      requestKey: live-ms-1-${stamp}
      namespace: narrative
      task: observe-document
      entityId: live-story-ms
      expectedRevision: 0
      fixture: input-1.json
      model:
        profile: live-openai
      policy:
        retention: hash-only
        maxModelCalls: 1
  - assert:
      execution: first
      status: committed
  - execute:
      as: second
      requestKey: live-ms-2-${stamp}
      namespace: narrative
      task: observe-document
      entityId: live-story-ms
      expectedRevision: 1
      fixture: input-2.json
      model:
        profile: live-openai
      policy:
        retention: hash-only
        maxModelCalls: 1
  - assert:
      execution: second
      status: committed
`,
    );

    const io = capture();
    const code = await run(['scenario', 'run', scenarioPath, '--json'], io.options);
    if (code !== EXIT_OK) {
      // eslint-disable-next-line no-console
      console.error(io.out.join('\n'), io.err.join('\n'));
    }
    expect(code).toBe(EXIT_OK);
    const body = JSON.parse(io.out.join('\n')) as {
      report: { status: string; steps: { kind: string; status: string }[] };
    };
    expect(body.report.status).toBe('passed');
    expect(body.report.steps.filter((s) => s.kind === 'execute')).toHaveLength(
      2,
    );
  }, 120_000);
});
