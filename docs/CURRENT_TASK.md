# Current Task

Task ID: ACME-0129
Parent Task: None
Status: Ready
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T18:56:51+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- ADR-0040 through ADR-0043
- ACME-0123 through ACME-0128

## Task Summary

Run the corrected complete two-source Stage A live reviewer/reassessment gate
once from the green ACME-0128 checkpoint.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Prove the POC #1 domain vertical end to end on D1/D2: real import, live model,
reviewed assessment, restart, later evidence, stale history and successor.

### Primary Deliverable

A recorded green run of the typed
`tests/live/evidence-stage-a-reviewer-journey.test.ts` against fresh PostgreSQL,
private S3 and six individually one-call-bounded `gpt-5.6-luna` jobs.

### In Scope

- Reuse the approved ignored ACME-only credential without revealing plaintext.
- Reverify/extract D1/D2 outside Git with exact provenance.
- Preflight clean PostgreSQL/private S3/random mounted keys.
- Run the exact isolated live journey once with at most six calls total.
- Use 3,333 minor SEK units per job; six jobs total 19,998 minor units.
- Record only content-free evidence and remove all disposable resources.

### Out of Scope

- Retry/repair, a seventh call, raising the 200 SEK aggregate ceiling, source or
  provider content in Git, Stage B, deployment, push or release.
- Code/contract correction after a consumed call or exhaustive coverage claims.

### Definition of Done

- Gate passes D1/restart/D2/final-restart domain assertions.
- At most six calls; each completed job reports exactly one.
- Case-first views expose two sources, review standings, relations/questions,
  reviewed assessment, stale predecessor and reviewed successor while
  technical audit stays absent.
- Complete cleanup/docs/archive/commit with no sensitive material.

### Minimum Verification Gates

- [ ] D1/D2 source and infrastructure preflight
- [ ] Exact isolated live journey once
- [ ] Content-free call/domain/persistence assertions
- [ ] Credential/source/key cleanup and Git hygiene
- [ ] docs and diff checks

## References

- `tests/live/evidence-stage-a-reviewer-journey.test.ts`
- `docs/finished/ACME-0128_sorted-assessment-provider-output.md`
- `C:\Users\zakri\Downloads\Anonymiserad_d1.pdf` (operator source; never imported)
- `C:\Users\zakri\Downloads\Anonymiserad_d2.pdf` (operator source; never imported)

## Checklist

- [x] Freeze one-shot call/monetary charter.
- [ ] Prepare/preflight sources and disposable infrastructure.
- [ ] Run exact live journey once; never retry.
- [ ] Inspect content-free outcome and clean all disposable state.
- [ ] Reality-sync docs, archive and commit.

## Decisions and Notes

- `3333` is minor SEK units per job, never tokens. Six requested ceilings sum
  to 19,998 minor units inside the separate 200 SEK prepaid cap.
- Every execution has `maxModelCalls = 1`; no task-level retry exists.
- Persistent reviewed domain objects/history are the success surface.
- The six calls are D1 observation, D1 relation, first assessment, D2
  observation, second relation and successor assessment.
- No credential is loaded during preflight; the ignored `.env.local` is read
  only in the environment of the exact one-shot Vitest command.
- A checkpoint after every substep is required.

## Charter Amendment Log

- None.

## Verification

- [ ] Record source/infrastructure preflight without content.
- [ ] Record exact journey outcome without content.
- [ ] Record cleanup and repository hygiene.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/JOURNAL.md`
- [ ] completion plan, Slice 9 checklist and `docs/FILESTRUCTURE.md` if needed

## Handoff and Follow-ups

- Current state: offline relation and assessment prompt risks are corrected;
  no ACME-0129 provider call has occurred.
- Next recommended step: prepare and record source/infrastructure preflight.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0129_stage-a-live-reviewer-acceptance.md`.
- Restore task template and add signed Journal entry.
- Supersede rather than rewrite if Goal changes.
