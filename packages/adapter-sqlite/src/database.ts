import DatabaseConstructor, { type Database } from 'better-sqlite3';

import { applyMigrations, migrations, type Migration } from './migrations.js';

export interface OpenDatabaseOptions {
  /** File path, or `:memory:` for a private non-durable database. */
  readonly location: string;
  /** Timestamp recorded for migrations applied by this open. */
  readonly appliedAt: string;
  readonly readonly?: boolean;
  readonly migrations?: readonly Migration[];
}

/**
 * Opens a SQLite database with the durability settings ADR-0003 fixes: WAL
 * journaling, enforced foreign keys and ordered checksum-verified migrations.
 */
export function openDatabase(options: OpenDatabaseOptions): Database {
  const database = new DatabaseConstructor(options.location, {
    readonly: options.readonly ?? false,
  });
  try {
    database.pragma('journal_mode = WAL');
    database.pragma('foreign_keys = ON');
    database.pragma('synchronous = FULL');
    applyMigrations(
      database,
      options.appliedAt,
      options.migrations ?? migrations,
    );
  } catch (cause) {
    // A database that refused to migrate must not leak an open file handle.
    database.close();
    throw cause;
  }
  return database;
}
