import { createInterface } from 'node:readline';
import { PassThrough, type Readable, type Writable } from 'node:stream';

import {
  computeModelRequestHash,
  createAes256GcmPayloadEncryptor,
  deriveExecutionId,
  type IdGenerator,
  type JsonValue,
} from '@acme/core';
import {
  createScriptedModelGateway,
  type ScriptedModelGateway,
} from '@acme/adapter-model-mock';
import {
  narrativeObserveDocumentContract,
  narrativeObserveDocumentTask,
} from '@acme/module-narrative';

import { createComposition, type Composition } from '../src/composition.js';
import type { ReadAllowList } from '../src/read-allow-list.js';
import { createMcpServer } from '../src/server.js';
import { serveStdio } from '../src/stdio.js';

export const NOW = '2026-08-13T09:00:00.000Z';
export const NAMESPACE = 'narrative';
export const TASK = 'observe-document';
export const ENTITY_ID = 'mcp-story-1';
export const REQUEST_KEY = 'mcp-request-1';
export const SELECTION = { profile: 'offline-json' } as const;

export const EXECUTION_ID = deriveExecutionId(NAMESPACE, REQUEST_KEY);

export const DOCUMENT_INPUT = {
  documentKey: 'mcp-chapter-1',
  title: 'The Signal Tower',
  text: 'Mira tells Ion that her eyes are green. Light never crosses the ridge at night.',
};

/**
 * One character fact and one world rule, so a read grant that names a single
 * memory kind has something to exclude.
 */
export const MODEL_OUTPUT = {
  observations: [
    {
      type: 'character-fact',
      subject: 'Mira',
      predicate: 'eye color',
      value: 'green',
      confidence: 0.9,
    },
    {
      type: 'world-rule',
      rule: 'Light never crosses the ridge at night.',
      confidence: 0.8,
    },
  ],
  scene: {
    location: 'Signal Tower',
    time: 'Night',
    summary: 'Mira states her eye color and the ridge rule to Ion.',
  },
};

export function createIds(): IdGenerator {
  const counts: Record<string, number> = {};
  return {
    next(kind) {
      counts[kind] = (counts[kind] ?? 0) + 1;
      return `${kind}-mcp-${String(counts[kind]).padStart(3, '0')}`;
    },
  };
}

/**
 * The narrative contract input names no entity, so one document projected onto
 * an empty read context hashes the same whichever entity receives it. That is
 * what lets one script serve several request keys, and it is also the first
 * hint that this engine has no notion of who or what an execution is for.
 */
export async function expectedRequestHash(
  document: Parameters<
    typeof narrativeObserveDocumentTask.project
  >[0] = DOCUMENT_INPUT,
): Promise<string> {
  const contractInput = await narrativeObserveDocumentTask.project(document, {
    executionId: EXECUTION_ID,
    entityId: ENTITY_ID,
    now: NOW,
    state: null,
    memories: [],
    documents: [],
  });
  return computeModelRequestHash(
    narrativeObserveDocumentContract.buildRequest(contractInput, {
      executionId: EXECUTION_ID,
      now: NOW,
    }),
  );
}

export async function createGateway(
  requestKeys: readonly string[] = [REQUEST_KEY],
): Promise<ScriptedModelGateway> {
  const hash = await expectedRequestHash();
  return createScriptedModelGateway({
    profiles: [
      {
        selection: SELECTION,
        capabilities: { structuredOutput: true, tools: false, vision: false },
      },
    ],
    calls: requestKeys.map((requestKey) => ({
      executionId: deriveExecutionId(NAMESPACE, requestKey),
      callKey: 'model:0',
      selection: SELECTION,
      expectedRequestHash: hash,
      outcome: {
        kind: 'response' as const,
        response: {
          provider: 'fixture',
          model: 'fixture-json-1',
          receivedAt: NOW,
          finishReason: 'stop' as const,
          text: JSON.stringify(MODEL_OUTPUT),
          usage: {},
          metadata: {},
        },
      },
    })),
  });
}

export interface JsonRpcClient {
  /** Writes a request and reads the very next line the server emits. */
  send(method: string, params?: JsonValue, id?: number): Promise<JsonValue>;
  /** Writes a notification. The server answers nothing. */
  notify(method: string, params?: JsonValue): void;
  /** Writes a raw line without any framing help, for malformed-input tests. */
  sendRaw(line: string): Promise<JsonValue>;
  close(): Promise<void>;
}

