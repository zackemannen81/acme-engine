# ACME-0089 — Re-seal E-A01 without late question references

Task ID: ACME-0089
Parent Task: ACME-0087
Status: Complete
Owner:
Created: 2026-08-12
Last updated: 2026-08-12
Charter frozen at: 2026-08-12 08:18:26

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/paused/ACME-0087_complete-slice-5-assessment-journey.md`
- `docs/finished/ACME-0088_reseal-pre-late-e-a01.md`
- `docs/design/evidence-integrity-workbench-technical-specification.md`
- `docs/adr/0028-first-poc-evidence-integrity-workbench.md`
- `docs/adr/0030-evidence-v1-identity-and-canonical-placement.md`
- `docs/adr/0031-evidence-review-overlay-and-versioned-views.md`

## Task Summary

The final ACME-0087 audit proved every sealed open question currently named by
E-A01 has at least one EVAL-E01-dependent trigger. E-A01 is created before that
source. This replacement child removes those impossible forward references and
re-seals only the assessment identities that deterministically depend on them.

## Task Charter

### Goal

Make sealed E-A01 fully source-bound to the evidence available at revision 5,
without changing the normative import order or Evidence semantics.

### Primary Deliverable

A corrected E-A01 with an empty `openQuestionTruthIds` list, re-pinned E-A01
identity and the necessarily cascading E-A02 identity caused solely by its
predecessor-version reference.

### In Scope

- Set only E-A01 `openQuestionTruthIds` to `[]`.
- Recompute/pin E-A01 content hash and version ID.
- Recompute E-A02 content hash/version ID only because its predecessor ID is
  content-derived; preserve all E-A02 semantic fields.
- Add a gate proving all future E-A01 question triggers are available before
  EVAL-E01 (currently this implies no E-A01 questions).
- Synchronize fixture documentation and persistent project records.

### Out of Scope

- Source, observation, relation, open-question or product-contract changes.
- E-A01 claim/citations/basis/review expectation changes.
- E-A02 semantic content changes beyond the derived predecessor/identity.
- Import-order changes, non-synthetic data, auth/case/Slice 9 work.

### Definition of Done

- E-A01 has no late/future question reference and remains otherwise unchanged.
- E-A01 and cascading E-A02 identities validate and are pinned.
- Regression coverage rejects any future E-A01 question with a trigger based
  on EVAL-E01 observations or relations.
- Prompt/dependency guards and focused/full gates pass.
- The child is archived and ACME-0087 is restored to `In Progress` with resume
  evidence.

### Minimum Verification Gates

- [x] Focused corpus, identity, assessment-candidate and parent black-box tests.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm boundaries`,
      canonical test suites, `pnpm docs:check`, `pnpm build`, `git diff --check`.
- [x] Record the known nested-pnpm wrapper limitation if it recurs.

## Checklist

- [x] Supersede ACME-0088 after its E-Q03 availability assumption was disproven
      before implementation; freeze this corrected replacement charter.
- [x] Add the pre-late question-trigger regression assertion.
- [x] Clear E-A01 questions and re-pin cascading identities.
- [x] Run focused and full verification.
- [x] Update docs/JOURNAL, archive this child and restore ACME-0087.

## Decisions and Notes

- E-Q02 uses E-O09/E-R05; E-Q03 uses E-O09/E-R06. Both require EVAL-E01.
- E-A02 retains E-Q01, E-Q02 and E-Q03 after the late import.
- The change is a sealed-fixture correction under existing algorithms, not a
  new architecture decision; no ADR is required.

## Verification

- [x] Focused Vitest run: 5 files, 10 tests passed (corpus, identity vectors,
      assessment candidates/views and local API black-box).
- [x] `corepack pnpm typecheck`, `lint`, `format:check`, `boundaries`, `build`
      and `docs:check` passed; docs check covered 181 Markdown files.
- [x] Direct canonical suites passed: unit 97 files/657 tests, conformance 11
      files/70 tests, integration 11 files/57 tests and scenario 7 files/26
      tests.
- [x] `git diff --check` passed.
- [x] Root `corepack pnpm test` cannot enter its nested scripts because the
      globally resolved pnpm is 10.33.4 while the repository requires 10.34.5.
      Each of the four scripts it wraps passed directly through Corepack.

## Documentation Updates

- [x] `packages/evidence-testing/README.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`

## Handoff and Follow-ups

- Current state: Complete. E-A01 has no open-question references; E-A02 keeps
  E-Q01/E-Q02/E-Q03 and only its predecessor-derived identity changed.
- Next recommended step: Restore and close ACME-0087.
- Blockers: None.
- Resume condition: Satisfied by the recorded focused and full gates.

## Finalize When Complete

- Archive as `docs/finished/ACME-0089_reseal-e-a01-without-late-questions.md`.
- Restore ACME-0087 and set it to `In Progress`.
- Add a signed JOURNAL entry.
