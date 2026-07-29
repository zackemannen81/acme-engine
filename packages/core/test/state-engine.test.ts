import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import {
  AcmeError,
  canonicalJson,
  createStateEngine,
  deriveTransitionId,
  sha256,
  type DomainModule,
  type JsonValue,
  type StatePrepareContext,
  type StateSnapshot,
} from '../src/index.js';

interface FixtureState {
  readonly count: number;
  readonly tags: readonly string[];
}

interface FixtureDelta {
  readonly amount: number;
}

type FixtureModule = DomainModule<
  FixtureState,
  FixtureDelta,
  Record<never, never>
>;

const STATE_SCHEMA_VERSION = '1.0.0';
const DELTA_SCHEMA_VERSION = '1.0.0';

const baseContext: StatePrepareContext = {
  entityId: 'entity-1',
  executionId: 'execution-1',
  operationKey: 'state-1',
  now: '2026-07-29T10:00:00.000Z',
};

function makeModule(overrides: Partial<FixtureModule> = {}): FixtureModule {
  return {
    namespace: 'example',
    stateSchemaVersion: STATE_SCHEMA_VERSION,
    deltaSchemaVersion: DELTA_SCHEMA_VERSION,
    stateSchema: z
      .object({
        count: z.number(),
        tags: z.array(z.string()),
      })
      .strict(),
    deltaSchema: z.object({ amount: z.number() }).strict(),
    tasks: {},
    memoryPolicy: {
      validate: () => [],
      identity: ({ key }) => key,
      retrieve: () => [],
      resolve: ({ key }) => ({
        candidateKey: key,
        action: 'ignore',
        reason: 'fixture',
      }),
      lifecycle: () => ({ action: 'retain' }),
    },
    initialState: () => ({ count: 0, tags: [] }),
    reduce: (state, delta) => ({
      count: state.count + delta.amount,
      tags: state.tags,
    }),
    invariants: () => [],
    ...overrides,
  };
}

function snapshot(
  value: FixtureState,
  revision = 1,
): StateSnapshot<FixtureState> {
  return {
    entityId: baseContext.entityId,
    namespace: 'example',
    schemaVersion: STATE_SCHEMA_VERSION,
    revision,
    value,
    valueHash: sha256(canonicalJson(value as unknown as JsonValue)),
    createdAt: '2026-07-28T10:00:00.000Z',
    executionId: 'execution-before',
  };
}

function delta(amount: number) {
  return {
    schemaVersion: DELTA_SCHEMA_VERSION,
    value: { amount },
  };
}

function expectAcmeError(
  operation: () => unknown,
  code: AcmeError['data']['code'],
): AcmeError {
  try {
    operation();
    throw new Error('Expected operation to throw.');
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(AcmeError);
    expect((error as AcmeError).data).toMatchObject({
      code,
      stage: 'preparing-commit',
      retryable: false,
    });
    return error as AcmeError;
  }
}

describe('deterministic transition identity', () => {
  it('matches the acme-transition-id-1 golden vector', () => {
    expect(
      deriveTransitionId({
        executionId: 'execution-1',
        operationKey: 'state-1',
        namespace: 'example',
        entityId: 'entity-1',
      }),
    ).toBe(
      'transition_faa909384210e8b56def19e6df684cd0c7079ced4a4784a02db7cd1e8230e8fd',
    );
  });

  it.each([
    ['executionId', { executionId: 'execution-2' }],
    ['operationKey', { operationKey: 'state-2' }],
    ['namespace', { namespace: 'another' }],
    ['entityId', { entityId: 'entity-2' }],
  ] as const)('is sensitive to %s', (_field, change) => {
    const identity = {
      executionId: 'execution-1',
      operationKey: 'state-1',
      namespace: 'example',
      entityId: 'entity-1',
    };

    expect(deriveTransitionId({ ...identity, ...change })).not.toBe(
      deriveTransitionId(identity),
    );
  });

  it('rejects empty identity components', () => {
    expectAcmeError(
      () =>
        deriveTransitionId({
          executionId: '',
          operationKey: 'state-1',
          namespace: 'example',
          entityId: 'entity-1',
        }),
      'INVALID_REQUEST',
    );
  });
});

