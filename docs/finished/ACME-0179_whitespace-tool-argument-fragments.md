# Current Task

Task ID: ACME-0179
Parent Task: None
Status: Complete
Owner: OpenAI assistant
Created: 2026-09-15
Last updated: 2026-09-15
Charter frozen at: 2026-09-15T07:35+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/SYSTEMDOC.md`
- `docs/adr/0053-model-only-execution-runtime.md`
- `docs/design/acme-model-runtime-1.md`

## Task Summary

A008 live tool streaming exposed a valid JSON argument fragment containing only whitespace. ACME rejects it because `argumentsDelta` uses the generic trimmed non-empty text validator.

## Task Charter

### Goal

Preserve valid non-empty whitespace-only function-call argument fragments without weakening final JSON validation.
### Primary Deliverable

A bounded core validation repair plus regression tests proving whitespace fragments survive the model-only execution path.

### In Scope

- Validate `argumentsDelta` as a non-empty string by length, not trimmed content.
- Keep ordinary text fields on the existing trimmed non-empty rule.
- Prove a whitespace-only argument fragment passes through core and the loopback model runtime.
- Preserve malformed final tool argument JSON as `MODEL_INVALID_RESPONSE`.

### Out of Scope

- A008 changes.
- Tool execution, tool approval, cognition, memory or retry policy.
- Provider-specific repair or guessing of malformed tool arguments.
- Any `acme-model-runtime/1` wire change.

### Definition of Done

- `argumentsDelta: " "` is accepted as a stream fragment.
- `argumentsDelta: ""` remains rejected.
- Existing fragmented tool-call assembly remains green.
- Core/integration tests and typecheck pass.
### Minimum Verification Gates

- [x] Focused core model-execution regression.
- [x] Loopback `acme-model-runtime/1` regression.
- [x] `@acme/core` typecheck.
- [x] `pnpm docs:check`, `pnpm format:check`, `git diff --check`.

## References

- `packages/core/src/model-validation.ts`
- `packages/core/test/model-execution-engine.test.ts`
- `tests/integration/acme-model-runtime-listener.test.ts`
- A008 live failure: `Model stream event argumentsDelta must be a non-empty string.`

## Decisions and Notes

- ADR-0053 and `acme-model-runtime/1` define `argumentsDelta` as an opaque JSON string fragment. Whitespace may be semantically significant between fragments and must not be trimmed or rejected merely for containing no non-whitespace characters.
- Empty string remains non-information and stays invalid.
- Final assembled argument JSON remains strictly parsed; ACME does not repair malformed JSON.

## Verification

- [x] Focused core model-execution tests: 11/11 passed.
- [x] Loopback model-runtime integration: 4/4 passed.
- [x] Combined focused tests: 15/15 passed.
- [x] `@acme/core` typecheck passed.
- [x] Documentation, formatting and diff gates passed; docs checker reported only pre-existing historical non-gating path warnings.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`

## Handoff and Follow-ups

- Current state: frozen consumer-driven repair.
- Next recommended step: add failing regressions, implement minimal validator repair, rerun live A008 tool path.
