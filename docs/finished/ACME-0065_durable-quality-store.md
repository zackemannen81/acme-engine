# ACME-0065 — Durable quality evaluation store (Q1)

Status: Complete  
Archived: 2026-08-06  
Branch: `chore/gapfixes`

## Goal

Persist post-execution quality evaluations durably with the same append-only
semantics as the in-memory adapter.

## Delivered

- ADR-0026 durable quality store schema decisions
- SQLite migration v2: `quality_evaluations` (+ indexes)
- `createSqliteQualityEvaluationStore` in `@acme/adapter-sqlite`
- Conformance suite over SQLite; close/reopen unit test
- Boundary rule allows sqlite → evaluation

## Not in this task

- CLI `quality inspect` / list (Q2)
- Test UI surface (Q3)
- Live AI judge (Q4)

## Verification

- typecheck, boundaries, unit, conformance, integration, docs:check
