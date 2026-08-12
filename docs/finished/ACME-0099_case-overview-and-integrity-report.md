# Current Task

Task ID: ACME-0099
Parent Task: None
Status: Complete
Owner: Codex (started), Claude (completed)
Created: 2026-08-12
Last updated: 2026-08-12
Charter frozen at: 2026-08-12

## Task Summary

Complete Stage 7 with a product-facing case overview and deterministic Case
Integrity Report whose rows navigate to source-bound evidence.

## Task Charter

### Goal

Make a case understandable at entry and turn reviewed relations, questions,
changed accounts and assessment attention into a traceable integrity report.

### Primary Deliverable

Versioned pure overview/report contracts, builders, case-first APIs, browser
views and executable citation/count/isolation proofs.

### In Scope

- Counts for sources, pending observations/relations, open questions,
  assessments needing re-review and recent product activity.
- Integrity rows for changed accounts, contradictions, qualifications,
  corrections, temporal conflicts and unresolved questions.
- Exact observation/source/locator references and deterministic identities.
- Case-first API/browser navigation and regression/isolation tests.
- Synchronized architecture/product/operations documentation and archive.

### Out of Scope

- PDF/DOCX/structured download formats (Stage 8).
- New model calls, canonical evidence mutation or non-synthetic authority.

### Definition of Done

- Overview and report derive only from one authorized case snapshot.
- Every report row names the exact source-bound observations behind it.
- Counts/ordering/identities are deterministic and browser-visible.
- Canonical verification passes and documentation is synchronized.

### Minimum Verification Gates

- [x] Contract/builder identity and count tests.
- [x] Case-first API/UI and cross-case isolation tests.
- [x] Existing reviewer/assessment journeys regress green.
- [x] Canonical typecheck/lint/boundaries/tests/build/format/docs/diff gates.

## Checklist

- [x] Add overview and integrity-report contracts/builders.
- [x] Add authorized API and browser surfaces.
- [x] Add deterministic/citation/isolation tests.
- [x] Run canonical verification.
- [x] Synchronize docs, journal and archive.

## Decisions and Notes

- The charter is frozen and synthetic-only.
- This is a pure projection; it never changes canonical evidence or review.
- Row classification reads typed canonical evidence only. `correction`
  relations stay corrections (ADR-0032 pairing already binds them to one
  logical-artifact lineage); a relation is a changed account when its endpoint
  observations share a *resolved* actor key across *different* logical
  artifacts; a `contradicts` relation is temporal when its comparable scope's
  typed bounds cannot both stand (two known bounds do not overlap under
  `evidence-temporal-overlap-1`, or a recorded `document-time` is set against a
  `claimed-event-time`). Model-authored `rationaleCode`/`aspect` text
  classifies nothing, so a candidate generator cannot steer report categories.
- Both read models share one order-insensitive `snapshotDigest` over the case
  workspace/evidence revision, evidence and review overlay. `reportId` derives
  from renderer version, that basis and the ordered rows. No timestamp or actor
  enters either identity.
- Deliberate absences, recorded in the completion plan rather than
  approximated: no per-standing count split, no `scope-mismatch` row kind and
  no diff against a prior report basis. None is in the frozen In Scope list.

## Verification

- [x] `pnpm typecheck` — clean.
- [x] `pnpm lint` — clean.
- [x] `pnpm format:check` — all matched files use Prettier style.
- [x] `pnpm boundaries` — dependency, vocabulary and forbidden-import checks
      passed.
- [x] `pnpm test` — 713 unit (113 files, up from 708/112), 77 conformance,
      62 integration, 26 scenario.
- [x] `pnpm build` — clean.
- [x] `pnpm docs:check` — 201 Markdown files checked.
- [x] `git diff --check` — clean.
- [ ] `pnpm test:postgres` — refused: `ACME_POSTGRES_URL` is not configured in
      this environment. No PostgreSQL result is claimed. Stage 7 adds no
      persistence, schema or migration, so no PostgreSQL surface changed.
- Live provider calls: none. No network call and no wall-clock read in any gate.

## Handoff and Follow-ups

- Current state: Stage 7 complete. Archived as
  `docs/finished/ACME-0099_case-overview-and-integrity-report.md`.
- Next recommended step: Stage 8 deterministic export/audit/operations.
- Follow-ups for a future charter, not defects: per-review-standing count
  splits, a `scope-mismatch` row kind, and a diff between two report bases.
- Blockers: none known.

## Finalize When Complete

- [x] Archive this file under `docs/finished/`.
- [x] Populate `docs/CURRENT_TASK.md` with Stage 8 as ACME-0100 (Draft; the
      charter is not frozen and needs explicit approval).
- [x] Add a signed `docs/JOURNAL.md` entry.
