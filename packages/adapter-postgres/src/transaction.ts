import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

import { withPostgresDriverErrors } from './driver-errors.js';

export type SqlValue = string | number | boolean | null;

export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<T>>;
}

const DEFAULT_LOCK_TIMEOUT_MS = 5_000;
const DEFAULT_STATEMENT_TIMEOUT_MS = 30_000;

/**
 * One dedicated client per Unit of Work: BEGIN, set timeouts, READ COMMITTED,
 * commit or rollback, release in `finally` (ADR-0033 section 4 and 9).
 */
export async function withWriteTransaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
  options: {
    readonly lockTimeoutMs?: number;
    readonly statementTimeoutMs?: number;
  } = {},
): Promise<T> {
  return withPostgresDriverErrors(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const lockMs = options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
      const statementMs =
        options.statementTimeoutMs ?? DEFAULT_STATEMENT_TIMEOUT_MS;
      await client.query(`SET LOCAL lock_timeout = '${lockMs}'`);
      await client.query(`SET LOCAL statement_timeout = '${statementMs}'`);
      try {
        const result = await work(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Prefer the original error over a rollback failure.
        }
        throw error;
      }
    } finally {
      client.release();
    }
  });
}

/**
 * Multi-statement read sets run inside a read-only repeatable-read
 * transaction so `loadContext` / `loadReplayEvidence` observe one snapshot
 * (ADR-0033 section 9).
 */
export async function withRepeatableReadTransaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withPostgresDriverErrors(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      try {
        const result = await work(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Prefer the original error.
        }
        throw error;
      }
    } finally {
      client.release();
    }
  });
}

export async function queryOne<T extends QueryResultRow>(
  client: Queryable,
  text: string,
  values: readonly unknown[] = [],
): Promise<T | undefined> {
  const result = await client.query<T>(text, [...values]);
  return result.rows[0];
}

export async function queryAll<T extends QueryResultRow>(
  client: Queryable,
  text: string,
  values: readonly unknown[] = [],
): Promise<T[]> {
  const result = await client.query<T>(text, [...values]);
  return result.rows;
}

export async function execute(
  client: Queryable,
  text: string,
  values: readonly unknown[] = [],
): Promise<number> {
  const result = await client.query(text, [...values]);
  return result.rowCount ?? 0;
}
