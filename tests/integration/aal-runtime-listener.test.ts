import { describe, expect, it } from 'vitest';

import type {
  ExecuteOptions,
  ExecutionEngine,
  ExecutionRequest,
  ExecutionResult,
  ReplayReport,
} from '../../packages/core/src/index.js';
import { createAcmeRuntimeHost } from '../../apps/cli/src/aal-runtime-host.js';
import {
  createAcmeRuntimeListener,
  createBearerAuthorizer,
} from '../../apps/cli/src/aal-runtime-listener.js';
import { readAcmeRuntimeServiceConfig } from '../../apps/cli/src/aal-runtime-service.js';
import {
  ACME_ADAPTER_V3_CONTRACT_VERSION,
  ACME_ENGINE_V3_REVIEW_POINT,
  ACME_RUNTIME_DESCRIPTOR,
  ACME_RUNTIME_PROTOCOL_VERSION,
  type AcmeAdapterV3Request,
} from '../../apps/cli/src/aal-runtime-wire.js';

const TOKEN = 'runtime-test-token-00000000000000000000';
const MAX_REQUEST_BYTES = 1_048_576;

function fixtureRequest(): AcmeAdapterV3Request {
  return {
    contractVersion: ACME_ADAPTER_V3_CONTRACT_VERSION,
    requestKey: 'listener-request-1',
    correlationId: 'listener-correlation-1',
    workspaceId: 'listener-workspace-1',
    subject: {
      entityType: 'job',
      entityId: 'application-job-1',
      expectedApplicationVersion: 4,
    },
    engineTarget: {
      repository: ACME_ENGINE_V3_REVIEW_POINT.repository,
      commit: ACME_ENGINE_V3_REVIEW_POINT.commit,
      namespace: 'neutral',
      entityId: 'engine-entity-listener-1',
      expectedEngineRevision: 2,
      model: {
        profile: 'listener-fixture-profile',
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
      id: 'listener-task-1',
      engineTask: 'summarize',
      version: '3.0.0',
      contractRef: 'neutral.summary@1',
      inputSchemaSha256: 'a'.repeat(64),
      outputSchemaSha256: 'b'.repeat(64),
    },
    sourceArtifactIds: ['artifact-listener-1'],
    input: { title: 'Loopback fixture' },
  };
}

function runtimeHeaders(token = TOKEN): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    'x-acme-runtime-protocol': ACME_RUNTIME_PROTOCOL_VERSION,
    'x-acme-adapter-contract': ACME_ADAPTER_V3_CONTRACT_VERSION,
    'x-acme-engine-commit': ACME_ENGINE_V3_REVIEW_POINT.commit,
  };
}

function replayReport(executionId: string): ReplayReport {
  return {
    executionId,
    mode: 'verify',
    status: 'unavailable',
    differences: [],
  };
}

function recordingEngine(
  execute: (
    request: ExecutionRequest,
    options: ExecuteOptions | undefined,
  ) => Promise<ExecutionResult> | ExecutionResult,
): {
  readonly engine: ExecutionEngine;
  readonly requests: ExecutionRequest[];
  readonly signals: (AbortSignal | undefined)[];
} {
  const requests: ExecutionRequest[] = [];
  const signals: (AbortSignal | undefined)[] = [];
  return {
    requests,
    signals,
    engine: {
      async execute<TInput>(
        request: ExecutionRequest<TInput>,
        options?: ExecuteOptions,
      ): Promise<ExecutionResult> {
        requests.push(request as ExecutionRequest);
        signals.push(options?.signal);
        return execute(request as ExecutionRequest, options);
      },
      async replayVerify(executionId: string): Promise<ReplayReport> {
        return replayReport(executionId);
      },
    },
  };
}

function committedResult(): ExecutionResult {
  return {
    status: 'committed',
    executionId: 'listener-execution-1',
    replayed: false,
    revision: 3,
    documentKeys: ['listener-document-1'],
    eventIds: ['listener-event-1'],
  };
}

async function withListener<T>(
  engine: ExecutionEngine,
  run: (origin: string) => Promise<T>,
): Promise<T> {
  const host = createAcmeRuntimeHost({
    engine,
    authorize: createBearerAuthorizer(TOKEN),
  });
  const listener = createAcmeRuntimeListener({
    host,
    hostname: '127.0.0.1',
    port: 0,
  });
  const address = await listener.listen();
  try {
    return await run(address.origin);
  } finally {
    await listener.close();
  }
}

