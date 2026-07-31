# Current Task

Task ID: ACME-0021
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-07-31
Last updated: 2026-07-31
Charter frozen at: 2026-07-31

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
- `docs/adr/0006-aggregate-in-memory-unit-of-work.md`
- `docs/adr/0012-milestone-1-execution-identity-and-replay.md`
- `docs/design/acme-design-and-development-spec.md` sections 15.1–15.3
- `packages/core/src/repository.ts`
- `packages/adapter-memory/src/repository.ts`
- `packages/testing/src/repository-conformance.ts`

## Task Summary

ACME has a bounded single-task ExecutionEngine, a deterministic in-memory
`ExecutionRepository` and a non-empty repository conformance suite, but no
durable persistence. The First Proof Milestone in `docs/PROJECT_BRIEF.md`
requires SQLite stores, and the durability requirement demands that a crash
after a successful model call but before state commit be recoverable without
calling the provider again. This task implements the first durable adapter
decided in ADR-0003 and proves it against the same conformance suite the
in-memory adapter already passes.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Provide a durable `@acme/adapter-sqlite` implementation of the aggregate
`ExecutionRepository` that passes the existing shared conformance suite and
survives process restart without duplicate model calls or duplicate state
operations.

### Primary Deliverable

A `packages/adapter-sqlite` package containing ordered checksum-verified
migrations, the WAL-mode schema from ADR-0003 and specification section 15.2,
and a `BEGIN IMMEDIATE` Unit of Work that implements every
`ExecutionRepository` method with the same observable semantics as
`@acme/adapter-memory`.

### In Scope

- A new `packages/adapter-sqlite` workspace package depending only on
  `@acme/core` and its SQLite driver.
- The first ordered migration creating executions, attempts, model calls,
  documents, memory candidates, memory records, state heads, state snapshots,
  state transitions, domain events, outbox, evaluator runs and
  `schema_migrations`, plus the indexes required by specification 15.2.
- Checksum-verified forward migration application that refuses to start on a
  checksum mismatch.
- `accept`, `get`, `appendAttempt`, `reserveModelCall`, `completeModelCall`,
  `failModelCall`, `loadContext`, `commit`, `markTerminal` and
  `loadReplayEvidence` with request idempotency, divergent-reuse rejection as
  `PERSISTENCE_CORRUPTION`, stale-revision rejection as
  `CONFLICT_STATE_REVISION`, digest recomputation, sequential memory
  compare-and-swap and the atomic replay-evidence sidecar.
- Execution of the unchanged `executionRepositoryConformance()` suite against
  the SQLite adapter in `tests/conformance`.
- A durable integration test that runs the existing bounded ExecutionEngine
  against SQLite, reopens the database in a new connection and verifies
  identical replay evidence, an unchanged operation digest and no new model
  call.
- Boundary-rule extension in `dependency-cruiser.config.mjs` and
  `tooling/boundaries/` so the SQLite driver stays behind the adapter and core
  cannot import it.
- Documentation updates to `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`,
  `docs/FILESTRUCTURE.md` and `docs/JOURNAL.md`.
- An ADR only if the driver choice or a schema detail deviates from ADR-0003
  or specification section 15.2.

### Out of Scope

- Changing `ExecutionRepository`, any core contract, the operation digest or
  the conformance suite to accommodate SQLite.
- Milestone 2 fault injection at every transaction boundary.
- ResearchModule, ScenarioRunner, a live provider adapter and the Domain
  Test UI.
- Outbox delivery, background workers, encryption at rest and privacy
  deletion.
- A production database choice, deployment, package publication or release.
- Wiring an `--adapter sqlite` CLI flag into `@acme/cli`.

### Definition of Done

- `@acme/adapter-sqlite` passes the unchanged shared
  `executionRepositoryConformance()` suite.
- A durable reopen test proves crash recovery: an execution committed in one
  connection is readable, replayable and non-duplicating in a fresh connection.
- Migrations apply in order, are checksum-verified and reject a tampered
  checksum.
- Boundary checks prove the SQLite driver is not reachable from `packages/core`
  or from any module.
- Current-facing documentation states durable persistence exists and names the
  remaining gaps truthfully.
- All frozen verification gates pass, or every skipped check is recorded with
  its reason.
- The task is archived under `docs/finished/` and `docs/CURRENT_TASK.md` is
  restored or repopulated.

### Minimum Verification Gates

- [x] `pnpm docs:check`
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm boundaries`
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance`
- [x] `pnpm test:integration`
- [x] `pnpm test:scenario`
- [x] `pnpm build`
- [x] `git diff --check`

## References

- `docs/adr/0003-sqlite-revisioned-unit-of-work.md`
- `docs/adr/0012-milestone-1-execution-identity-and-replay.md`
- `docs/design/acme-design-and-development-spec.md`
- `packages/core/src/repository.ts`
- `packages/core/src/repository-digest.ts`
- `packages/adapter-memory/src/repository.ts`
- `packages/testing/src/repository-conformance.ts`
- `tests/conformance/adapter-memory.test.ts`
- `tests/integration/execution-engine.test.ts`

