# Current Task

Task ID: ACME-0111
Parent Task: None
Status: Superseded
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15T11:55:52+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- ADR-0039 and ADR-0040
- ACME-0107 through ACME-0110

## Task Summary

Close the remaining POC #1 external acceptance blocker by executing the
existing fail-closed Stage A product gate once against OpenAI, using one
operator-authorized anonymized judicial text source and disposable durable
PostgreSQL/S3-compatible infrastructure.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Prove that the implemented `evidence-poc1-live/1` product composition can
import one authorized Stage A source, make one bounded real provider call and
commit source-bound reviewable observations without weakening any live safety
or data-authority boundary.

### Primary Deliverable

A recorded, reproducible pass of
`tests/live/evidence-stage-a-observation.test.ts` with the ACME-specific
environment credential, one model call maximum and an absolute 20,000 minor
unit SEK ceiling.

### In Scope

- Reuse the user-approved `OPENAI_API_KEY` from ignored `.env.local` without
  revealing or copying its plaintext.
- Use `Anonymiserad_d1.pdf` only as an excluded parent container and prepare
  strict UTF-8 extracted text outside Git with the already recorded pypdf
  extraction identity and parent provenance.
- Compose clean disposable PostgreSQL and S3-compatible services plus
  ephemeral mounted secret files outside Git.
- Run only the isolated Stage A live observation acceptance, with exact live
  opt-ins, model `gpt-5.6-luna`, `maxModelCalls = 1`, cost ceiling `20000` and
  currency `SEK`.
- Record call outcome, non-secret provider/model metadata, source hashes,
  verification and cleanup in repository documentation.
- Correct a bounded defect only if the exact gate exposes one required for
  this acceptance; otherwise make no product-code changes.

### Out of Scope

- More than one provider call, retries through another live test, relation or
  assessment calls, or a second source.
- Raising or bypassing the 20,000 minor unit SEK deployment/run ceiling.
- Committing credentials, source text, source bytes, generated key material,
  provider payload content or disposable service data.
- Stage B, broader data classes, PDF ingestion, OCR, export activation,
  deployment, publication, push or release.
- Provider-account or organization configuration changes.

### Definition of Done

- The exact isolated Stage A gate completes with
  `LIVE_OBSERVATION_COMMITTED` and at least one valid source-bound observation.
- No more than one provider request is possible under both deployment and run
  budgets, and the declared monetary ceiling is 20,000 minor units SEK.
- PostgreSQL, S3-compatible storage, durable payload encryption and immutable
  artifact encryption are active; no file/mock persistence substitutes are
  used.
- The credential remains environment-only and ignored; source/key/service
  material remains outside Git; disposable services and files are cleaned up.
- Documentation records the exact non-secret acceptance evidence and remaining
  scope gates; task is archived and committed with a clean worktree.

### Minimum Verification Gates

- [x] Preflight source digest/byte count/page count/extracted digest
- [x] Preflight clean PostgreSQL and private S3-compatible service health
- [ ] Exact `tests/live/evidence-stage-a-observation.test.ts` live gate — the
      sole call returned incomplete output and did not commit
- [x] Credential/source/generated-secret Git hygiene checks
- [x] `pnpm docs:check`
- [x] `git diff --check`

## References

- `docs/adr/0039-evidence-workbench-live-model-boundary.md`
- `docs/adr/0040-poc-1-live-product-applicability.md`
- `tests/live/evidence-stage-a-observation.test.ts`
- `docs/finished/ACME-0107_stage-a-live-observation-job.md`
- `C:\Users\zakri\Downloads\Anonymiserad_d1.pdf` (operator source; never imported)

## Checklist

- [x] Confirm credential reuse and explicit monetary ceiling.
- [x] Read applicable authority and freeze this bounded charter.
- [x] Prepare and verify the external UTF-8 source representation.
- [x] Start and preflight disposable PostgreSQL/S3/key infrastructure.
- [x] Run the exact one-call live product acceptance; it failed closed on an
      incomplete provider candidate.
- [x] Clean disposable infrastructure and verify Git hygiene.
- [x] Reality-sync documentation for the superseded checkpoint.
- [x] Archive and commit the superseded checkpoint.

