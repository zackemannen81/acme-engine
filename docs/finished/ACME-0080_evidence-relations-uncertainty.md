# ACME-0080 — Evidence relations and uncertainty

Task ID: ACME-0080
Parent Task: None
Status: Complete
Owner: Grok
Created: 2026-08-11
Last updated: 2026-08-11
Charter frozen at: 2026-08-11

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/design/evidence-integrity-workbench-technical-specification.md`
- `docs/design/evidence-integrity-workbench-product-definition.md`
- `docs/adr/0030-evidence-v1-identity-and-canonical-placement.md`
- `docs/adr/0031-evidence-review-overlay-and-versioned-views.md`
- `docs/adr/0032-evidence-v1-correction-occurrence-pairing.md`

## Task Summary

A task is never considered done until `docs/JOURNAL.md`, `docs/SYSTEMDOC.md`
and `docs/CURRENT_STATUS.md` are à jour.

Implement Evidence Integrity Workbench slice 3: relations and uncertainty.
Reviewers inspect proposed support/conflict/qualification/scope relations with
exact endpoints, accept/reject/leave each unresolved, and see open-question
and relation metrics over the sealed evaluation corpus without technical audit.

## Task Charter

The charter is frozen. Discoveries follow `docs/TASK_WORKFLOW.md` and may not
expand this task into timeline, assessment, technical audit, PostgreSQL or
hosted-shell work (slices 4–8).

### Goal

Deliver a deterministic, source-bound relation and open-question path that
proves the eight sealed evaluation relations, contested standings under scoped
contradictions, unresolved actor ambiguity, and primary relation review without
exposing sealed truth to prompt construction.

### Primary Deliverable

An offline local Evidence Workbench composition that, after evaluation
observations exist, runs `evidence.relate-observations@1.0.0` with fixed mock
responses, commits versioned relation and open-question memory, projects
contest standings for scoped contradictions, and renders a primary relation
review view with review decisions and metrics.

### In Scope

- Implement and publish `evidence.relate-observations@1.0.0` (input/output
  schemas, prompt contract, semantic validation, interpret, state projection).
- Accept propositions/events as optional meaning candidates when supplied;
  require relations and open questions for the evaluation path.
- Deterministic evaluation relation/open-question candidates derived from the
  sealed golden builder path after observation identities exist; sealed truth
  may load only after candidate generation for scoring.
- Contest observation standings for scoped `contradicts` per V1 rules: exhibit
  assertions and correction successors that remain the current corrected
  account stay current when the conflicting endpoint is a later changed
  account; scope-mismatch and qualifies do not contest endpoints.
- Pure primary relation view and work-queue extension for awaiting relation
  review; product storage for relations/open questions and review of
  `targetKind: relation`.
- Local evaluation seed runs observe then relate; development may retain
  observe-only or a minimal development supports relation.
- Focused unit, view, integration and scenario tests plus documentation.

### Out of Scope

- `evidence.build-timeline@1.0.0` and dedicated timeline views (slice 4).
- `evidence.propose-assessment@1.0.0`, re-review, export (slice 5).
- Technical-audit surfaces (slice 6).
- PostgreSQL/Supabase adapter (slice 7) and hosted shell (slice 8).
- Live provider spend unless used only for optional offline-unrelated smoke;
  default path remains deterministic mock.
- Changes to `packages/core` public contracts or accepted ADR meanings.

### Definition of Done

- Catalogue marks `evidence.relate-observations@1.0.0` implemented and the
  module executes it through the unchanged ExecutionEngine.
- Offline evaluation path yields the exact eight golden relation ids and three
  open-question ids; ambiguous actor remains unresolved; partial-scope
  contradicts do not contest out-of-scope claims; scope-mismatch does not
  contest endpoints.
- Final observation standings after relate match sealed truth finals for the
  pre-assessment set (contested E-O05/E-O06/E-O07; current corrected and
  exhibit observations; two superseded correction predecessors).
- Primary relation view is pure, detached, primary-domain classified and free
  of forbidden technical vocabulary; reviewers can accept/reject/leave
  unresolved.
- Duplicate relate with identical content is idempotent (no new provider call
  or revision when nothing changes).
- Required tests and docs pass; ACME-0080 is archived; `CURRENT_TASK` reflects
  the real next state.

### Minimum Verification Gates

- [x] `corepack pnpm install --offline` if workspace metadata changes.
- [x] `corepack pnpm typecheck`.
- [x] `corepack pnpm lint`.
- [x] `corepack pnpm format:check`.
- [x] `corepack pnpm boundaries`.
- [x] `corepack pnpm test` (unit, conformance, integration, scenario).
- [x] `corepack pnpm docs:check`.
- [x] `corepack pnpm build`.
- [x] Eight golden relations + three open questions gate.
- [x] Contested/unresolved/scope-mismatch standing gates.
- [x] Primary-view vocabulary scan.
- [x] Browser smoke with technical audit disabled.
- [x] `git diff --check`.

## References

- `docs/design/evidence-integrity-workbench-technical-specification.md` slice 3
- `packages/module-evidence/`
- `packages/evidence-testing/src/golden.ts`
- `packages/evidence-views/`
- `apps/evidence-workbench-api/`
- ADR-0030, ADR-0031, ADR-0032

## Checklist

- [x] Freeze ACME-0080 charter (this document).
- [x] Implement relate schemas, contract, task and module registration.
- [x] Evaluation relation candidates and golden id proof.
- [x] Contest projection and standing tests.
- [x] Product storage, relation view, API/web, evaluation seed.
- [x] Tests, docs, verification, archive, commit and push.

## Decisions and Notes

- Slice 0–2 and ADRs 0030–0032 remain frozen authority.
- Correction standing supersession stays in observe-artifact projection;
  slice 3 records correction as L3 relation memory without re-superseding.
- Relation ids are content-derived via `evidence-relation-id-1`; open-question
  triggers may reference newly created relation ids within the same commit.
- A checkpoint after every substantive step is required.

## Charter Amendment Log

- none

## Verification

- [x] Unit/contract/standing tests.
- [x] Golden relation and open-question identity proof.
- [x] Product black-box and browser smoke.
- [x] Full repository gates.
- [x] Record skipped checks: none planned.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] package/app READMEs as needed
- [x] technical specification status only for non-semantic status notes

## Handoff and Follow-ups

- Current state: Charter frozen Ready; implementation in progress.
- Next recommended step: implement relate-observations and product path.
- Blockers: none
- Child tasks: none
- Resume condition: n/a
- Open questions: none

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
