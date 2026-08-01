import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createSqliteExecutionRepository,
  openDatabase,
  type SqliteExecutionRepository,
} from '../../packages/adapter-sqlite/src/index.js';
import { createScriptedModelGateway } from '../../packages/adapter-model-mock/src/index.js';
import {
  computeModelRequestHash,
  createContractRegistry,
  createExecutionEngine,
  createMemoryEngine,
  createModuleRegistry,
  createResponsePipeline,
  createStateEngine,
  deriveExecutionId,
  type ExecutionRepository,
  type ExecutionRequest,
  type IdGenerator,
} from '../../packages/core/src/index.js';
import { createTestPayloadEncryptor } from '../../packages/testing/src/index.js';

import {
  neutralContract,
  neutralInput,
  neutralModule,
  neutralNow,
  neutralResponse,
  neutralSelection,
} from '../fixtures/neutral-execution.js';

const payloadEncryptor = createTestPayloadEncryptor();

type OpenDatabase = ReturnType<typeof openDatabase>;

const appliedAt = '2026-07-31T00:00:00.000Z';
const roots: string[] = [];
const opened: OpenDatabase[] = [];

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close();
  }
  while (roots.length > 0) {
    rmSync(roots.pop() ?? '', { recursive: true, force: true });
  }
});

function databaseLocation(): string {
  const root = mkdtempSync(join(tmpdir(), 'acme-sqlite-integration-'));
  roots.push(root);
  return join(root, 'acme.sqlite');
}

function open(location: string): OpenDatabase {
  const database = openDatabase({ location, appliedAt });
  opened.push(database);
  return database;
}

const executionRequest: ExecutionRequest = {
  requestKey: 'neutral-durable-1',
  namespace: 'neutral',
  task: 'observe',
  entityId: 'neutral-entity-1',
  expectedRevision: 0,
  input: neutralInput,
  model: neutralSelection,
  policy: { retention: 'encrypted-payload' },
};

const executionId = deriveExecutionId(
  executionRequest.namespace,
  executionRequest.requestKey,
);

function createIds() {
  const counts = { call: 0, document: 0, event: 0, memory: 0 };
  const next = vi.fn((kind: Parameters<IdGenerator['next']>[0]) => {
    if (kind === 'execution') {
      throw new Error('Execution IDs must be derived.');
    }
    counts[kind] += 1;
    return `${kind}-${counts[kind]}`;
  });
  return { ids: { next } satisfies IdGenerator, next };
}

function createGateway() {
  return createScriptedModelGateway({
    profiles: [
      {
        selection: neutralSelection,
        capabilities: { structuredOutput: true, tools: false, vision: false },
      },
    ],
    calls: [
      {
        executionId,
        callKey: 'model:0',
        selection: neutralSelection,
        expectedRequestHash: computeModelRequestHash(
          neutralContract.buildRequest(neutralInput, {
            executionId,
            now: neutralNow,
          }),
        ),
        outcome: { kind: 'response', response: neutralResponse },
      },
    ],
  });
}

function createEngine(
  repository: ExecutionRepository,
  ids: IdGenerator,
  gateway: ReturnType<typeof createGateway>,
) {
  return createExecutionEngine({
    clock: { now: () => neutralNow },
    ids,
    modules: createModuleRegistry([neutralModule]),
    contracts: createContractRegistry([neutralContract]),
    pipeline: createResponsePipeline(),
    gateway,
    memory: createMemoryEngine({ ids }),
    state: createStateEngine(),
    repository,
  });
}

function reopen(location: string): SqliteExecutionRepository {
  return createSqliteExecutionRepository({
    database: open(location),
    ids: {
      next() {
        throw new Error('Recovery must not allocate new IDs.');
      },
    },
    payloadEncryptor,
  });
}

