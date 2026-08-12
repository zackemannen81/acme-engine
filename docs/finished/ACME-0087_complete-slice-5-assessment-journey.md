# ACME-0087 — Complete Slice 5 assessment journey

Task ID: ACME-0087
Parent Task: None
Status: Complete
Owner:
Created: 2026-08-12
Last updated: 2026-08-12
Charter frozen at: 2026-08-12 05:26:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- Relevant ADRs under `docs/adr/`

## Task Summary

Complete the already-authorized Evidence Integrity Workbench Slice 5 product
journey. ACME-0082 delivered assessment domain core, storage, attention helpers
and a JSON export helper, but the browser/API/worker composition still lacks
the normative assessment and review-history views, late-evidence re-review
flow, deterministic reviewed-assessment ZIP and full product black-box.

This task keeps the fixed synthetic corpus and single configured local
reviewer. It closes the POC application gap before any authentication,
case-management or Slice 9 readiness work begins.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Enable a human reviewer to create, review, revisit and deterministically export
a source-bound assessment entirely through the Evidence Integrity Workbench,
including the required new-evidence attention and re-review behavior.

### Primary Deliverable

A complete synthetic browser/API/worker journey for E-A01 -> review -> EVAL-E01
late import -> one attention notice -> reaffirm or E-A02 -> reviewed-assessment
export, backed by the two normative primary views and an end-to-end black-box
proof.

### In Scope

- Implement `evidence-primary-assessment-view/1` and
  `evidence-primary-review-history-view/1` schemas, pure builders, registry
  entries and conformance coverage.
- Complete `evidence-primary-work-queue-view/1` with assessment-review items and
  one batched new-evidence notice expressed in reviewer language.
- Persist the product-side change-set/attention evidence required to derive the
  notice after reopen; preserve append-only exact-version review decisions.
- Compose `evidence.propose-assessment@1.0.0` through the bounded product
  API/worker path using deterministic fixtures by default.
- Add named assessment, review-history, re-review and export API commands and
  queries; do not introduce generic record patching.
- Add browser navigation and controls for assessment review, review history,
  new-evidence attention, reaffirmation, revision creation and export.
- Implement the normative `evidence-reviewed-assessment-export/1`
  deterministic uncompressed ZIP bundle with manifest, JSON, Markdown, review
  history and only the cited immutable source versions.
- Preserve file and PostgreSQL product-store parity for every new durable
  product record.
- Add automated and manual product acceptance evidence for the complete
  synthetic journey, including exact source navigation from assessment claims.
- Update all affected package/application documentation and governing docs.

### Out of Scope

- Authentication, sessions, organizations, teams, roles or authorization.
- General case/workspace creation, archival, participants or isolation changes.
- Drag-and-drop, arbitrary file upload, PDF, DOCX, OCR, audio, image or video.
- Object storage, encryption/key-management changes or redaction workflow.
- Search, assignment, comments, bulk review, Case Integrity Report or PDF/DOCX
  report generation.
- Technical-audit expansion, ACME core changes or new Evidence relation
  semantics.
- Live-provider default behavior, provider spending, non-synthetic data or the
  Slice 9 ADR/readiness decision.

### Definition of Done

- Both normative Slice 5 primary view contracts are implemented as pure,
  detached and deterministically sorted `/1` views with stable source links.
- The work queue identifies assessment review and produces exactly one factual
  notice for the EVAL-E01 import after E-A01's effective review basis.
- A reviewer can create and accept E-A01, inspect immutable review history,
  import EVAL-E01, and either reaffirm the unchanged assessment or create and
  review E-A02 without modifying E-A01 bytes.
- Every material assessment citation navigates to the exact immutable artifact
  version and locator through the product API and browser.
- Two exports over identical assessment, effective decisions and source bytes
  are byte-identical; every bundled citation resolves offline; non-synthetic
  export is refused.
- The export matches the technical specification's file set, canonical JSON,
  UTF-8/LF/NFC Markdown, lexicographic ZIP order, store/no-compression mode,
  fixed metadata and exported SHA-256 rules.
- The complete primary journey succeeds with technical audit disabled and no
  database, CLI or raw-JSON intervention.
- File and PostgreSQL persistence retain assessment, change-set, review and
  export inputs across close/reopen; existing reviewer paths do not regress.
- Product wording preserves the non-adjudicative authority boundary and does
  not introduce prohibited legal or credibility conclusions.
- Required verification passes, affected docs reflect reality, JOURNAL has a
  signed handoff, the task is archived and `CURRENT_TASK.md` is reset.

### Minimum Verification Gates

- [x] `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm boundaries`,
      `pnpm test`, `pnpm docs:check` and `pnpm build`.
- [x] Focused unit and conformance tests for assessment/review-history/work-
      queue views, change-set persistence and deterministic export.
- [x] API/worker integration proof for create, review, late import, attention,
      reaffirm/new-version and export.
- [x] Full browser-visible synthetic domain black-box with technical audit off.
- [x] File-store close/reopen and gated `pnpm test:postgres` parity/restart
      proof for new durable records.
- [x] Duplicate/replay/resume cases record explicit provider-call counts and
      use no network.
- [x] Two byte-identical ZIP exports plus offline resolution of every bundled
      citation and a non-synthetic refusal case.
- [x] Forbidden-vocabulary/product-separation scan, internal links, balanced
      Markdown fences and `git diff --check`.

## References

