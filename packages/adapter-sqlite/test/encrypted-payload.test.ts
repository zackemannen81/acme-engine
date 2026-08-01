import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  computeOperationDigest,
  createAes256GcmPayloadEncryptor,
  type PreparedCommit,
  type PreparedCommitContent,
} from '@acme/core';
import { afterAll, describe, expect, it } from 'vitest';

import { createSqliteExecutionRepository, openDatabase } from '../src/index.js';

const root = mkdtempSync(join(tmpdir(), 'acme-sqlite-encrypted-'));
const opened: ReturnType<typeof openDatabase>[] = [];

afterAll(() => {
  for (const database of opened) {
    database.close();
  }
  rmSync(root, { recursive: true, force: true });
});

const timestamp = '2026-08-01T12:00:00.000Z';
const cleartextMarker = 'cleartext-must-not-rest-in-sqlite';

const response = {
  provider: 'fixture',
  model: 'fixture',
  receivedAt: timestamp,
  finishReason: 'stop' as const,
  text: `{"secret":"${cleartextMarker}"}`,
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  metadata: {},
};

function prepared(executionId: string): PreparedCommit {
  const content: PreparedCommitContent = {
    executionId,
    expectedRevision: 0,
    documents: [],
    memoryCandidates: [],
    memory: { decisions: [], mutations: [] },
    state: null,
    evaluatorRuns: [],
    events: [],
    committedAt: timestamp,
    replayEvidence: {
      taskInput: { executionId },
      readSet: {
        state: null,
        loadedMemories: [],
        retrievedMemories: [],
        documents: [],
      },
    },
  };
  return {
    ...content,
    operationDigest: computeOperationDigest(content),
  };
}

describe('sqlite encrypted-payload at rest', () => {
  it('stores only the envelope in durable columns and reveals with the key', async () => {
    const location = join(root, 'sealed.sqlite');
    const key = new Uint8Array(32).fill(11);
    const encryptor = createAes256GcmPayloadEncryptor({
      key,
      keyId: 'sqlite-test-key',
    });
    const database = openDatabase({
      location,
      appliedAt: timestamp,
    });
    opened.push(database);
    const repository = createSqliteExecutionRepository({
      database,
      ids: { next: (kind) => `${kind}-1` },
      payloadEncryptor: encryptor,
    });

    await repository.accept({
      executionId: 'execution-sealed',
      request: {
        requestKey: 'request-sealed',
        namespace: 'conformance',
        task: 'observe',
        entityId: 'entity-1',
        expectedRevision: 0,
        input: { executionId: 'execution-sealed' },
        model: { profile: 'fixture' },
      },
      requestFingerprint: 'fp-sealed',
      inputHash: 'input-sealed',
      contract: { id: 'conformance.observe', version: '1.0.0' },
      contractFingerprint: 'contract-fp',
      effectivePolicy: {
        timeoutMs: 1_000,
        maxModelCalls: 1,
        maxRepairCalls: 0,
        maxRevisionCalls: 0,
        retention: 'encrypted-payload',
      },
      createdAt: timestamp,
    });
    await repository.reserveModelCall({
      modelCallId: 'call-sealed',
      executionId: 'execution-sealed',
      callKey: 'model:0',
      attempt: 1,
      purpose: 'primary',
      selection: { profile: 'fixture' },
      requestHash: 'request-hash',
      startedAt: timestamp,
    });
    await repository.completeModelCall({
      modelCallId: 'call-sealed',
      response,
      responseHash: 'response-hash',
      completedAt: timestamp,
    });
    await repository.commit(prepared('execution-sealed'));

    const row = database
      .prepare(
        `SELECT response_payload, record_json, response_hash
         FROM model_calls WHERE model_call_id = ?`,
      )
      .get('call-sealed') as {
      response_payload: string | null;
      record_json: string;
      response_hash: string;
    };

    expect(row.response_payload).toBeNull();
    expect(row.response_hash).toBe('response-hash');
    expect(row.record_json).not.toContain(cleartextMarker);
    expect(row.record_json).toContain('aes-256-gcm');
    expect(row.record_json).toContain('protectedResponse');

    const evidence = await repository.loadReplayEvidence('execution-sealed');
    expect(evidence?.modelCalls[0]?.response).toEqual(response);

    // Reopen without the key: durable ciphertext remains; reveal fails.
    database.close();
    const reopened = openDatabase({ location, appliedAt: timestamp });
    opened.push(reopened);
    const locked = createSqliteExecutionRepository({
      database: reopened,
      ids: { next: (kind) => `${kind}-2` },
    });
    const lockedEvidence = await locked.loadReplayEvidence('execution-sealed');
    expect(lockedEvidence?.modelCalls[0]?.response).toBeUndefined();
    expect(lockedEvidence?.modelCalls[0]?.protectedResponse).toEqual(
      expect.any(String),
    );
  });
});
