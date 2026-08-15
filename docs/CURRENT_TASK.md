# Current Task

Task ID: ACME-0118
Parent Task: None
Status: In Progress
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T13:19:43+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- ADR-0040 through ADR-0042
- ACME-0116 and superseded ACME-0117

## Task Summary

Remove exact-quote authorship from the active provider contract after
ACME-0117 proved that a strict one-line string can still compress or alter
canonical source text.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Make runtime-defined bounded source segments the sole authority for active
observation exact quotes and locators while preserving all historical replay.

### Primary Deliverable

ADR-0043 plus active `evidence.observe-artifact@1.5.0` output `/4`: the request
labels deterministic non-empty single-line source segments of at most 500
characters, the provider selects `sourceSegmentId`, and runtime derives the
entire exact quote and canonical line locator from that identifier.

### In Scope

- Define deterministic line-preserving segmentation and stable segment IDs.
- Add output `/4` and active `@1.5.0` without provider-authored quote text.
- Derive exact quote, locator, temporal/source-label validation and observation
  identity from the selected runtime segment.
- Preserve contracts `@1.0.0`–`@1.4.0`, outputs `/1`–`/3` and pinned hashes.
- Register all versions, update active fixtures and prove unchanged synthetic
  observation identities when their quotes already equal one source segment.
- Reality-sync documentation and commit a green offline checkpoint.

### Out of Scope

- Provider/network calls, credentials, real source preparation or live state.
- Fuzzy matching, model-authored offsets, multi-line active segments or silent
  repair of historical output.
- Exhaustive coverage, segmentation pagination, relation/assessment changes,
  Stage B, push or deployment.

### Definition of Done

- Active output contains only a valid segment selector plus domain candidate
  fields; exact quote and locator are runtime-derived or the batch refuses.
- Segments are deterministic, non-empty, one canonical line and at most 500
  Unicode code points; no source text is invented or normalized.
- Historical builders, schemas, hashes and replay remain exact/resolvable.
- Focused and canonical gates pass with no live call.
- Task is documented, archived and committed.

### Minimum Verification Gates

- [ ] Focused segment/contract/schema/replay/fixture/engine/live-job tests
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm boundaries`
- [ ] `pnpm test`
- [ ] `pnpm test:postgres`
- [ ] `pnpm build`
- [ ] `pnpm format:check`
- [ ] `pnpm docs:check`
- [ ] `git diff --check`

## References

- `docs/finished/ACME-0117_stage-a-single-line-provider-acceptance.md`
- `packages/module-evidence/src/canonical-text.ts`
- `packages/module-evidence/src/contracts/observe-artifact.ts`
- `packages/module-evidence/src/tasks/observe-artifact.ts`

## Checklist

- [x] Classify ACME-0117 evidence and freeze this offline charter.
- [ ] Accept ADR-0043 and implement deterministic source segments.
- [ ] Version active output/prompt and preserve historical registrations.
- [ ] Derive active quote/locator in semantics and interpretation.
- [ ] Update fixtures and focused tests.
- [ ] Run canonical verification.
- [ ] Reality-sync docs, archive and commit.

## Decisions and Notes

- The provider selects a runtime-authored segment identifier; it does not
  author, normalize or truncate the quote.
- Runtime uses the full selected segment as exact quote. A segment never spans
  canonical LF boundaries; long lines split without changing characters.
- This segment selection is candidate authority, not a coverage claim.
- Historical contracts cannot be edited after retained provider evidence.
- A checkpoint after every substep is required; no live call is allowed.

## Charter Amendment Log

- None.

## Verification

- [ ] Record focused hashes/tests and identity evidence.
- [ ] Record canonical gates and PostgreSQL result.
- [ ] Record docs/hygiene checks.

## Documentation Updates

- [ ] ADR-0043 and ADR index
- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md`
- [ ] product completion plan and Slice 9 prerequisite checklist

## Handoff and Follow-ups

- Current state: ACME-0117 failed closed; all disposable state is gone.
- Next recommended step: implement/verify deterministic segment authority.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0118_runtime-derived-observation-quotes.md`.
- Restore `docs/CURRENT_TASK.md` from the template.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede instead of rewriting it.
