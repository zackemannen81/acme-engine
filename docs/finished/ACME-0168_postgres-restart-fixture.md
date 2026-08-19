# Current Task

Task ID: ACME-0168
Parent Task: ACME-0167
Status: Complete
Owner: Felix Nissen
Created: 2026-08-19
Last updated: 2026-08-19
Charter frozen at: 2026-08-19T10:39+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- Relevant ADRs under `docs/adr/`

## Task Summary

Canonical CI for parent task ACME-0167 proved the new runtime boundary through docs, format, lint, typecheck, package boundaries, unit, conformance, integration, scenarios and build, but the independent PostgreSQL gate exposed a pre-existing stale Stage A restart fixture. The fixture still hard-codes obsolete line-segment ids and reports one model call on the resumed process, while the current Evidence contract uses structural source segments and recovery correctly performs zero new provider calls after restart.

This child task repairs the test fixture only. It must not modify ACME runtime code, core, Evidence product behavior, persistence behavior or POC #1 implementation.

## Task Charter

The charter is immutable from this point.

### Goal

Restore truthful canonical PostgreSQL verification by updating the stale Stage A restart test fixture to the current Evidence observation input contract and current recovery accounting.

### Primary Deliverable

A test-only repair to `tests/postgres/evidence-stage-a-import.test.ts` that derives response segment ids from the provider request and asserts zero new model calls on resumed projection while retaining the invariant that total provider traffic is exactly one call.

### In Scope

- Parse the encoded current observation input already sent to the provider fixture.
- Derive extractable structural source segments from that request rather than hard-coding legacy `line-*` segment ids.
- Build observation output and complete `segmentCoverage` from those actual segment ids.
- Keep two source-bound fact observations and mark other extractable segments `no_observation`.
- Change the resumed job assertion from `actualModelCalls: 1` to `actualModelCalls: 0` while retaining `expect(providerCalls).toBe(1)`.
- Run full canonical CI and specifically the PostgreSQL suite.

### Out of Scope

- Any production/runtime code change.
- Any change under `packages/core/**`.
- Any change under `apps/evidence-workbench-v2-*` or Evidence packages/adapters.
- Any change to model/recovery semantics.
- Any weakening/removal of provider-call or restart assertions.
- ACME-0167 runtime work.

### Definition of Done

- The Stage A restart fixture uses structural segment ids from the actual provider request.
- Segment coverage is complete for extractable segments.
- First process still records exactly one provider call before injected post-provider interruption.
- Restart completes without another provider call and reports `actualModelCalls: 0` for the resumed job.
- Total `providerCalls` remains exactly 1.
- Full canonical `verify` and `postgres` jobs pass.
- The PR diff contains only this test repair plus task documentation/closeout.

### Minimum Verification Gates

- [x] `pnpm docs:check`.
- [x] `pnpm format:check`.
- [x] `pnpm lint`.
- [x] `pnpm typecheck`.
- [x] Package-boundary check.
- [x] Unit suite.
- [x] Conformance suite.
- [x] Integration suite.
- [x] Deterministic scenarios.
- [x] Package build.
- [x] PostgreSQL adapter suite including `evidence-stage-a-import.test.ts`.

## References

- Parent ACME-0167 CI run `32233414825`: full `verify` path green; PostgreSQL failure isolated to `tests/postgres/evidence-stage-a-import.test.ts`.
- Failure: stale output produced `MODEL_INVALID_RESPONSE` and a second provider call because legacy line segment ids no longer cover current structural source segments.
- Previously verified Felix reference fixture: `integration/felix-runtime-candidate`, which derives segment ids from the encoded provider input and records zero new calls on resume.

## Checklist

- [x] Isolate the failure from ACME-0167 runtime code.
- [x] Compare stale main fixture with the previously verified fixture.
- [x] Port only the structural-segment fixture repair.
- [x] Correct resumed per-process call accounting assertion.
- [x] Verify the changed-file diff is test-only apart from task docs.
- [x] Run full canonical CI.
- [x] Record verification and close out the child task.

## Decisions and Notes

- The parent runtime implementation is not the cause: ACME-0167 `verify` passes docs, format, lint, typecheck, boundaries, unit, conformance, integration, scenarios and build.
- This child is necessary solely because full canonical CI is a frozen ACME-0167 completion gate.
- The provider-call invariant is strengthened, not weakened: resume must add zero calls and total traffic must remain exactly one.

## Charter Amendment Log

-none

## Verification

- [x] Stage A restart test passes with the current structural observation contract.
- [x] Full `verify` job passes.
- [x] Full `postgres` job passes.

## Documentation Updates

- [x] `docs/JOURNAL.md` closeout entry.
- [x] `docs/CURRENT_STATUS.md` only if a persistent repo-level gap changes.
- [x] `docs/SYSTEMDOC.md` only if architecture changes (not expected).
- [x] `docs/FILESTRUCTURE.md` not expected to change.

## Handoff and Follow-ups

- Current state: Complete. The stale Stage A PostgreSQL restart fixture now derives structural source segment ids from the actual provider request and reports zero new calls on resume.
- Next recommended step: review/merge PR #34, then rebase or update parent PR #33 onto the corrected baseline and rerun its full canonical gates.
- Blockers: None inside this child.
- Child tasks: None.
- Resume condition for parent: PR #34 accepted into `main`; then ACME-0167 can rerun PostgreSQL against the corrected baseline.
- Open questions: None.

## Finalize When Complete

- Archive this file under `docs/finished/ACME-0168_postgres-restart-fixture.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.

## Completion Evidence

- Canonical CI run `32234497958` completed successfully in both jobs.
- `verify`: documentation, formatting, lint, typecheck, package boundaries, unit, conformance, integration, deterministic scenarios and build all passed.
- `postgres`: typecheck and the complete PostgreSQL adapter suite passed, including the repaired Stage A restart test.
- Diff against task base contains no production code: only this task documentation/closeout and `tests/postgres/evidence-stage-a-import.test.ts`.
- No live model call, deployment, core change or Evidence product behavior change was performed.
