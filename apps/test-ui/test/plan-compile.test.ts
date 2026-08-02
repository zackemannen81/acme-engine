import { AcmeError, canonicalJson, type JsonValue } from '@acme/core';
import { parseScenario } from '@acme/testing';
import { describe, expect, it } from 'vitest';

import {
  compileTestPlan,
  isAvailable,
  parseTestPlan,
  TEST_PLAN_SCHEMA_VERSION,
  VIEW_UNAVAILABLE,
} from '../src/index.js';

/** The smallest plan that compiles: one case, no expectations. */
const minimalPlan = {
  schemaVersion: 'acme-test-plan/1',
  name: 'minimal',
  seed: { clock: '2026-01-01T00:00:00.000Z', ids: 'sequential' },
  composition: { repository: 'memory', gateway: 'mock' },
  cases: [
    {
      id: 'only',
      namespace: 'alpha',
      task: 'observe',
      entityId: 'entity-1',
      expectedRevision: 0,
      input: 'inputs/only.json',
      mockResponse: 'responses/only.json',
    },
  ],
};

/** Every optional field set, so the full expansion is pinned. */
const fullPlan = {
  schemaVersion: 'acme-test-plan/1',
  name: 'full',
  seed: {
    clock: '2026-01-01T00:00:00.000Z',
    ids: 'sequential',
    idPrefix: 'full',
    idPadding: 3,
  },
  composition: { repository: 'sqlite', gateway: 'mock' },
  policy: { retention: 'encrypted-payload', maxModelCalls: 1 },
  cases: [
    {
      id: 'first',
      namespace: 'alpha',
      task: 'observe',
      entityId: 'entity-1',
      expectedRevision: 0,
      input: 'inputs/first.json',
      mockResponse: 'responses/first.json',
      requestKey: 'explicit-key',
      policy: { retention: 'hash-only' },
      expectRequestHash:
        'a0a600a29ab4f52b3ce572d4d4d72504183f0632aaa3eec32ea9be218fb52bbf',
      expect: {
        status: 'committed',
        revision: 1,
        documentKeys: ['doc-1'],
        digest: 'digests/first.json',
      },
      replay: { mode: 'verify', expect: 'match' },
    },
    {
      id: 'second',
      namespace: 'alpha',
      task: 'observe',
      entityId: 'entity-1',
      expectedRevision: 1,
      input: 'inputs/second.json',
      mockResponse: 'responses/second.json',
      expect: { status: 'committed', operationDigest: 'deadbeef' },
    },
  ],
};

function refusal(plan: unknown): AcmeError {
  try {
    parseTestPlan(plan);
  } catch (error: unknown) {
    if (error instanceof AcmeError) {
      return error;
    }
    throw error;
  }
  throw new Error('The plan should not have parsed.');
}

function withCase(overrides: Record<string, unknown>): unknown {
  return {
    ...minimalPlan,
    cases: [{ ...minimalPlan.cases[0], ...overrides }],
  };
}

