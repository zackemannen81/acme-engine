# Current Task

Task ID: ACME-0092
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-12
Last updated: 2026-08-12
Charter frozen at: 2026-08-12

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0028-first-poc-evidence-integrity-workbench.md`
- `docs/adr/0031-evidence-review-overlay-and-versioned-views.md`
- `docs/adr/0035-evidence-authenticated-principal-and-authorization.md`
- `docs/design/evidence-integrity-workbench-product-completion-plan.md`

## Task Summary

Decide the Stage 3 product boundary before implementing case management. The
decision must turn the existing synthetic workspace into an explicit case,
define case membership and lifecycle, and make cross-case non-disclosure an
executable architectural obligation rather than a route-by-route convention.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Fix one coherent case/workspace management and isolation architecture for the
Evidence Integrity Workbench that can be implemented without opening any
non-synthetic data path.

### Primary Deliverable

An accepted ADR that defines case identity, lifecycle, participant roles,
object ownership, API/worker scoping, persistence migration and mandatory
same-organization cross-case isolation proofs.

### In Scope

- Decide the relationship between product cases and the existing workspace ID.
- Decide case create/list/search/archive and participant-management authority.
- Define immutable ownership for every case-bound product object and traversal.
- Define deny-by-default case roles and their interaction with organization roles.
- Define API, worker, search/projection, export and persistence isolation rules.
- Define migration of the fixed synthetic workspace and fail-closed legacy behavior.
- Define implementation proofs and synchronized follow-up documentation.

### Out of Scope

- Implementing the accepted ADR.
- Non-synthetic ingestion or changing the synthetic-only data policy.
- Artifact object storage, encryption, redaction, general search or audit trails.
- Case templates, deletion, sharing links, break-glass access or billing.
- Changing Evidence domain meaning, source-binding invariants or legal authority.

### Definition of Done

- ADR-0036 is accepted and resolves every in-scope architecture boundary.
- The ADR requires executable two-case isolation across every current route family,
  jobs, citations and exports, including adversarial identifiers.
- The completion plan and governing status/system documentation name the decided
  Stage 3 boundary and a separately activatable implementation task.
- Documentation verification and `git diff --check` pass.
- The task is journaled, archived and `docs/CURRENT_TASK.md` is reset or advanced.

### Minimum Verification Gates

- [x] Inspect all existing workspace-bearing contracts, policy actions and routes.
- [x] Verify internal Markdown links and balanced fences.
- [x] Run `git diff --check`.

## References

- `docs/design/evidence-integrity-workbench-product-completion-plan.md`
- `docs/adr/0035-evidence-authenticated-principal-and-authorization.md`
- `packages/evidence-product-contracts/src/schemas.ts`
- `packages/evidence-product-contracts/src/repository.ts`
- `packages/evidence-auth/src/policy.ts`
- `apps/evidence-workbench-api/src/index.ts`

## Checklist

- [x] Inspect the existing workspace, authorization and route boundaries.
- [x] Write and accept ADR-0036.
- [x] Synchronize completion-plan, status and system documentation.
- [x] Run documentation verification and inspect the resulting diff.
- [x] Journal and archive ACME-0092.

## Decisions and Notes

- This is the separately reviewable decision task required by Stage 3.
- The next task may implement only the boundary accepted here and remains
  synthetic-only.

## Charter Amendment Log

- none

## Verification

- [x] `corepack pnpm docs:check` — 191 Markdown files checked.
- [x] `git diff --check`

## Documentation Updates

- [x] `docs/adr/0036-evidence-case-management-and-isolation.md`
- [x] `docs/design/evidence-integrity-workbench-product-completion-plan.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`

## Handoff and Follow-ups

- Current state: ADR-0036 accepted and synchronized.
- Next recommended step: implement ADR-0036 in ACME-0093.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none; remaining trade-offs are resolved by the ADR.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
