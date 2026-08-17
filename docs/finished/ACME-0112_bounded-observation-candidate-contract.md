# Current Task

Task ID: ACME-0112
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T12:11:10+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- ADR-0011, ADR-0039 and ADR-0040
- ACME-0107 and superseded ACME-0111

## Task Summary

Correct the exact offline contract defect exposed by ACME-0111: the active
observation prompt allowed an unbounded candidate array while requesting only
2,048 output tokens, so a valid real-provider response was cut off before it
could become strict JSON.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Make each observation operation a bounded, replay-compatible candidate batch
whose strict structured output can complete within the already declared live
gateway output capability.

### Primary Deliverable

ADR-0041 plus active `evidence.observe-artifact@1.2.0`: one to eight explicitly
non-exhaustive observation candidates and an 8,192-output-token request, while
historical `@1.0.0` and `@1.1.0` remain registered byte-for-byte for replay.

### In Scope

- Decide and document the per-operation candidate-batch boundary, its
  non-exhaustive meaning and future completeness/chunking consequence.
- Add active observation prompt contract `@1.2.0` with one-to-eight candidate
  validation, explicit selection wording and `maxOutputTokens = 8192`.
- Retain the exact historical synthetic `@1.0.0` and source-neutral `@1.1.0`
  request builders and register all three wherever replay can resolve them.
- Prove active schema lowering preserves `minItems = 1` and `maxItems = 8`,
  request budget is 8,192, nine candidates refuse and historical request
  hashes remain resolvable.
- Re-pin only active deterministic fixture hashes necessarily changed by the
  new contract.
- Reality-sync durable architecture/status/backlog docs and commit a green
  offline checkpoint.

### Out of Scope

- Any provider/network call, credential use, source preparation or disposable
  hosted infrastructure.
- A fresh real-provider acceptance; that requires a separately frozen task
  after this checkpoint is green.
- Multi-call pagination, automatic source chunking, exhaustive extraction or a
  completeness claim.
- Relation/assessment contract changes, new source classes, Stage B, export,
  deployment, push or release.
- Raising or interpreting the external 200 SEK prepaid monetary ceiling.

### Definition of Done

- Active contract/wire schema makes a one-to-eight candidate batch explicit
  and cannot accept a ninth candidate.
- Active request asks for 8,192 output tokens; historical 1.0/1.1 builders and
  registry resolution remain unchanged and tested.
- Default synthetic fixtures, engine integration, live-job injected transport,
  PostgreSQL restart and all canonical repository gates stay green.
- Documentation states that a batch is non-exhaustive and a successful batch
  does not prove full-document coverage.
- Task is archived and committed with no secret/source/live artifacts.

### Minimum Verification Gates

- [x] Focused observation contract, lowering and registry tests
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

- `docs/finished/ACME-0111_stage-a-real-provider-acceptance.md`
- `packages/module-evidence/src/contracts/observe-artifact.ts`
- `packages/module-evidence/src/catalogue.ts`
- `packages/adapter-model-openai/src/schema-lower.ts`
- `apps/evidence-workbench-api/src/live-observation.ts`

## Checklist

- [x] Classify ACME-0111 evidence and freeze this bounded corrective charter.
- [x] Write ADR-0041 and version the observation prompt contract.
- [x] Register historical/active versions and update deterministic fixtures.
- [x] Add focused batch, wire-lowering, replay and refusal tests.
- [x] Run focused then canonical verification.
- [x] Reality-sync documentation, archive and commit the checkpoint.

## Decisions and Notes

- The provider's 2,048 output tokens are unrelated to the 200 SEK monetary pot.
- Eight candidates are a bounded reviewer batch, not an assertion that the
  source contains only eight material observations.
- `@1.1.0` cannot be edited because its prior request hash and retained model
  evidence must stay replayable; the correction is additive `@1.2.0`.
- 8,192 matches the live gateway's already declared maximum output capability
  and keeps a single operation bounded.
- A checkpoint after each step or substep is required; no live call is allowed
  anywhere in this task.

## Charter Amendment Log

- None.

## Verification

- [x] Focused observation/lowering/fixture/engine/live-composition suite: 7
  files and 31 tests passed. Active request hash is
  `50a18aa90d3f50ce82902642262731596bcf9eeb9e4e83ba1de65355be3e3db6`;
  historical `@1.1.0` remains
  `29cdf2eebf1f5c51c5dc618aac573a10f6eea8d526e9f40d6a8621a31bd871ae`
  and `@1.0.0` remains
  `743b53be2522deae2f2507ca9f153e4b0ecdb9f2af1693288713ee1689449004`.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm boundaries`, `pnpm build` and the
  exact `pnpm test` gate passed. The final test gate reported 118 files and
  748 tests, followed by 78 conformance, 62 integration and 26 scenario tests.
- [x] `pnpm test:postgres` passed 36 tests in 7 files against a fresh temporary
  PostgreSQL 15 container, which was stopped and removed after the gate.
- [x] `pnpm format:check`, `pnpm docs:check` and `git diff --check` passed.
  The first full-suite attempt had already passed all 748 tests but exited on
  an unrelated asynchronous workbench teardown rejection; its affected file
  then passed 9/9 alone and the exact full gate passed cleanly on rerun.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] ADR-0041
- [x] product completion plan and Slice 9 prerequisite checklist

## Handoff and Follow-ups

- Current state: the active bounded `@1.2.0` contract and all replay registries
  are implemented and green; no provider call occurred in this task.
- Next recommended step: freeze a separate one-call real-provider acceptance
  task using the active contract and the already approved external 200 SEK
  prepaid monetary ceiling.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0112_bounded-observation-candidate-contract.md`.
- Restore `docs/CURRENT_TASK.md` from the template.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