- `docs/design/evidence-integrity-workbench-product-completion-plan.md`
- `docs/design/evidence-integrity-workbench-product-definition.md`
- `docs/design/evidence-integrity-workbench-technical-specification.md`,
  sections 7-10, 13 and 15 Slice 5
- `docs/adr/0028-first-poc-evidence-integrity-workbench.md`
- `docs/adr/0030-evidence-v1-identity-and-canonical-placement.md`
- `docs/adr/0031-evidence-review-overlay-and-versioned-views.md`
- `docs/finished/ACME-0082_assessment-re-review.md`
- `packages/module-evidence/src/attention.ts`
- `packages/module-evidence/src/export.ts`
- `packages/evidence-product-contracts/`
- `packages/evidence-views/`
- `apps/evidence-workbench-api/`, `apps/evidence-workbench-worker/` and
  `apps/evidence-workbench-web/`

## Checklist

- [x] Review this Draft charter, resolve any requested narrowing and freeze it
      at `Ready` without expanding its product outcome.
- [x] Add failing contract/conformance cases for the two missing primary views,
      assessment queue items, attention notice and durable change sets.
- [x] Implement product schemas, repository operations and file/PostgreSQL
      persistence for the missing Slice 5 records.
- [x] Implement pure assessment, review-history and completed work-queue views.
- [x] Compose assessment execution and re-review commands through the bounded
      worker/API path with deterministic fixtures.
- [x] Add browser assessment, history, attention and re-review navigation while
      keeping technical audit optional and disabled by default.
- [x] Implement the normative deterministic ZIP renderer and authorized
      synthetic download endpoint.
- [x] Prove E-A01 -> EVAL-E01 -> reaffirm and E-A02 branches, old-byte
      immutability, exact source navigation and export determinism.
- [x] Run all minimum verification gates and record exact results/skips.
- [x] Synchronize package docs, SYSTEMDOC, CURRENT_STATUS, FILESTRUCTURE and
      JOURNAL; archive ACME-0087 and reset CURRENT_TASK when complete.

## Decisions and Notes

- This task completes existing normative `/1` product contracts; it does not
  create a new product-contract generation or change Evidence authority.
- The current `evidence-assessment-export/1` canonical-JSON helper is partial
  implementation evidence, not the normative reviewed-assessment ZIP promised
  by the specification.
- Principal assurance remains exactly `unauthenticated-local`; the browser
  identity seam is deliberately not hardened inside this task.
- Workspace policy remains exactly `synthetic-only` in every successful path.
- E-A01, EVAL-E01 and E-A02 stay bound to the sealed evaluation fixtures. No
  golden truth may become prompt input or runtime product authority.
- A checkpoint follows each checklist step. Keep this checklist truthful and
  update `CURRENT_STATUS.md` whenever behavior changes.
- Apply `docs/TASK_WORKFLOW.md` to discoveries. Auth, case management,
  ingestion, security hardening and Case Integrity Report are later tasks, not
  checklist additions.
- Implementation checkpoint: the two primary views, assessment queue and one
  batched attention notice, durable file/PostgreSQL change sets, bounded
  propose/re-review routes, browser assessment/history/source-locator flow and
  stable reviewed ZIP are implemented. Focused view/file/API tests pass (8/8),
  root typecheck passes, PostgreSQL conformance/restart passes (27/27), and the
  file black-box proves close/reopen. Full repository gates and the manual
  browser walkthrough were subsequently run.
- The final source-binding audit found that every sealed question has at least
  one EVAL-E01-dependent trigger. ACME-0088's narrower assumption was therefore
  superseded before implementation. ACME-0089 corrected the fixture under a
  frozen child charter: E-A01 now has no question references, E-A02 retains all
  three post-import questions, and both derived identities are re-pinned.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

- [x] `corepack pnpm typecheck`, `lint`, `format:check`, `boundaries`, `build`
      and `docs:check` passed; the final docs check covered 182 Markdown files.
- [x] Direct canonical suites passed after the child correction: unit 97
      files/657 tests, conformance 11 files/70 tests, integration 11 files/57
      tests and scenario 7 files/26 tests.
- [x] Root `corepack pnpm test` cannot enter its nested scripts because the
      globally resolved pnpm is 10.33.4 while the repository requires 10.34.5;
      all four wrapped scripts passed directly through Corepack.
- [x] Focused child regression/API tests passed: 5 files/10 tests.
- [x] PostgreSQL conformance/restart suite passed 27/27 against the existing
      local test instance; no container state was changed.
- [x] Record an automated black-box and a manual browser walkthrough of the
      complete primary journey.
- [x] Confirm technical-audit-disabled behavior and synthetic-only refusal.
- [x] `git diff --check` passed. No required environment-dependent check was
      skipped; the wrapper limitation above was worked around without reducing
      test coverage.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs when long-lived decisions change (none required; ACME-0089 was a
      correction under existing identity and review decisions)

## Handoff and Follow-ups

- Current state: Complete. The full synthetic Slice 5 product journey and its
  corrected source-bound fixtures passed automated, persistence and browser
  acceptance evidence.
- Next recommended step: activate only the next explicitly approved product-
  completion task; Slice 9 and non-synthetic handling remain separate.
- Blockers: None.
- Child tasks: ACME-0088 (superseded before implementation); ACME-0089 —
  Re-seal E-A01 without late open-question references (complete).
- Resume condition: Satisfied; ACME-0089 archived its updated deterministic
  identity vectors without changing the normative import order.
- Open questions: None inside this charter.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
