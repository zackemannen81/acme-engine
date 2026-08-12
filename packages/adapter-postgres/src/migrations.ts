import { AcmeError, nodeHashing, type Hashing } from '@acme/core';
import type { Pool, PoolClient } from 'pg';

import { assertSchemaName, qIdent, schemaAdvisoryLockKey } from './schema.js';
import {
  execute,
  queryAll,
  queryOne,
  withWriteTransaction,
} from './transaction.js';
import { withPostgresDriverErrors } from './driver-errors.js';

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly statements: readonly string[];
}

interface AppliedMigrationRow {
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
}

/**
 * Build version-1 baseline DDL for a fully qualified schema. Table shapes
 * mirror `@acme/adapter-sqlite` with PostgreSQL type substitutions from
 * ADR-0033: text for JSON/timestamps/hashes, bigint IDENTITY for surrogates,
 * double precision for strength. Quality evaluations are included in v1
 * (own checksum baseline; not comparable to SQLite).
 */
export function buildInitialSchemaStatements(
  schema: string,
): readonly string[] {
  const s = qIdent(assertSchemaName(schema));
  return Object.freeze([
    `CREATE TABLE ${s}.executions (
    execution_id text PRIMARY KEY,
    namespace text NOT NULL,
    request_key text NOT NULL,
    request_fingerprint text NOT NULL,
    task text NOT NULL,
    entity_id text NOT NULL,
    expected_revision integer NOT NULL CHECK (expected_revision >= 0),
    input_json text,
    input_hash text NOT NULL,
    request_json text NOT NULL,
    policy_json text NOT NULL,
    contract_id text NOT NULL,
    contract_version text NOT NULL,
    contract_fingerprint text NOT NULL,
    status text NOT NULL,
    current_stage text NOT NULL,
    result_json text,
    error_json text,
    created_at text NOT NULL,
    updated_at text NOT NULL,
    terminal_at text,
    UNIQUE (namespace, request_key)
  )`,
    `CREATE INDEX executions_by_entity_status
    ON ${s}.executions (namespace, entity_id, status)`,
    `CREATE TABLE ${s}.execution_attempts (
    attempt_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    execution_id text NOT NULL REFERENCES ${s}.executions(execution_id),
    attempt_number integer NOT NULL,
    stage text NOT NULL,
    outcome text NOT NULL,
    retry_at text,
    diagnostic_json text,
    occurred_at text NOT NULL,
    UNIQUE (execution_id, attempt_number, stage)
  )`,
    `CREATE TABLE ${s}.model_calls (
    model_call_id text PRIMARY KEY,
    execution_id text NOT NULL REFERENCES ${s}.executions(execution_id),
    call_key text NOT NULL,
    attempt integer NOT NULL,
    purpose text NOT NULL,
    provider text,
    model text,
    selection_json text NOT NULL,
    request_hash text NOT NULL,
    request_payload text,
    response_hash text,
    response_payload text,
    provider_response_id text,
    usage_json text,
    record_json text NOT NULL,
    status text NOT NULL,
    error_json text,
    started_at text NOT NULL,
    completed_at text,
    UNIQUE (execution_id, call_key, attempt)
  )`,
    `CREATE TABLE ${s}.documents (
    document_id text PRIMARY KEY,
    execution_id text NOT NULL REFERENCES ${s}.executions(execution_id),
    namespace text NOT NULL,
    entity_id text NOT NULL,
    document_key text NOT NULL,
    kind text NOT NULL,
    schema_version text NOT NULL,
    value_json text NOT NULL,
    content_hash text NOT NULL,
    created_at text NOT NULL,
    UNIQUE (execution_id, document_key)
  )`,
    `CREATE INDEX documents_by_entity_kind
    ON ${s}.documents (namespace, entity_id, kind)`,
    `CREATE TABLE ${s}.memory_candidates (
    candidate_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    execution_id text NOT NULL REFERENCES ${s}.executions(execution_id),
    candidate_key text NOT NULL,
    kind text NOT NULL,
    schema_version text NOT NULL,
    value_json text NOT NULL,
    candidate_json text NOT NULL,
    decision_json text NOT NULL,
    created_at text NOT NULL,
    UNIQUE (execution_id, candidate_key)
  )`,
    `CREATE TABLE ${s}.memory_records (
    memory_id text PRIMARY KEY,
    namespace text NOT NULL,
    entity_id text NOT NULL,
    identity_key text NOT NULL,
    kind text NOT NULL,
    schema_version text NOT NULL,
    value_json text NOT NULL,
    strength double precision NOT NULL,
    status text NOT NULL,
    record_version integer NOT NULL,
    first_seen_at text NOT NULL,
    last_seen_at text NOT NULL,
    last_reinforced_at text NOT NULL,
    provenance_json text NOT NULL,
    UNIQUE (namespace, entity_id, identity_key)
  )`,
    `CREATE INDEX memory_records_active_by_entity
    ON ${s}.memory_records (namespace, entity_id, status)`,
    `CREATE TABLE ${s}.state_heads (
    namespace text NOT NULL,
    entity_id text NOT NULL,
    revision integer NOT NULL,
    value_hash text NOT NULL,
    PRIMARY KEY (namespace, entity_id)
  )`,
    `CREATE TABLE ${s}.state_snapshots (
    namespace text NOT NULL,
    entity_id text NOT NULL,
    revision integer NOT NULL,
    schema_version text NOT NULL,
    value_json text NOT NULL,
    value_hash text NOT NULL,
    execution_id text NOT NULL REFERENCES ${s}.executions(execution_id),
    created_at text NOT NULL,
    PRIMARY KEY (namespace, entity_id, revision)
  )`,
    `CREATE TABLE ${s}.state_transitions (
    transition_id text PRIMARY KEY,
    operation_key text NOT NULL,
    namespace text NOT NULL,
    entity_id text NOT NULL,
    from_revision integer NOT NULL,
    to_revision integer NOT NULL,
    delta_schema_version text NOT NULL,
    delta_json text NOT NULL,
    previous_hash text,
    next_hash text NOT NULL,
    execution_id text NOT NULL REFERENCES ${s}.executions(execution_id),
    created_at text NOT NULL,
    UNIQUE (namespace, entity_id, operation_key),
    UNIQUE (namespace, entity_id, to_revision)
  )`,
    `CREATE TABLE ${s}.domain_events (
    event_id text PRIMARY KEY,
    execution_id text NOT NULL REFERENCES ${s}.executions(execution_id),
    event_key text NOT NULL,
    namespace text NOT NULL,
    entity_id text NOT NULL,
    type text NOT NULL,
    schema_version text NOT NULL,
    payload_json text NOT NULL,
    occurred_at text NOT NULL,
    UNIQUE (execution_id, event_key)
  )`,
    `CREATE TABLE ${s}.outbox (
    event_id text PRIMARY KEY REFERENCES ${s}.domain_events(event_id),
    status text NOT NULL,
    attempt_count integer NOT NULL DEFAULT 0,
    available_at text NOT NULL,
    claimed_at text,
    delivered_at text,
    last_error_json text
  )`,
    `CREATE INDEX outbox_pending
    ON ${s}.outbox (status, available_at)`,
    `CREATE TABLE ${s}.evaluator_runs (
    evaluator_run_id text PRIMARY KEY,
    execution_id text NOT NULL REFERENCES ${s}.executions(execution_id),
    evaluator_id text NOT NULL,
    evaluator_version text NOT NULL,
    attempt integer NOT NULL,
    subject_hash text NOT NULL,
    decision_json text NOT NULL,
    created_at text NOT NULL,
    UNIQUE (execution_id, evaluator_id, attempt)
  )`,
    `CREATE TABLE ${s}.execution_commits (
    execution_id text PRIMARY KEY REFERENCES ${s}.executions(execution_id),
    operation_digest text NOT NULL,
    revision integer NOT NULL,
    document_keys_json text NOT NULL,
    event_ids_json text NOT NULL,
    prepared_commit_json text NOT NULL,
    committed_at text NOT NULL
  )`,
    `CREATE TABLE ${s}.quality_evaluations (
    evaluation_id text PRIMARY KEY,
    run_id text NOT NULL,
    execution_id text NOT NULL,
    subject_digest text NOT NULL,
    result_digest text NOT NULL,
    evaluator_id text NOT NULL,
    evaluator_version text NOT NULL,
    evaluator_kind text NOT NULL,
    verdict text NOT NULL,
    record_json text NOT NULL
  )`,
    `CREATE INDEX quality_evaluations_by_run
    ON ${s}.quality_evaluations (run_id, evaluation_id)`,
    `CREATE INDEX quality_evaluations_by_execution
    ON ${s}.quality_evaluations (execution_id, evaluation_id)`,
  ]);
}

