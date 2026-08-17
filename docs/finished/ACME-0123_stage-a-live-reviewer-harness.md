# Current Task

Task ID: ACME-0123
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T18:08:20+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- ADR-0040 through ADR-0043
- ACME-0107, ACME-0108, ACME-0110, ACME-0121 and ACME-0122

## Task Summary

Add the missing reproducible live acceptance harness for the complete Stage A
reviewer/reassessment journey over two operator-authorized external sources.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Make the already implemented POC #1 live vertical executable as one bounded,
content-safe product acceptance without substituting mocks for provider work.

### Primary Deliverable

An opt-in live Vitest gate that imports two Stage A texts and drives observation,
review, relation/question, assessment review, restart, later evidence, stale
attention and reassessment through authenticated case-first product APIs.

### In Scope

- Add one fail-closed live test with explicit D1/D2 source/provenance inputs.
- Use PostgreSQL, private S3, mounted payload/artifact keys and the real gateway.
- Bound every execution to one model call and the configured monetary ceiling.
- Assert only domain outcomes: source-bound observations, reviewer decisions,
  relations/questions, assessment citations/review, restart and stale successor.
- Verify the harness offline against types, static live-safety requirements and
  the existing full PostgreSQL journey before any paid run.

### Out of Scope

- Provider calls in this task, new source classes, PDF/DOCX/OCR ingestion or D2
  content in Git.
- New domain behavior, contract/prompt changes, exhaustive coverage claims,
  technical-audit UI, deployment, push or release.
- Re-proving the product journey with a new mock fixture.

### Definition of Done

- Gate refuses unless exact live/hosted inputs, two external sources, durable
  stores, keys and nested monetary/call budgets are supplied.
- Journey encodes all remaining POC #1 Stage A domain outcomes and restart.
- Existing offline PostgreSQL journey and canonical gates pass.
- No source, credential or provider call occurs; task archived/committed.

### Minimum Verification Gates

- [x] Focused type/static live-gate checks
- [x] Existing Stage A PostgreSQL journey on fresh PostgreSQL
- [x] typecheck, lint, boundaries, test, build, format, docs and diff

## References

- `tests/live/evidence-stage-a-observation.test.ts`
- `tests/postgres/evidence-stage-a-import.test.ts`
- `apps/evidence-workbench-worker/src/index.ts`
- `docs/backlog/slice-9-prerequisite-checklist.md`

## Checklist

- [x] Freeze the bounded offline harness task.
- [x] Implement authenticated two-source live reviewer journey.
- [x] Add content-free domain/restart assertions and safety guards.
- [x] Run focused and canonical offline verification.
- [x] Reality-sync docs, archive and commit.

## Decisions and Notes

- This task writes only the harness. The paid run requires a separately frozen
  one-shot acceptance task after a green checkpoint.
- Each observation/relation/assessment execution requests one call maximum;
  the monetary value is minor SEK units, never a token count.
- API-driving is acceptance automation for the same case-first endpoints used
  by the primary browser; assertions target domain state, not ACME internals.
- A checkpoint after every substep is required.
- The new opt-in gate encodes six one-call executions across three process
  compositions, uses only authenticated case-first product routes, exercises
  accept/reject/unresolved review and refuses technical-audit substitution.
- Typecheck passed; the gate compiles/skips closed without opt-in, and 15
  focused live-safety/secret/composition tests passed.
- Fresh PostgreSQL Stage A journey passed 2/2. Canonical verification passed
  751 unit, 78 conformance, 62 integration and 26 scenario tests plus all
  build/static/document gates. Lint found one forbidden non-null assertion;
  the bounded local correction passed before the canonical run.

## Charter Amendment Log

- None.

## Verification

- [x] Focused type/static: gate compiled and skipped closed; 15 safety tests.
- [x] Fresh PostgreSQL Stage A journey 2/2; disposable container removed.
- [x] Typecheck, lint, boundaries, build; 751 unit, 78 conformance, 62
  integration and 26 scenario; format, docs and diff.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] completion plan, Slice 9 checklist and `docs/FILESTRUCTURE.md`

## Handoff and Follow-ups

- Current state: complete harness and all offline gates pass; no source,
  credential or provider call occurred.
- Next recommended step: freeze a separate six-call Stage A live acceptance.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0123_stage-a-live-reviewer-harness.md`.
- Restore the task template and add a signed Journal entry.
- Supersede rather than rewrite if the Goal changes.
