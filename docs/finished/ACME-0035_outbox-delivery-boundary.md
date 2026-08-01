# Current Task

Task ID: ACME-0035
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-01
Last updated: 2026-08-01
Charter frozen at: 2026-08-01

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0003-sqlite-revisioned-unit-of-work.md`
- `docs/adr/0012-milestone-1-execution-identity-and-replay.md`

## Task Summary

The outbox is the last open Milestone 2 work package. Committed domain events
are written into it atomically, with `status`, `attemptCount`, `availableAt`,
`claimedAt`, `deliveredAt` and `lastError` columns, and nothing ever reads
them back. Every event that ACME has ever committed is still sitting in
`pending`.

That makes the outbox a promise the system does not keep: the schema claims
delivery semantics that no code implements. This task gives events a way out,
and fixes the delivery contract in an ADR so the shape is decided rather than
improvised.

The decision that governs the size of this task is whether v1 owns a
background worker. It does not. `docs/PROJECT_BRIEF.md` excludes importing
runtime concerns, and `AGENTS.md` keeps multi-step orchestration out of the
engine. A drain is therefore an explicit, bounded operation a composition root
invokes, not a timer this repository starts.

A task is never considered done until `docs/JOURNAL.md`, `docs/SYSTEMDOC.md`
and `docs/CURRENT_STATUS.md` are current.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Committed domain events can be claimed, delivered and marked delivered or
failed through an explicit bounded drain, with at-least-once semantics that
survive a crash mid-delivery.

### Primary Deliverable

An outbox delivery boundary: repository claim/settle methods on both adapters,
a domain-neutral `drainOutbox` coordinator over an injected `OutboxDispatcher`
port in `@acme/core`, and an `acme outbox` command in the composition root.

### In Scope

- ADR-0018 fixing the delivery contract: no background worker in v1, claim
  visibility timeout, at-least-once delivery, retry and dead-letter states,
  and deterministic claim ordering.
- `ExecutionRepository` additions to claim due entries and to settle them as
  delivered, retryable or failed, implemented by `@acme/adapter-memory` and
  `@acme/adapter-sqlite`.
- A pure `drainOutbox` coordinator in `@acme/core` that claims at most a given
  number of entries, delivers each through the injected dispatcher, settles
  every outcome and returns a versioned report. No timers, no unbounded loops,
  no wall-clock beyond the injected `Clock`.
- An `OutboxDispatcher` port in core with no transport, network or provider
  vocabulary.
- `acme outbox inspect` and `acme outbox drain` in `@acme/cli`, with versioned
  JSON on stdout, payload redaction by default and exit codes consistent with
  the existing commands.
- Repository conformance cases covering claim ordering, the limit, claim
  expiry, settlement transitions and settle idempotency.
- Documentation updates, including the Milestone 2 status.

### Out of Scope

- Background workers, timers, daemons or any process that drains on its own.
- Concrete transports: HTTP, queues, brokers, webhooks, files.
- Exactly-once delivery, cross-entity ordering guarantees and consumer
  deduplication stores.
- A dead-letter management UI or a redrive command.
- Changing what the engine writes into the outbox at commit time.
- Live provider calls.

### Definition of Done

- A committed execution's events can be claimed, delivered and marked
  delivered, and a second drain then finds nothing to do, proven on both
  repository adapters.
- A claim is exclusive until it expires: a second drain inside the visibility
  window claims nothing, and after expiry the same entry is claimable again
  with an incremented attempt count.
- A dispatcher failure settles the entry as retryable with a later
  `availableAt`, or as `failed` when the caller's policy gives up; neither
  outcome loses the recorded error.
- A crash between delivery and settlement re-delivers after expiry rather than
  dropping the event, and this at-least-once consequence is documented.
- Settling the same entry twice is idempotent; settling an unclaimed or
  unknown entry is a classified error.
- `drainOutbox` never delivers more than the requested limit and never loops
  beyond one claim batch.
- `acme outbox inspect` and `acme outbox drain` work on both adapters, redact
  payloads by default and emit versioned JSON.
- ADR-0018 is accepted, `packages/core` stays domain-neutral, and all minimum
  verification gates pass.

### Minimum Verification Gates

- [x] `pnpm docs:check`
- [x] `pnpm format:check`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm boundaries`
- [x] `pnpm build`
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance`
- [x] `pnpm test:integration`
- [x] `pnpm test:scenario`
- [x] `git diff --check`
- [x] No live provider call; `pnpm test:live` is not a gate here.

## References

- `docs/design/acme-design-and-development-spec.md`, Milestone 2 work packages
- `packages/core/src/repository.ts` — `OutboxRecord`, `DomainEventRecord`
- `packages/adapter-sqlite/src/migrations.ts` — `outbox` table and
  `outbox_pending` index
- `apps/cli/src/args.ts`, `apps/cli/src/run.ts`

## Checklist

- [x] Write ADR-0018 and accept it before implementation.
- [x] Add the claim and settle methods to the core repository port.
- [x] Add the `OutboxDispatcher` port and `drainOutbox` coordinator to core.
- [x] Implement claim and settle in `@acme/adapter-memory`.
- [x] Implement claim and settle in `@acme/adapter-sqlite`.
- [x] Extend the repository conformance suite; both adapters pass unchanged.
- [x] Unit-test `drainOutbox`, including the limit, dispatcher failure and
      settle-after-crash behavior.
- [x] Add an integration proof that a committed execution's events drain to
      empty on both adapters.
- [x] Add `acme outbox inspect` and `acme outbox drain` with CLI tests.
- [x] Update `docs/SYSTEMDOC.md`, `docs/CURRENT_STATUS.md` and
      `docs/FILESTRUCTURE.md`.
- [x] Run every minimum verification gate and record the results.
- [x] Add a signed `docs/JOURNAL.md` entry and archive this task.

## Decisions and Notes

- A checkpoint after each step or substep is required. The checklist is kept
  current during the work, and `docs/CURRENT_STATUS.md` is updated whenever a
  change affects behavior.
- Decided at freeze: v1 has no background worker. The drain is a function a
  composition root calls. A timer inside a library makes tests non-deterministic
  and hides delivery failures behind a process that nobody watches.
- Decided at freeze: delivery is at-least-once. Exactly-once across a process
  boundary is not achievable without consumer-side deduplication, and claiming
  otherwise would be a lie in the schema.
- The CLI dispatcher hands events to the operator through the drain report
  rather than inventing a transport. That is the honest v1 consumer; a real
  transport is a composition-root change, not an engine change.
- The core vocabulary guard forbids `claim`, which the Research domain owns.
  The API therefore says `leaseOutbox` / `OutboxLease` / `leaseExpiresAt`,
  while the persisted status value stays `claimed` from the original schema.
  Renaming stored data to satisfy a naming rule would be the worse trade;
  ADR-0018 records the seam.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- none

## Verification

- [x] Every minimum verification gate above passed on 2026-08-01:
      `docs:check` 80 Markdown files after archival; `format:check`, `lint`, `typecheck`, `boundaries` and
      `build` clean; `test:unit` 384 tests / 45 files; `test:conformance`
      58 / 7; `test:integration` 29 / 4; `test:scenario` 19 / 3;
      `git diff --check` clean.
- [x] No test reaches the network; `tests/live` was not run.
- [x] Skipped checks: `pnpm test:live` only, by charter.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] `docs/adr/0018-outbox-delivery-boundary.md` (new)

## Handoff and Follow-ups

- Current state: complete. Milestone 2 is finished; every work package and
  acceptance condition is implemented and proven.
- Next recommended step: Milestone 3 content already exists, so the open
  choices are the Domain Test UI decision gates, a redrive decision for failed
  outbox entries, real transports as composition roots, or the backlog's
  driver-error classification. None is activated.
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: none. Neither reference module emits domain events yet, so
  outbox traffic remains hypothetical; that is a stated limit, not an open
  question in this charter.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
