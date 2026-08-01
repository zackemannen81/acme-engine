# Current Task

Task ID: ACME-0033
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
- `docs/adr/0012-milestone-1-execution-identity-and-replay.md`
- `docs/adr/0013-durable-sqlite-schema-and-driver.md`
- `docs/adr/0014-live-provider-boundary-and-transport-port.md`
- `docs/adr/0016-encrypted-payload-retention.md`

## Task Summary

Milestone 2 requires that a crash after a successful model call but before the
state commit is recoverable without calling the provider again. That
requirement is currently unmet, and the code says so explicitly: an accepted
execution that exists but is not terminal raises `PERSISTENCE_TRANSIENT` with
the message that durable resume is not implemented
(`packages/core/src/execution-engine.ts`). The repository already reserves,
completes and stores model calls, so the evidence needed to resume is written
on every execution and then never read back.

Until this exists, the process-restart story is only half true: a committed
execution replays from a reopened database, but an execution interrupted
between the provider response and the commit is unrecoverable and, on the live
path, costs a second billed call to redo. This task closes that gap and makes
the crash window explicit rather than implicit.

A task is never considered done until `docs/JOURNAL.md`, `docs/SYSTEMDOC.md`
and `docs/CURRENT_STATUS.md` are current.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

An accepted but non-terminal execution can be driven to a terminal outcome by
re-submitting the same request, reusing the recorded model call, with zero
additional gateway calls.

### Primary Deliverable

A durable resume path in `ExecutionEngine`, supported by an explicit
`ExecutionRepository` capability for reading recorded model calls of a
non-terminal execution, decided in an ADR and proven on both the in-memory and
SQLite adapters.

### In Scope

- An ADR (`ADR-0017`) fixing durable resume semantics:
  - which recorded model-call states may be reused, and which are terminal
  - the dependency on retention (`none` / `hash-only` / `encrypted-payload`)
  - attempt and stage bookkeeping for a resumed execution
  - whether the read set is re-read or restored, and what happens when the
    expected revision has moved since acceptance
  - the relationship to ADR-0014: an `ambiguous` call stays terminal and is
    never automatically retried
- An `ExecutionRepository` addition that exposes the recorded model calls of a
  non-terminal execution, implemented by `@acme/adapter-memory` and
  `@acme/adapter-sqlite`.
- The resume path in `ExecutionEngine`, replacing the
  `durable resume is not implemented` refusal: on a recoverable recorded
  success, continue from response validation without invoking the gateway.
- Explicit, classified refusals where resume is impossible: an unrecoverable
  response under `hash-only`/`none` retention, a missing decryption key, an
  `ambiguous` call, or a recorded non-ambiguous failure. Each becomes a
  terminal outcome; none silently issues a new model call.
- Extension of the reusable repository conformance suite in `@acme/testing`,
  passing unchanged for both adapters.
- Integration proof on both adapters that a crash between
  `completeModelCall` and `commit` resumes to the same operation digest with
  no new gateway call and no new model-call ID.
- Documentation updates, including the carried-over hygiene noted under
  Decisions and Notes.

### Out of Scope

- Fault injection at arbitrary transaction boundaries and the
  no-partial-state proof.
- A concurrent two-writer CAS race test.
- Outbox draining, dispatchers or background workers.
- Reconciling an `ambiguous` call against provider-side history.
- Repair, revision or any second primary model call; the Milestone 1 budget of
  one primary call per execution is unchanged.
- A live provider call. This task is verified offline.
- ScenarioRunner live steps and the Domain Test UI.

### Definition of Done

- Re-submitting the request of an execution that was interrupted after
  `completeModelCall` and before `commit` reaches `committed` with the same
  operation digest as an uninterrupted run, with zero additional gateway
  invocations, proven on `@acme/adapter-memory` and `@acme/adapter-sqlite`.
- The SQLite proof survives a real close/reopen of the database file, and the
  resumed run allocates no new model-call ID.
- No code path raises `PERSISTENCE_TRANSIENT` because durable resume is
  missing.
- With `hash-only` or `none` retention, or with the payload key unavailable,
  resume refuses with a classified non-retryable error, records a terminal
  outcome and never calls the gateway.
- A recorded `ambiguous` call remains terminal and is never retried; ADR-0014's
  rule is unchanged by this task.
- The repository conformance suite covers the new capability, is non-empty and
  passes unchanged for both adapters.
- `packages/core` remains domain-neutral; boundary and vocabulary checks pass.
- ADR-0017 is accepted; `docs/SYSTEMDOC.md`, `docs/CURRENT_STATUS.md`,
  `docs/FILESTRUCTURE.md` (if files are added) and `docs/JOURNAL.md` reflect
  reality, and the documentation hygiene items under Decisions and Notes are
  corrected.

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
- [x] No live provider call in this task; `pnpm test:live` is not a gate here.

