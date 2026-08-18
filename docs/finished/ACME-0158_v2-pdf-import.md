# Current Task

Task ID: ACME-0158
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-18
Last updated: 2026-08-19
Charter frozen at: 2026-08-18

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0050-evidence-v2-pdf-ingestion-boundary.md`
- `docs/adr/0037-evidence-secure-artifact-foundation.md`
- `docs/adr/0038-bounded-text-ingestion-and-immutable-redaction.md`
- `docs/adr/0040-poc-1-live-product-applicability.md`
- `docs/design/evidence-workbench-v2-interface-plan.md` (ACME-0158)

## Task Summary
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

The requested process model begins with "Importera PDF". Until now the product
has imported operator-prepared text and recorded outside-PDF provenance. ADR-0050
accepts one new class, `stage-a-pdf-extracted-text/1`: the received PDF bytes
are the L0 artifact, canonical text is a named pinned derivative, and image-only
or encrypted PDFs fail closed.

ACME-0161 closed the evidence backbone through relations. This task opens the
ingestion path the process model actually starts with. It changes no structure,
chain, observe, review, claim or relation rule.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

A case owner uploads a PDF in the browser and reaches a structured, chained
source without leaving the product.

### Primary Deliverable

The class decided in ADR-0050: exact received bytes stored as the L0 artifact
under the ADR-0037 envelope, canonical text derived by a named pinned
extractor, provenance recorded, structure and chain proposal derived once
inside the import transaction, and a fail-closed refusal for image-only PDFs
and over-bound files.

### In Scope

- The source class `stage-a-pdf-extracted-text/1`.
- A PDF extractor port and one adapter. The library is pinned to an exact
  version, lives in an adapter package, and never appears in a module or
  `packages/core`. The implementing notes record why it was chosen against
  ADR-0050 §4 (determinism) and §5 (refusals).
- Storing the exact received PDF bytes as the immutable artifact version,
  encrypted, with their own content hash, retained rather than discarded.
- Deriving canonical text once inside the import transaction, recorded as a
  representation with `extractionMethod` in the form `<method>/<version>`.
- An extraction-rule version field alongside structure and chain rule
  versions. Changing the extractor is a new artifact version, never an
  in-place re-cut.
- Browser upload on the documents surface, plus the existing text-import
  path left intact (`stage-a-anonymized-judicial-text/1` is not withdrawn).
- Fail-closed refusals with a typed reason and nothing persisted: not a PDF,
  encrypted/password-protected, no or below-threshold text (image-only; OCR
  stays out), over the size bound, over the ADR-0038 canonical-text bound,
  throw/timeout/non-UTF-8 after NFC.
- Offline tests: determinism (same bytes, two processes, identical
  canonical SHA-256), each named refusal, authorization and CSRF, and that
  a refused import writes no artifact, no structure and no chain proposal.
- A recorded import of a bounded Stage A PDF through the product's own
  routes, with the measured digest written down.

### Out of Scope

- OCR. DOCX. Media. Bulk ingestion. Stage B material.
- Any change to `evidence-v2-source-structure/1`, `evidence-v2-chain/1`,
  `evidence-v2-observe/1`, `evidence-v2-review/1`, `evidence-v2-claim/1` or
  `evidence-v2-relation/1`, or their rule versions.
- Re-deriving structure or chains on read (R-10).
- Timeline, consensus, graph visualisation, actor rosters.
- Anonymization inside the product. That remains the operator's obligation.
- Wiring Supabase Auth.
- The degenerate chain subject label in
  `docs/backlog/v2-degenerate-chain-subject.md`.

### Definition of Done

- A PDF that satisfies ADR-0050 §1 imports behind an authorized case-scoped
  route and becomes a structured, chained source identical in kind to a
  text import: parts, units, chains, exact source lines.
- The stored L0 object is the received PDF bytes, encrypted. Its SHA-256 is
  the PDF's, not the text's. Canonical text is a separate representation.
- Extracting the same PDF twice in separate processes yields the same
  canonical SHA-256. The measured digest is recorded.
- Each named refusal in ADR-0050 §5 answers with a typed reason, persists
  nothing, and is content-free in logs.
- Existing text import is unchanged. No migration of existing artifacts.
- A non-member receives 404 on the import write; a write without CSRF is
  refused; the recorded principal is server-derived.
- `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/FILESTRUCTURE.md` and
  `docs/JOURNAL.md` reflect the delivered state.

### Minimum Verification Gates

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm boundaries`
- [x] `pnpm test` (unit, conformance, integration, scenario)
- [x] `pnpm test:postgres` — `evidence-v2-persistence` still passes; the two
      failures attributed in
      `docs/backlog/postgres-gate-test-hygiene.md` remain the only failures
- [x] `pnpm docs:check`
- [x] `pnpm build`
- [x] `git diff --check`
- [x] Determinism proof: same PDF, two separate processes, identical
      canonical SHA-256, digest recorded
