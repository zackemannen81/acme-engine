import { describe, expect, it, vi } from 'vitest';

import {
  AcmeError,
  createMemoryEngine,
  type DomainMemoryPolicy,
  type IdGenerator,
  type MemoryCandidate,
  type MemoryLifecycleHook,
  type MemoryPrepareContext,
  type MemoryRecord,
  type MemoryResolution,
} from '../src/index.js';

const context: MemoryPrepareContext = {
  namespace: 'example',
  entityId: 'entity-1',
  executionId: 'execution-1',
  now: '2026-07-29T12:00:00.000Z',
};

function candidate(
  key: string,
  overrides: Partial<MemoryCandidate> = {},
): MemoryCandidate {
  return {
    key,
    kind: 'example.fact',
    schemaVersion: '1.0.0',
    value: { fact: key },
    confidence: 0.7,
    source: {
      executionId: context.executionId,
      contract: {
        id: 'example.observe',
        version: '1.0.0',
      },
      modelCallId: 'call-1',
      documentKeys: [`document-${key}`],
    },
    ...overrides,
  };
}

function record(
  memoryId: string,
  identityKey: string,
  overrides: Partial<MemoryRecord> = {},
): MemoryRecord {
  return {
    memoryId,
    namespace: context.namespace,
    entityId: context.entityId,
    identityKey,
    kind: 'example.fact',
    schemaVersion: '1.0.0',
    value: { fact: identityKey },
    strength: 0.4,
    status: 'active',
    firstSeenAt: '2026-07-28T10:00:00.000Z',
    lastSeenAt: '2026-07-28T11:00:00.000Z',
    lastReinforcedAt: '2026-07-28T11:00:00.000Z',
    provenance: [
      {
        executionId: 'execution-old',
        contract: {
          id: 'example.observe',
          version: '1.0.0',
        },
        documentKeys: ['document-old'],
      },
    ],
    recordVersion: 3,
    ...overrides,
  };
}

function policy(
  overrides: Partial<DomainMemoryPolicy> = {},
): DomainMemoryPolicy {
  return {
    validate: () => [],
    identity: ({ key }) => `identity-${key}`,
    retrieve: () => [],
    resolve: ({ key }) => ({
      candidateKey: key,
      action: 'ignore',
      reason: 'fixture',
    }),
    lifecycle: () => ({ action: 'retain' }),
    ...overrides,
  };
}

