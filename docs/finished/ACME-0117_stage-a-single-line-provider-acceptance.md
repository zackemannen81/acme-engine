# Current Task

Task ID: ACME-0117
Parent Task: None
Status: Superseded
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T13:10:13+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- ADR-0039 through ADR-0042
- ACME-0115 and ACME-0116

## Task Summary

Run one fresh Stage A real-provider acceptance against active
`evidence.observe-artifact@1.4.0` after short single-line quote and full-date
temporal generation bounds passed every offline and PostgreSQL gate.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Prove one complete `gpt-5.6-luna` candidate batch can pass strict and semantic
validation, receive runtime-derived canonical locators and commit source-bound
reviewable observations through the hosted-equivalent POC #1 composition.

### Primary Deliverable

A recorded pass of `tests/live/evidence-stage-a-observation.test.ts` using the
ACME-specific ignored environment credential, one provider call maximum and
the existing externally enforced 20,000-minor-unit SEK (200 SEK) prepaid
monetary ceiling.

### In Scope

- Reuse the user-approved `OPENAI_API_KEY` from ignored `.env.local` without
  revealing or copying its plaintext.
- Reverify `Anonymiserad_d1.pdf` as the excluded parent and prepare a fresh
  strict UTF-8 LF/NFC representation outside Git with exact provenance.
- Compose clean disposable PostgreSQL and private S3-compatible services plus
  random task-local mounted key files outside Git.
- Preflight the signed S3 adapter and empty PostgreSQL database.
- Run only the isolated Stage A live observation gate with model
  `gpt-5.6-luna`, `maxModelCalls = 1`, cost ceiling `20000`, currency `SEK` and
  active output `/3`.
- Record only non-secret/content-free acceptance evidence and clean all
  disposable source, key and service state.

### Out of Scope

- More than one provider call, repair/retry, relation/assessment calls or a
  second source.
- Raising/bypassing the 200 SEK monetary ceiling or interpreting it as tokens;
  the 8,192 output tokens are a separate per-call bound.
- Exhaustive full-document coverage from one non-exhaustive batch.
- Product-code correction after a consumed call; any new defect requires a
  separately classified task.
- Committing source/provider content, credentials, provider identifiers, key
  material or service data.
- Stage B, arbitrary PDF ingestion, OCR, deployment, publication, push or
  release.

### Definition of Done

- The exact gate completes with `LIVE_OBSERVATION_COMMITTED` and one to eight
  valid source-bound observations with runtime-derived locators.
- Exactly one provider request at most is possible under deployment/run
  budgets and the declared monetary ceiling remains 20,000 minor SEK units.
- Hosted-equivalent PostgreSQL, private S3 storage, durable payload encryption
  and immutable artifact encryption are active.
- Credential/source/key/service material remains outside Git; disposable
  services/files are removed after the run.
- Documentation records content-free call/result metadata and the remaining
  non-exhaustive coverage boundary; task is archived and committed.

### Minimum Verification Gates

- [x] Source digest/byte/page/extraction preflight
- [x] Clean PostgreSQL and private S3-compatible health/adapter preflight
- [ ] Exact `tests/live/evidence-stage-a-observation.test.ts` one-call gate —
      complete provider output failed semantic exact-quote validation
- [x] Post-run call/commit/observation/locator assertions
- [x] Credential/source/generated-secret Git hygiene checks
- [x] `pnpm docs:check`
- [x] `git diff --check`

## References

- `docs/adr/0042-runtime-derived-observation-locators.md`
- `tests/live/evidence-stage-a-observation.test.ts`
- `docs/finished/ACME-0115_stage-a-runtime-locator-provider-acceptance.md`
- `docs/finished/ACME-0116_single-line-observation-candidates.md`
- `C:\Users\zakri\Downloads\Anonymiserad_d1.pdf` (operator source; never imported)

## Checklist

- [x] Activate and freeze the one-call successor charter.
- [x] Reverify and prepare the external strict UTF-8 representation.
- [x] Start and preflight disposable PostgreSQL/S3/key infrastructure.
- [x] Run the exact isolated live acceptance once; semantic validation failed
  closed on five non-verbatim/cross-line candidates.
