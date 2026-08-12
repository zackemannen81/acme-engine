# PostgreSQL operations (ACME-0085 / ADR-0033)

This document covers the durable PostgreSQL path for ACME and the Evidence
Integrity Workbench product store. SQLite remains the local and hermetic CI
default.

## Environment facts (observed 2026-08-12)

| Fact | Value |
| --- | --- |
| Deployed self-hosted major version | PostgreSQL **15** (`15.8` on `supabase-db`) |
| Direct port inside the stack | **5432** |
| Host session-mode pooler | localhost:5432 (Supavisor session) |
| Host transaction-mode pooler | localhost:6543 — **forbidden** for the adapter |

CI and gated development tests use an ephemeral `postgres:15` container, not
the self-hosted stack.

## Connection

Prefer the direct PostgreSQL port (or a session-mode pooler). Do **not** route
`@acme/adapter-postgres` or `@acme/adapter-evidence-product-postgres` through a
transaction-mode pooler: prepared statements and session state are unsafe there.

Environment (composition root only; adapters never read env):

```text
ACME_POSTGRES_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

Or discrete parts: `ACME_POSTGRES_HOST`, `ACME_POSTGRES_PORT` (default 5432),
`ACME_POSTGRES_USER`, `ACME_POSTGRES_PASSWORD`, `ACME_POSTGRES_DATABASE`.

Optional selection:

```text
ACME_PERSISTENCE=postgres   # evidence workbench local composition
acme … --adapter postgres   # CLI
```

## Pool sizing

The composition root owns the pool. Suggested starting point for a single
process against a small shared instance:

| Process | `max` connections | Application name |
| --- | --- | --- |
| CLI command | 4–8 | `acme-cli` |
| Evidence workbench API | 8 | `acme-evidence-workbench` |
| Gated tests | 10 | `acme-test-postgres` |

Account for the platform's own consumers (Supabase services) when sizing against
a shared instance. Each process should set a distinguishable `application_name`.

On shutdown, drain the pool with `pool.end()` after in-flight work. Cancellation
never rolls back a committed ledger write (ADR-0027).

## Schemas and roles

| Schema | Contents | Role |
| --- | --- | --- |
| `acme` | Execution ledger + quality evaluations | `acme_engine` |
| `evidence` | Product store (workspaces, sources, reviews, …) | `evidence_app` |

There are no cross-schema foreign keys and no cross-schema transactions.

Browser isolation: revoke `acme` and `evidence` from `anon`, `authenticated`,
and `PUBLIC`. Apply `packages/adapter-postgres/sql/roles.sql` after migration
from an administrative connection. Slice 7 includes a gate that connects as
`anon` and expects permission denied.

## Migrations

Migrations are numbered, checksummed (`sha256(acme-cjson-1({version,name,statements}))`),
forward-only, and protected by a transaction-scoped `pg_advisory_xact_lock` on a
key derived from the schema name.

- Explicit migrate is authoritative. Process startup **verifies** and refuses to
  serve against an un-migrated or checksum-mismatched schema; it does not migrate
  as a side effect of a worker boot in shared-server deployments.
- CLI and local workbench currently call migrate then verify on first use for
  developer convenience; production rollouts should run migrate as a separate
  operator step before flipping traffic.
- PostgreSQL baselines are independent of SQLite (`initial-revisioned-unit-of-work-pg`
  and `initial-evidence-product-pg`). Checksums are not comparable across drivers.

Programmatic:

```ts
await migratePostgresSchema({ pool, appliedAt: new Date().toISOString() });
await verifyPostgresSchema({ pool });
await migrateEvidenceProductSchema({ pool, appliedAt: new Date().toISOString() });
```

## Backup and restore

Until a production data classification boundary exists (ADR-0028 blocks
non-synthetic data until slice 9), treat backups as infrastructure hygiene:

1. Prefer logical dumps of the `acme` and `evidence` schemas
   (`pg_dump --schema=acme --schema=evidence`).
2. Restore into an empty database, then run `verifyPostgresSchema` /
   product verification before serving.
3. Do not edit applied migration rows or statements in place; checksum
   verification will refuse startup (intended).
4. Keep platform-level volume backups (self-hosted Supabase) as the outer
   envelope; schema dumps remain the portable unit.

Record restore drills before any environment holds data that matters
(ADR-0029 follow-up).

## Verification

```bash
# Ephemeral server (example host port 55432)
docker run -d --name acme-pg-test \
  -e POSTGRES_PASSWORD=acme -e POSTGRES_USER=acme -e POSTGRES_DB=acme \
  -p 55432:5432 postgres:15

export ACME_POSTGRES_URL=postgresql://acme:acme@127.0.0.1:55432/acme
pnpm test:postgres

docker rm -f acme-pg-test
```

`pnpm test:postgres` **refuses** when no connection is configured (does not skip).
The default `pnpm test` suite remains hermetic and excludes `tests/postgres/**`.

## Canonical storage rules (do not weaken)

- Canonical JSON, timestamps, and hashes: `text` only (`jsonb` is refused).
- Memory strength: `double precision`.
- Surrogate keys: `bigint GENERATED ALWAYS AS IDENTITY`.
- Unit of Work isolation: `READ COMMITTED` with conditional CAS writes.
- Multi-statement reads (`loadContext`, `loadReplayEvidence`, `snapshot`):
  `REPEATABLE READ READ ONLY`.
- Outbox lease: single `UPDATE … WHERE event_id IN (SELECT … FOR UPDATE SKIP LOCKED)`.