export interface Harness {
  readonly client: JsonRpcClient;
  readonly composition: Composition;
  readonly gateway: ScriptedModelGateway;
}

/**
 * A JSON-RPC client over any newline-delimited pair of streams. The in-process
 * harness and the spawned-binary test drive the same client, so a difference in
 * behaviour between them is a difference in the server, not in the test.
 */
export function createClient(
  input: Writable,
  output: Readable,
  finished: Promise<unknown>,
): JsonRpcClient {
  const lines = createInterface({ input: output, crlfDelay: Infinity });
  const iterator = lines[Symbol.asyncIterator]();
  let nextId = 1;

  async function readLine(): Promise<JsonValue> {
    const next = await iterator.next();
    if (next.done === true) {
      throw new Error('The server closed before answering.');
    }
    return JSON.parse(next.value) as JsonValue;
  }

  return {
    async send(method, params, id) {
      const requestId = id ?? nextId++;
      input.write(
        `${JSON.stringify({
          jsonrpc: '2.0',
          id: requestId,
          method,
          ...(params === undefined ? {} : { params }),
        })}\n`,
      );
      return readLine();
    },
    notify(method, params) {
      input.write(
        `${JSON.stringify({
          jsonrpc: '2.0',
          method,
          ...(params === undefined ? {} : { params }),
        })}\n`,
      );
    },
    async sendRaw(line) {
      input.write(`${line}\n`);
      return readLine();
    },
    async close() {
      input.end();
      await finished;
    },
  };
}

export interface HarnessOptions {
  readonly retention?: 'none' | 'hash-only' | 'encrypted-payload';
  readonly requestKeys?: readonly string[];
}

export async function createHarness(
  readAllowList: ReadAllowList,
  options: HarnessOptions = {},
): Promise<Harness> {
  const composition = createComposition({
    clock: { now: () => NOW },
    ids: createIds(),
    payloadEncryptor: createAes256GcmPayloadEncryptor({
      key: new Uint8Array(32).fill(0xac),
      keyId: 'mcp-test-payload-key',
    }),
  });
  const gateway = await createGateway(options.requestKeys ?? [REQUEST_KEY]);
  const server = createMcpServer({
    composition,
    gateway,
    modelSelection: SELECTION,
    retention: options.retention ?? 'encrypted-payload',
    readAllowList,
  });

  const input = new PassThrough();
  const output = new PassThrough();
  const served = serveStdio({ input, output, server });
  return { client: createClient(input, output, served), composition, gateway };
}

/** Completes the MCP handshake over the wire. */
export async function handshake(client: JsonRpcClient): Promise<JsonValue> {
  const response = await client.send('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'harness', version: '0.0.0' },
  });
  client.notify('notifications/initialized');
  return response;
}

export function callTool(
  client: JsonRpcClient,
  name: string,
  args: JsonValue,
): Promise<JsonValue> {
  return client.send('tools/call', { name, arguments: args });
}

export function executeArgsFor(
  entityId: string,
  requestKey: string,
  expectedRevision = 0,
): JsonValue {
  return {
    namespace: NAMESPACE,
    task: TASK,
    entityId,
    requestKey,
    expectedRevision,
    input: DOCUMENT_INPUT,
  };
}

export function executeArgs(): JsonValue {
  return executeArgsFor(ENTITY_ID, REQUEST_KEY);
}

/** 32 raw bytes, base64, matching the in-process harness encryptor. */
export const PAYLOAD_KEY_BASE64 = Buffer.from(
  new Uint8Array(32).fill(0xac),
).toString('base64');

export function resultOf(response: JsonValue): Record<string, JsonValue> {
  const envelope = response as Record<string, JsonValue>;
  const result = envelope['result'];
  if (result === undefined || result === null || typeof result !== 'object') {
    throw new Error(
      `Expected a JSON-RPC result, received: ${JSON.stringify(response)}`,
    );
  }
  return result as Record<string, JsonValue>;
}

export function structured(response: JsonValue): Record<string, JsonValue> {
  return resultOf(response)['structuredContent'] as Record<string, JsonValue>;
}
