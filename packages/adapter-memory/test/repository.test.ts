import {
  AcmeError,
  canonicalJson,
  computeOperationDigest,
  sha256,
  type AcceptedExecution,
  type IdGenerator,
  type PreparedCommit,
  type PreparedCommitContent,
} from '@acme/core';
import { describe, expect, it, vi } from 'vitest';

import { createInMemoryExecutionRepository } from '../src/index.js';

const now = '2026-07-29T12:00:00.000Z';

function ids() {
  const counts = { document: 0, event: 0 };
  const next = vi.fn((kind: Parameters<IdGenerator['next']>[0]) => {
    if (kind !== 'document' && kind !== 'event') {
      throw new Error(`Unexpected ID kind: ${kind}`);
    }
    counts[kind] += 1;
    return `${kind}-${counts[kind]}`;
  });
  return { generator: { next } satisfies IdGenerator, next };
}

function accepted(
  executionId: string,
  expectedRevision = 0,
): AcceptedExecution {
  return {
    executionId,
    request: {
      requestKey: executionId,
      namespace: 'example',
      task: 'observe',
      entityId: 'entity-1',
      expectedRevision,
      input: { value: executionId },
      model: { profile: 'fixture' },
    },
    requestFingerprint: `request-${executionId}`,
    inputHash: `input-${executionId}`,
    contract: { id: 'example.observe', version: '1.0.0' },
    contractFingerprint: 'contract-fingerprint',
    effectivePolicy: {
      timeoutMs: 1_000,
      maxModelCalls: 1,
      maxRepairCalls: 0,
      maxRevisionCalls: 0,
      retention: 'hash-only',
    },
    createdAt: now,
  };
}

function prepared(
  executionId: string,
  overrides: Partial<PreparedCommitContent> = {},
): PreparedCommit {
  const content: PreparedCommitContent = {
    executionId,
    expectedRevision: 0,
    documents: [],
    memoryCandidates: [],
    memory: { decisions: [], mutations: [] },
    state: null,
    evaluatorRuns: [],
    events: [],
    committedAt: now,
    ...overrides,
  };
  return { ...content, operationDigest: computeOperationDigest(content) };
}

function expectCode(
  operation: Promise<unknown>,
  code: AcmeError['data']['code'],
) {
  return expect(operation).rejects.toMatchObject({
    data: { code, stage: 'preparing-commit', retryable: false },
  });
}

function fullCommit(executionId = 'execution-full'): PreparedCommit {
  const stateValue = { count: 1 };
  const stateHash = sha256(canonicalJson(stateValue));
  const candidate = {
    key: 'memory-candidate-1',
    kind: 'example.fact',
    schemaVersion: '1.0.0',
    value: { fact: 'stable' },
    source: {
      executionId,
      contract: { id: 'example.observe', version: '1.0.0' },
      documentKeys: ['document-1'],
    },
  };
  const memoryRecord = {
    memoryId: 'memory-1',
    namespace: 'example',
    entityId: 'entity-1',
    identityKey: 'fact:stable',
    kind: 'example.fact',
    schemaVersion: '1.0.0',
    value: { fact: 'stable' },
    strength: 0.8,
    status: 'active' as const,
    firstSeenAt: now,
    lastSeenAt: now,
    lastReinforcedAt: now,
    provenance: [candidate.source],
    recordVersion: 1,
  };
  return prepared(executionId, {
    documents: [
      {
        key: 'document-1',
        kind: 'example.observation',
        schemaVersion: '1.0.0',
        value: { observed: true },
        contentHash: sha256(canonicalJson({ observed: true })),
      },
    ],
    memoryCandidates: [candidate],
    memory: {
      decisions: [
        {
          candidateKey: candidate.key,
          identityKey: memoryRecord.identityKey,
          resolution: {
            candidateKey: candidate.key,
            action: 'create',
            value: candidate.value,
            strength: memoryRecord.strength,
          },
          affectedMemoryIds: [memoryRecord.memoryId],
        },
      ],
      mutations: [{ action: 'create', record: memoryRecord }],
    },
    state: {
      snapshot: {
        entityId: 'entity-1',
        namespace: 'example',
        schemaVersion: '1.0.0',
        revision: 1,
        value: stateValue,
        valueHash: stateHash,
        createdAt: now,
        executionId,
      },
      transition: {
        transitionId: `transition-${executionId}`,
        operationKey: `operation-${executionId}`,
        entityId: 'entity-1',
        namespace: 'example',
        fromRevision: 0,
        toRevision: 1,
        deltaSchemaVersion: '1.0.0',
        delta: { amount: 1 },
        previousHash: null,
        nextHash: stateHash,
        executionId,
        createdAt: now,
      },
    },
    evaluatorRuns: [
      {
        evaluatorId: 'quality',
        evaluatorVersion: '1.0.0',
        attempt: 1,
        subjectHash: 'subject-hash',
        decision: { outcome: 'allow', scores: { quality: 1 } },
      },
    ],
    events: [
      {
        key: 'event-1',
        type: 'example.observed',
        schemaVersion: '1.0.0',
        payload: { observed: true },
      },
    ],
  });
}

