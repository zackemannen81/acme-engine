# Current Task

Task ID: ACME-0108
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T03:11:31+02:00

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
- ACME-0107 archived task and live observation implementation

## Task Summary

Extend the bounded Stage A live path from durable observations to durable typed
relations, timeline entries and open questions. The operation starts only from
the current observations already owned by one authorized case, executes the
existing `relate-observations` contract through the same closed live capability
and exposes its committed results through the existing primary reviewer views.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Turn one case's committed Stage A observations into restart-safe, reviewable
relations, timeline/open-question candidates without widening data authority or
allowing browser-supplied evidence/state.

### Primary Deliverable

An authenticated case-first live relation job that snapshots current
source-bound observations server-side, performs at most one provider call,
commits validated relations/open questions through the durable engine and
projects them atomically into the product repository after engine commit.

### In Scope

- Add additive versioned command/job/audit contracts for the live
  `relate-observations` operation while retaining ACME-0107 observation records.
- Authorize the exact case and confirmation through `evidence-poc1-live/1`;
  require at least two current Stage A observations and derive all evidence,
  workspace and identity server-side.
- Execute the existing relation contract against the durable PostgreSQL ledger
  with encrypted-payload retention and one-call confirmation/deployment limits.
- Project validated relations and open questions only after engine commit;
  no partial product state or evidence-revision advance on refusal/failure.
- Resume after post-provider interruption from retained provider evidence with
  no second provider call or duplicate product identities.
- Add primary browser control/progress and navigate committed outputs to the
  existing relation, timeline and open-question views.
- Extend content-free jobs/audit and case scope only as required.
- Prove injected transport, refusal, budget, case isolation, browser/default
  isolation and full PostgreSQL restart behavior.

### Out of Scope

- Live assessment proposal, assessment review, late-evidence reassessment and
  real paid provider acceptance; they follow this checkpoint.
- New relation semantics, prompt redesign or changes to the sealed synthetic
  relation fixture.
- Stage B FUP, arbitrary ingestion or any new data class.
- Caller-provided observations, state, principal, workspace or source text.
- General workflow scheduling or cumulative accounting.

### Definition of Done

- A case admin can enqueue the relation job from the primary browser after
  Stage A observations exist, without CLI/raw JSON/database access.
- Missing capability, authorization, observations, wrong case, credential
  payload or excess budget refuses before transport and remains non-disclosing.
- Provider input is constructed only from the authorized case's current
  observations and immutable source bindings.
- Successful validated execution stores typed case-bound relations/open
  questions visible in existing primary views, with one atomic revision advance.
- Failure before engine commit or projection stores no partial product result.
- Full PostgreSQL restart after provider success completes from encrypted
  retained evidence with one cumulative call and identical product identities.
- Job/audit state is content-free and default synthetic behavior remains green.
- Canonical gates pass; task is archived and committed as a green checkpoint.

### Minimum Verification Gates

- [x] Focused module/worker/API/browser live-relation tests
- [x] Injected-transport refusal/budget/audit/case-isolation proof
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
- `docs/adr/0039-evidence-workbench-live-model-boundary.md`
- `docs/adr/0040-poc-1-live-product-applicability.md`
- `apps/evidence-workbench-api/src/live-observation.ts`
- `apps/evidence-workbench-worker/src/index.ts`
- `packages/module-evidence/src/contracts/relate-observations.ts`

## Checklist

- [x] Read authority and freeze the ACME-0108 charter.
- [x] Inventory relation input/state/product projection seams.
- [x] Implement compatible live relation command/job/audit contracts.
- [x] Implement authorized, budgeted and restart-safe relation execution.
- [x] Add authenticated case-first API and primary browser flow.
- [x] Prove refusal, source binding, atomic projection and default isolation.
- [x] Prove PostgreSQL restart resumes without a second provider call.
- [x] Run canonical verification and reality-sync documentation.
- [x] Archive and commit the completed task.

## Decisions and Notes

- No new ADR is expected: ADR-0039/0040 already authorize all three existing
  Evidence tasks under the same permanent candidate-validation boundary.
- This checkpoint makes zero paid calls. It uses injected transport because the
  current process has no `OPENAI_API_KEY`.
- Observation and relation jobs remain separate atomic engine executions.
  Assessment remains a later run and cannot be partially committed here.
- A checkpoint after each task is required; checklist and long-lived docs stay
  aligned with behavior.

## Charter Amendment Log

- None.

## Verification

- Focused web/API/file suite: 11 tests passed.
- Focused PostgreSQL Stage A suite: 2 tests passed, including relation refusal,
  post-engine projection interruption and full-composition resume with one
  cumulative transport call.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm boundaries`: passed.
- `pnpm test`: passed — 745 unit, 78 conformance, 62 integration and 26
  scenario tests. Two earlier attempts exposed existing timing/teardown flakes;
  both affected tests passed in isolation and the exact canonical rerun passed.
- `pnpm test:postgres`: 36 tests passed against a fresh PostgreSQL database.
- `pnpm build`: passed.
- `pnpm format:check`: passed.
- `pnpm docs:check`: passed.
- `git diff --check`: passed.
- No real paid call ran; no `OPENAI_API_KEY` or explicit paid ceiling was
  available, as required by the frozen zero-spend scope.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] completion plan and Slice 9 live-job rows
- [x] ADRs only if a new durable decision is discovered — none was required.

## Handoff and Follow-ups

- Current state: Stage A observations can produce durable typed relations and
  open questions through a separate bounded live call; a full restart after
  provider success projects the same identities without another call.
- Next recommended step: activate ACME-0109 for live assessment proposal and
  the primary review/late-evidence reassessment journey.
- Blockers: no engineering blocker; no paid provider call is authorized here.
- Child tasks: none.
- Resume condition: ACME-0108 is complete and archived.
- Open questions: none that block the frozen deliverable.

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0108_stage-a-live-relation-job.md`.
- Restore `docs/CURRENT_TASK.md` from the template or populate the next
  explicitly approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
