import {
  deriveExecutionId,
  type JsonValue,
  type MemoryRecord,
  type RankedMemory,
} from '@acme/core';
import { encodeOrigin } from '@acme/provenance-states';
import { describe, expect, it } from 'vitest';

import {
  discloseRead,
  type EntityReadGrant,
  type ReadAllowList,
} from '../src/read-allow-list.js';
import {
  callTool,
  createHarness,
  ENTITY_ID,
  EXECUTION_ID,
  executeArgs,
  executeArgsFor,
  handshake,
  NAMESPACE,
  REQUEST_KEY,
  resultOf,
  structured,
  TASK,
} from './harness.js';

/**
 * One entity is granted, and only its character facts. Everything else on this
 * server — the other entity, the other memory kind — is outside the grant, so
 * every reachable thing below is reachable *despite* the allow-list, not
 * because of it.
 */
const NARROW_GRANT: ReadAllowList = {
  grants: [
    {
      namespace: NAMESPACE,
      entityId: ENTITY_ID,
      state: true,
      memoryKinds: ['narrative.character-fact'],
      memoryValues: true,
    },
  ],
};

const UNGRANTED_ENTITY_ID = 'mcp-story-shadow';
const SHADOW_REQUEST_KEY = 'mcp-request-shadow';
const SHADOW_PROBE_KEY = 'mcp-request-shadow-probe';
const SHADOW_EXECUTION_ID = deriveExecutionId(NAMESPACE, SHADOW_REQUEST_KEY);

function harness() {
  return createHarness(NARROW_GRANT, {
    requestKeys: [REQUEST_KEY, SHADOW_REQUEST_KEY, SHADOW_PROBE_KEY],
  });
}

/**
 * ## What an MCP client can reach that it arguably should not
 *
 * The engine has no principal, no consumer identity and no disclosure decision.
 * `apps/mcp-server` therefore gates exactly one thing — the read tool — behind a
 * static allow-list a human wrote into the deployment. These tests are the
 * boundary of that: everything below is reachable by any MCP client that can
 * open a session, and none of it needs a grant.
 *
 * They are written as assertions of current behaviour, not as failures. Each one
 * should stop being true when the engine grows something to ask.
 */
