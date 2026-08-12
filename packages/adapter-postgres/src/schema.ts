import { createHash } from 'node:crypto';

/**
 * Validate and return a PostgreSQL schema identifier safe for unqualified
 * interpolation into SQL (always still double-quoted by callers).
 */
export function assertSchemaName(name: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) {
    throw new Error(
      `Invalid PostgreSQL schema name ${JSON.stringify(name)}. Expected [a-z][a-z0-9_]{0,62}.`,
    );
  }
  return name;
}

/** Double-quote an already-validated schema or table identifier. */
export function qIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

/**
 * Transaction-scoped advisory lock key for a schema name: first 8 bytes of
 * SHA-256(schemaName) interpreted as a signed big-endian int64 (ADR-0033).
 * Returned as a decimal string so `pg` can bind it without float precision loss.
 */
export function schemaAdvisoryLockKey(schemaName: string): string {
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