function idFixture(values: readonly string[] = []) {
  let index = 0;
  const next = vi.fn((kind: Parameters<IdGenerator['next']>[0]) => {
    expect(kind).toBe('memory');
    const value = values[index] ?? `memory-${index + 1}`;
    index += 1;
    return value;
  });
  return {
    ids: { next } satisfies IdGenerator,
    next,
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

describe('MemoryEngine.prepare', () => {
  it('creates records in stable candidate order with complete mechanics', () => {
    const id = idFixture(['memory-a', 'memory-b']);
    const engine = createMemoryEngine({ ids: id.ids });
    const candidates = [candidate('b'), candidate('a')];
    const resolve = vi.fn((item: MemoryCandidate): MemoryResolution => {
      expect(Object.isFrozen(item)).toBe(true);
      expect(Object.isFrozen(item.value)).toBe(true);
      return {
        candidateKey: item.key,
        action: 'create',
        value: { normalized: item.key },
        strength: item.confidence ?? 0,
      };
    });

    const prepared = engine.prepare(
      policy({ resolve }),
      candidates,
      [],
      context,
    );

    expect(prepared.decisions.map(({ candidateKey }) => candidateKey)).toEqual([
      'a',
      'b',
    ]);
    expect(
      prepared.mutations.map(({ record: item }) => ({
        memoryId: item.memoryId,
        identityKey: item.identityKey,
        value: item.value,
        strength: item.strength,
        version: item.recordVersion,
      })),
    ).toEqual([
      {
        memoryId: 'memory-a',
        identityKey: 'identity-a',
        value: { normalized: 'a' },
        strength: 0.7,
        version: 1,
      },
      {
        memoryId: 'memory-b',
        identityKey: 'identity-b',
        value: { normalized: 'b' },
        strength: 0.7,
        version: 1,
      },
    ]);
    expect(prepared.mutations[0]?.record).toMatchObject({
      namespace: context.namespace,
      entityId: context.entityId,
      status: 'active',
      firstSeenAt: context.now,
      lastSeenAt: context.now,
      lastReinforcedAt: context.now,
      provenance: [candidate('a').source],
    });
    expect(id.next).toHaveBeenCalledTimes(2);
    expect(Object.isFrozen(prepared)).toBe(true);
    expect(Object.isFrozen(prepared.mutations)).toBe(true);
    expect(candidates).toEqual([candidate('b'), candidate('a')]);
  });

  it('lets later candidates observe the evolving immutable working set', () => {
    const id = idFixture(['memory-created']);
    const engine = createMemoryEngine({ ids: id.ids });
    const seen: string[][] = [];
    const resolve = vi.fn(
      (
        item: MemoryCandidate,
        existing: readonly MemoryRecord[],
      ): MemoryResolution => {
        expect(Object.isFrozen(existing)).toBe(true);
        seen.push(existing.map(({ memoryId }) => memoryId));
        return item.key === 'a'
          ? {
              candidateKey: 'a',
              action: 'create',
              value: { fact: 'created' },
              strength: 0.5,
            }
          : {
              candidateKey: 'b',
              action: 'reinforce',
              memoryId: 'memory-created',
              strength: 0.9,
            };
      },
    );

    const prepared = engine.prepare(
      policy({ resolve }),
      [candidate('b'), candidate('a')],
      [],
      context,
    );

    expect(seen).toEqual([[], ['memory-created']]);
    expect(prepared.mutations).toHaveLength(2);
    expect(prepared.mutations[1]).toMatchObject({
      action: 'update',
      expectedRecordVersion: 1,
      record: {
        memoryId: 'memory-created',
        recordVersion: 2,
        strength: 0.9,
      },
    });
    expect(id.next).toHaveBeenCalledOnce();
  });

  it('reinforces a record with provenance, timestamps, and one version increment', () => {
    const id = idFixture();
    const engine = createMemoryEngine({ ids: id.ids });
    const current = record('memory-1', 'identity-old');

    const prepared = engine.prepare(
      policy({
        resolve: ({ key }) => ({
          candidateKey: key,
          action: 'reinforce',
          memoryId: current.memoryId,
          strength: 0.8,
        }),
      }),
      [candidate('reinforce')],
      [current],
      context,
    );

    expect(prepared.mutations).toEqual([
      {
        action: 'update',
        expectedRecordVersion: 3,
        record: {
          ...current,
          strength: 0.8,
          lastSeenAt: context.now,
          lastReinforcedAt: context.now,
          provenance: [...current.provenance, candidate('reinforce').source],
          recordVersion: 4,
        },
      },
    ]);
    expect(id.next).not.toHaveBeenCalled();
  });

  it('merges a policy-owned value and avoids duplicate provenance', () => {
    const sameSource = candidate('merge').source;
    const current = record('memory-1', 'identity-old', {
      provenance: [sameSource],
    });
    const id = idFixture();
    const engine = createMemoryEngine({ ids: id.ids });

    const prepared = engine.prepare(
      policy({
        resolve: ({ key }) => ({
          candidateKey: key,
          action: 'merge',
          memoryId: current.memoryId,
          value: { merged: true },
          strength: 1.2,
        }),
      }),
      [candidate('merge')],
      [current],
      context,
    );

    expect(prepared.mutations[0]).toMatchObject({
      action: 'update',
      expectedRecordVersion: 3,
      record: {
        value: { merged: true },
        strength: 1.2,
        provenance: [sameSource],
        recordVersion: 4,
      },
    });
    expect(id.next).not.toHaveBeenCalled();
  });

  it('contests targets in stable memory-ID order', () => {
    const first = record('memory-a', 'identity-a');
    const second = record('memory-z', 'identity-z');
    const id = idFixture();
    const engine = createMemoryEngine({ ids: id.ids });

    const prepared = engine.prepare(
      policy({
        resolve: ({ key }) => ({
          candidateKey: key,
          action: 'contradict',
          memoryIds: ['memory-z', 'memory-a'],
          disposition: 'contest',
        }),
      }),
      [candidate('contest')],
      [second, first],
      context,
    );

    expect(prepared.mutations.map(({ record: item }) => item.memoryId)).toEqual(
      ['memory-a', 'memory-z'],
    );
    expect(prepared.mutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'update',
          expectedRecordVersion: 3,
          record: expect.objectContaining({
            status: 'contested',
            lastSeenAt: context.now,
            lastReinforcedAt: first.lastReinforcedAt,
            recordVersion: 4,
          }),
        }),
      ]),
    );
    expect(prepared.decisions[0]?.affectedMemoryIds).toEqual([
      'memory-a',
      'memory-z',
    ]);
    expect(id.next).not.toHaveBeenCalled();
  });

  it('supersedes targets and creates the explicit replacement', () => {
    const current = record('memory-old', 'identity-old');
    const id = idFixture(['memory-replacement']);
    const engine = createMemoryEngine({ ids: id.ids });

    const prepared = engine.prepare(
      policy({
        identity: () => 'identity-replacement',
        resolve: ({ key }) => ({
          candidateKey: key,
          action: 'contradict',
          memoryIds: [current.memoryId],
          disposition: 'supersede-existing',
          replacement: {
            value: { corrected: true },
            strength: 0.95,
          },
        }),
      }),
      [candidate('replacement')],
      [current],
      context,
    );

    expect(prepared.mutations).toHaveLength(2);
    expect(prepared.mutations[0]).toMatchObject({
      action: 'update',
      expectedRecordVersion: 3,
      record: {
        memoryId: 'memory-old',
        status: 'superseded',
        recordVersion: 4,
      },
    });
    expect(prepared.mutations[1]).toEqual({
      action: 'create',
      record: {
        memoryId: 'memory-replacement',
        namespace: context.namespace,
        entityId: context.entityId,
        identityKey: 'identity-replacement',
        kind: 'example.fact',
        schemaVersion: '1.0.0',
        value: { corrected: true },
        strength: 0.95,
        status: 'active',
        firstSeenAt: context.now,
        lastSeenAt: context.now,
        lastReinforcedAt: context.now,
        provenance: [candidate('replacement').source],
        recordVersion: 1,
      },
    });
    expect(prepared.decisions[0]?.affectedMemoryIds).toEqual([
      'memory-old',
      'memory-replacement',
    ]);
    expect(id.next).toHaveBeenCalledOnce();
  });

  it('records reject and ignore decisions without mutations or IDs', () => {
    const current = record('memory-old', 'identity-old');
    const id = idFixture();
    const engine = createMemoryEngine({ ids: id.ids });

    const prepared = engine.prepare(
      policy({
        resolve: ({ key }) =>
          key === 'a'
            ? {
                candidateKey: key,
                action: 'contradict',
                memoryIds: [current.memoryId],
                disposition: 'reject-candidate',
              }
            : {
                candidateKey: key,
                action: 'ignore',
                reason: 'not durable',
              },
      }),
      [candidate('b'), candidate('a')],
      [current],
      context,
    );

    expect(
      prepared.decisions.map(({ resolution }) => resolution.action),
    ).toEqual(['contradict', 'ignore']);
    expect(prepared.decisions[0]?.affectedMemoryIds).toEqual([]);
    expect(prepared.mutations).toEqual([]);
    expect(id.next).not.toHaveBeenCalled();
  });

  it('rejects invalid candidates before resolution', () => {
    const id = idFixture();
    const engine = createMemoryEngine({ ids: id.ids });
    const resolve = vi.fn();

    expectAcmeError(
      () =>
        engine.prepare(
          policy({ resolve }),
          [
            candidate('invalid', {
              source: {
                ...candidate('invalid').source,
                executionId: 'another-execution',
              },
            }),
          ],
          [],
          context,
        ),
      'DOMAIN_INVALID_RESULT',
    );
    expect(resolve).not.toHaveBeenCalled();

    expectAcmeError(
      () =>
        engine.prepare(
          policy(),
          [candidate('duplicate'), candidate('duplicate')],
          [],
          context,
        ),
      'DOMAIN_INVALID_RESULT',
    );
    expect(id.next).not.toHaveBeenCalled();
  });

  it('maps corrupt loaded records before policy execution', () => {
    const engine = createMemoryEngine({ ids: idFixture().ids });
    const validate = vi.fn(() => []);

    expectAcmeError(
      () =>
        engine.prepare(
          policy({ validate }),
          [candidate('valid')],
          [
            record('memory-1', 'identity-1', {
              namespace: 'foreign',
            }),
          ],
          context,
        ),
      'PERSISTENCE_CORRUPTION',
    );
    expect(validate).not.toHaveBeenCalled();

    expectAcmeError(
      () =>
        engine.prepare(
          policy(),
          [],
          [record('memory-1', 'duplicate'), record('memory-2', 'duplicate')],
          context,
        ),
      'PERSISTENCE_CORRUPTION',
    );
  });

  it('rejects policy issues and malformed identities or resolutions', () => {
    const id = idFixture();
    const engine = createMemoryEngine({ ids: id.ids });

    const rejected = expectAcmeError(
      () =>
        engine.prepare(
          policy({
            validate: () => [
              {
                code: 'CANDIDATE_REJECTED',
                path: ['value'],
                message: 'Candidate is not durable.',
              },
            ],
          }),
          [candidate('invalid')],
          [],
          context,
        ),
      'DOMAIN_INVALID_RESULT',
    );
    expect(rejected.data.details).toMatchObject({
      candidateKey: 'invalid',
      issues: [{ code: 'CANDIDATE_REJECTED' }],
    });

    expectAcmeError(
      () =>
        engine.prepare(
          policy({ identity: () => '' }),
          [candidate('invalid')],
          [],
          context,
        ),
      'DOMAIN_INVALID_RESULT',
    );

    expectAcmeError(
      () =>
        engine.prepare(
          policy({
            resolve: () => ({
              candidateKey: 'wrong',
              action: 'create',
              value: {},
              strength: 0.5,
            }),
          }),
          [candidate('invalid')],
          [],
          context,
        ),
      'DOMAIN_INVALID_RESULT',
    );
    expect(id.next).not.toHaveBeenCalled();
  });

  it('rejects invalid targets, strengths, and replacement conflicts before ID allocation', () => {
    const current = record('memory-1', 'identity-conflict');
    const id = idFixture();
    const engine = createMemoryEngine({ ids: id.ids });

    expectAcmeError(
      () =>
        engine.prepare(
          policy({
            resolve: ({ key }) => ({
              candidateKey: key,
              action: 'reinforce',
              memoryId: 'missing',
              strength: 0.5,
            }),
          }),
          [candidate('invalid')],
          [current],
          context,
        ),
      'DOMAIN_INVALID_RESULT',
    );

    expectAcmeError(
      () =>
        engine.prepare(
          policy({
            resolve: ({ key }) => ({
              candidateKey: key,
              action: 'contradict',
              memoryIds: [current.memoryId, current.memoryId],
              disposition: 'contest',
            }),
          }),
          [candidate('invalid')],
          [current],
          context,
        ),
      'DOMAIN_INVALID_RESULT',
    );

    expectAcmeError(
      () =>
        engine.prepare(
          policy({
            resolve: ({ key }) =>
              ({
                candidateKey: key,
                action: 'create',
                value: {},
                strength: Number.NaN,
              }) as MemoryResolution,
          }),
          [candidate('invalid')],
          [],
          context,
        ),
      'DOMAIN_INVALID_RESULT',
    );

    expectAcmeError(
      () =>
        engine.prepare(
          policy({
            identity: () => current.identityKey,
            resolve: ({ key }) => ({
              candidateKey: key,
              action: 'contradict',
              memoryIds: [current.memoryId],
              disposition: 'supersede-existing',
              replacement: {
                value: {},
                strength: 0.5,
              },
            }),
          }),
          [candidate('invalid')],
          [current],
          context,
        ),
      'DOMAIN_INVALID_RESULT',
    );
    expect(id.next).not.toHaveBeenCalled();
  });

  it('protects caller and policy inputs from mutation', () => {
    const originalCandidate = candidate('immutable');
    const originalRecord = record('memory-1', 'identity-1');
    const engine = createMemoryEngine({ ids: idFixture().ids });

    expectAcmeError(
      () =>
        engine.prepare(
          policy({
            resolve: (item, existing) => {
              expect(Object.isFrozen(item)).toBe(true);
              expect(Object.isFrozen(existing)).toBe(true);
              expect(Object.isFrozen(existing[0]?.value)).toBe(true);
              (existing as MemoryRecord[]).push(originalRecord);
              return {
                candidateKey: item.key,
                action: 'ignore',
                reason: 'unreachable',
              };
            },
          }),
          [originalCandidate],
          [originalRecord],
          context,
        ),
      'DOMAIN_INVALID_RESULT',
    );
    expect(originalCandidate).toEqual(candidate('immutable'));
    expect(originalRecord).toEqual(record('memory-1', 'identity-1'));
  });
});

