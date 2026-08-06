import { AcmeError, type ExecutionStatus } from '@acme/core';

/**
 * SQLite result codes that mean "try again later" under contention or locking.
 * Names match better-sqlite3 / libsqlite `error.code` strings.
 */
const TRANSIENT_CODES: ReadonlySet<string> = new Set([
  'SQLITE_BUSY',
  'SQLITE_BUSY_RECOVERY',
  'SQLITE_BUSY_SNAPSHOT',
  'SQLITE_BUSY_TIMEOUT',
  'SQLITE_LOCKED',
  'SQLITE_LOCKED_SHAREDCACHE',
]);

/**
 * Corruption, malformed DB, and constraint failures that ACME did not already
 * translate into conflict codes. Non-retryable at the public boundary.
 */
const CORRUPTION_CODES: ReadonlySet<string> = new Set([
  'SQLITE_CORRUPT',
  'SQLITE_CORRUPT_INDEX',
  'SQLITE_CORRUPT_SEQUENCE',
  'SQLITE_CORRUPT_VTAB',
  'SQLITE_NOTADB',
  'SQLITE_FORMAT',
  'SQLITE_IOERR_CORRUPTFS',
  'SQLITE_CONSTRAINT',
  'SQLITE_CONSTRAINT_CHECK',
  'SQLITE_CONSTRAINT_COMMITHOOK',
  'SQLITE_CONSTRAINT_DATATYPE',
  'SQLITE_CONSTRAINT_FOREIGNKEY',
  'SQLITE_CONSTRAINT_FUNCTION',
  'SQLITE_CONSTRAINT_NOTNULL',
  'SQLITE_CONSTRAINT_PINNED',
  'SQLITE_CONSTRAINT_PRIMARYKEY',
  'SQLITE_CONSTRAINT_ROWID',
  'SQLITE_CONSTRAINT_TRIGGER',
  'SQLITE_CONSTRAINT_UNIQUE',
  'SQLITE_CONSTRAINT_VTAB',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Extract a SQLite result-code name from a better-sqlite3 / SqliteError-like
 * value without importing provider types into public contracts.
 */
export function sqliteDriverCode(error: unknown): string | undefined {
  if (!isObject(error)) {
    return undefined;
  }
  const code = error.code;
  if (typeof code === 'string' && code.startsWith('SQLITE_')) {
    return code;
  }
  return undefined;
}

function causeOptions(error: unknown): { cause?: unknown } {
  return error instanceof Error ? { cause: error } : {};
}

/**
 * Map a thrown value from the SQLite driver into an `AcmeError` and throw it.
 * Already-classified `AcmeError` instances are rethrown unchanged.
 *
 * Public codes stay domain-neutral (`PERSISTENCE_*` / `INTERNAL`). Driver
 * result-code names may appear only in optional `details` for operators.
 */
export function throwMappedSqliteDriverError(
  error: unknown,
  stage: ExecutionStatus = 'preparing-commit',
): never {
  if (error instanceof AcmeError) {
    throw error;
  }

  const driverCode = sqliteDriverCode(error);

  if (driverCode !== undefined && TRANSIENT_CODES.has(driverCode)) {
    throw new AcmeError(
      {
        code: 'PERSISTENCE_TRANSIENT',
        message:
          'A transient database lock or busy condition prevented the operation.',
        stage,
        retryable: true,
        details: { kind: 'contention' },
      },
      causeOptions(error),
    );
  }

  if (driverCode !== undefined && CORRUPTION_CODES.has(driverCode)) {
    throw new AcmeError(
      {
        code: 'PERSISTENCE_CORRUPTION',
        message:
          'The database rejected the operation due to corruption or an unexpected constraint failure.',
        stage,
        retryable: false,
        details: { kind: 'integrity' },
      },
      causeOptions(error),
    );
  }

  throw new AcmeError(
    {
      code: 'INTERNAL',
      message: 'A database driver error occurred.',
      stage,
      retryable: false,
      ...(driverCode === undefined
        ? {}
        : { details: { kind: 'unclassified-driver' } }),
    },
    causeOptions(error),
  );
}

/**
 * Run work and ensure any thrown value is an `AcmeError` (never a raw driver
 * error). Used at repository driver seams.
 */
export function withSqliteDriverErrors<T>(
  work: () => T,
  stage: ExecutionStatus = 'preparing-commit',
): T {
  try {
    return work();
  } catch (error) {
    throwMappedSqliteDriverError(error, stage);
  }
}
