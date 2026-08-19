# Current Task

Task ID: ACME-0165
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-19
Last updated: 2026-08-19
Charter frozen at: 2026-08-19

## Read First

- `AGENTS.md`, especially the live-call policy
- `docs/TASK_WORKFLOW.md`
- `docs/CURRENT_STATUS.md`
- `docs/adr/0048-evidence-v2-observe-contract.md`
- Operator request: a button that extracts observations from a chain
  instance via a live call

## Task Summary
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

Instance extraction is implemented (`POST /api/.../extraction`) and the
live composition can run it. The instance page does not offer that action.
This task puts a confirmation on the instance surface that states the
derived call count and posts the existing run.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

A reviewer on a chain instance can start live observation extraction from
the page, after seeing how many model calls the plan will spend.

### Primary Deliverable

An Extract observations control on the instance surface, wired to the
existing extractor, stating the planned call count before spend.

### In Scope

- Plan extraction when rendering the instance (same as J4 compare).
- Show outstanding vs committed windows and the derived call count.
- A POST that runs outstanding windows and returns the reviewer to the
  instance. JSON clients keep the existing `/api/` contract.
- 501 when the deployment has no live model capability.
- Offline tests: button and count when an extractor is injected; no
  button when it is not; 401/404 on the write.

### Out of Scope

- Changing `evidence-v2-observe/1`, the planner, or the engine.
- A new job runner, progress UI, or cancel control.
- Changing compare, review, or import.
- Spending a live provider call in this task. The live path is already
  proven; this is the missing control.
- Wiring Supabase Auth.

### Definition of Done

- An instance with outstanding windows shows the planned call count and
  an Extract observations control.
- An instance whose windows are all committed states that, and does not
  offer a spend.
- A deployment without an extractor does not offer the control.
- HTML POST runs the existing extractor and redirects to the instance.
- Unauthenticated write is 401; a non-member is 404.

### Minimum Verification Gates

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm test` (at least the V2 API suite)
- [x] `pnpm docs:check`
- [x] `git diff --check`

## References

- [ADR-0048](../adr/0048-evidence-v2-observe-contract.md)
- [ACME-0154](ACME-0154_v2-observation-occurrence.md)
- [ACME-0164](ACME-0164_v2-workbench-visual-shell.md)

## Checklist

- [x] Charter frozen.
- [x] Add the extract plan to the instance renderer.
- [x] Wire HTML POST to the existing extractor; redirect back.
- [x] Offline route tests.
- [x] Verification gates and docs.

## Decisions and Notes
- A checkpoint after each step or substep is required. Checklist is therefore updated along the work and `CURRENT_STATUS.md` is always updated when changes affect the behavior.
- Record decisions and assumptions within the frozen charter.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

Recorded at freeze:

- **The extractor already exists.** This task adds the control, not a
  second execution path.
- **State the bound before spend.** The button reports
  `plan.plannedModelCalls`, which is the outstanding window count.
- **No live spend in this task.** Offline stub proves the control.
  The operator may press it on the live case afterwards.
- **Same-origin form posts prove CSRF via the CSRF cookie** when the
  header is absent, so the browser button works. A request with only the
  session cookie is still 401.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

Run 2026-08-19. Live provider spend not exercised in this task.

- typecheck of the changed packages: clean.
- V2 API tests: the instance page states **2 model calls** and
  Extract observations; HTML POST 303s to the instance; a second run
  increments the stub; second principal 404; unauthenticated 401.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs when long-lived decisions change — none

## Handoff and Follow-ups

- Current state: ACME-0165 complete. Press Extract observations on a
  live instance to spend the stated bound.
- Next recommended step: none activated.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
