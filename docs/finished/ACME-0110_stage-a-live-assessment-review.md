# Current Task

Task ID: ACME-0110
Parent Task: ACME-0109
Status: Complete
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T03:47:12+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- ADR-0016, ADR-0017, ADR-0027, ADR-0035 through ADR-0040
- ACME-0109 superseded charter and ACME-0107/0108 live implementations

## Task Summary

Complete the Stage A candidate pipeline with restart-safe live assessment and
prove the primary human-review/late-evidence reassessment journey. This
corrects ACME-0109 by preserving product evidence revision when an assessment
is proposed, matching the accepted assessment state contract.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Let an authorized Stage A case produce, review and revisit a source-complete
assessment through the primary browser while preserving candidate-not-truth,
case isolation and restart-safe one-call execution.

### Primary Deliverable

An authenticated case-first live assessment job that snapshots current typed
case evidence server-side, commits one validated assessment atomically without
changing product evidence revision, and participates in the existing append-
only review, attention and reassessment journey after later evidence arrives.

### In Scope

- Add a source-complete assessment input/contract version for authorized Stage
  A evidence while retaining the historical synthetic contract for replay.
- Add compatible versioned command/job/audit contracts for live
  `propose-assessment` while retaining earlier records.
- Derive workspace, principal, accepted current observations/relations, open
  questions, predecessor, sequence and evidence revision only on the server.
- Require `evidence-poc1-live/1`, exact case confirmation, case-admin
  authorization and one-call/deployment budget.
- Execute through durable PostgreSQL and encrypted-payload retention with
  deterministic exact-command resume.
- Atomically project the validated assessment and case binding only after
  engine commit while leaving product evidence revision unchanged.
- Expose launch/progress/result through the primary browser and reuse existing
  review, history, attention and source-navigation views.
- Prove initial review, later Stage A evidence attention and immutable
  reassessment without synthetic seeding or caller-supplied evidence.
- Prove refusal, budget, credential hygiene, cross-case isolation, default
  synthetic isolation and PostgreSQL restart/no-second-call behavior.
- Reality-sync and commit this task as a green checkpoint.

### Out of Scope

- Real paid provider acceptance; it requires a process credential and an
  explicitly approved spend ceiling after this engineering checkpoint.
- Stage B FUP, arbitrary ingestion, a new data class or broader authority.
- Non-synthetic assessment export; Stage A completion ends at review and
  reassessment under the current export policy.
- New assessment meanings or changes to sealed assessment outputs.
- Browser-supplied evidence, state, identity, source text, predecessor,
  sequence or provider credential.
- General workflow scheduling or cumulative accounting across jobs.

### Definition of Done

- A case admin launches assessment in the primary browser after accepted Stage
  A observation/relation evidence exists.
- Missing capability, authorization/evidence, wrong case, credential payload
  or excess budget refuses before transport and remains non-disclosing.
- Provider input contains only one authorized case's server-derived,
  source-complete accepted typed evidence.
- Success stores one typed case-bound assessment atomically while preserving
  product evidence revision; failure stores no partial assessment.
- Full PostgreSQL restart after provider success completes from encrypted
  retained evidence with one cumulative call and identical assessment id.
- Primary browser/API proof covers review, immutable history, later-evidence
  attention and a reviewed successor assessment.
- Default synthetic behavior stays green; canonical gates pass; task is
  archived and committed.

### Minimum Verification Gates

- [x] Focused module/worker/API/browser live-assessment tests
- [x] Injected-transport refusal/budget/audit/case-isolation proof
- [x] PostgreSQL full-restart/no-second-call proof
- [x] Primary review/late-evidence/reassessment product proof
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

- `docs/adr/0016-encrypted-payload-retention.md`
- `docs/adr/0017-durable-execution-resume.md`
- `docs/adr/0027-async-launch-job-progress-cancellation.md`
- `docs/adr/0039-evidence-workbench-live-model-boundary.md`
- `docs/adr/0040-poc-1-live-product-applicability.md`
- `apps/evidence-workbench-api/src/live-relation.ts`
- `apps/evidence-workbench-worker/src/index.ts`
- `packages/module-evidence/src/contracts/propose-assessment.ts`

## Checklist

- [x] Read authority, supersede invalid parent and freeze corrected charter.
- [x] Inventory assessment input/state/product review and attention seams.
- [x] Version source-complete assessment input and prompt contract.
- [x] Implement compatible live assessment command/job/audit contracts.
- [x] Implement authorized, budgeted and restart-safe assessment execution.
- [x] Add authenticated case-first API and primary browser flow.
- [x] Prove refusal, source completeness, atomic projection and default isolation.
- [x] Prove PostgreSQL restart resumes without a second provider call.
- [x] Prove primary review, late-evidence attention and reassessment.
- [x] Run canonical verification and reality-sync documentation.
- [x] Archive and commit the completed task.

## Decisions and Notes

- ADR-0039/0040 already authorize the existing assessment task; no new ADR is
  expected.
- Product `evidenceRevision` changes only when source evidence changes.
  Assessment proposal advances the engine ledger's state revision but not the
  product evidence revision.
- Historical synthetic assessment input/contract remains registered for replay.
  The additive live-capable input carries full typed evidence because IDs alone
  are not source-complete provider input.
- This checkpoint makes zero paid calls and uses injected transport.
- Human review remains append-only after model execution; a model never
  approves its own assessment.
- Inventory exposed and corrected a required Stage A revision-alignment defect:
  import already owns the source revision, so live observation now verifies and
  reuses that revision instead of counting the same source twice.

## Charter Amendment Log

- None.

## Verification

- Focused module/web/API suite: 11 tests passed.
- Focused PostgreSQL Stage A suite: 2 tests passed, including assessment
  refusal, source-complete provider input, post-engine interruption, full
  process restart with no second call, human review, another imported/observed
  Stage A source, attention and a reviewed successor assessment.
- `pnpm typecheck`, `pnpm lint`, `pnpm boundaries`: passed.
- `pnpm test`: passed — 745 unit, 78 conformance, 62 integration and 26
  scenario tests.
- `pnpm test:postgres`: 36 tests passed against a fresh PostgreSQL database.
- `pnpm build`, `pnpm format:check`, `pnpm docs:check`, `git diff --check`:
  passed.
- No real paid call ran; no `OPENAI_API_KEY` or approved spend ceiling was
  available.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] completion plan and Slice 9 live-job rows
- [x] ADRs only if a new durable decision is discovered — none was required.

## Handoff and Follow-ups

- Current state: Stage A engineering is complete through durable reviewed
  reassessment with injected transport and PostgreSQL restart proof.
- Next recommended step: execute the existing opt-in real-provider acceptance
  only after a process credential and explicit spend ceiling are supplied.
- Blockers: real-provider acceptance lacks both required external inputs.
- Child tasks: none.
- Resume condition: ACME-0110 is complete and archived.
- Open questions: none that block the corrected deliverable.

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0110_stage-a-live-assessment-review.md`.
- Restore `docs/CURRENT_TASK.md` from the template or populate the next
  explicitly approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
