# Current Task

Task ID: ACME-0057
Parent Task: None
Status: Complete
Owner: Grok
Created: 2026-08-06
Last updated: 2026-08-06
Charter frozen at: 2026-08-06
Archived: 2026-08-06

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/design/gap-resolution-plan.md` (WP-D / D1)
- `docs/backlog/driver-error-classification.md`
- ADR-0003, ADR-0013

## Task Summary

Activate gap-resolution slice **D1**: classify recognized SQLite / better-sqlite3
driver failures inside `@acme/adapter-sqlite` before they leave the adapter, so
transient contention (`SQLITE_BUSY` / locked) is `PERSISTENCE_TRANSIENT`
(retryable) and is not collapsed to non-retryable `INTERNAL` by the execution
engine. Public contracts stay free of driver vocabulary; mapping is adapter-owned.

## Task Charter

### Goal

A `better-sqlite3` failure that leaves the SQLite repository is an `AcmeError`
with a correct generic persistence class and retryability—never a raw driver
error and never an unclassifiable leak of busy/locked as `INTERNAL`.

### Primary Deliverable

Adapter-owned driver error mapping in `@acme/adapter-sqlite`, with unit proof
of real `SQLITE_BUSY` classification and no raw driver escape on repository
paths used by the engine.

### In Scope

- Map recognized busy/locked codes → `PERSISTENCE_TRANSIENT`, `retryable: true`.
- Map recognized corruption / constraint codes → `PERSISTENCE_CORRUPTION`,
  non-retryable (as decided in backlog).
- Unknown driver/runtime errors → safe non-retryable fallback (`INTERNAL` or
  equivalent), still as `AcmeError` (no raw throw).
- Wrap SQLite repository DB access so classification cannot be bypassed.
- Unit test: real `SQLITE_BUSY` with `busy_timeout = 0`.
- Update durability / docs that asserted “always INTERNAL for driver faults”.
- Close or archive `docs/backlog/driver-error-classification.md`; update
  CURRENT_STATUS G05 / gap plan closed note for D1.

### Out of Scope

- Caller-side automatic retry loops (nothing consumes `retryable` yet beyond
  correct classification).
- In-memory adapter inventing fake driver codes.
- Stranded execution operator commands (D2 / G06).
- Outbox, live scenarios, other gap packages.
- Changing commit / CAS semantics or ADR-0003 transaction shape.
- Live provider calls (offline package).

### Definition of Done

- Recognized busy/locked failures from the SQLite adapter are
  `PERSISTENCE_TRANSIENT` with `retryable: true`.
- No raw `better-sqlite3` / SqliteError escapes repository methods under test.
- Public core types remain free of SQLite driver vocabulary.
- Durability rollback still proven; expectations match new classification where
  the injected fault is classified.
- Docs and backlog reflect D1 closed; G05 residual removed or reworded.
- Typecheck, unit, conformance, integration gates relevant to the change pass.

### Minimum Verification Gates

- [x] `pnpm typecheck`
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance`
- [x] `pnpm test:integration` (includes durability-sqlite)
- [x] `pnpm docs:check`
- [x] `git diff --check`

## References

- `docs/backlog/driver-error-classification.md`
- `docs/design/gap-resolution-plan.md` WP-D D1
- `packages/adapter-sqlite/src/repository.ts`
- `packages/core/src/errors.ts`
- `packages/core/src/execution-engine.ts` (`errorData`)
- `tests/integration/durability-sqlite.test.ts`
- `tests/fixtures/faulting-database.ts`

## Checklist

- [x] Freeze ACME-0057 charter (D1 only).
- [x] Implement `mapSqliteDriverError` (or equivalent) in adapter-sqlite.
- [x] Wrap repository driver access to always classify.
- [x] Unit: real SQLITE_BUSY classification.
- [x] Adjust durability fault fixture/expectations if classification applies.
- [x] Docs: backlog, CURRENT_STATUS G05, SYSTEMDOC, JOURNAL, gap plan D1 closed.
- [x] Run verification gates.
- [x] Archive ACME-0057; restore template.

## Decisions and Notes

- Generic public codes only; adapter owns SQLite code → ACME mapping.
- Prefer wrapping low-level `#immediate` / statement helpers so all paths are
  covered without per-method try/catch sprawl.
- Checkpoint after each step; keep checklist truthful.
- Delivered: `packages/adapter-sqlite/src/driver-errors.ts`; seams wrapped;
  unit + durability path proven; backlog marked resolved.

## Charter Amendment Log

-none

## Verification

- [x] typecheck, unit (565), conformance (61), integration (55), docs:check,
      diff --check

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md` (G05)
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/design/gap-resolution-plan.md` (D1 closed note)
- [x] `docs/backlog/driver-error-classification.md` (resolved)
- [x] `docs/FILESTRUCTURE.md` if needed

## Handoff and Follow-ups

- Current state: ACME-0057 complete on `chore/gapfixes`.
- Next recommended step: D2 stranded execution ops (G06).
- Blockers: none
- Child tasks: none
- Open questions: none

## Finalize When Complete

- Archive under `docs/finished/ACME-0057_driver-error-classification.md`.
- Restore template or next approved task.
- Signed JOURNAL entry.
