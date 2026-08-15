# Current Task

Task ID: ACME-0125
Parent Task: None
Status: Ready
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T18:24:50+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- ACME-0123 and ACME-0124

## Task Summary

Correct the live journey's source-view field mismatch and make the compiler
bind the harness to the public view contract.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Ensure reviewer commands use the public source view's
`observationVersionId`, never a handwritten internal-record field name.

### Primary Deliverable

The live harness consumes `EvidencePrimarySourceReviewView` directly and uses
its typed observation version identity for all review/history routes.

### In Scope

- Replace the handwritten source-view response type with the exported view type.
- Replace three `observationId` references with `observationVersionId`.
- Run focused/canonical offline gates and reality-sync/commit.

### Out of Scope

- Provider/network calls, other harness behavior, product/view changes,
  relation/assessment contracts, Stage B, deployment, push or release.

### Definition of Done

- TypeScript enforces the public source view identity field.
- No stale `observationId` reference remains in the live journey.
- Canonical offline gates pass; no source, credential or provider call occurs.

### Minimum Verification Gates

- [ ] Focused type/lint/static live-gate checks
- [ ] typecheck, lint, boundaries, test, build, format, docs and diff

## References

- `packages/evidence-views/src/schemas.ts`
- `tests/live/evidence-stage-a-reviewer-journey.test.ts`
- `docs/finished/ACME-0124_stage-a-live-reviewer-acceptance.md`

## Checklist

- [x] Freeze bounded offline correction.
- [ ] Bind harness to public view type and correct identity field.
- [ ] Run focused/canonical verification.
- [ ] Reality-sync docs, archive and commit.

## Decisions and Notes

- This is a harness contract fix; product API and view schemas remain unchanged.
- No live opt-in or credential may be loaded.
- A checkpoint after every substep is required.

## Charter Amendment Log

- None.

## Verification

- [ ] Record exact offline gates and results.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] completion plan/Slice 9 notes

## Handoff and Follow-ups

- Current state: task frozen; no code change and no provider call.
- Next recommended step: apply typed identity correction.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0125_source-view-observation-identity.md`.
- Restore task template and add a signed Journal entry.
- Supersede rather than rewrite if the Goal changes.
