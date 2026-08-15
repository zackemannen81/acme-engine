# Current Task

Task ID: ACME-0121
Parent Task: None
Status: Superseded
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T13:54:37+02:00

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
- ACME-0119 and ACME-0120

## Task Summary

Run one fresh Stage A real-provider acceptance against active
`evidence.observe-artifact@1.6.0` after the canonical-UTC prompt correction
passed every offline and PostgreSQL gate.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Prove one complete `gpt-5.6-luna` segment-selection batch can pass strict and
semantic validation and commit runtime-derived source-bound observations
through the hosted-equivalent POC #1 composition.

### Primary Deliverable

A recorded pass of `tests/live/evidence-stage-a-observation.test.ts` using the
ACME-specific ignored credential, one provider call maximum and the existing
20,000-minor-unit SEK (200 SEK) prepaid monetary ceiling.

### In Scope

- Reuse the approved ignored `OPENAI_API_KEY` without revealing plaintext.
- Reverify D1 and prepare the same strict UTF-8 LF/NFC representation outside
  Git with exact provenance.
- Compose/preflight clean disposable PostgreSQL, private S3 and random mounted
  payload/artifact keys.
- Run only the isolated Stage A gate with `gpt-5.6-luna`, one call maximum,
  active output `/4`, cost ceiling `20000` and currency `SEK`.
- Record only content-free evidence and clean every disposable resource.

### Out of Scope

- Retry/repair, more than one provider call, relation/assessment or D2.
- Raising the 200 SEK ceiling or treating it as tokens; 8,192 output tokens
  remain a separate technical bound.
- Exhaustive coverage, code correction after a consumed call, source/provider
  content in Git, Stage B, deployment, push or release.

### Definition of Done

- Gate completes `LIVE_OBSERVATION_COMMITTED` with one to eight observations
  whose quotes/locators are runtime-derived from selected supplied segments.
- Exactly one call at most; durable PostgreSQL, private S3 and both encryption
  boundaries are active.
- Temporary source, credentials, keys and services are removed.
- Content-free outcome and non-exhaustive boundary are documented, archived
  and committed.

### Minimum Verification Gates

- [x] Source digest/byte/page/extraction preflight
- [x] Clean PostgreSQL/private S3 health and signed-adapter preflight
- [ ] Exact Stage A one-call live gate — product completed and committed, but
  the gate has a stale terminal reason-code assertion
- [x] Post-run call/commit/observation/locator assertions
- [x] Credential/source/key Git hygiene and complete cleanup
- [x] `pnpm docs:check`
- [x] `git diff --check`

## References

- `docs/adr/0043-runtime-derived-observation-quotes.md`
- `tests/live/evidence-stage-a-observation.test.ts`
- `docs/finished/ACME-0119_stage-a-segment-provider-acceptance.md`
- `docs/finished/ACME-0120_canonical-utc-observation-prompt.md`
- `C:\Users\zakri\Downloads\Anonymiserad_d1.pdf` (operator source; never imported)

## Checklist

- [x] Activate/freeze the one-call charter.
- [x] Reverify/prepare external source representation.
- [x] Start/preflight disposable infrastructure.
- [x] Run exact isolated acceptance once; no retry remains.
- [x] Inspect content-free evidence and clean disposable state.
- [x] Reality-sync docs, archive and commit.

## Decisions and Notes

- The approved ACME key and 200 SEK pot authorize this call. `20000` means
  minor SEK units, never tokens.
- `maxModelCalls = 1` includes repair; no retry exists.
- Provider selects supplied `sourceSegmentId`; runtime owns quote and locator.
- Success proves interoperability/source binding, not exhaustive coverage.
- A checkpoint after every substep is required.
- Parent PDF is unchanged: 106,907 bytes, 52 pages, SHA-256
  `f271fb518b31f6f6ff0ae80b740c078f383b3d44dbdceea43a5ca216c3920fd4`.
  pypdf 6.10.0 reproduced 106,072 strict LF/NFC UTF-8 bytes SHA-256
  `2a2dccd63566dcd6a96347a486088238ab62cad8d83e7b9e943f636511848bb4`;
  52/52 pages are non-empty, with no NUL, replacement character or CR.
- Fresh loopback PostgreSQL 16 began with zero ACME/evidence tables. Private
  MinIO and new random mounted keys are healthy; signed S3
  create/stat/read/list/delete passed and removed its probe object.
- The sole call returned stop, 66,819 input + 650 output = 67,469 total tokens
  and eight output `/4` candidates. All eight selected segment IDs were valid,
  supplied and unique. Runtime derived all eight exact quotes and one-line
  locators, then wrote one committed execution, document and commit plus eight
  observations. The product job completed with its implemented
  `LIVE_OBSERVATION_COMPLETED` reason; the live test alone still expected the
  obsolete `LIVE_OBSERVATION_COMMITTED`, so Vitest reported failure after the
  durable commit.
- Child ACME-0122 corrected the stale live assertion and added an offline
  PostgreSQL success-code assertion. Focused 2/2 and all canonical offline
  gates pass; no provider call occurred in the child.
- Exact containers, network, temporary source and four key/credential files
  were removed. The parent PDF hash is unchanged; `.env.local` remains present
  and ignored. No provider identifier, source content or secret entered Git.

## Charter Amendment Log

- None.

## Verification

- [x] Source/infrastructure preflight recorded without content.
- [x] Exact call/result and persistence counts recorded without content.
- [x] Complete cleanup and docs/hygiene recorded.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] completion plan and Slice 9 checklist
- [x] `docs/FILESTRUCTURE.md`

## Handoff and Follow-ups

- Current state: sole provider call committed successfully and all disposable
  state is removed; this task is superseded because its frozen primary
  deliverable required a green Vitest invocation that did not occur.
- Next recommended step: separately freeze the remaining Stage A
  relation/assessment provider acceptance and reviewer journey.
- Blockers: none for product observation evidence; process-level deliverable is
  impossible without violating this task's one-call/no-retry bound.
- Child tasks: ACME-0122 (complete).
- Resume condition: never; task archived as superseded.
- Open questions: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0121_stage-a-canonical-utc-provider-acceptance.md`.
- Restore `docs/CURRENT_TASK.md` from the template.
- Add a signed `docs/JOURNAL.md` entry.
- Supersede rather than rewrite if the Goal becomes invalid.
