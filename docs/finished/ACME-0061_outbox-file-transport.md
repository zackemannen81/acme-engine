# ACME-0061 — File OutboxDispatcher transport (O2)

Status: Complete  
Archived: 2026-08-06  
Branch: `chore/gapfixes`

## Goal

Provide a real, offline-testable outbox transport beyond the CLI report
dispatcher, without importing a product message bus.

## Delivered

- `apps/cli/src/outbox-file-dispatcher.ts` — `createFileOutboxDispatcher`
- Envelope `acme-outbox-file-delivery/1` (one JSON file per `eventId`)
- CLI: `outbox drain --transport file --outbox-dir <path>` (report remains default)
- Unit + CLI SQLite tests

## Constraints

- Composition-root transport only (ADR-0018)
- At-least-once: redelivery overwrites same `eventId` file
- No cloud queue product selection

## Next

O3 — minimal domain-event emission from a reference module.
