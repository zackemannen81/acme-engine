import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Database } from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { openDatabase } from '../src/database.js';
import { migrationChecksum, migrations } from '../src/migrations.js';

const appliedAt = '2026-07-31T00:00:00.000Z';
const roots: string[] = [];
const opened: Database[] = [];

function location(name: string): string {
  const root = mkdtempSync(join(tmpdir(), 'acme-sqlite-migrations-'));
  roots.push(root);
  return join(root, name);
}

function open(path: string): Database {
  const database = openDatabase({ location: path, appliedAt });
  opened.push(database);
  return database;
}

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close();
  }
  while (roots.length > 0) {
    rmSync(roots.pop() ?? '', { recursive: true, force: true });
  }
});

describe('sqlite migrations', () => {
  it('applies every migration once in version order with WAL durability', () => {
    const path = location('applied.sqlite');
    const database = open(path);

    expect(database.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(database.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(
      database
        .prepare(
          'SELECT version, name, checksum FROM schema_migrations ORDER BY version',
        )
        .all(),
    ).toEqual(
      migrations.map((migration) => ({
        version: migration.version,
        name: migration.name,
        checksum: migrationChecksum(migration),
      })),
    );

    const tables = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      )
      .all() as readonly { readonly name: string }[];
    expect(tables.map((table) => table.name)).toEqual([
      'documents',
      'domain_events',
      'evaluator_runs',
      'execution_attempts',
      'execution_commits',
      'executions',
      'memory_candidates',
      'memory_records',
      'model_calls',
      'outbox',
      'quality_evaluations',
      'schema_migrations',
      'sqlite_sequence',
      'state_heads',
      'state_snapshots',
      'state_transitions',
    ]);

    const indexes = database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
         ORDER BY name`,
      )
      .all() as readonly { readonly name: string }[];
    expect(indexes.map((index) => index.name)).toEqual([
      'documents_by_entity_kind',
      'executions_by_entity_status',
      'memory_records_active_by_entity',
      'outbox_pending',
      'quality_evaluations_by_execution',
      'quality_evaluations_by_run',
    ]);
  });

  it('reopens an already migrated database without reapplying it', () => {
    const path = location('reopened.sqlite');
    const first = open(path);
    const appliedFirst = first
      .prepare('SELECT version, applied_at FROM schema_migrations')
      .all();
    first.close();
    opened.pop();

    const second = openDatabase({
      location: path,
      appliedAt: '2026-08-01T00:00:00.000Z',
    });
    opened.push(second);
    expect(
      second.prepare('SELECT version, applied_at FROM schema_migrations').all(),
    ).toEqual(appliedFirst);
  });

  it('refuses to open a database whose recorded checksum was tampered with', () => {
    const path = location('tampered.sqlite');
    const first = open(path);
    first
      .prepare('UPDATE schema_migrations SET checksum = ? WHERE version = 1')
      .run('tampered-checksum');
    first.close();
    opened.pop();

    expect(() => openDatabase({ location: path, appliedAt })).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'PERSISTENCE_CORRUPTION',
          retryable: false,
        }),
      }),
    );
  });

  it('refuses to open a database recording an unknown migration version', () => {
    const path = location('unknown.sqlite');
    const first = open(path);
    first
      .prepare(
        `INSERT INTO schema_migrations (version, name, checksum, applied_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(999, 'from-the-future', 'unknown-checksum', appliedAt);
    first.close();
    opened.pop();

    expect(() => openDatabase({ location: path, appliedAt })).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'PERSISTENCE_CORRUPTION' }),
      }),
    );
  });
});
