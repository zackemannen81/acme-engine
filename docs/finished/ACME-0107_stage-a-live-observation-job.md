# Current Task

Task ID: ACME-0107
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T02:32:58+02:00

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
- ACME-0105 and ACME-0106 archived tasks and implementations

## Task Summary

Deliver the first callable Stage A provider operation: an authenticated,
case-first browser/API job that reads one already activated encrypted judicial
text source, authorizes the exact case/source/confirmation through the closed
live capability, executes `observe-artifact`, and exposes validated
source-bound observations for normal human review. The deterministic synthetic
composition remains unchanged and unreachable from this route.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Turn an imported Stage A source into durable, reviewable, source-bound
observations through the real provider path without exposing source content,
credentials or caller-chosen identity in control records.

### Primary Deliverable

A restart-safe `evidence-poc1-live/1` observation job, callable from the
authenticated case-first browser/API for one activated Stage A source and
persisting only runtime/semantically validated observations plus content-free
job and security-audit evidence.

### In Scope

- Add an additive versioned Stage A live-observation command/job contract;
  preserve existing synthetic import/job contracts and stored records.
- Make the active observation prompt applicable to authorized real source
  material while preserving explicit compatibility for the historical
  synthetic contract and deterministic fixture path.
- Resolve the selected source, activated Stage A import and canonical encrypted
  representation server-side; hydrate it only through the audited artifact
  service and never accept source text in the live command.
- Require server-derived `case-admin` / `live-model.run` authorization, an
  exact case-bound confirmation and matching Stage A source authority before
  constructing the provider gateway.
- Enforce confirmation and deployment call ceilings around every gateway call;
  record actual call count and typed terminal reason without prompt, response,
  quote, source text, rationale or credential fields in job/audit records.
- Execute `observe-artifact` through the durable PostgreSQL execution ledger
  with encrypted-payload retention, project product observations only after an
  engine commit, and make retry/restart reuse recorded provider evidence rather
  than issue a second call.
- Add primary browser controls to analyze an imported Stage A source, show
  progress/failure safely and navigate completed observations into the normal
  source-review queue.
- Extend content-free live audit events and case-object bindings only as
  required by the job.
- Add injected-transport, PostgreSQL restart, refusal, budget, audit, case
  isolation and browser blackbox proofs. Add an opt-in live test entry point
  but make no paid provider call in this checkpoint because no credential is
  present in the current process.

### Out of Scope

- Live relation generation, timeline/open-question generation, assessment
  proposal, assessment review and late-evidence reassessment; these follow once
  live observations are durable.
- Stage B FUP or any data class other than
  `stage-a-anonymized-judicial-text/1`.
- PDF upload/parsing, OCR, source-content logging or committing real source
  bytes/outputs/fixtures.
- Cumulative cross-run or per-principal accounting, pricing estimation or a
  general scheduler.
- Changing the synthetic/default composition into a live composition.

### Definition of Done

- A case admin can select an activated Stage A source in the browser, provide
  the exact non-secret confirmation/budget fields and enqueue one observation
  job without CLI, raw JSON or database access.
- Missing capability, wrong case/source/class, inactive import, unauthorized
  principal, credential-shaped payload or excess budget refuses before
  transport; foreign-case requests remain non-disclosing.
- The provider receives only the hydrated canonical source plus the observation
  contract input; no browser-supplied source or identity can replace it.
- Successful validated execution stores reviewable observations whose artifact
  version, exact quote and line locator bind to the selected immutable source.
- Failure, cancellation or budget exhaustion before engine commit stores no
  product observation or evidence-revision advance.
- Repeating/recovering the same command after a full PostgreSQL composition
  restart completes from retained encrypted provider evidence with no duplicate
  provider call and identical observation identities.
- Live start/completion/failure/refusal audit and job records are content-free;
  credentials and source/provider bodies never appear in serialized product
  state or error responses.