## Checklist

- [x] Read the required repository documents in order.
- [x] Resolve the SQLite driver decision and record it, adding an ADR if it
      deviates from the approved specification.
- [x] Freeze this charter by moving the status from `Draft` to `Ready`.
- [x] Scaffold `packages/adapter-sqlite` with workspace, build and lint wiring.
- [x] Implement the first ordered checksum-verified migration and schema.
- [x] Implement the ledger surface: `accept`, `get`, `appendAttempt`,
      `reserveModelCall`, `completeModelCall`, `failModelCall`.
- [x] Implement `loadContext` with deterministic ordering and revision checks.
- [x] Implement the `BEGIN IMMEDIATE` Unit of Work for `commit`, including
      digest verification, compare-and-swap and the replay-evidence sidecar.
- [x] Implement `markTerminal` and `loadReplayEvidence` with detached frozen
      results.
- [x] Run the unchanged conformance suite against the adapter.
- [x] Add the durable reopen and no-duplicate-model-call integration test.
- [x] Extend dependency and boundary rules for the new adapter.
- [x] Run every frozen verification gate and record evidence.
- [x] Update `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `FILESTRUCTURE.md` and add
      the signed journal entry.
- [x] Archive ACME-0021 and restore or repopulate `docs/CURRENT_TASK.md`.

## Decisions and Notes

- A checkpoint after each step or substep is required. The checklist is
  updated along the work and `CURRENT_STATUS.md` is updated when changes
  affect behavior.
- ADR-0003 already fixes WAL mode, the revisioned Unit of Work, the
  `state_heads` compare-and-swap row, ordered checksum-verified migrations and
  `BEGIN IMMEDIATE`. This task implements that decision; it does not reopen it.
- The in-memory adapter is the reference for observable semantics. Where the
  two adapters could differ, the conformance suite is authoritative and must
  not be weakened.
- Driver decision, 2026-07-31: the adapter uses `better-sqlite3`, as named in
  the approved specification. The built-in `node:sqlite` was evaluated and
  rejected for this task because it is still marked experimental and emits an
  `ExperimentalWarning`, and because adopting it would deviate from the
  approved specification. The known cost is a native dependency whose prebuilds
  must be verified on Windows and in CI, which ADR-0003 already records as a
  consequence.
- Schema discovery, 2026-07-31: implementation showed that specification
  section 15.2 is lossy for `ExecutionRequest`, `ModelCallRecord`,
  `MemoryCandidate` and prepared-commit/replay evidence, and that its
  `model_calls` shape assumes a provider/model pair a provider-neutral
  reservation does not have. Under the frozen charter this triggered the
  in-scope ADR clause rather than a scope change, so ADR-0013 records both the
  driver and the exact schema extensions. The Definition of Done is unchanged.
- Defect found during verification, 2026-07-31: `openDatabase()` left an open
  file handle when migration verification rejected a database. It was fixed in
  the same change; Windows file locking surfaced it during test cleanup.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- None.

## Verification

- [x] Prove the conformance suite runs unchanged for both adapters.
- [x] Record exact test counts for every gate.
- [x] Prove migration checksum rejection with an explicit negative test.
- [x] Prove the reopened database performs no new model call and allocates no
      new IDs.
- [x] Document skipped checks and reasons.

Verification completed on 2026-07-31:

- `pnpm docs:check` passed for 55 Markdown files.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm build` passed.
- `pnpm boundaries` passed dependency, core-vocabulary and the
  core/module/SQLite-driver forbidden fixtures.
- `pnpm test:unit` passed 175 tests in 26 files.
- `pnpm test:conformance` passed 35 tests in 5 files, including the six
  unchanged `executionRepositoryConformance()` cases run against SQLite.
- `pnpm test:integration` passed 13 tests in 2 files, including the three
  durable SQLite cases.
- `pnpm test:scenario` passed the one Narrative Phase 5 scenario.
- `git diff --check` passed.
- Skipped checks: none. One check could not be observed rather than skipped —
  `better-sqlite3` prebuild resolution was exercised on Windows only, because
  the Linux CI job cannot run locally. It is recorded as a persistent caveat in
  `docs/CURRENT_STATUS.md`.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/adr/0013-durable-sqlite-schema-and-driver.md` records the driver
      and the schema extensions beyond specification section 15.2.

## Handoff and Follow-ups

- Current state: ACME-0021 is complete. `@acme/adapter-sqlite` is implemented,
  passes the unchanged shared conformance suite and proves durable recovery
  across a process restart. Every frozen gate passed.
- Next recommended step: Activate only the next explicitly approved task.
  ResearchModule, ScenarioRunner and a live provider adapter are the remaining
  Milestone 1 candidates; wiring an `--adapter sqlite` composition root into
  `@acme/cli` is the smallest one.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: None.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
