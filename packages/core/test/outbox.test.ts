import { describe, expect, it, vi } from 'vitest';

import {
  drainOutbox,
  type LeasedOutboxEntry,
  type DeliveredOutboxEntry,
  type DomainEventRecord,
  type ExecutionRepository,
  type FailedOutboxEntry,
  type OutboxLease,
} from '../src/index.js';

const now = '2026-07-31T10:00:00.000Z';

function event(eventId: string): DomainEventRecord {
  return {
    eventId,
    executionId: 'execution-1',
    key: `${eventId}-key`,
    namespace: 'neutral',
    entityId: 'entity-1',
    type: 'neutral.observed',
    schemaVersion: '1.0.0',
    payload: { eventId },
    occurredAt: now,
  };
}

function entry(eventId: string, attemptCount = 1): LeasedOutboxEntry {
  return {
    record: {
      eventId,
      status: 'claimed',
      attemptCount,
      availableAt: '2026-07-31T10:00:30.000Z',
      claimedAt: now,
    },
    event: event(eventId),
  };
}

function repository(claimed: readonly LeasedOutboxEntry[]) {
  const claims: OutboxLease[] = [];
  const delivered = vi.fn(async (entry: DeliveredOutboxEntry) => {
    void entry;
  });
  const failed = vi.fn(async (entry: FailedOutboxEntry) => {
    void entry;
  });
  const stub = {
    async leaseOutbox(claim: OutboxLease) {
      claims.push(claim);
      return claimed;
    },
    markOutboxDelivered: delivered,
    markOutboxFailed: failed,
  } as unknown as ExecutionRepository;
  return { stub, claims, delivered, failed };
}

describe('drainOutbox', () => {
  it('delivers a claimed batch and settles each entry as delivered', async () => {
    const subject = repository([entry('event-1'), entry('event-2')]);
    const deliver = vi.fn(async () => {});

    const report = await drainOutbox({
      repository: subject.stub,
      dispatcher: { deliver },
      clock: { now: () => now },
      limit: 10,
      leaseTimeoutMs: 30_000,
    });

    expect(subject.claims).toEqual([
      { now, limit: 10, leaseExpiresAt: '2026-07-31T10:00:30.000Z' },
    ]);
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(subject.delivered.mock.calls).toEqual([
      [{ eventId: 'event-1', deliveredAt: now }],
      [{ eventId: 'event-2', deliveredAt: now }],
    ]);
    expect(subject.failed).not.toHaveBeenCalled();
    expect(report).toMatchObject({
      report: 'acme-outbox-drain-report/1',
      leased: 2,
      delivered: 2,
      retryScheduled: 0,
      failed: 0,
      entries: [
        { eventId: 'event-1', outcome: 'delivered' },
        { eventId: 'event-2', outcome: 'delivered' },
      ],
    });
    expect(Object.isFrozen(report)).toBe(true);
  });

  it('claims one batch only and never exceeds the requested limit', async () => {
    const subject = repository([entry('event-1')]);
    await drainOutbox({
      repository: subject.stub,
      dispatcher: { deliver: async () => {} },
      clock: { now: () => now },
      limit: 1,
      leaseTimeoutMs: 5_000,
    });
    // One claim per call: emptying the outbox is the caller's loop, not ours.
    expect(subject.claims).toEqual([
      { now, limit: 1, leaseExpiresAt: '2026-07-31T10:00:05.000Z' },
    ]);
  });

  it('schedules a retry when delivery fails and the policy allows it', async () => {
    const subject = repository([entry('event-1')]);
    const report = await drainOutbox({
      repository: subject.stub,
      dispatcher: {
        async deliver() {
          throw new Error('transport refused');
        },
      },
      clock: { now: () => now },
      limit: 10,
      leaseTimeoutMs: 30_000,
      retry: () => 60_000,
    });

    expect(subject.failed.mock.calls[0]?.[0]).toMatchObject({
      eventId: 'event-1',
      failedAt: now,
      retryAt: '2026-07-31T10:01:00.000Z',
      error: {
        code: 'INTERNAL',
        message: 'Outbox delivery failed: transport refused',
        retryable: true,
      },
    });
    expect(report).toMatchObject({
      delivered: 0,
      retryScheduled: 1,
      failed: 0,
      entries: [
        {
          eventId: 'event-1',
          outcome: 'retry-scheduled',
          retryAt: '2026-07-31T10:01:00.000Z',
        },
      ],
    });
  });

  it('gives up without a retry time when the policy returns null', async () => {
    const subject = repository([entry('event-1', 4)]);
    const retry = vi.fn(() => null);
    const report = await drainOutbox({
      repository: subject.stub,
      dispatcher: {
        async deliver() {
          throw new Error('transport refused');
        },
      },
      clock: { now: () => now },
      limit: 10,
      leaseTimeoutMs: 30_000,
      retry,
    });

    expect(retry).toHaveBeenCalledWith(4);
    expect(subject.failed.mock.calls[0]?.[0]).not.toHaveProperty('retryAt');
    expect(report).toMatchObject({
      failed: 1,
      entries: [{ eventId: 'event-1', outcome: 'failed' }],
    });
  });

  it('defaults to one retry and then gives up', async () => {
    const first = repository([entry('event-1', 1)]);
    const second = repository([entry('event-1', 2)]);
    const dispatcher = {
      async deliver() {
        throw new Error('transport refused');
      },
    };
    const options = {
      dispatcher,
      clock: { now: () => now },
      limit: 10,
      leaseTimeoutMs: 30_000,
    };

    await expect(
      drainOutbox({ ...options, repository: first.stub }),
    ).resolves.toMatchObject({ retryScheduled: 1 });
    await expect(
      drainOutbox({ ...options, repository: second.stub }),
    ).resolves.toMatchObject({ failed: 1 });
  });

  it('rejects a non-positive limit or claim timeout before claiming', async () => {
    const subject = repository([]);
    const base = {
      repository: subject.stub,
      dispatcher: { deliver: async () => {} },
      clock: { now: () => now },
      limit: 10,
      leaseTimeoutMs: 30_000,
    };
    await expect(drainOutbox({ ...base, limit: 0 })).rejects.toMatchObject({
      data: { code: 'INVALID_REQUEST' },
    });
    await expect(
      drainOutbox({ ...base, leaseTimeoutMs: -1 }),
    ).rejects.toMatchObject({ data: { code: 'INVALID_REQUEST' } });
    expect(subject.claims).toEqual([]);
  });

  it('refuses a non-canonical clock reading', async () => {
    const subject = repository([]);
    await expect(
      drainOutbox({
        repository: subject.stub,
        dispatcher: { deliver: async () => {} },
        clock: { now: () => '2026-07-31 10:00:00' },
        limit: 10,
        leaseTimeoutMs: 30_000,
      }),
    ).rejects.toMatchObject({ data: { code: 'INVALID_REQUEST' } });
  });
});
