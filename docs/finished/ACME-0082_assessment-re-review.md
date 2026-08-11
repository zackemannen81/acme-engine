# ACME-0082 — Assessment and re-review core

Task ID: ACME-0082
Parent Task: None
Status: Complete
Owner: Grok
Created: 2026-08-11
Last updated: 2026-08-11
Charter frozen at: 2026-08-11

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/CURRENT_STATUS.md`
- `docs/design/evidence-integrity-workbench-technical-specification.md` slice 5
- ADR-0030, ADR-0031

## Task Summary

Implement Evidence Integrity Workbench slice 5: propose/accept assessments,
new-evidence attention after late import, reaffirm or second assessment, and
deterministic synthetic-only export.

## Task Charter

Frozen. Do not absorb technical audit, PostgreSQL or hosted shell.

### Goal

Deliver assessment propose/review/export over sealed evaluation evidence with
exact citation completeness and one new-evidence notice after `EVAL-E01`.

### Primary Deliverable

`evidence.propose-assessment@1.0.0`, assessment/review-history primary views,
change-set and attention-tier builders, review reaffirm, and deterministic
export of a reviewed assessment.

### In Scope

- Assessment task, golden E-A01/E-A02 fixtures, citation validation
- Attention tier A/B and change-set builders using temporal-overlap
- Product assessment storage, views, API/web, export
- Tests and docs

### Out of Scope

- Technical audit (6), PostgreSQL (7), hosted shell (8)
- Live provider default path; non-synthetic data

### Definition of Done

- E-A01/E-A02 golden ids and basis revisions match sealed truth
- One notice after EVAL-E01 import; old assessment bytes unchanged
- Export deterministic and synthetic-only
- Full verification gates pass; task archived

### Minimum Verification Gates

- [x] typecheck, lint, format:check, boundaries, test, docs:check, build
- [x] assessment golden and attention gates
- [x] git diff --check

## Checklist

- [x] Implement propose-assessment and attention helpers
- [x] Product storage/views/API/export
- [x] Tests, docs, archive, commit, push

## Handoff and Follow-ups

- Current state: Ready; implementing
- Next after complete: slice 6 technical audit