describe('acme-test-plan/1 schema', () => {
  it('publishes its version and accepts a minimal plan', () => {
    expect(TEST_PLAN_SCHEMA_VERSION).toBe('acme-test-plan/1');
    const plan = parseTestPlan(minimalPlan);
    expect(plan.schemaVersion).toBe(TEST_PLAN_SCHEMA_VERSION);
    expect(plan.cases).toHaveLength(1);
    expect(plan.policy).toBeUndefined();
  });

  it('accepts a full plan and keeps every declared field', () => {
    const plan = parseTestPlan(fullPlan);
    expect(plan.seed.idPadding).toBe(3);
    expect(plan.cases[0]?.requestKey).toBe('explicit-key');
    expect(plan.cases[0]?.expect?.documentKeys).toStrictEqual(['doc-1']);
    expect(plan.cases[0]?.replay?.expect).toBe('match');
  });

  it('refuses a wrong or missing schema version', () => {
    expect(
      refusal({ ...minimalPlan, schemaVersion: 'acme-test-plan/2' }).data
        .message,
    ).toContain('acme-test-plan/1');
    expect(
      refusal({ ...minimalPlan, schemaVersion: undefined }).data.code,
    ).toBe('INVALID_REQUEST');
  });

  it('refuses an unknown field instead of ignoring it', () => {
    const top = refusal({ ...minimalPlan, measurements: { min: 1 } });
    expect(top.data.message).toContain('unexpected fields');
    expect(top.data.details).toMatchObject({ unexpected: ['measurements'] });

    // A misspelled expectation must fail rather than silently assert less.
    const inner = refusal(withCase({ expcet: { status: 'committed' } }));
    expect(inner.data.details).toMatchObject({ unexpected: ['expcet'] });
  });

  it('refuses a missing or malformed seed', () => {
    expect(refusal({ ...minimalPlan, seed: undefined }).data.message).toContain(
      'plan.seed',
    );
    expect(
      refusal({
        ...minimalPlan,
        seed: { clock: '2026-01-01T00:00:00.000Z', ids: 'random' },
      }).data.message,
    ).toContain('sequential');
  });

  it('refuses a policy the engine would reject', () => {
    const unknownField = refusal(
      withCase({ policy: { retention: 'hash-only', nonsense: true } }),
    );
    expect(unknownField.data.message).toContain('not a policy the engine');

    const badRetention = refusal(withCase({ policy: { retention: 'plain' } }));
    expect(badRetention.data.message).toContain('not a policy the engine');
  });

  it('refuses a reference that leaves the scenario root', () => {
    const escaping = refusal(withCase({ input: '../secrets.json' }));
    expect(escaping.data.message).toContain('below the scenario root');
    expect(escaping.data.details).toMatchObject({
      reason: 'PATH_ESCAPES_ROOT',
    });

    const absolute = refusal(withCase({ mockResponse: '/etc/passwd' }));
    expect(absolute.data.details).toMatchObject({ reason: 'PATH_ABSOLUTE' });
  });

  it('refuses an empty case list and duplicate identities', () => {
    expect(refusal({ ...minimalPlan, cases: [] }).data.message).toContain(
      'non-empty',
    );

    const duplicateId = refusal({
      ...minimalPlan,
      cases: [minimalPlan.cases[0], minimalPlan.cases[0]],
    });
    expect(duplicateId.data.message).toContain('ids must be unique');

    // Two cases with one request key would be one execution, so the second
    // would replay the first instead of running.
    const duplicateKey = refusal({
      ...minimalPlan,
      cases: [
        { ...minimalPlan.cases[0], id: 'a', requestKey: 'same' },
        { ...minimalPlan.cases[0], id: 'b', requestKey: 'same' },
      ],
    });
    expect(duplicateKey.data.message).toContain('request keys must be unique');
  });

  it('refuses a request hash the runner would reject', () => {
    // Caught here rather than at run time, so the error names the file the
    // author can fix.
    const bad = refusal(withCase({ expectRequestHash: 'abc123' }));
    expect(bad.data.message).toContain('lowercase SHA-256 digest');
  });

  it('refuses both digest forms on one expectation', () => {
    const both = refusal(
      withCase({
        expect: {
          status: 'committed',
          digest: 'digests/a.json',
          operationDigest: 'deadbeef',
        },
      }),
    );
    expect(both.data.message).toContain('digest and operationDigest');
  });
});