describe('what an MCP client can reach without a read grant', () => {
  it('cannot read an ungranted entity, and is told so plainly', async () => {
    const { client } = await harness();
    try {
      await handshake(client);
      const response = await callTool(client, 'acme_read_entity', {
        namespace: NAMESPACE,
        entityId: UNGRANTED_ENTITY_ID,
        task: TASK,
        expectedRevision: 0,
      });
      expect(resultOf(response)['isError']).toBe(true);
      expect(structured(response)['code']).toBe('ACME_MCP_NO_READ_GRANT');
    } finally {
      await client.close();
    }
  });

  it('can still WRITE that same ungranted entity into existence', async () => {
    // The allow-list is a read allow-list. `acme_execute_task` consults nothing:
    // there is no grant, no namespace restriction and no entity restriction on
    // the write path, because a write has no disclosure question to answer and
    // the engine has no authorization question to answer either. A client that
    // is refused every read can create and mutate committed state and promoted
    // memory for any entity in any registered namespace.
    const { client, composition } = await harness();
    try {
      await handshake(client);
      const response = await callTool(
        client,
        'acme_execute_task',
        executeArgsFor(UNGRANTED_ENTITY_ID, SHADOW_REQUEST_KEY),
      );
      const result = structured(response)['result'] as Record<
        string,
        JsonValue
      >;
      expect(result['status']).toBe('committed');
      expect(result['revision']).toBe(1);

      const evidence = await composition.repository.snapshot();
      expect(
        evidence.memoryRecords.some(
          (record) => record.entityId === UNGRANTED_ENTITY_ID,
        ),
      ).toBe(true);
    } finally {
      await client.close();
    }
  });

  it('learns the revision of an unreadable entity from a write conflict', async () => {
    // `expectedRevision` is compare-and-swap, and a mismatch is reported with
    // the real current revision so a caller can retry. That makes the write path
    // an existence-and-revision oracle for exactly the entities the read path
    // refuses: send expectedRevision 0 and read `actualRevision` out of the
    // error. This is the sharpest reachability here, because the refusal above
    // looks like it protects the entity and does not.
    const { client } = await harness();
    try {
      await handshake(client);
      await callTool(
        client,
        'acme_execute_task',
        executeArgsFor(UNGRANTED_ENTITY_ID, SHADOW_REQUEST_KEY),
      );

      const probe = await callTool(
        client,
        'acme_execute_task',
        executeArgsFor(UNGRANTED_ENTITY_ID, SHADOW_PROBE_KEY),
      );
      const result = structured(probe)['result'] as Record<string, JsonValue>;
      expect(result['status']).toBe('conflicted');
      const error = result['error'] as Record<string, JsonValue>;
      expect(error['details']).toEqual({
        expectedRevision: 0,
        actualRevision: 1,
      });
    } finally {
      await client.close();
    }
  });

  it('probes whether any execution exists, for any entity, with no grant', async () => {
    // `acme_verify_execution` takes a bare execution id and consults no grant.
    // The id is `deriveExecutionId(namespace, requestKey)` — a pure function of
    // two strings the client chooses — so a client can compute candidate ids
    // offline and ask the server which ones exist. A hit also returns
    // `recordedDigest`: a stable digest over the committed operation for an
    // entity the same client cannot read one field of.
    const { client } = await harness();
    try {
      await handshake(client);
      await callTool(
        client,
        'acme_execute_task',
        executeArgsFor(UNGRANTED_ENTITY_ID, SHADOW_REQUEST_KEY),
      );

      const hit = structured(
        await callTool(client, 'acme_verify_execution', {
          executionId: SHADOW_EXECUTION_ID,
        }),
      )['report'] as Record<string, JsonValue>;
      expect(hit['status']).toBe('match');
      expect(typeof hit['recordedDigest']).toBe('string');

      const miss = structured(
        await callTool(client, 'acme_verify_execution', {
          executionId: deriveExecutionId(NAMESPACE, 'never-executed'),
        }),
      )['report'] as Record<string, JsonValue>;
      expect(miss['status']).toBe('unavailable');
      expect(miss['recordedDigest']).toBeUndefined();
      expect(
        (miss['differences'] as readonly Record<string, JsonValue>[])[0]?.[
          'code'
        ],
      ).toBe('REPLAY_EVIDENCE_UNAVAILABLE');
    } finally {
      await client.close();
    }
  });

  it('counts the memories the grant excluded, which is itself a disclosure', async () => {
    // `withheld.memoryRecords` exists so the missing disclosure decision is
    // legible instead of invisible. The cost is that the honesty report is a
    // cardinality channel: a client whose grant names one kind still learns
    // exactly how many records of every other kind this entity has, and watches
    // that number move.
    const { client } = await harness();
    try {
      await handshake(client);
      await callTool(client, 'acme_execute_task', executeArgs());

      const body = structured(
        await callTool(client, 'acme_read_entity', {
          namespace: NAMESPACE,
          entityId: ENTITY_ID,
          task: TASK,
          expectedRevision: 1,
        }),
      );
      const memories = body['memories'] as readonly Record<string, JsonValue>[];
      expect(memories.map((memory) => memory['kind'])).toEqual([
        'narrative.character-fact',
      ]);
      const withheld = body['withheld'] as Record<string, JsonValue>;
      // Exactly one world-rule was ranked and dropped, and the client is told.
      expect(withheld['memoryRecords']).toBe(1);
    } finally {
      await client.close();
    }
  });

  it('reads a granted entity in full, because a grant is all-or-nothing per field', async () => {
    // Under the widest grant a deployment can write, the value of every
    // disclosed record leaves the process whole. There is no per-field, per-
    // record or per-consumer narrowing available anywhere, because
    // `MemoryEngine.retrieve` has already returned complete `MemoryRecord`
    // values by the time this app can form an opinion.
    const { client } = await createHarness({
      grants: [
        {
          namespace: NAMESPACE,
          entityId: ENTITY_ID,
          state: true,
          memoryKinds: ['narrative.character-fact', 'narrative.world-rule'],
          memoryValues: true,
        },
      ],
    });
    try {
      await handshake(client);
      await callTool(client, 'acme_execute_task', executeArgs());
      const body = structured(
        await callTool(client, 'acme_read_entity', {
          namespace: NAMESPACE,
          entityId: ENTITY_ID,
          task: TASK,
          expectedRevision: 1,
        }),
      );
      const withheld = body['withheld'] as Record<string, JsonValue>;
      expect(withheld['memoryRecords']).toBe(0);
      expect(withheld['stateValue']).toBe(false);
      const memories = body['memories'] as readonly Record<string, JsonValue>[];
      for (const memory of memories) {
        expect(memory['value']).toBeDefined();
      }
      // The committed state value, whole, including every entity alias.
      const state = body['state'] as Record<string, JsonValue>;
      expect(state['value']).toBeDefined();
    } finally {
      await client.close();
    }
  });

  it('records nothing about who called: the execution evidence has no consumer', async () => {
    const { client, composition } = await harness();
    try {
      await handshake(client);
      const response = await callTool(
        client,
        'acme_execute_task',
        executeArgs(),
      );
      expect(structured(response)['recordedConsumer']).toBeNull();

      const evidence = await composition.repository.snapshot();
      const execution = evidence.executions.find(
        (entry) => entry.executionId === EXECUTION_ID,
      );
      expect(execution).toBeDefined();
      // Nothing in the committed record distinguishes this from the same task
      // run by the CLI, by a scenario, or by another MCP client entirely.
      // `ExecutionRequest` has no principal field and rejects unknown top-level
      // keys, so the server could not attach one even as an opaque string.
      expect(Object.keys(execution ?? {}).join(' ')).not.toMatch(
        /principal|consumer|caller|actor|subject|client/iu,
      );
    } finally {
      await client.close();
    }
  });
});

