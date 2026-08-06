import type { Clock, DiagnosticFact, IsoTimestamp } from './common.js';
import { AcmeError, type AcmeErrorData } from './errors.js';
import type {
  LeasedOutboxEntry,
  DomainEventRecord,
  ExecutionRepository,
} from './repository.js';

/** Versioned drain report identity. */
export const ACME_OUTBOX_DRAIN_REPORT = 'acme-outbox-drain-report/1';

/** Versioned redrive report identity. */
export const ACME_OUTBOX_REDRIVE_REPORT = 'acme-outbox-redrive-report/1';

/**
 * Delivers one committed domain event. A rejected promise is a delivery
 * failure. Transports live in composition roots, never in core (ADR-0018).
 */
export interface OutboxDispatcher {
  deliver(event: DomainEventRecord): Promise<void>;
}

/**
 * Decides what happens after a failed delivery. Returning a delay retries the
 * entry that many milliseconds later; returning `null` gives up and marks the
 * entry `failed`. The repository owns no retry policy.
 */
export type OutboxRetryPolicy = (attemptCount: number) => number | null;

export interface OutboxDrainOptions {
  readonly repository: ExecutionRepository;
  readonly dispatcher: OutboxDispatcher;
  readonly clock: Clock;
  /** Maximum entries leased by this call. */
  readonly limit: number;
  /** How long a lease stays exclusive before the entry is available again. */
  readonly leaseTimeoutMs: number;
  /** Defaults to a single retry after the lease timeout, then `failed`. */
  readonly retry?: OutboxRetryPolicy;
}

export type OutboxDeliveryOutcome = 'delivered' | 'retry-scheduled' | 'failed';

export interface OutboxDrainEntryReport {
  readonly eventId: string;
  readonly attemptCount: number;
  readonly outcome: OutboxDeliveryOutcome;
  readonly retryAt?: IsoTimestamp;
  readonly error?: AcmeErrorData;
}

export interface OutboxDrainReport {
  readonly report: typeof ACME_OUTBOX_DRAIN_REPORT;
  readonly leasedAt: IsoTimestamp;
  readonly leased: number;
  readonly delivered: number;
  readonly retryScheduled: number;
  readonly failed: number;
  readonly entries: readonly OutboxDrainEntryReport[];
  readonly diagnostics: readonly DiagnosticFact[];
}

export interface OutboxRedriveOptions {
  readonly repository: ExecutionRepository;
  readonly clock: Clock;
  /**
   * Specific event ids to redrive. When omitted, every `failed` entry up to
   * `limit` is selected in list order.
   */
  readonly eventIds?: readonly string[];
  /** Maximum entries to redrive in this call. */
  readonly limit: number;
}

export interface OutboxRedriveEntryReport {
  readonly eventId: string;
  readonly outcome: 'redriven';
  readonly availableAt: IsoTimestamp;
  readonly attemptCount: number;
}

export interface OutboxRedriveReport {
  readonly report: typeof ACME_OUTBOX_REDRIVE_REPORT;
  readonly redrivenAt: IsoTimestamp;
  readonly redriven: number;
  readonly entries: readonly OutboxRedriveEntryReport[];
}

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

function invalid(message: string, details?: Record<string, unknown>): never {
  throw new AcmeError({
    code: 'INVALID_REQUEST',
    message,
    stage: 'accepted',
    retryable: false,
    ...(details === undefined ? {} : { details: details as never }),
  });
}

function requireTimestamp(value: string): IsoTimestamp {
  if (
    !TIMESTAMP.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    invalid('Clock returned a non-canonical UTC timestamp.');
  }
  return value;
}

function shift(from: IsoTimestamp, milliseconds: number): IsoTimestamp {
  return new Date(Date.parse(from) + milliseconds).toISOString();
}