- Historical synthetic behavior stays green and the default composition makes
  zero provider calls and exposes no live-analysis control.
- Canonical gates pass; task is archived and committed as a resumable green
  checkpoint.

### Minimum Verification Gates

- [x] Focused module/worker/auth/API/browser live-observation tests
- [x] Injected-transport end-to-end/refusal/budget/audit proof
- [x] PostgreSQL full-restart/no-second-call proof
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
- `docs/adr/0035-evidence-authenticated-principal-and-authorization.md`
- `docs/adr/0036-evidence-case-management-and-isolation.md`
- `docs/adr/0037-evidence-secure-artifact-foundation.md`
- `docs/adr/0039-evidence-workbench-live-model-boundary.md`
- `docs/adr/0040-poc-1-live-product-applicability.md`
- `apps/evidence-workbench-api/src/live.ts`
- `apps/evidence-workbench-worker/src/index.ts`
- `packages/module-evidence/src/contracts/observe-artifact.ts`

## Checklist

- [x] Read authority and freeze the ACME-0107 charter.
- [x] Inventory exact contract, worker, audit and repository seams.
- [x] Implement compatible live command/job/audit contracts.
- [x] Implement hydrated, authorized, budgeted, restart-safe observation
      execution.
- [x] Add the authenticated case-first API and primary browser flow.
- [x] Prove refusals, source binding, audit hygiene and default isolation.
- [x] Prove PostgreSQL restart resumes without a second provider call.
- [x] Run canonical verification and reality-sync documentation.
- [x] Archive and commit the completed task.

## Decisions and Notes

- ADR-0039 and ADR-0040 already decide the live provider, retention, authority,
  source class, budget and profile boundaries. No new ADR is required unless
  implementation discovers a genuinely new durable cross-package decision.
- This checkpoint authorizes zero paid calls. The current process has no
  `OPENAI_API_KEY`; injected transport proves the product path. The eventual
  Stage A acceptance remains a separate opt-in run with an explicit ceiling.
- One observation task is one atomic execution run. Relations and assessments
  are later runs, so a failure here cannot partially commit this run.
- A checkpoint after each task is required; checklist and long-lived docs stay
  aligned with behavior.

## Charter Amendment Log

- None.

## Verification

- Focused observation/module/API/auth/browser tests: 24 passed.
- Injected PostgreSQL Stage A suite: 2 passed, including three pre-transport
  refusals and full restart from retained provider evidence with one cumulative
  transport call.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm boundaries`: passed.
- `pnpm test`: passed, 745 unit tests plus 78 conformance, 62 integration and
  26 scenario tests.
- `pnpm test:postgres`: passed against a fresh PostgreSQL database, 36 tests.
- `pnpm build`: passed.
- `pnpm format:check`: passed.
- `pnpm docs:check`: passed.
- `git diff --check`: passed.
- Opt-in real Stage A entry: discovered and skipped without
  `ACME_EVIDENCE_STAGE_A_LIVE=1`; no paid provider call was made because the
  process had no `OPENAI_API_KEY`.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] completion plan and Slice 9 live-job rows
- [ ] ADRs only if a new durable decision is discovered

## Handoff and Follow-ups

- Current state: Stage A imports can produce durable reviewable observations
  through the bounded live job; the default synthetic composition is unchanged.
- Next recommended step: add restart-safe live relation/timeline/open-question
  generation, then assessment and the primary review/reassessment proof.
- Blockers: no engineering blocker; a real paid acceptance call cannot run
  until an environment credential is supplied, but it does not block this
  injected-transport implementation checkpoint.
- Child tasks: none.
- Resume condition: read this task and the latest journal entry.
- Open questions: the real provider acceptance still needs a process credential
  and an explicit paid-run ceiling; neither blocks this injected checkpoint.

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0107_stage-a-live-observation-job.md`.
- Restore `docs/CURRENT_TASK.md` from the template or populate the next
  explicitly approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
