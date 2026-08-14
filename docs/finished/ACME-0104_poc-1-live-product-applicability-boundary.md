# Current Task

Task ID: ACME-0104
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
- `docs/design/evidence-integrity-workbench-product-definition.md`
- `docs/design/evidence-integrity-workbench-technical-specification.md`
- `docs/design/evidence-integrity-workbench-product-completion-plan.md`
- `docs/backlog/slice-9-prerequisite-checklist.md`
- ADR-0028, ADR-0035, ADR-0036, ADR-0037, ADR-0038 and ADR-0039

## Task Summary

The implemented Evidence Integrity Workbench is still normatively described as
synthetic-only even though POC #1 now has explicit authority to exercise a
bounded live path with anonymized real judicial source documents. Establish the
applicability boundary that separates permanent evidence-integrity invariants
from phase-local synthetic/mock restrictions, and accept a fail-closed live
composition profile before runtime work begins.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Authorize one narrow Stage A live-product path for POC #1 without weakening the
permanent evidence, security, review, case-isolation or product-surface
invariants and without rewriting historical ADRs.

### Primary Deliverable

An accepted ADR defining the POC #1 live applicability boundary, Stage A source
class, mandatory live-composition invariants and explicit relationship to the
synthetic/test profile and earlier ADRs.

### In Scope

- Classify permanent product invariants and phase-local synthetic/mock limits.
- Define Stage A as anonymized, authorized judicial UTF-8 plain text with exact
  external-source provenance; distinguish later Stage B FUP material.
- Define a versioned, fail-closed POC #1 live composition profile requiring
  durable PostgreSQL, a live provider gateway, non-fixture source origin and an
  explicitly authorized live execution path.
- Preserve synthetic fixtures and deterministic mock paths for CI, conformance
  and offline product testing.
- State applicability/supersession relationships without editing historical
  ADR text.
- Reality-sync the active project, status, system and product-plan documents.

### Out of Scope

- Runtime implementation of the live composition profile.
- Provider invocation, ingestion workflow or model-job implementation.
- Importing or committing any real source document.
- Stage B FUP ingestion or authority.
- General-purpose arbitrary file ingestion, OCR, PDF or DOCX parsing.
- Reclassifying every Slice 9 checklist row or closing the full backlog.

### Definition of Done

- ADR-0040 is accepted and indexed.
- Permanent invariants and phase-local restrictions are explicit.
- The Stage A source class and Stage B boundary are explicit.
- The mandatory POC #1 live composition tuple is precise enough to implement
  and test fail closed.
- Historical ADRs remain unchanged and ADR-0040 records how their applicability
  changes.
- Current project/status/system/product-plan documentation reflects the new
  accepted boundary while still describing the runtime as unimplemented.
- Documentation verification passes and the completed task is archived.

### Minimum Verification Gates

- [x] `pnpm docs:check`
- [x] `pnpm format:check`
- [x] `git diff --check`
- [x] Manual cross-document terminology and ADR-link review

## References

- `docs/adr/0028-first-poc-evidence-integrity-workbench.md`
- `docs/adr/0035-evidence-authenticated-principal-and-authorization.md`
- `docs/adr/0036-evidence-case-management-and-isolation.md`
- `docs/adr/0037-evidence-secure-artifact-foundation.md`
- `docs/adr/0038-bounded-text-ingestion-and-immutable-redaction.md`
- `docs/adr/0039-evidence-workbench-live-model-boundary.md`

## Checklist

- [x] Read the required repository and product context in the prescribed order.
- [x] Freeze the task charter as `Ready`.
- [x] Draft and accept ADR-0040.
- [x] Update the ADR index and affected long-lived/product-plan documents.
- [x] Run the verification gates and record the results.
- [x] Add a signed journal entry, archive the task and restore the current-task
  template.
- [x] Commit the completed checkpoint.

## Decisions and Notes

- The operator instruction dated 2026-08-15 is the authority to establish the
  bounded POC #1 Stage A path. It does not authorize arbitrary or Stage B data.
- `synthetic-only` remains valid for the existing synthetic/test composition;
  it ceases to be a universal product invariant once ADR-0040 is accepted.
- No real source material is added by this documentation-only task.
- The operator supplied two anonymized judicial PDFs outside the repository as
  Stage A inputs. Read-only inspection found 52 and 23 text-bearing pages with
  no empty extraction pages. Their content remains outside Git; a later task
  may create operator-prepared UTF-8 text and retain the parent PDF digests and
  extraction identity as ADR-0040 provenance.

## Charter Amendment Log

- None.

## Verification

- [x] `pnpm docs:check` — 210 Markdown files, links and fences clean.
- [x] `pnpm format:check` — all checked source/configuration files clean.
- [x] `git diff --check` — clean.
- [x] Cross-document review — historical ADR files unchanged; profile,
  source-class, Stage A/Stage B and runtime-not-yet-implemented wording agree
  across the brief, status, system document and product documents.

## Documentation Updates

- [x] `docs/PROJECT_BRIEF.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] Product definition, technical specification and completion plan
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] ADR index and ADR-0040

## Handoff and Follow-ups

- Current state: Complete; ADR-0040 is accepted and the runtime remains
  deliberately unimplemented.
- Next recommended step: Implement ADR-0039 and ADR-0040 as a fail-closed live
  composition checkpoint.
- Blockers: None.
- Child tasks: None.
- Resume condition: Immediate.
- Open questions: None for this bounded decision task.

## Finalize When Complete

- Archive this file under `docs/finished/ACME-0104_poc-1-live-product-applicability-boundary.md`.
- Restore `docs/CURRENT_TASK.md` from the template.
- Add a signed `docs/JOURNAL.md` entry.
