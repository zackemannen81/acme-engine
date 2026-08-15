# Current Task

Task ID: ACME-0114
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T12:38:04+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- ADR-0011, ADR-0039, ADR-0040 and ADR-0041
- ACME-0112 and superseded ACME-0113

## Task Summary

Correct the exact offline authority defect exposed by ACME-0113: the model
produced valid unique verbatim quotes but was also asked to author canonical
line locators, and every locator was offset.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Make exact quote selection the model's bounded candidate role while canonical
line locators are derived deterministically and exclusively by runtime.

### Primary Deliverable

ADR-0042 plus active `evidence.observe-artifact@1.3.0` with output schema
`evidence-observe-artifact-output/2`: candidates omit `startLine`/`endLine`,
runtime accepts only a quote that occurs exactly once and derives its canonical
line range; historical contracts `@1.0.0`–`@1.2.0` remain exact for replay.

### In Scope

- Decide and document model/runtime authority, unique-quote refusal semantics
  and replay/version consequences.
- Add a pure canonical-text helper that returns start/end lines only for one
  exact ordinal occurrence and refuses absent or ambiguous quotes.
- Add active output `/2` without locator fields, active contract `@1.3.0`,
  exact-quote-only prompt wording and global unique occurrence validation.
- Preserve/register byte-identical historical request builders for `@1.0.0`,
  `@1.1.0` and `@1.2.0`.
- Derive locators in interpretation before identity, invariant, state and
  product projection; keep resulting canonical observation contracts stable.
- Update active deterministic fixtures/hashes and prove one-line, multi-line,
  absent and duplicate-quote behavior plus wire absence of locator fields.
- Reality-sync durable architecture/status/backlog docs and commit a green
  offline checkpoint.

### Out of Scope

- Any provider/network call, credential use, source preparation or disposable
  hosted infrastructure.
- A fresh real-provider acceptance; it requires a separately frozen successor
  after this checkpoint is green.
- Fuzzy matching, whitespace/punctuation repair or acceptance of non-verbatim
  quotes.
- Multi-call segmentation, exhaustive coverage, relation/assessment changes,
  new source classes, Stage B, deployment, push or release.

### Definition of Done

- Active provider wire schema contains no `startLine`/`endLine` and still
  requires one to eight strict candidates.
- Runtime deterministically derives the exact canonical line range for a
  unique one-line or multi-line quote and refuses absent/duplicate quotes
  before interpretation/commit.
- Historical requests/hashes resolve unchanged; active synthetic observations
  retain their established canonical locators and identities.
- All focused and canonical repository gates pass with no live call.
- Task is documented, archived and committed.

### Minimum Verification Gates

- [x] Focused canonical-text, contract, schema-lowering and replay tests
- [x] Focused Evidence fixture/engine/live-job tests
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

- `docs/finished/ACME-0113_stage-a-bounded-real-provider-acceptance.md`
- `packages/module-evidence/src/canonical-text.ts`
- `packages/module-evidence/src/contracts/observe-artifact.ts`
- `packages/module-evidence/src/tasks/observe-artifact.ts`
- `packages/module-evidence/src/schemas.ts`

## Checklist

- [x] Classify ACME-0113 evidence and freeze this offline corrective charter.
- [x] Write ADR-0042 and accept the runtime locator authority decision.
- [x] Version contract/output schemas.
- [x] Implement deterministic unique-quote locator derivation.
- [x] Register historical/active contracts and update active fixtures.
- [x] Add focused authority, replay, wire and identity tests.
- [x] Run focused then canonical verification.
- [x] Reality-sync documentation, archive and commit the checkpoint.

## Decisions and Notes

- Exact quotes remain untrusted model candidates until strict schema and
  semantic validation prove an exact unique occurrence in canonical text.
- Runtime-derived locators are canonical data; model line estimates are not.
- No fuzzy fallback is allowed because it could bind candidate text to the
  wrong source passage.
- `@1.2.0` cannot be edited after retained live evidence; the correction is
  additive `@1.3.0` and output schema `/2`.
- A successful candidate batch remains explicitly non-exhaustive.
- A checkpoint after each step or substep is required; no live call is allowed
  anywhere in this task.

## Charter Amendment Log

- None.

## Verification

- [x] Focused locator/contract/lowering/fixture/engine/live-composition suite:
  7 files and 33 tests passed. Active request hash is
  `44164c736c8882f8a4218c9f833abb703bcdd1346e2a653e10cb1f4011b8bb47`;
  historical `@1.2.0` remains
  `50a18aa90d3f50ce82902642262731596bcf9eeb9e4e83ba1de65355be3e3db6`,
  `@1.1.0` remains
  `29cdf2eebf1f5c51c5dc618aac573a10f6eea8d526e9f40d6a8621a31bd871ae`
  and `@1.0.0` remains
  `743b53be2522deae2f2507ca9f153e4b0ecdb9f2af1693288713ee1689449004`.
- [x] Active wire schema omits `startLine`/`endLine`; one-line/multi-line
  unique quotes derive exact ranges, absent/duplicate quotes refuse and
  historical locator-bearing output remains interpretable for replay.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm boundaries`, `pnpm build` and exact
  `pnpm test` passed: 750 unit, 78 conformance, 62 integration and 26 scenario
  tests.
- [x] An initial PostgreSQL gate passed 35/36 and exposed one stale active
  injected-provider `/1` fixture. After updating only that fixture to `/2`, its
  isolated file passed 2/2 and final `pnpm test:postgres` passed 36/36 against
  another fresh PostgreSQL 15 container. Every container was removed.
- [x] `pnpm format:check`, `pnpm docs:check` (223 Markdown files) and
  `git diff --check` passed. No live/provider call occurred.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] ADR-0042
- [x] product completion plan and Slice 9 prerequisite checklist

## Handoff and Follow-ups

- Current state: active `@1.3.0` output `/2` and runtime-derived locator
  authority are implemented and green; historical replay remains registered.
- Next recommended step: freeze a separate one-call real-provider acceptance
  under the already approved external 200 SEK prepaid monetary ceiling.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0114_deterministic-observation-locators.md`.
- Restore `docs/CURRENT_TASK.md` from the template.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
