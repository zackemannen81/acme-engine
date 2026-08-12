import { AcmeError, type ExecutionStatus } from '@acme/core';

/**
 * SQLSTATE classes and codes mapped to retryable PERSISTENCE_TRANSIENT
 * (ADR-0033 section 8).
 */
function isTransientSqlState(code: string): boolean {
  if (code.startsWith('08')) {
    return true;
  }
  switch (code) {
    case '40001':
    case '40P01':
    case '55P03':
    case '57014':
    case '53200':
    case '53300':
    case '57P01':
    case '57P02':
    case '57P03':
    case '08007':
    case '25P02': // aborted txn follow-up; retryable seam, not INTERNAL
      return true;
    default:
      return false;
  }
}

/**
 * Integrity and schema-drift codes mapped to non-retryable
 * PERSISTENCE_CORRUPTION (ADR-0033 section 8).
 */
function isCorruptionSqlState(code: string): boolean {
  if (code.startsWith('23')) {
    return true;
  }
  switch (code) {
    case '42601':
    case '42P01':
    case '42703':
    case '42P07':
    case 'XX000':
    case 'XX001':
    case 'XX002':
      return true;
    default:
      return false;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Extract a PostgreSQL SQLSTATE from a `pg` DatabaseError-like value without
 * importing provider types into public contracts.
 */
export function postgresSqlState(error: unknown): string | undefined {
  if (!isObject(error)) {
    return undefined;
  }
  const code = error.code;
  if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) {
    return code;
  }
  return undefined;
}

function causeOptions(error: unknown): { cause?: unknown } {
  return error instanceof Error ? { cause: error } : {};
}

/**
 * Map a thrown value from the PostgreSQL driver into an `AcmeError` and throw
 * it. Already-classified `AcmeError` instances are rethrown unchanged.
 *
 * Unique violations on idempotency and revision constraints must be handled as
 * domain conflicts *before* this mapper sees them (ADR-0033 section 4/8).
 */
export function throwMappedPostgresDriverError(
  error: unknown,
  stage: ExecutionStatus = 'preparing-commit',
): never {
  if (error instanceof AcmeError) {
    throw error;
  }

  const sqlState = postgresSqlState(error);

  if (sqlState !== undefined && isTransientSqlState(sqlState)) {
    throw new AcmeError(
      {
        code: 'PERSISTENCE_TRANSIENT',
        message:
          'A transient database condition prevented the operation (lock, deadlock, connection, or cancellation).',
        stage,
        retryable: true,
        details: { kind: 'contention' },
      },
      causeOptions(error),
    );
  }

  if (sqlState !== undefined && isCorruptionSqlState(sqlState)) {
    throw new AcmeError(
      {
        code: 'PERSISTENCE_CORRUPTION',
        message:
          'The database rejected the operation due to corruption, schema drift, or an unexpected constraint failure.',
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
      ...(sqlState === undefined
        ? {}
        : { details: { kind: 'unclassified-driver' } }),
    },
    causeOptions(error),
  );
}

/**
 * Run async work and ensure any thrown value is an `AcmeError` (never a raw
 * driver error). Used at repository driver seams.
 */
export async function withPostgresDriverErrors<T>(
  work: () => Promise<T>,
  stage: ExecutionStatus = 'preparing-commit',
): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throwMappedPostgresDriverError(error, stage);
  }
}