describe('ExecutionEngine durable SQLite integration', () => {
  it('recovers a committed execution from a reopened database without new model calls', async () => {
    const location = databaseLocation();
    const first = createIds();
    const gateway = createGateway();
    const repository = createSqliteExecutionRepository({
      database: open(location),
      ids: first.ids,
      payloadEncryptor,
    });

    const committed = await createEngine(
      repository,
      first.ids,
      gateway,
    ).execute(executionRequest);
    expect(committed).toEqual({
      status: 'committed',
      executionId,
      replayed: false,
      revision: 1,
      documentKeys: ['neutral-document-1'],
      eventIds: [],
    });
    expect(gateway.invocations()).toHaveLength(1);

    const evidenceBeforeClose =
      await repository.loadReplayEvidence(executionId);
    const snapshotBeforeClose = repository.snapshot();
    expect(evidenceBeforeClose).not.toBeNull();

    // Simulate a process restart: drop every connection and reopen the file.
    const closed = opened.pop();
    closed?.close();

    const recovered = reopen(location);
    expect(await recovered.get(executionId)).toEqual(
      snapshotBeforeClose.executions[0],
    );
    expect(await recovered.loadReplayEvidence(executionId)).toEqual(
      evidenceBeforeClose,
    );
    expect(recovered.snapshot()).toEqual(snapshotBeforeClose);

    const forbiddenIds: IdGenerator = {
      next() {
        throw new Error('Recovery must not allocate new IDs.');
      },
    };
    const repeated = await createEngine(
      recovered,
      forbiddenIds,
      gateway,
    ).execute(executionRequest);
    expect(repeated).toEqual({ ...committed, replayed: true });
    expect(gateway.invocations()).toHaveLength(1);
    expect(recovered.snapshot()).toEqual(snapshotBeforeClose);
  });

  it('replay-verifies recovered evidence without a gateway, clock, or ID generator', async () => {
    const location = databaseLocation();
    const original = createIds();
    const gateway = createGateway();
    const repository = createSqliteExecutionRepository({
      database: open(location),
      ids: original.ids,
      payloadEncryptor,
    });
    await createEngine(repository, original.ids, gateway).execute(
      executionRequest,
    );
    const snapshotBeforeClose = repository.snapshot();
    opened.pop()?.close();

    const recovered = reopen(location);
    const forbiddenNext = vi.fn((): string => {
      throw new Error('Replay invoked the external ID generator.');
    });
    const forbiddenClock = vi.fn((): string => {
      throw new Error('Replay invoked the external clock.');
    });
    const forbiddenCapabilities = vi.fn(async () => {
      throw new Error('Replay invoked gateway capabilities.');
    });
    const forbiddenGenerate = vi.fn(async () => {
      throw new Error('Replay invoked gateway generation.');
    });
    const replayEngine = createExecutionEngine({
      clock: { now: forbiddenClock },
      ids: { next: forbiddenNext },
      modules: createModuleRegistry([neutralModule]),
      contracts: createContractRegistry([neutralContract]),
      pipeline: createResponsePipeline(),
      gateway: {
        capabilities: forbiddenCapabilities,
        generate: forbiddenGenerate,
      },
      memory: createMemoryEngine({ ids: { next: forbiddenNext } }),
      state: createStateEngine(),
      repository: recovered,
    });

    const replay = await replayEngine.replayVerify(executionId);
    expect(replay).toMatchObject({ status: 'match', differences: [] });
    expect(replay.recordedDigest).toBe(replay.replayDigest);
    expect(forbiddenNext).not.toHaveBeenCalled();
    expect(forbiddenClock).not.toHaveBeenCalled();
    expect(forbiddenCapabilities).not.toHaveBeenCalled();
    expect(forbiddenGenerate).not.toHaveBeenCalled();
    expect(gateway.invocations()).toHaveLength(1);
    expect(recovered.snapshot()).toEqual(snapshotBeforeClose);
  });

  it('produces the same durable evidence as the in-memory adapter', async () => {
    const location = databaseLocation();
    const ids = createIds();
    const repository = createSqliteExecutionRepository({
      database: open(location),
      ids: ids.ids,
      payloadEncryptor,
    });
    await createEngine(repository, ids.ids, createGateway()).execute(
      executionRequest,
    );
    const durable = repository.snapshot();

    const { createInMemoryExecutionRepository } =
      await import('../../packages/adapter-memory/src/index.js');
    const memoryIds = createIds();
    const inMemory = createInMemoryExecutionRepository({
      ids: memoryIds.ids,
      payloadEncryptor,
    });
    await createEngine(inMemory, memoryIds.ids, createGateway()).execute(
      executionRequest,
    );

    // Envelope ciphertext is non-deterministic (random IV). Compare the
    // retention shape, not the sealed bytes.
    const normalize = (evidence: typeof durable) => ({
      ...evidence,
      modelCalls: evidence.modelCalls.map((call) => ({
        modelCallId: call.modelCallId,
        executionId: call.executionId,
        callKey: call.callKey,
        attempt: call.attempt,
        purpose: call.purpose,
        selection: call.selection,
        requestHash: call.requestHash,
        startedAt: call.startedAt,
        status: call.status,
        responseHash: call.responseHash,
        completedAt: call.completedAt,
        sealed: call.protectedResponse !== undefined,
        hasCleartext: call.response !== undefined,
      })),
    });
    expect(normalize(durable)).toEqual(normalize(inMemory.snapshot()));
    expect(durable.modelCalls[0]?.response).toBeUndefined();
    expect(inMemory.snapshot().modelCalls[0]?.response).toBeUndefined();
    expect(durable.modelCalls[0]?.responseHash).toBe(
      inMemory.snapshot().modelCalls[0]?.responseHash,
    );
  });
});
