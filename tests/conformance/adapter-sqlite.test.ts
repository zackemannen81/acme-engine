import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll } from 'vitest';

import {
  createSqliteExecutionRepository,
  openDatabase,
} from '../../packages/adapter-sqlite/src/index.js';
import { executionRepositoryConformance } from '../../packages/testing/src/index.js';

type OpenDatabase = ReturnType<typeof openDatabase>;

const root = mkdtempSync(join(tmpdir(), 'acme-sqlite-conformance-'));
const opened: OpenDatabase[] = [];

afterAll(() => {
  for (const database of opened) {
    database.close();
  }
  rmSync(root, { recursive: true, force: true });
});

executionRepositoryConformance('sqlite adapter', {
  createRepository: (deps) => {
    const database = openDatabase({
      location: join(root, `conformance-${opened.length}.sqlite`),
      appliedAt: '2026-07-31T00:00:00.000Z',
    });
    opened.push(database);
    return createSqliteExecutionRepository({
      database,
      ids: {
        next(kind) {
          return `${kind}-unused`;
        },
      },
      ...(deps?.payloadEncryptor === undefined
        ? {}
        : { payloadEncryptor: deps.payloadEncryptor }),
    });
  },
});