describe('acme-test-plan/1 compiler', () => {
  it('expands one case into execute, assert, replay and digest steps', () => {
    const compiled = compileTestPlan(parseTestPlan(fullPlan));

    expect(compiled.scenario.schemaVersion).toBe('acme-scenario/1');
    expect(
      compiled.scenario.steps.map((step) => Object.keys(step)[0]),
    ).toStrictEqual([
      'execute',
      'assert',
      'replay',
      'assertDigest',
      'execute',
      'assert',
      'assertDigest',
    ]);
  });

  it('derives request keys and resolves the effective policy', () => {
    const compiled = compileTestPlan(parseTestPlan(fullPlan));
    const [first, , , , second] = compiled.scenario.steps;

    if (
      first === undefined ||
      second === undefined ||
      !('execute' in first) ||
      !('execute' in second)
    ) {
      throw new Error('expected execute steps');
    }
    expect(first.execute.requestKey).toBe('explicit-key');
    // Derived from plan name and case id when the case sets none.
    expect(second.execute.requestKey).toBe('full-second');

    // Case policy overrides plan policy field by field, and the emitted step
    // carries the complete resolved policy rather than a fragment.
    expect(first.execute.policy).toMatchObject({
      retention: 'hash-only',
      maxModelCalls: 1,
    });
    expect(second.execute.policy).toMatchObject({
      retention: 'encrypted-payload',
      maxModelCalls: 1,
    });
    expect(Object.keys(first.execute.policy).sort()).toStrictEqual([
      'maxModelCalls',
      'maxRepairCalls',
      'maxRevisionCalls',
      'retention',
      'timeoutMs',
    ]);
  });

  it('compiles byte-identically for identical plans', () => {
    const once = canonicalJson(
      compileTestPlan(parseTestPlan(fullPlan)).scenario as unknown as JsonValue,
    );
    const twice = canonicalJson(
      compileTestPlan(parseTestPlan(fullPlan)).scenario as unknown as JsonValue,
    );
    expect(once).toBe(twice);
  });

  it('pins the compiled bytes of the minimal plan', () => {
    const compiled = compileTestPlan(parseTestPlan(minimalPlan));

    expect(
      canonicalJson(compiled.scenario as unknown as JsonValue),
    ).toStrictEqual(
      '{"composition":{"gateway":"mock","repository":"memory"},"name":"minimal","schemaVersion":"acme-scenario/1","seed":{"clock":"2026-01-01T00:00:00.000Z","ids":"sequential"},"steps":[{"execute":{"as":"only","entityId":"entity-1","expectedRevision":0,"fixture":"inputs/only.json","mockResponse":"responses/only.json","namespace":"alpha","policy":{"maxModelCalls":1,"maxRepairCalls":0,"maxRevisionCalls":0,"retention":"hash-only","timeoutMs":30000},"requestKey":"minimal-only","task":"observe"}}]}',
    );
  });

  it('emits a document the runner validator accepts', () => {
    // The compiler declares the scenario shape structurally; this is what
    // proves the shape is the real one.
    const compiled = compileTestPlan(parseTestPlan(fullPlan));
    const parsed = parseScenario(compiled.scenario);

    expect(parsed.schemaVersion).toBe('acme-scenario/1');
    expect(parsed.steps).toHaveLength(7);
  });

  it('cannot materialize requests without fixture contents', () => {
    const compiled = compileTestPlan(parseTestPlan(minimalPlan));

    expect(compiled.requests).toStrictEqual({
      availability: 'unavailable',
      reason: VIEW_UNAVAILABLE.planFixtures,
    });
  });

  it('materializes requests when the caller supplies the fixtures', () => {
    const compiled = compileTestPlan(parseTestPlan(minimalPlan), {
      fixtures: {
        'inputs/only.json': { text: 'hello' },
        'responses/only.json': {
          selection: { profile: 'offline-json' },
          response: { text: '{}' },
        },
      },
    });

    if (!isAvailable(compiled.requests)) {
      throw new Error('requests should be available');
    }
    expect(compiled.requests.requests).toHaveLength(1);
    expect(compiled.requests.requests[0]).toMatchObject({
      requestKey: 'minimal-only',
      namespace: 'alpha',
      task: 'observe',
      input: { text: 'hello' },
      // The selection comes from the mock fixture, because that is where
      // acme-scenario/1 keeps it.
      model: { profile: 'offline-json' },
    });
  });

  it('stays unavailable when a referenced fixture is missing', () => {
    const compiled = compileTestPlan(parseTestPlan(minimalPlan), {
      fixtures: { 'inputs/only.json': { text: 'hello' } },
    });

    expect(compiled.requests.availability).toBe('unavailable');
  });
});
