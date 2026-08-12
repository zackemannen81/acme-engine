# Current Task

Task ID: ACME-0096
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-12
Last updated: 2026-08-12
Charter frozen at: 2026-08-12

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/adr/0028-first-poc-evidence-integrity-workbench.md`
- `docs/adr/0036-evidence-case-management-and-isolation.md`
- `docs/adr/0037-evidence-secure-artifact-foundation.md`
- `docs/design/evidence-integrity-workbench-product-completion-plan.md`

## Task Summary

Decide Stage 5's bounded plain-text ingestion and immutable redaction boundary
before adding any arbitrary input API: accepted data class, transformation and
locator identity, malware/content limits, original/canonical/redacted lineage,
authorization, audit, failure recovery and explicit non-synthetic prohibition.

## Task Charter

### Goal

Accept one implementable architecture for bounded UTF-8 text ingestion and
immutable redacted derivatives that preserves source provenance and case
isolation without opening the Slice 9 non-synthetic gate.

### Primary Deliverable

One accepted ADR plus synchronized product/technical/operations documentation
that fixes the Stage 5 contracts, trust boundaries, limits, lifecycle and
implementation proof obligations.

### In Scope

- Define the only accepted new input class as bounded synthetic UTF-8 plain text.
- Define immutable received-original, canonical-text and redacted-derivative representations.
- Define canonicalization, content hash, artifact identity and locator stability.
- Define exact redaction operations/logs, overlap rules and source/derived hashes.
- Define authorization, product audit, upload staging and recovery boundaries.
- Define content type, encoding, byte/line/count/rate limits and refusal semantics.
- Define browser/API/worker responsibilities and no-direct-storage rule.
- Define file/PostgreSQL persistence and deterministic conformance obligations.
- Keep PDF, DOCX, OCR, media, archives and all non-synthetic content prohibited.
- Synchronize governing design, status and operations documentation.

### Out of Scope

- Implementing ingestion, redaction UI, parsers or persistence.
- Any non-synthetic data authority or readiness waiver.
- PDF/DOCX/OCR/audio/video/image/archives or active content.
- Semantic extraction changes, model/provider changes or ACME core changes.
- Retention/legal-hold policy for real material.

### Definition of Done

- One accepted ADR fixes the complete bounded-ingestion/redaction architecture.
- The accepted data class and every excluded class are unambiguous.
- Original, canonical and redacted identities/lineage cannot overwrite one another.
- Exact redaction log and locator consequences are specified mechanically.
- Authorization/audit/failure/retry/cross-case requirements are explicit.
- The implementation task has finite executable gates and no policy ambiguity.
- No code behavior or non-synthetic authority changes.
- Docs, journal, verification and archive are complete.

### Minimum Verification Gates

- [x] ADR cross-reference and supersession audit.
- [x] Accepted/excluded data-class matrix review.
- [x] Identity, canonicalization, locator and redaction invariant review.
- [x] Threat/failure/retry/isolation proof matrix review.
- [x] `corepack pnpm docs:check`
- [x] `git diff --check`

## References

- `docs/adr/0037-evidence-secure-artifact-foundation.md`
- `docs/design/evidence-integrity-workbench-product-definition.md`
- `docs/design/evidence-integrity-workbench-technical-specification.md`
- `docs/design/evidence-integrity-workbench-product-completion-plan.md`
- `docs/ops/evidence-artifact-operations.md`

## Checklist

- [x] Audit current artifact/source/locator/redaction boundaries.
- [x] Write and accept the Stage 5 architecture ADR.
- [x] Pin data-class limits, canonicalization and identity.
- [x] Pin immutable redaction operations and exact log.
- [x] Pin authorization, audit, staging and recovery.
- [x] Define executable implementation/conformance/adversarial gates.
- [x] Synchronize governing and operations docs.
- [x] Run documentation verification.
- [x] Journal and archive ACME-0096.

## Decisions and Notes

- The task is frozen and documentation-only.
- Synthetic UTF-8 plain text is the only candidate data class; the ADR may
  narrow or refuse it but may not widen it.
- ADR-0037 remains the secure byte-storage authority.
- Redaction never mutates or replaces an original/canonical representation.

## Charter Amendment Log

- none

## Verification

- [x] ADR matrix and cross-reference review completed; `corepack pnpm
  docs:check` and `git diff --check` pass.

## Documentation Updates

- [x] new ADR and ADR index
- [x] `AGENTS.md`
- [x] `docs/PROJECT_BRIEF.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] product definition, technical specification and completion plan
- [x] operations documentation if implementation prerequisites change (no
  runtime prerequisite changed in this documentation-only task)

## Handoff and Follow-ups

- Current state: ADR-0038 accepted; Stage 5 implementation can be frozen.
- Next recommended step: separately frozen implementation of the accepted ADR.
- Blockers: none known.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: exact synthetic text limits and redaction operation model.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Populate `docs/CURRENT_TASK.md` with the next approved stage.
- Add a signed `docs/JOURNAL.md` entry.
