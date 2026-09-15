import { describe, expect, it } from 'vitest';

import {
  createAes256GcmPayloadEncryptor,
  createModelExecutionEngine,
  type ModelRequest,
  type NormalizedModelResponse,
} from '@acme/core';

import { createInMemoryModelExecutionRepository } from '../src/index.js';

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

describe('in-memory model execution repository', () => {
  it('reserves before dispatch and reuses a terminal result', async () => {
    const repository = createInMemoryModelExecutionRepository();
    const order: string[] = [];
    const originalReserve = repository.reserveModelCall.bind(repository);
    repository.reserveModelCall = async (call) => {
      order.push('reserve');
      return originalReserve(call);
    };
    const engine = createModelExecutionEngine({
      clock: { now: () => now },
      ids: { next: (kind) => `${kind}-1` },
      repository,
      gateway: {
        async capabilities() {
          return { structuredOutput: true, tools: false, vision: false };
        },
        async generate() {
          throw new Error('generate must not run');
        },
        async *stream() {
          order.push('stream');
          yield { type: 'completed' as const, sequence: 0, response };
        },
      },
    });

    const first = await engine.execute({
      requestKey: 'mem-1',
      model: { profile: 'fixture' },
      request,
    });
    expect(first.status).toBe('succeeded');
    expect(order).toEqual(['reserve', 'stream']);
    const second = await engine.execute({
      requestKey: 'mem-1',
      model: { profile: 'fixture' },
      request,
    });
    expect(second.status).toBe('succeeded');
    if (second.status === 'succeeded') {
      expect(second.replayed).toBe(true);
    }
    expect(order).toEqual(['reserve', 'stream']);
  });

  it('reveals encrypted payloads only through the resume path', async () => {
    const encryptor = createAes256GcmPayloadEncryptor({
      key: new Uint8Array(32).fill(3),
      keyId: 'model-exec-key',
    });
    const repository = createInMemoryModelExecutionRepository({
      payloadEncryptor: encryptor,
    });
    const engine = createModelExecutionEngine({
      clock: { now: () => now },
      ids: { next: (kind) => `${kind}-1` },
      repository,
      gateway: {
        async capabilities() {
          return { structuredOutput: true, tools: false, vision: false };
        },
        async generate() {
          throw new Error('generate must not run');
        },
        async *stream() {
          yield { type: 'completed' as const, sequence: 0, response };
        },
      },
    });
    const result = await engine.execute({
      requestKey: 'sealed-1',
      model: { profile: 'fixture' },
      request,
      policy: { retention: 'encrypted-payload' },
    });
    expect(result.status).toBe('succeeded');
    const resume = await repository.loadResumeState(
      result.status === 'succeeded' ? result.modelExecutionId : '',
    );
    const call = resume?.modelCalls[0];
    expect(call?.protectedResponse).toBeTypeOf('string');
    expect(call?.protectedResponse).not.toContain('Hello');
    expect(call?.response?.text).toBe('Hello');
  });
});