describe('MemoryEngine.retrieve', () => {
  it('validates policy results, sorts ties, and enforces the limit', () => {
    const engine = createMemoryEngine({ ids: idFixture().ids });
    const alpha = record('memory-a', 'alpha');
    const beta = record('memory-b', 'beta');
    const gamma = record('memory-g', 'gamma');
    const retrieve = vi.fn(
      (
        query: Parameters<DomainMemoryPolicy['retrieve']>[0],
        records: readonly MemoryRecord[],
      ) => {
        expect(Object.isFrozen(query)).toBe(true);
        expect(Object.isFrozen(records)).toBe(true);
        expect(records.map(({ identityKey }) => identityKey)).toEqual([
          'alpha',
          'beta',
          'gamma',
        ]);
        return [
          { record: beta, score: 1, reasons: ['tie'] },
          { record: alpha, score: 1, reasons: ['tie'] },
          { record: gamma, score: 2, reasons: ['highest'] },
        ];
      },
    );

    const ranked = engine.retrieve(
      policy({ retrieve }),
      {
        namespace: context.namespace,
        entityId: context.entityId,
        task: 'observe',
        limit: 2,
      },
      [gamma, beta, alpha],
    );

    expect(ranked.map(({ record: item }) => item.memoryId)).toEqual([
      'memory-g',
      'memory-a',
    ]);
    expect(Object.isFrozen(ranked)).toBe(true);
    expect(Object.isFrozen(ranked[0]?.reasons)).toBe(true);
  });

  it('rejects unknown, modified, duplicate, and non-finite policy results', () => {
    const engine = createMemoryEngine({ ids: idFixture().ids });
    const current = record('memory-1', 'identity-1');
    const query = {
      namespace: context.namespace,
      entityId: context.entityId,
      task: 'observe',
      limit: 3,
    };

    expectAcmeError(
      () =>
        engine.retrieve(
          policy({
            retrieve: () => [
              {
                record: record('memory-unknown', 'unknown'),
                score: 1,
                reasons: [],
              },
            ],
          }),
          query,
          [current],
        ),
      'DOMAIN_INVALID_RESULT',
    );

    expectAcmeError(
      () =>
        engine.retrieve(
          policy({
            retrieve: () => [
              {
                record: { ...current, strength: 9 },
                score: 1,
                reasons: [],
              },
            ],
          }),
          query,
          [current],
        ),
      'DOMAIN_INVALID_RESULT',
    );

    expectAcmeError(
      () =>
        engine.retrieve(
          policy({
            retrieve: () => [
              { record: current, score: 1, reasons: [] },
              { record: current, score: 0.5, reasons: [] },
            ],
          }),
          query,
          [current],
        ),
      'DOMAIN_INVALID_RESULT',
    );

    expectAcmeError(
      () =>
        engine.retrieve(
          policy({
            retrieve: () => [
              {
                record: current,
                score: Number.POSITIVE_INFINITY,
                reasons: [],
              },
            ],
          }),
          query,
          [current],
        ),
      'DOMAIN_INVALID_RESULT',
    );
  });

  it('maps invalid queries and loaded records to their boundary errors', () => {
    const engine = createMemoryEngine({ ids: idFixture().ids });

    expectAcmeError(
      () =>
        engine.retrieve(
          policy(),
          {
            namespace: context.namespace,
            entityId: context.entityId,
            task: 'observe',
            limit: 0,
          },
          [],
        ),
      'INVALID_REQUEST',
    );

    expectAcmeError(
      () =>
        engine.retrieve(
          policy(),
          {
            namespace: context.namespace,
            entityId: context.entityId,
            task: 'observe',
            kinds: ['fact', 'fact'],
            limit: 1,
          },
          [],
        ),
      'INVALID_REQUEST',
    );

    expectAcmeError(
      () =>
        engine.retrieve(
          policy(),
          {
            namespace: context.namespace,
            entityId: context.entityId,
            task: 'observe',
            limit: 1,
          },
          [record('memory-1', 'identity-1', { recordVersion: 0 })],
        ),
      'PERSISTENCE_CORRUPTION',
    );
  });
});

