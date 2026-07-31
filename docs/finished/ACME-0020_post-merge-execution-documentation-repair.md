# Current Task

Task ID: ACME-0020
Parent Task: None
Status: Complete
Owner: Codex
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
- `docs/adr/0012-milestone-1-execution-identity-and-replay.md`
- `docs/finished/ACME-0018_single-task-execution-engine.md`
- merged runtime source and tests for ACME-0018

## Task Summary

Repair the three current-facing documents whose ACME-0018 completion facts
were lost or mixed during the merge into `main`. Reconcile them against the
merged source, tests, accepted ADR and archived task rather than reconstructing
status from chat history.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Make `docs/JOURNAL.md`, `docs/CURRENT_STATUS.md` and `docs/SYSTEMDOC.md`
accurately describe the merged repository after ACME-0018.

### Primary Deliverable

One reviewed documentation repair that restores the ACME-0018 completion
record, current implementation status and long-lived system description.

### In Scope

- Inspect the merge commit, ACME-0018 archive, ADR-0012, runtime source and
  non-empty execution tests.
- Restore the missing signed ACME-0018 completion entry in `docs/JOURNAL.md`.
- Correct `docs/CURRENT_STATUS.md` from the pre-engine snapshot to current
  bounded-engine, replay and Narrative Phase 5 reality.
- Remove contradictory future-engine wording from `docs/SYSTEMDOC.md` while
  retaining durable persistence, ResearchModule and ScenarioRunner as gaps.
- Verify links, fences, conflict markers, stale claims and repository diff.

### Out of Scope

- Runtime, contract, test or adapter behavior changes.
- Rewriting historical journal entries that were correct when recorded.
- Repairing other current-facing files unless required for this task's own
  lifecycle.
- Commits, pushes, releases or remote mutations.

### Definition of Done

- The three requested documents agree with merged ACME-0018 source, tests,
  ADR-0012 and the archived charter.
- Journal history retains prior entries and includes one dated signed
  completion record.
- No merge markers or obsolete claims that ExecutionEngine/Phase 5 are absent
  remain in the three files.
- Documentation checks, targeted runtime verification and `git diff --check`
  pass.
- The task is archived and `docs/CURRENT_TASK.md` is restored from its
  template.

### Minimum Verification Gates

- [x] `pnpm docs:check`
- [x] `pnpm typecheck`
- [x] `pnpm boundaries`
- [x] `pnpm test:unit`
- [x] `pnpm test:integration`
- [x] `pnpm test:scenario`
- [x] targeted conflict-marker and stale-claim scans
- [x] `git diff --check`

## References

- `docs/finished/ACME-0018_single-task-execution-engine.md`
- `docs/adr/0012-milestone-1-execution-identity-and-replay.md`
- `packages/core/src/execution-engine.ts`
- `tests/integration/execution-engine.test.ts`
- `tests/scenario/narrative-phase-5.test.ts`
- merge commit `6c3d002` and completed ACME-0018 commit `4ad440f`

## Checklist

- [x] Read the required repository documents in order.
- [x] Confirm ACME-0020 is the next task ID and freeze this bounded charter.
- [x] Compare the three files with merged implementation evidence.
- [x] Repair Journal, Current Status and System Documentation.
- [x] Run every frozen verification gate and record evidence.
- [x] Add the signed ACME-0020 journal entry.
- [x] Archive ACME-0020 and restore the current-task template.

## Decisions and Notes

- The user's request explicitly approves this documentation repair.
- Historical entries remain unchanged; only the missing ACME-0018 completion
  entry and the new ACME-0020 repair entry are appended.
- The merged runtime, accepted ADR and executable tests are authoritative when
  resolving conflicting prose.
- Apply `docs/TASK_WORKFLOW.md` to any discovery outside the frozen scope.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- None.

## Verification

- [x] Confirm merged engine/replay source and fixed Narrative scenario exist.
- [x] Record exact test counts from the verification run.
- [x] Confirm `docs/CURRENT_TASK.md` is byte-equivalent to the template after
      archival.
- [x] Record skipped checks and reasons; none were skipped.

Verification completed on 2026-07-31:

- `pnpm docs:check` passed for 53 Markdown files.
- `pnpm typecheck` passed.
- `pnpm boundaries` passed dependency, core-vocabulary and forbidden-fixture
  checks.
- `pnpm test:unit` passed 162 tests in 23 files.
- `pnpm test:integration` passed 10 tests in one file.
- `pnpm test:scenario` passed the one Narrative Phase 5 scenario.
- Targeted current-facing stale-claim and three-file conflict-marker scans
  passed. The broad initial scan found two historically accurate “empty gate”
  statements in 2026-07-29 journal entries; they were intentionally preserved.
- `git diff --check` passed.
- No check was skipped.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] No file-structure or ADR update was required.

## Handoff and Follow-ups

- Current state: ACME-0020 is complete and archived; the inactive task template
  is restored.
- Next recommended step: Activate only the next explicitly approved task.
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
