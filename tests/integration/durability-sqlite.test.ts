import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createSqliteExecutionRepository,
  openDatabase,
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
  type ModelGateway,
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
import { faultingDatabase } from '../fixtures/faulting-database.js';

type OpenDatabase = ReturnType<typeof openDatabase>;

const payloadEncryptor = createTestPayloadEncryptor();
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
  const root = mkdtempSync(join(tmpdir(), 'acme-sqlite-durability-'));
  roots.push(root);
  return join(root, 'acme.sqlite');
}

function open(location: string): OpenDatabase {
  const database = openDatabase({ location, appliedAt });
  opened.push(database);
  return database;
}

function request(requestKey: string): ExecutionRequest {
  return {
    requestKey,
    namespace: 'neutral',
    task: 'observe',
    entityId: 'neutral-entity-1',
    expectedRevision: 0,
    input: neutralInput,
    model: neutralSelection,
    policy: { retention: 'encrypted-payload' },
  };
}

function createIds(prefix = ''): IdGenerator {
  const counts = { call: 0, document: 0, event: 0, memory: 0 };
  return {
    next(kind) {
      if (kind === 'execution') {
        throw new Error('Execution IDs must be derived.');
      }
      counts[kind] += 1;
      return `${prefix}${kind}-${counts[kind]}`;
    },
  };
}

function createGateway(requests: readonly ExecutionRequest[]) {
  return createScriptedModelGateway({
    profiles: [
      {
        selection: neutralSelection,
        capabilities: { structuredOutput: true, tools: false, vision: false },
      },
    ],
    calls: requests.map((scripted) => {
      const executionId = deriveExecutionId(
        scripted.namespace,
        scripted.requestKey,
      );
      return {
        executionId,
        callKey: 'model:0',
        selection: neutralSelection,
        expectedRequestHash: computeModelRequestHash(
          neutralContract.buildRequest(neutralInput, {
            executionId,
            now: neutralNow,
          }),
        ),
        outcome: { kind: 'response' as const, response: neutralResponse },
      };
    }),
  });
}

function createEngine(
  repository: ExecutionRepository,
  gateway: ModelGateway,
  prefix = '',
) {
  const ids = createIds(prefix);
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

function repositoryOver(database: OpenDatabase) {
  return createSqliteExecutionRepository({
    database,
    ids: createIds(),
    payloadEncryptor,
  });
}

describe('SQLite durability under fault and contention', () => {
  it('rolls a faulted commit back completely across a real reopen', async () => {
    const location = databaseLocation();
    const faulted = request('neutral-durability-fault');
    const gateway = createGateway([faulted]);
    // The commit record is written after documents, memory candidates, the
    // state snapshot, the transition and the state-head upsert, so the fault
    // lands with the maximum amount of work already staged.
    const database = faultingDatabase(open(location), {
      whenSqlIncludes: 'INSERT INTO execution_commits',
    });

    const result = await createEngine(
      repositoryOver(database),
      gateway,
    ).execute(faulted);
    // A driver-level failure carries no ACME classification, so it lands as a
    // non-retryable INTERNAL error. See
    // `docs/backlog/driver-error-classification.md`.
    expect(result).toMatchObject({
      status: 'failed',
      error: { code: 'INTERNAL', retryable: false },
    });
    expect(gateway.invocations()).toHaveLength(1);

    // Simulate a process restart: drop every connection and reopen the file.
    opened.pop()?.close();
    const reopened = repositoryOver(open(location));
    const evidence = reopened.snapshot();
    expect(evidence).toMatchObject({
      executions: [{ status: 'failed' }],
      documents: [],
      memoryRecords: [],
      memoryCandidates: [],
      state: { snapshots: [], transitions: [] },
      events: [],
      outbox: [],
    });
    // The model call survives, because it was recorded outside the commit.
    expect(evidence.modelCalls).toMatchObject([
      { callKey: 'model:0', status: 'succeeded' },
    ]);
    await expect(
      reopened.loadReplayEvidence(
        deriveExecutionId(faulted.namespace, faulted.requestKey),
      ),
    ).resolves.toBeNull();

    // The rolled-back database is still usable for a different execution.
    const next = request('neutral-durability-after-fault');
    await expect(
      createEngine(reopened, createGateway([next]), 'after-').execute(next),
    ).resolves.toMatchObject({ status: 'committed', revision: 1 });
  });

  it('lets exactly one of two writers commit the same revision', async () => {
    const location = databaseLocation();
    const first = request('neutral-writer-1');
    const second = request('neutral-writer-2');
    const scripted = createGateway([first, second]);
    const repository = repositoryOver(open(location));

    const winner = createEngine(repository, scripted, 'winner-');
    const raced = vi.fn();
    // The loser loads its context at revision 0, then the winner commits
    // revision 1 while the loser is still mid-execution. The loser's own
    // commit must then lose the compare-and-swap.
    const interleaving: ModelGateway = {
      capabilities: (selection) => scripted.capabilities(selection),
      async generate(modelRequest, context) {
        raced(await winner.execute(first));
        return scripted.generate(modelRequest, context);
      },
    };
    const loser = createEngine(repository, interleaving, 'loser-');

    const outcome = await loser.execute(second);
    expect(raced).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'committed', revision: 1 }),
    );
    expect(outcome).toMatchObject({
      status: 'conflicted',
      error: { code: 'CONFLICT_STATE_REVISION' },
    });
    expect(scripted.invocations()).toHaveLength(2);

    // Exactly one commit reached the store, and the loser left nothing.
    const evidence = repository.snapshot();
    expect(evidence.state.snapshots).toHaveLength(1);
    expect(evidence.state.transitions).toHaveLength(1);
    expect(evidence.state.snapshots[0]).toMatchObject({ revision: 1 });
    expect(evidence.documents).toHaveLength(1);
    expect(
      evidence.executions.map((execution) => execution.status).sort(),
    ).toEqual(['committed', 'conflicted']);
  });
});
