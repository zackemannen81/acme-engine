# Current Task

Task ID: ACME-0127
Parent Task: None
Status: Ready
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

- [ ] Focused catalogue/prompt/hash/replay/composition tests
- [ ] typecheck, lint, boundaries, test, PostgreSQL, build, format, docs, diff

## References

- `packages/module-evidence/src/contracts/relate-observations.ts`
- `packages/module-evidence/src/catalogue.ts`
- `docs/finished/ACME-0126_stage-a-typed-reviewer-acceptance.md`

## Checklist

- [x] Freeze offline relation-prompt successor.
- [ ] Version contract and preserve historical replay.
- [ ] Update registrations, fixtures and focused tests.
- [ ] Run canonical verification.
- [ ] Reality-sync docs, archive and commit.

## Decisions and Notes

- Runtime must not repair/reorder unvalidated provider output.
- Output `/1`, domain semantics and identities remain unchanged.
- The prompt covers propositions, events, comparable-scope arrays,
  open-question triggers and relation endpoints.
- No live opt-in or credential may be loaded.
- A checkpoint after every substep is required.

## Charter Amendment Log

- None.

## Verification

- [ ] Record old/new hashes and exact gates.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/PROJECT_BRIEF.md`
- [ ] module README, technical spec, completion plan, Slice 9, Journal/structure

## Handoff and Follow-ups

- Current state: task frozen; no code change and no provider call.
- Next recommended step: implement versioned contract factory/tests.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0127_sorted-relation-provider-output.md`.
- Restore task template and add signed Journal entry.
- Supersede rather than rewrite if Goal changes.