- [x] Inspect content-free commit/locator evidence and clean disposable state.
- [x] Reality-sync documentation, archive and commit.

## Decisions and Notes

- The user's separately created ACME key and 200 SEK prepaid pot authorize this
  acceptance. `20000` is the monetary ceiling in minor SEK units, not tokens.
- The active contract's 8,192-output-token request is an independent per-call
  technical limit.
- The gate has no retry allowance; `maxModelCalls = 1` includes repair.
- Provider output contains no line fields. Runtime derives them only after an
  exact short single-line quote occurs once in canonical text.
- Normalized time requires a complete calendar date and clock in the same
  quote; time-only source mentions must be returned as `unknown`.
- A successful batch proves provider/product interoperability and source
  binding, never exhaustive source coverage.
- A checkpoint after each step or substep is required.
- Source preflight reverified the unchanged 106,907-byte, 52-page parent
  SHA-256 as
  `f271fb518b31f6f6ff0ae80b740c078f383b3d44dbdceea43a5ca216c3920fd4`.
  pypdf 6.10.0 default extraction with explicit LF page joining and NFC again
  produced 106,072 strict UTF-8 bytes SHA-256
  `2a2dccd63566dcd6a96347a486088238ab62cad8d83e7b9e943f636511848bb4`:
  52/52 pages non-empty with no NUL, replacement character or CR byte.
- Clean loopback PostgreSQL 16 and private MinIO are healthy on random host
  ports with new random task-local credentials, artifact KEK and payload key.
  PostgreSQL began with zero public tables; the signed S3 adapter passed
  create/stat/read/list/delete in the private acceptance bucket.
- The sole call returned `finishReason = stop`, 36,920 input + 1,633 output =
  38,553 total tokens and complete strict output `/3` with eight candidates.
  It emitted no invalid normalized temporal value: two candidates used
  `unknown` and the rest had no temporal bound.
- Three candidate quotes occurred exactly once in canonical source. Five did
  not occur verbatim. Content-free comparison showed that four compressed
  content across canonical line boundaries while changing whitespace and/or
  punctuation; the fifth also changed alphanumeric content. Semantic
  validation reported five `EVIDENCE_QUOTE_NOT_FOUND` issues and committed
  zero engine documents, execution commits and product observations.
- A provider-wire one-line string constraint cannot establish that the text
  came from one canonical source line. The bounded successor must decide an
  additive contract in which the provider selects a deterministic runtime-
  defined source segment and runtime derives the exact quote, or prove an
  equivalently strict source-authority design. Historical replay stays exact.

## Charter Amendment Log

- None.

## Verification

- [x] Source and hosted-equivalent preflight recorded above without content.
- [x] Exact outcome: active `@1.4.0`; one encrypted succeeded model call,
  stop, 38,553 total tokens, eight strict candidates; semantic failure on five
  absent exact quotes, zero engine documents/commits and zero observations.
- [x] Cleanup: both containers, Docker network and the exact temporary
  source/credential/key directory were removed. Parent PDF/hash and ignored
  `.env.local` remain unchanged; `pnpm docs:check` and `git diff --check` pass.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md` if long-lived reality changes
- [x] `docs/JOURNAL.md`
- [x] POC completion plan and Slice 9 prerequisite checklist
- [x] `docs/FILESTRUCTURE.md` only if structure changes
- [x] ADR only if a new durable decision is discovered — the successor
  decision remains unaccepted and belongs to a separate offline task

## Handoff and Follow-ups

- Current state: the sole call failed closed at semantic exact-quote binding;
  no disposable live state remains.
- Next recommended step: freeze an offline additive segment-selection/runtime-
  quote contract while preserving every historical contract for replay.
- Blockers: a strict one-line provider string does not prove membership in one
  canonical source line, and prompt compliance is insufficient authority.
- Child tasks: none.
- Resume condition: never; this one-call charter is consumed and superseded.
- Open questions: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0117_stage-a-single-line-provider-acceptance.md`.
- Restore `docs/CURRENT_TASK.md` from the template.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede instead of rewriting it.