export function createMigrations(schema = 'acme'): readonly Migration[] {
  const name = assertSchemaName(schema);
  return Object.freeze([
    Object.freeze({
      version: 1,
      name: 'initial-revisioned-unit-of-work-pg',
      statements: buildInitialSchemaStatements(name),
    }),
  ]);
}

/** Default production migrations for the `acme` schema. */
export const migrations: readonly Migration[] = createMigrations('acme');

export function migrationChecksum(
  migration: Migration,
  hashing: Hashing = nodeHashing,
): string {
  return hashing.sha256(
    hashing.canonicalJson({
      version: migration.version,
      name: migration.name,
      statements: [...migration.statements],
    }),
  );
}

function corruption(message: string, details: Record<string, unknown>): never {
  throw new AcmeError({
    code: 'PERSISTENCE_CORRUPTION',
    message,
    stage: 'preparing-commit',
    retryable: false,
    details: details as never,
  });
}

export interface MigratePostgresOptions {
  readonly pool: Pool;
  readonly schema?: string;
  readonly appliedAt: string;
  readonly migrations?: readonly Migration[];
  readonly hashing?: Hashing;
}

/**
 * Explicit migrate: create schema, take a transaction-scoped advisory lock,
 * apply pending migrations, refuse unknown or mismatched checksums as
 * PERSISTENCE_CORRUPTION (ADR-0033 section 7).
 */
