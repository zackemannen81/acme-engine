import {
  computeOperationDigest,
  createAes256GcmPayloadEncryptor,
  type PreparedCommit,
  type PreparedCommitContent,
} from '@acme/core';
import { describe, expect, it } from 'vitest';

import { createInMemoryExecutionRepository } from '../src/index.js';

const timestamp = '2026-08-01T12:00:00.000Z';
const cleartextMarker = 'cleartext-must-not-rest-in-memory';

const response = {
  provider: 'fixture',
  model: 'fixture',
  receivedAt: timestamp,
  finishReason: 'stop' as const,
  text: `{"secret":"${cleartextMarker}"}`,
  usage: {},
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

describe('in-memory encrypted-payload', () => {
  it('keeps snapshot free of cleartext and reveals only via loadReplayEvidence', async () => {
    const key = new Uint8Array(32).fill(5);
    const encryptor = createAes256GcmPayloadEncryptor({
      key,
      keyId: 'memory-test-key',
    });
    const repository = createInMemoryExecutionRepository({
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

    const snapshot = repository.snapshot();
    const stored = snapshot.modelCalls[0];
    expect(stored?.response).toBeUndefined();
    expect(stored?.protectedResponse).toEqual(expect.any(String));
    expect(JSON.stringify(snapshot)).not.toContain(cleartextMarker);

    const evidence = await repository.loadReplayEvidence('execution-sealed');
    expect(evidence?.modelCalls[0]?.response).toEqual(response);
  });
});
