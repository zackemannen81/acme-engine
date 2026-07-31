import {
  ACME_MEMORY_RETRIEVAL_LIMIT,
  AcmeError,
  computeRequestFingerprint,
  createMemoryEngine,
  deriveExecutionId,
  deriveOperationKey,
  resolveExecutionPolicy,
  type DomainMemoryPolicy,
  type MemoryRecord,
} from '../src/index.js';
import { describe, expect, it } from 'vitest';

function expectCode(operation: () => unknown, code: AcmeError['data']['code']) {
  expect(operation).toThrowError(
    expect.objectContaining({
      data: expect.objectContaining({ code, stage: 'accepted' }),
    }),
  );
}

const fingerprintInput = {
  namespace: 'example',
  task: 'observe',
  entityId: 'entity-1',
  expectedRevision: 0,
  input: { value: 'stable' },
  contractFingerprint: 'contract-fingerprint',
  stateSchemaVersion: 'example-state/1',
  model: { profile: 'offline' },
} as const;

describe('Milestone 1 execution identity', () => {
  it('freezes the execution and operation identity golden vectors', () => {
    expect(deriveExecutionId('example', 'request-1')).toBe(
      'execution_c45f239eab604b437b28306f170cc4039ab4c96f7352213c30ea464bfc049f7e',
    );
    expect(
      deriveOperationKey({
        executionId: 'execution-1',
        namespace: 'example',
        task: 'observe',
        entityId: 'entity-1',
      }),
    ).toBe(
      'operation_8e0c0db245266bf3e444a6ec6996d825905ad0d70b34cf552392ee0766ea3308',
    );
    expect(ACME_MEMORY_RETRIEVAL_LIMIT).toBe(50);
  });

  it('resolves immutable defaults and rejects unsupported call budgets', () => {
    expect(resolveExecutionPolicy()).toEqual({
      timeoutMs: 30_000,
      maxModelCalls: 1,
      maxRepairCalls: 0,
      maxRevisionCalls: 0,
      retention: 'hash-only',
    });
    expect(Object.isFrozen(resolveExecutionPolicy())).toBe(true);
    expectCode(
      () => resolveExecutionPolicy({ maxRepairCalls: 1 }),
      'INVALID_REQUEST',
    );
    expectCode(
      () => resolveExecutionPolicy({ maxRevisionCalls: 1 }),
      'INVALID_REQUEST',
    );
    expectCode(
      () => resolveExecutionPolicy({ maxModelCalls: 2 }),
      'INVALID_REQUEST',
    );
  });

  it('binds model selection while operational budget remains outside identity', () => {
    const base = computeRequestFingerprint(fingerprintInput);
    expect(
      computeRequestFingerprint({
        ...fingerprintInput,
        model: { profile: 'different' },
      }),
    ).not.toBe(base);

    const firstPolicy = resolveExecutionPolicy({
      timeoutMs: 1_000,
      maxInputTokens: 10,
      retention: 'none',
    });
    const secondPolicy = resolveExecutionPolicy({
      timeoutMs: 90_000,
      maxInputTokens: 10_000,
      retention: 'encrypted-payload',
    });
    expect(firstPolicy).not.toEqual(secondPolicy);
    expect(computeRequestFingerprint(fingerprintInput)).toBe(base);
  });

  it('truncates deterministic retrieval at the versioned constant limit', () => {
    const records: MemoryRecord[] = Array.from(
      { length: ACME_MEMORY_RETRIEVAL_LIMIT + 1 },
      (_, index) => ({
        memoryId: `memory-${String(index).padStart(3, '0')}`,
        namespace: 'example',
        entityId: 'entity-1',
        identityKey: `identity-${String(index).padStart(3, '0')}`,
        kind: 'example.fact',
        schemaVersion: 'example-memory/1',
        value: { index },
        strength: 1,
        status: 'active',
        firstSeenAt: '2026-07-31T00:00:00.000Z',
        lastSeenAt: '2026-07-31T00:00:00.000Z',
        lastReinforcedAt: '2026-07-31T00:00:00.000Z',
        provenance: [
          {
            executionId: 'execution-source',
            contract: { id: 'example.observe', version: '1.0.0' },
            documentKeys: ['source'],
          },
        ],
        recordVersion: 1,
      }),
    );
    const policy: DomainMemoryPolicy = {
      validate: () => [],
      identity: () => 'unused',
      retrieve: (_query, supplied) =>
        supplied.map((record) => ({
          record,
          score: 1,
          reasons: ['fixture'],
        })),
      resolve: (candidate) => ({
        candidateKey: candidate.key,
        action: 'ignore',
        reason: 'unused',
      }),
      lifecycle: () => ({ action: 'retain' }),
    };
    const engine = createMemoryEngine({
      ids: {
        next() {
          throw new Error('Retrieval must not allocate IDs.');
        },
      },
    });
    const ranked = engine.retrieve(
      policy,
      {
        namespace: 'example',
        entityId: 'entity-1',
        task: 'observe',
        limit: ACME_MEMORY_RETRIEVAL_LIMIT,
      },
      records,
    );
    expect(ranked).toHaveLength(ACME_MEMORY_RETRIEVAL_LIMIT);
    expect(ranked.at(-1)?.record.memoryId).toBe('memory-049');
  });
});
