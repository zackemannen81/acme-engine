# Current Task

Task ID: ACME-0118
Parent Task: None
Status: Complete
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

- [x] Focused segment/contract/schema/replay/fixture/engine/live-job tests
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm boundaries`
- [x] `pnpm test`
- [x] `pnpm test:postgres`
- [x] `pnpm build`
- [x] `pnpm format:check`
- [x] `pnpm docs:check`
- [x] `git diff --check`

## References

- `docs/finished/ACME-0117_stage-a-single-line-provider-acceptance.md`
- `packages/module-evidence/src/canonical-text.ts`
- `packages/module-evidence/src/contracts/observe-artifact.ts`
- `packages/module-evidence/src/tasks/observe-artifact.ts`

## Checklist

- [x] Classify ACME-0117 evidence and freeze this offline charter.
- [x] Accept ADR-0043 and implement deterministic source segments.
- [x] Version active output/prompt and preserve historical registrations.
- [x] Derive active quote/locator in semantics and interpretation.
- [x] Update fixtures and focused tests.
- [x] Run canonical verification.
- [x] Reality-sync docs, archive and commit.

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

- [x] Focused suite: 34 tests. Active request hash
  `827587d11888c53edeef458499ce6c2a409b611f9be9cd10f706512654c11081`;
  historical `@1.4.0` through `@1.0.0` hashes remain
  `f99652e8d7eee64f02ad931ecfc0ba34543a12aa38d8ef2aef6a8eb4a589314f`,
  `44164c736c8882f8a4218c9f833abb703bcdd1346e2a653e10cb1f4011b8bb47`,
  `50a18aa90d3f50ce82902642262731596bcf9eeb9e4e83ba1de65355be3e3db6`,
  `29cdf2eebf1f5c51c5dc618aac573a10f6eea8d526e9f40d6a8621a31bd871ae`
  and `743b53be2522deae2f2507ca9f153e4b0ecdb9f2af1693288713ee1689449004`.
  Development/evaluation scenarios prove unchanged observation identities.
- [x] Canonical gates: typecheck, lint, boundaries and build passed;
  `pnpm test` passed 751 unit, 78 conformance, 62 integration and 26 scenario
  tests; `pnpm test:postgres` passed 36 tests against a fresh disposable
  PostgreSQL 16 container, which was removed.
- [x] `pnpm format:check`, `pnpm docs:check` (228 Markdown files) and
  `git diff --check` passed. The first full unit run identified stale built
  fixture hashes after the source repin; rebuilding package outputs made the
  package-consumer gates use the new active hashes, and the exact full rerun
  passed.

## Documentation Updates

- [x] ADR-0043 and ADR index
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] product completion plan and Slice 9 prerequisite checklist

## Handoff and Follow-ups

- Current state: ADR-0043 and active runtime segment/quote authority are fully
  implemented and verified offline; no live call or credential/source access.
- Next recommended step: freeze a separate one-call real-provider acceptance
  against active `@1.5.0` under the approved monetary ceiling.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0118_runtime-derived-observation-quotes.md`.
- Restore `docs/CURRENT_TASK.md` from the template.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede instead of rewriting it.
