import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach } from 'vitest';

import {
  createSqliteQualityEvaluationStore,
  openDatabase,
} from '../../packages/adapter-sqlite/src/index.js';
import { qualityEvaluationStoreConformance } from '../../packages/testing/src/index.js';

const appliedAt = '2026-08-06T18:00:00.000Z';
const roots: string[] = [];
const opened: Array<{ close: () => void }> = [];

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close();
  }
  while (roots.length > 0) {
    rmSync(roots.pop() ?? '', { recursive: true, force: true });
  }
});

qualityEvaluationStoreConformance('sqlite adapter', {
  createStore: (hashing) => {
    const root = mkdtempSync(join(tmpdir(), 'acme-quality-sqlite-'));
    roots.push(root);
    const database = openDatabase({
      location: join(root, 'quality.sqlite'),
      appliedAt,
    });
    opened.push(database);
    return createSqliteQualityEvaluationStore({
      database,
      ...(hashing === undefined ? {} : { hashing }),
    });
  },
});
