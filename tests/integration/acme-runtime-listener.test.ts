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
} from '../../apps/cli/src/acme-runtime-host.js';
import { createAcmeRuntimeListener } from '../../apps/cli/src/acme-runtime-listener.js';
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

function fixtureRequest(): AcmeRuntimeRequest {
  return {
    protocolVersion: ACME_RUNTIME_PROTOCOL_VERSION,
    requestKey: 'listener-request-1',
    correlationId: 'listener-correlation-1',
    engine: {
      namespace: 'neutral',
      task: 'summarize',
      entityId: 'engine-entity-listener-1',
      expectedRevision: 2,
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
    input: { title: 'Loopback fixture' },
  };
}

function runtimeHeaders(authorized = true): Record<string, string> {
  return {
    'x-test-runtime-auth': authorized ? 'allow' : 'deny',
    'x-acme-runtime-protocol': ACME_RUNTIME_PROTOCOL_VERSION,
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
    descriptor,
    authorize: (request) =>
      request.headers.get('x-test-runtime-auth') === 'allow',
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

describe('canonical ACME runtime Node HTTP listener', () => {
  it('round-trips the injected compatibility descriptor over loopback HTTP', async () => {
    const observed = recordingEngine(() => committedResult());
    await withListener(observed.engine, async (origin) => {
      const response = await fetch(`${origin}/v1/compatibility`, {
        headers: runtimeHeaders(),
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(descriptor);
    });
    expect(observed.requests).toEqual([]);
  });

  it('round-trips execute through the Fetch host without reinterpretation', async () => {
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
        protocolVersion: ACME_RUNTIME_PROTOCOL_VERSION,
        requestKey: request.requestKey,
        status: 'committed',
        executionId: 'listener-execution-1',
        replayed: false,
        revision: 3,
        documentKeys: ['listener-document-1'],
        eventIds: ['listener-event-1'],
      });
    });
    expect(observed.requests).toHaveLength(1);
    expect(observed.requests[0]).toMatchObject({
      requestKey: request.requestKey,
      namespace: request.engine.namespace,
      task: request.engine.task,
      entityId: request.engine.entityId,
      expectedRevision: request.engine.expectedRevision,
      model: request.engine.model,
      policy: request.engine.policy,
    });
  });

  it('keeps authorization host-owned and refuses before engine invocation', async () => {
    const observed = recordingEngine(() => committedResult());
    await withListener(observed.engine, async (origin) => {
      const response = await fetch(`${origin}/v1/execute`, {
        method: 'POST',
        headers: {
          ...runtimeHeaders(false),
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

  it('preserves the Fetch host 1 MiB request limit over real HTTP', async () => {
    const observed = recordingEngine(() => committedResult());
    await withListener(observed.engine, async (origin) => {
      const response = await fetch(`${origin}/v1/execute`, {
        method: 'POST',
        headers: {
          ...runtimeHeaders(),
          'content-type': 'application/json',
        },
        body: ' '.repeat(ACME_RUNTIME_MAX_REQUEST_BYTES + 1),
      });
      expect(response.status).toBe(413);
      await expect(response.json()).resolves.toMatchObject({
        code: 'REQUEST_BODY_TOO_LARGE',
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
