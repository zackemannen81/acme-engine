# Current Task

Task ID: ACME-0135
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
- ADR-0014, ADR-0015, ADR-0017, ADR-0039 and ADR-0045
- `docs/acceptance/ACME-0133-frozen-acceptance-report.md`
- ACME-0134

## Task Summary

Implement ADR-0045 section 5: the execution engine performs the bounded repair
call it already declares, and the live jobs budget for one.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

A response that fails validation recoverably is repaired within its budget
instead of being paid for and discarded.

### Primary Deliverable

A bounded repair call in the execution engine, driven by `maxRepairCalls` and
by a contract-owned repair request, with recorded evidence and gates.

### In Scope

- Consume `policy.maxRepairCalls` in the engine when the response pipeline
  classifies a failure `repairable`.
- Issue each repair as its own model call with its own call key, purpose
  `repair` and attempt number, recorded like any other call.
- Let the contract own the repair request. A contract that does not offer one
  gets no repair and its budget goes unused.
- Implement the repair request for the three Evidence live contracts.
- Give the live observation, relation and assessment jobs a repair budget.
- Gates: repair succeeds within budget, repair exhausts and fails exactly as
  before, a non-repairable failure never spends a call, and repair is absent on
  the ADR-0017 resume path.

### Out of Scope

- ADR-0045 §6 full-source coverage.
- Retry of a whole execution, revision calls, or any change to
  `maxRevisionCalls`.
- Relaxing schema or semantic validation, or making a repairable failure
  succeed by weakening a check.
- Provider calls. This task is verified offline.

### Definition of Done

- A repairable failure with budget produces exactly one additional recorded
  model call and, when the repair validates, a committed execution.
- Budget exhaustion fails with the same error the execution produced before.
- A non-repairable failure spends no repair call.
- Resume makes no provider call.
- Offline gates and a fresh PostgreSQL journey pass.

### Minimum Verification Gates

- [x] Repair-within-budget gate
- [x] Budget-exhaustion gate
- [x] Non-repairable gate
- [x] Resume-makes-no-call gate
- [x] typecheck, lint, boundaries, test, build, format, docs and diff
- [ ] Fresh PostgreSQL journey — skipped, Docker daemon not running

## References

- `packages/core/src/execution-engine.ts` — the primary call and pipeline
- `packages/core/src/contracts.ts` — `PromptContract`
- `packages/module-evidence/src/contracts/` — the three live contracts
- `apps/evidence-workbench-api/src/live-*.ts` — the job policies

## Checklist

- [x] Freeze the charter.
- [x] Add the optional contract-owned repair request.
- [x] Implement the bounded repair loop in the engine.
- [x] Implement the repair request for the Evidence contracts.
- [x] Give the live jobs a repair budget.
- [x] Add the four gates.
- [x] Run focused and canonical offline verification.
- [x] Reality-sync docs, archive and commit.

## Decisions and Notes

- ACME-0133 evidence: the relation response failed semantic validation with two
  open questions citing rationale codes absent from the same output, classified
  `repairable: true`. The call was paid for and discarded, which removed the
  assessment and the run's domain result.
- Prompt authorship stays with the contract. Core decides whether a repair is
  permitted and budgeted; `buildRepairRequest` decides what it says.
- Repair does not apply on the ADR-0017 resume path. Resume completes from
  recorded evidence and must make no provider call.
- Repair is bounded and never loops: each attempt consumes budget and is
  recorded with its own call key (`repair:N`) and usage.
- Live jobs keep `maxModelCalls: 1` as the primary bound and add
  `maxRepairCalls: 1`. Job and audit `actualModelCalls` now admit 0–2.
- The single-call gateway became a ceiling of two so a repair is not refused
  as `LIVE_MODEL_CALL_BUDGET_EXHAUSTED`.
- A checkpoint after every substep is required.

## Charter Amendment Log

- None.

## Verification

- [x] `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm boundaries`,
      `pnpm docs:check`, `pnpm build` — pass.
- [x] `pnpm test`: unit 779/779, conformance 78, integration 69, scenario 26.
- [x] Focused gates in `tests/integration/execution-repair.test.ts`: repair
      commits after `model:0` + `repair:1`; exhaustion fails after the same
      two calls; a non-repairable pipeline spends only `model:0`; resume from
      a recorded primary makes zero provider calls.
- [x] Live ceiling gate in
      `apps/evidence-workbench-api/test/live-repair-budget.test.ts`.
- [ ] `pnpm test:postgres` — skipped. Docker daemon was not running
      (`npipe:////./pipe/dockerDesktopLinuxEngine` missing). No isolated
      `ACME_POSTGRES_*` was present in the process environment, and the live
      workbench database was not used.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`

## Handoff and Follow-ups

- Current state: ADR-0045 §5 is implemented and offline-verified.
- Next recommended step: activate the POC #1 outcome-blind acceptance run on
  a fresh case. Date-only temporal bounds and ADR-0045 §6 remain follow-ups.
- Blockers: none for the acceptance run. Postgres journey should be re-run
  when Docker is available.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0135_bounded-repair-call.md`.
- Restore the task template and add a signed Journal entry.
- Supersede rather than rewrite if the Goal changes.
