import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  EXIT_OK,
  EXIT_OUTCOME,
  EXIT_USAGE,
  resolveFixturePath,
  run,
  type RunOptions,
} from '../../apps/cli/src/index.js';
import {
  createTestPayloadEncryptor,
  parseScenario,
  SCENARIO_REPORT_VERSION,
} from '../../packages/testing/src/index.js';
import type { IdGenerator } from '../../packages/core/src/index.js';

const scenarioRoot = join(dirname(fileURLToPath(import.meta.url)), 'files');
const narrativeScenario = join(scenarioRoot, 'narrative-phase-5.yaml');

/**
 * The digest the hand-written Narrative Phase 5 acceptance test pins. The
 * scenario file must reach the same value through the same engine.
 */
const NARRATIVE_PHASE_5_DIGEST =
  '15f143ba7991e04065ad1ed6bc9f2df6942e05372d18f5d4469b2eba4ae5c94f';

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop() ?? '', { recursive: true, force: true });
  }
});

function workspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'acme-scenario-'));
  roots.push(root);
  return root;
}

function createIds(): IdGenerator {
  const counts: Record<string, number> = {};
  return {
    next(kind) {
      counts[kind] = (counts[kind] ?? 0) + 1;
      return `${kind}-scenario-${String(counts[kind]).padStart(3, '0')}`;
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
      clock: { now: () => '2026-07-31T12:00:00.000Z' },
      ids: createIds(),
      payloadEncryptor: createTestPayloadEncryptor(),
    },
  };
}

describe('ScenarioRunner over acme-scenario/1', () => {
  it('reproduces the Narrative Phase 5 operation digest from a scenario file', async () => {
    const io = capture();
    await expect(
      run(['scenario', 'run', narrativeScenario, '--json'], io.options),
    ).resolves.toBe(EXIT_OK);

    const body = JSON.parse(io.out.join('\n')) as {
      report: {
        version: string;
        name: string;
        status: string;
        steps: {
          kind: string;
          status: string;
          detail: Record<string, unknown>;
        }[];
      };
    };
    expect(body.report.version).toBe(SCENARIO_REPORT_VERSION);
    expect(body.report.name).toBe('narrative-phase-5');
    expect(body.report.status).toBe('passed');
    expect(body.report.steps.map((step) => step.kind)).toEqual([
      'execute',
      'assert',
      'replay',
      'assertDigest',
    ]);
    expect(body.report.steps.every((step) => step.status === 'passed')).toBe(
      true,
    );

    // The load-bearing assertion: the same digest the hand-written test pins.
    expect(body.report.steps[3]?.detail).toMatchObject({
      operationDigest: NARRATIVE_PHASE_5_DIGEST,
    });

    // The call was not pinned, so the report says so rather than implying an
    // assertion that never happened.
    expect(body.report.steps[0]?.detail).toMatchObject({
      alias: 'first',
      status: 'committed',
      hashPinned: false,
    });
    expect(body.report.steps[0]?.detail['modelRequestHash']).toMatch(
      /^[a-f0-9]{64}$/u,
    );
  });

  it('prints a per-step text summary when --json is absent', async () => {
    const io = capture();
    await expect(
      run(['scenario', 'run', narrativeScenario], io.options),
    ).resolves.toBe(EXIT_OK);
    expect(io.out[0]).toBe('scenario passed narrative-phase-5');
    expect(io.out).toContain('  0 execute passed');
    expect(io.out).toContain('  3 assertDigest passed');
  });
});