export async function migratePostgresSchema(
  options: MigratePostgresOptions,
): Promise<void> {
  const schema = assertSchemaName(options.schema ?? 'acme');
  const source = options.migrations ?? createMigrations(schema);
  const hashing = options.hashing ?? nodeHashing;
  const lockKey = schemaAdvisoryLockKey(schema);
  const s = qIdent(schema);

  await withPostgresDriverErrors(async () => {
    await withWriteTransaction(options.pool, async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock($1::bigint)`, [lockKey]);
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${s}`);
      await client.query(
        `CREATE TABLE IF NOT EXISTS ${s}.schema_migrations (
          version integer PRIMARY KEY,
          name text NOT NULL,
          checksum text NOT NULL,
          applied_at text NOT NULL
        )`,
      );

      const appliedRows = await queryAll<AppliedMigrationRow>(
        client,
        `SELECT version, name, checksum FROM ${s}.schema_migrations ORDER BY version`,
      );
      const applied = new Map(
        appliedRows.map((row) => [Number(row.version), row]),
      );
      const known = new Set(source.map((migration) => migration.version));
      for (const version of applied.keys()) {
        if (!known.has(version)) {
          corruption('The database contains an unknown migration version.', {
            version,
            schema,
          });
        }
      }

      const ordered = [...source].sort(
        (left, right) => left.version - right.version,
      );
      for (const migration of ordered) {
        const checksum = migrationChecksum(migration, hashing);
        const existing = applied.get(migration.version);
        if (existing !== undefined) {
          if (
            existing.checksum !== checksum ||
            existing.name !== migration.name
          ) {
            corruption('A recorded migration checksum no longer matches.', {
              version: migration.version,
              recordedChecksum: existing.checksum,
              expectedChecksum: checksum,
              schema,
            });
          }
          continue;
        }
        for (const statement of migration.statements) {
          await client.query(statement);
        }
        await execute(
          client,
          `INSERT INTO ${s}.schema_migrations (version, name, checksum, applied_at)
           VALUES ($1, $2, $3, $4)`,
          [migration.version, migration.name, checksum, options.appliedAt],
        );
      }
    });
  });
}

