# ADR 0018 — Outbox delivery boundary

Status: Accepted

Date: 2026-08-01

Decision owners: ACME maintainers

## Context

Committed domain events are written into an outbox inside the same
transaction as the state they describe. The record already carries
`status`, `attemptCount`, `availableAt`, `claimedAt`, `deliveredAt` and
`lastError`, and the SQLite schema indexes `(status, available_at)` for a
pending scan that nothing performs.

Nothing reads the outbox back. Every event ACME has committed is still
`pending`. The schema therefore promises delivery semantics that no code
implements, which is worse than having no outbox: an operator reading the
table would reasonably conclude that delivery is pending rather than absent.

Constraints already fixed by architecture:

- `docs/PROJECT_BRIEF.md` excludes importing existing runtime concerns and
  building a workflow runtime in v1.
- `AGENTS.md` keeps multi-step orchestration out of the ExecutionEngine.
- `packages/core` must stay domain-neutral and free of transports.
- ADR-0003 fixes the revisioned Unit of Work that writes the entries.
- The core vocabulary guard forbids `claim` in `packages/core`, because the
  Research reference domain owns that word.

## Decision

### 1. No background worker in v1

Draining is an explicit, bounded operation that a composition root invokes.
This repository starts no timer, no interval, no daemon and no queue consumer.

A library that drains on its own is a library whose tests are timing-dependent
and whose failures are discovered by nobody, because the loop that swallowed
them is not attached to any caller. Making the drain a function keeps delivery
observable: someone asked for it, and someone receives the report.

This is not a claim that production never wants a worker. It is a claim that
the worker belongs to whatever process operates ACME, above this boundary, and
that its scheduling policy is that process's decision.

### 2. Lease, deliver, settle

Delivery is three steps with persistence between them:

```text
leaseOutbox(now, limit, leaseExpiresAt)
  → deliver each event through OutboxDispatcher
  → markOutboxDelivered | markOutboxFailed
```

`leaseOutbox` atomically selects entries that are due — `pending`, or leased
past their expiry — with `availableAt <= now`, marks them `claimed`, sets
`claimedAt = now`, sets `availableAt = leaseExpiresAt` and increments
`attemptCount`. Ordering is deterministic: event `occurredAt`, then `eventId`.

The API says **lease** rather than the more common queue word, because `claim`
is Research-domain vocabulary in ACME and the core vocabulary guard forbids it
in `packages/core`. The persisted status value stays `claimed`, unchanged from
the original schema, so this decision needs no migration. That split is
deliberate: renaming stored data to satisfy a naming rule would be a worse
trade than one documented seam.

The attempt count increments when the lease is taken rather than at failure,
because a holder that dies mid-delivery leaves no other trace. A count that
only rose on observed failures would under-report exactly the case operators
most need to see.

### 3. The lease is a visibility timeout, not a lock

A lease expires. After `leaseExpiresAt` passes, the entry may be leased again
even though its status is still `claimed`.

The alternative — a lock released only by the holder — strands every entry
whose holder crashed, and needs an administrative unlock path that is itself
an outbox for the outbox. A timeout needs no such path.

### 4. Delivery is at-least-once

A crash between a successful `deliver` and its `markOutboxDelivered`
re-delivers the event after the lease expires.

Exactly-once across a process boundary is not achievable without consumer-side
deduplication, and the honest place for that is the consumer, keyed by
`eventId`, which is stable and unique. ACME states this consequence rather
than implying a guarantee it cannot keep.

### 5. Failure is settled by the caller's policy

`markOutboxFailed` records `lastError` and takes the next step from the
caller:

| Caller supplies | Resulting status | Meaning |
| --- | --- | --- |
| `retryAt` | `pending`, `availableAt = retryAt` | try again later |
| no `retryAt` | `failed` | give up; needs a human |

The repository owns no retry policy. Backoff, attempt ceilings and giving up
are decisions of whoever operates the drain, and `drainOutbox` takes them as
an injected function of the attempt count.

`failed` is terminal for the drain. Redriving a `failed` entry is deliberately
not implemented here; it needs its own decision about who may replay a domain
event and under what evidence.

### 6. `drainOutbox` lives in core and owns no transport

```ts
interface OutboxDispatcher {
  deliver(event: DomainEventRecord): Promise<void>;
}
```

A rejected promise is a delivery failure. Core coordinates leasing, delivery and
settlement, and returns a versioned `acme-outbox-drain-report/1`. It performs
exactly one leased batch per call: no internal loop, no recursion, no
"drain until empty". A caller that wants the queue emptied calls again and
sees each batch.

Transports live in composition roots. The CLI's dispatcher hands events to the
operator through the drain report rather than inventing a network client,
which is the honest v1 consumer: the events leave `pending`, the operator sees
exactly what left, and a real transport is a composition change rather than an
engine change.

## Alternatives Considered

### A background dispatcher inside the adapter or engine

- Benefits: events leave without anyone asking.
- Costs: non-deterministic tests, hidden failures, a lifecycle (start, stop,
  drain-on-shutdown) that every embedding process must now manage, and a timer
  in a library that also claims to be pure.
- Reason not selected: the scheduling decision belongs to the operating
  process, and v1 explicitly excludes runtime concerns.

### Delivery inside the commit transaction

- Benefits: no outbox at all; no second step to forget.
- Costs: an external call inside a database transaction, holding the single
  SQLite writer for the duration of a network round trip, with the commit's
  fate tied to a remote system.
- Reason not selected: this is precisely what the outbox pattern exists to
  avoid.

### A lock released only by its holder

- Benefits: no duplicate delivery from expiry races.
- Costs: a crashed holder strands its entries permanently.
- Reason not selected: a stuck queue is worse than a duplicate an idempotent
  consumer discards.

### Repository-owned retry policy

- Benefits: one place to configure backoff.
- Costs: persistence starts making operational decisions, and every adapter
  must implement the same policy identically to stay conformant.
- Reason not selected: adapters must not invent policy, exactly as with
  retention in ADR-0016.

## Consequences

### Positive

- The outbox stops being a promise nothing keeps.
- Delivery is observable: every drain returns what it leased, delivered,
  retried and failed.
- A crashed drain recovers by itself when the lease expires.
- Adapters stay policy-free; core stays transport-free.

### Negative

- Nothing delivers unless something calls the drain, so an operator who
  forgets sees a silently growing table. The `inspect` command exists for
  that, but no alarm does.
- At-least-once pushes deduplication onto consumers.
- `attemptCount` counts leases, so an entry can show attempts without any
  recorded error, which reads oddly until the visibility timeout is
  understood.
- `failed` entries accumulate with no redrive path.

### Follow-ups

- A redrive decision for `failed` entries.
- Real transports as composition roots, with their own delivery evidence.
- Whether a drain belongs in `ScenarioRunner` steps.
- Metrics or alerting on outbox depth, which no part of ACME emits today.

## Compatibility and Migration

No schema change and no migration. The columns and the `outbox_pending` index
already exist and are written; this decision only starts reading them.
Historical `pending` entries become claimable by the first drain, which is the
intended behavior — they were always meant to be delivered.

## References

- [ADR-0003 SQLite revisioned Unit of Work](0003-sqlite-revisioned-unit-of-work.md)
- [ADR-0012 Milestone 1 execution identity and replay](0012-milestone-1-execution-identity-and-replay.md)
- [ADR-0016 encrypted payload retention](0016-encrypted-payload-retention.md)
- [ACME-0035 charter](../finished/ACME-0035_outbox-delivery-boundary.md)
