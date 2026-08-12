# Current Task

Task ID: ACME-0097
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
- `docs/adr/0037-evidence-secure-artifact-foundation.md`
- `docs/adr/0038-bounded-text-ingestion-and-immutable-redaction.md`
- `docs/design/evidence-integrity-workbench-product-completion-plan.md`

## Task Summary

Implement ADR-0038 end to end: bounded synthetic UTF-8 text import, atomic
original/canonical activation, durable job/retry behavior, immutable redaction
draft/application, exact lineage/audit and a usable case-first browser flow.

## Task Charter

### Goal

Make controlled synthetic document ingestion and immutable redaction real
product workflows without weakening artifact security, Evidence identity,
case isolation or the Slice 9 prohibition.

### Primary Deliverable

Versioned contracts, services, file/PostgreSQL persistence, API/worker/browser
surfaces and executable adversarial proofs implementing ADR-0038.

### In Scope

- Strict import/redaction schemas, identities, limits and reason codes.
- Bounded request streaming and server-side UTF-8/media/control validation.
- Exact-original plus canonical encrypted representation activation.
- Logical artifact/version allocation with optimistic revision and idempotency.
- Durable import jobs, progress, cancellation, retry and reconciliation.
- Redaction drafts, exact operations, admin application and immutable logs.
- New redacted source versions/locators without retargeting old evidence.
- Case-first API and usable browser import/redaction navigation.
- File/PostgreSQL records/migrations and shared conformance.
- Product audit, secret/content scans and cross-case adversarial tests.
- Full documentation and operational synchronization.

### Out of Scope

- Non-synthetic content or policy changes.
- PDF/DOCX/OCR/media/archives/URLs/active content.
- Automatic PII detection, credibility or legal conclusions.
- Model/provider changes beyond existing explicit observe command.
- Reviewer assignment/dashboard/integrity-report stages.

### Definition of Done

- One authorized synthetic text document can be imported through the browser,
  survives restart and is navigable as exact canonical source lines.
- Product metadata contains no imported plaintext; original and canonical
  encrypted objects verify independently and activate together.
- Limits/refusals, retries, cancellation and concurrency behave exactly.
- A reviewer can draft and an admin can apply redaction; the new version and
  exact log survive restart while originals and old citations remain intact.
- All routes/jobs/ids/logs/exports remain case-isolated and audited.
- Excluded types and non-synthetic policies have no accepted route.
- Canonical verification, docs, journal and archive are complete.

### Minimum Verification Gates

- [x] Boundary/pinned identity/canonicalization/redaction vector tests.
- [x] Import/redaction repository conformance for file/PostgreSQL.
- [x] Failure/retry/cancel/concurrency/restart/tamper proofs.
- [x] Role, archived-case and same-organization cross-case black boxes.
- [x] Browser-visible import, redact and source navigation acceptance.
- [x] Existing reviewer journey and source-locator regression.
- [x] PostgreSQL/S3 environment gate or exact refusal.
- [x] Content/secret scan.
- [x] canonical typecheck/lint/boundaries/tests/build/format/docs/diff gates.

## References

- `docs/adr/0038-bounded-text-ingestion-and-immutable-redaction.md`
- `packages/evidence-artifacts/`
- `packages/evidence-product-contracts/`
- `apps/evidence-workbench-api/`
- `apps/evidence-workbench-worker/`
- `apps/evidence-workbench-web/`

## Checklist

- [x] Implement import/redaction contracts, identities and pure transforms.
- [x] Extend repository port and file/PostgreSQL persistence/migrations.
- [x] Implement bounded import and redaction services over ADR-0037.
- [x] Integrate case-first API, durable command jobs and browser UI.
- [x] Add conformance, adversarial, recovery, restart and UI proofs.
- [x] Run focused and canonical verification.
- [x] Synchronize governing, architecture and operations docs.
- [x] Journal and archive ACME-0097.

## Decisions and Notes

- ADR-0038 is normative and the charter is frozen.
- All accepted input remains explicitly synthetic-only.
- Implementation may narrow limits to fail safely but cannot add a data class.

## Charter Amendment Log

- none

## Verification

- [x] `corepack pnpm typecheck`, `lint`, `boundaries`, `build`, `format` and
  `format:check` passed.
- [x] Unit: 112 files / 704 tests; conformance: 12 / 75; integration: 12 / 62;
  scenario: 7 / 26.
- [x] Focused ingestion/redaction vectors, case-first browser black box, file
  restart and file repository conformance passed.
- [x] `corepack pnpm test:postgres` refused exactly because no PostgreSQL
  connection environment is configured; S3 remains covered by its hermetic
  signed-transport conformance.
- [x] `corepack pnpm docs:check` checked 199 Markdown files and
  `git diff --check` passed.

## Documentation Updates

- [x] `AGENTS.md`, project/status/system/file-structure docs
- [x] product definition, technical specification and completion plan
- [x] API/deployment/artifact operations docs
- [x] `docs/JOURNAL.md`

## Handoff and Follow-ups

- Current state: ADR-0038 is implemented and verified for synthetic text.
- Next recommended step: reviewer operations/search.
- Blockers: none known.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none; implementation is bounded by ADR-0038.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Populate `docs/CURRENT_TASK.md` with the next approved stage.
- Add a signed `docs/JOURNAL.md` entry.