export interface VerifyPostgresOptions {
  readonly pool: Pool;
  readonly schema?: string;
  readonly migrations?: readonly Migration[];
  readonly hashing?: Hashing;
}

/**
 * Startup verification: refuse un-migrated, ahead-of-code, or checksum-mismatched
 * schemas without applying anything (ADR-0033 section 7).
 */
export async function verifyPostgresSchema(
  options: VerifyPostgresOptions,
): Promise<void> {
  const schema = assertSchemaName(options.schema ?? 'acme');
  const source = options.migrations ?? createMigrations(schema);
  const hashing = options.hashing ?? nodeHashing;
  const s = qIdent(schema);

  await withPostgresDriverErrors(async () => {
    const schemaExists = await queryOne<{ exists: boolean }>(
      options.pool,
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.schemata WHERE schema_name = $1
       ) AS exists`,
      [schema],
    );
    if (schemaExists?.exists !== true) {
      corruption('PostgreSQL schema is not migrated.', { schema });
    }

    const ledgerExists = await queryOne<{ exists: boolean }>(
      options.pool,
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
          WHERE table_schema = $1 AND table_name = 'schema_migrations'
       ) AS exists`,
      [schema],
    );
    if (ledgerExists?.exists !== true) {
      corruption('PostgreSQL schema is not migrated.', { schema });
    }

    const appliedRows = await queryAll<AppliedMigrationRow>(
      options.pool,
      `SELECT version, name, checksum FROM ${s}.schema_migrations ORDER BY version`,
    );
    const applied = new Map(
      appliedRows.map((row) => [Number(row.version), row]),
    );
    const known = new Set(source.map((migration) => migration.version));

    if (applied.size === 0) {
      corruption('PostgreSQL schema is not migrated.', { schema });
    }

    for (const version of applied.keys()) {
      if (!known.has(version)) {
        corruption('The database contains an unknown migration version.', {
          version,
          schema,
        });
      }
    }

    for (const migration of source) {
      const existing = applied.get(migration.version);
      if (existing === undefined) {
        corruption('PostgreSQL schema is behind the application migrations.', {
          missingVersion: migration.version,
          schema,
        });
      }
      const checksum = migrationChecksum(migration, hashing);
      if (existing.checksum !== checksum || existing.name !== migration.name) {
        corruption('A recorded migration checksum no longer matches.', {
          version: migration.version,
          recordedChecksum: existing.checksum,
          expectedChecksum: checksum,
          schema,
        });
      }
    }
  });
}

/** Drop a test schema and all of its objects. Composition roots must not use this. */
export async function dropPostgresSchema(
  pool: Pool,
  schema: string,
): Promise<void> {
  const name = assertSchemaName(schema);
  await withPostgresDriverErrors(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS ${qIdent(name)} CASCADE`);
  });
}

/** Exposed for concurrent-migration tests. */
export async function acquireMigrationLock(
  client: PoolClient,
  schema: string,
): Promise<void> {
  const key = schemaAdvisoryLockKey(assertSchemaName(schema));
  await client.query(`SELECT pg_advisory_xact_lock($1::bigint)`, [key]);
}
