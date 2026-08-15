# Current Task

Task ID: ACME-0115
Parent Task: None
Status: Superseded
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T12:52:15+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- ADR-0039, ADR-0040, ADR-0041 and ADR-0042
- ACME-0113 and ACME-0114

## Task Summary

Run one fresh Stage A real-provider acceptance against active
`evidence.observe-artifact@1.3.0` after deterministic runtime locator derivation
passed every offline and PostgreSQL gate.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Prove one complete `gpt-5.6-luna` candidate batch can pass strict validation,
receive runtime-derived canonical locators and commit source-bound reviewable
observations through the hosted-equivalent POC #1 product composition.

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
  active output `/2`.
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
      complete provider output failed strict schema validation
- [x] Post-run call/commit/observation/locator assertions
- [x] Credential/source/generated-secret Git hygiene checks
- [x] `pnpm docs:check`
- [x] `git diff --check`

## References

- `docs/adr/0042-runtime-derived-observation-locators.md`
- `tests/live/evidence-stage-a-observation.test.ts`
- `docs/finished/ACME-0113_stage-a-bounded-real-provider-acceptance.md`
- `docs/finished/ACME-0114_deterministic-observation-locators.md`
- `C:\Users\zakri\Downloads\Anonymiserad_d1.pdf` (operator source; never imported)

## Checklist

- [x] Activate and freeze the one-call successor charter.
- [x] Reverify and prepare the external strict UTF-8 representation.
- [x] Start and preflight disposable PostgreSQL/S3/key infrastructure.
- [x] Run the exact isolated live acceptance once; schema validation failed
  closed before semantic locator validation.
- [x] Inspect content-free commit/locator evidence and clean disposable state.
- [x] Reality-sync documentation, archive and commit the superseded checkpoint.

## Decisions and Notes

- The user's separately created ACME key and 200 SEK prepaid pot authorize this
  acceptance. `20000` is the monetary ceiling in minor SEK units, not tokens.
- The active contract's 8,192-output-token request is an independent per-call
  technical limit.
- The gate has no retry allowance; `maxModelCalls = 1` includes repair.
- Provider output contains no line fields. Runtime derives them only after an
  exact quote occurs once in canonical text.
- A successful batch proves provider/product interoperability and source
  binding, never exhaustive source coverage.
- A checkpoint after each step or substep is required.
- Source preflight reverified the unchanged 106,907-byte parent SHA-256 as
  `f271fb518b31f6f6ff0ae80b740c078f383b3d44dbdceea43a5ca216c3920fd4`.
  pypdf 6.10.0 default extraction with explicit LF page joining and NFC again
  produced 106,072 strict UTF-8 bytes SHA-256
  `2a2dccd63566dcd6a96347a486088238ab62cad8d83e7b9e943f636511848bb4`:
  52/52 pages non-empty, no NUL/replacement character and no CR bytes.
- Clean loopback PostgreSQL 15 and MinIO are healthy on random host ports with
  new random task-local credentials, artifact KEK and payload key. PostgreSQL
  began with zero public tables; the signed S3 adapter passed
  create/stat/read/delete in the private acceptance bucket.
- The sole call returned `finishReason = stop`, 36,871 input + 2,266 output =
  39,137 total tokens and complete strict JSON with six candidates.
- Four exact quotes occurred uniquely in canonical source text. Two long
  multi-line quotes preserved their alphanumeric text but normalized whitespace
  and therefore remained correctly unbound under ADR-0042 exact matching.
- Candidate six emitted a range whose `from` and `to` were each eight-character
  clock strings visible in the quote, but neither contained a full date, `T`
  or `Z`. Output `/2` requires full UTC ISO timestamps, so schema validation
  reported two `MODEL_RESPONSE_SCHEMA` issues before semantics. Zero engine
  documents and zero product observations committed.
- This one-shot task cannot retry. The bounded successor is an additive offline
  contract that requires short single-line verbatim quotes and requires
  temporal `unknown` unless each normalized value's complete date and clock
  are visible inside that exact quote.

## Charter Amendment Log

- None.

## Verification

- [x] Source and hosted-equivalent preflight recorded above without content.
- [x] Exact one-call outcome: active `@1.3.0`; one encrypted succeeded model
  call, stop, 39,137 total tokens, six strict-JSON candidates; execution failed
  at schema validation with two temporal ISO issues, zero engine documents and
  zero product observations.
- [x] Content-free quote audit: four unique exact matches; two multi-line
  candidates matched only after whitespace normalization and were not accepted.
- [x] Cleanup: both `--rm` containers, Docker network and the exact temporary
  directory containing prepared source/credentials/keys were removed. Parent
  PDF/hash and ignored `.env.local` remain unchanged.
- [x] `pnpm docs:check` and `git diff --check` passed.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md` if long-lived reality changes
- [x] `docs/JOURNAL.md`
- [x] POC completion plan and Slice 9 prerequisite checklist
- [x] `docs/FILESTRUCTURE.md` only if structure changes — not applicable
- [x] ADR only if a new durable decision is discovered — successor decision
  remains unaccepted and requires a separate offline task

## Handoff and Follow-ups

- Current state: the single call failed closed at temporal schema validation;
  no disposable live state remains.
- Next recommended step: freeze an offline contract successor for short
  single-line exact quotes and full-date temporal normalization authority.
- Blockers: current provider behavior may normalize multi-line whitespace and
  may emit time-only ranges where the schema requires full UTC timestamps.
- Child tasks: none.
- Resume condition: never; this one-call charter is consumed and superseded.
- Open questions: none.

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0115_stage-a-runtime-locator-provider-acceptance.md`.
- Restore `docs/CURRENT_TASK.md` from the template.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
