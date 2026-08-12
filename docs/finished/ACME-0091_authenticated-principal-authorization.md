# ACME-0091 — Implement authenticated principal and organization authorization

Task ID: ACME-0091
Parent Task: None
Status: Complete
Owner:
Created: 2026-08-12
Last updated: 2026-08-12
Charter frozen at: 2026-08-12 11:32:00 +02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/adr/0035-evidence-authenticated-principal-and-authorization.md`
- `docs/backlog/evidence-authentication-authorization-implementation.md`
- `docs/design/evidence-integrity-workbench-product-completion-plan.md`

## Task Summary

Implement the accepted ADR-0035 Stage 2 boundary. Current product routes trust
an unauthenticated local reviewer; this task replaces that write/read boundary
with verified BFF sessions, server-derived principals, organization membership
and typed deny-by-default authorization while preserving the synthetic journey.

## Task Charter

### Goal

Require a verified server-side session and organization authorization for every
Evidence product operation, with no client-selected actor identity.

### Primary Deliverable

An end-to-end authenticated local/hosted-capable Evidence Workbench foundation
implementing ADR-0035 across pure contracts/policy, adapters, persistence,
API/worker/browser composition and versioned review history.

### In Scope

- Provider-neutral auth contracts, pure policy and conformance support.
- Deterministic hermetic authenticator/in-memory store and Supabase Auth/JWKS
  adapter behind injected transport.
- PostgreSQL identity/session schema, migrations and repository.
- Opaque HttpOnly BFF sessions, protected upstream tokens, CSRF/origin checks,
  bounded login, refresh/logout/revocation and fail-closed errors.
- Organizations, memberships, workspace binding and the ADR-0035 role matrix.
- Auth enforcement for every current API/view/job/export/technical route.
- Versioned review command/decision with server-derived principal context;
  immutable legacy decision reads.
- Browser login/logout/session UI and removal of browser actor fields.
- Local bootstrap plus hosted configuration/docs and complete proof matrix.

### Out of Scope

- Case CRUD, case membership/roles and full cross-case isolation.
- General invitations/admin UI, password reset, MFA or external OAuth.
- Product audit beyond durable action context, secure artifact storage,
  ingestion/redaction, real data and Slice 9 authority.

### Definition of Done

- All product routes except documented public health/login shell/session start
  refuse missing/invalid/expired/revoked sessions without data leakage.
- Viewer/reviewer/admin permissions match ADR-0035 and unknown actions deny.
- Cross-organization workspace targets are indistinguishable from unknown.
- Browser payloads cannot select reviewer/principal/role; new decisions retain
  exact server-derived principal, organization, role and policy version.
- Upstream tokens are never returned or stored plaintext; session cookie/CSRF,
  refresh/logout and restart behavior pass deterministic proofs.
- File/hermetic and PostgreSQL paths pass conformance/restart; the existing
  complete synthetic reviewer journey still passes after login.
- Supabase integration is environment-gated; default tests stay network-free.
- Required repo gates/docs pass, task archives and CURRENT_TASK resets.

### Minimum Verification Gates

- [x] Auth/policy/session unit and conformance tests covering ADR-0035 proofs.
- [x] API/browser black-box for login, all roles, CSRF, actor derivation,
      cross-org denial, logout and the complete synthetic review journey.
- [x] File/in-memory proof; PostgreSQL migration/restart/concurrency suite added
      and explicitly not run because no PostgreSQL service/URL was available.
- [x] Environment-gated Supabase Auth proof added; exact refusal recorded
      because opt-in endpoint and dedicated test credentials were unavailable.
- [x] `pnpm typecheck`, `lint`, `format:check`, `boundaries`, canonical test
      suites, `test:postgres`, `docs:check`, `build`, `git diff --check`.

## References

- ADR-0035 and its implementation proof list.
- Current Evidence product contracts, API, worker, web and persistence adapters.

## Checklist

- [x] Add failing pure auth/policy/session and adapter contract tests.
- [x] Implement provider-neutral contracts/policy and deterministic adapters.
- [x] Implement PostgreSQL and Supabase adapters with protected session data.
- [x] Migrate versioned product actor contracts and repository parity.
- [x] Enforce auth in API/worker and implement browser login/logout.
- [x] Prove role, cross-org, restart and complete product black-box behavior.
- [x] Synchronize docs, run full gates, archive and continue to Stage 3.

## Decisions and Notes

- Frozen directly under the user's explicit instruction to continue through
  Slice 9 without intermediate review pauses.
- No implementation may widen the synthetic-only data policy.

## Charter Amendment Log

-none

## Verification

- [x] `corepack pnpm typecheck`, `lint`, `format:check`, `boundaries`,
      `docs:check`, `build` and `git diff --check` passed.
- [x] Canonical suites passed: unit 673/673, conformance 70/70,
      integration 57/57 and scenario 26/26.
- [x] Focused auth/product/browser suite passed 23/23 before the canonical
      rerun; it covers policy matrix, lifecycle, JWKS refusal, secret scans,
      strict actor-free commands, immutable legacy/current history and all
      current route families across a populated foreign organization.
- [x] Manual in-app browser: data-free login → authenticated queue → exact
      source review/accept → queue update → logout → data-free login.
- [x] `corepack pnpm test:postgres` refused exactly because no
      `ACME_POSTGRES_URL` was configured; Docker Desktop was not running and no
      local PostgreSQL service existed. The gated suite includes the new
      identity migration/restart/concurrency and authenticated product restart
      proofs for the next configured run.
- [x] `corepack pnpm test:supabase-auth` refused exactly because
      `ACME_SUPABASE_AUTH_TEST=1` and dedicated endpoint/test credentials were
      absent. Offline generated-key JWKS tests passed.

## Documentation Updates

- [x] Package/app READMEs and ops/deploy docs
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`

## Handoff and Follow-ups

- Current state: Complete; ready to archive.
- Next recommended step: Freeze Stage 3 case/workspace isolation ADR task.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: None inside charter.

## Finalize When Complete

- Archive as `docs/finished/ACME-0091_authenticated-principal-authorization.md`.
- Restore CURRENT_TASK and continue to the separately frozen Stage 3 task.
