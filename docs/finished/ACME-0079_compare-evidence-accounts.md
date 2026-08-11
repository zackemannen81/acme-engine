# ACME-0079 — Compare evidence accounts

Task ID: ACME-0079
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-11
Last updated: 2026-08-11
Charter frozen at: 2026-08-11

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/design/evidence-integrity-workbench-technical-specification.md`
- `docs/design/evidence-integrity-workbench-product-definition.md`
- `docs/adr/0030-evidence-v1-identity-and-canonical-placement.md`
- `docs/adr/0031-evidence-review-overlay-and-versioned-views.md`
- ADR-0008, ADR-0010, ADR-0012 and ADR-0017

## Task Summary

A task is never considered done until `docs/JOURNAL.md`, `docs/SYSTEMDOC.md`
and `docs/CURRENT_STATUS.md` are à jour.

Implement Evidence Integrity Workbench slice 2: an offline account-comparison
journey over the sealed synthetic evaluation sources. A reviewer can see the
two versions of `EVAL-T01` beside the later `EVAL-T02` account, distinguish an
explicit transcription correction from a changed later account, inspect every
prior source version and verify that no observation was overwritten.

## Task Charter

The charter is frozen. Discoveries follow `docs/TASK_WORKFLOW.md` and may not
expand this task into general relation analysis or later Evidence slices.

### Goal

Deliver a deterministic, source-navigable account comparison that proves
correction supersession and changed-account preservation without exposing
sealed evaluation truth to prompt construction.

### Primary Deliverable

An offline local Evidence Workbench composition that observes the complete
sealed evaluation source set with fixed mock responses, projects exactly two
explicit correction-lineage supersessions while retaining every immutable
observation, and renders versioned observation-ledger and account-comparison
primary views with complete prior-version navigation.

### In Scope

- Add a sealed evaluation candidate-response harness whose prompt path can
  read source text but cannot import sealed truth; load truth only after all
  candidate generation and domain validation for scoring.
- Extend Evidence observation state projection with conservative V1
  correction pairing over an explicit adjacent artifact-version lineage;
  refuse missing, ambiguous, cross-artifact or changed-account supersession.
- Prove the mechanical `E-R01` and `E-R02` correction pairs and the final
  observation standing projection of exactly eight current and two
  superseded evaluation observations.
- Add pure `evidence-primary-observation-ledger-view/1` and
  `evidence-primary-account-comparison-view/1` contracts/builders, classified
  as primary-domain and free of forbidden technical vocabulary.
- Expose product API/web navigation for the observation ledger, corrected
  transcript lineage, later changed account and every immutable source
  version, with technical audit still disabled.
- Add a bounded local evaluation seed mode using only the existing synthetic
  corpus and deterministic model mock; retain the slice-1 development mode.
- Prove exact duplicate import idempotency with no new provider call,
  observation, standing change or Evidence revision.
- Add focused unit, view-conformance, integration and scenario tests plus
  local run instructions and governing documentation.

### Out of Scope

- General `evidence.relate-observations@1.0.0`, contradiction, qualification,
  scope-mismatch or unresolved-relation review; those begin in slice 3.
- Changing later-account observations to `contested`; before slice-3 relation
  review they remain `current` and are merely shown as changed accounts.
- Timeline, open questions, assessments, new-evidence attention, re-review,
  export or technical-audit views from later slices.
- Live provider execution, model/config comparison, external acquisition,
  provider spend or any non-synthetic/real data.
- PostgreSQL/Supabase, object storage, authentication, hosting, deployment or
  cross-process distributed workers.
- Changes to `packages/core`, existing repository contracts, Domain Test UI
  behavior or accepted ADR meanings.

### Definition of Done

- The unchanged `evidence.observe-artifact@1.0.0` contract processes all five
  sealed evaluation artifact versions through deterministic mock responses;
  sealed truth is loaded only afterward and all ten expected observation ids
  match.
- Processing corrected `EVAL-T01` v2 marks only its two exact predecessor
  occurrences superseded, creates both successors as current in the same
  revision and proves the `E-R01`/`E-R02` pairings.
- Processing `EVAL-T02` and the remaining evaluation sources never
  supersedes a changed account; final observation standings are exactly eight
  current and two superseded, with all ten immutable records retained.
- Identical import-command reuse and exact re-execution are idempotent with no
  new provider call, observation, standing change or revision; divergent reuse
  and invalid/ambiguous correction pairing are refused.
- Observation-ledger and account-comparison views are pure, detached,
  deterministic, primary-domain classified and expose exact citations,
  correction versus changed-account labels, standings and navigation to every
  relevant source version without forbidden primary vocabulary.
- A local black-box browser/API path shows the corrected transcript and later
  account without technical routes/navigation, raw database access, CLI or
  sealed truth in browser payloads.
- Required tests and documentation pass, ACME-0079 is archived and
  `docs/CURRENT_TASK.md` returns to the real next state.

### Minimum Verification Gates

- [x] `corepack pnpm install --offline` if workspace metadata changes.
- [x] `corepack pnpm typecheck`.
- [x] `corepack pnpm lint`.
- [x] `corepack pnpm format:check`.
- [x] `corepack pnpm boundaries` including sealed-truth prompt guard.
- [x] `corepack pnpm test` including unit, conformance, integration and
  scenario gates.
- [x] `corepack pnpm docs:check`.
- [x] `corepack pnpm build`.
- [x] Exact ten-observation and 8-current/2-superseded evaluation gate.
- [x] `E-R01`/`E-R02`, changed-account refusal and invalid-lineage negatives.
- [x] Duplicate-import/provider-count and complete prior-navigation gates.
- [x] Primary-view conformance and forbidden-vocabulary scan.
- [x] Confirm no live/provider/network-backed corpus path or spend.
- [x] Browser smoke test with technical audit disabled.
- [x] `git diff --check`; preserve unrelated user changes and the existing
  local slice-1 review data.

## References

- `docs/design/evidence-integrity-workbench-technical-specification.md`, slice 2
- `packages/module-evidence/src/tasks/observe-artifact.ts`
- `packages/evidence-testing/src/evaluation.ts`
- `packages/evidence-views/`
- `apps/evidence-workbench-api/`
- `docs/adr/0030-evidence-v1-identity-and-canonical-placement.md`
- `docs/adr/0031-evidence-review-overlay-and-versioned-views.md`

## Checklist

- [x] Activate and freeze ACME-0079 from the accepted slice-2 plan.
- [x] Inspect correction projection, sealed harness, view and local
  composition boundaries.
- [x] Implement correction pairing and standing projection.
- [x] Author deterministic sealed candidate responses and post-generation
  evaluation harness.
- [x] Implement observation-ledger and account-comparison primary views.
- [x] Extend product API/web and local evaluation seed mode.
- [x] Add unit/conformance/integration/scenario tests and negative fixtures.
- [x] Synchronize documentation and local run instructions.
- [x] Run every verification gate, journal, archive and restore task state.

## Decisions and Notes

- Slice 0/1, ADR-0030 and ADR-0031 are frozen authority. The task may add
  implementation detail but cannot change identity, review or source-binding
  semantics.
- `evidence.observe-artifact@1.0.0` remains a closed observation-only model
  contract. Correction pairing is deterministic domain projection over
  already validated observations and explicit source-version lineage; the
  model cannot request supersession.
- A later distinct logical artifact is never correction lineage, even when it
  uses the same actor and similar line positions.
- The local evaluation harness may supply fixed response candidates. It may
  import `@acme/evidence-testing/evaluation` only after all engine executions
  have completed, never while building a prompt or response fixture.
- A checkpoint after every substantive step is required.

## Charter Amendment Log

- none

## Verification

- [x] Correction/state unit and negative tests.
- [x] Sealed harness output-to-truth comparison after candidate generation.
- [x] View purity, vocabulary and complete-navigation conformance.
- [x] Product black-box, duplicate and provider-invocation review.
- [x] Full repository verification gates.
- [x] Record exact skipped checks and reasons: none skipped.

## Documentation Updates

- [x] `packages/module-evidence/README.md`
- [x] `packages/evidence-testing/README.md`
- [x] local Evidence Workbench run instructions
- [x] `docs/design/evidence-integrity-workbench-technical-specification.md`
  only for non-semantic implementation clarification/status
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] ADR review: ADR-0032 records the shared correction-pairing boundary.

## Handoff and Follow-ups

- Current state: Complete; all acceptance and verification gates passed.
- Next recommended step: activate slice 3 for general observation relations.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none for this slice.

## Finalize When Complete

- Archive as `docs/finished/ACME-0079_compare-evidence-accounts.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md` unless a
  next task is explicitly approved.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done becomes invalid, supersede the task instead of
  rewriting it.
