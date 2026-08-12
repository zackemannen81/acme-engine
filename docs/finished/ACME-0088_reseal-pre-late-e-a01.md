# ACME-0088 — Re-seal pre-late E-A01 assessment fixture

Task ID: ACME-0088
Parent Task: ACME-0087
Status: Superseded
Owner:
Created: 2026-08-12
Last updated: 2026-08-12
Charter frozen at: 2026-08-12 08:18:26

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/paused/ACME-0087_complete-slice-5-assessment-journey.md`
- `docs/design/evidence-integrity-workbench-technical-specification.md`
- `docs/adr/0028-first-poc-evidence-integrity-workbench.md`
- `docs/adr/0030-evidence-v1-identity-and-canonical-placement.md`
- `docs/adr/0031-evidence-review-overlay-and-versioned-views.md`

## Task Summary

ACME-0087 found that sealed E-A01 references
`BOUNDED_EXACT_TIME_DIFFERENCE`, whose trigger set includes EVAL-E01 even though
the normative journey imports EVAL-E01 only after E-A01 is accepted. This child
task removes that one impossible pre-late reference and re-seals the assessment
identities that deterministically depend on it.

## Task Charter

### Goal

Make the sealed E-A01 fixture fully source-bound to evidence and open questions
available at evidence revision 5 without changing the normative import order.

### Primary Deliverable

A corrected and re-sealed E-A01 fixture whose open-question set contains only
`E-Q03`, plus updated deterministic E-A01 identity vectors and the necessarily
cascading E-A02 identity caused by its predecessor-version reference.

### In Scope

- Remove only `E-Q02` from E-A01's sealed `openQuestionTruthIds`.
- Recompute and pin E-A01 content hash/version ID.
- Recompute E-A02 content hash/version ID only because its predecessor ID is
  content-derived from E-A01; do not change E-A02 claims, citations, questions
  or assessment basis.
- Add a gate proving every E-A01 open question and its triggering evidence are
  available before EVAL-E01.
- Update fixture documentation and persistent status/journal records.

### Out of Scope

- Changing source artifacts, observations, relations or open-question
  semantics.
- Changing the E-A01 claim, citations, basis revision or review expectation.
- Changing E-A02 content except its derived predecessor/identity cascade.
- Moving EVAL-E01 earlier, changing the parent journey or changing product
  implementation/contracts.
- Any authentication, case, ingestion, non-synthetic or Slice 9 work.

### Definition of Done

- E-A01 contains exactly the pre-late open question E-Q03 and no reference
  whose trigger requires EVAL-E01.
- E-A01 and cascading E-A02 identities validate under the existing identity
  algorithms and are pinned by tests/vectors.
- A regression test fails for any future E-A01 open question whose triggering
  observation is absent before EVAL-E01.
- Existing sealed-truth prompt/dependency guards remain green.
- Required focused and repository verification passes, documentation is
  synchronized, this child is archived, and ACME-0087 is restored to
  `In Progress` with its resume evidence.

### Minimum Verification Gates

- [ ] Focused corpus, identity-vector, assessment-candidate and parent
      assessment black-box tests.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm boundaries`,
      `pnpm test`, `pnpm docs:check`, `pnpm build` and `git diff --check`.
- [ ] Record the nested-pnpm wrapper limitation if it recurs; direct Corepack
      execution of the same canonical suites is acceptable evidence.

## References

- `packages/evidence-testing/fixtures/rillford-annex-review-1/evaluation/truth.json`
- `packages/evidence-testing/fixtures/rillford-annex-review-1/identity-vectors.json`
- `packages/evidence-testing/src/golden.ts`
- `packages/evidence-testing/src/evaluation-assessment.ts`
- `packages/evidence-testing/test/evaluation-assessment.test.ts`
- `packages/evidence-testing/test/identity-vectors.test.ts`

## Checklist

- [x] Freeze this child charter to the one sealed-fixture correction approved
      by the user.
- [ ] Add the pre-late source-availability regression assertion.
- [ ] Remove E-Q02 from E-A01 and regenerate deterministic assessment
      identities/vectors.
- [ ] Run focused and full verification.
- [ ] Synchronize docs/JOURNAL, archive ACME-0088 and restore ACME-0087.

## Decisions and Notes

- E-Q03 (`UNOBSERVED_PANEL_TRANSITION`) is available before EVAL-E01 and stays
  in E-A01. E-Q02 (`BOUNDED_EXACT_TIME_DIFFERENCE`) depends on the late log and
  is removed from E-A01 but remains in E-A02.
- E-A02's predecessor assessment version ID is part of its content hash, so
  its derived identity must change even though its semantic assessment content
  is otherwise unchanged.
- This is fixture correction, not a new Evidence domain or product decision;
  no ADR is required.

## Charter Amendment Log

-none

## Verification

- [ ] Record exact commands and results.

## Documentation Updates

- [ ] `packages/evidence-testing/README.md`
- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`

## Handoff and Follow-ups

- Current state: Superseded before implementation. Inspection proved E-Q03
  also depends on late EVAL-E01 observation E-O09 and relation E-R06, so this
  charter's required “retain E-Q03” deliverable cannot satisfy its own goal.
- Replacement: ACME-0089 removes all E-A01 open-question references while
  keeping E-A02's complete post-late question set.
- Blockers: None for the replacement task.
- Resume condition: ACME-0089 completes and restores ACME-0087.

## Finalize When Complete

- Archive this file as `docs/finished/ACME-0088_reseal-pre-late-e-a01.md`.
- Restore ACME-0087 from `docs/paused/` and set it to `In Progress`.
- Add a signed `docs/JOURNAL.md` entry.
