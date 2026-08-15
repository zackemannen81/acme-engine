# Current Task

Task ID: ACME-0119
Parent Task: None
Status: In Progress
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T13:38:47+02:00

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
- ACME-0117 and ACME-0118

## Task Summary

Run one fresh Stage A real-provider acceptance against active
`evidence.observe-artifact@1.5.0` after runtime-derived segment quote authority
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

- [ ] Source digest/byte/page/extraction preflight
- [ ] Clean PostgreSQL/private S3 health and signed-adapter preflight
- [ ] Exact Stage A one-call live gate
- [ ] Post-run call/commit/observation/locator assertions
- [ ] Credential/source/key Git hygiene and complete cleanup
- [ ] `pnpm docs:check`
- [ ] `git diff --check`

## References

- `docs/adr/0043-runtime-derived-observation-quotes.md`
- `tests/live/evidence-stage-a-observation.test.ts`
- `docs/finished/ACME-0118_runtime-derived-observation-quotes.md`
- `C:\Users\zakri\Downloads\Anonymiserad_d1.pdf` (operator source; never imported)

## Checklist

- [x] Activate/freeze the one-call charter.
- [ ] Reverify/prepare external source representation.
- [ ] Start/preflight disposable infrastructure.
- [ ] Run exact isolated acceptance once.
- [ ] Inspect content-free evidence and clean disposable state.
- [ ] Reality-sync docs, archive and commit.

## Decisions and Notes

- The approved ACME key and 200 SEK pot authorize this call. `20000` means
  minor SEK units, never tokens.
- `maxModelCalls = 1` includes repair; no retry exists.
- Provider selects supplied `sourceSegmentId`; runtime owns quote and locator.
- Success proves interoperability/source binding, not exhaustive coverage.
- A checkpoint after every substep is required.

## Charter Amendment Log

- None.

## Verification

- [ ] Record source/infrastructure preflight without content.
- [ ] Record exact call/result and persistence counts.
- [ ] Record cleanup/docs/hygiene.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md` if long-lived reality changes
- [ ] `docs/JOURNAL.md`
- [ ] completion plan and Slice 9 checklist
- [ ] `docs/FILESTRUCTURE.md` only if structure changes

## Handoff and Follow-ups

- Current state: ACME-0118 is green; no prior disposable live state remains.
- Next recommended step: preflight and consume the sole call.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable before the sole call.
- Open questions: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0119_stage-a-segment-provider-acceptance.md`.
- Restore `docs/CURRENT_TASK.md` from the template.
- Add a signed `docs/JOURNAL.md` entry.
- Supersede rather than rewrite if the Goal becomes invalid.
