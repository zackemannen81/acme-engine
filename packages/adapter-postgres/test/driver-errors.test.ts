import { AcmeError } from '@acme/core';
import { describe, expect, it } from 'vitest';

import {
  postgresSqlState,
  throwMappedPostgresDriverError,
} from '../src/driver-errors.js';

describe('postgres driver error classification', () => {
  it('maps transient SQLSTATE codes to retryable PERSISTENCE_TRANSIENT', () => {
    for (const code of ['40001', '40P01', '55P03', '57014', '08006', '57P01']) {
      const raw = Object.assign(new Error('transient'), { code });
      try {
        throwMappedPostgresDriverError(raw);
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

  it('maps integrity and schema-drift codes to PERSISTENCE_CORRUPTION', () => {
    for (const code of ['23505', '42P01', '42703', '42601', 'XX001']) {
      const raw = Object.assign(new Error('corruption'), { code });
      try {
        throwMappedPostgresDriverError(raw);
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

  it('maps unknown errors to INTERNAL and never returns raw', () => {
    const raw = new Error('unexpected');
    try {
      throwMappedPostgresDriverError(raw);
      expect.unreachable('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AcmeError);
      expect((error as AcmeError).data.code).toBe('INTERNAL');
    }
  });

  it('extracts SQLSTATE from driver-shaped errors', () => {
    expect(postgresSqlState({ code: '23505' })).toBe('23505');
    expect(postgresSqlState(new Error('x'))).toBeUndefined();
  });

  it('rethrows AcmeError unchanged', () => {
    const existing = new AcmeError({
      code: 'CONFLICT_STATE_REVISION',
      message: 'expected',
      stage: 'preparing-commit',
      retryable: false,
    });
    try {
      throwMappedPostgresDriverError(existing);
      expect.unreachable('expected throw');
    } catch (error) {
      expect(error).toBe(existing);
    }
  });
});
