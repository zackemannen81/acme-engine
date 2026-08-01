# Current Task

Task ID: ACME-0034
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
- `docs/adr/0013-durable-sqlite-schema-and-driver.md`
- `docs/adr/0017-durable-execution-resume.md`

## Task Summary

Milestone 2 lists five acceptance conditions. Three are proven: the shared
conformance suite passes unchanged for SQLite, close/reopen preserves the
replay digest, and ACME-0033 closed post-call crash resume. Two remain, and
both are claims about adverse conditions that no test creates:

- "transaction crash leaves no partial state" currently rests on the fact that
  a clean commit followed by a clean reopen looks right. No fault is injected
  inside a transaction, so rollback is assumed rather than observed.
- "two-writer CAS test yields one commit" has no test at all. Compare-and-swap
  is implemented and its sequential stale-revision path is covered, but two
  writers contending for the same revision are never exercised.

Both are verification gaps, not missing behavior. This task closes them by
observation, and states plainly whatever the observation reveals.

A task is never considered done until `docs/JOURNAL.md`, `docs/SYSTEMDOC.md`
and `docs/CURRENT_STATUS.md` are current.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Prove by injected fault and by contended write that an interrupted commit
leaves no partial state and that two writers against the same revision produce
exactly one commit.

### Primary Deliverable

A durability and concurrency test suite covering both repository adapters:
a shared conformance case for a fault inside `commit()`, and SQLite-specific
proofs that survive a real close and reopen of the database file.

### In Scope

- Extending the shared repository conformance options with an injectable
  `IdGenerator`, so a fault can be raised inside `commit()` on every adapter
  without a production seam.
- A shared conformance case proving that a fault inside `commit()` leaves no
  documents, memory records, state, events, outbox entries, commit record or
  terminal execution result, and that the repository stays usable afterwards.
- A SQLite-specific driver-level fault injected inside the `BEGIN IMMEDIATE`
  transaction through a proxy `Database`, proving rollback survives a real
  close and reopen of the file.
- Proof that the same commit succeeds on retry after a rolled-back fault and
  yields the recorded operation digest.
- A two-writer proof on one SQLite file: both writers read the same revision,
  exactly one commits, the loser terminates with `CONFLICT_STATE_REVISION`,
  and the store holds one snapshot and one transition.
- Documentation updates recording exactly which Milestone 2 acceptance
  conditions are now proven and by what evidence.

### Out of Scope

- Outbox draining, dispatchers and background workers.
- Production fault-injection hooks or any test-only seam in shipped code.
- Reclassifying driver-level errors (for example `SQLITE_BUSY`) into the ACME
  taxonomy; a discovery there becomes a backlog proposal.
- Multi-process or multi-threaded concurrency harnesses.
- Live provider calls.
- Performance and load measurement.

### Definition of Done

- A fault raised inside `commit()` leaves no partial effect on
  `@acme/adapter-memory` or `@acme/adapter-sqlite`, proven by the same
  conformance case running unchanged on both.
- A driver-level fault inside the SQLite transaction rolls back, and the
  absence of partial rows is confirmed after closing every connection and
  reopening the file.
- Retrying the identical commit after a rolled-back fault succeeds and records
  the same operation digest as an uninterrupted run.
- Two writers on one database file against the same expected revision produce
  exactly one commit; the loser is `conflicted` with `CONFLICT_STATE_REVISION`
  and contributes no documents, memory, state, events or outbox entries.
- `docs/CURRENT_STATUS.md` states which Milestone 2 acceptance conditions are
  proven, and by what evidence, without overstating the remainder.
- All minimum verification gates pass.

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

- `docs/design/acme-design-and-development-spec.md`, Milestone 2 acceptance
- `docs/adr/0003-sqlite-revisioned-unit-of-work.md` — `BEGIN IMMEDIATE`
- `docs/adr/0013-durable-sqlite-schema-and-driver.md`
- `packages/adapter-sqlite/src/repository.ts` — `#immediate`, `#statement`
- `packages/testing/src/repository-conformance.ts`
- `tests/integration/execution-engine-sqlite.test.ts`

## Checklist

- [x] Add an injectable `IdGenerator` to the conformance options and update
      both adapter call sites.
- [x] Add the shared no-partial-state conformance case and confirm both
      adapters pass it unchanged.
- [x] Build the proxy `Database` fault injector as a test fixture.
- [x] Prove SQLite rollback across a real close and reopen.
- [x] Prove the retried commit reaches the recorded operation digest.
- [x] Prove the two-writer outcome on one file.
- [x] Record any discovery outside this charter as a backlog proposal.
- [x] Update `docs/SYSTEMDOC.md` durability claims.
- [x] Update `docs/CURRENT_STATUS.md` Milestone 2 status.
- [x] Update `docs/FILESTRUCTURE.md` for new files.
- [x] Run every minimum verification gate and record the results.
- [x] Add a signed `docs/JOURNAL.md` entry and archive this task.

## Decisions and Notes

- A checkpoint after each step or substep is required. The checklist is kept
  current during the work, and `docs/CURRENT_STATUS.md` is updated whenever a
  change affects behavior.
- The fault seam is the injected `IdGenerator` for the shared case and a proxy
  `Database` for the SQLite case. Both are test fixtures. No shipped file gains
  a test-only hook, because a durability claim proven through a production
  backdoor proves the backdoor.
- This task adds no runtime behavior. If a proof fails, the correct outcome is
  a recorded defect and a decision, not a weakened test.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- none

## Verification

- [x] Every minimum verification gate above passed on 2026-08-01:
      `docs:check` 78 Markdown files after archival; `format:check`, `lint`, `typecheck`,
      `boundaries` and `build` clean; `test:unit` 365 tests / 43 files;
      `test:conformance` 56 / 7; `test:integration` 23 / 3; `test:scenario`
      19 / 3; `git diff --check` clean.
- [x] No test reaches the network; `tests/live` was not run.
- [x] Skipped checks: `pnpm test:live` only, by charter.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs only if a durable decision changes

## Handoff and Follow-ups

- Current state: complete. All five Milestone 2 acceptance conditions are now
  proven by test rather than assumed.
- Next recommended step: the outbox is the only remaining Milestone 2 work —
  it is written atomically and never drained. Not activated.
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: none. The driver-error classification finding is recorded as
  a backlog proposal, not an open question in this charter.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
