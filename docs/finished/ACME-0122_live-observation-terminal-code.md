# Current Task

Task ID: ACME-0122
Parent Task: ACME-0121
Status: Complete
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T17:58:34+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/paused/ACME-0121_stage-a-canonical-utc-provider-acceptance.md`

## Task Summary

Correct the single stale terminal reason-code assertion exposed only after the
ACME-0121 product job had completed and durably committed.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Make the Stage A live acceptance assert the established successful worker
contract, `LIVE_OBSERVATION_COMPLETED`.

### Primary Deliverable

The live acceptance and an offline product-path assertion both pin the same
successful terminal reason code emitted by the worker.

### In Scope

- Replace the obsolete live-test expected reason code.
- Strengthen the existing offline PostgreSQL observation journey to assert the
  successful reason code.
- Run focused and canonical offline verification, document, archive and resume
  ACME-0121.

### Out of Scope

- Provider/network calls, replay/resume codes, worker behavior or refactoring.
- Source/provider inspection beyond already recorded content-free evidence.
- Relation/assessment, Stage B, deployment, push or release.

### Definition of Done

- Both assertions use `LIVE_OBSERVATION_COMPLETED` for a new successful job.
- Focused PostgreSQL and canonical offline gates pass.
- No provider call occurs; child is archived and ACME-0121 resumes unchanged.

### Minimum Verification Gates

- [x] Static live-gate expectation check
- [x] Focused fresh-PostgreSQL Stage A test
- [x] typecheck, lint, test, build, format, docs and diff

## References

- `apps/evidence-workbench-worker/src/index.ts`
- `tests/live/evidence-stage-a-observation.test.ts`
- `tests/postgres/evidence-stage-a-import.test.ts`

## Checklist

- [x] Pause parent and freeze bounded child.
- [x] Align the two success assertions.
- [x] Run focused/canonical offline verification.
- [x] Reality-sync docs, archive child and resume parent.

## Decisions and Notes

- Worker behavior is authoritative and unchanged: a new successful job uses
  `LIVE_OBSERVATION_COMPLETED`; replay uses `LIVE_OBSERVATION_RESUMED`.
- No live opt-in or provider credential may be loaded in this task.
- A checkpoint after every substep is required.
- The live gate and existing successful PostgreSQL product journey now both
  assert the worker's `LIVE_OBSERVATION_COMPLETED` terminal reason.

## Charter Amendment Log

- None.

## Verification

- [x] Focused fresh PostgreSQL Stage A file: 2/2; disposable container removed.
- [x] Typecheck, lint, boundaries, build; 751 unit, 78 conformance, 62
  integration and 26 scenario tests; format, docs and diff.
- [x] Initial full unit run had two unrelated five-second blackbox timeouts;
  both files passed isolated 6/6 and the exact full rerun passed 751/751.

## Documentation Updates

- [x] `docs/JOURNAL.md`
- [x] Parent ACME-0121 child evidence
- [x] Long-lived docs only if behavior changes — not applicable

## Handoff and Follow-ups

- Current state: assertions aligned and all offline gates pass; no provider
  call occurred.
- Next recommended step: parent ACME-0121 is restored for disposition.
- Blockers: none.
- Child tasks: none.
- Resume condition: met; child archived and parent restored.
- Open questions: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0122_live-observation-terminal-code.md`.
- Restore ACME-0121 from `docs/paused/` and set it `In Progress`.
- Add a signed `docs/JOURNAL.md` entry.
