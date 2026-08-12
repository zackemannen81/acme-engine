# Current Task

Task ID: ACME-0093
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
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0035-evidence-authenticated-principal-and-authorization.md`
- `docs/adr/0036-evidence-case-management-and-isolation.md`
- `docs/design/evidence-integrity-workbench-product-completion-plan.md`

## Task Summary

Implement ADR-0036 as the synthetic-only Stage 3 product boundary. Add
case lifecycle and participants, migrate the fixed workspace into an explicit
case, make product HTTP navigation case-first, persist immutable case-object
ownership and prove same-organization cross-case non-disclosure across every
current product route and worker path.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Deliver usable case/workspace management whose executable contracts and
persistence make one case unable to read, mutate or infer another case's
Evidence objects even inside the same organization.

### Primary Deliverable

An end-to-end ADR-0036 implementation in product/auth contracts, memory/file/
PostgreSQL adapters, API, worker and browser, backed by case-management and
adversarial isolation verification.

### In Scope

- Add versioned case, case membership, case command/view and case-object binding contracts.
- Extend pure authorization with case roles, lifecycle and organization-admin administration rules.
- Implement case provisioning, list/search/update/archive/restore and participant management.
- Add case-scoped product repository operations, ownership validation and legacy synthetic migration.
- Add equivalent memory, file and PostgreSQL persistence behavior and reconciliation.
- Version product HTTP/browser navigation to case-first routes and remove browser workspace authority.
- Propagate server-resolved case scope through jobs, reviews, assessments, citations and exports.
- Prove same-organization isolation and mixed-case refusal across all current route families.
- Preserve the immutable legacy review history and synthetic-only policy.

### Out of Scope

- Non-synthetic or arbitrary ingestion and any change to `synthetic-only`.
- Artifact object storage, encryption/key lifecycle, redaction or retention deletion.
- General evidence search, case templates, hard deletion, sharing links or break-glass access.
- Full product activity audit, PDF/DOCX export or Case Integrity Report.
- Changes to Evidence legal/non-adjudicative authority or ACME core.

### Definition of Done

- Cases can be created, listed, searched, inspected, updated, archived/restored and assigned participants through strict authenticated APIs.
- Browser-facing evidence routes and commands use `caseId`; supplied `workspaceId`, actor, role or organization authority is rejected.
- Explicit active case membership controls content access; organization-admin alone cannot read case evidence.
- Every current case-bound object has immutable durable ownership and mixed-case references fail before commit.
- Same-organization adversarial black-boxes prove non-disclosure for views, sources, history, assessments, exports, jobs/events/cancel, commands and technical audit.
- Fixed synthetic data migrates/reconciles into one case without changing evidence identity or historical decisions.
- Memory/file behavior passes canonical tests; PostgreSQL passes when configured or records an exact environment refusal.
- Canonical typecheck, lint, boundary, unit, conformance, integration, scenario, build, docs, format and diff gates pass.
- Governing documentation is synchronized, the task is journaled/archived and the next approved stage is explicit.

### Minimum Verification Gates

- [x] Pure case-role/action and case lifecycle tests.
- [x] Product repository case isolation conformance for memory and file adapters.
- [x] Same-organization two-case API black-box over every current route family.
- [x] Adversarial known-ID and mixed-case reference refusal tests.
- [x] Browser shell proof with no workspace/actor authority.
- [x] PostgreSQL case migration/restart gate or exact recorded environment refusal.
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

- `docs/adr/0036-evidence-case-management-and-isolation.md`
- `packages/evidence-auth/`
- `packages/evidence-product-contracts/`
- `packages/adapters/evidence-auth-memory/`
- `packages/adapters/evidence-auth-postgres/`
- `packages/adapters/evidence-product-file/`
- `packages/adapters/evidence-product-postgres/`
- `apps/evidence-workbench-api/`
- `apps/evidence-workbench-worker/`
- `apps/evidence-workbench-web/`

## Checklist

- [x] Implement case/auth schemas, policy and identity repositories.
- [x] Implement case/product ownership contracts and scoped repository operations.
- [x] Implement memory, file and PostgreSQL persistence/migration/reconciliation.
- [x] Implement case-first API, worker and browser navigation.
- [x] Add lifecycle, participant and adversarial isolation tests.
- [x] Run focused verification and correct defects.
- [x] Run the canonical verification matrix.
- [x] Synchronize governing documentation and operational guidance.
- [x] Journal and archive ACME-0093.

## Decisions and Notes

- ADR-0036 is normative; checklist refinements may only fulfill its frozen implementation outcome.
- Stage 3 remains synthetic-only. A discovered need for real input, artifact encryption or audit is later-stage work, not an implementation shortcut.

## Charter Amendment Log

- none

## Verification

- [x] Focused policy, file repository, case lifecycle, participant CAS,
  case-first browser and same-organization black-box tests passed.
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm boundaries`
- [x] `corepack pnpm test:unit` — 105 files / 682 tests.
- [x] `corepack pnpm test:conformance` — 11 files / 70 tests.
- [x] `corepack pnpm test:integration` — 11 files / 57 tests.
- [x] `corepack pnpm test:scenario` — 7 files / 26 tests.
- [x] `corepack pnpm build`
- [x] `corepack pnpm format:check`
- [x] `corepack pnpm docs:check` — 192 Markdown files.
- [x] `git diff --check`
- [x] `corepack pnpm test:postgres` refused exactly because
  `ACME_POSTGRES_URL` (or discrete host/port/user/password/database) was not
  configured; no PostgreSQL test was silently skipped.

## Documentation Updates

- [x] `AGENTS.md`
- [x] `docs/PROJECT_BRIEF.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] completion plan, technical specification and product definition where reality changes
- [x] package/deployment READMEs where operator behavior changes

## Handoff and Follow-ups

- Current state: ADR-0036 is implemented and verified; Stage 3 is complete.
- Next recommended step: activate the Stage 4 secure artifact foundation decision task.
- Blockers: PostgreSQL runtime proof was explicitly refused because no ACME_POSTGRES_URL or discrete PostgreSQL environment was configured; the hermetic implementation and refusal gate pass.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none; implementation trade-offs are constrained by ADR-0036.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of rewriting it.

