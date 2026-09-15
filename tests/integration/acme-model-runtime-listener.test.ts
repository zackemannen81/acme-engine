import { createServer } from 'node:http';

import { describe, expect, it } from 'vitest';

import { createInMemoryModelExecutionRepository } from '../../packages/adapter-memory/src/index.js';
import { createOpenAiResponsesGateway } from '../../packages/adapter-model-openai/src/index.js';
import { createFetchTransport } from '../../packages/adapter-model-openai/src/transport-fetch.js';
import {
  createModelExecutionEngine,
  type ModelRequest,
} from '../../packages/core/src/index.js';
import { createAcmeModelRuntimeHost } from '../../apps/cli/src/acme-model-runtime-host.js';
import { createAcmeRuntimeListener } from '../../apps/cli/src/acme-runtime-listener.js';
import {
  ACME_MODEL_RUNTIME_ERROR_VERSION,
  ACME_MODEL_RUNTIME_HEADER,
  ACME_MODEL_RUNTIME_PROTOCOL_VERSION,
  type AcmeModelRuntimeDescriptor,
  type AcmeModelRuntimeRequest,
} from '../../apps/cli/src/acme-model-runtime-wire.js';

const now = '2026-09-15T12:00:00.000Z';
const descriptor: AcmeModelRuntimeDescriptor = Object.freeze({
  protocolVersion: ACME_MODEL_RUNTIME_PROTOCOL_VERSION,
  engineBuild: 'model-runtime-test',
  executePath: '/v1/model/execute',
});

const textRequest: ModelRequest = {
  messages: [{ role: 'user', content: [{ type: 'text', text: 'Say hello.' }] }],
  output: { mode: 'text' },
};

function runtimeHeaders(): Record<string, string> {
  return {
    authorization: 'allow',
    [ACME_MODEL_RUNTIME_HEADER]: ACME_MODEL_RUNTIME_PROTOCOL_VERSION,
  };
}

function executeBody(requestKey: string): AcmeModelRuntimeRequest {
  return {
    protocolVersion: ACME_MODEL_RUNTIME_PROTOCOL_VERSION,
    requestKey,
    model: {
      profile: 'loopback',
      providerHint: 'openai',
      modelHint: 'responses',
    },
    request: textRequest,
  };
}

