# Current Task

Task ID: ACME-0120
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T13:44:51+02:00

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
- ACME-0118 and superseded ACME-0119

## Task Summary

Correct the bounded temporal formatting defect exposed by ACME-0119 without
changing segment authority or historical replay.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Make the active prompt state the literal accepted canonical UTC timestamp
grammar and require temporal `unknown` whenever it cannot be emitted.

### Primary Deliverable

Active `evidence.observe-artifact@1.6.0`, still output `/4`, with explicit
`YYYY-MM-DDTHH:MM:SSZ` or `YYYY-MM-DDTHH:MM:SS.sssZ` instructions; historical
`@1.0.0`–`@1.5.0` remain byte-exact and registered.

### In Scope

- Add active prompt version and historical `@1.5.0` registration.
- Preserve output `/4`, segment derivation, identities and all old hashes.
- Re-pin active fixture hashes and prove wire/prompt/replay offline.
- Run canonical verification, reality-sync docs and commit.

### Out of Scope

- Provider/network calls, timestamp parser/coercion, timezone assumptions,
  output schema changes, relations/assessment, coverage, Stage B or push.

### Definition of Done

- Prompt names seconds plus terminal `Z`, forbids minute-only/local/offset
  normalized values and requires `unknown` instead.
- Historical request hashes remain exact and all versions resolve.
- Focused/canonical gates pass with no live call; task archived/committed.

### Minimum Verification Gates

- [x] Focused prompt/hash/replay/fixture/live-composition tests
- [x] typecheck, lint, boundaries, test, PostgreSQL, build, format, docs, diff

## References

- `docs/finished/ACME-0119_stage-a-segment-provider-acceptance.md`
- `packages/module-evidence/src/contracts/observe-artifact.ts`

## Checklist

- [x] Freeze offline successor.
- [x] Version contract/prompt and preserve replay.
- [x] Update fixtures/tests.
- [x] Run canonical verification.
- [x] Reality-sync docs, archive and commit.

## Decisions and Notes

- No timestamp repair/coercion enters runtime; invalid values still fail closed.
- Output `/4` and ADR-0043 remain unchanged.
- A checkpoint after every substep is required; no live call is allowed.

## Charter Amendment Log

- None.

## Verification

- [x] Focused 23 tests; active hash
  `f86982f1506410426b0a3b86f59fc90ade36c2b3f389428d083d6078c6a2ab3d`;
  historical `@1.5.0` hash remains
  `827587d11888c53edeef458499ce6c2a409b611f9be9cd10f706512654c11081`.
- [x] Typecheck/lint/boundaries/build; 751 unit, 78 conformance, 62
  integration, 26 scenario; fresh PostgreSQL 36/36.
- [x] Format/docs/diff passed. Initial full unit run hit known async workbench
  teardown; isolated 9/9 and exact full rerun passed. Initial PostgreSQL run
  had one transient parallel fixture parse failure; isolated 2/2 and exact
  fresh full rerun 36/36 passed. All containers removed.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`, completion plan and Slice 9 checklist

## Handoff and Follow-ups

- Current state: active `@1.6.0` prompt version is fully green offline.
- Next recommended step: freeze a separate one-call provider acceptance.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0120_canonical-utc-observation-prompt.md`.
- Restore template; add signed Journal entry; supersede if Goal changes.