describe('MemoryEngine.applyLifecycle', () => {
  it('runs in stable order and prepares retain, strength, and forget decisions', () => {
    const engine = createMemoryEngine({ ids: idFixture().ids });
    const forgotten = record('memory-forget', 'alpha');
    const strengthened = record('memory-strength', 'beta');
    const retained = record('memory-retain', 'gamma');
    const seen: string[] = [];

    const prepared = engine.applyLifecycle(
      policy({
        lifecycle: (item) => {
          seen.push(item.identityKey);
          expect(Object.isFrozen(item)).toBe(true);
          if (item.memoryId === forgotten.memoryId) {
            return { action: 'forget', reason: 'expired' };
          }
          if (item.memoryId === strengthened.memoryId) {
            return { action: 'update-strength', strength: 0.2 };
          }
          return { action: 'retain' };
        },
      }),
      [retained, strengthened, forgotten],
      'maintenance',
      {
        namespace: context.namespace,
        entityId: context.entityId,
        now: context.now,
      },
    );

    expect(seen).toEqual(['alpha', 'beta', 'gamma']);
    expect(
      prepared.decisions.map(({ memoryId, decision: item }) => [
        memoryId,
        item.action,
      ]),
    ).toEqual([
      ['memory-forget', 'forget'],
      ['memory-strength', 'update-strength'],
      ['memory-retain', 'retain'],
    ]);
    expect(prepared.mutations).toEqual([
      {
        action: 'update',
        expectedRecordVersion: 3,
        record: {
          ...forgotten,
          status: 'forgotten',
          recordVersion: 4,
        },
      },
      {
        action: 'update',
        expectedRecordVersion: 3,
        record: {
          ...strengthened,
          strength: 0.2,
          recordVersion: 4,
        },
      },
    ]);
    expect(Object.isFrozen(prepared)).toBe(true);
  });

  it('rejects invalid hooks and policy lifecycle results', () => {
    const engine = createMemoryEngine({ ids: idFixture().ids });
    const current = record('memory-1', 'identity-1');
    const lifecycleContext = {
      namespace: context.namespace,
      entityId: context.entityId,
      now: context.now,
    };

    expectAcmeError(
      () =>
        engine.applyLifecycle(
          policy(),
          [current],
          'background' as MemoryLifecycleHook,
          lifecycleContext,
        ),
      'INVALID_REQUEST',
    );

    expectAcmeError(
      () =>
        engine.applyLifecycle(
          policy({
            lifecycle: () => ({
              action: 'update-strength',
              strength: Number.NaN,
            }),
          }),
          [current],
          'maintenance',
          lifecycleContext,
        ),
      'DOMAIN_INVALID_RESULT',
    );
  });
});
