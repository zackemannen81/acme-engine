# Current Task

Task ID: ACME-0113
Parent Task: None
Status: Superseded
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T12:23:59+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- ADR-0039, ADR-0040 and ADR-0041
- ACME-0111 and ACME-0112

## Task Summary

Run the separately authorized real-provider Stage A acceptance once against
the bounded active observation contract delivered by ACME-0112.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Prove that `evidence.observe-artifact@1.2.0` completes one real OpenAI call and
commits a bounded source-bound observation batch through the hosted-equivalent
POC #1 product composition.

### Primary Deliverable

A recorded pass of `tests/live/evidence-stage-a-observation.test.ts` using the
ACME-specific ignored environment credential, one provider call maximum and
the existing externally enforced 20,000-minor-unit SEK (200 SEK) prepaid
monetary ceiling.

### In Scope

- Reuse the user-approved `OPENAI_API_KEY` from ignored `.env.local` without
  revealing or copying its plaintext.
- Reverify `Anonymiserad_d1.pdf` as the excluded parent and prepare a fresh
  strict UTF-8 LF/NFC text representation outside Git with exact provenance.
- Compose clean disposable PostgreSQL and private S3-compatible services plus
  random task-local mounted key files outside Git.
- Preflight the repository's S3 adapter and an empty PostgreSQL database.
- Run only the isolated Stage A live observation acceptance with model
  `gpt-5.6-luna`, `maxModelCalls = 1`, cost ceiling `20000`, currency `SEK` and
  the active `@1.2.0` contract.
- Record only non-secret, content-free acceptance evidence; clean all
  disposable source, keys and service state; update durable documentation.

### Out of Scope

- More than one provider call, repair/retry, relation or assessment calls, or
  a second source.
- Raising, bypassing or interpreting the 200 SEK monetary ceiling as a token
  limit; the 8,192 output tokens are a separate per-call bound.
- Full-document coverage or completeness claims from one non-exhaustive batch.
- Committing credentials, source/provider payload content, provider response
  identifiers, key material or disposable service state.
- Product-code correction after a consumed call; any new defect requires a
  separately classified successor task.
- Stage B, arbitrary PDF ingestion, OCR, export activation, deployment, push,
  publication or release.

### Definition of Done

- The exact gate completes with `LIVE_OBSERVATION_COMMITTED` and one to eight
  valid source-bound observations.
- Exactly one provider request at most is possible under deployment and run
  budgets; the declared monetary ceiling remains 20,000 minor SEK units.
- Hosted-equivalent PostgreSQL, private S3-compatible storage, durable payload
  encryption and immutable artifact encryption are active.
- Credential/source/key/service material remains outside Git and disposable
  services/files are removed after the run.
- Documentation records non-secret call/result metadata, verification and the
  remaining non-exhaustive coverage boundary; task is archived and committed.

### Minimum Verification Gates

- [x] Source digest/byte/page/extraction preflight
- [x] Clean PostgreSQL and private S3-compatible health/adapter preflight
- [ ] Exact `tests/live/evidence-stage-a-observation.test.ts` one-call gate —
      the sole call completed but semantic quote/locator binding refused all
      six candidates
- [x] Post-run database result and call-count assertions from the live gate
- [x] Credential/source/generated-secret Git hygiene checks
- [x] `pnpm docs:check`
- [x] `git diff --check`

## References

- `docs/adr/0039-evidence-workbench-live-model-boundary.md`
- `docs/adr/0040-poc-1-live-product-applicability.md`
- `docs/adr/0041-bounded-observation-candidate-batches.md`
- `tests/live/evidence-stage-a-observation.test.ts`
- `docs/finished/ACME-0111_stage-a-real-provider-acceptance.md`
- `docs/finished/ACME-0112_bounded-observation-candidate-contract.md`
- `C:\Users\zakri\Downloads\Anonymiserad_d1.pdf` (operator source; never imported)

## Checklist

- [x] Activate and freeze the one-call successor charter.
- [x] Reverify and prepare the external strict UTF-8 representation.
- [x] Start and preflight disposable PostgreSQL/S3/key infrastructure.
- [x] Run the exact isolated live acceptance once; it failed closed at semantic
  quote/locator validation.
