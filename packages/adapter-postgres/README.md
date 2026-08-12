# @acme/adapter-postgres

Durable `ExecutionRepository` and `QualityEvaluationStore` over plain
PostgreSQL (ADR-0033 / ACME-0085).

## Ownership

- The adapter **receives** an injected `pg.Pool`. It never constructs a pool,
  never reads environment variables, never sizes a pool, and never calls
  `end()`.
- Schema default is `acme`. Every SQL statement is schema-qualified; the
  adapter does not rely on `search_path`.
- Canonical JSON, timestamps and hashes are stored as `text` for byte fidelity
  with `acme-cjson-1`.

## Lifecycle

```ts
import { Pool } from 'pg';
import {
  createPostgresExecutionRepository,
  createPostgresQualityEvaluationStore,
  migratePostgresSchema,
  verifyPostgresSchema,
} from '@acme/adapter-postgres';

const pool = new Pool({ connectionString: process.env.ACME_POSTGRES_URL });
await migratePostgresSchema({ pool }); // explicit; never a side effect of open
await verifyPostgresSchema({ pool });

const repository = createPostgresExecutionRepository({ pool, ids });
const qualityStore = createPostgresQualityEvaluationStore({ pool });

// composition root owns shutdown
await pool.end();
```

## Connection mode

Connect to the **direct** PostgreSQL port (or a session-mode pooler). Do **not**
route the adapter through a transaction-mode pooler (for example Supavisor
transaction mode on port 6543): prepared statements and session state are not
safe there.

## Roles

See `sql/roles.sql` for `acme_engine` grants and browser-role revocations.
Apply after schema migration from an administrative connection.
