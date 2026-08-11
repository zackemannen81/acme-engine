# ACME-0081 — Timeline and open questions

Task ID: ACME-0081
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
- ADR-0030, ADR-0031, ADR-0032

## Task Summary

A task is never considered done until `docs/JOURNAL.md`, `docs/SYSTEMDOC.md`
and `docs/CURRENT_STATUS.md` are à jour.

Implement Evidence Integrity Workbench slice 4: deterministic timeline and
primary open-question views over source-bound temporal bounds without inventing
precision.

## Task Charter

The charter is frozen. Discoveries follow `docs/TASK_WORKFLOW.md` and may not
expand into assessment, technical audit, PostgreSQL or hosted shell (slices
5–8).

### Goal

Deliver a pure, deterministic timeline and open-question primary surface that
orders exact/range/approximate/unknown temporal bounds, exposes ambiguity
bands and the three sealed open questions with source navigation.

### Primary Deliverable

`evidence.build-timeline@1.0.0` plus pure primary timeline and open-question
views wired into the local Evidence Workbench composition over the evaluation
seed.

### In Scope

- Implement deterministic `evidence.build-timeline@1.0.0` (transformer, not
  model-backed) that orders temporal entries without inventing precision.
- Pure `evidence-temporal-overlap-1` helper for exact/range/approximate/
  unknown non-overlap rules (foundation for slice 5 attention tiers).
- Pure primary timeline and open-question views; API routes and browser nav.
- Golden temporal type/order cases and permutation stability tests.
- Documentation updates.

### Out of Scope

- Assessment propose/re-review/export (slice 5).
- Technical audit (slice 6), PostgreSQL (slice 7), hosted shell (slice 8).
- Live provider paths; non-synthetic data.
- Changing core public contracts or accepted ADR meanings.

### Definition of Done

- Catalogue marks build-timeline implemented.
- Offline evaluation path exposes ordered timeline entries for sealed
  temporal expectations and the three open questions with source links.
- No invented precision; unknown does not overlap; permutation of input does
  not change output order beyond stable id fallback.
- Required tests and docs pass; task archived.

### Minimum Verification Gates

- [x] typecheck, lint, format:check, boundaries, test, docs:check, build
- [x] temporal golden/order and overlap unit gates
- [x] primary-view vocabulary scan
- [x] git diff --check

## References

- technical specification slice 4
- packages/module-evidence, evidence-views, evidence-workbench-api/web

## Checklist

- [x] Freeze charter
- [x] Implement build-timeline task and temporal-overlap helper
- [x] Views, API, web
- [x] Tests and docs
- [x] Verify, archive, commit, push

## Decisions and Notes

- Timeline is pure/deterministic; no model call.
- Open questions already exist in product storage from slice 3; this slice
  adds primary views and timeline ordering.

## Charter Amendment Log

- none

## Verification

- [x] Unit/view/scenario gates
- [x] Full repository gates

## Documentation Updates

- [x] CURRENT_STATUS, SYSTEMDOC, JOURNAL, FILESTRUCTURE as needed

## Handoff and Follow-ups

- Current state: Ready; implementing
- Next recommended step: implement build-timeline
- Blockers: none

## Finalize When Complete

- Archive under docs/finished/
- Restore template or next approved task
- Signed JOURNAL entry
