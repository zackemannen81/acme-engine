import { describe, expect, it } from 'vitest';

import type {
  ExecuteOptions,
  ExecutionEngine,
  ExecutionRequest,
  ExecutionResult,
  ReplayReport,
} from '../../packages/core/src/index.js';
import {
  ACME_RUNTIME_MAX_REQUEST_BYTES,
  createAcmeRuntimeHost,
  toExecutionRequest,
} from '../../apps/cli/src/acme-runtime-host.js';
import {
  ACME_RUNTIME_PROTOCOL_VERSION,
  type AcmeRuntimeDescriptor,
  type AcmeRuntimeRequest,
} from '../../apps/cli/src/acme-runtime-wire.js';

const descriptor: AcmeRuntimeDescriptor = Object.freeze({
  protocolVersion: ACME_RUNTIME_PROTOCOL_VERSION,
  engineBuild: 'poc-1-v1',
  executePath: '/v1/execute',
});

function fixtureRequest(
  overrides: Partial<AcmeRuntimeRequest> = {},
): AcmeRuntimeRequest {
  const base: AcmeRuntimeRequest = {
    protocolVersion: ACME_RUNTIME_PROTOCOL_VERSION,
    requestKey: 'runtime-request-1',
    correlationId: 'caller-correlation-1',
    engine: {
      namespace: 'neutral',
      task: 'summarize',
      entityId: 'engine-entity-1',
      expectedRevision: 7,
      model: {
        profile: 'fixture-profile',
        providerHint: 'fixture-provider',
        modelHint: 'fixture-model',
      },
      policy: {
        timeoutMs: 30_000,
        maxModelCalls: 1,
        maxRepairCalls: 0,
        maxRevisionCalls: 0,
        maxInputTokens: 2_000,
        maxOutputTokens: 1_000,
        maxEstimatedCostMinor: 25,
        retention: 'hash-only',
      },
    },
    input: { title: 'Fixture', count: 2 },
  };
  return { ...base, ...overrides };
}

function headers(extra: Record<string, string> = {}): Headers {
  return new Headers({
    authorization: 'test-authorization',
    'x-acme-runtime-protocol': ACME_RUNTIME_PROTOCOL_VERSION,
    ...extra,
  });
}

function authorize(request: Request): boolean {
  return request.headers.get('authorization') === 'test-authorization';
}