/**
 * `@acme/provenance-states` landed on main and can distinguish sourced /
 * asserted / derived / withheld / unknown without changing core. Exposing it
 * through MCP was cheap: it reads `ProvenanceRef.documentKeys`, which the read
 * path already has in hand.
 */
describe('a fact origin an MCP client can act on', () => {
  it('reports "never expressed" for real engine output, not a fake "unknown"', async () => {
    const { client } = await harness();
    try {
      await handshake(client);
      await callTool(client, 'acme_execute_task', executeArgs());
      const body = structured(
        await callTool(client, 'acme_read_entity', {
          namespace: NAMESPACE,
          entityId: ENTITY_ID,
          task: TASK,
          expectedRevision: 1,
        }),
      );
      const memories = body['memories'] as readonly Record<string, JsonValue>[];
      expect(memories.length).toBeGreaterThan(0);
      for (const memory of memories) {
        // No module writes structured origins yet: the narrative task records a
        // plain document key. `null` says the question was never answered, which
        // is a different and more useful claim than "unknown".
        expect(memory['origin']).toEqual({
          weakestState: null,
          states: [],
          unstructuredKeys: 1,
        });
      }
    } finally {
      await client.close();
    }
  });

  it('surfaces the weakest origin once a module does write them', () => {
    const grant: EntityReadGrant = {
      namespace: NAMESPACE,
      entityId: ENTITY_ID,
      state: false,
      memoryKinds: ['narrative.character-fact'],
      memoryValues: false,
    };
    const contract = { id: 'narrative.observe-document', version: '1.0.0' };
    const record: MemoryRecord = {
      memoryId: 'memory-1',
      namespace: NAMESPACE,
      entityId: ENTITY_ID,
      identityKey: 'character:mira:eye color',
      kind: 'narrative.character-fact',
      schemaVersion: 'narrative-memory/1',
      value: { value: 'green' },
      strength: 1,
      status: 'active',
      firstSeenAt: '2026-08-13T09:00:00.000Z',
      lastSeenAt: '2026-08-13T09:00:00.000Z',
      lastReinforcedAt: '2026-08-13T09:00:00.000Z',
      provenance: [
        {
          executionId: EXECUTION_ID,
          contract,
          documentKeys: [
            encodeOrigin({
              state: 'sourced',
              artifactVersionId: 'artifact-1',
              locator: 'p3:l7',
            }),
          ],
        },
        {
          executionId: EXECUTION_ID,
          contract,
          documentKeys: [
            encodeOrigin({ state: 'asserted', principalRef: 'person:mira' }),
            'legacy-chapter-1',
          ],
        },
      ],
      recordVersion: 1,
    };
    const ranked: RankedMemory = { record, score: 1, reasons: [] };

    const disclosed = discloseRead(grant, [ranked], null);
    expect(disclosed.memories[0]?.origin).toEqual({
      // A quote from an artifact plus somebody's word is only as good as
      // somebody's word.
      weakestState: 'asserted',
      states: ['asserted', 'sourced'],
      unstructuredKeys: 1,
    });
    // The origin travels; the locator inside it never does.
    expect(JSON.stringify(disclosed.memories[0])).not.toContain('artifact-1');
    expect(JSON.stringify(disclosed.memories[0])).not.toContain('p3:l7');
    expect(disclosed.memories[0]?.value).toBeUndefined();
  });
});
