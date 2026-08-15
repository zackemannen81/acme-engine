# Current Task

Task ID: ACME-0124
Parent Task: None
Status: Ready
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T18:19:06+02:00

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
- ACME-0121 through ACME-0123

## Task Summary

Run the complete two-source Stage A live reviewer/reassessment acceptance with
the ACME-specific prepaid credential and no mock/provider substitution.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Prove the POC #1 domain vertical end to end on D1/D2: real import, live model,
reviewed evidence assessment, restart, later evidence, stale history and
reviewed successor.

### Primary Deliverable

A recorded green run of
`tests/live/evidence-stage-a-reviewer-journey.test.ts` against fresh PostgreSQL,
private S3 and six individually one-call-bounded `gpt-5.6-luna` jobs.

### In Scope

- Reuse the approved ignored credential without revealing plaintext.
- Reverify/extract D1 and D2 as strict UTF-8 LF/NFC outside Git with exact
  reproducible provenance.
- Preflight clean disposable PostgreSQL, private S3 and random mounted keys.
- Run the exact isolated live journey once with at most six model calls total.
- Use 3,333 minor SEK units per job; six jobs sum to 19,998 minor units within
  the 200 SEK prepaid task ceiling.
- Record only content-free domain/call/persistence evidence and remove every
  disposable resource.

### Out of Scope

- Retry/repair, a seventh provider call, raising the 200 SEK aggregate ceiling
  or treating money as tokens.
- Contract/prompt/code correction after a consumed call, exhaustive coverage,
  Stage B, deployment, push or release.
- Source/provider payload, identifier, credential or personal data in Git.

### Definition of Done

- The isolated gate passes all D1/restart/D2/final-restart domain assertions.
- Exactly six calls at most; every job reports one call and completes.
- Two durable sources, reviewed observation standings, relations/questions,
  reviewed assessment, stale immutable predecessor and reviewed successor are
  visible through case-first product APIs without technical audit.
- Temporary source/credentials/keys/services are removed; content-free outcome
  is reality-synced, archived and committed.

### Minimum Verification Gates

- [x] D1/D2 digest, byte, page and extraction preflight
- [x] Clean PostgreSQL/private S3 health and signed-adapter preflight
- [ ] Exact isolated six-call live journey once
- [ ] Content-free job/domain/persistence/restart assertions
- [ ] Credential/source/key Git hygiene and complete cleanup
- [ ] `pnpm docs:check` and `git diff --check`

## References

- `tests/live/evidence-stage-a-reviewer-journey.test.ts`
- `docs/finished/ACME-0123_stage-a-live-reviewer-harness.md`
- `C:\Users\zakri\Downloads\Anonymiserad_d1.pdf` (operator source; never imported)
- `C:\Users\zakri\Downloads\Anonymiserad_d2.pdf` (operator source; never imported)

## Checklist

- [x] Freeze the six-call monetary/call charter.
- [x] Reverify/prepare both external source representations.
- [x] Start/preflight disposable infrastructure.
- [ ] Run exact isolated journey once; never retry within this task.
- [ ] Inspect content-free evidence and clean disposable state.
- [ ] Reality-sync docs, archive and commit.

## Decisions and Notes

- `3333` is minor SEK units per job, not tokens. Six jobs cap requested budget
  at 19,998 minor units; the separate prepaid pot also caps aggregate spend.
- Every execution has `maxModelCalls = 1`; the test has exactly six executions.
- Success is a persistent reviewed domain assessment/history, not a green ACME
  execution or technical-audit view.
- A checkpoint after every substep is required.
- D1 is unchanged: 106,907 PDF bytes, 52/52 non-empty pages, parent SHA-256
  `f271fb518b31f6f6ff0ae80b740c078f383b3d44dbdceea43a5ca216c3920fd4`;
  pypdf 6.10.0 produced 106,072 LF/NFC UTF-8 bytes SHA-256
  `2a2dccd63566dcd6a96347a486088238ab62cad8d83e7b9e943f636511848bb4`.
- D2 is unchanged: 51,593 PDF bytes, 23/23 non-empty pages, parent SHA-256
  `7a7188fb8ce18d0d952e6d4a342753817b3c57fdb788290c9f142df4dfac3633`;
  pypdf 6.10.0 produced 41,563 LF/NFC UTF-8 bytes SHA-256
  `79efe866cee4c0d445143050ed2d9fa338a4a7bc26b0ccc91312395ea55520ff`.
  Both texts contain zero NUL, replacement characters or CR.
- Fresh PostgreSQL 16 began with zero ACME/evidence tables. Private MinIO,
  random mounted keys and signed S3 create/stat/read/list/delete passed; the
  probe object was removed.

## Charter Amendment Log

- None.

## Verification

- [x] Record content-free source/infrastructure preflight.
- [ ] Record exact job/domain/persistence outcome without content.
- [ ] Record cleanup and repository hygiene.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] completion plan, Slice 9 checklist and `docs/FILESTRUCTURE.md`

## Handoff and Follow-ups

- Current state: both sources and disposable infrastructure passed preflight;
  zero of six provider calls consumed.
- Next recommended step: run the exact isolated live journey once.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0124_stage-a-live-reviewer-acceptance.md`.
- Restore the task template and add a signed Journal entry.
- Supersede rather than rewrite if the Goal changes.
