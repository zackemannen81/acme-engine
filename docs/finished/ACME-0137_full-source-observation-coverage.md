# Current Task

Task ID: ACME-0137
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/CONTRIBUTING.md`
- ADR-0044 and ADR-0045
- `docs/acceptance/ACME-0136-frozen-acceptance-report.md`

## Task Summary

Implement ADR-0045 §6: full-source observation coverage as a windowed
workflow with explicit per-segment accounting.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Every non-empty source segment is shown to the model in some window and
either becomes an observation or is recorded as examined. A batch is no
longer the product's coverage claim.

### Primary Deliverable

A coverage planner, an additive observation contract that requires complete
accounting inside one window, and a live observation job that iterates
windows as separate bounded executions.

### In Scope

- Plan non-overlapping windows of at most the active candidate ceiling.
- Active observe contract 1.8.0: provider sees only the window; semantics
  require exactly one observation per supplied segment.
- Live observation iterates windows; each window is one execution with its
  own request key so resume replays completed windows.
- Job progress reports window i of n and accumulated model calls.
- Historical `@1.0.0`–`@1.7.0` stay byte-exact.
- Offline gates for planner, complete/incomplete window semantics,
  historical replay, and a multi-window execution.

### Out of Scope

- Provider calls and a new live acceptance run.
- Changing quote binding, runtime derivation, or fail-closed validation.
- Raising or removing the per-call candidate ceiling.
- Date-only temporal bounds.
- Relation/assessment coverage.
- Segment granularity and the extraction pipeline.

### Definition of Done

- A source with more segments than one window produces multiple executions
  and one observation per non-empty segment.
- A window that omits a supplied segment is refused.
- A single window still cannot claim document coverage.
- Historical observation contracts replay byte-exact.
- Offline gates pass.

### Minimum Verification Gates

- [x] Coverage planner gate
- [x] Complete-window semantic gate
- [x] Incomplete-window refusal gate
- [x] Historical contract replay gate
- [x] Multi-window execution gate
- [x] typecheck, lint, boundaries, test, build, format, docs and diff

## References

- ADR-0045 §6
- `packages/module-evidence/src/coverage.ts`
- `packages/module-evidence/src/contracts/observe-artifact.ts`
- `apps/evidence-workbench-api/src/live-observation.ts`

## Checklist

- [x] Freeze the charter.
- [x] Add the planner and 1.8.0 contract.
- [x] Drive live observation across windows.
- [x] Relax job progress/call-count records so a long document can finish.
- [x] Add the five gates.
- [x] Reality-sync docs, archive.

## Decisions and Notes

- One execution stays one primary call plus repair. Coverage is a product
  workflow over many executions, not an unbounded loop inside the engine.
- Window size equals the candidate ceiling so one call can name every
  segment it was shown. Headings become observations; the reviewer rejects
  them. That is how "all observations must come through" is implemented
  without an unbounded array.
- Empty or whitespace-only lines are not segments today and stay unobserved.
- Resume uses per-window request keys. A committed window is not paid for
  again.
- Coverage semantics require every supplied window segment to appear and
  refuse a segment outside the window. Two distinct observations of the same
  supplied segment remain valid so EVAL-E01's two facts from one log line
  still pass. The output ceiling of 64 still binds one call.
- Offline seed/import attaches the fixture `coverageWindow` so scripted
  hashes stay pinned. Live observation plans windows from the source text.

## Charter Amendment Log

- None.

## Verification

- [x] Record offline commands and results.

```text
pnpm typecheck                         pass
pnpm lint                              pass
pnpm format:check                      pass
pnpm boundaries                        pass
pnpm docs:check                        253 Markdown files
pnpm test:unit                         786/786
pnpm test:conformance                  78/78
pnpm test:integration                  70/70
pnpm test:scenario                     26/26
pnpm build                             pass
git diff --check                       pass
```

Focused gates: planner (`coverage.test.ts`), complete and incomplete window
semantics plus same-segment pair (`observe-artifact.test.ts`), historical
replay (`observe-artifact.test.ts`), multi-window execution
(`tests/integration/evidence-coverage-windows.test.ts`).

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes

## Handoff and Follow-ups

- Current state: archived. ADR-0045 §6 is implemented offline.
- Next recommended step: date-only temporal bounds, or the 409
  ledger/relation/question views when product revision is ahead of the
  engine. A new live acceptance is a separate task.
- Blockers: none.
- Child tasks: none.
- Open questions: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0137_full-source-observation-coverage.md`.
- Restore the task template and add a signed Journal entry.
