# Current Task

Task ID: ACME-0178
Parent Task: None
Status: Complete
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

- [x] Focused `ModelExecutionEngine` regression.
- [x] Existing model-execution tests remain green.
- [x] `@acme/core` typecheck.
- [x] `pnpm docs:check` and `pnpm format:check`.
- [x] `git diff --check`.
## References

- `packages/core/src/model-execution-engine.ts`
- `packages/core/test/model-execution-engine.test.ts`
- `apps/cli/src/acme-model-runtime-host.ts`
- `docs/adr/0053-model-only-execution-runtime.md`
- `docs/design/acme-model-runtime-1.md`
- A008 live evidence: `ACME stream sequence was 0, expected 146.`

## Checklist

- [x] Add failing partial-stream/late-failure regression.
- [x] Implement the smallest sequence-ownership repair.
- [x] Verify success-path sequence behavior is unchanged.
- [x] Run focused and repository documentation gates.
- [x] Update durable docs and archive the task.

## Decisions and Notes

- The frozen wire already requires contiguous sequence numbers; this task repairs implementation to that existing contract and adds no new semantics.
- Gateway stream sequence remains independently validated before any event is exposed to a consumer.
- No ADR is required because ADR-0053 already decides ordered SSE behavior.

## Charter Amendment Log

-none

## Verification

- [x] Core regression 9/9; loopback integration 3/3; combined 12/12.
- [x] Core typecheck passed; final docs/format/diff gates recorded at closeout.
- [x] No live provider call used; verification used deterministic fake-provider SSE.
## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` not changed; no structure change

## Handoff and Follow-ups

- Current state: complete; model-execution output sequence is execution-owned and contiguous through late terminal failure.
- Next recommended step: rerun the A008 GUI tool-loop path against the restarted local ACME runtime.
- Blockers: none.
- Child tasks: none.
- Resume condition: none.
- Open questions: none.

## Finalize When Complete

- Archive under `docs/finished/ACME-0178_contiguous-terminal-sequence.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.