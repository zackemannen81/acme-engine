# Current Task

Task ID: ACME-0128
Parent Task: None
Status: Ready
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T18:48:00+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- ACME-0127 and historical ACME-0087/ACME-0110

## Task Summary

Version the assessment prompt so every strict set-like output-array ordering
rule is explicit before the next paid Stage A journey.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Prevent the active assessment provider contract from repeating the relation
schema/prompt ordering defect while preserving all historical replay identity.

### Primary Deliverable

Active `evidence.propose-assessment@1.2.0`, still output `/1`, with historical
`@1.0.0` and `@1.1.0` registered byte-exact plus prompt/hash/replay tests.

### In Scope

- Add an active assessment version/ref and historical `@1.1.0` export.
- In the active prompt only, require every set-like string-ID array to contain
  no duplicates and use ascending lexicographic order.
- Preserve schemas, assessment semantics, identities and historical requests.
- Register all versions in live composition and re-pin active fixtures.
- Run canonical verification, reality-sync docs, archive and commit.

### Out of Scope

- Provider/network calls, runtime sorting/coercion, output schema changes,
  assessment policy changes, relation changes, Stage B, deployment or push.

### Definition of Done

- Active prompt states every ordering rule that strict assessment output `/1`
  can reject.
- Historical `@1.0.0` and `@1.1.0` requests remain byte-exact and resolvable.
- Active fixtures and all canonical gates pass with no live call.
- Task is documented, archived and committed.

### Minimum Verification Gates

- [ ] Focused catalogue/prompt/hash/replay/composition tests
- [ ] typecheck, lint, boundaries, test, PostgreSQL, build, format, docs, diff

## References

- `packages/module-evidence/src/contracts/propose-assessment.ts`
- `packages/module-evidence/src/catalogue.ts`
- `packages/module-evidence/src/schemas.ts`
- `docs/finished/ACME-0127_sorted-relation-provider-output.md`

## Checklist

- [x] Inspect assessment schema/prompt mismatch and freeze bounded successor.
- [x] Version contract and preserve both historical request identities.
- [x] Update registrations, fixtures and focused tests.
- [ ] Run canonical verification.
- [ ] Reality-sync docs, archive and commit.

## Decisions and Notes

- Runtime must not repair/reorder unvalidated provider output.
- Output `/1`, domain semantics and derived identities remain unchanged.
- The prompt covers claim support/conflict/qualification IDs and top-level
  open-question IDs; citations have no strict ordering rule in output `/1`.
- No live opt-in or credential may be loaded.
- A checkpoint after every substep is required.
- Historical `@1.0.0` request hash is
  `2532333356e475a2caa405aaa5eda3867e9682049262f9156590891dd6fd49a0`.
- Historical `@1.1.0` request hash remains
  `a7504dcf2ff5d33578688e9f73d2b3b76e21a7007d22460e094526d047e51c90`.
- Active `@1.2.0` request hash is
  `c4e140c6742d06ab038f87fd323eccc81d96fa52bcde85d5f5bf37a2c342fb48`.
- Focused contract/hash/replay/registry/composition tests pass 17/17.

## Charter Amendment Log

- None.

## Verification

- [ ] Record all historical/active hashes and exact gates.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/PROJECT_BRIEF.md`
- [ ] module README, technical spec, completion plan, Slice 9, Journal/structure

## Handoff and Follow-ups

- Current state: active/historical contracts are implemented and focused gates
  pass; no provider call occurred.
- Next recommended step: run fresh PostgreSQL and canonical verification.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0128_sorted-assessment-provider-output.md`.
- Restore task template and add signed Journal entry.
- Supersede rather than rewrite if Goal changes.
