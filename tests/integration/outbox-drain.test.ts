import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createInMemoryExecutionRepository } from '../../packages/adapter-memory/src/index.js';
import {
  createSqliteExecutionRepository,
  openDatabase,
} from '../../packages/adapter-sqlite/src/index.js';
import {
  computeOperationDigest,
  drainOutbox,
  type AcceptedExecution,
  type DomainEventRecord,
  type ExecutionRepository,
  type IdGenerator,
  type PreparedCommit,
  type PreparedCommitContent,
} from '../../packages/core/src/index.js';

type OpenDatabase = ReturnType<typeof openDatabase>;

const committedAt = '2026-07-31T10:00:00.000Z';
const roots: string[] = [];
const opened: OpenDatabase[] = [];

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close();
  }
  while (roots.length > 0) {
    rmSync(roots.pop() ?? '', { recursive: true, force: true });
  }
});

function ids(): IdGenerator {
  const counts = new Map<string, number>();
  return {
    next(kind) {
      const count = (counts.get(kind) ?? 0) + 1;
      counts.set(kind, count);
      return `${kind}-${count}`;
    },
  };
}

function memoryRepository(): ExecutionRepository {
  return createInMemoryExecutionRepository({ ids: ids() });
}

function sqliteRepository(): ExecutionRepository {
  const root = mkdtempSync(join(tmpdir(), 'acme-outbox-'));
  roots.push(root);
  const database = openDatabase({
    location: join(root, 'acme.sqlite'),
    appliedAt: committedAt,
  });
  opened.push(database);
  return createSqliteExecutionRepository({ database, ids: ids() });
}

const accepted: AcceptedExecution = {
  executionId: 'execution-outbox-1',
  request: {
    requestKey: 'outbox-1',
    namespace: 'neutral',
    task: 'observe',
    entityId: 'entity-1',
    expectedRevision: 0,
    input: { note: 'outbox' },
    model: { profile: 'fixture' },
  },
  requestFingerprint: 'fingerprint-outbox-1',
  inputHash: 'input-outbox-1',
  contract: { id: 'neutral.observe', version: '1.0.0' },
  contractFingerprint: 'contract-fingerprint',
  effectivePolicy: {
    timeoutMs: 1_000,
    maxModelCalls: 1,
    maxRepairCalls: 0,
    maxRevisionCalls: 0,
    retention: 'hash-only',
  },
  createdAt: committedAt,
};

function committedEvents(): PreparedCommit {
  const content: PreparedCommitContent = {
    executionId: accepted.executionId,
    expectedRevision: 0,
    documents: [],
    memoryCandidates: [],
    memory: { decisions: [], mutations: [] },
    state: null,
    evaluatorRuns: [],
    events: [
      {
        key: 'observed-1',
        type: 'neutral.observed',
        schemaVersion: '1.0.0',
        payload: { order: 1 },
      },
      {
        key: 'observed-2',
        type: 'neutral.observed',
        schemaVersion: '1.0.0',
        payload: { order: 2 },
      },
    ],
    committedAt,
  };
  return { ...content, operationDigest: computeOperationDigest(content) };
}

const adapters = [
  ['in-memory', memoryRepository],
  ['sqlite', sqliteRepository],
] as const;

describe.each(adapters)('outbox drain over the %s adapter', (_name, create) => {
  it('drains committed events to empty and stops finding work', async () => {
    const repository = create();
    await repository.accept(accepted);
    await repository.commit(committedEvents());

    const seen: DomainEventRecord[] = [];
    const options = {
      repository,
      dispatcher: {
        async deliver(event: DomainEventRecord) {
          seen.push(event);
        },
      },
      clock: { now: () => committedAt },
      limit: 1,
      leaseTimeoutMs: 30_000,
    };

    // The limit bounds one call, so emptying the outbox is the caller's loop.
    const first = await drainOutbox(options);
    expect(first).toMatchObject({ leased: 1, delivered: 1, failed: 0 });
    const second = await drainOutbox(options);
    expect(second).toMatchObject({ leased: 1, delivered: 1 });
    const third = await drainOutbox(options);
    expect(third).toMatchObject({ leased: 0, delivered: 0, entries: [] });

    expect(seen.map((event) => event.payload)).toEqual([
      { order: 1 },
      { order: 2 },
    ]);
    await expect(
      repository.listOutbox({ status: 'pending', limit: 10 }),
    ).resolves.toEqual([]);
    await expect(
      repository.listOutbox({ status: 'delivered', limit: 10 }),
    ).resolves.toHaveLength(2);
  });

  it('re-delivers after the claim expires when settlement never happened', async () => {
    const repository = create();
    await repository.accept(accepted);
    await repository.commit(committedEvents());

    // A process that dies after delivering but before settling: at-least-once
    // means the event comes back, not that it disappears (ADR-0018).
    const lost = vi.fn(async () => {});
    const leased = await repository.leaseOutbox({
      now: committedAt,
      limit: 10,
      leaseExpiresAt: '2026-07-31T10:00:30.000Z',
    });
    expect(leased).toHaveLength(2);
    await lost();

    await expect(
      drainOutbox({
        repository,
        dispatcher: { deliver: async () => {} },
        clock: { now: () => '2026-07-31T10:00:29.000Z' },
        limit: 10,
        leaseTimeoutMs: 30_000,
      }),
    ).resolves.toMatchObject({ leased: 0 });

    const redelivered = await drainOutbox({
      repository,
      dispatcher: { deliver: async () => {} },
      clock: { now: () => '2026-07-31T10:00:31.000Z' },
      limit: 10,
      leaseTimeoutMs: 30_000,
    });
    expect(redelivered).toMatchObject({ leased: 2, delivered: 2 });
    // The attempt count records both claims, including the lost one.
    expect(redelivered.entries.map((entry) => entry.attemptCount)).toEqual([
      2, 2,
    ]);
  });

  it('keeps a failed entry out of later drains and records its error', async () => {
    const repository = create();
    await repository.accept(accepted);
    await repository.commit(committedEvents());

    const report = await drainOutbox({
      repository,
      dispatcher: {
        async deliver() {
          throw new Error('consumer rejected the event');
        },
      },
      clock: { now: () => committedAt },
      limit: 10,
      leaseTimeoutMs: 30_000,
      retry: () => null,
    });
    expect(report).toMatchObject({ leased: 2, delivered: 0, failed: 2 });

    const failed = await repository.listOutbox({ status: 'failed', limit: 10 });
    expect(failed).toHaveLength(2);
    expect(failed[0]?.record.lastError).toMatchObject({
      code: 'INTERNAL',
      message: 'Outbox delivery failed: consumer rejected the event',
    });
    await expect(
      drainOutbox({
        repository,
        dispatcher: { deliver: async () => {} },
        clock: { now: () => '2026-08-01T10:00:00.000Z' },
        limit: 10,
        leaseTimeoutMs: 30_000,
      }),
    ).resolves.toMatchObject({ leased: 0 });
  });
});
