import { describe, expect, it } from 'vitest';

import type {
  ExecuteOptions,
  ExecutionEngine,
  ExecutionRequest,
  ExecutionResult,
  ReplayReport,
} from '../../packages/core/src/index.js';
import {
  createAcmeRuntimeHost,
  toExecutionRequestV3,
} from '../../apps/cli/src/aal-runtime-host.js';
import {
  ACME_ADAPTER_V3_CONTRACT_VERSION,
  ACME_ENGINE_V3_REVIEW_POINT,
  ACME_RUNTIME_DESCRIPTOR,
  ACME_RUNTIME_PROTOCOL_VERSION,
  type AcmeAdapterV3Request,
} from '../../apps/cli/src/aal-runtime-wire.js';

const MAX_REQUEST_BYTES = 1_048_576;

function fixtureRequest(overrides: Partial<AcmeAdapterV3Request> = {}): AcmeAdapterV3Request {
  const base: AcmeAdapterV3Request = {
    contractVersion: ACME_ADAPTER_V3_CONTRACT_VERSION,
    requestKey: 'aal-runtime-request-1',
    correlationId: 'correlation-1',
    workspaceId: 'workspace-1',
    subject: {
      entityType: 'job',
      entityId: 'app-job-1',
      expectedApplicationVersion: 3,
    },
    engineTarget: {
      repository: ACME_ENGINE_V3_REVIEW_POINT.repository,
      commit: ACME_ENGINE_V3_REVIEW_POINT.commit,
      namespace: 'neutral',
      entityId: 'engine-entity-1',
      expectedEngineRevision: 7,
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
    task: {
      id: 'aal-task-1',
      engineTask: 'summarize',
      version: '3.0.0',
      contractRef: 'neutral.summary@1',
      inputSchemaSha256: 'a'.repeat(64),
      outputSchemaSha256: 'b'.repeat(64),
    },
    sourceArtifactIds: ['artifact-1', 'artifact-2'],
    input: {
      title: 'Fixture',
      count: 2,
    },
  };
  return { ...base, ...overrides };
}

function protocolHeaders(extra: Record<string, string> = {}): Headers {
  return new Headers({
    authorization: 'Bearer test-runtime',
    'x-acme-runtime-protocol': ACME_RUNTIME_PROTOCOL_VERSION,
    'x-acme-adapter-contract': ACME_ADAPTER_V3_CONTRACT_VERSION,
    'x-acme-engine-commit': ACME_ENGINE_V3_REVIEW_POINT.commit,
    ...extra,
  });
}

function authorize(request: Request): boolean {
  return request.headers.get('authorization') === 'Bearer test-runtime';
}

function compatibilityRequest(
  headers = protocolHeaders(),
  method = 'GET',
): Request {
  return new Request('https://runtime.example/v1/compatibility', {
    method,
    headers,
  });
}

function executeRequest(
  value: unknown,
  options: {
    readonly headers?: Headers;
    readonly method?: string;
    readonly body?: BodyInit | null;
    readonly signal?: AbortSignal;
  } = {},
): Request {
  const headers = options.headers ?? protocolHeaders();
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  return new Request('https://runtime.example/v1/execute', {
    method: options.method ?? 'POST',
    headers,
    body: options.body === undefined ? JSON.stringify(value) : options.body,
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

function recordingEngine(
  result: ExecutionResult | (() => never),
): { readonly engine: ExecutionEngine; readonly observed: EngineObservation } {
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
        if (typeof result === 'function') {
          return result();
        }
        return result;
      },
      async replayVerify(executionId: string): Promise<ReplayReport> {
        return fakeReplayReport(executionId);
      },
    },
  };
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('AAL runtime compatibility boundary', () => {
  it('requires authorization before exposing compatibility metadata or checking pins', async () => {
    const { engine, observed } = recordingEngine({
      status: 'committed',
      executionId: 'unused',
      replayed: false,
      revision: 1,
      documentKeys: [],
      eventIds: [],
    });
    const denied = createAcmeRuntimeHost({ engine, authorize: () => false });
    const thrown = createAcmeRuntimeHost({
      engine,
      authorize: () => {
        throw new Error('auth backend unavailable');
      },
    });

    for (const host of [denied, thrown]) {
      const response = await host.fetch(
        new Request('https://runtime.example/v1/compatibility'),
      );
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    }
    expect(observed.requests).toEqual([]);
  });

  it('returns the exact frozen descriptor only after auth and pin checks', async () => {
    const { engine, observed } = recordingEngine({
      status: 'committed',
      executionId: 'unused',
      replayed: false,
      revision: 1,
      documentKeys: [],
      eventIds: [],
    });
    const host = createAcmeRuntimeHost({ engine, authorize });

    const response = await host.fetch(compatibilityRequest());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(ACME_RUNTIME_DESCRIPTOR);
    expect(ACME_RUNTIME_DESCRIPTOR.compatibility).toBe('unverified');
    expect(observed.requests).toEqual([]);
  });

  it('refuses runtime, adapter and engine header drift before execution', async () => {
    const { engine, observed } = recordingEngine({
      status: 'committed',
      executionId: 'unused',
      replayed: false,
      revision: 1,
      documentKeys: [],
      eventIds: [],
    });
    const host = createAcmeRuntimeHost({ engine, authorize });
    const cases: readonly [Record<string, string>, string][] = [
      [
        { 'x-acme-runtime-protocol': 'aal-acme-runtime/2' },
        'RUNTIME_PROTOCOL_MISMATCH',
      ],
      [
        { 'x-acme-adapter-contract': 'aal-acme-adapter/2' },
        'ADAPTER_CONTRACT_MISMATCH',
      ],
      [{ 'x-acme-engine-commit': '0'.repeat(40) }, 'ENGINE_PIN_MISMATCH'],
    ];

    for (const [override, code] of cases) {
      const response = await host.fetch(
        compatibilityRequest(protocolHeaders(override)),
      );
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({ code });
    }
    expect(observed.requests).toEqual([]);
  });
});

describe('AAL runtime execute boundary', () => {
  it('translates exactly to public ExecutionRequest and drops application-only metadata', async () => {
    const result: ExecutionResult = {
      status: 'committed',
      executionId: 'execution-1',
      replayed: false,
      revision: 8,
      documentKeys: ['document-1'],
      eventIds: ['event-1'],
    };
    const { engine, observed } = recordingEngine(result);
    const host = createAcmeRuntimeHost({ engine, authorize });
    const request = fixtureRequest();

    const response = await host.fetch(executeRequest(request));
    expect(response.status).toBe(200);
    expect(observed.requests).toEqual([
      {
        requestKey: request.requestKey,
        namespace: request.engineTarget.namespace,
        task: request.task.engineTask,
        entityId: request.engineTarget.entityId,
        expectedRevision: request.engineTarget.expectedEngineRevision,
        input: request.input,
        model: request.engineTarget.model,
        policy: request.engineTarget.policy,
      },
    ]);
    const engineJson = JSON.stringify(observed.requests[0]);
    expect(engineJson).not.toContain(request.workspaceId);
    expect(engineJson).not.toContain(request.correlationId);
    expect(engineJson).not.toContain(request.subject.entityId);
    expect(engineJson).not.toContain('artifact-1');
    expect(engineJson).not.toContain(request.task.inputSchemaSha256);

    await expect(response.json()).resolves.toEqual({
      contractVersion: ACME_ADAPTER_V3_CONTRACT_VERSION,
      requestKey: request.requestKey,
      status: 'committed',
      executionId: 'execution-1',
      replayed: false,
      engineRevision: 8,
      documentKeys: ['document-1'],
      eventIds: ['event-1'],
    });
  });

  it('forwards the Request AbortSignal to ExecutionEngine.execute', async () => {
    const { engine, observed } = recordingEngine({
      status: 'cancelled',
      executionId: 'execution-cancelled',
      error: {
        code: 'CANCELLED',
        message: 'cancelled by caller',
        stage: 'cancelled',
        retryable: false,
      },
    });
    const host = createAcmeRuntimeHost({ engine, authorize });
    const controller = new AbortController();
    const request = executeRequest(fixtureRequest(), {
      signal: controller.signal,
    });

    const response = await host.fetch(request);
    expect(response.status).toBe(200);
    expect(observed.signals).toHaveLength(1);
    expect(observed.signals[0]).toBe(request.signal);
  });

  it('preserves structured terminal error evidence losslessly', async () => {
    const result: ExecutionResult = {
      status: 'failed',
      executionId: 'execution-failed',
      error: {
        code: 'MODEL_UNAVAILABLE',
        message: 'fixture provider unavailable',
        stage: 'calling-model',
        retryable: true,
        details: { provider: 'fixture', attempt: 1 },
        causeRef: 'model-call-evidence-1',
      },
    };
    const { engine } = recordingEngine(result);
    const host = createAcmeRuntimeHost({ engine, authorize });
    const request = fixtureRequest();

    const response = await host.fetch(executeRequest(request));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      contractVersion: ACME_ADAPTER_V3_CONTRACT_VERSION,
      requestKey: request.requestKey,
      status: 'failed',
      executionId: 'execution-failed',
      error: result.error,
    });
  });

  it('keeps translation deterministic as a standalone pure function', () => {
    const request = fixtureRequest();
    expect(toExecutionRequestV3(request)).toEqual({
      requestKey: 'aal-runtime-request-1',
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

  it('refuses policy drift before invoking the engine', async () => {
    const { engine, observed } = recordingEngine({
      status: 'committed',
      executionId: 'unused',
      replayed: false,
      revision: 1,
      documentKeys: [],
      eventIds: [],
    });
    const host = createAcmeRuntimeHost({ engine, authorize });
    const base = fixtureRequest();
    const drifts = [
      { maxModelCalls: 2 },
      { maxRepairCalls: 1 },
      { maxRevisionCalls: 1 },
      { maxEstimatedCostMinor: 0 },
    ];

    for (const drift of drifts) {
      const request = {
        ...base,
        engineTarget: {
          ...base.engineTarget,
          policy: { ...base.engineTarget.policy, ...drift },
        },
      } as AcmeAdapterV3Request;
      const response = await host.fetch(executeRequest(request));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: 'INVALID_V3_REQUEST',
      });
    }
    expect(observed.requests).toEqual([]);
  });

  it('refuses wrong media, malformed JSON, oversized bodies and body engine-pin drift before execution', async () => {
    const { engine, observed } = recordingEngine({
      status: 'committed',
      executionId: 'unused',
      replayed: false,
      revision: 1,
      documentKeys: [],
      eventIds: [],
    });
    const host = createAcmeRuntimeHost({ engine, authorize });
    const request = fixtureRequest();

    const wrongMedia = await host.fetch(
      executeRequest(request, {
        headers: protocolHeaders({ 'content-type': 'text/plain' }),
      }),
    );
    expect(wrongMedia.status).toBe(415);

    const malformed = await host.fetch(
      executeRequest(request, { body: '{not json' }),
    );
    expect(malformed.status).toBe(400);

    const declaredOversized = await host.fetch(
      executeRequest(request, {
        headers: protocolHeaders({
          'content-type': 'application/json',
          'content-length': String(MAX_REQUEST_BYTES + 1),
        }),
        body: '{}',
      }),
    );
    expect(declaredOversized.status).toBe(413);

    const actualOversized = await host.fetch(
      executeRequest(request, { body: ' '.repeat(MAX_REQUEST_BYTES + 1) }),
    );
    expect(actualOversized.status).toBe(413);

    const wrongPin = {
      ...request,
      engineTarget: {
        ...request.engineTarget,
        commit: '0'.repeat(40),
      },
    } as unknown as AcmeAdapterV3Request;
    const pinResponse = await host.fetch(executeRequest(wrongPin));
    expect(pinResponse.status).toBe(409);
    await expect(pinResponse.json()).resolves.toMatchObject({
      code: 'ENGINE_PIN_MISMATCH',
    });

    expect(observed.requests).toEqual([]);
  });

  it('returns deterministic route/method errors without engine invocation', async () => {
    const { engine, observed } = recordingEngine({
      status: 'committed',
      executionId: 'unused',
      replayed: false,
      revision: 1,
      documentKeys: [],
      eventIds: [],
    });
    const host = createAcmeRuntimeHost({ engine, authorize });

    const missing = await host.fetch(
      new Request('https://runtime.example/v1/nope', {
        headers: protocolHeaders(),
      }),
    );
    expect(missing.status).toBe(404);

    const wrongCompatibilityMethod = await host.fetch(
      compatibilityRequest(protocolHeaders(), 'POST'),
    );
    expect(wrongCompatibilityMethod.status).toBe(405);
    expect(wrongCompatibilityMethod.headers.get('allow')).toBe('GET');

    const wrongExecuteMethod = await host.fetch(
      executeRequest(fixtureRequest(), { method: 'GET', body: null }),
    );
    expect(wrongExecuteMethod.status).toBe(405);
    expect(wrongExecuteMethod.headers.get('allow')).toBe('POST');
    expect(observed.requests).toEqual([]);
  });

  it('never turns an unexpected thrown engine exception into a terminal v3 result', async () => {
    const { engine } = recordingEngine(() => {
      throw new Error('escaped engine bug');
    });
    const host = createAcmeRuntimeHost({ engine, authorize });

    const response = await host.fetch(executeRequest(fixtureRequest()));
    expect(response.status).toBe(500);
    expect(await responseBody(response)).toMatchObject({
      code: 'ENGINE_HOST_FAILURE',
    });
  });
});
