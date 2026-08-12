# Current Task

Task ID: ACME-0095
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
- `docs/adr/0035-evidence-authenticated-principal-and-authorization.md`
- `docs/adr/0036-evidence-case-management-and-isolation.md`
- `docs/adr/0037-evidence-secure-artifact-foundation.md`
- `docs/design/evidence-integrity-workbench-product-completion-plan.md`

## Task Summary

Implement ADR-0037 as the synthetic-only Stage 4 artifact-security boundary:
versioned artifact/envelope/audit contracts, application encryption and key
rotation, local and hosted S3-compatible object adapters, staging/reconciliation,
deletion tombstones, restore verification and migration of the fixed corpus
without changing Evidence identities.

## Task Charter

### Goal

Deliver a verified secure artifact subsystem that stores and retrieves immutable
case-owned bytes with authenticated encryption, auditable access and bounded
cross-store recovery before arbitrary ingestion exists.

### Primary Deliverable

An end-to-end ADR-0037 implementation in product contracts, adapters,
persistence, API/worker composition and operations, backed by conformance,
tamper/isolation/failure/restart/restore proofs.

### In Scope

- Add strict artifact, representation, encrypted-envelope, lifecycle, key-envelope and security-audit contracts.
- Add provider-neutral object-store, key-provider, audit and artifact-service ports/policies.
- Implement AES-256-GCM envelope encryption, verification and DEK re-wrap.
- Implement controlled filesystem and server-side S3-compatible adapters.
- Add file/PostgreSQL metadata, audit and numbered migrations.
- Implement staged activation, idempotency, quarantine/reconciliation and deletion tombstones.
- Route existing fixed synthetic source bytes through encrypted storage while preserving all source ids/locators.
- Audit authorized/denied reads, integrity failures, administrative changes and exports without content.
- Add hosted secret-file/key/object-store configuration with fail-closed startup.
- Add backup-manifest and restore-verification contracts and operational procedure.
- Preserve case-first authorization and the closed arbitrary/non-synthetic input boundary.

### Out of Scope

- Arbitrary drag/drop or text ingestion and any new data class.
- Redaction, PDF/DOCX/OCR/audio/video or transformation beyond existing canonical synthetic text.
- Retention duration/legal-hold policy for real data.
- General reviewer workflow, dashboard, search, integrity report or report formats.
- External KMS/HSM integration beyond the provider port and mounted-secret implementation.
- Changes to ACME core or Evidence semantic authority.

### Definition of Done

- Existing synthetic sources are stored as encrypted immutable representations and reproduce exact artifact identities/locators.
- Plaintext is released only after case authorization, successful audit append and full cryptographic/digest verification.
- Filesystem and hosted S3-compatible adapters pass one object-store conformance contract.
- Key rotation re-wraps DEKs without changing ciphertext or Evidence identity; missing/wrong keys fail closed.
- Partial upload/metadata failures reconcile through staging/quarantine without activating unverified bytes.
- Mixed-case IDs, object keys and provenance are refused without disclosure.
- Deletion is revisioned, unreadable while pending and leaves an irreversible audited tombstone.
- File and PostgreSQL persistence preserve metadata/audit across restart; configured PostgreSQL/S3 gates run or refuse exactly.
- Backup manifest and isolated restore verification detect missing object/key/tombstone resurrection.
- No browser credential/direct object URL, plaintext secret, arbitrary import or non-synthetic authority exists.
- Canonical verification, synchronized docs, journal and archive are complete.

### Minimum Verification Gates

- [x] Crypto known-answer, tamper, AAD, nonce and wrong-key tests.
- [x] Shared object-store conformance for filesystem and S3 test transport.
- [x] Artifact service idempotency, partial-failure, reconcile, quarantine, rotation and delete tests.
- [x] Same-organization cross-case known-ID/object-key non-disclosure tests.
- [x] Existing synthetic corpus identity/locator regression and full reviewer journey.
- [x] File restart and PostgreSQL/S3 environment gate or exact refusal.
- [x] Backup/restore verification and secret-scan gates.
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm boundaries`
- [x] `corepack pnpm test:unit`
- [x] `corepack pnpm test:conformance`
- [x] `corepack pnpm test:integration`
- [x] `corepack pnpm test:scenario`
- [x] `corepack pnpm build`
- [x] `corepack pnpm format:check`
- [x] `corepack pnpm docs:check`
- [x] `git diff --check`

## References

- `docs/adr/0037-evidence-secure-artifact-foundation.md`
- `packages/evidence-product-contracts/`
- `packages/adapter-evidence-product-file/`
- `packages/adapter-evidence-product-postgres/`
- `apps/evidence-workbench-api/`
- `apps/evidence-workbench-worker/`
- `deploy/evidence-workbench/`

## Checklist

- [x] Implement artifact/security contracts and pure service.
- [x] Implement encryption and mounted-secret key providers.
- [x] Implement filesystem and S3-compatible object stores plus conformance.
- [x] Implement file/PostgreSQL metadata, audit and migrations.
- [x] Implement activation, reconciliation, rotation, deletion and restore verification.
- [x] Migrate fixed synthetic corpus and integrate API/worker/export reads.
- [x] Add adversarial security, failure and restart proofs.
- [x] Run focused and canonical verification.
- [x] Synchronize governing and operations documentation.
- [x] Journal and archive ACME-0095.

## Decisions and Notes

- ADR-0037 is normative.
- This task cannot add an arbitrary byte-input API; only existing fixed synthetic fixture import/migration may populate objects.
- Product audit and artifact plaintext release are one fail-closed security boundary.

## Charter Amendment Log

- none

## Verification

- [x] `corepack pnpm typecheck`, `lint`, `boundaries`, `build`,
  `format:check`, `docs:check` and `git diff --check` passed.
- [x] `corepack pnpm test:unit`: 111 files, 695 tests. The first full-load run
  hit the pre-existing five-second timeout in one Evidence black-box at
  5.033s; immediate unchanged rerun passed in 4.447s with all 695 tests.
- [x] `corepack pnpm test:conformance`: 12 files, 74 tests.
- [x] `corepack pnpm test:integration`: 12 files, 62 tests.
- [x] `corepack pnpm test:scenario`: 7 files, 26 tests.
- [x] Focused artifact/API matrix: 13 tests plus secret scan passed.
- [x] `corepack pnpm test:postgres` refused exactly because no
  `ACME_POSTGRES_URL` or equivalent host configuration is present. S3 behavior
  is exercised through the shared hermetic SigV4 test transport; no hosted
  endpoint credentials were available or used.

## Documentation Updates

- [x] `AGENTS.md`
- [x] `docs/PROJECT_BRIEF.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] completion plan and technical specification
- [x] package/deployment/backup/key-rotation operations documentation

## Handoff and Follow-ups

- Current state: ADR-0037 implemented for the fixed synthetic corpus and all
  available gates pass.
- Next recommended step: Stage 5 bounded ingestion/redaction decisions after this passes.
- Blockers: none known.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none; implementation choices are constrained by ADR-0037.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Populate `docs/CURRENT_TASK.md` with the next approved stage.
- Add a signed `docs/JOURNAL.md` entry.
