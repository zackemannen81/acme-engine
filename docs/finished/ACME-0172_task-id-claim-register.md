# Current Task

Task ID: ACME-0172
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-19
Last updated: 2026-08-19
Charter frozen at: 2026-08-19

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- Relevant ADRs under `docs/adr/`

## Task Summary
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

Activated from
[`docs/backlog/task-id-allocation-across-branches.md`](../backlog/task-id-allocation-across-branches.md),
proposed 2026-08-19 after a real collision.

Two tasks were frozen under `ACME-0169` on the same day: Felix's PR #38 at
13:04 and a parallel branch at 14:03. The second actor computed the next free
ID from `docs/finished/` and a grep of the local tree, neither of which can see
someone else's unmerged branch. The later pair was renumbered to ACME-0170 and
ACME-0171, because renaming sixteen published commits would have required a
force-push and broken an open review.

A Task ID is an identity in exactly the sense ACME-0170 made normative. Two
records sharing one identity is the same class of defect as two records sharing
a path, and the allocation rule guarantees it will recur: two actors starting on
the same day from the same trunk always compute the same next number.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Make task-ID allocation collision-safe by claiming the ID on `main` before the
charter freezes, in a form where two simultaneous claims fail as a merge
conflict rather than as a silent duplicate.

### Primary Deliverable

`docs/TASK_IDS.md`, a claim register on the trunk, together with the allocation
rule in `AGENTS.md` and `docs/TASK_WORKFLOW.md` and enforcement in
`tooling/docs/check-docs.mjs`.

### In Scope

- Create the register as a strictly ascending list, one ID per line, appended
  at the end. The append point is the design: two simultaneous claims edit the
  same region and conflict, which is the only reliable outcome available.
- Record per claim: Task ID, short title, owner, date claimed, and where the
  work lives as a branch name or PR number.
- State a floor. The register begins at `ACME-0169`; every lower ID is
  addressed by `docs/finished/` and is not backfilled.
- Record the three live claims: `ACME-0169` for Felix's PR #38, `ACME-0170` and
  `ACME-0171` for the delivered addressing work.
- State the allocation rule: the next free ID is one above the highest of the
  register and `docs/finished/`; the ID is not yours until the claim is merged
  to `main`; the claim must exist before the charter moves to `Ready`.
- Give the fallback for a forgotten claim, as one command:
  `git ls-remote --heads origin` together with `gh pr list --state open`.
- Enforce in `pnpm docs:check`: register rows are well formed, strictly
  ascending and unique; every archived task at or above the floor has a claim;
  the active `docs/CURRENT_TASK.md` ID has a claim.
- Scope-qualify the single-active-task rule in `AGENTS.md` and
  `docs/TASK_WORKFLOW.md`: at most one active task **per branch**, held in
  that branch's `docs/CURRENT_TASK.md`. The trunk never states how many tasks
  are active anywhere.
- State that the register carries no status column. It records that a number
  is taken, never that work is in progress.
- State what `docs/CURRENT_TASK.md` means on `main`: normally the template,
  because a task branch merges when its task is complete. A merged
  in-progress charter is an explicit, temporary exception.

### Out of Scope

- Renumbering, renaming or editing any existing task, branch or pull request.
- Asking Felix to change PR #38. His claim is recorded from this side.
- Changing the `ACME-NNNN` format or deriving IDs from issue or PR numbers.
- Weakening the single-active-task rule. Its force is unchanged; only the
  scope at which it is stated changes, from unstated to per branch.
- Changing how `docs/CURRENT_TASK.md` works, beyond stating the scope the
  existing rule applies at and what the file means once merged to `main`.
- Tracking task status, progress or outcome in the register. It allocates
  identity only.
- Backfilling claims for the 168 tasks below the floor.
- Automating claim creation with a script or CLI.
- Any change to `packages/`, `apps/`, product behavior, contracts or
  persistence.

### Definition of Done

- `docs/TASK_IDS.md` exists, states its floor, and holds the three live claims.
- `AGENTS.md` and `docs/TASK_WORKFLOW.md` state the allocation rule, including
  that an ID is claimed before `Ready` and owned only once merged to `main`.
- `pnpm docs:check` fails on a duplicate ID, on an out-of-order row, on an
  archived task at or above the floor without a claim, and on an active task
  without a claim.
- Each new check is negative-tested with a deliberately broken fixture, and the
  fixtures are removed.
- `pnpm docs:check`, `pnpm format:check` and `pnpm lint` pass.
- `docs/JOURNAL.md` has a signed entry and this task is archived.

### Minimum Verification Gates

- [x] `pnpm docs:check` passes
- [x] `pnpm format:check` passes
- [x] `pnpm lint` passes
- [x] `git diff --check` is clean
- [x] Duplicate, out-of-order, unclaimed-archive and unclaimed-active fixtures
      each fail the check
- [x] `git diff --find-renames --diff-filter=R` shows no renamed file

## References

- [`docs/backlog/task-id-allocation-across-branches.md`](../backlog/task-id-allocation-across-branches.md)
- [`docs/finished/ACME-0170_addressing-and-discoverability.md`](ACME-0170_addressing-and-discoverability.md)
- [`docs/TASK_WORKFLOW.md`](../TASK_WORKFLOW.md)
- [`tooling/docs/check-docs.mjs`](../../tooling/docs/check-docs.mjs)

