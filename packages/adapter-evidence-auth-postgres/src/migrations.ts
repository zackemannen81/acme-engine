import { createHash } from 'node:crypto';

import { canonicalJson } from '@acme/core';
import type { Pool } from 'pg';

export interface EvidenceIdentityMigration {
  readonly version: number;
  readonly name: string;
  readonly statements: readonly string[];
}

function schemaName(value: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/u.test(value))
    throw new Error('Invalid identity schema name.');
  return value;
}
function q(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
function lockKey(value: string): string {
  const bytes = createHash('sha256').update(value).digest();
  let result = 0n;
  for (let index = 0; index < 8; index += 1)
    result = (result << 8n) | BigInt(bytes[index] ?? 0);
  if (result >= 1n << 63n) result -= 1n << 64n;
  return result.toString();
}

export function createEvidenceIdentityMigrations(
  schema = 'evidence_identity',
): readonly EvidenceIdentityMigration[] {
  const s = q(schemaName(schema));
  return [
    {
      version: 1,
      name: 'initial-evidence-identity',
      statements: [
        `CREATE TABLE ${s}.organizations (organization_id text PRIMARY KEY, record_json text NOT NULL)`,
        `CREATE TABLE ${s}.principals (principal_ref text PRIMARY KEY, issuer text NOT NULL, subject text NOT NULL, record_json text NOT NULL, UNIQUE (issuer, subject))`,
        `CREATE TABLE ${s}.memberships (membership_id text PRIMARY KEY, organization_id text NOT NULL REFERENCES ${s}.organizations (organization_id), principal_ref text NOT NULL REFERENCES ${s}.principals (principal_ref), record_json text NOT NULL, UNIQUE (organization_id, principal_ref))`,
        `CREATE TABLE ${s}.workspace_bindings (workspace_id text PRIMARY KEY, organization_id text NOT NULL REFERENCES ${s}.organizations (organization_id), record_json text NOT NULL)`,
        `CREATE TABLE ${s}.sessions (session_id text PRIMARY KEY, token_digest text NOT NULL UNIQUE, principal_ref text NOT NULL REFERENCES ${s}.principals (principal_ref), absolute_expires_at timestamptz NOT NULL, revoked_at timestamptz NULL, record_json text NOT NULL)`,
        `CREATE INDEX sessions_principal_expiry ON ${s}.sessions (principal_ref, absolute_expires_at)`,
      ],
    },
    {
      version: 2,
      name: 'evidence-cases-and-memberships',
      statements: [
        `CREATE TABLE ${s}.cases (case_id text PRIMARY KEY, organization_id text NOT NULL REFERENCES ${s}.organizations (organization_id), workspace_id text NOT NULL UNIQUE, revision integer NOT NULL CHECK (revision >= 0), status text NOT NULL CHECK (status IN ('provisioning','active','archived')), record_json text NOT NULL, UNIQUE (case_id, organization_id))`,
        `CREATE TABLE ${s}.case_memberships (case_membership_id text PRIMARY KEY, case_id text NOT NULL, organization_id text NOT NULL, principal_ref text NOT NULL REFERENCES ${s}.principals (principal_ref), record_json text NOT NULL, FOREIGN KEY (case_id, organization_id) REFERENCES ${s}.cases (case_id, organization_id), UNIQUE (case_id, principal_ref))`,
        `CREATE INDEX case_memberships_principal ON ${s}.case_memberships (principal_ref, case_id)`,
      ],
    },
  ];
}

export async function dropEvidenceIdentitySchema(
  pool: Pool,
  schema = 'evidence_identity',
): Promise<void> {
  await pool.query(`DROP SCHEMA IF EXISTS ${q(schemaName(schema))} CASCADE`);
}

export async function migrateEvidenceIdentitySchema(options: {
  readonly pool: Pool;
  readonly appliedAt: string;
  readonly schema?: string;
}): Promise<void> {
  const schema = schemaName(options.schema ?? 'evidence_identity');
  const s = q(schema);
  const migrations = createEvidenceIdentityMigrations(schema);
  const client = await options.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [
      lockKey(schema),
    ]);
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${s}`);
    await client.query(
      `CREATE TABLE IF NOT EXISTS ${s}.schema_migrations (version integer PRIMARY KEY, name text NOT NULL, checksum text NOT NULL, applied_at text NOT NULL)`,
    );
    const applied = await client.query<{
      version: number;
      name: string;
      checksum: string;
    }>(`SELECT version, name, checksum FROM ${s}.schema_migrations`);
    for (const migration of migrations) {
      const checksum = createHash('sha256')
        .update(canonicalJson(migration as never))
        .digest('hex');
      const existing = applied.rows.find(
        (item) => Number(item.version) === migration.version,
      );
      if (existing) {
        if (existing.name !== migration.name || existing.checksum !== checksum)
          throw new Error('Evidence identity migration checksum mismatch.');
        continue;
      }
      for (const statement of migration.statements)
        await client.query(statement);
      await client.query(
        `INSERT INTO ${s}.schema_migrations (version, name, checksum, applied_at) VALUES ($1,$2,$3,$4)`,
        [migration.version, migration.name, checksum, options.appliedAt],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
