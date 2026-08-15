# Current Task

Task ID: ACME-0127
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T18:37:00+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- ACME-0126 and historical ACME-0080

## Task Summary

Version the relation prompt so the provider is explicitly told every strict
set-like array ordering rule exposed by ACME-0126.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Make active relation candidates state lexical sort/uniqueness and endpoint
ordering requirements without runtime coercion or historical replay drift.

### Primary Deliverable

Active `evidence.relate-observations@1.1.0`, still output `/1`, with historical
`@1.0.0` registered byte-exact and prompt/hash/replay tests for both.

### In Scope

- Add active relation version/ref and historical `@1.0.0` contract export.
- In active prompt only, require unique lexically sorted set-like string arrays
  and distinct endpoints sorted by kind then id.
- Preserve schemas, semantics, identities and historical request hash.
- Register both versions in live composition and re-pin active fixtures.
- Run canonical verification, reality-sync docs and commit.

### Out of Scope

- Provider/network calls, runtime sorting/coercion, output schema changes,
  relation policy changes, assessment prompt changes, Stage B or push.

### Definition of Done

- Active prompt states every ordering rule that can fail schema/semantics.
- Historical `@1.0.0` request remains byte-exact and resolvable for replay.
- Active fixtures and all canonical gates pass with no live call.
- Task is documented, archived and committed.

### Minimum Verification Gates

- [x] Focused catalogue/prompt/hash/replay/composition tests
- [x] typecheck, lint, boundaries, test, PostgreSQL, build, format, docs, diff

## References

- `packages/module-evidence/src/contracts/relate-observations.ts`
- `packages/module-evidence/src/catalogue.ts`
- `docs/finished/ACME-0126_stage-a-typed-reviewer-acceptance.md`

## Checklist

- [x] Freeze offline relation-prompt successor.
- [x] Version contract and preserve historical replay.
- [x] Update registrations, fixtures and focused tests.
- [x] Run canonical verification.
- [x] Reality-sync docs, archive and commit.

## Decisions and Notes

- Runtime must not repair/reorder unvalidated provider output.
- Output `/1`, domain semantics and identities remain unchanged.
- The prompt covers propositions, events, comparable-scope arrays,
  open-question triggers and relation endpoints.
- No live opt-in or credential may be loaded.
- A checkpoint after every substep is required.
- Active request hash is
  `1f49ca0835d94ab9236ea5a53aa1650f07a53454c94aacf94f16ccbac1b89f4f`;
  historical `@1.0.0` remains
  `9c4f7a883a6363d0a652f5d90e603e610d5969715069079ed1fdd5c3516815b0`.
  Focused type/prompt/hash/registry/module/scenario/composition tests pass 15/15.

## Charter Amendment Log

- None.

## Verification

- [x] Focused contract/catalogue/hash/replay/composition tests: 15/15.
- [x] Active request hash:
  `1f49ca0835d94ab9236ea5a53aa1650f07a53454c94aacf94f16ccbac1b89f4f`.
- [x] Historical `@1.0.0` request hash remains:
  `9c4f7a883a6363d0a652f5d90e603e610d5969715069079ed1fdd5c3516815b0`.
- [x] Typecheck, lint, boundaries and build passed.
- [x] Full default suites passed: 752 unit, 78 conformance, 62 integration
  and 26 scenario tests.
- [x] Fresh PostgreSQL suite passed 36/36.
- [x] Format, docs and `git diff --check` passed.
- [x] No provider call or credential load occurred.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/PROJECT_BRIEF.md`
- [x] module README, technical spec, completion plan, Slice 9, Journal/structure

## Handoff and Follow-ups

- Current state: active `@1.1.0` and historical `@1.0.0` contracts are
  registered, hash-pinned and green across all canonical gates; no provider
  call occurred.
- Next recommended step: inspect the assessment prompt for the same strict
  set-ordering dependency, then freeze a separately bounded live journey.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0127_sorted-relation-provider-output.md`.
- Restore task template and add signed Journal entry.
- Supersede rather than rewrite if Goal changes.
