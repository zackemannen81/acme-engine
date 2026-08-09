import type { openDatabase } from '../../packages/adapter-sqlite/src/index.js';

type Database = ReturnType<typeof openDatabase>;

export interface FaultingDatabaseOptions {
  /** Substring identifying the statement whose first `run()` must fail. */
  readonly whenSqlIncludes: string;
}

/**
 * Wraps a real database so that one chosen write fails once. The failure is
 * raised by the driver seam the repository already depends on, inside the
 * `BEGIN IMMEDIATE` transaction, so the rollback under test is the real one.
 *
 * The injected error is shaped like a better-sqlite3 `SqliteError` with
 * `code: SQLITE_BUSY` so the adapter's driver classification path is exercised
 * end-to-end (PERSISTENCE_TRANSIENT), not only the raw-Error fallback.
 */
export function faultingDatabase(
  database: Database,
  options: FaultingDatabaseOptions,
): Database {
  let failed = false;
  const bind = (target: object, property: string | symbol): unknown => {
    const value = Reflect.get(target, property) as unknown;
    return typeof value === 'function' ? value.bind(target) : value;
  };
  return new Proxy(database, {
    get(target, property) {
      if (property !== 'prepare') {
        return bind(target, property);
      }
      return (sql: string) => {
        const statement = target.prepare(sql);
        if (!sql.includes(options.whenSqlIncludes)) {
          return statement;
        }
        return new Proxy(statement, {
          get(statementTarget, statementProperty) {
            if (statementProperty !== 'run' || failed) {
              return bind(statementTarget, statementProperty);
            }
            return () => {
              failed = true;
              const fault = new Error(
                'Simulated storage fault (SQLITE_BUSY).',
              ) as Error & { code: string };
              fault.name = 'SqliteError';
              fault.code = 'SQLITE_BUSY';
              throw fault;
            };
          },
        });
      };
    },
  }) as Database;
}
