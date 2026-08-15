# Current Task

Task ID: ACME-0106
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- ADR-0036, ADR-0037, ADR-0038, ADR-0040
- ACME-0105 archived task and implementation

## Task Summary

Deliver the first real Stage A data path: a versioned case/import contract for
authorized anonymized judicial UTF-8 text, exact external PDF-to-text
provenance, encrypted immutable representations and a primary browser import
flow. Preserve every synthetic contract and fail closed unless the hosted live
capability exists. Prove the supplied anonymized documents can be prepared and
persisted in PostgreSQL without committing their contents.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Make authorized Stage A judicial text a real, durable, source-first product
object with exact provenance and browser access, ready for the next live model
job.

### Primary Deliverable

An additive `stage-a-anonymized-judicial-text/1` case/import path through the
authenticated API and browser, stored by existing encrypted artifact and
file/PostgreSQL repositories with exact parent-container/extraction provenance.

### In Scope

- Add an additive Stage A case data policy while preserving existing
  `synthetic-only` records and commands.
- Add versioned Stage A import metadata/record schemas with operator and
  provider-transmission attestation, external source reference, acquisition
  time, PDF parent digest/byte length and extraction method/version/page count.
- Require case policy and import data class to match in the ingestion service.
- Keep original extracted UTF-8 bytes and canonical LF/NFC text as separately
  encrypted immutable representations; never ingest/store the parent PDF.
- Permit Stage A case creation/import only when the API composition received a
  validated ACME-0105 live capability.
- Add primary browser controls for a Stage A case and its provenance fields;
  retain the existing synthetic experience unchanged.
- Extend repository/conformance/blackbox tests for additive old/new records,
  policy mismatch, cross-case isolation, exact provenance and restart.
- Prepare the two supplied PDFs outside the repository into strict UTF-8 text,
  inspect the full extraction, and run a real PostgreSQL import/restart proof
  without committing source content.

### Out of Scope

- Product-side PDF parsing/upload, OCR or binary storage.
- Provider invocation, live observations/relations/assessment job and its
  audit; that is the immediate next task.
- Stage B FUP material or any other data class.
- Stage A assessment export policy changes.
- Committing real source bytes, extracted text or secrets.

### Definition of Done

- Existing synthetic case/import records remain byte/contract compatible.
- Stage A metadata and records preserve exact external provenance and reject
  unknown/malformed/credential-shaped authority input.
- Stage A import refuses in a synthetic case, synthetic import refuses in a
  Stage A case, and Stage A API use refuses without the live capability.
- Authenticated browser can create a Stage A case, paste prepared text and see
  the imported immutable source with its data class/provenance.
- File and PostgreSQL paths persist/reopen Stage A import and provenance; case
  isolation remains non-disclosing.
- Both supplied PDFs are fully inspected/prepared outside Git and imported in
  a disposable real PostgreSQL acceptance run with parent hashes and extraction
  identity; restart returns identical records and source hashes.
- Canonical gates pass; task is archived and committed.

### Minimum Verification Gates

- [x] Focused ingestion/auth/API/browser tests
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm boundaries`
- [x] `pnpm test`
- [x] `pnpm test:postgres`
- [x] `pnpm build`
- [x] `pnpm format:check`
- [x] `pnpm docs:check`
- [x] `git diff --check`

## References

- `packages/evidence-product-contracts/src/ingestion.ts`
- `packages/evidence-product-contracts/src/ingestion-service.ts`
- `packages/evidence-product-contracts/src/case.ts`
- `packages/evidence-auth/src/schemas.ts`
- `apps/evidence-workbench-api/src/index.ts`
- `apps/evidence-workbench-web/src/index.ts`
- Two operator-supplied anonymized judicial PDFs retained outside Git

## Checklist

- [x] Activate and freeze the task charter.
- [x] Add Stage A case/import/provenance schemas and validators.
- [x] Enforce policy/class matching and capability gating.
- [x] Extend API/browser primary flow.
- [x] Add file/PostgreSQL/conformance and adversarial tests.
- [x] Prepare and visually/textually verify both supplied PDFs outside Git.
- [x] Run the real PostgreSQL import/restart acceptance.
- [x] Run canonical verification and reality-sync documentation.
- [x] Archive and commit the completed task.

## Decisions and Notes

- ACME imports only operator-prepared text. The parent PDF hash, byte length,
  page count and extraction identity preserve derivation provenance; PDF bytes
  remain outside the product and repository.
- Stage A availability is a composition capability, not a client-supplied
  flag. Browser metadata cannot activate it.
- The Stage A data policy is additive and immutable per case in this increment;
  no existing case is relabelled.

## Charter Amendment Log

- None.

## Verification

- [x] Focused Stage A/auth/browser suite: 20 tests passed; additional existing
      case/local blackbox coverage passed.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm boundaries`, `pnpm build`,
      `pnpm format:check`, `pnpm docs:check` and `git diff --check` passed.
- [x] `pnpm test`: 745 unit, 78 conformance, 62 integration and 26 scenario
      tests passed. One auth test timed out only while build ran concurrently;
      it passed alone and the complete serial rerun passed.
- [x] `pnpm test:postgres`: 35 tests passed against a clean disposable
      `postgres:15`, including the Stage A full-composition restart test.
- [x] Full visual inspection covered all 52 + 23 PDF pages. Pypdf 6.10.0
      prepared strict UTF-8 text outside Git with no empty page, replacement
      character, NUL or bound violation.
- [x] Real acceptance imported both prepared documents into disposable
      PostgreSQL, reopened identical records/source hashes and made zero
      provider calls. Parent/extracted SHA-256 values were recorded in the
      journal; temporary copies were sent to the recycle bin and originals
      remain untouched.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] Product specifications, plan and operations docs

## Handoff and Follow-ups

- Current state: Complete; Stage A import is capability-gated and proven.
- Next recommended step: Consume Stage A imported artifacts through the
  authenticated live evidence job and primary review journey.
- Blockers: None.
- Child tasks: None.
- Resume condition: Immediate.
- Open questions: None within Stage A text-only scope.

## Finalize When Complete

- Archive under `docs/finished/ACME-0106_stage-a-judicial-text-import.md`.
- Restore the current-task template.
- Add a signed journal entry.
