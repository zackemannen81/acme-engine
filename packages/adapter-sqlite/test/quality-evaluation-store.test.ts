import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { sha256 } from '@acme/core';
import {
  createQualityEvaluationInput,
  createQualityEvaluationRecord,
} from '@acme/evaluation';

import {
  createSqliteQualityEvaluationStore,
  openDatabase,
} from '../src/index.js';

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

function sampleRecord(runId = 'run-durable') {
  const input = createQualityEvaluationInput({
    runId,
    executionResult: {
      status: 'committed',
      executionId: `execution-${runId}`,
      replayed: false,
      revision: 1,
      documentKeys: ['artifact'],
      eventIds: [],
    },
    operationDigest: sha256(`operation-${runId}`),
    artifact: { kind: 'document', id: 'artifact', value: { runId } },
    contract: {
      id: 'conformance.observe',
      version: '1.0.0',
      fingerprint: sha256('contract'),
    },
  });
  return createQualityEvaluationRecord({
    input,
    evaluator: {
      id: 'quality.durable',
      version: '1.0.0',
      kind: 'deterministic',
    },
    result: { scores: [], findings: [], verdict: 'pass' },
  });
}

describe('sqlite quality evaluation store durability', () => {
  it('survives close and reopen of the same database file', async () => {
    const root = mkdtempSync(join(tmpdir(), 'acme-quality-reopen-'));
    roots.push(root);
    const location = join(root, 'quality.sqlite');
    const record = sampleRecord();

    const first = openDatabase({ location, appliedAt });
    opened.push(first);
    const store = createSqliteQualityEvaluationStore({ database: first });
    await expect(store.put(record)).resolves.toBe('created');
    first.close();
    opened.pop();

    const second = openDatabase({ location, appliedAt });
    opened.push(second);
    const reopened = createSqliteQualityEvaluationStore({ database: second });
    await expect(reopened.get(record.evaluationId)).resolves.toStrictEqual(
      record,
    );
    await expect(
      reopened.list({ runId: record.subject.runId }),
    ).resolves.toEqual([record]);
    await expect(reopened.put(record)).resolves.toBe('existing');
  });
});
