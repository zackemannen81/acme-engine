import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  AmbiguousModelCallError,
  createModelExecutionEngine,
  type CompletedModelCall,
  type FailedModelCall,
  type GatewayCallContext,
  type ModelCallRecord,
  type ModelCallReservation,
  type ModelExecutionAcceptResult,
  type ModelExecutionRecord,
  type ModelExecutionRepository,
  type ModelExecutionResumeState,
  type ModelExecutionTerminal,
  type ModelGateway,
  type ModelRequest,
  type ModelStreamEvent,
  type NormalizedModelResponse,
} from '../src/index.js';

class FakeModelExecutionRepository implements ModelExecutionRepository {
  readonly executions = new Map<string, ModelExecutionRecord>();
  readonly requestKeys = new Map<string, string>();
  readonly calls = new Map<string, ModelCallRecord>();

  async accept(input: {
    readonly modelExecutionId: string;
    readonly requestKey: string;
    readonly requestFingerprint: string;
    readonly requestHash: string;
    readonly selection: ModelExecutionRecord['selection'];
    readonly request: ModelRequest;
    readonly requiredCapabilities: ModelExecutionRecord['requiredCapabilities'];
    readonly effectivePolicy: ModelExecutionRecord['policy'];
    readonly createdAt: string;
  }): Promise<ModelExecutionAcceptResult> {
    const existingId = this.requestKeys.get(input.requestKey);
    if (existingId !== undefined) {
      const existing = this.executions.get(existingId);
      if (existing === undefined) {
        throw new Error('missing execution');
      }
      if (existing.requestFingerprint !== input.requestFingerprint) {
        return {
          kind: 'conflict',
          existingExecutionId: existing.modelExecutionId,
        };
      }
      return { kind: 'existing', execution: existing };
    }
    const record: ModelExecutionRecord = {
      modelExecutionId: input.modelExecutionId,
      requestKey: input.requestKey,
      requestFingerprint: input.requestFingerprint,
      requestHash: input.requestHash,
      selection: input.selection,
      request: input.request,
      requiredCapabilities: input.requiredCapabilities,
      policy: input.effectivePolicy,
      status: 'accepted',
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    };
    this.executions.set(record.modelExecutionId, record);
    this.requestKeys.set(record.requestKey, record.modelExecutionId);
    return { kind: 'created', execution: record };
  }

  async get(id: string): Promise<ModelExecutionRecord | null> {
    return this.executions.get(id) ?? null;
  }

  async reserveModelCall(call: ModelCallReservation): Promise<ModelCallRecord> {
    const record: ModelCallRecord = { ...call, status: 'reserved' };
    this.calls.set(record.modelCallId, record);
    return record;
  }

  async completeModelCall(call: CompletedModelCall): Promise<void> {
    const existing = this.calls.get(call.modelCallId);
    if (existing === undefined) throw new Error('missing call');
    this.calls.set(call.modelCallId, {
      ...existing,
      status: 'succeeded',
      response: call.response,
      responseHash: call.responseHash,
      completedAt: call.completedAt,
    });
  }

  async failModelCall(call: FailedModelCall): Promise<void> {
    const existing = this.calls.get(call.modelCallId);
    if (existing === undefined) throw new Error('missing call');
    this.calls.set(call.modelCallId, {
      ...existing,
      status: call.ambiguous ? 'ambiguous' : 'failed',
      error: call.error,
      completedAt: call.completedAt,
    });
  }

  async loadResumeState(id: string): Promise<ModelExecutionResumeState | null> {
    const execution = this.executions.get(id);
    if (execution === undefined) return null;
    return {
      modelExecutionId: id,
      execution,
      modelCalls: [...this.calls.values()].filter(
        (call) => call.executionId === id,
      ),
    };
  }

  async markTerminal(terminal: ModelExecutionTerminal): Promise<void> {
    const existing = this.executions.get(terminal.modelExecutionId);
    if (existing === undefined) throw new Error('missing execution');
    this.executions.set(terminal.modelExecutionId, {
      ...existing,
      status: terminal.status,
      result: terminal.result,
      ...(terminal.error === undefined ? {} : { error: terminal.error }),
      diagnostic: terminal.diagnostic,
      updatedAt: terminal.terminalAt,
    });
  }
}

const now = '2026-09-15T12:00:00.000Z';
const selection = { profile: 'fixture' };

const textRequest: ModelRequest = {
  messages: [{ role: 'user', content: [{ type: 'text', text: 'Say hello.' }] }],
  output: { mode: 'text' },
};

