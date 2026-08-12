import { createHash } from 'node:crypto';

import { AcmeError, nodeHashing, type Hashing } from '@acme/core';
import type { Pool } from 'pg';

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly statements: readonly string[];
}

function assertSchemaName(name: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) {
    throw new Error(`Invalid schema name ${JSON.stringify(name)}.`);
  }
  return name;
}

function qIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function schemaAdvisoryLockKey(schemaName: string): string {
  const digest = createHash('sha256').update(schemaName, 'utf8').digest();
  let value = 0n;
  for (let index = 0; index < 8; index += 1) {
    const byte = digest[index];
    if (byte === undefined) {
      throw new Error('SHA-256 digest shorter than 8 bytes.');
    }
    value = (value << 8n) | BigInt(byte);
  }
  if (value >= 1n << 63n) {
    value -= 1n << 64n;
  }
  return value.toString();
}

function buildV1(schema: string): readonly string[] {
  const s = qIdent(schema);
  return Object.freeze([
    `CREATE TABLE ${s}.workspaces (
      workspace_id text PRIMARY KEY,
      record_json text NOT NULL
    )`,
    `CREATE TABLE ${s}.sources (
      artifact_version_id text PRIMARY KEY,
      record_json text NOT NULL
    )`,
    `CREATE TABLE ${s}.observations (
      observation_id text PRIMARY KEY,
      record_json text NOT NULL
    )`,
    `CREATE TABLE ${s}.relations (
      relation_id text PRIMARY KEY,
      record_json text NOT NULL
    )`,
    `CREATE TABLE ${s}.open_questions (
      open_question_id text PRIMARY KEY,
      record_json text NOT NULL
    )`,
    `CREATE TABLE ${s}.assessments (
      assessment_version_id text PRIMARY KEY,
      record_json text NOT NULL
    )`,
    `CREATE TABLE ${s}.jobs (
      job_id text PRIMARY KEY,
      workspace_id text NOT NULL,
      command_key text NOT NULL,
      artifact_version_id text NOT NULL,
      record_json text NOT NULL
    )`,
    `CREATE TABLE ${s}.review_decisions (
      review_decision_id text PRIMARY KEY,
      workspace_id text NOT NULL,
      command_key text NOT NULL,
      decided_at text NOT NULL,
      record_json text NOT NULL,
      UNIQUE (workspace_id, command_key)
    )`,
    `CREATE INDEX review_decisions_order
      ON ${s}.review_decisions (decided_at, review_decision_id)`,
  ]);
}

export function createEvidenceProductMigrations(
  schema = 'evidence',
): readonly Migration[] {
  const name = assertSchemaName(schema);
  return Object.freeze([
    Object.freeze({
      version: 1,
      name: 'initial-evidence-product-pg',
      statements: buildV1(name),
    }),
    Object.freeze({
      version: 2,
      name: 'evidence-product-change-sets',
      statements: Object.freeze([
        `CREATE TABLE ${qIdent(name)}.change_sets (
          workspace_id text NOT NULL,
          command_key text NOT NULL,
          to_evidence_revision integer NOT NULL,
          record_json text NOT NULL,
          PRIMARY KEY (workspace_id, command_key)
        )`,
        `CREATE INDEX change_sets_revision_order
          ON ${qIdent(name)}.change_sets (workspace_id, to_evidence_revision, command_key)`,
      ]),
    }),
  ]);
}

export const migrations: readonly Migration[] =
  createEvidenceProductMigrations('evidence');

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

export interface MigrateEvidenceProductOptions {
  readonly pool: Pool;
  readonly schema?: string;
  readonly appliedAt: string;
  readonly migrations?: readonly Migration[];
  readonly hashing?: Hashing;
}

export async function migrateEvidenceProductSchema(
  options: MigrateEvidenceProductOptions,
): Promise<void> {
  const schema = assertSchemaName(options.schema ?? 'evidence');
  const source = options.migrations ?? createEvidenceProductMigrations(schema);
  const hashing = options.hashing ?? nodeHashing;
  const lockKey = schemaAdvisoryLockKey(schema);
  const s = qIdent(schema);
  const client = await options.pool.connect();
  try {
    await client.query('BEGIN');
    try {
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
      const appliedResult = await client.query<{
        version: number;
        name: string;
        checksum: string;
      }>(
        `SELECT version, name, checksum FROM ${s}.schema_migrations ORDER BY version`,
      );
      const applied = new Map(
        appliedResult.rows.map((row) => [Number(row.version), row]),
      );
      const known = new Set(source.map((m) => m.version));
      for (const version of applied.keys()) {
        if (!known.has(version)) {
          corruption('Unknown evidence product migration version.', {
            version,
            schema,
          });
        }
      }
      for (const migration of [...source].sort(
        (a, b) => a.version - b.version,
      )) {
        const checksum = migrationChecksum(migration, hashing);
        const existing = applied.get(migration.version);
        if (existing !== undefined) {
          if (
            existing.checksum !== checksum ||
            existing.name !== migration.name
          ) {
            corruption('Evidence product migration checksum mismatch.', {
              version: migration.version,
              schema,
            });
          }
          continue;
        }
        for (const statement of migration.statements) {
          await client.query(statement);
        }
        await client.query(
          `INSERT INTO ${s}.schema_migrations (version, name, checksum, applied_at)
           VALUES ($1, $2, $3, $4)`,
          [migration.version, migration.name, checksum, options.appliedAt],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // prefer original
      }
      throw error;
    }
  } finally {
    client.release();
  }
}

export async function dropEvidenceProductSchema(
  pool: Pool,
  schema: string,
): Promise<void> {
  const name = assertSchemaName(schema);
  await pool.query(`DROP SCHEMA IF EXISTS ${qIdent(name)} CASCADE`);
}
