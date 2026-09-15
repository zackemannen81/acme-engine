import { describe, expect, it, vi } from 'vitest';

import { createInMemoryModelExecutionRepository } from '../../packages/adapter-memory/src/index.js';
import {
  createModelExecutionEngine,
  type ModelRequest,
  type NormalizedModelResponse,
} from '../../packages/core/src/index.js';

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

describe('model-only path domain boundary', () => {
  it('never calls DomainModule, memory, state, reducers or ExecutionEngine.execute', async () => {
    const execute = vi.fn();
    const interpret = vi.fn();
    const retrieve = vi.fn();
    const apply = vi.fn();
    const projectState = vi.fn();
    const forbidden = { execute, interpret, retrieve, apply, projectState };

    const engine = createModelExecutionEngine({
      clock: { now: () => now },
      ids: { next: (kind) => `${kind}-1` },
      repository: createInMemoryModelExecutionRepository(),
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
      requestKey: 'boundary-1',
      model: { profile: 'fixture' },
      request,
    });
    expect(result.status).toBe('succeeded');
    expect(forbidden.execute).not.toHaveBeenCalled();
    expect(forbidden.interpret).not.toHaveBeenCalled();
    expect(forbidden.retrieve).not.toHaveBeenCalled();
    expect(forbidden.apply).not.toHaveBeenCalled();
    expect(forbidden.projectState).not.toHaveBeenCalled();
    expect(engine).not.toHaveProperty('executeTask');
  });
});
