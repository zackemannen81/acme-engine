# Driver-level errors reach the caller as non-retryable `INTERNAL`

Status: **Resolved by ACME-0057** (2026-08-06). Kept for discovery context;
do not re-activate as open work.

## Discovery context

Found while proving Milestone 2 rollback in ACME-0034. A fault injected inside
the SQLite `BEGIN IMMEDIATE` transaction rolled back correctly, but the failure
that reached the caller was non-retryable `INTERNAL` because neither repository
adapter translated driver errors.

## Delivered outcome (ACME-0057)

`@acme/adapter-sqlite` classifies recognized driver result codes before they
leave repository DB seams (`packages/adapter-sqlite/src/driver-errors.ts`):

- `SQLITE_BUSY*`, `SQLITE_LOCKED*` → `PERSISTENCE_TRANSIENT`, retryable
- corruption and constraint codes → `PERSISTENCE_CORRUPTION`, non-retryable
- everything else → `INTERNAL` AcmeError (still not a raw driver throw)

Public contracts remain free of SQLite vocabulary; mapping is adapter-owned.
Unit tests cover synthetic codes and a real `SQLITE_BUSY` with
`busy_timeout = 0`. The durability fault fixture is SQLITE_BUSY-shaped so the
engine records `PERSISTENCE_TRANSIENT`.

## Follow-ups outside this proposal

- Caller-side automatic retry of `retryable` errors (nothing consumes the flag
  yet beyond correct classification).
- Stranded-execution operator tooling (gap plan D2 / G06).