function executeRequest(
  value: unknown,
  options: {
    readonly headers?: Headers;
    readonly body?: string;
    readonly signal?: AbortSignal;
  } = {},
): Request {
  const requestHeaders = options.headers ?? headers();
  if (!requestHeaders.has('content-type')) {
    requestHeaders.set('content-type', 'application/json');
  }
  return new Request('https://runtime.example/v1/execute', {
    method: 'POST',
    headers: requestHeaders,
    body: options.body ?? JSON.stringify(value),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
}

interface EngineObservation {
  readonly requests: ExecutionRequest[];
  readonly signals: (AbortSignal | undefined)[];
}

function fakeReplayReport(executionId: string): ReplayReport {
  return {
    executionId,
    mode: 'verify',
    status: 'unavailable',
    differences: [],
  };
}

function recordingEngine(result: ExecutionResult): {
  readonly engine: ExecutionEngine;
  readonly observed: EngineObservation;
} {
  const requests: ExecutionRequest[] = [];
  const signals: (AbortSignal | undefined)[] = [];
  return {
    observed: { requests, signals },
    engine: {
      async execute<TInput>(
        request: ExecutionRequest<TInput>,
        options?: ExecuteOptions,
      ): Promise<ExecutionResult> {
        requests.push(request as ExecutionRequest);
        signals.push(options?.signal);
        return result;
      },
      async replayVerify(executionId: string): Promise<ReplayReport> {
        return fakeReplayReport(executionId);
      },
    },
  };
}

const committed: ExecutionResult = {
  status: 'committed',
  executionId: 'execution-1',
  replayed: false,
  revision: 8,
  documentKeys: ['document-1'],
  eventIds: ['event-1'],
};

describe('canonical ACME runtime compatibility boundary', () => {
  it('authenticates before exposing compatibility metadata', async () => {
    const { engine, observed } = recordingEngine(committed);
    const hosts = [
      createAcmeRuntimeHost({ engine, descriptor, authorize: () => false }),
      createAcmeRuntimeHost({
        engine,
        descriptor,
        authorize: () => {
          throw new Error('auth unavailable');
        },
      }),
    ];

    for (const host of hosts) {
      const response = await host.fetch(
        new Request('https://runtime.example/v1/compatibility', {
          headers: { 'x-acme-runtime-protocol': ACME_RUNTIME_PROTOCOL_VERSION },
        }),
      );
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    }
    expect(observed.requests).toEqual([]);
  });

  it('returns only the injected generic runtime descriptor', async () => {
    const { engine } = recordingEngine(committed);
    const host = createAcmeRuntimeHost({ engine, descriptor, authorize });
    const response = await host.fetch(
      new Request('https://runtime.example/v1/compatibility', {
        headers: headers(),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(descriptor);
    expect(JSON.stringify(descriptor)).not.toContain('felixnissen');
    expect(JSON.stringify(descriptor)).not.toContain('aal-');
  });

  it('refuses protocol drift without invoking the engine', async () => {
    const { engine, observed } = recordingEngine(committed);
    const host = createAcmeRuntimeHost({ engine, descriptor, authorize });
    const response = await host.fetch(
      new Request('https://runtime.example/v1/compatibility', {
        headers: headers({ 'x-acme-runtime-protocol': 'acme-runtime/2' }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'RUNTIME_PROTOCOL_MISMATCH',
    });
    expect(observed.requests).toEqual([]);
  });
});

describe('canonical ACME runtime execute boundary', () => {
  it('maps the generic wire exactly to public ExecutionRequest', async () => {
    const { engine, observed } = recordingEngine(committed);
    const host = createAcmeRuntimeHost({ engine, descriptor, authorize });
    const request = fixtureRequest();

    const response = await host.fetch(executeRequest(request));
    expect(response.status).toBe(200);
    expect(observed.requests).toEqual([
      {
        requestKey: request.requestKey,
        namespace: request.engine.namespace,
        task: request.engine.task,
        entityId: request.engine.entityId,
        expectedRevision: request.engine.expectedRevision,
        input: request.input,
        model: request.engine.model,
        policy: request.engine.policy,
      },
    ]);
    expect(JSON.stringify(observed.requests[0])).not.toContain(
      request.correlationId,
    );

    await expect(response.json()).resolves.toEqual({
      protocolVersion: ACME_RUNTIME_PROTOCOL_VERSION,
      requestKey: request.requestKey,
      status: 'committed',
      executionId: 'execution-1',
      replayed: false,
      revision: 8,
      documentKeys: ['document-1'],
      eventIds: ['event-1'],
    });
  });

  it('rejects application-layer metadata as an unexpected wire field', async () => {
    const { engine, observed } = recordingEngine(committed);
    const host = createAcmeRuntimeHost({ engine, descriptor, authorize });
    const request = { ...fixtureRequest(), workspaceId: 'application-only' };

    const response = await host.fetch(executeRequest(request));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_RUNTIME_REQUEST',
    });
    expect(observed.requests).toEqual([]);
  });

  it('forwards Request.signal to ExecutionEngine.execute', async () => {
    const cancelled: ExecutionResult = {
      status: 'cancelled',
      executionId: 'execution-cancelled',
      error: {
        code: 'CANCELLED',
        message: 'cancelled by caller',
        stage: 'cancelled',
        retryable: false,
      },
    };
    const { engine, observed } = recordingEngine(cancelled);
    const host = createAcmeRuntimeHost({ engine, descriptor, authorize });
    const controller = new AbortController();
    const request = executeRequest(fixtureRequest(), {
      signal: controller.signal,
    });

    const response = await host.fetch(request);
    expect(response.status).toBe(200);
    expect(observed.signals).toHaveLength(1);
    expect(observed.signals[0]).toBe(request.signal);
  });

  it('preserves structured terminal engine errors without reclassification', async () => {
    const failed: ExecutionResult = {
      status: 'failed',
      executionId: 'execution-failed',
      error: {
        code: 'MODEL_UNAVAILABLE',
        message: 'fixture unavailable',
        stage: 'calling-model',
        retryable: true,
        details: { provider: 'fixture', attempt: 1 },
        causeRef: 'model-call-1',
      },
    };
    const { engine } = recordingEngine(failed);
    const host = createAcmeRuntimeHost({ engine, descriptor, authorize });
    const request = fixtureRequest();

    const response = await host.fetch(executeRequest(request));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      protocolVersion: ACME_RUNTIME_PROTOCOL_VERSION,
      requestKey: request.requestKey,
      status: 'failed',
      executionId: 'execution-failed',
      error: failed.error,
    });
  });

  it('keeps request translation deterministic as a pure function', () => {
    expect(toExecutionRequest(fixtureRequest())).toEqual({
      requestKey: 'runtime-request-1',
      namespace: 'neutral',
      task: 'summarize',
      entityId: 'engine-entity-1',
      expectedRevision: 7,
      input: { title: 'Fixture', count: 2 },
      model: {
        profile: 'fixture-profile',
        providerHint: 'fixture-provider',
        modelHint: 'fixture-model',
      },
      policy: {
        timeoutMs: 30_000,
        maxModelCalls: 1,
        maxRepairCalls: 0,
        maxRevisionCalls: 0,
        maxInputTokens: 2_000,
        maxOutputTokens: 1_000,
        maxEstimatedCostMinor: 25,
        retention: 'hash-only',
      },
    });
  });

  it('refuses malformed, wrong-media and oversized bodies before execution', async () => {
    const { engine, observed } = recordingEngine(committed);
    const host = createAcmeRuntimeHost({ engine, descriptor, authorize });

    const wrongMedia = await host.fetch(
      executeRequest(fixtureRequest(), {
        headers: headers({ 'content-type': 'text/plain' }),
      }),
    );
    expect(wrongMedia.status).toBe(415);

    const malformed = await host.fetch(
      executeRequest(fixtureRequest(), { body: '{not json' }),
    );
    expect(malformed.status).toBe(400);

    const declaredOversized = await host.fetch(
      executeRequest(fixtureRequest(), {
        headers: headers({
          'content-type': 'application/json',
          'content-length': String(ACME_RUNTIME_MAX_REQUEST_BYTES + 1),
        }),
        body: '{}',
      }),
    );
    expect(declaredOversized.status).toBe(413);

    const actualOversized = await host.fetch(
      executeRequest(fixtureRequest(), {
        body: ' '.repeat(ACME_RUNTIME_MAX_REQUEST_BYTES + 1),
      }),
    );
    expect(actualOversized.status).toBe(413);
    expect(observed.requests).toEqual([]);
  });

  it('rejects routes and methods deterministically', async () => {
    const { engine, observed } = recordingEngine(committed);
    const host = createAcmeRuntimeHost({ engine, descriptor, authorize });

    const wrongMethod = await host.fetch(
      new Request('https://runtime.example/v1/compatibility', {
        method: 'POST',
        headers: headers(),
      }),
    );
    expect(wrongMethod.status).toBe(405);

    const missing = await host.fetch(
      new Request('https://runtime.example/v1/nope', {
        headers: headers(),
      }),
    );
    expect(missing.status).toBe(404);
    expect(observed.requests).toEqual([]);
  });
});
