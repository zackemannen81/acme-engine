import type { JsonValue } from '@acme/core';
import { describe, expect, it } from 'vitest';

import { MCP_PROTOCOL_VERSION } from '../src/server.js';
import type { ReadAllowList } from '../src/read-allow-list.js';
import {
  callTool,
  createHarness,
  ENTITY_ID,
  EXECUTION_ID,
  executeArgs,
  handshake,
  NAMESPACE,
  resultOf,
  structured,
  TASK,
} from './harness.js';

const FULL_GRANT: ReadAllowList = {
  grants: [
    {
      namespace: NAMESPACE,
      entityId: ENTITY_ID,
      state: true,
      memoryKinds: ['narrative.character-fact', 'narrative.world-rule'],
      memoryValues: true,
    },
  ],
};

describe('MCP server over stdio', () => {
  it('negotiates a session and lists engine-backed tools', async () => {
    const { client } = await createHarness(FULL_GRANT);
    try {
      const initialize = resultOf(await handshake(client));
      expect(initialize['protocolVersion']).toBe(MCP_PROTOCOL_VERSION);
      expect(initialize['serverInfo']).toEqual({
        name: 'acme-mcp-server',
        version: '0.0.0',
      });
      expect(initialize['capabilities']).toEqual({
        tools: { listChanged: false },
      });

      const listed = resultOf(await client.send('tools/list'));
      const tools = listed['tools'] as readonly Record<string, JsonValue>[];
      expect(tools.map((tool) => tool['name'])).toEqual([
        'acme_execute_task',
        'acme_read_entity',
        'acme_verify_execution',
      ]);
      for (const tool of tools) {
        expect(typeof tool['description']).toBe('string');
        expect((tool['inputSchema'] as Record<string, JsonValue>)['type']).toBe(
          'object',
        );
      }
    } finally {
      await client.close();
    }
  });

  it('refuses tools before the initialized notification arrives', async () => {
    const { client } = await createHarness(FULL_GRANT);
    try {
      await client.send('initialize', {
        protocolVersion: MCP_PROTOCOL_VERSION,
      });
      const early = (await client.send('tools/list')) as Record<
        string,
        JsonValue
      >;
      const error = early['error'] as Record<string, JsonValue>;
      expect(error['code']).toBe(-32603);
      expect(String(error['message'])).toContain('not initialized');
    } finally {
      await client.close();
    }
  });

  it('executes a real task through the ExecutionEngine and commits it', async () => {
    const { client, composition, gateway } = await createHarness(FULL_GRANT);
    try {
      await handshake(client);
      const response = await callTool(
        client,
        'acme_execute_task',
        executeArgs(),
      );
      const body = structured(response);
      expect(resultOf(response)['isError']).toBe(false);

      const result = body['result'] as Record<string, JsonValue>;
      expect(result['status']).toBe('committed');
      expect(result['executionId']).toBe(EXECUTION_ID);
      expect(result['revision']).toBe(1);
      expect(result['replayed']).toBe(false);
      expect((result['documentKeys'] as readonly string[]).length).toBe(1);

      // The deterministic gateway was really called, exactly once.
      expect(gateway.invocations()).toHaveLength(1);
      gateway.assertAllConsumed();

      // The engine really committed: the repository holds the execution,
      // a state snapshot at revision 1, and the promoted memory records.
      const evidence = await composition.repository.snapshot();
      expect(
        evidence.executions.map((entry) => [entry.executionId, entry.status]),
      ).toEqual([[EXECUTION_ID, 'committed']]);
      expect(evidence.state.snapshots.map((entry) => entry.revision)).toEqual([
        1,
      ]);
      expect(
        evidence.memoryRecords.map((record) => record.kind).sort(),
      ).toEqual(['narrative.character-fact', 'narrative.world-rule']);
    } finally {
      await client.close();
    }
  });

  it('verifies the recorded execution without calling the model again', async () => {
    const { client, gateway } = await createHarness(FULL_GRANT);
    try {
      await handshake(client);
      await callTool(client, 'acme_execute_task', executeArgs());
      expect(gateway.invocations()).toHaveLength(1);

      const response = await callTool(client, 'acme_verify_execution', {
        executionId: EXECUTION_ID,
      });
      expect(resultOf(response)['isError']).toBe(false);
      const report = structured(response)['report'] as Record<
        string,
        JsonValue
      >;
      expect(report['status']).toBe('match');
      expect(report['mode']).toBe('verify');
      expect(report['executionId']).toBe(EXECUTION_ID);
      expect(report['recordedDigest']).toBe(report['replayDigest']);
      expect(report['differences']).toEqual([]);

      // Replay used a gateway that throws on any call. Still one invocation.
      expect(gateway.invocations()).toHaveLength(1);
    } finally {
      await client.close();
    }
  });

  it('reads committed state and ranked memory for a granted entity', async () => {
    const { client } = await createHarness(FULL_GRANT);
    try {
      await handshake(client);
      await callTool(client, 'acme_execute_task', executeArgs());

      const response = await callTool(client, 'acme_read_entity', {
        namespace: NAMESPACE,
        entityId: ENTITY_ID,
        task: TASK,
        expectedRevision: 1,
      });
      expect(resultOf(response)['isError']).toBe(false);
      const body = structured(response);

      const state = body['state'] as Record<string, JsonValue>;
      expect(state['revision']).toBe(1);
      expect(typeof state['valueHash']).toBe('string');

      const memories = body['memories'] as readonly Record<string, JsonValue>[];
      expect(memories.map((memory) => memory['kind']).sort()).toEqual([
        'narrative.character-fact',
        'narrative.world-rule',
      ]);
      for (const memory of memories) {
        expect(memory['status']).toBe('active');
        expect(memory['value']).toBeDefined();
        // Even under the widest grant this server writes, engine-internal
        // provenance never leaves the process.
        expect(memory['provenance']).toBeUndefined();
        expect(memory['memoryId']).toBeUndefined();
      }
    } finally {
      await client.close();
    }
  });

  it('reports a conflicted execution instead of failing the protocol', async () => {
    const { client } = await createHarness(FULL_GRANT);
    try {
      await handshake(client);
      await callTool(client, 'acme_execute_task', executeArgs());

      // Same entity, a fresh request key, and a revision the entity moved past.
      const response = await callTool(client, 'acme_execute_task', {
        ...(executeArgs() as Record<string, JsonValue>),
        requestKey: 'mcp-request-2',
        expectedRevision: 0,
      });
      const result = structured(response)['result'] as Record<
        string,
        JsonValue
      >;
      expect(result['status']).toBe('conflicted');
    } finally {
      await client.close();
    }
  });

  it('answers malformed and unknown traffic in JSON-RPC terms', async () => {
    const { client } = await createHarness(FULL_GRANT);
    try {
      await handshake(client);

      const parseError = (await client.sendRaw('{ not json')) as Record<
        string,
        JsonValue
      >;
      expect((parseError['error'] as Record<string, JsonValue>)['code']).toBe(
        -32700,
      );

      const badEnvelope = (await client.sendRaw(
        JSON.stringify({ jsonrpc: '1.0', id: 9, method: 'tools/list' }),
      )) as Record<string, JsonValue>;
      expect((badEnvelope['error'] as Record<string, JsonValue>)['code']).toBe(
        -32600,
      );
      expect(badEnvelope['id']).toBe(9);

      const unknownMethod = (await client.send('tools/nope')) as Record<
        string,
        JsonValue
      >;
      expect(
        (unknownMethod['error'] as Record<string, JsonValue>)['code'],
      ).toBe(-32601);

      const unknownTool = (await callTool(
        client,
        'acme_delete_world',
        {},
      )) as Record<string, JsonValue>;
      expect((unknownTool['error'] as Record<string, JsonValue>)['code']).toBe(
        -32601,
      );

      const badParams = (await callTool(client, 'acme_execute_task', {
        namespace: NAMESPACE,
        task: TASK,
        entityId: ENTITY_ID,
        expectedRevision: 0,
        input: {},
      })) as Record<string, JsonValue>;
      const paramsError = badParams['error'] as Record<string, JsonValue>;
      expect(paramsError['code']).toBe(-32602);
      expect(String(paramsError['message'])).toContain('requestKey');
    } finally {
      await client.close();
    }
  });
});