async function readSse(
  response: Response,
): Promise<readonly Record<string, unknown>[]> {
  const text = await response.text();
  return text
    .split('\n\n')
    .map((block) => {
      const line = block
        .split('\n')
        .find((entry) => entry.startsWith('data: '));
      return line === undefined ? undefined : line.slice(6);
    })
    .filter((line): line is string => line !== undefined && line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function withFakeProvider<T>(
  handler: (signal: AbortSignal) => AsyncIterable<string> | string,
  run: (baseUrl: string, aborts: AbortSignal[]) => Promise<T>,
): Promise<T> {
  const aborts: AbortSignal[] = [];
  const server = createServer((request, response) => {
    const abort = new AbortController();
    request.once('aborted', () => abort.abort());
    request.once('close', () => abort.abort());
    response.once('close', () => abort.abort());
    aborts.push(abort.signal);
    void (async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(Buffer.from(chunk));
      }
      void Buffer.concat(chunks).toString('utf8');
      const result = handler(abort.signal);
      response.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store',
      });
      if (typeof result === 'string') {
        response.end(result);
        return;
      }
      try {
        for await (const frame of result) {
          if (abort.signal.aborted) break;
          response.write(frame);
        }
      } finally {
        if (!response.writableEnded) response.end();
      }
    })();
  });
  await new Promise<void>((resolve) =>
    server.listen({ host: '127.0.0.1', port: 0 }, resolve),
  );
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('fake provider did not bind');
  }
  const baseUrl = `http://127.0.0.1:${String(address.port)}`;
  try {
    return await run(baseUrl, aborts);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

async function withModelRuntime<T>(
  baseUrl: string,
  run: (origin: string) => Promise<T>,
): Promise<T> {
  const engine = createModelExecutionEngine({
    clock: { now: () => now },
    ids: { next: (kind) => `${kind}-1` },
    repository: createInMemoryModelExecutionRepository(),
    gateway: createOpenAiResponsesGateway({
      transport: createFetchTransport(),
      now: () => now,
      baseUrl,
      profiles: [
        {
          selection: {
            profile: 'loopback',
            providerHint: 'openai',
            modelHint: 'responses',
          },
          model: 'gpt-fixture-1',
          capabilities: {
            structuredOutput: true,
            tools: true,
            vision: false,
          },
        },
      ],
    }),
  });
  const host = createAcmeModelRuntimeHost({
    engine,
    descriptor,
    authorize: (request) => request.headers.get('authorization') === 'allow',
  });
  const listener = createAcmeRuntimeListener({
    host,
    hostname: '127.0.0.1',
    port: 0,
    transportErrorProtocolVersion: ACME_MODEL_RUNTIME_ERROR_VERSION,
  });
  const address = await listener.listen();
  try {
    return await run(address.origin);
  } finally {
    await listener.close();
  }
}

const completedPayload = {
  type: 'response.completed',
  response: {
    id: 'resp_loopback_1',
    model: 'gpt-fixture-1',
    status: 'completed',
    output: [
      { type: 'message', content: [{ type: 'output_text', text: 'Hello' }] },
    ],
    usage: { input_tokens: 3, output_tokens: 1, total_tokens: 4 },
  },
};

describe('acme-model-runtime/1 loopback', () => {
  it('returns compatibility and streams a text execution through a local provider', async () => {
    const sse = [
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hel"}\n\n',
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"lo"}\n\n',
      `event: response.completed\ndata: ${JSON.stringify(completedPayload)}\n\n`,
    ].join('');
    await withFakeProvider(
      () => sse,
      async (baseUrl) => {
        await withModelRuntime(baseUrl, async (origin) => {
          const compatibility = await fetch(
            `${origin}/v1/model/compatibility`,
            {
              headers: runtimeHeaders(),
            },
          );
          expect(compatibility.status).toBe(200);
          await expect(compatibility.json()).resolves.toEqual(descriptor);

          const response = await fetch(`${origin}/v1/model/execute`, {
            method: 'POST',
            headers: {
              ...runtimeHeaders(),
              'content-type': 'application/json',
            },
            body: JSON.stringify(executeBody('loopback-text-1')),
          });
          expect(response.status).toBe(200);
          expect(response.headers.get('content-type')).toMatch(
            /text\/event-stream/u,
          );
          const events = await readSse(response);
          expect(events.map((event) => event.type)).toEqual([
            'content-delta',
            'content-delta',
            'completed',
          ]);
          const terminal = events.at(-1);
          expect(terminal?.type).toBe('completed');
          expect(terminal?.protocolVersion).toBe(
            ACME_MODEL_RUNTIME_PROTOCOL_VERSION,
          );
          expect(
            (terminal?.result as { replayed?: boolean } | undefined)?.replayed,
          ).toBe(false);
        });
      },
    );
  });

  it('propagates client disconnect as cancellation to the local provider', async () => {
    await withFakeProvider(
      async function* (signal) {
        yield 'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hel"}\n\n';
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 5_000);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve();
          });
        });
      },
      async (baseUrl, aborts) => {
        await withModelRuntime(baseUrl, async (origin) => {
          const controller = new AbortController();
          const response = await fetch(`${origin}/v1/model/execute`, {
            method: 'POST',
            headers: {
              ...runtimeHeaders(),
              'content-type': 'application/json',
            },
            body: JSON.stringify(executeBody('loopback-cancel-1')),
            signal: controller.signal,
          });
          expect(response.status).toBe(200);
          const reader = response.body?.getReader();
          expect(reader).toBeDefined();
          await reader?.read();
          controller.abort();
          await new Promise((resolve) => setTimeout(resolve, 200));
          expect(aborts.some((signal) => signal.aborted)).toBe(true);
        });
      },
    );
  });
});