describe('StateEngine.prepare', () => {
  const engine = createStateEngine();

  it('prepares an initial snapshot and transition with hashes and provenance', () => {
    const initialState = vi.fn(() => ({ count: 2, tags: ['initial'] }));
    const prepared = engine.prepare(
      makeModule({ initialState }),
      null,
      0,
      delta(3),
      baseContext,
    );

    expect(initialState).toHaveBeenCalledWith({
      entityId: 'entity-1',
      now: '2026-07-29T10:00:00.000Z',
    });
    expect(prepared).not.toBeNull();
    expect(prepared?.snapshot).toEqual({
      entityId: 'entity-1',
      namespace: 'example',
      schemaVersion: STATE_SCHEMA_VERSION,
      revision: 1,
      value: { count: 5, tags: ['initial'] },
      valueHash: sha256(canonicalJson({ count: 5, tags: ['initial'] })),
      createdAt: baseContext.now,
      executionId: baseContext.executionId,
    });
    expect(prepared?.transition).toEqual({
      transitionId:
        'transition_faa909384210e8b56def19e6df684cd0c7079ced4a4784a02db7cd1e8230e8fd',
      operationKey: baseContext.operationKey,
      entityId: baseContext.entityId,
      namespace: 'example',
      fromRevision: 0,
      toRevision: 1,
      deltaSchemaVersion: DELTA_SCHEMA_VERSION,
      delta: { amount: 3 },
      previousHash: null,
      nextHash: prepared?.snapshot.valueHash,
      executionId: baseContext.executionId,
      createdAt: baseContext.now,
    });
    expect(Object.isFrozen(prepared?.snapshot.value)).toBe(true);
    expect(Object.isFrozen(prepared?.transition.delta)).toBe(true);
  });

  it('advances an existing state by exactly one revision', () => {
    const current = snapshot({ count: 4, tags: ['kept'] }, 7);
    const prepared = engine.prepare(
      makeModule(),
      current,
      7,
      delta(2),
      baseContext,
    );
    if (prepared === null) {
      throw new Error('Expected a prepared state.');
    }

    expect(prepared.snapshot).toMatchObject({
      revision: 8,
      value: { count: 6, tags: ['kept'] },
    });
    expect(prepared.transition).toMatchObject({
      fromRevision: 7,
      toRevision: 8,
      previousHash: current.valueHash,
      nextHash: prepared.snapshot.valueHash,
    });
  });

  it('returns null without invoking domain policies when no delta exists', () => {
    const initialState = vi.fn(() => ({ count: 0, tags: [] }));
    const reduce = vi.fn((state: FixtureState) => state);
    const invariants = vi.fn(() => []);

    expect(
      engine.prepare(
        makeModule({ initialState, reduce, invariants }),
        snapshot({ count: 4, tags: [] }),
        1,
        undefined,
        baseContext,
      ),
    ).toBeNull();
    expect(initialState).not.toHaveBeenCalled();
    expect(reduce).not.toHaveBeenCalled();
    expect(invariants).not.toHaveBeenCalled();
  });

  it('rejects stale revisions before invoking the reducer', () => {
    const reduce = vi.fn((state: FixtureState) => state);

    expectAcmeError(
      () =>
        engine.prepare(
          makeModule({ reduce }),
          snapshot({ count: 4, tags: [] }, 3),
          2,
          delta(1),
          baseContext,
        ),
      'CONFLICT_STATE_REVISION',
    );
    expect(reduce).not.toHaveBeenCalled();
  });

  it('keeps transition identity stable across time, revision, and delta changes', () => {
    const first = engine.prepare(makeModule(), null, 0, delta(1), baseContext);
    const second = engine.prepare(
      makeModule(),
      snapshot({ count: 10, tags: [] }, 8),
      8,
      delta(99),
      {
        ...baseContext,
        now: '2026-07-30T10:00:00.000Z',
      },
    );

    expect(first?.transition.transitionId).toBe(
      second?.transition.transitionId,
    );
  });

  it('maps invalid current state and hash records to persistence corruption', () => {
    expectAcmeError(
      () =>
        engine.prepare(
          makeModule(),
          {
            ...snapshot({ count: 4, tags: [] }),
            value: {
              count: 'invalid',
              tags: [],
            } as unknown as FixtureState,
          },
          1,
          delta(1),
          baseContext,
        ),
      'PERSISTENCE_CORRUPTION',
    );

    const current = {
      ...snapshot({ count: 4, tags: [] }),
      valueHash: 'not-the-value-hash',
    };

    expectAcmeError(
      () => engine.prepare(makeModule(), current, 1, delta(1), baseContext),
      'PERSISTENCE_CORRUPTION',
    );
  });

  it('rejects invalid delta versions, schemas, and coercion', () => {
    expectAcmeError(
      () =>
        engine.prepare(
          makeModule(),
          null,
          0,
          { schemaVersion: '2.0.0', value: { amount: 1 } },
          baseContext,
        ),
      'DOMAIN_INVALID_RESULT',
    );

    expectAcmeError(
      () =>
        engine.prepare(
          makeModule(),
          null,
          0,
          {
            schemaVersion: DELTA_SCHEMA_VERSION,
            value: { amount: Number.NaN },
          },
          baseContext,
        ),
      'DOMAIN_INVALID_RESULT',
    );

    expectAcmeError(
      () =>
        engine.prepare(
          makeModule({
            deltaSchema: z.object({ amount: z.coerce.number() }).strict(),
          }),
          null,
          0,
          {
            schemaVersion: DELTA_SCHEMA_VERSION,
            value: { amount: '1' } as unknown as FixtureDelta,
          },
          baseContext,
        ),
      'DOMAIN_INVALID_RESULT',
    );
  });

  it('rejects invalid initial and reduced states', () => {
    expectAcmeError(
      () =>
        engine.prepare(
          makeModule({
            initialState: () =>
              ({ count: Number.NaN, tags: [] }) as FixtureState,
          }),
          null,
          0,
          delta(1),
          baseContext,
        ),
      'DOMAIN_INVALID_RESULT',
    );

    expectAcmeError(
      () =>
        engine.prepare(
          makeModule({
            reduce: () => ({ count: Number.NaN, tags: [] }) as FixtureState,
          }),
          null,
          0,
          delta(1),
          baseContext,
        ),
      'DOMAIN_INVALID_RESULT',
    );
  });

  it('maps invariant failures and malformed invariant output', () => {
    const rejected = expectAcmeError(
      () =>
        engine.prepare(
          makeModule({
            invariants: () => [
              {
                code: 'COUNT_TOO_HIGH',
                path: ['count'],
                message: 'Count must stay bounded.',
              },
            ],
          }),
          null,
          0,
          delta(1),
          baseContext,
        ),
      'DOMAIN_INVALID_RESULT',
    );
    expect(rejected.data.details).toMatchObject({
      issues: [{ code: 'COUNT_TOO_HIGH', path: ['count'] }],
    });

    expectAcmeError(
      () =>
        engine.prepare(
          makeModule({
            invariants: () => undefined as unknown as readonly [],
          }),
          null,
          0,
          delta(1),
          baseContext,
        ),
      'DOMAIN_INVALID_RESULT',
    );
  });

  it('protects caller-owned state and delta from reducer mutation', () => {
    const currentValue: FixtureState = {
      count: 2,
      tags: ['caller-owned'],
    };
    const currentDelta: FixtureDelta = { amount: 1 };

    expectAcmeError(
      () =>
        engine.prepare(
          makeModule({
            reduce: (state, candidateDelta) => {
              expect(Object.isFrozen(state)).toBe(true);
              expect(Object.isFrozen(state.tags)).toBe(true);
              expect(Object.isFrozen(candidateDelta)).toBe(true);
              (state.tags as string[]).push('mutated');
              (candidateDelta as { amount: number }).amount = 99;
              return state;
            },
          }),
          snapshot(currentValue),
          1,
          {
            schemaVersion: DELTA_SCHEMA_VERSION,
            value: currentDelta,
          },
          baseContext,
        ),
      'DOMAIN_INVALID_RESULT',
    );
    expect(currentValue).toEqual({
      count: 2,
      tags: ['caller-owned'],
    });
    expect(currentDelta).toEqual({ amount: 1 });
  });
});
