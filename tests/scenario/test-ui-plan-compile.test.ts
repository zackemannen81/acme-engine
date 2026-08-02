import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  compileTestPlan,
  parseTestPlan,
} from '../../apps/test-ui/src/index.js';
import { EXIT_OK, run, type RunOptions } from '../../apps/cli/src/index.js';
import { createTestPayloadEncryptor } from '../../packages/testing/src/index.js';
import type { IdGenerator } from '../../packages/core/src/index.js';

/**
 * The compiler's load-bearing proof (ADR-0020).
 *
 * A plan is only worth having if what it compiles to is an artifact the
 * existing runner accepts and that reproduces a known effect. This compiles a
 * plan equivalent to the Narrative Phase 5 scenario file and runs it through
 * the same CLI path, then compares the operation digest with the one the
 * hand-written acceptance test pins.
 */

const scenarioRoot = join(dirname(fileURLToPath(import.meta.url)), 'files');

/** The digest pinned by `tests/scenario/narrative-phase-5.test.ts`. */
const NARRATIVE_PHASE_5_DIGEST =
  '15f143ba7991e04065ad1ed6bc9f2df6942e05372d18f5d4469b2eba4ae5c94f';

const plan = {
  schemaVersion: 'acme-test-plan/1',
  name: 'narrative-phase-5',
  seed: {
    clock: '2026-07-31T12:00:00.000Z',
    ids: 'sequential',
    idPrefix: 'narrative-phase-5',
    idPadding: 3,
  },
  composition: { repository: 'memory', gateway: 'mock' },
  policy: { retention: 'encrypted-payload' },
  cases: [
    {
      id: 'first',
      requestKey: 'narrative-phase-5-request-1',
      namespace: 'narrative',
      task: 'observe-document',
      entityId: 'story-phase-5',
      expectedRevision: 0,
      input: 'inputs/chapter-1.json',
      mockResponse: 'responses/chapter-1.json',
      expect: {
        status: 'committed',
        revision: 1,
        documentKeys: ['chapter-phase-5'],
        digest: 'digests/narrative-phase-5.json',
      },
      replay: { mode: 'verify', expect: 'match' },
    },
  ],
};

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop() ?? '', { recursive: true, force: true });
  }
});

function workspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'acme-plan-'));
  roots.push(root);
  // The compiled scenario references the same fixture tree the hand-written
  // scenario uses, so it is copied rather than reinvented.
  cpSync(scenarioRoot, root, { recursive: true });
  return root;
}

function createIds(): IdGenerator {
  const counts: Record<string, number> = {};
  return {
    next(kind) {
      counts[kind] = (counts[kind] ?? 0) + 1;
      return `${kind}-plan-${String(counts[kind]).padStart(3, '0')}`;
    },
  };
}

function capture(): { readonly options: RunOptions; readonly out: string[] } {
  const out: string[] = [];
  return {
    out,
    options: {
      io: { stdout: (line) => out.push(line), stderr: () => {} },
      clock: { now: () => '2026-07-31T12:00:00.000Z' },
      ids: createIds(),
      payloadEncryptor: createTestPayloadEncryptor(),
    },
  };
}

describe('acme-test-plan/1 compiles into a runnable scenario', () => {
  it('reaches the Narrative Phase 5 digest through the existing runner', async () => {
    const compiled = compileTestPlan(parseTestPlan(plan));
    const root = workspace();
    const scenarioPath = join(root, 'compiled-from-plan.yaml');
    // JSON is valid YAML, so the compiled document needs no YAML writer and
    // the bytes under test are exactly the compiler's output.
    writeFileSync(
      scenarioPath,
      JSON.stringify(compiled.scenario, null, 2),
      'utf8',
    );

    const io = capture();
    await expect(
      run(['scenario', 'run', scenarioPath, '--json'], io.options),
    ).resolves.toBe(EXIT_OK);

    const body = JSON.parse(io.out.join('\n')) as {
      report: {
        name: string;
        status: string;
        steps: {
          kind: string;
          status: string;
          detail: Record<string, unknown>;
        }[];
      };
    };

    expect(body.report.name).toBe('narrative-phase-5');
    expect(body.report.status).toBe('passed');
    expect(body.report.steps.map((step) => step.kind)).toStrictEqual([
      'execute',
      'assert',
      'replay',
      'assertDigest',
    ]);
    expect(body.report.steps.every((step) => step.status === 'passed')).toBe(
      true,
    );

    // The load-bearing assertion: a compiled plan reproduces the effect the
    // hand-written scenario and the hand-written test both pin.
    expect(body.report.steps[3]?.detail).toMatchObject({
      operationDigest: NARRATIVE_PHASE_5_DIGEST,
    });
  });

  it('emits the full effective policy without changing the effect', async () => {
    const compiled = compileTestPlan(parseTestPlan(plan));
    const [step] = compiled.scenario.steps;
    if (step === undefined || !('execute' in step)) {
      throw new Error('expected an execute step');
    }

    // The plan declared only `retention`; the compiled step states every
    // ceiling, and the digest above proves that resolving early changes
    // nothing the engine would not have resolved itself.
    expect(step.execute.policy).toStrictEqual({
      timeoutMs: 30_000,
      maxModelCalls: 1,
      maxRepairCalls: 0,
      maxRevisionCalls: 0,
      retention: 'encrypted-payload',
    });
  });
});