- [x] Each ADR-0050 §5 refusal has an offline test that asserts nothing was
      persisted
- [x] Recorded import of a bounded Stage A PDF through the product's own
      authenticated routes. Authorization: second principal 404, missing
      CSRF 401

## References

- [ADR-0050](../adr/0050-evidence-v2-pdf-ingestion-boundary.md)
- [ADR-0037](../adr/0037-evidence-secure-artifact-foundation.md)
- [ADR-0038](../adr/0038-bounded-text-ingestion-and-immutable-redaction.md)
- [ADR-0040](../adr/0040-poc-1-live-product-applicability.md)
- [Interface plan](../design/evidence-workbench-v2-interface-plan.md) ACME-0158
- [ACME-0152](ACME-0152_v2-persistence-and-surfaces.md) — the
  text-import transaction this path must match
- [ACME-0161](ACME-0161_v2-relations.md) — just closed; do not
  reopen relations

## Checklist

- [x] Choose the extractor library against ADR-0050 §4 and §5; pin it; put
      it behind a port in an adapter package.
- [x] Add the extraction-rule version and the PDF representation to the
      artifact record without breaking existing text artifacts.
- [x] Implement fail-closed classification and the named refusals.
- [x] Derive canonical text once inside the existing import transaction,
      then structure and chain proposal exactly as today.
- [x] Store received PDF bytes under the ADR-0037 envelope.
- [x] Browser upload on the documents surface; keep the text-import form.
- [x] Offline tests: determinism, refusals, authorization, no persist on
      refuse.
- [x] Run every verification gate; record results and any skips with reasons.
- [x] Recorded import of a bounded Stage A PDF.
- [x] Update `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `FILESTRUCTURE.md` and
      `JOURNAL.md`.
- [x] Archive this task and restore the template.

## Decisions and Notes
- A checkpoint after each step or substep is required. Checklist is therefore updated along the work and `CURRENT_STATUS.md` is always updated when changes affect the behavior.
- Record decisions and assumptions within the frozen charter.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

Recorded at freeze:

- **The operator ordered this task after ACME-0161.** Sequencing is in
  [the interface plan](../design/evidence-workbench-v2-interface-plan.md).
- **Library choice is an implementation note, not a second ADR.** ADR-0050 §6
  leaves the specific library to this task, provided it is pinned, adapter-
  scoped, and passes the determinism gate.
- **Text import stays.** ADR-0050 §7 does not withdraw
  `stage-a-anonymized-judicial-text/1`.
- **No live model spend.** This task is ingestion. J3 and J4 are unchanged.
- **Library: `pdfjs-dist` 6.2.108, exact.** Mozilla's extractor, adapter-scoped.
  Encryption is a named library refusal. Text assembly is ours — items sorted
  by page then position, pages joined with LF, NFC — so the canonical bytes
  do not depend on a helper's merge heuristic. The extraction rule version is
  `pdfjs-text/1`; the method name is `pdfjs-dist/6.2.108`. Changing either is
  a new artifact version. Canonical text is bounded at 64 MiB, the same
  operational ceiling V2 already uses for text import (source-A is 3.5 MiB).
  That is the stated size bound ADR-0050 requires; it is not the frozen-app
  2 MiB ADR-0038 class, which this application has already outgrown.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

Run 2026-08-19. Nothing skipped.

- typecheck, lint, format:check, boundaries, docs:check (293 files), build and
  `git diff --check`: clean.
- `pnpm test`: unit 955/955 (up from 945), conformance 78, integration 70,
  scenario 26.
- `pnpm test:postgres`: `evidence-v2-persistence` **10/10**. 45 of 47 pass;
  the two failures are the ones attributed in
  `docs/backlog/postgres-gate-test-hygiene.md`, unchanged.
- Two-process extractor determinism: same PDF, two processes, identical
  canonical SHA-256 (adapter test).
- Recorded import on the live API:

| Step | Result |
| --- | --- |
| Create case `ACME-0158 PDF import` | 201 |
| Import PDF | 201, class `stage-a-pdf-extracted-text/1` |
| Received SHA-256 | `109be03f6b9f637beac250bc884cf13f9c072eb787ee394655c81a554411ea7e` — equals the client hash of the PDF bytes |
| Canonical SHA-256 | `1cf3dc7f2bacd8099c083559dfcbbcc52876b5c883af513db5abfa4c14c7a780` — distinct |
| Structure | 1 line, 1 part |
| Second principal | 404 |
| Missing CSRF | 401 |
| Non-PDF | 400 `EVIDENCE_V2_PDF_NOT_PDF` |

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs when long-lived decisions change — none; ADR-0050 is the authority

## Handoff and Follow-ups

- Current state: `Complete`.
- Next recommended step: none activated. Timeline and consensus remain
  unbuilt (ACME-0162).
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