## Checklist

- [x] Write `docs/TASK_IDS.md` with the floor and the live claims, including
      this task's own, which the active-task check requires
- [x] State the allocation rule in `AGENTS.md`
- [x] State the claim step in `docs/TASK_WORKFLOW.md`, before `Ready`
- [x] Implement register validation in `tooling/docs/check-docs.mjs`
- [x] Implement the archive and active-task cross-checks
- [x] Negative-test each check, then remove the fixtures
- [x] Update `docs/backlog/task-id-allocation-across-branches.md` in place
- [x] Update `docs/FILESTRUCTURE.md`
- [x] Run the verification gates
- [x] Add a signed `docs/JOURNAL.md` entry and archive this task

## Decisions and Notes
- A checkpoint after each step or substep is required. Checklist is therefore updated along the work and `CURRENT_STATUS.md` is always updated when changes affect the behavior.
- The register cannot prevent the race. Two actors can still claim the same ID
  within the same minute. What it buys is that both claims touch the same
  region of one file on the trunk, so the second one is a merge conflict
  instead of a silent duplicate. That is why the format is one ID per line,
  strictly ascending, appended at the end. A sorted insert, a nested structure
  or a per-owner section would merge cleanly and reintroduce the defect.
- The register owns allocation, not lifecycle. Task state already has owners in
  `docs/CURRENT_TASK.md` and `docs/finished/`, and a second status surface
  would drift from both. The checker joins register and archive instead.
- No backfill. Fabricating an owner and a claim date for 167 historical tasks
  would be inventing evidence in a repository whose value is that its evidence
  is real. The floor plus the archive answers the same question honestly.
- Cheapness is a requirement, not a nicety. If a claim is not a one-line change
  that merges within a minute, contributors will route around it and the
  register will describe a process nobody follows.
- Felix changes nothing. His claim row is written from this side, which also
  proves the register can record work it does not own.
- Claiming an ID on the trunk looks like it breaks "at most one active task",
  and it would if the register recorded activity. It records identity. A number
  being taken says nothing about whether anyone is working, the way a reserved
  name says nothing about whether the thing is built. This is the second and
  stronger reason the register has no status column.
- The single-active-task invariant was never repository-wide in practice.
  `docs/CURRENT_TASK.md` is a file in the working tree, so git already gives
  exactly one per branch, and ACME has run parallel `felix/*` branches for
  several tasks. Stating the rule per branch does not weaken it; it states it
  at the level where it is already enforced, and `main` obeys it too.
- Per branch is the checkable phrasing. Per actor is the intent, since one
  person holding three branches really does have divided scope, but no check
  can see that and the rule should not pretend otherwise. Record it as
  practice, not as a gate.
- Correction to ACME-0171, applied before this charter was frozen: the active
  charter was in the validated prose surface list, which made it impossible to
  charter work that creates a new file. This charter cites `docs/TASK_IDS.md`
  five times before it exists. `docs/CURRENT_TASK.md` now warns instead of
  failing, for the mirror image of the reason the archive does: a charter names
  its deliverables before they exist, a journal entry names files after they
  are gone. The archived ACME-0171 record is not edited; the correction is
  recorded forward here and in the journal.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

- [x] `pnpm docs:check` — 313 files, 0 errors
- [x] `pnpm format:check` — clean across the repository
- [x] `pnpm lint` — clean across the repository
- [x] `git diff --check` — clean
- [x] `git diff --find-renames --diff-filter=R origin/main` — empty
- [x] Five broken-fixture demonstrations, all reverted:
  - a duplicate claim row was reported as out of ascending order
  - an appended `Status` column was rejected
  - a missing `Floor:` line was rejected
  - an archived `ACME-0199` with no claim was reported
  - an active task renamed to an unclaimed `ACME-0198` was reported
- [x] No checks skipped.

## Documentation Updates

- [x] `AGENTS.md`
- [x] `docs/TASK_WORKFLOW.md`
- [x] `docs/TASK_IDS.md`
- [x] `docs/backlog/task-id-allocation-across-branches.md`
- [x] `docs/backlog/README.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] No ADR. The allocation rule constrains workflow, not a contract,
      persistence or migration path.

## Handoff and Follow-ups

- Current state: Complete. `docs/TASK_IDS.md` holds four claims above a stated
  floor of ACME-0169, `AGENTS.md` and `docs/TASK_WORKFLOW.md` carry the
  allocation rule and the per-branch scope of the active-task invariant, and
  `pnpm docs:check` enforces the register.
- Defect found by its own negative test: the column check first used a
  substring match, so an appended `Status` column still satisfied it. The check
  now compares the whole header line. The test earned its place immediately.
- Bootstrap note: this task claims its own identity in the register it creates.
  That is unavoidable for the first claim and is not a pattern for later tasks,
  which claim before freezing.
- Felix changed nothing. `ACME-0169` is recorded from this side, which proves
  the register can hold work it does not own.
- Merge order agreed with the owner: PR #38 first, then this branch. The only
  file both branches touch is `docs/CURRENT_TASK.md`. After the second merge the
  stricter checks run against the combined tree for the first time, so
  `pnpm docs:check` should be run on `main` at that point.
- Next recommended step: none required.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: the register is a claim log, not a lock. Two claims inside the
  same second still both merge cleanly if git resolves the region without
  conflict; the design reduces that window rather than closing it.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
