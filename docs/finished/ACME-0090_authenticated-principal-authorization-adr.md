# ACME-0090 — Decide authenticated principal and authorization foundation

Task ID: ACME-0090
Parent Task: None
Status: Complete
Owner:
Created: 2026-08-12
Last updated: 2026-08-12
Charter frozen at: 2026-08-12 11:05:38 +02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0028-first-poc-evidence-integrity-workbench.md`
- `docs/adr/0029-poc-1-self-hosted-supabase-persistence-platform.md`
- `docs/adr/0031-evidence-review-overlay-and-versioned-views.md`
- `docs/adr/0033-postgresql-persistence-architecture.md`
- `docs/adr/0034-poc-1-hosted-shell-identity-and-topology.md`
- `docs/design/evidence-integrity-workbench-product-completion-plan.md`

## Task Summary

Slice 5 and Evidence slices 0–8 are complete, but the product still trusts one
`unauthenticated-local` reviewer and accepts browser-supplied `reviewerRef` and
workspace targets. Stage 2 requires a durable security decision before code
can introduce identity, sessions, organizations and roles across contracts,
API, browser, persistence and hosted composition.

This task makes that cross-package decision only. Separating the ADR from its
implementation keeps the credential provider, session boundary, role policy
and stored-contract migration independently reviewable before security-
sensitive code is activated.

## Task Charter

The charter is frozen. Goal, Primary Deliverable, scope, Definition of Done and
minimum gates must not be expanded or weakened.

### Goal

Decide the authenticated-principal and organization-authorization architecture
that replaces browser-supplied reviewer identity while preserving ACME's
browser/API, product/core and synthetic-only boundaries.

### Primary Deliverable

An accepted ADR that selects the identity provider and server-side session
boundary, fixes principal and organization-role semantics, defines deny-by-
default authorization and records the compatibility/migration and executable
proof obligations for the later implementation task.

### In Scope

- Decide whether and how self-hosted Supabase Auth is adopted.
- Define credential, session-cookie/token, verification, expiry, refresh,
  logout and revocation boundaries without implementing them.
- Define stable product principal identity, organizations, memberships and the
  initial viewer/reviewer/organization-admin role/action matrix.
- Define server-side workspace-to-organization authorization while keeping
  full case management and case-role isolation for Stage 3.
- Define the migration away from client-supplied `reviewerRef` and
  `principalAssurance: unauthenticated-local`, including immutable history.
- Define adapter, persistence, browser/API and deterministic test seams plus
  the minimum implementation proof matrix.
- Synchronize governing documentation and create a bounded implementation
  follow-up proposal without activating code work.

### Out of Scope

- Authentication/authorization implementation, dependencies or migrations.
- User administration UI, invitations, password reset, MFA or external OAuth.
- Case/workspace CRUD, case membership, case roles or cross-case proof.
- Product audit trail, object storage, encryption/key lifecycle, ingestion,
  redaction, arbitrary uploads or non-synthetic data.
- Case Integrity Report, search/reviewer operations, Slice 9 ADR/data class or
  any weakening of ADR-0028.

### Definition of Done

- ADR-0035 is accepted and resolves the IdP, browser token, server session,
  principal identity, membership, role/action and authorization boundaries.
- The ADR names exact fail-closed rules for missing, expired, revoked,
  malformed and unauthorized requests and forbids browser-selected principals.
- Compatibility covers existing unauthenticated review records, new versioned
  commands/decisions, file/hermetic testing and PostgreSQL rollout/rollback.
- A later implementation charter can be written without reopening a cross-
  package security decision.
- PROJECT_BRIEF, CURRENT_STATUS, SYSTEMDOC, ADR index, completion plan,
  FILESTRUCTURE and JOURNAL consistently reflect the accepted decision and
  retain the synthetic-only barrier.
- Documentation gates pass, the task is archived and CURRENT_TASK is reset.

### Minimum Verification Gates

- [x] Check internal links and balanced Markdown fences with `pnpm docs:check`.
- [x] Run `git diff --check`.
- [x] Verify ADR traceability to ADR-0028/0029/0031/0033/0034 and the product
      completion plan.
- [x] Verify no code, dependency, migration, deploy or non-synthetic authority
      change entered this documentation-only task.

## References

- Supabase self-hosted Auth configuration and session/JWT documentation.
- `apps/evidence-workbench-api/src/index.ts`
- `apps/evidence-workbench-web/src/index.ts`
- `packages/evidence-product-contracts/src/schemas.ts`
- `packages/evidence-product-contracts/src/repository.ts`

## Checklist

- [x] Read governing docs and inspect current principal/workspace trust seams.
- [x] Verify current self-hosted Supabase Auth/JWT/session capabilities against
      primary vendor documentation.
- [x] Write ADR-0035 with decision, alternatives, consequences, migration and
      executable proof matrix.
- [x] Synchronize governing status/system/plan/index/structure documentation.
- [x] Run documentation verification and archive the completed task.

## Decisions and Notes

- This is intentionally an ADR-only task under the task-size rule. Design and
  security-sensitive implementation are separately reviewable deliverables.
- The existing file/local composition must remain a deterministic hermetic
  test path, but it may not define hosted authentication semantics.
- ADR-0028 remains the authority boundary: authenticated users still cannot
  access non-synthetic data.
- Supabase documentation observed 2026-08-12 supports self-hosted Auth,
  disabled signup, short-lived JWT sessions and asymmetric JWKS verification.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

- [x] `corepack pnpm docs:check` passed: 185 Markdown files checked for internal
      links and balanced fences.
- [x] `git diff --check` passed.
- [x] Traceability scan confirms ADR-0035 links ADR-0028/0029/0031/0033/0034,
      the product completion plan and current Supabase primary documentation.
- [x] `git diff --name-only` contains only Markdown documentation and
      `AGENTS.md`; no TypeScript, JSON, dependency, migration or deploy-runtime
      file changed. Deployment documentation describes current reality only.
- [x] ADR-0028 and all governing docs retain the synthetic-only/non-synthetic
      prohibition; no Slice 9 or data-class authority was added.

## Documentation Updates

- [x] `docs/adr/0035-evidence-authenticated-principal-and-authorization.md`
- [x] `docs/adr/README.md`
- [x] `docs/PROJECT_BRIEF.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/design/evidence-integrity-workbench-product-completion-plan.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/JOURNAL.md`

## Handoff and Follow-ups

- Current state: Complete. ADR-0035 is accepted and synchronized; no runtime
  behavior or non-synthetic authority changed.
- Next recommended step: Review and explicitly activate the bounded
  authentication/authorization implementation proposal if accepted.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: None inside the frozen charter; alternatives belong in ADR.

## Finalize When Complete

- Archive as
  `docs/finished/ACME-0090_authenticated-principal-authorization-adr.md`.
- Restore `docs/CURRENT_TASK.md` from the template.
- Add a signed `docs/JOURNAL.md` entry.
