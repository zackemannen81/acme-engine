# ACME-0059 — Outbox redrive (O1)

Status: Complete  
Archived: 2026-08-06  
Branch: `chore/gapfixes`

## Goal

Failed outbox entries can be operator-redriven to `pending` without deleting
evidence or redriving `delivered` rows.

## Delivered

- `ExecutionRepository.redriveOutbox` on memory + SQLite
- `redriveOutbox` coordinator → `acme-outbox-redrive-report/1`
- CLI: `outbox redrive <event-id>` and `outbox redrive --all-failed`
- Conformance + unit + CLI tests

## Constraints

- Only `status === 'failed'` may redrive
- `delivered` → `PERSISTENCE_CORRUPTION`
- Keep `lastError` and `attemptCount`
- Extends ADR-0018 deferred redrive residual

## Verification

- typecheck; unit 576; conformance 61; integration 55; docs:check

## Next

O2 real dispatcher transport or O4 growth alarm.