- [x] Inspect only content-free outcome evidence and clean all disposable state.
- [x] Reality-sync documentation, archive and commit the superseded checkpoint.

## Decisions and Notes

- The user's separately created ACME key and 200 SEK prepaid pot authorize this
  one acceptance. `20000` is the same monetary ceiling in minor SEK units, not
  a token budget.
- The active contract's 8,192-output-token request is an independent per-call
  technical limit.
- The gate has no retry allowance: `maxModelCalls = 1` includes any repair.
  Once the provider receives a request, the task stops after that outcome.
- One successful batch proves provider/product interoperability and source
  binding, not exhaustive source coverage.
- The parent PDF stays outside ACME; only freshly prepared strict UTF-8 text is
  imported with exact immutable parent/extraction provenance.
- Source preflight reverified the unchanged 106,907-byte parent SHA-256 as
  `f271fb518b31f6f6ff0ae80b740c078f383b3d44dbdceea43a5ca216c3920fd4`.
  pypdf 6.10.0 default extraction with explicit LF page joining and NFC
  produced a fresh 106,072-byte strict UTF-8 representation SHA-256
  `2a2dccd63566dcd6a96347a486088238ab62cad8d83e7b9e943f636511848bb4`:
  52/52 pages non-empty, no NUL/replacement character and no CR bytes.
- Clean loopback PostgreSQL 15 and MinIO services are healthy on random host
  ports with new random task-local credentials, artifact KEK and payload key.
  PostgreSQL began with zero public tables. The repository's signed S3 adapter
  passed create/stat/read/delete and confirmed removal in the private bucket.
- The first Vitest invocation used the default configuration, which excluded
  `tests/live/**` and reached neither test code nor provider. The corrected
  invocation used `vitest.live.config.ts`; exactly that invocation made the
  sole allowed provider call.
- The call returned `finishReason = stop`, 36,900 input + 2,340 output =
  39,240 total tokens and a complete strict-JSON response containing six
  candidates. This confirms ACME-0112 removed the truncation defect.
- All six exact quotes occur verbatim in the source, but the model-authored
  line locators did not bind to their addressed ranges. Five reported starts
  were two lines late and one was four lines late; end deltas were one to three
  lines. The semantic pipeline emitted six
  `EVIDENCE_QUOTE_BINDING_FAILED` issues and committed nothing.
- This one-shot task cannot be retried. The bounded successor is an offline
  contract/runtime change that derives canonical line locators from a uniquely
  occurring exact quote rather than accepting model-authored line authority.
- A checkpoint after each step or substep is required.

## Charter Amendment Log

- None.

## Verification

- [x] Source and hosted-equivalent preflight recorded above without content.
- [x] Exact one-call outcome: one succeeded encrypted model-call record under
  active `evidence.observe-artifact@1.2.0`; provider `openai`, model
  `gpt-5.6-luna`, stop, 39,240 total tokens, strict JSON, six candidates;
  execution failed at semantic validation with zero engine documents and zero
  product observations.
- [x] Cleanup: both `--rm` containers, Docker network and the exact temporary
  directory containing prepared source, credentials and keys were removed.
  The 106,907-byte parent PDF/hash and ignored `.env.local` remain unchanged.
- [x] `pnpm docs:check` and `git diff --check` passed.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md` only if long-lived reality changes
- [x] `docs/JOURNAL.md`
- [x] POC completion plan and Slice 9 prerequisite checklist
- [x] `docs/FILESTRUCTURE.md` only if structure changes — not applicable
- [x] ADR only if a new durable decision is discovered — successor decision
  remains unaccepted and requires its own offline task

## Handoff and Follow-ups

- Current state: one active-contract call completed strict JSON but failed
  closed because model-authored line locators did not bind; no disposable live
  state remains.
- Next recommended step: freeze an offline successor that removes locator
  authority from the model and derives line ranges from unique exact quotes.
- Blockers: real-provider acceptance cannot pass while correct verbatim quotes
  may carry non-canonical model-authored line numbers.
- Child tasks: none.
- Resume condition: never; this one-call charter is consumed and superseded.
- Open questions: none.

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0113_stage-a-bounded-real-provider-acceptance.md`.
- Restore `docs/CURRENT_TASK.md` from the template.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
