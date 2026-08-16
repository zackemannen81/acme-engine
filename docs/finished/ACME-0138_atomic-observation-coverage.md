# Current Task

Task ID: ACME-0138
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
- ADR-0045 §6
- `docs/finished/ACME-0137_full-source-observation-coverage.md`

## Task Summary

Separate segment coverage from observation cardinality. A window must be
accounted for; a segment may yield zero or many atomic observations.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Cover every supplied source segment, and extract every independently
usable source-bound proposition it contains. Coverage is not an
observation-count.

### Primary Deliverable

Active observe contract `1.9.0` with output `/5` `segmentCoverage`, a
prompt that allows `0..N` atomic observations per segment, and semantics
that check the coverage ledger rather than `1` observation per segment.

### In Scope

- Version active observe to `1.9.0`. Keep `@1.8.0` byte-exact.
- Output `/5`: `observations` plus `segmentCoverage` (`observations_extracted`
  | `no_observation`).
- Prompt: atomicity, no merge, no invented coverage observations, no
  extraction-time dedup, reported-speech stays attributed, raw temporal
  text survives failed normalization in `temporalBound.reason`.
- Semantics: window ids equal coverage ids exactly once; observation
  ids stay inside the window; status matches presence/absence of
  observations. No gate on observation count versus segment count.
- Fixture hashes recomputed against `1.9.0`.
- Historical replay of `@1.0.0`–`@1.8.0`.

### Out of Scope

- Provider calls and a new live acceptance run.
- A model-authored `statement` or quote field.
- Changing quote binding, locators or fail-closed actor/temporal
  normalization rules for *normalized* timestamps.
- Date-only temporal bounds as a new normalized kind.
- Relation/assessment coverage.
- Persisted observation identity changes.

### Definition of Done

- A window is refused when `segmentCoverage` omits a supplied segment.
- A heading or empty-of-propositions segment may be `no_observation`.
- Two atomic observations from one segment are accepted.
- An invented observation is not required to cover a segment.
- Historical `@1.8.0` replays byte-exact.
- Offline gates pass.

### Minimum Verification Gates

- [x] Coverage-ledger complete/incomplete gates
- [x] Zero-observation `no_observation` gate
- [x] Multi-observation same-segment gate
- [x] Historical `@1.8.0` request-hash gate
- [x] typecheck, lint, boundaries, test, build, format, docs and diff

## References

- `packages/module-evidence/src/contracts/observe-artifact.ts`
- ACME-0137

## Checklist

- [x] Freeze the charter.
- [x] Add output `/5` and contract `1.9.0`.
- [x] Point live/seed registries at `1.9.0`; keep `1.8.0` registered.
- [x] Update fixtures and hashes.
- [x] Add the four semantic gates.
- [x] Reality-sync docs, archive.

## Decisions and Notes

- Runtime still owns quote and locator. The model still returns only
  `sourceSegmentId`. Multiple observations of one segment share that
  segment's quote.
- `EVIDENCE_DUPLICATE_OBSERVATION` still refuses byte-identical
  candidates in one response. Similar propositions are not suppressed.
- Window size stays 64. `1.9.0` raises the per-call observation ceiling
  to 128 so a window can hold more than one proposition per segment
  inside the existing 8,192-token budget (~54 tokens × 128 ≈ 6,900).
  Exhausting 128 remains fail-closed.
- `1.8.0` keeps ceiling 64 and the old coverage-as-observation-set rule.

## Charter Amendment Log

- None.

## Verification

- [x] Record offline commands and results.

```text
pnpm typecheck                         pass
pnpm lint                              pass
pnpm format                            pass
pnpm boundaries                        pass
pnpm docs:check                        254 Markdown files
pnpm test:unit                         787/787
pnpm test:conformance                  78/78
pnpm test:integration                  70/70
pnpm test:scenario                     26/26
pnpm build                             pass
```

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes

## Handoff and Follow-ups

- Current state: archived.
- Next recommended step: restart the live workbench on this build before
  a new analysis. Date-only temporal bounds and the 409 views remain
  separate.
- Blockers: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0138_atomic-observation-coverage.md`.
- Restore the task template and add a signed Journal entry.