const textResponse: NormalizedModelResponse = {
  provider: 'fixture',
  model: 'fixture-model',
  receivedAt: now,
  finishReason: 'stop',
  text: 'Hello',
  usage: { inputTokens: 4, outputTokens: 1, totalTokens: 5 },
  metadata: {},
};

function ids() {
  let n = 0;
  return {
    next: (kind: 'execution' | 'call' | 'document' | 'memory' | 'event') =>
      `${kind}-${String((n += 1))}`,
  };
}

function streamingGateway(
  impl: Partial<ModelGateway> & Pick<ModelGateway, 'stream' | 'capabilities'>,
): ModelGateway {
  return {
    generate: async () => {
      throw new Error('generate must not be used when stream exists');
    },
    ...impl,
  };
}

describe('ModelExecutionEngine', () => {
  it('streams text deltas and a terminal normalized result', async () => {
    const events: ModelStreamEvent[] = [];
    const engine = createModelExecutionEngine({
      clock: { now: () => now },
      ids: ids(),
      repository: new FakeModelExecutionRepository(),
      gateway: streamingGateway({
        async capabilities() {
          return { structuredOutput: true, tools: true, vision: false };
        },
        async *stream() {
          yield { type: 'content-delta', sequence: 0, text: 'Hel' };
          yield { type: 'content-delta', sequence: 1, text: 'lo' };
          yield { type: 'completed', sequence: 2, response: textResponse };
        },
      }),
    });

    const result = await engine.execute(
      {
        requestKey: 'text-1',
        model: selection,
        request: textRequest,
      },
      {
        onEvent: (event) => {
          events.push(event);
        },
      },
    );

    expect(result.status).toBe('succeeded');
    if (result.status !== 'succeeded') return;
    expect(result.replayed).toBe(false);
    expect(result.response.text).toBe('Hello');
    expect(events.map((event) => event.type)).toEqual([
      'content-delta',
      'content-delta',
      'completed',
    ]);
    expect(events.map((event) => event.sequence)).toEqual([0, 1, 2]);
  });

  it('returns a tool call without executing it and accepts a later tool result', async () => {
    const toolResponse: NormalizedModelResponse = {
      ...textResponse,
      finishReason: 'tool',
      text: '',
      toolCalls: [
        {
          toolCallId: 'call_1',
          name: 'get_weather',
          arguments: { city: 'Paris' },
        },
      ],
    };
    const continuedResponse: NormalizedModelResponse = {
      ...textResponse,
      text: '18 C',
    };
    let calls = 0;
    const engine = createModelExecutionEngine({
      clock: { now: () => now },
      ids: ids(),
      repository: new FakeModelExecutionRepository(),
      gateway: streamingGateway({
        async capabilities() {
          return { structuredOutput: true, tools: true, vision: false };
        },
        async *stream(_request, context: GatewayCallContext) {
          calls += 1;
          if (context.callKey === 'model:0' && calls === 1) {
            yield {
              type: 'tool-call-delta',
              sequence: 0,
              index: 0,
              toolCallId: 'call_1',
              name: 'get_weather',
              argumentsDelta: '{"city":"Paris"}',
            };
            yield { type: 'completed', sequence: 1, response: toolResponse };
            return;
          }
          yield { type: 'content-delta', sequence: 0, text: '18 C' };
          yield { type: 'completed', sequence: 1, response: continuedResponse };
        },
      }),
    });

    const first = await engine.execute({
      requestKey: 'tool-1',
      model: selection,
      request: {
        ...textRequest,
        tools: [
          {
            type: 'function',
            name: 'get_weather',
            parameters: { type: 'object' },
          },
        ],
      },
    });
    expect(first.status).toBe('succeeded');
    if (first.status !== 'succeeded') return;
    expect(first.response.toolCalls?.[0]?.name).toBe('get_weather');

    const second = await engine.execute({
      requestKey: 'tool-2',
      model: selection,
      request: {
        messages: [
          ...textRequest.messages,
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_1',
                name: 'get_weather',
                arguments: { city: 'Paris' },
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_1',
                value: { celsius: 18 },
              },
            ],
          },
        ],
        output: { mode: 'text' },
      },
    });
    expect(second.status).toBe('succeeded');
    if (second.status !== 'succeeded') return;
    expect(second.response.text).toBe('18 C');
    expect(calls).toBe(2);
  });

  it('accepts whitespace-only tool-call argument fragments', async () => {
    const events: ModelStreamEvent[] = [];
    const toolResponse: NormalizedModelResponse = {
      ...textResponse,
      finishReason: 'tool',
      text: '',
      toolCalls: [
        {
          toolCallId: 'call_1',
          name: 'get_weather',
          arguments: { city: 'Paris' },
        },
      ],
    };
    const engine = createModelExecutionEngine({
      clock: { now: () => now },
      ids: ids(),
      repository: new FakeModelExecutionRepository(),
      gateway: streamingGateway({
        async capabilities() {
          return { structuredOutput: true, tools: true, vision: false };
        },
        async *stream() {
          yield {
            type: 'tool-call-delta',
            sequence: 0,
            index: 0,
            argumentsDelta: '{"city":',
          };
          yield {
            type: 'tool-call-delta',
            sequence: 1,
            index: 0,
            argumentsDelta: ' ',
          };
          yield {
            type: 'tool-call-delta',
            sequence: 2,
            index: 0,
            argumentsDelta: '"Paris"}',
          };
          yield { type: 'completed', sequence: 3, response: toolResponse };
        },
      }),
    });
    const result = await engine.execute(
      {
        requestKey: 'tool-whitespace-1',
        model: selection,
        request: textRequest,
      },
      {
        onEvent: (event) => {
          events.push(event);
        },
      },
    );
    expect(result.status).toBe('succeeded');
    expect(
      events.some(
        (event) =>
          event.type === 'tool-call-delta' && event.argumentsDelta === ' ',
      ),
    ).toBe(true);
  });

  it('rejects truly empty tool-call argument fragments', async () => {
    const engine = createModelExecutionEngine({
      clock: { now: () => now },
      ids: ids(),
      repository: new FakeModelExecutionRepository(),
      gateway: streamingGateway({
        async capabilities() {
          return { structuredOutput: true, tools: true, vision: false };
        },
        async *stream() {
          yield {
            type: 'tool-call-delta',
            sequence: 0,
            index: 0,
            argumentsDelta: '',
          };
          yield { type: 'completed', sequence: 1, response: textResponse };
        },
      }),
    });
    const result = await engine.execute({
      requestKey: 'tool-empty-1',
      model: selection,
      request: textRequest,
    });
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.error).toMatchObject({
      code: 'INVALID_REQUEST',
      retryable: false,
    });
  });

  it('reuses the same request identity without a second provider call', async () => {
    let streams = 0;
    const engine = createModelExecutionEngine({
      clock: { now: () => now },
      ids: ids(),
      repository: new FakeModelExecutionRepository(),
      gateway: streamingGateway({
        async capabilities() {
          return { structuredOutput: true, tools: false, vision: false };
        },
        async *stream() {
          streams += 1;
          yield { type: 'content-delta', sequence: 0, text: 'Hello' };
          yield { type: 'completed', sequence: 1, response: textResponse };
        },
      }),
    });
    const request = {
      requestKey: 'idempotent-1',
      model: selection,
      request: textRequest,
    };
    const first = await engine.execute(request);
    const second = await engine.execute(request);
    expect(first.status).toBe('succeeded');
    expect(second.status).toBe('succeeded');
    if (second.status !== 'succeeded') return;
    expect(second.replayed).toBe(true);
    expect(streams).toBe(1);
  });

  it('fails closed on conflicting request-key reuse', async () => {
    const engine = createModelExecutionEngine({
      clock: { now: () => now },
      ids: ids(),
      repository: new FakeModelExecutionRepository(),
      gateway: streamingGateway({
        async capabilities() {
          return { structuredOutput: true, tools: false, vision: false };
        },
        async *stream() {
          yield { type: 'completed', sequence: 0, response: textResponse };
        },
      }),
    });
    await engine.execute({
      requestKey: 'conflict-1',
      model: selection,
      request: textRequest,
    });
    const conflicted = await engine.execute({
      requestKey: 'conflict-1',
      model: selection,
      request: { ...textRequest, maxOutputTokens: 10 },
    });
    expect(conflicted.status).toBe('conflicted');
    if (conflicted.status === 'conflicted') {
      expect(conflicted.error.code).toBe('CONFLICT_IDEMPOTENCY_KEY');
    }
  });

  it('preserves structured ACME error data across runtime boundaries', async () => {
    const foreign = Object.assign(new Error('foreign AcmeError copy'), {
      data: {
        code: 'INVALID_REQUEST' as const,
        message: 'The provider rejected the request.',
        stage: 'calling-model' as const,
        retryable: false,
        details: { status: 400, providerMessage: 'bad request' },
      },
    });
    const engine = createModelExecutionEngine({
      clock: { now: () => now },
      ids: ids(),
      repository: new FakeModelExecutionRepository(),
      gateway: streamingGateway({
        async capabilities() {
          return { structuredOutput: true, tools: false, vision: false };
        },
        async *stream() {
          throw foreign;
          yield { type: 'completed', sequence: 0, response: textResponse };
        },
      }),
    });
    const result = await engine.execute({
      requestKey: 'foreign-error-1',
      model: selection,
      request: textRequest,
    });
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.error).toEqual(foreign.data);
    expect(result.diagnostic).toMatchObject({
      kind: 'invalid-request',
      httpStatus: 400,
    });
  });

  it('keeps terminal failure sequence contiguous after streamed deltas', async () => {
    const events: ModelStreamEvent[] = [];
    const engine = createModelExecutionEngine({
      clock: { now: () => now },
      ids: ids(),
      repository: new FakeModelExecutionRepository(),
      gateway: streamingGateway({
        async capabilities() {
          return { structuredOutput: true, tools: false, vision: false };
        },
        async *stream() {
          yield { type: 'content-delta', sequence: 0, text: 'part' };
          yield { type: 'content-delta', sequence: 1, text: 'ial' };
          yield {
            type: 'failed',
            sequence: 2,
            error: {
              code: 'MODEL_INVALID_RESPONSE',
              message: 'Late provider stream failure.',
              stage: 'calling-model',
              retryable: false,
            },
          };
        },
      }),
    });
    const result = await engine.execute(
      { requestKey: 'late-failure-1', model: selection, request: textRequest },
      {
        onEvent: (event) => {
          events.push(event);
        },
      },
    );
    expect(result.status).toBe('failed');
    expect(events.map((event) => event.sequence)).toEqual([0, 1, 2]);
    expect(events.map((event) => event.type)).toEqual([
      'content-delta',
      'content-delta',
      'failed',
    ]);
    const terminal = events.at(-1);
    expect(terminal?.type).toBe('failed');
    if (terminal?.type === 'failed') {
      expect(terminal.error.code).toBe('MODEL_INVALID_RESPONSE');
    }
  });

  it('maps an unknown ordinary exception to INTERNAL', async () => {
    const engine = createModelExecutionEngine({
      clock: { now: () => now },
      ids: ids(),
      repository: new FakeModelExecutionRepository(),
      gateway: streamingGateway({
        async capabilities() {
          return { structuredOutput: true, tools: false, vision: false };
        },
        async *stream() {
          throw new Error('boom');
          yield { type: 'completed', sequence: 0, response: textResponse };
        },
      }),
    });
    const result = await engine.execute({
      requestKey: 'unknown-error-1',
      model: selection,
      request: textRequest,
    });
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.error).toMatchObject({ code: 'INTERNAL', retryable: false });
    expect(result.diagnostic.kind).toBe('internal');
  });

  it('records ambiguous delivery and does not retry', async () => {
    let streams = 0;
    const engine = createModelExecutionEngine({
      clock: { now: () => now },
      ids: ids(),
      repository: new FakeModelExecutionRepository(),
      gateway: streamingGateway({
        async capabilities() {
          return { structuredOutput: true, tools: false, vision: false };
        },
        async *stream() {
          streams += 1;
          throw new AmbiguousModelCallError({
            code: 'TIMEOUT',
            message: 'The provider may have executed this call.',
            stage: 'calling-model',
            retryable: false,
            details: { delivery: 'unknown', reason: 'timeout' },
          });
          yield { type: 'completed', sequence: 0, response: textResponse };
        },
      }),
    });
    const request = {
      requestKey: 'ambiguous-1',
      model: selection,
      request: textRequest,
    };
    const first = await engine.execute(request);
    const second = await engine.execute(request);
    expect(first.status).toBe('failed');
    expect(second.status).toBe('failed');
    if (first.status === 'failed') {
      expect(first.diagnostic.kind).toBe('ambiguous-delivery');
    }
    expect(streams).toBe(1);
  });

  it('does not import domain, memory, state or ExecutionEngine', () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../src/model-execution-engine.ts',
      ),
      'utf8',
    );
    expect(source).not.toMatch(/from '\.\/execution-engine\.js'/);
    expect(source).not.toMatch(/from '\.\/memory-engine\.js'/);
    expect(source).not.toMatch(/from '\.\/state-engine\.js'/);
    expect(source).not.toMatch(/from '\.\/modules\.js'/);
    expect(source).not.toMatch(/from '\.\/response-pipeline\.js'/);
    expect(source).not.toMatch(/DomainModule/);
    expect(source).not.toMatch(/MemoryEngine/);
    expect(source).not.toMatch(/StateEngine/);
  });
});
