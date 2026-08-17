# Current Task

Task ID: ACME-0109
Parent Task: None
Status: Superseded
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T03:43:59+02:00

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
- ACME-0107 and ACME-0108 archived tasks and live execution implementations

## Task Summary

Complete the Stage A candidate pipeline by adding restart-safe live assessment
proposal over the case's committed observation/relation evidence, then prove
that the existing primary human-review and late-evidence reassessment journey
works without synthetic seeding or caller-supplied evidence.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Let an authorized Stage A case produce, review and revisit a source-complete
assessment through the primary browser while preserving candidate-not-truth,
case isolation and restart-safe one-call execution.

### Primary Deliverable

An authenticated case-first live assessment job that snapshots the current
typed case evidence server-side, commits one validated assessment atomically,
and participates in the existing append-only review/attention/reassessment
journey after later Stage A evidence arrives.

### In Scope

- Add compatible versioned command/job/audit contracts for live
  `propose-assessment` while retaining all synthetic and earlier live records.
- Derive workspace, principal, current observations, relations, open questions,
  prior assessment history and evidence revision exclusively on the server.
- Require the existing `evidence-poc1-live/1` capability, exact case
  confirmation, case-admin authorization and one-call/deployment budget.
- Execute the existing strict assessment contract through durable PostgreSQL
  and encrypted-payload retention with deterministic exact-command resume.
- Atomically project the validated, source-complete assessment and one product
  revision advance only after engine commit.
- Expose launch/progress/result through the primary browser and reuse existing
  assessment review, history, attention and source-navigation views.
- Prove an initial assessment can be reviewed, later Stage A evidence becomes
  visible attention, and a new assessment can be reviewed without mutating the
  earlier assessment or review decision.
- Prove refusal, budget, credential hygiene, cross-case isolation, default
  synthetic isolation and full PostgreSQL restart/no-second-call behavior.
- Reality-sync and commit this task as its own green checkpoint.

### Out of Scope

- Real paid provider acceptance; that requires a process credential and an
  explicitly approved spend ceiling after this engineering checkpoint.
- Stage B FUP, arbitrary ingestion, a new data class or broader provider/data
  authority.
- Exporting non-synthetic assessment output or changing the per-case export
  policy; current Stage A product proof ends at review/reassessment.
- New assessment semantics, prompt redesign or sealed synthetic fixture changes.
- Browser-supplied evidence, state, principal, workspace, source text, prior
  assessment or provider credential.
- General workflow scheduling or cumulative accounting across jobs.

### Definition of Done

- A case admin can launch assessment from the primary browser after eligible
  Stage A relation evidence exists, with no CLI/raw JSON/database access.
- Missing capability, authorization, evidence, wrong case, credential payload
  or excess budget refuses before transport and remains non-disclosing.
- Provider input is built only from one authorized case's current typed evidence
  and source-complete immutable bindings.
- Successful execution stores one typed case-bound assessment with exactly one
  atomic revision advance; failure stores no partial product result.
- Full PostgreSQL restart after provider success completes from encrypted
  retained evidence with one cumulative call and an identical assessment id.
- The primary browser proves review, immutable history, late-evidence attention
  and reassessment over Stage A records.
- Default synthetic behavior stays green; canonical gates pass; the task is
  archived and committed.

### Minimum Verification Gates

- [ ] Focused module/worker/API/browser live-assessment tests
- [ ] Injected-transport refusal/budget/audit/case-isolation proof
- [ ] PostgreSQL full-restart/no-second-call proof
- [ ] Primary review/late-evidence/reassessment product proof
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

- `docs/adr/0016-encrypted-payload-retention.md`
- `docs/adr/0017-durable-execution-resume.md`
- `docs/adr/0027-async-launch-job-progress-cancellation.md`
- `docs/adr/0039-evidence-workbench-live-model-boundary.md`
- `docs/adr/0040-poc-1-live-product-applicability.md`
- `apps/evidence-workbench-api/src/live-observation.ts`
- `apps/evidence-workbench-api/src/live-relation.ts`
- `apps/evidence-workbench-worker/src/index.ts`
- `packages/module-evidence/src/contracts/propose-assessment.ts`

## Checklist

- [x] Read authority and freeze the ACME-0109 charter.
- [ ] Inventory assessment input/state/product review and attention seams.
- [ ] Implement compatible live assessment command/job/audit contracts.
- [ ] Implement authorized, budgeted and restart-safe assessment execution.
- [ ] Add authenticated case-first API and primary browser flow.
- [ ] Prove refusal, source completeness, atomic projection and default isolation.
- [ ] Prove PostgreSQL restart resumes without a second provider call.
- [ ] Prove primary review, late-evidence attention and reassessment.
- [ ] Run canonical verification and reality-sync documentation.
- [ ] Archive and commit the completed task.

## Decisions and Notes

- ADR-0039/0040 already authorize the existing assessment task under the same
  permanent candidate-validation boundary, so no new ADR is expected.
- This checkpoint makes zero paid calls and uses injected transport because no
  `OPENAI_API_KEY` or approved paid ceiling is present.
- Human review remains an append-only product operation after model execution;
  the model cannot approve its own assessment or make it canonical truth.
- One assessment job is one atomic engine execution. Later evidence triggers a
  new assessment version and review decision; it never edits the predecessor.
- A checkpoint after each task is required; checklist and long-lived docs stay
  aligned with behavior.

## Charter Amendment Log

- None. The frozen Definition of Done is invalid and is not amended: Evidence
  assessment creation intentionally keeps `evidenceRevision` unchanged so its
  `basisEvidenceRevision` remains current. Requiring a product evidence-
  revision advance would make the new assessment stale immediately.

## Verification

- Documentation-only supersession: `pnpm docs:check` and `git diff --check`.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` when structure changes
- [ ] completion plan and Slice 9 live-job rows
- [ ] ADRs only if a new durable decision is discovered

## Handoff and Follow-ups

- Current state: no implementation was attempted under the invalid charter.
- Next recommended step: ACME-0110 should preserve product evidence revision
  while atomically projecting the assessment and advancing only the engine's
  internal state revision.
- Blockers: no engineering blocker; no paid provider call is authorized here.
- Child tasks: none.
- Resume condition: activate the corrected successor task.
- Open questions: none; the existing assessment state contract resolves the
  discovered conflict.

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0109_superseded-live-assessment-review.md`.
- Restore `docs/CURRENT_TASK.md` from the template or populate the next
  explicitly approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
