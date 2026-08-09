# ACME-0060 — Outbox growth alarm (O4)

Status: Complete  
Archived: 2026-08-06  
Branch: `chore/gapfixes`

## Goal

Operators can see outbox size by status and fail inspect when pending/failed
counts exceed composition-root thresholds.

## Delivered

- `outbox inspect` summary: counts, oldest pending/failed availableAt, alarms
- `--max-pending` / `--max-failed` (non-negative integers)
- SYSTEMDOC host drain note (cron/systemd/CI; no library timer)
- CLI test for threshold alarm

## Verification

- typecheck; CLI suite; docs:check

## Next

O2 real OutboxDispatcher transport.
