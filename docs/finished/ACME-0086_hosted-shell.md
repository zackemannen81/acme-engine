# ACME-0086 — Hosted shell

Task ID: ACME-0086
Parent Task: None
Status: Complete
Owner: Grok
Created: 2026-08-12
Last updated: 2026-08-12
Charter frozen at: 2026-08-12

## Read First

- `AGENTS.md`
- `docs/adr/0034-poc-1-hosted-shell-identity-and-topology.md`
- `docs/adr/0033-postgresql-persistence-architecture.md`
- `docs/ops/postgresql-operations.md`
- Technical specification section 15 slice 8

## Task Summary

Implement Evidence Integrity Workbench slice 8: hosted multi-process shell on
PostgreSQL with the same primary reviewer journey, synthetic-only policy and
no browser-to-database access.

## Task Charter

Frozen under ADR-0034 (single-user hosted identity) and ADR-0033 persistence.

### Goal

Complete the identical primary Evidence review journey through hosted web, API
and worker processes backed by self-hosted Supabase PostgreSQL, with restart
durability.

### Primary Deliverable

Hosted composition (API + worker + web shell) selectable with PostgreSQL
adapters, deployment configuration, operations notes, and a black-box proof of
the primary journey plus restart continuity.

### In Scope

- Hosted/multi-process composition entry points for Evidence workbench
- Docker Compose (or equivalent) deployment config against PostgreSQL
- Observability basics (structured logs, health endpoint)
- Opt-in live provider gate only; default deterministic fixtures
- Black-box / restart durability tests
- Documentation

### Out of Scope

- Supabase Auth/Storage/Realtime/Studio
- Multi-tenant IdP, real-data paths
- Changing core or domain contracts
- Replacing local single-process workbench

### Definition of Done

- Hosted composition runs API+worker against PostgreSQL
- Primary journey black-box succeeds (import/observe/review surfaces)
- Restart continues the same workspace (product + ledger durable)
- Browser never reaches `acme`/`evidence` schemas
- Synthetic-only policy enforced
- Docs synchronized; task archived

### Minimum Verification Gates

- [x] Hermetic `pnpm test`, typecheck, lint, format, boundaries, docs, build
- [x] Hosted/process black-box or integration proof
- [x] Restart durability proof
- [x] `git diff --check`

## Checklist

- [x] Accept ADR-0034 for single-user hosted identity
- [x] Hosted composition entry + docker-compose
- [x] Health endpoint and ops notes
- [x] Black-box and restart proof
- [x] Docs, archive, commit, push

## Handoff

- Current state: Ready; implementing
- Next after complete: slice 9 readiness (governance) only when authorized
