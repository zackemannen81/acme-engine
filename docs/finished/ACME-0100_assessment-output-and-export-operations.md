# Current Task

Task ID: ACME-0100
Parent Task: None
Status: Complete
Owner: MrWhite (charter), Claude (implementation)
Created: 2026-08-12
Last updated: 2026-08-12
Charter frozen at: 2026-08-12

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/design/evidence-integrity-workbench-product-completion-plan.md`
- `docs/finished/ACME-0099_case-overview-and-integrity-report.md`

## Task Summary

Stage 8 of the Evidence Integrity Workbench completion plan: authorized
deterministic assessment output, export audit, backup/restore and operational
controls. Stage 7 delivered the case overview and Case Integrity Report as pure
projections; Stage 8 turns reviewed product results into distributable output
under an explicit export policy and audit gate.

The charter was frozen by the owner on 2026-08-12.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

A case reviewer can
produce an authorized, deterministic, fully cited assessment output whose every
access is audited, without widening data authority.

### Primary Deliverable

A versioned `evidence-assessment-output/1` renderer that emits one reviewed,
fully cited assessment as deterministic PDF, DOCX, Markdown and JSON bytes,
behind an authorized case-first download route that records exactly one
export-audit record per released output, plus a product backup manifest whose
restore verification fails closed on tampering.

### In Scope

 Deterministic PDF/DOCX/Markdown/Json structured outputs, export audit, backup/restore and operational controls.

Read as, per the owner's 2026-08-12 scope decision:

- Deterministic PDF, DOCX, Markdown and JSON outputs of a reviewed assessment,
  every claim carrying its exact source-bound citation.
- `evidence-export-audit-record/1`: format, assessment version, output digest,
  principal, case and time, appended on every released export.
- `evidence-product-backup-manifest/1` and a product restore verification
  mirroring the artifact-level pair from ADR-0037/ACME-0095.
- Bounded operational controls: per-case export enable/disable and a format
  allowlist, deny-by-default.

### Out of Scope

- Non-synthetic data of any class, which remains gated by Stage 9.
- New model calls, canonical evidence mutation and any change to the review
  overlay.

### Definition of Done

- Repeating an export of the same reviewed assessment produces byte-identical
  output in every format; no timestamp, actor or locale enters output bytes.
- Every claim, support, conflict and qualification in every format resolves to
  an exact artifact version, locator and quote inside the same case.
- Every released export appends exactly one export-audit record naming format,
  output digest and server-derived principal; a refused export releases no
  bytes and records the refusal.
- Export is deny-by-default: a disabled case or a format outside the allowlist
  is refused, and a same-organization foreign case stays `404 Not found.`
- Restore verification accepts an intact product backup manifest and fails
  closed on a missing, altered or resurrected record.
- Canonical verification passes and documentation is synchronized.

### Minimum Verification Gates

- [ ] Per-format determinism and citation-resolution tests.
- [ ] Export-audit record and refusal tests, including deny-by-default policy.
- [ ] Product backup manifest and tamper-rejecting restore-verification tests.
- [ ] Case-first API/UI and cross-case isolation tests.
- [ ] Existing reviewer/assessment/export journeys regress green.
- [ ] Canonical typecheck/lint/boundaries/tests/build/format/docs/diff gates.

## References

- `docs/design/evidence-integrity-workbench-product-completion-plan.md`
  (stage 8 row and "Export policy and audit gates required").
- ADR-0037 secure artifact foundation (audit and key lifecycle).
- ADR-0038 bounded text ingestion (export semantics for redacted derivatives).

## Checklist

- [x] Confirm the Stage 8 goal, deliverable and scope, then freeze the charter.
- [x] Complete Primary Deliverable, Definition of Done and Minimum
      Verification Gates from the frozen Goal and In Scope.
- [x] Extract the deterministic ZIP writer so DOCX and the existing reviewed
      ZIP share one implementation.
- [x] Add the `evidence-assessment-output/1` document model and the four
      deterministic renderers (JSON, Markdown, DOCX, PDF).
- [x] Add `evidence-export-audit-record/1` and the per-case export policy
      (enable/disable plus format allowlist, deny-by-default).
- [x] Add `evidence-product-backup-manifest/1` and product restore
      verification.
- [x] Persist audit records and policy in the file and PostgreSQL adapters
      with shared conformance and a migration.
- [x] Add case-first API routes and browser download surfaces.
- [x] Add determinism, citation, audit, policy, isolation and tamper tests.
- [x] Run canonical verification.
- [x] Synchronize docs, journal and archive.

## Decisions and Notes

- A checkpoint after each step or substep is required. The checklist is updated
  along the work and `CURRENT_STATUS.md` is always updated when changes affect
  behavior.
- An export format decision that constrains contracts, persistence or
  compatibility needs an ADR before implementation.
- Stage 7 left three explicit follow-ups that are candidates for this or a
  later charter, none of them defects: per-review-standing count splits in the
  Case Integrity Report, a `scope-mismatch` row kind, and a diff between two
  report bases.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- 2026-08-12 (non-semantic): recorded the freeze date, removed the pre-freeze
  "this charter is Draft" instruction paragraph and updated the stale
  "next recommended step" line. No goal, deliverable, scope or Definition of
  Done text was changed.
- 2026-08-12 (completion of empty required fields): Primary Deliverable,
  Definition of Done and Minimum Verification Gates were still template
  placeholder text at freeze. They are now written from the frozen Goal and
  In Scope plus the owner's recorded scope decision. The owner's In Scope
  sentence is retained verbatim above the reading. Nothing was widened: no
  format, capability or data authority appears that the frozen text did not
  already name.

## Verification

- [x] `pnpm typecheck` — clean.
- [x] `pnpm lint` — clean.
- [x] `pnpm format:check` — all matched files use Prettier style.
- [x] `pnpm boundaries` — passed.
- [x] `pnpm test` — 727 unit (115 files, up from 713/113), 78 conformance (up
      from 77), 62 integration, 26 scenario.
- [x] `pnpm build` — clean.
- [x] `pnpm docs:check` — clean.
- [x] `git diff --check` — clean.
- [ ] `pnpm test:postgres` — refused: `ACME_POSTGRES_URL` is not configured in
      this environment, and the tooling refuses rather than skipping. No
      PostgreSQL result is claimed. Migration v7 and the two PostgreSQL write
      paths are typechecked and conformance-covered but were not executed
      against a server; this is the one gap in this task's evidence.
- Live provider calls: none. No wall-clock read reaches any output byte.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] ADRs when long-lived decisions change — none needed. The owner recorded
      that the export audit needs no new ADR, and no new dependency, data
      class or persistence platform decision was taken. Migration v7 extends
      the existing ADR-0033 architecture.

## Handoff and Follow-ups

- Current state: Stage 8 complete. Stages 1–8 of the product completion plan
  are delivered.
- Next recommended step: none is authorized. Stage 9 non-synthetic readiness is
  the only remaining stage and requires its own ADR and qualified review; it
  cannot activate by implication.
- Blockers: none known.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: which output formats Stage 8 authorizes, and whether the
  export audit needs its own ADR.
  Answer: All formats mentioned under the section ### In Scope, export audit do not need a new ADR.
- Follow-ups for a future charter, not defects: run `pnpm test:postgres` against
  a server to execute migration v7; and Stage 7's three recorded absences
  (per-review-standing count splits, a `scope-mismatch` row kind, a diff
  between two report bases).

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore the template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