## References

- `docs/design/acme-design-and-development-spec.md`, Milestone 2 acceptance
  ("post-call crash resumes with zero gateway calls")
- `docs/adr/0012-milestone-1-execution-identity-and-replay.md`
- `docs/adr/0013-durable-sqlite-schema-and-driver.md`
- `docs/adr/0014-live-provider-boundary-and-transport-port.md`
- `docs/adr/0016-encrypted-payload-retention.md`
- `packages/core/src/execution-engine.ts` — the `existing` acceptance branch
  that currently refuses, and the primary-call section
- `packages/core/src/repository.ts` — `AcceptResult`, `ExecutionRepository`
- `packages/core/src/repository-model-call.ts` — `ModelCallRecord` states
- `packages/testing/src/repository-conformance.ts`
- `tests/integration/execution-engine-sqlite.test.ts`

## Checklist

- [x] Draft ADR-0017 with the resume semantics listed in scope; get it
      accepted before the engine change.
- [x] Add the repository capability for reading a non-terminal execution's
      recorded model calls to the core port.
- [x] Implement it in `@acme/adapter-memory`.
- [x] Implement it in `@acme/adapter-sqlite`.
- [x] Extend the shared repository conformance suite and confirm both adapters
      pass unchanged.
- [x] Implement the resume path in `ExecutionEngine`, removing the
      not-implemented refusal.
- [x] Implement and unit-test every refusal case: unrecoverable retention,
      missing key, `ambiguous`, recorded failure.
- [x] Add the interrupted-execution integration test for the in-memory
      adapter.
- [x] Add the interrupted-execution integration test for SQLite, including
      close/reopen.
- [x] Prove operation-digest equality against an uninterrupted run and assert
      zero additional gateway invocations.
- [x] Update `docs/SYSTEMDOC.md` with the resume path and its refusals.
- [x] Update `docs/CURRENT_STATUS.md`, including the hygiene corrections.
- [x] Update `docs/FILESTRUCTURE.md` if files are added.
- [x] Run every minimum verification gate and record the results.
- [x] Add a signed `docs/JOURNAL.md` entry and archive this task.

## Decisions and Notes

- A checkpoint after each step or substep is required. The checklist is kept
  current during the work, and `docs/CURRENT_STATUS.md` is updated whenever a
  change affects behavior.
- Carried-over documentation hygiene, verified on 2026-08-01 and folded into
  this task's documentation step rather than run as a separate task:
  - `docs/CURRENT_STATUS.md` claims 345 unit tests; the suite runs 349 in 42
    files.
  - The `Recent completed work` summary stops at ACME-0030; ACME-0031 and
    ACME-0032 are missing.
  - Commit `75d63c3` (`checkpoint : m2 - verified 1/2`) has no journal entry.
- Decisions settled at freeze (2026-08-01, approved by the owner) and recorded
  in ADR-0017:
  - Resume re-reads the context rather than restoring the recorded read set. A
    moved expected revision terminates the execution as `conflicted`, because
    state moved underneath the interrupted run.
  - The resume capability is a new `ExecutionRepository` method, not an
    extension of `loadReplayEvidence`, whose return type is built around a
    completed `PreparedCommit`.
  - A resumed run appends its own attempt, so the ledger never claims a single
    uninterrupted pass.
- Classify discoveries using `docs/TASK_WORKFLOW.md`. The excluded Milestone 2
  residuals (fault injection, two-writer CAS, outbox drain) stay backlog items
  and must not be absorbed here.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- none

## Verification

- [x] Every minimum verification gate above passed on 2026-08-01:
      `docs:check` 76 Markdown files after archival; `format:check`, `lint`, `typecheck`,
      `boundaries` and `build` clean; `test:unit` 361 tests / 42 files;
      `test:conformance` 54 / 7; `test:integration` 21 / 2; `test:scenario`
      19 / 3; `git diff --check` clean.
- [x] No test reaches the network. `tests/live` remains structurally excluded
      from `vitest.config.ts` and was not run.
- [x] Skipped checks: `pnpm test:live` only, by charter. Nothing else was
      skipped.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/adr/0017-durable-execution-resume.md` (new, Accepted)

## Handoff and Follow-ups

- Current state: complete. Every Definition of Done condition and minimum
  verification gate passed on 2026-08-01.
- Next recommended step: the remaining Milestone 2 residuals — fault injection
  at transaction boundaries plus a concurrent two-writer CAS race, and outbox
  draining — are the natural next charters. Neither is activated.
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: the engine still records `ambiguous: false` on every model
  call failure, so no code in the workspace produces the `ambiguous` status the
  adapters and ADR-0014 implement. Out of this charter; worth its own decision.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
