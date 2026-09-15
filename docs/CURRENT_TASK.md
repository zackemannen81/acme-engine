# Current Task

Task ID: ACME-0178
Parent Task: None
Status: Ready
Owner: OpenAI assistant
Created: 2026-09-15
Last updated: 2026-09-15
Charter frozen at: 2026-09-15T07:20+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0053-model-only-execution-runtime.md`
- `docs/design/acme-model-runtime-1.md`

## Task Summary

A008 live testing exposed a protocol defect: after streaming non-terminal events, a later model-execution failure can be emitted with `sequence: 0`, violating the frozen contiguous SSE sequence contract and masking the real structured ACME failure.

## Task Charter

### Goal

Keep every model-only execution event stream contiguous through terminal success or failure.
### Primary Deliverable

A bounded `ModelExecutionEngine` repair plus regressions proving that a failure after streamed deltas receives the next sequence number and preserves its structured error.

### In Scope

- Add a regression for partial stream followed by terminal failure.
- Make model-execution output sequencing execution-owned and contiguous.
- Keep gateway/provider stream ordering validation unchanged.
- Preserve existing success, replay, conflict and error semantics.
- Update current runtime documentation and journal evidence.

### Out of Scope

- A008 changes.
- Provider retry or repair policy.
- New wire fields or `acme-model-runtime/2`.
- Provider, memory, state, domain or cognition changes.
- Push, deployment, release or new live provider spend.

### Definition of Done

- A partial stream followed by failure emits contiguous `0..N` events.
- The terminal event retains the original `AcmeErrorData`.
- Normal success sequences remain unchanged.
- Focused core/runtime tests, typecheck, docs/format and `git diff --check` pass.

### Minimum Verification Gates

- [ ] Focused `ModelExecutionEngine` regression.
- [ ] Existing model-execution tests remain green.
- [ ] `@acme/core` typecheck.
- [ ] `pnpm docs:check` and `pnpm format:check`.
- [ ] `git diff --check`.
## References

- `packages/core/src/model-execution-engine.ts`
- `packages/core/test/model-execution-engine.test.ts`
- `apps/cli/src/acme-model-runtime-host.ts`
- `docs/adr/0053-model-only-execution-runtime.md`
- `docs/design/acme-model-runtime-1.md`
- A008 live evidence: `ACME stream sequence was 0, expected 146.`

## Checklist

- [ ] Add failing partial-stream/late-failure regression.
- [ ] Implement the smallest sequence-ownership repair.
- [ ] Verify success-path sequence behavior is unchanged.
- [ ] Run focused and repository documentation gates.
- [ ] Update durable docs and archive the task.

## Decisions and Notes

- The frozen wire already requires contiguous sequence numbers; this task repairs implementation to that existing contract and adds no new semantics.
- Gateway stream sequence remains independently validated before any event is exposed to a consumer.
- No ADR is required because ADR-0053 already decides ordered SSE behavior.

## Charter Amendment Log

-none

## Verification

- [ ] Record focused regression result.
- [ ] Record typecheck and repository gates.
- [ ] Record that no new live provider call was used for verification.
## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` only if structure changes

## Handoff and Follow-ups

- Current state: charter frozen; implementation not yet changed.
- Next recommended step: reproduce the sequence reset in a focused core test.
- Blockers: none.
- Child tasks: none.
- Resume condition: none.
- Open questions: none.

## Finalize When Complete

- Archive under `docs/finished/ACME-0178_contiguous-terminal-sequence.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.