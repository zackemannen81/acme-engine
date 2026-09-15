import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  AmbiguousModelCallError,
  createModelExecutionEngine,
  type ModelRequest,
  type NormalizedModelResponse,
} from '@acme/core';

import {
  createSqliteModelExecutionRepository,
  openDatabase,
} from '../src/index.js';

const now = '2026-09-15T12:00:00.000Z';
const request: ModelRequest = {
  messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
  output: { mode: 'text' },
};
const response: NormalizedModelResponse = {
  provider: 'fixture',
  model: 'fixture',
  receivedAt: now,
  finishReason: 'stop',
  text: 'Hello',
  usage: {},
  metadata: {},
};

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop() ?? '', { recursive: true, force: true });
  }
});

function location(name: string): string {
  const root = mkdtempSync(join(tmpdir(), 'acme-model-exec-sqlite-'));
  roots.push(root);
  return join(root, name);
}

describe('sqlite model execution repository', () => {
  it('survives restart from a retained response without a second provider call', async () => {
    const path = location('restart.sqlite');
    let streams = 0;
    const gateway = {
      async capabilities() {
        return { structuredOutput: true, tools: false, vision: false };
      },
      async generate() {
        throw new Error('generate must not run');
      },
      async *stream() {
        streams += 1;
        yield { type: 'completed' as const, sequence: 0, response };
      },
    };

    const firstDb = openDatabase({ location: path, appliedAt: now });
    const first = createModelExecutionEngine({
      clock: { now: () => now },
      ids: { next: (kind) => `${kind}-1` },
      repository: createSqliteModelExecutionRepository({ database: firstDb }),
      gateway,
    });
    const created = await first.execute({
      requestKey: 'sqlite-1',
      model: { profile: 'fixture' },
      request,
    });
    expect(created.status).toBe('succeeded');
    firstDb.close();

    const secondDb = openDatabase({ location: path, appliedAt: now });
    const resumed = createModelExecutionEngine({
      clock: { now: () => now },
      ids: { next: (kind) => `${kind}-9` },
      repository: createSqliteModelExecutionRepository({ database: secondDb }),
      gateway,
    });
    const replayed = await resumed.execute({
      requestKey: 'sqlite-1',
      model: { profile: 'fixture' },
      request,
    });
    secondDb.close();
    expect(replayed.status).toBe('succeeded');
    if (replayed.status === 'succeeded') {
      expect(replayed.replayed).toBe(true);
      expect(replayed.response.text).toBe('Hello');
    }
    expect(streams).toBe(1);
  });

  it('does not retry an ambiguous recorded call after reopen', async () => {
    const path = location('ambiguous.sqlite');
    let streams = 0;
    const gateway = {
      async capabilities() {
        return { structuredOutput: true, tools: false, vision: false };
      },
      async generate() {
        throw new Error('generate must not run');
      },
      async *stream() {
        streams += 1;
        throw new AmbiguousModelCallError({
          code: 'MODEL_UNAVAILABLE',
          message: 'The provider may have executed this call.',
          stage: 'calling-model',
          retryable: false,
          details: { delivery: 'unknown', reason: 'network' },
        });
        yield { type: 'completed' as const, sequence: 0, response };
      },
    };
    const firstDb = openDatabase({ location: path, appliedAt: now });
    const first = createModelExecutionEngine({
      clock: { now: () => now },
      ids: { next: (kind) => `${kind}-1` },
      repository: createSqliteModelExecutionRepository({ database: firstDb }),
      gateway,
    });
    const failed = await first.execute({
      requestKey: 'sqlite-ambiguous',
      model: { profile: 'fixture' },
      request,
    });
    expect(failed.status).toBe('failed');
    firstDb.close();

    const secondDb = openDatabase({ location: path, appliedAt: now });
    const resumed = createModelExecutionEngine({
      clock: { now: () => now },
      ids: { next: (kind) => `${kind}-9` },
      repository: createSqliteModelExecutionRepository({ database: secondDb }),
      gateway,
    });
    const again = await resumed.execute({
      requestKey: 'sqlite-ambiguous',
      model: { profile: 'fixture' },
      request,
    });
    secondDb.close();
    expect(again.status).toBe('failed');
    expect(streams).toBe(1);
  });
});
