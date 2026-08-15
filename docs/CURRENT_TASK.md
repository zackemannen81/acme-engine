# Current Task

Task ID: ACME-0120
Parent Task: None
Status: In Progress
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

- [ ] Focused prompt/hash/replay/fixture/live-composition tests
- [ ] typecheck, lint, boundaries, test, PostgreSQL, build, format, docs, diff

## References

- `docs/finished/ACME-0119_stage-a-segment-provider-acceptance.md`
- `packages/module-evidence/src/contracts/observe-artifact.ts`

## Checklist

- [x] Freeze offline successor.
- [ ] Version contract/prompt and preserve replay.
- [ ] Update fixtures/tests.
- [ ] Run canonical verification.
- [ ] Reality-sync docs, archive and commit.

## Decisions and Notes

- No timestamp repair/coercion enters runtime; invalid values still fail closed.
- Output `/4` and ADR-0043 remain unchanged.
- A checkpoint after every substep is required; no live call is allowed.

## Charter Amendment Log

- None.

## Verification

- [ ] Record hashes/focused tests.
- [ ] Record canonical gates/PostgreSQL.
- [ ] Record docs/hygiene.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md`, completion plan and Slice 9 checklist

## Handoff and Follow-ups

- Current state: ACME-0119 failed closed; all disposable state is gone.
- Next recommended step: implement/verify the prompt version offline.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0120_canonical-utc-observation-prompt.md`.
- Restore template; add signed Journal entry; supersede if Goal changes.
