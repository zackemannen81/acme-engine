# Current Task

Task ID: ACME-0174
Parent Task: None
Status: Ready
Owner: felixnissen (fork contribution)
Created: 2026-08-26
Last updated: 2026-08-26
Charter frozen at: 2026-08-26

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0012-milestone-1-execution-identity-and-replay.md`
- `docs/adr/0017-durable-execution-resume.md`
- `packages/core/src/execution-engine.ts`
- `packages/core/src/execution-types.ts`
- `packages/core/src/model-call-usage.ts`

## Task Summary

Make ACME's existing deterministic reuse observable without changing its execution semantics. A caller must be able to distinguish a fresh execution from reuse of an already committed execution and from recovery that continues using a previously recorded successful model response.

## Task Charter

The charter is frozen at `Ready`.

### Goal

Expose truthful, machine-readable reuse provenance for committed execution results so callers such as CLI/runtime consumers can measure reuse and recovery without inferring it from logs or pretending unknown token/cost data is zero.

### Primary Deliverable

A backward-compatible reuse-provenance field on committed `ExecutionResult` values, produced by the canonical execution engine and covered by focused tests for all three execution paths.

### In Scope

- Define a versioned/small reuse provenance vocabulary for committed results:
  - `fresh` — this invocation performed the execution path and did not substitute a previously recorded successful response;
  - `committed-execution` — this invocation returned the already committed result for the same deterministic execution identity;
  - `recorded-response-resume` — this invocation completed an interrupted execution using its recorded successful primary model response without a second provider call.
- Return that provenance from `ExecutionEngine.execute` without changing execution identity, request fingerprinting, retry policy, repository schema or commit digest.
- Keep the persisted committed result semantically compatible; reuse provenance describes the current invocation, not a mutation of historical evidence.
- Add focused tests proving provider-call counts for fresh, committed reuse and recorded-response resume.
- Expose the field through existing JSON/CLI/runtime result surfaces that already serialize `ExecutionResult` without adding a new transport.
- Document the distinction from usage/cost accounting: reuse provenance says why a call was avoided; token/cost savings may only be calculated from actually recorded provider usage.

### Out of Scope

- New semantic/vector/model-response cache.
- Pricing tables or inferred costs.
- Provider auto-routing or free-first policy (Verket concern).
- Repository schema migrations.
- Changing ADR-0017 ambiguity/retry rules.
- New scheduler/orchestrator behavior.
- Counting a historical committed execution reuse event after the caller has discarded the returned invocation result; durable cross-invocation analytics may be a later task.
- Any Evidence Workbench/product-domain changes.

### Definition of Done

- A normal successful execution returns reuse provenance `fresh`.
- Repeating the same deterministic request after commit returns `committed-execution`, keeps `replayed: true`, and performs zero additional provider calls.
- Resuming after a recorded successful primary response returns `recorded-response-resume`, performs zero additional provider calls during the resumed invocation, and preserves ADR-0017 behavior.
- Failed/blocked/conflicted/cancelled results are unchanged.
- No persistence schema or operation-digest input changes.
- Existing usage accounting continues to treat missing usage/cost as unknown, never zero.
- Focused tests and repository gates are recorded honestly; unavailable Actions runners are documented rather than treated as a pass.

### Minimum Verification Gates

- [ ] Focused core/integration tests for all three reuse paths.
- [ ] Typecheck/build once an executable runner is available.
- [ ] Confirm no adapter schema migration is required.
- [ ] Confirm no live provider call is required for verification.
- [ ] Review changed paths for Evidence Workbench/product isolation.

## References

- `packages/core/src/execution-engine.ts`
- `packages/core/src/execution-types.ts`
- `packages/core/src/model-call-usage.ts`
- `packages/core/test/model-call-usage.test.ts`
- `docs/adr/0012-milestone-1-execution-identity-and-replay.md`
- `docs/adr/0017-durable-execution-resume.md`

## Checklist

- [ ] Define invocation reuse provenance contract.
- [ ] Wire fresh/committed/recovery result paths.
- [ ] Add focused tests without live credentials.
- [ ] Verify repository/persistence semantics did not change.
- [ ] Update durable docs and handoff.
- [ ] Archive only after available verification gates are satisfied or blockers are explicitly recorded.

## Decisions and Notes

- Reuse provenance belongs to the returned invocation result because `committed-execution` is a property of this invocation, not of the historical commit stored in the repository.
- `replayed` remains for compatibility. The new field disambiguates *why* no fresh provider work was needed.
- Savings analytics must combine provenance with recorded usage evidence; this task does not estimate missing usage.

## Charter Amendment Log

-none

## Verification

- [ ] Focused tests.
- [ ] Repository CI when runners execute.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` only if structure changes
- [ ] ADR only if implementation requires a new long-lived architectural decision beyond clarifying existing ADR-0012/0017 semantics

## Handoff and Follow-ups

- Current state: task claimed on fork main and activated on isolated contribution branch.
- Next recommended step: implement the result-level provenance contract with no repository schema change.
- Blockers: GitHub Actions jobs on this account currently terminate before checkout (`steps: null`); this is a verification-infrastructure blocker, not evidence of a code failure.
- Child tasks: none.
- Resume condition: repository state is sufficient.
- Open questions: whether a later task should persist invocation-level reuse analytics for aggregate dashboards.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` from the template.
- Add a signed `docs/JOURNAL.md` entry.
