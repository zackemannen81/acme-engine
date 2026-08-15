# Current Task

Task ID: ACME-0126
Parent Task: None
Status: Superseded
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T18:30:07+02:00

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
- ACME-0121 through ACME-0125

## Task Summary

Run the corrected complete two-source Stage A live reviewer/reassessment gate
once from the green ACME-0125 checkpoint.

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

- Reuse the approved ignored credential without revealing plaintext.
- Reverify/extract D1/D2 outside Git with exact provenance.
- Preflight clean PostgreSQL/private S3/random mounted keys.
- Run the exact isolated live journey once with at most six calls total.
- Use 3,333 minor SEK units per job; six jobs total 19,998 minor units.
- Record only content-free evidence and remove all disposable resources.

### Out of Scope

- Retry/repair, a seventh call, raising 200 SEK aggregate ceiling, source or
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

- [x] D1/D2 source and infrastructure preflight
- [ ] Exact isolated live journey once — stopped at relation schema validation
- [x] Content-free call/domain/persistence assertions through stop point
- [x] Credential/source/key cleanup and Git hygiene
- [x] docs and diff checks

## References

- `tests/live/evidence-stage-a-reviewer-journey.test.ts`
- `docs/finished/ACME-0125_source-view-observation-identity.md`
- `C:\Users\zakri\Downloads\Anonymiserad_d1.pdf` (operator source; never imported)
- `C:\Users\zakri\Downloads\Anonymiserad_d2.pdf` (operator source; never imported)

## Checklist

- [x] Freeze one-shot call/monetary charter.
- [x] Prepare/preflight sources and disposable infrastructure.
- [x] Run exact live journey once; two of six calls consumed, no retry.
- [x] Inspect content-free outcome and clean all disposable state.
- [x] Reality-sync docs, archive and commit.

## Decisions and Notes

- `3333` is minor SEK units per job, never tokens. Six requested ceilings sum
  to 19,998 minor units inside the separate 200 SEK prepaid cap.
- Every execution has `maxModelCalls = 1`; no task-level retry exists.
- Persistent reviewed domain objects/history are the success surface.
- A checkpoint after every substep is required.
- D1/D2 parent and pypdf 6.10.0 LF/NFC hashes/byte/page counts reproduce the
  exact ACME-0124 values. Both have all pages non-empty and no NUL, replacement
  character or CR. Fresh PostgreSQL began with zero domain tables; private
  MinIO, random mounted keys and signed S3 operations passed.
- D1 observation completed and committed eight runtime-derived observations;
  reviewer persisted six accepts, one rejection and one unresolved decision.
  The relation call then returned complete output `/1`: eight propositions,
  zero events, four relations (two unresolved, one qualifies, one scope
  mismatch) and three open questions. Two open-question
  `triggeringObservationIds` arrays contained valid unique identifiers but
  were not lexicographically sorted. Strict schema validation emitted two
  `MODEL_RESPONSE_SCHEMA` issues and failed closed before relation projection.
  The active relation prompt does not state the schema's sorted-array rule.
- Calls: D1 observation 66,819 input + 708 output = 67,527; D1 relation 2,925
  input + 2,990 output = 5,915. Four later jobs never started. No retry.
  Exact services/temp were removed; both PDFs and ignored `.env.local` remain
  unchanged.

## Charter Amendment Log

- None.

## Verification

- [x] Record source/infrastructure preflight without content.
- [x] Record exact journey outcome without content.
- [x] Record cleanup and repository hygiene.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/JOURNAL.md`
- [ ] completion plan, Slice 9 checklist and `docs/FILESTRUCTURE.md` if needed

## Handoff and Follow-ups

- Current state: observation/review succeeded; relation failed closed on two
  unsorted identifier arrays and all disposable state is removed.
- Next recommended step: version the relation prompt offline to require every
  set-like identifier array be unique and lexicographically sorted.
- Blockers: this task's one-shot run is consumed.
- Child tasks: none.
- Resume condition: never; task archived as superseded.
- Open questions: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0126_stage-a-typed-reviewer-acceptance.md`.
- Restore task template and add signed Journal entry.
- Supersede rather than rewrite if Goal changes.
