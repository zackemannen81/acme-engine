# Current Task

Task ID: ACME-0177
Parent Task: None
Status: Ready
Owner: OpenAI assistant
Created: 2026-09-15
Last updated: 2026-09-15
Charter frozen at: 2026-09-15T07:00+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0014-live-provider-boundary.md`
- `docs/adr/0053-model-only-execution-runtime.md`

## Task Summary

A008's first live ACME consumer run exposed two execution-boundary defects: OpenAI Responses history maps prior assistant text as `input_text`, and structured provider errors can degrade to generic `INTERNAL` when `instanceof AcmeError` fails across package/runtime copies.

## Task Charter

### Goal

Make multi-turn OpenAI text history valid and preserve already-classified ACME errors across the model-execution boundary.
### Primary Deliverable

A bounded repair in the OpenAI adapter and model-execution error boundary, with regression tests proving second-turn assistant history and structured error preservation.

### In Scope

- Map user text to Responses `input_text` and prior assistant text to `output_text` while preserving message order.
- Keep tool-call and tool-result continuation behavior unchanged.
- Preserve valid structured ACME error data even when class identity differs across a package/runtime boundary.
- Add focused regression tests for both defects.
- Update current runtime documentation and journal evidence.

### Out of Scope

- A008 changes.
- New generation controls, providers, retry policy, cognition, memory, domain or state behavior.
- Changing `acme-model-runtime/1` wire semantics.
- Deployments, pushes or releases.

### Definition of Done

- A user → assistant → user request serializes assistant history as `output_text` and user history as `input_text`.
- Existing tool continuation tests remain green.
- A structurally valid ACME error crossing the execution boundary retains code, message, stage, retryability and details instead of becoming `INTERNAL`.
- Unknown ordinary exceptions still become non-retryable `INTERNAL`.
- Focused adapter/core tests, typecheck, docs check and `git diff --check` pass.

### Minimum Verification Gates

- [ ] Focused OpenAI adapter tests.
- [ ] Focused model-execution engine tests.
- [ ] Typecheck affected packages.
- [ ] `pnpm docs:check`.
- [ ] `git diff --check`.
## References

- `packages/adapter-model-openai/src/request.ts`
- `packages/adapter-model-openai/test/gateway.test.ts`
- `packages/core/src/model-execution-engine.ts`
- `packages/core/src/errors.ts`
- A008 live failure evidence: provider HTTP 400 rejected assistant history typed as `input_text`.

## Checklist

- [ ] Add role-aware Responses history mapping regression.
- [ ] Implement the minimal history mapping repair.
- [ ] Add cross-boundary structured-error regression.
- [ ] Implement robust structured ACME error recognition.
- [ ] Run focused and documentation gates.
- [ ] Update durable docs and archive the task.

## Decisions and Notes

- The provider adapter owns provider wire roles/types; core remains provider-neutral.
- Error preservation is structural only for a complete valid ACME error-data shape; arbitrary thrown values must not acquire trusted classification.
- No ADR is required because this repairs behavior already promised by ADR-0014 and ADR-0053.

## Verification

- [ ] Record exact commands/results here before completion.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` only if structure changes.

## Handoff and Follow-ups

- Current state: charter frozen; implementation not started.
- Next recommended step: write failing regressions first, then repair.
- Blockers: none.
- Child tasks: none.
- Resume condition: none.
- Open questions: none.

## Finalize When Complete

- Archive under `docs/finished/ACME-0177_openai-history-error-boundary.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
