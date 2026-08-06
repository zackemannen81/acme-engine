# Current Task

Task ID: ACME-0056
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
- Relevant ADRs under `docs/adr/` (especially 0014–0018, 0020–0025)
- `docs/backlog/driver-error-classification.md`

## Task Summary

Milestones 1–2, the Domain Test UI S1–S10 workbench and the quality-evaluation
foundation are delivered. `docs/CURRENT_STATUS.md` lists many residual gaps,
but they are not ordered, not dependency-mapped and not cut into activatable
charters. Activating any one of them without a plan risks absorbing adjacent
work or reopening frozen ADRs by accident.

This task produces one bounded planning artifact that inventories every
persistent gap, groups it into work packages with explicit steps, marks
dependencies and ADR constraints, and proposes a recommended activation
order. It does **not** implement any gap.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Publish a clear, repository-authoritative plan for how every persistent gap
listed in `docs/CURRENT_STATUS.md` can be solved or deliberately deferred,
with each solution path cut into activatable, non-overlapping work packages.

### Primary Deliverable

`docs/design/gap-resolution-plan.md`

### In Scope

- Inventory every item under **Persistent Gaps** in `docs/CURRENT_STATUS.md`
  (including duplicates and observational notes), with stable gap IDs.
- Classify gaps by theme, risk, dependency and whether they require a new
  ADR, a backlog activation or can stay deferred.
- Define work packages with ordered steps, in/out of scope boundaries and
  suggested verification style for future implementation tasks.
- Record ADR and architecture constraints that forbid naive solutions
  (e.g. no library-owned auto-drain per ADR-0018).
- Propose a recommended activation order and candidate ACME task slices.
- Update long-lived docs so the plan is discoverable and Active Work points
  here while the plan task runs, then to the plan after completion.

### Out of Scope

- Implementing any runtime, adapter, CLI, UI, migration or test change that
  closes a gap.
- Accepting new ADRs that decide implementation details for a future package
  (this plan may *recommend* ADR topics; it does not accept them).
- Live provider calls, deployments, package publication.
- Expanding Milestone 1/2 acceptance conditions or rewriting PROJECT_BRIEF
  goals.
- Solving concept-sandbox ideas not already listed as persistent gaps.

### Definition of Done

- `docs/design/gap-resolution-plan.md` exists and covers every Persistent
  Gaps bullet from `docs/CURRENT_STATUS.md` with a stable ID.
- Every gap is assigned to exactly one work package or an explicit
  “accept / defer” disposition with rationale.
- Each work package states purpose, dependencies, ordered steps, out of
  scope, and a suggested future task shape (not an activated child charter).
- Recommended activation order is stated with blocking dependencies.
- `docs/CURRENT_STATUS.md`, `docs/FILESTRUCTURE.md` and `docs/JOURNAL.md`
  reflect the plan.
- Documentation verification gates pass.

### Minimum Verification Gates

- [x] `pnpm docs:check`
- [x] `git diff --check`
- [x] Manual review: every CURRENT_STATUS Persistent Gaps bullet maps to a
      gap ID in the plan
- [x] Manual review: no work package invents a solution that contradicts an
      accepted ADR without calling out a required ADR amendment

## References

- `docs/CURRENT_STATUS.md` — Persistent Gaps
- `docs/PROJECT_BRIEF.md` — Next Deliverable / open operational surfaces
- `docs/backlog/driver-error-classification.md`
- ADR-0014 live provider boundary
- ADR-0015 schema lowering / optional temperature residual
- ADR-0016 encrypted payload retention
- ADR-0017 durable execution resume / stranded cases
- ADR-0018 outbox delivery boundary
- ADR-0020 `acme-test-plan/1`
- ADR-0021 interface workspace and launch (synchronous `launchPlan`)
- ADR-0022 measurement and fixture approval
- ADR-0023 live evaluation gate (single-execute)
- ADR-0025 post-execution quality evaluation
- `docs/finished/ACME-0054_quality-evaluation-harness.md`
- `docs/finished/ACME-0055_acme-human-readable-documents.md`

## Checklist

- [x] Freeze charter as ACME-0056 (plan-only, no gap implementation).
- [x] Inventory and ID every Persistent Gaps item from CURRENT_STATUS.
- [x] Group into work packages; mark dependencies and ADR constraints.
- [x] Write `docs/design/gap-resolution-plan.md` with activation order.
- [x] Cross-check: every gap ID has a disposition; no silent drops.
- [x] Update `docs/CURRENT_STATUS.md`, `docs/FILESTRUCTURE.md`, `docs/JOURNAL.md`.
- [x] Run documentation verification gates.
- [x] Archive ACME-0056 when the plan is accepted as complete; restore template
      (or leave Active Work pointing at the plan for the next approved task).

## Decisions and Notes

- A checkpoint after each step or substep is required. Checklist is therefore
  updated along the work and `CURRENT_STATUS.md` is always updated when
  changes affect the behavior.
- Language of the plan document: English, matching governing docs. Contract
  and code identifiers stay exact.
- This task does not activate implementation children; it only proposes them.
- Duplicate CURRENT_STATUS bullets (ScenarioRunner live / mock-only) are
  collapsed to one gap ID with dual wording noted.
- Observational bullets that are not defects (e.g. “workbench delivered”,
  “CI uses CLI not browser”) get explicit dispositions rather than fake
  fix-plans.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

- [x] `pnpm docs:check`
- [x] `git diff --check`
- [x] Gap inventory completeness against CURRENT_STATUS
- [x] ADR non-contradiction review
- [x] Document skipped checks and reasons (none expected)

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md` (Remaining Implementation Baseline pointer)
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs when long-lived decisions change (none in this task)
- [x] `docs/PROJECT_BRIEF.md` Next Deliverable pointer
- [x] `docs/design/README.md`

## Handoff and Follow-ups

- Current state: Plan published; ACME-0056 complete.
- Next recommended step: Activate WP-D / D1 (driver-error classification)
  from `docs/backlog/driver-error-classification.md` as the next
  implementation task, or choose another single slice from the plan.
- Blockers: none
- Child tasks: none (plan proposes future tasks; does not create them)
- Resume condition: n/a
- Open questions: product choices listed in the plan (async launch ADR,
  live multi-step budget, quality durable store, privacy lifecycle) await
  explicit approval when those slices are activated.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
