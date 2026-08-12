# Current Task

Task ID: ACME-0098
Parent Task: None
Status: In Progress
Owner: Codex
Created: 2026-08-12
Last updated: 2026-08-12
Charter frozen at: 2026-08-12

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/adr/0035-evidence-authenticated-principal-and-authorization.md`
- `docs/adr/0036-evidence-case-management-and-isolation.md`
- `docs/design/evidence-integrity-workbench-product-completion-plan.md`

## Task Summary

Complete Stage 6 with durable reviewer assignment/activity records and
case-isolated search/filter/navigation that remains useful at corpus scale.

## Task Charter

### Goal

Turn the current decision screens into an operational review workspace where
work can be assigned, found, filtered and traced without weakening source or
case boundaries.

### Primary Deliverable

Versioned reviewer-operation/search contracts, persistence, case-first APIs,
browser navigation and executable role/isolation proofs.

### In Scope

- Assignment/reassignment, waiting/reviewed state and append-only activity.
- Reviewer comments/rationales and timestamps without mutable review history.
- Safe bounded bulk decisions using the existing decision semantics.
- Case-scoped search across source metadata, actors, relation kind, review
  standing, locators, questions and assessments.
- Deterministic pagination/filter contracts and browser navigation.
- File/PostgreSQL persistence, migration and shared conformance.
- Same-organization cross-case, role, archived-case and regression proofs.
- Governing/architecture/product documentation and task archive.

### Out of Scope

- Case overview or Case Integrity Report (Stage 7).
- New ingestion formats/data classes or non-synthetic authority.
- Changing Evidence canonical facts, review decision history or ACME core.
- Automatic semantic/vector search or model-based ranking.

### Definition of Done

- An authorized case admin can assign/reassign review work and a reviewer can
  find their waiting items, comment and decide them with durable activity.
- Search/filter/navigation stays case-first, deterministic and bounded; known
  foreign ids and query terms disclose nothing.
- Bulk decisions validate every target and commit no partial unsafe batch.
- File restart and PostgreSQL migration/conformance retain operational state.
- Existing assessment/re-review/import/redaction journeys regress green.
- Canonical verification, synchronized docs, journal and archive are complete.

### Minimum Verification Gates

- [ ] Contract/identity/query-vector tests.
- [ ] File/PostgreSQL repository conformance and restart.
- [ ] Assignment/comment/bulk role and concurrency tests.
- [ ] Same-organization cross-case black boxes.
- [ ] Browser-visible reviewer operations and search acceptance.
- [ ] Existing product journey regressions.
- [ ] Canonical typecheck/lint/boundaries/tests/build/format/docs/diff gates.

## References

- `packages/evidence-product-contracts/`
- `packages/evidence-views/`
- `apps/evidence-workbench-api/`
- `apps/evidence-workbench-web/`

## Checklist

- [ ] Add versioned reviewer operation and search contracts.
- [ ] Extend file/PostgreSQL persistence and migration.
- [ ] Implement pure effective-work/search projections.
- [ ] Add case-first API and browser workflows.
- [ ] Add adversarial, conformance, restart and UI proofs.
- [ ] Run focused and canonical verification.
- [ ] Synchronize docs, journal and archive.

## Decisions and Notes

- The charter is frozen and synthetic-only.
- Search is exact deterministic product projection, not model inference.
- Existing append-only review decisions remain canonical for review standing.

## Charter Amendment Log

- none

## Verification

- [ ] Record exact commands, counts and environment refusals.

## Documentation Updates

- [ ] `AGENTS.md`, project/status/system/file-structure docs
- [ ] product definition, technical specification and completion plan
- [ ] API/deployment/operations docs
- [ ] `docs/JOURNAL.md`

## Handoff and Follow-ups

- Current state: Stage 5 (`ACME-0097`) is complete and archived. Stage 6 is
  frozen and partially implemented, but it has not passed verification and
  must not be described as complete.
- Implemented so far: versioned reviewer assignment/comment/activity, bulk
  review and case-search contracts; snapshot/repository extensions; file and
  PostgreSQL persistence including migration v6; and initial case-first API
  routes for search, reviewer work, assignment, comments and bulk decisions.
- Exact resume point: fix the four current TypeScript errors in
  `packages/evidence-product-contracts/src/operations.ts`. The effective
  decision helper takes `(decisions, targetVersionId)`; the review action is
  `request-revision`; and observation actor/locator fields differ between the
  observation variants. Then run typecheck before adding Stage 6 tests or UI.
- Remaining Stage 6 work: effective work projection details, single-decision
  activity integration, assignment completion semantics, browser workflow,
  adversarial/conformance/restart tests, canonical verification and docs.
- Next recommended step after ACME-0098: Stage 7 overview/integrity report.
- Blockers: no product blocker is known; the pause is only the requested
  weekly token-limit stop.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none within the frozen charter. No verification result has
  been recorded for the partial Stage 6 implementation.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Populate `docs/CURRENT_TASK.md` with Stage 7.
- Add a signed `docs/JOURNAL.md` entry.