describe('ScenarioRunner failure handling', () => {
  function scenarioWith(root: string, digest: string): string {
    mkdirSync(join(root, 'inputs'), { recursive: true });
    mkdirSync(join(root, 'responses'), { recursive: true });
    for (const relative of [
      'inputs/chapter-1.json',
      'responses/chapter-1.json',
    ]) {
      writeFileSync(
        join(root, relative),
        // Reuse the committed fixtures verbatim.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        readFixture(relative)!,
      );
    }
    const path = join(root, 'scenario.yaml');
    writeFileSync(
      path,
      `schemaVersion: acme-scenario/1
name: failing-digest
seed:
  clock: '2026-07-31T12:00:00.000Z'
  ids: sequential
composition:
  repository: memory
  gateway: mock
steps:
  - execute:
      as: first
      requestKey: narrative-phase-5-request-1
      namespace: narrative
      task: observe-document
      entityId: story-phase-5
      expectedRevision: 0
      fixture: inputs/chapter-1.json
      mockResponse: responses/chapter-1.json
      policy:
        retention: encrypted-payload
  - assertDigest:
      execution: first
      operationDigest: '${digest}'
  - replay:
      execution: first
      mode: verify
`,
    );
    return path;
  }

  function readFixture(relative: string): string {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('node:fs').readFileSync(
      join(scenarioRoot, relative),
      'utf8',
    ) as string;
  }

  it('halts at the first failed assertion and skips the rest', async () => {
    const root = workspace();
    const path = scenarioWith(root, 'a'.repeat(64));
    const io = capture();

    await expect(
      run(['scenario', 'run', path, '--json'], io.options),
    ).resolves.toBe(EXIT_OUTCOME);

    const body = JSON.parse(io.out.join('\n')) as {
      report: {
        status: string;
        steps: { kind: string; status: string }[];
        failure: { stepIndex: number; message: string };
      };
    };
    expect(body.report.status).toBe('failed');
    expect(body.report.steps.map((step) => step.status)).toEqual([
      'passed',
      'failed',
      'skipped',
    ]);
    expect(body.report.failure.stepIndex).toBe(1);
    expect(body.report.failure.message).toContain('Operation digest');
  });
});

describe('ScenarioRunner safety and validation', () => {
  it.each([
    ['..', '../outside.json'],
    ['nested traversal', 'inputs/../../outside.json'],
    [
      'absolute',
      process.platform === 'win32' ? 'C:\\outside.json' : '/outside.json',
    ],
  ])(
    'rejects a fixture path that escapes the root: %s',
    (_label, requested) => {
      expect(() => resolveFixturePath(scenarioRoot, requested)).toThrowError(
        /scenario fixture path/u,
      );
    },
  );

  it('accepts a path that stays below the root', () => {
    expect(resolveFixturePath(scenarioRoot, 'inputs/chapter-1.json')).toBe(
      join(scenarioRoot, 'inputs', 'chapter-1.json'),
    );
  });

  it.each([
    ['a non-object', 'not a scenario'],
    ['a wrong schema version', { schemaVersion: 'acme-scenario/2' }],
  ])('rejects %s', (_label, document) => {
    expect(() => parseScenario(document)).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'INVALID_REQUEST' }),
      }),
    );
  });

  it('rejects an unknown step kind', () => {
    expect(() =>
      parseScenario({
        schemaVersion: 'acme-scenario/1',
        name: 'x',
        seed: { clock: 'c', ids: 'sequential' },
        composition: { repository: 'memory', gateway: 'mock' },
        steps: [{ detonate: {} }],
      }),
    ).toThrowError(/Unknown step kind "detonate"/u);
  });

  it('rejects a step naming more than one kind', () => {
    expect(() =>
      parseScenario({
        schemaVersion: 'acme-scenario/1',
        name: 'x',
        seed: { clock: 'c', ids: 'sequential' },
        composition: { repository: 'memory', gateway: 'mock' },
        steps: [{ replay: {}, assert: {} }],
      }),
    ).toThrowError(/exactly one step kind/u);
  });

  it('reports an unresolved alias as a step failure rather than a crash', async () => {
    const root = workspace();
    const path = join(root, 'scenario.yaml');
    writeFileSync(
      path,
      `schemaVersion: acme-scenario/1
name: unresolved-alias
seed:
  clock: '2026-07-31T12:00:00.000Z'
  ids: sequential
composition:
  repository: memory
  gateway: mock
steps:
  - assert:
      execution: never-defined
      status: committed
`,
    );
    const io = capture();
    await expect(
      run(['scenario', 'run', path, '--json'], io.options),
    ).resolves.toBe(EXIT_OUTCOME);
    expect(io.out.join('\n')).toContain('unknown execution alias');
  });

  it('reports an unreadable scenario file as a usage error', async () => {
    const io = capture();
    await expect(
      run(['scenario', 'run', join(workspace(), 'missing.yaml')], io.options),
    ).resolves.toBe(EXIT_USAGE);
    expect(io.err.join('\n')).toContain('Could not read the scenario file');
  });

  it('rejects an unknown scenario action', async () => {
    const io = capture();
    await expect(run(['scenario', 'detonate', 'x'], io.options)).resolves.toBe(
      EXIT_USAGE,
    );
    expect(io.err.join('\n')).toContain('Unknown scenario action');
  });
});
