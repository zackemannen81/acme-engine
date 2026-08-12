# Current Task

Task ID: ACME-0094
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
- `docs/adr/0029-poc-1-self-hosted-supabase-persistence-platform.md`
- `docs/adr/0033-postgresql-persistence-architecture.md`
- `docs/adr/0035-evidence-authenticated-principal-and-authorization.md`
- `docs/adr/0036-evidence-case-management-and-isolation.md`
- `docs/design/evidence-integrity-workbench-product-completion-plan.md`

## Task Summary

Decide Stage 4's secure artifact foundation before any arbitrary or
non-synthetic ingestion exists. Fix immutable-original/canonical-version
placement, object-store and database consistency, application encryption and
key lifecycle, secret handling, retention/deletion, security audit and
fail-closed recovery boundaries in one accepted ADR.

## Task Charter

### Goal

Establish a complete, implementable security and storage architecture that can
hold artifact bytes without weakening case isolation, provenance or the
synthetic-only barrier.

### Primary Deliverable

One accepted ADR for the Evidence secure artifact foundation, with synchronized
governing and operational documentation and an explicit bounded implementation
handoff.

### In Scope

- Decide artifact metadata, immutable byte-object, canonical derivative and provenance ownership.
- Decide object-store port and hosted/local adapter responsibilities.
- Decide authenticated encryption envelope, key hierarchy, rotation and loss/refusal behavior.
- Decide database/object consistency, idempotency, quarantine and reconciliation.
- Decide server-side secret/credential acquisition and forbidden browser exposure.
- Decide retention, explicit deletion/tombstone and backup/restore boundaries.
- Decide minimum append-only product security audit required before ingestion.
- Preserve case-first authorization and the synthetic-only readiness barrier.

### Out of Scope

- Implement adapters, schemas, migrations, APIs, UI or deployment changes.
- Enable arbitrary text import, redaction, PDF/DOCX/OCR or non-synthetic data.
- Select a legal basis, retention duration or production compliance posture.
- General reviewer workflow, dashboard, search, integrity report or export work.
- Change ACME core or Evidence semantic authority.

### Definition of Done

- ADR status is Accepted and resolves every in-scope decision with mechanisms and failure behavior.
- Original bytes and canonical derivatives have explicit immutable identities and provenance.
- Encryption/key rotation, backup/restore and key-unavailable behavior are executable requirements.
- Case isolation applies to metadata, object keys, audit, reconciliation and deletion.
- Database/object partial failures have a bounded quarantine/recovery protocol.
- Security audit covers artifact access/mutation/export and security administration without storing content.
- The ADR cannot be read as authority for arbitrary or non-synthetic ingestion.
- Governing docs are synchronized and an implementation task is the explicit next stage.
- Documentation verification and `git diff --check` pass.

### Minimum Verification Gates

- [x] Internal links and Markdown fences pass.
- [x] Decision/alternative/consequence/compatibility sections are complete.
- [x] Threat/failure matrix covers cross-case object IDs, tampering, missing keys, partial writes, backup mismatch and deletion.
- [x] `corepack pnpm docs:check`
- [x] `git diff --check`

## References

- `docs/adr/0029-poc-1-self-hosted-supabase-persistence-platform.md`
- `docs/adr/0036-evidence-case-management-and-isolation.md`
- `docs/design/evidence-integrity-workbench-product-completion-plan.md`

## Checklist

- [x] Reconcile existing storage, security and operational constraints.
- [x] Author and accept the secure artifact foundation ADR.
- [x] Add threat/failure and compatibility/migration detail.
- [x] Synchronize governing, status, system and operations documentation.
- [x] Run documentation verification.
- [x] Journal and archive ACME-0094.
- [x] Activate the bounded implementation task.

## Decisions and Notes

- The task is documentation-only.
- Stage 4 must remain synthetic-only. A storage mechanism is not data-use authority.

## Charter Amendment Log

- none

## Verification

- [x] ADR includes complete decision, alternatives, consequences, compatibility,
  migration, follow-ups and a ten-row threat/failure matrix.
- [x] `corepack pnpm docs:check` — 194 Markdown files.
- [x] `git diff --check`

## Documentation Updates

- [x] `docs/adr/README.md`
- [x] `docs/design/evidence-integrity-workbench-product-completion-plan.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] relevant operations documentation

## Handoff and Follow-ups

- Current state: ADR-0037 accepted; Stage 4 implementation is ready.
- Next recommended step: implement the accepted artifact foundation in a separate frozen task.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: concrete object-store adapter and key-provider choices are decided here.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Populate `docs/CURRENT_TASK.md` with the approved implementation task.
- Add a signed `docs/JOURNAL.md` entry.