## Decisions and Notes

- The user's separately created ACME key and prepaid pot authorize this one
  acceptance. The pot is the external absolute ceiling; the gate additionally
  enforces `20000 SEK` at deployment and run confirmation level.
- One source and one observation operation are sufficient because ACME-0110
  already proves the full observation/relation/assessment/re-review journey
  with injected transport and PostgreSQL restart. This task supplies only the
  missing real-provider proof.
- The live gate has no retry allowance: `maxModelCalls = 1` includes any repair
  attempt. A failure consumes the authorized call and stops this task unless
  the provider is proven not to have received a request.
- The parent PDF remains outside ACME. Only operator-prepared strict UTF-8 text
  enters the product, with exact parent/extraction provenance.
- The fresh LF/NFC representation is 106,072 bytes with SHA-256
  `2a2dccd63566dcd6a96347a486088238ab62cad8d83e7b9e943f636511848bb4`.
  It is not asserted to be byte-identical to ACME-0106's deleted temporary
  representation; the unchanged parent is independently reverified as 106,907
  bytes and SHA-256
  `f271fb518b31f6f6ff0ae80b740c078f383b3d44dbdceea43a5ca216c3920fd4`.
- Disposable `postgres:15-alpine` and `minio/minio:latest` services are healthy
  on loopback-only random ports. The database began with zero public tables;
  the repository's signed S3 adapter passed create/stat/read/delete against the
  private acceptance bucket. All service credentials and encryption keys are
  random task-local files outside Git.
- `20000` is a monetary value in minor SEK units (20,000 öre = 200 SEK), not a
  token limit. The separate provider response used 36,874 input tokens and hit
  the contract's 2,048-output-token limit.
- The single provider call returned `status = incomplete` and
  `finishReason = length`. Its encrypted candidate began as a JSON object but
  ended before the closing delimiter, so the response pipeline correctly
  raised `MODEL_INVALID_RESPONSE` at parse. The product stored zero engine
  commits and zero observations.
- This one-shot charter cannot rerun after its only permitted call was
  consumed. It is superseded rather than widened. ACME-0112 will first version
  and prove a bounded observation-output contract offline; a later separately
  frozen acceptance can make a fresh one-call run under the same 200 SEK
  prepaid monetary ceiling.
- A checkpoint after each step or substep is required. Checklist and durable
  documentation remain truthful throughout the work.

## Charter Amendment Log

- None.

## Verification

- [x] Source preflight: pypdf 6.10.0 default extraction, explicit LF page join
      and NFC; 52 non-empty pages; no NUL or replacement character; parent and
      prepared byte lengths/hashes recorded above.
- [x] Exact live outcome: one `gpt-5.6-luna` call; 36,874 input + 2,048 output
      = 38,922 total tokens; provider incomplete/max-output; pipeline parse
      refusal; no engine commit or product observation. Provider id and
      candidate content are intentionally omitted from repository docs.
- [x] Cleanup: both `--rm` containers and the exact task temp directory were
      removed; original PDF and ignored `.env.local` remain present.
- [x] `pnpm docs:check` checked 218 Markdown files; `git diff --check`
      passed.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md` only if long-lived behavior changes — not applicable
- [x] `docs/JOURNAL.md`
- [x] POC completion/Slice 9 planning documents where the blocker is named
- [x] `docs/FILESTRUCTURE.md` only if structure changes — not applicable
- [x] ADRs only if a new durable decision is discovered — none required

## Handoff and Follow-ups

- Current state: one real call failed closed because the active observation
  contract requested only 2,048 output tokens and did not bound observation
  count; all disposable state is removed.
- Next recommended step: ACME-0112 versions a bounded observation contract and
  proves wire/schema/output-budget behavior offline before a fresh call.
- Blockers: real-provider acceptance cannot pass with the observed unbounded
  candidate shape and 2,048-token output limit.
- Child tasks: none; ACME-0112 is the corrective successor.
- Resume condition: never; archive this superseded one-shot task.
- Open questions: none for the bounded correction.

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0111_stage-a-real-provider-acceptance.md`.
- Restore `docs/CURRENT_TASK.md` from the template.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
