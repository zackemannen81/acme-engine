# Current Task

Task ID: ACME-0134
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/JOURNAL.md`
- ADR-0038, ADR-0041, ADR-0043, ADR-0044 and ADR-0045
- `docs/acceptance/ACME-0133-frozen-acceptance-report.md`

## Task Summary

Implement ADR-0045 sections 2, 3 and 4: raise the observation batch ceiling to
a response-derived bound, admit real investigation files at ingest, and free
the live assessment from requiring a relation.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

The product's own limits no longer cap what one real document can yield.

### Primary Deliverable

An additive active observation contract version with a response-derived
candidate ceiling, ingest bounds sized for real files, an assessment that
proceeds from accepted observations alone, and gates for each.

### In Scope

- Raise `EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX` to a ceiling proven to fit
  inside the contract's output budget, in both prompt and schema.
- Register the change as a new active contract version and keep every
  historical version byte-exact for replay.
- Raise the canonical-text byte and line bounds and the request-body bound so a
  real investigation file can be imported.
- Remove the relation precondition from the live assessment.
- Gates for the ceiling, the raised bounds, replay of historical versions, and
  assessment without relations.

### Out of Scope

- ADR-0045 §5 repair calls. Engine work, own change set, next task.
- ADR-0045 §6 full-source coverage. A workflow, not a constant.
- Segment granularity and the extraction pipeline.
- Any relaxation of quote binding, runtime derivation, schema or semantic
  validation, fail-closed refusal, per-execution bounding, or any ADR-0044 §2
  guardrail.
- Provider calls. This task is verified offline.

### Definition of Done

- One call may return substantially more than eight candidates, and the ceiling
  is provably inside the output budget.
- Historical observation contracts replay byte-exact.
- A document the size of the ACME-0133 refusal imports successfully.
- An assessment proceeds with accepted observations and zero relations.
- Offline gates and a fresh PostgreSQL journey pass.

### Minimum Verification Gates

- [x] Ceiling and output-budget gate
- [x] Historical contract replay gate
- [x] Ingest bound gate at real-file scale
- [ ] Assessment-without-relations gate — not delivered, see Verification
- [x] typecheck, lint, boundaries, test, build, format, docs and diff
- [x] Fresh PostgreSQL journey

## References

- `packages/module-evidence/src/contracts/observe-artifact.ts`
- `packages/evidence-product-contracts/src/ingestion.ts`
- `apps/evidence-workbench-api/src/index.ts` — request-body bound
- `apps/evidence-workbench-api/src/live-assessment.ts`

## Checklist

- [x] Freeze the charter.
- [x] Raise the candidate ceiling as a new active contract version.
- [x] Raise ingest and request-body bounds.
- [x] Decouple assessment from relations.
- [x] Add gates for the ceiling, replay and ingest bounds.
- [x] Run focused and canonical offline verification.
- [x] Reality-sync docs, archive and commit.

## Decisions and Notes

- Evidence from ACME-0133: the model returned exactly eight candidates because
  eight was the schema maximum, from a 100-page report, at 431 output tokens
  against an 8,192 budget. The ceiling was the binding constraint, not the
  model and not the budget.
- 431 output tokens for eight candidates is roughly 54 tokens each, so a
  ceiling of 64 costs about 3,500 tokens and stays well inside 8,192. The gate
  must pin that relationship so a future ceiling raise cannot silently cross
  the budget.
- The ACME-0133 refusal was 3,521,477 canonical bytes over 74,469 lines.
  Bounds must admit that file with headroom.
- Admitting a document is not a claim that one call can analyse it. Coverage is
  ADR-0045 §6 and is deliberately absent here.
- Line-scalar bounds stay: one enormous line is malformed extraction.
- A checkpoint after every substep is required.

## Charter Amendment Log

- None.

## Verification

- [x] `pnpm test:unit` 768/768 across 121 files; `pnpm test:conformance` 78;
      `pnpm test:integration` 62; `pnpm test:scenario` 26.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm boundaries`, `pnpm build`,
      `pnpm format:check`, `pnpm docs:check`, `git diff --check`.
- [x] `pnpm test:postgres` 37/37 on a disposable `postgres:15` created for this
      task and removed afterwards.
- [x] Historical replay is intact. Versions `1.0.0` through `1.6.0` keep the
      eight-candidate ceiling and their own schemas; the registry gate pins all
      eight versions and resolves each contract by ref. The historical
      replay assertions passed unchanged throughout.
- [x] The active contract's request hash moved from
      `f86982f1506410426b0a3b86f59fc90ade36c2b3f389428d083d6078c6a2ab3d` to
      `9d0fa2b9bb28b5d86a4b03cebbf4f5e0704e28ee362d834d029604f4ac4fa229`, which
      is expected for a new version. Six scripted fixture hashes were recomputed
      against `1.7.0` rather than hand-edited, and the integration resume gate
      now derives the hash from the fixture constant instead of duplicating it.
- [x] The ceiling gate asserts the ceiling stays inside the response budget, so
      a future raise cannot silently cross it.
- [ ] **Not delivered: the assessment-without-relations gate.** The change is
      one condition in `live-assessment.ts` and is covered by typecheck and by
      the ADR, but the live assessment path has no offline seam that can be
      exercised without a provider transport, and building one was outside this
      charter. The decoupling is therefore verified by inspection only. This is
      the one Definition-of-Done item this task did not meet.
- [ ] No provider call was made.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/JOURNAL.md`

## Handoff and Follow-ups

- Current state: complete except the assessment gate recorded above.
- The blast radius was larger than the charter assumed: changing the active
  contract moved every scripted fixture that pins its request hash. Seventeen
  gates failed at first and all were traced to that single cause.
- Next task: ADR-0045 §5 repair calls in the execution engine plus non-zero
  repair budgets in the live jobs.
- Then: ADR-0045 §6 full-source coverage workflow.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0134_real-material-scale.md`.
- Restore the task template and add a signed Journal entry.
- Supersede rather than rewrite if the Goal changes.
