import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AcmeError, type AcceptedExecution, type IdGenerator } from '@acme/core';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createSqliteExecutionRepository,
  openDatabase,
  sqliteDriverCode,
  throwMappedSqliteDriverError,
  withSqliteDriverErrors,
} from '../src/index.js';

describe('sqlite driver error classification', () => {
  it('maps busy and locked codes to retryable PERSISTENCE_TRANSIENT', () => {
    for (const code of [
      'SQLITE_BUSY',
      'SQLITE_BUSY_SNAPSHOT',
      'SQLITE_LOCKED',
    ] as const) {
      const raw = Object.assign(new Error('database is locked'), {
        name: 'SqliteError',
        code,
      });
      try {
        throwMappedSqliteDriverError(raw);
        expect.unreachable('expected throw');
      } catch (error) {
        expect(error).toBeInstanceOf(AcmeError);
        expect((error as AcmeError).data).toMatchObject({
          code: 'PERSISTENCE_TRANSIENT',
          retryable: true,
          details: { kind: 'contention' },
        });
        expect((error as AcmeError).cause).toBe(raw);
      }
    }
  });

  it('maps corruption and constraint codes to non-retryable PERSISTENCE_CORRUPTION', () => {
    for (const code of [
      'SQLITE_CORRUPT',
      'SQLITE_CONSTRAINT',
      'SQLITE_CONSTRAINT_UNIQUE',
    ] as const) {
      const raw = Object.assign(new Error('constraint failed'), {
        name: 'SqliteError',
        code,
      });
      try {
        throwMappedSqliteDriverError(raw);
        expect.unreachable('expected throw');
      } catch (error) {
        expect(error).toBeInstanceOf(AcmeError);
        expect((error as AcmeError).data).toMatchObject({
          code: 'PERSISTENCE_CORRUPTION',
          retryable: false,
          details: { kind: 'integrity' },
        });
      }
    }
  });

  it('maps unknown errors to INTERNAL AcmeError (never raw)', () => {
    const raw = new Error('Simulated storage fault.');
    try {
      throwMappedSqliteDriverError(raw);
      expect.unreachable('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AcmeError);
      expect((error as AcmeError).data).toMatchObject({
        code: 'INTERNAL',
        retryable: false,
      });
      expect(sqliteDriverCode(raw)).toBeUndefined();
    }
  });

  it('rethrows existing AcmeError unchanged', () => {
    const existing = new AcmeError({
      code: 'CONFLICT_STATE_REVISION',
      message: 'revision conflict',
      stage: 'preparing-commit',
      retryable: false,
    });
    expect(() =>
      withSqliteDriverErrors(() => {
        throw existing;
      }),
    ).toThrow(existing);
  });
});

describe('real SQLITE_BUSY through the repository', () => {
  const opened: Array<{ close: () => void }> = [];
  const dirs: string[] = [];

  afterEach(() => {
    while (opened.length > 0) {
      opened.pop()?.close();
    }
    while (dirs.length > 0) {
      const dir = dirs.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('classifies a real busy timeout as PERSISTENCE_TRANSIENT', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'acme-sqlite-busy-'));
    dirs.push(dir);
    const location = join(dir, 'busy.sqlite');
    const appliedAt = '2026-01-01T00:00:00.000Z';

    // Open both connections before taking the exclusive lock so migrations
    // are not the contended step.
    const holder = openDatabase({ location, appliedAt });
    opened.push(holder);
    const contenderDb = openDatabase({ location, appliedAt });
    opened.push(contenderDb);
    // Zero busy timeout so the second writer fails immediately.
    holder.pragma('busy_timeout = 0');
    contenderDb.pragma('busy_timeout = 0');

    const ids: IdGenerator = {
      next(kind) {
        return `${kind}-busy-1`;
      },
    };
    const repository = createSqliteExecutionRepository({
      database: contenderDb,
      ids,
    });

    const accepted: AcceptedExecution = {
      executionId: 'exec_busy_1',
      request: {
        requestKey: 'busy-key',
        namespace: 'busy-ns',
        task: 'observe',
        entityId: 'entity-busy',
        expectedRevision: 0,
        input: { ok: true },
        model: { profile: 'fixture' },
      },
      requestFingerprint: 'fingerprint-busy',
      inputHash: 'input-busy',
      contract: { id: 'busy.observe', version: '1.0.0' },
      contractFingerprint: 'contract-fingerprint',
      effectivePolicy: {
        timeoutMs: 1_000,
        maxModelCalls: 1,
        maxRepairCalls: 0,
        maxRevisionCalls: 0,
        retention: 'hash-only',
      },
      createdAt: appliedAt,
    };

    holder.exec('BEGIN EXCLUSIVE');
    try {
      // BEGIN IMMEDIATE on the contender collides with the holder's EXCLUSIVE.
      await repository.accept(accepted);
      expect.unreachable('expected busy failure');
    } catch (error) {
      expect(error).toBeInstanceOf(AcmeError);
      expect((error as AcmeError).data).toMatchObject({
        code: 'PERSISTENCE_TRANSIENT',
        retryable: true,
      });
      // No raw driver object escapes the adapter boundary.
      expect(sqliteDriverCode(error)).toBeUndefined();
    } finally {
      try {
        holder.exec('ROLLBACK');
      } catch {
        // holder may already be broken; close still runs in afterEach
      }
    }
  });
});