describe('InMemoryExecutionRepository', () => {
  it('commits every effect atomically and returns immutable detached evidence', async () => {
    const id = ids();
    const repository = createInMemoryExecutionRepository({
      ids: id.generator,
    });
    const acceptance = accepted('execution-full');
    await repository.accept(acceptance);
    (acceptance.request.input as { value: string }).value = 'caller-mutation';

    const commit = fullCommit();
    const result = await repository.commit(commit);
    expect(result).toEqual({
      executionId: 'execution-full',
      revision: 1,
      documentKeys: ['document-1'],
      eventIds: ['event-1'],
      operationDigest: commit.operationDigest,
    });
    expect(id.next).toHaveBeenCalledTimes(2);

    const evidence = repository.snapshot();
    expect(evidence).toMatchObject({
      executions: [{ status: 'committed' }],
      documents: [{ documentId: 'document-1', key: 'document-1' }],
      memoryCandidates: [{ candidate: { key: 'memory-candidate-1' } }],
      memoryRecords: [{ memoryId: 'memory-1', recordVersion: 1 }],
      state: {
        snapshots: [{ revision: 1 }],
        transitions: [{ transitionId: 'transition-execution-full' }],
      },
      evaluatorRuns: [{ evaluatorId: 'quality' }],
      events: [{ eventId: 'event-1' }],
      outbox: [{ eventId: 'event-1', status: 'pending' }],
    });
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.memoryRecords[0]?.value)).toBe(true);
    expect((await repository.get('execution-full'))?.request.input).toEqual({
      value: 'execution-full',
    });

    const context = await repository.loadContext({
      namespace: 'example',
      entityId: 'entity-1',
      expectedRevision: 1,
      memory: {
        namespace: 'example',
        entityId: 'entity-1',
        task: 'observe',
        limit: 10,
      },
    });
    expect(context).toMatchObject({
      state: { revision: 1 },
      memories: [{ memoryId: 'memory-1' }],
      documents: [{ key: 'document-1' }],
    });

    await expect(repository.commit(commit)).resolves.toEqual(result);
    expect(id.next).toHaveBeenCalledTimes(2);
  });

  it('publishes no partial effects when late ID allocation fails', async () => {
    const next = vi.fn((kind: Parameters<IdGenerator['next']>[0]) => {
      if (kind === 'event') {
        throw new Error('fixture failure');
      }
      return 'document-1';
    });
    const repository = createInMemoryExecutionRepository({
      ids: { next },
    });
    await repository.accept(accepted('execution-full'));

    await expectCode(repository.commit(fullCommit()), 'INTERNAL');
    expect(repository.snapshot()).toMatchObject({
      executions: [{ status: 'accepted' }],
      documents: [],
      memoryCandidates: [],
      memoryRecords: [],
      state: { snapshots: [], transitions: [] },
      evaluatorRuns: [],
      events: [],
      outbox: [],
    });
  });

  it('rejects stale state even without a delta and allows one writer', async () => {
    const repository = createInMemoryExecutionRepository({
      ids: ids().generator,
    });
    await repository.accept(accepted('writer-1'));
    await repository.accept(accepted('writer-2'));
    await repository.commit(fullCommit('writer-1'));

    await expectCode(
      repository.commit(prepared('writer-2')),
      'CONFLICT_STATE_REVISION',
    );
    expect((await repository.get('writer-2'))?.status).toBe('accepted');
  });

  it('uses memory-version conflicts for sequential update CAS failures', async () => {
    const repository = createInMemoryExecutionRepository({
      ids: ids().generator,
    });
    await repository.accept(accepted('memory-create'));
    await repository.commit(
      prepared('memory-create', {
        memory: fullCommit('memory-create').memory,
        memoryCandidates: fullCommit('memory-create').memoryCandidates,
      }),
    );
    await repository.accept(accepted('memory-update'));
    const existing = repository.snapshot().memoryRecords[0];
    expect(existing).toBeDefined();
    if (existing === undefined) {
      throw new Error('Fixture memory record was not persisted.');
    }
    const updated = {
      ...existing,
      value: { fact: 'changed' },
      recordVersion: 2,
    };
    const commit = prepared('memory-update', {
      memory: {
        decisions: [],
        mutations: [
          {
            action: 'update',
            expectedRecordVersion: 0,
            record: updated,
          },
        ],
      },
    });

    await expectCode(repository.commit(commit), 'CONFLICT_MEMORY_VERSION');
    expect(repository.snapshot().memoryRecords).toEqual([existing]);
    expect((await repository.get('memory-update'))?.status).toBe('accepted');
  });

  it('rejects invalid hashes and persisted transition identity collisions', async () => {
    const repository = createInMemoryExecutionRepository({
      ids: ids().generator,
    });
    await repository.accept(accepted('bad-document'));
    const invalidDocument = prepared('bad-document', {
      documents: [
        {
          key: 'bad',
          kind: 'fixture',
          schemaVersion: '1.0.0',
          value: { valid: false },
          contentHash: 'wrong',
        },
      ],
    });
    await expectCode(repository.commit(invalidDocument), 'INVALID_REQUEST');
    expect(repository.snapshot().documents).toEqual([]);

    await repository.accept(accepted('transition-first'));
    await repository.commit(fullCommit('transition-first'));
    await repository.accept(accepted('transition-second', 1));
    const collision = fullCommit('transition-second');
    if (collision.state === null) {
      throw new Error('Fixture state was not prepared.');
    }
    const collisionContent: PreparedCommitContent = {
      ...collision,
      expectedRevision: 1,
      state: {
        snapshot: {
          ...collision.state.snapshot,
          revision: 2,
        },
        transition: {
          ...collision.state.transition,
          transitionId: 'transition-transition-first',
          fromRevision: 1,
          toRevision: 2,
          previousHash: collision.state.snapshot.valueHash,
        },
      },
    };
    const collisionCommit = {
      ...collisionContent,
      operationDigest: computeOperationDigest(collisionContent),
    };
    await expectCode(
      repository.commit(collisionCommit),
      'PERSISTENCE_CORRUPTION',
    );
  });
});