function fullServiceEnv(): NodeJS.ProcessEnv {
  return {
    ACME_RUNTIME_REPOSITORY: 'postgres',
    ACME_RUNTIME_MODEL_PROVIDER: 'openai',
    ACME_POSTGRES_URL: 'postgresql://acme:acme@127.0.0.1:5432/acme',
    ACME_RUNTIME_LISTEN_HOST: '127.0.0.1',
    ACME_RUNTIME_LISTEN_PORT: '8787',
    ACME_RUNTIME_BEARER_TOKEN: TOKEN,
    OPENAI_API_KEY: 'fixture-openai-key',
    ACME_RUNTIME_MODEL_PROFILE: 'listener-fixture-profile',
    ACME_RUNTIME_OPENAI_MODEL: 'fixture-model-wire-id',
    ACME_RUNTIME_MODEL_PROVIDER_HINT: 'fixture-provider',
    ACME_RUNTIME_MODEL_HINT: 'fixture-model',
  };
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 2_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for listener test condition.');
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe('AAL runtime Node HTTP listener', () => {
  it('round-trips the exact verified compatibility descriptor over loopback HTTP', async () => {
    const observed = recordingEngine(() => committedResult());
    await withListener(observed.engine, async (origin) => {
      const response = await fetch(`${origin}/v1/compatibility`, {
        headers: runtimeHeaders(),
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(ACME_RUNTIME_DESCRIPTOR);
    });
    expect(observed.requests).toEqual([]);
  });

  it('round-trips execute through the existing Fetch host without reinterpretation', async () => {
    const observed = recordingEngine(() => committedResult());
    const request = fixtureRequest();
    await withListener(observed.engine, async (origin) => {
      const response = await fetch(`${origin}/v1/execute`, {
        method: 'POST',
        headers: {
          ...runtimeHeaders(),
          'content-type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        contractVersion: ACME_ADAPTER_V3_CONTRACT_VERSION,
        requestKey: request.requestKey,
        status: 'committed',
        executionId: 'listener-execution-1',
        replayed: false,
        engineRevision: 3,
        documentKeys: ['listener-document-1'],
        eventIds: ['listener-event-1'],
      });
    });
    expect(observed.requests).toHaveLength(1);
    expect(observed.requests[0]).toMatchObject({
      requestKey: request.requestKey,
      namespace: request.engineTarget.namespace,
      entityId: request.engineTarget.entityId,
      expectedRevision: request.engineTarget.expectedEngineRevision,
      model: request.engineTarget.model,
      policy: request.engineTarget.policy,
    });
  });

  it('refuses bad authorization before the engine is invoked', async () => {
    const observed = recordingEngine(() => committedResult());
    await withListener(observed.engine, async (origin) => {
      const response = await fetch(`${origin}/v1/execute`, {
        method: 'POST',
        headers: {
          ...runtimeHeaders('wrong-token-that-is-definitely-not-authorized'),
          'content-type': 'application/json',
        },
        body: JSON.stringify(fixtureRequest()),
      });
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });
    expect(observed.requests).toEqual([]);
  });

  it('preserves the Fetch host 1 MiB request limit over chunked/real HTTP', async () => {
    const observed = recordingEngine(() => committedResult());
    await withListener(observed.engine, async (origin) => {
      const response = await fetch(`${origin}/v1/execute`, {
        method: 'POST',
        headers: {
          ...runtimeHeaders(),
          'content-type': 'application/json',
        },
        body: ' '.repeat(MAX_REQUEST_BYTES + 1),
      });
      expect(response.status).toBe(413);
      await expect(response.json()).resolves.toMatchObject({
        code: 'REQUEST_TOO_LARGE',
      });
    });
    expect(observed.requests).toEqual([]);
  });

  it('propagates a client disconnect into the engine AbortSignal', async () => {
    let started = false;
    const observed = recordingEngine(async (_request, options) => {
      started = true;
      await new Promise<void>((resolve) => {
        if (options?.signal?.aborted === true) {
          resolve();
          return;
        }
        options?.signal?.addEventListener('abort', () => resolve(), {
          once: true,
        });
      });
      return {
        status: 'cancelled',
        executionId: 'listener-cancelled',
        error: {
          code: 'CANCELLED',
          message: 'client disconnected',
          stage: 'cancelled',
          retryable: false,
        },
      };
    });

    await withListener(observed.engine, async (origin) => {
      const controller = new AbortController();
      const pending = fetch(`${origin}/v1/execute`, {
        method: 'POST',
        headers: {
          ...runtimeHeaders(),
          'content-type': 'application/json',
        },
        body: JSON.stringify(fixtureRequest()),
        signal: controller.signal,
      });
      await waitFor(() => started);
      controller.abort();
      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
      await waitFor(() => observed.signals[0]?.aborted === true);
    });

    expect(observed.requests).toHaveLength(1);
    expect(observed.signals[0]?.aborted).toBe(true);
  });
});

describe('AAL runtime service configuration', () => {
  it('parses only an explicit durable/provider service composition', () => {
    const config = readAcmeRuntimeServiceConfig(fullServiceEnv());
    expect(config).toMatchObject({
      hostname: '127.0.0.1',
      port: 8787,
      openAiModel: 'fixture-model-wire-id',
      modelSelection: {
        profile: 'listener-fixture-profile',
        providerHint: 'fixture-provider',
        modelHint: 'fixture-model',
      },
    });
  });

  it('fails before socket composition when required service choices are absent or unsafe', () => {
    const cases: NodeJS.ProcessEnv[] = [
      {},
      { ...fullServiceEnv(), ACME_RUNTIME_REPOSITORY: 'memory' },
      { ...fullServiceEnv(), ACME_RUNTIME_MODEL_PROVIDER: 'mock' },
      { ...fullServiceEnv(), ACME_RUNTIME_LISTEN_PORT: '0' },
      { ...fullServiceEnv(), ACME_RUNTIME_BEARER_TOKEN: 'too-short' },
      { ...fullServiceEnv(), OPENAI_API_KEY: '' },
      {
        ...fullServiceEnv(),
        ACME_POSTGRES_URL: '',
        ACME_POSTGRES_HOST: '',
      },
    ];
    for (const env of cases) {
      expect(() => readAcmeRuntimeServiceConfig(env)).toThrow();
    }
  });
});