function failureData(error: unknown): AcmeErrorData {
  if (error instanceof AcmeError) {
    return error.data;
  }
  return Object.freeze({
    code: 'INTERNAL',
    message:
      error instanceof Error
        ? `Outbox delivery failed: ${error.message}`
        : 'Outbox delivery failed with a non-Error value.',
    stage: 'committed',
    retryable: true,
  });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

/**
 * Leases one bounded batch of due outbox entries, delivers each through the
 * dispatcher and settles every outcome (ADR-0018).
 *
 * Exactly one leased batch per call: no internal loop and no recursion. A
 * caller that wants the outbox emptied calls again and sees each batch.
 * Delivery is at-least-once — a crash between `deliver` and its settlement
 * re-delivers once the lease expires.
 */
export async function drainOutbox(
  options: OutboxDrainOptions,
): Promise<OutboxDrainReport> {
  if (!Number.isSafeInteger(options.limit) || options.limit <= 0) {
    invalid('Outbox drain limit must be a positive integer.', {
      limit: options.limit,
    });
  }
  if (
    !Number.isSafeInteger(options.leaseTimeoutMs) ||
    options.leaseTimeoutMs <= 0
  ) {
    invalid('Outbox lease timeout must be a positive integer.', {
      leaseTimeoutMs: options.leaseTimeoutMs,
    });
  }

  const now = requireTimestamp(options.clock.now());
  const leaseExpiresAt = shift(now, options.leaseTimeoutMs);
  const retry: OutboxRetryPolicy =
    options.retry ??
    ((attempt) => (attempt <= 1 ? options.leaseTimeoutMs : null));

  const leased = await options.repository.leaseOutbox({
    now,
    limit: options.limit,
    leaseExpiresAt,
  });

  const entries: OutboxDrainEntryReport[] = [];
  for (const entry of leased) {
    entries.push(await settle(options, entry, now, retry));
  }

  return deepFreeze({
    report: ACME_OUTBOX_DRAIN_REPORT,
    leasedAt: now,
    leased: leased.length,
    delivered: entries.filter((entry) => entry.outcome === 'delivered').length,
    retryScheduled: entries.filter(
      (entry) => entry.outcome === 'retry-scheduled',
    ).length,
    failed: entries.filter((entry) => entry.outcome === 'failed').length,
    entries,
    diagnostics: [],
  });
}

/**
 * Move terminal `failed` outbox entries back to `pending` so a later drain
 * may lease them (ACME-0059). One bounded batch; never redrives `delivered`.
 */
export async function redriveOutbox(
  options: OutboxRedriveOptions,
): Promise<OutboxRedriveReport> {
  if (!Number.isSafeInteger(options.limit) || options.limit <= 0) {
    invalid('Outbox redrive limit must be a positive integer.', {
      limit: options.limit,
    });
  }
  const now = requireTimestamp(options.clock.now());

  const entries: OutboxRedriveEntryReport[] = [];

  if (options.eventIds !== undefined && options.eventIds.length > 0) {
    if (options.eventIds.length > options.limit) {
      invalid('eventIds length exceeds redrive limit.', {
        count: options.eventIds.length,
        limit: options.limit,
      });
    }
    for (const eventId of options.eventIds) {
      if (typeof eventId !== 'string' || eventId.trim().length === 0) {
        invalid('eventIds must be non-empty strings.');
      }
      await options.repository.redriveOutbox({
        eventId,
        availableAt: now,
      });
      entries.push({
        eventId,
        outcome: 'redriven',
        availableAt: now,
        attemptCount: 0,
      });
    }
  } else {
    const failed = await options.repository.listOutbox({
      status: 'failed',
      limit: options.limit,
    });
    for (const entry of failed) {
      await options.repository.redriveOutbox({
        eventId: entry.record.eventId,
        availableAt: now,
      });
      entries.push({
        eventId: entry.record.eventId,
        outcome: 'redriven',
        availableAt: now,
        attemptCount: entry.record.attemptCount,
      });
    }
  }

  return deepFreeze({
    report: ACME_OUTBOX_REDRIVE_REPORT,
    redrivenAt: now,
    redriven: entries.length,
    entries,
  });
}

async function settle(
  options: OutboxDrainOptions,
  entry: LeasedOutboxEntry,
  now: IsoTimestamp,
  retry: OutboxRetryPolicy,
): Promise<OutboxDrainEntryReport> {
  const { eventId, attemptCount } = entry.record;
  try {
    await options.dispatcher.deliver(entry.event);
  } catch (error) {
    const data = failureData(error);
    const delay = retry(attemptCount);
    const retryAt = delay === null ? undefined : shift(now, delay);
    await options.repository.markOutboxFailed({
      eventId,
      error: data,
      failedAt: now,
      ...(retryAt === undefined ? {} : { retryAt }),
    });
    return {
      eventId,
      attemptCount,
      outcome: retryAt === undefined ? 'failed' : 'retry-scheduled',
      ...(retryAt === undefined ? {} : { retryAt }),
      error: data,
    };
  }
  await options.repository.markOutboxDelivered({ eventId, deliveredAt: now });
  return { eventId, attemptCount, outcome: 'delivered' };
}
