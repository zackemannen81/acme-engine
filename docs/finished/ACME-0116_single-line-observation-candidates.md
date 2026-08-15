# Current Task

Task ID: ACME-0116
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T12:59:50+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- ADR-0039 through ADR-0042
- ACME-0114 and superseded ACME-0115

## Task Summary

Correct the two bounded provider-shape defects exposed by ACME-0115: long
multi-line quotes may normalize whitespace, and a source-visible clock range
without a full date may be emitted as time-only strings against an ISO schema.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Constrain active observation candidates to short single-line verbatim quotes
and make date-less temporal mentions explicitly `unknown` at generation time.

### Primary Deliverable

Active `evidence.observe-artifact@1.4.0` plus output
`evidence-observe-artifact-output/3`: one-to-eight candidates whose exact quote
is one line and at most 500 characters, with an explicit prompt rule that
normalized exact/range/approximate values require a complete date and clock in
that quote; historical `@1.0.0`–`@1.3.0` remain exact for replay.

### In Scope

- Add output `/3` with single-line/max-length exact quotes and active
  `@1.4.0`; preserve output `/1`–`/2` and contracts `@1.0.0`–`@1.3.0`.
- Add exact prompt rules for copying a substring of one canonical line and
  returning temporal `unknown` when a full calendar date is absent.
- Register all five versions at replay-capable composition roots.
- Keep deterministic runtime locator derivation and canonical observation
  identities unchanged for active synthetic fixtures.
- Prove active wire constraints, prompt rules, historical hashes/replay and
  absent/ambiguous quote refusal offline.
- Reality-sync docs and commit a green offline checkpoint.

### Out of Scope

- Provider/network calls, credentials, real source preparation or hosted
  infrastructure.
- General temporal parser redesign or changes to historical synthetic temporal
  identities.
- Whitespace-normalized/fuzzy runtime matching, multi-line active quotes,
  segmentation, completeness, relation/assessment changes, Stage B, push or
  deployment.

### Definition of Done

- Active provider schema rejects newlines, quotes over 500 characters and more
  than eight candidates; prompt states the full-date/clock `unknown` rule.
- Runtime derives unchanged canonical locators/identities from active fixtures.
- Historical request hashes and output interpretation remain exact/resolvable.
- Focused and canonical gates pass with no live call.
- Task is documented, archived and committed.

### Minimum Verification Gates

- [x] Focused contract/schema/wire/replay/fixture/engine/live-job tests
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

- `docs/finished/ACME-0115_stage-a-runtime-locator-provider-acceptance.md`
- `packages/module-evidence/src/schemas.ts`
- `packages/module-evidence/src/contracts/observe-artifact.ts`

## Checklist

- [x] Classify ACME-0115 evidence and freeze this offline charter.
- [x] Version the output and prompt contract additively.
- [x] Register historical/active versions and update fixtures/hashes.
- [x] Add focused shape, prompt, replay and identity tests.
- [x] Run focused and canonical verification.
- [x] Reality-sync docs, archive and commit.

## Decisions and Notes

- Runtime matching remains exact ordinal matching; no whitespace repair enters
  canonical evidence.
- Output `/3` limits candidate selection, not the immutable source text.
- The prompt's temporal rule prevents generation of time-only values; strict
  schema still requires UTC ISO for non-unknown normalized values.
- Historical contracts cannot be edited after retained provider evidence.
- A successful batch remains non-exhaustive.
- A checkpoint after every substep is required; no live call is allowed.

## Charter Amendment Log

- None.

## Verification

- [x] Focused suite: 34 tests. Active request hash
  `f99652e8d7eee64f02ad931ecfc0ba34543a12aa38d8ef2aef6a8eb4a589314f`;
  historical `@1.3.0` through `@1.0.0` hashes remain
  `44164c736c8882f8a4218c9f833abb703bcdd1346e2a653e10cb1f4011b8bb47`,
  `50a18aa90d3f50ce82902642262731596bcf9eeb9e4e83ba1de65355be3e3db6`,
  `29cdf2eebf1f5c51c5dc618aac573a10f6eea8d526e9f40d6a8621a31bd871ae`
  and `743b53be2522deae2f2507ca9f153e4b0ecdb9f2af1693288713ee1689449004`.
- [x] Canonical gates: typecheck, lint, boundaries and build passed;
  `pnpm test` passed 751 unit, 78 conformance, 62 integration and 26 scenario
  tests; `pnpm test:postgres` passed 36 tests against a fresh disposable
  PostgreSQL 16 container, which was removed.
- [x] `pnpm format:check`, `pnpm docs:check` (225 Markdown files) and
  `git diff --check` passed.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] product completion plan and Slice 9 prerequisite checklist

## Handoff and Follow-ups

- Current state: additive active contract is implemented and fully verified
  offline; no live call, source access or credential access occurred.
- Next recommended step: freeze a separate one-call real-provider acceptance
  against active `@1.4.0` under the already approved monetary ceiling.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0116_single-line-observation-candidates.md`.
- Restore `docs/CURRENT_TASK.md` from the template.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede instead of rewriting it.
