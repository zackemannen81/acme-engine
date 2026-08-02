import {
  computeModelRequestHash,
  createContractRegistry,
  createExecutionEngine,
  createMemoryEngine,
  createModuleRegistry,
  createResponsePipeline,
  createStateEngine,
  deriveExecutionId,
  type ExecutionRequest,
  type IdGenerator,
} from '../../packages/core/src/index.js';
import { createInMemoryExecutionRepository } from '../../packages/adapter-memory/src/index.js';
import { createScriptedModelGateway } from '../../packages/adapter-model-mock/src/index.js';
import { createTestPayloadEncryptor } from '../../packages/testing/src/index.js';
import {
  buildExecutionView,
  buildMemoryDecisionsView,
  buildReplayView,
  buildStateView,
  isAvailable,
} from '../../apps/test-ui/src/index.js';
import { describe, expect, it } from 'vitest';

import {
  neutralContract,
  neutralInput,
  neutralModule,
  neutralNow,
  neutralResponse,
  neutralSelection,
} from '../fixtures/neutral-execution.js';

/**
 * The Domain Test UI read model over evidence the real engine wrote.
 *
 * The package's own suite uses handcrafted fixtures so a view test fails when
 * the view changes. This gate proves the same contracts hold for evidence the
 * `ExecutionEngine` and `ExecutionRepository` actually record, offline and
 * without a browser.
 */

const namespace = 'neutral';
const entityId = 'neutral-entity-1';

function createIds(): IdGenerator {
  const counts: Record<string, number> = {};
  return {
    next(kind) {
      if (kind === 'execution') {
        throw new Error('Execution IDs must be derived.');
      }
      counts[kind] = (counts[kind] ?? 0) + 1;
      return `${kind}-${String(counts[kind])}`;
    },
  };
}

async function committedRun(
  retention: 'hash-only' | 'encrypted-payload' = 'hash-only',
) {
  const request: ExecutionRequest = {
    requestKey: 'test-ui-request-1',
    namespace,
    task: 'observe',
    entityId,
    expectedRevision: 0,
    input: neutralInput,
    model: neutralSelection,
    policy: { retention },
  };
  const executionId = deriveExecutionId(request.namespace, request.requestKey);
  const ids = createIds();
  const repository = createInMemoryExecutionRepository({
    ids,
    ...(retention === 'encrypted-payload'
      ? { payloadEncryptor: createTestPayloadEncryptor() }
      : {}),
  });
  const engine = createExecutionEngine({
    clock: { now: () => neutralNow },
    ids,
    modules: createModuleRegistry([neutralModule]),
    contracts: createContractRegistry([neutralContract]),
    pipeline: createResponsePipeline(),
    gateway: createScriptedModelGateway({
      profiles: [
        {
          selection: neutralSelection,
          capabilities: {
            structuredOutput: true,
            tools: false,
            vision: false,
          },
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
    }),
    memory: createMemoryEngine({ ids }),
    state: createStateEngine(),
    repository,
  });

  const result = await engine.execute(request);
  expect(result.status).toBe('committed');

  const execution = await repository.get(executionId);
  const replayEvidence = await repository.loadReplayEvidence(executionId);
  const report = await engine.replayVerify(executionId);
  const evidence = repository.snapshot();
  if (execution === null || replayEvidence === null) {
    throw new Error('The committed execution must have recorded evidence.');
  }

  return { executionId, execution, replayEvidence, report, evidence };
}

describe('Domain Test UI read model over engine evidence', () => {
  it('renders a committed execution without inventing a verdict', async () => {
    const run = await committedRun();
    const view = buildExecutionView({
      execution: run.execution,
      attempts: run.evidence.attempts,
      modelCalls: run.evidence.modelCalls,
      replayEvidence: run.replayEvidence,
    });

    expect(view.header.executionId).toBe(run.executionId);
    expect(view.header.namespace).toBe(namespace);
    expect(view.terminal.committed).toBe(true);
    expect(view.terminal.revision).toBe(1);
    // Copied from the repository, not recomputed by the interface.
    expect(view.terminal.documentKeys).toStrictEqual(
      run.replayEvidence.preparedCommit.documents.map(
        (document) => document.key,
      ),
    );
    for (const stage of view.trustPipeline) {
      expect(stage.outcome).toBe('passed');
    }
    expect(view.responseValidation.availability).toBe('unavailable');
  });

  it('states that a hash-only run never stored the model payload', async () => {
    const run = await committedRun();
    const view = buildExecutionView(
      {
        execution: run.execution,
        attempts: run.evidence.attempts,
        modelCalls: run.evidence.modelCalls,
        replayEvidence: run.replayEvidence,
      },
      { revealContent: true },
    );

    expect(view.retention).toBe('hash-only');
    expect(view.modelCalls).toHaveLength(1);
    expect(view.modelCalls[0]?.response).toStrictEqual({
      disclosure: 'not-retained',
      retention: 'hash-only',
    });
    expect(view.modelCalls[0]?.responseHash).toBe(
      run.evidence.modelCalls[0]?.responseHash,
    );
  });

  it('correlates the memory decisions the engine prepared', async () => {
    const run = await committedRun();
    const view = buildMemoryDecisionsView({
      executionId: run.executionId,
      preparedCommit: run.replayEvidence.preparedCommit,
    });

    if (!isAvailable(view.decisions)) {
      throw new Error('decisions should be available');
    }
    const prepared = run.replayEvidence.preparedCommit.memory;
    expect(
      view.decisions.decisions.map((entry) => entry.candidateKey),
    ).toStrictEqual(
      prepared.decisions.map((decision) => decision.candidateKey),
    );
    expect(view.decisions.mutationCount).toBe(prepared.mutations.length);
    expect(view.decisions.unattributedMutations).toStrictEqual([]);
    expect(
      view.decisions.decisions.flatMap((entry) =>
        entry.mutations.map((mutation) => mutation.memoryId),
      ),
    ).toStrictEqual(
      prepared.mutations.map((mutation) => mutation.record.memoryId),
    );
  });

  it('renders the committed state lineage', async () => {
    const run = await committedRun();
    const view = buildStateView({
      namespace,
      entityId,
      snapshots: run.evidence.state.snapshots,
      transitions: run.evidence.state.transitions,
    });

    if (!isAvailable(view.lineage)) {
      throw new Error('lineage should be available');
    }
    expect(view.lineage.headRevision).toBe(1);
    expect(view.lineage.revisions[0]?.continuity).toBe('linked');
    const transition = view.lineage.revisions[0]?.transition;
    expect(transition !== undefined && isAvailable(transition)).toBe(true);
  });

  it('copies the engine replay verdict and compares the recorded digest', async () => {
    const run = await committedRun('encrypted-payload');
    const view = buildReplayView({
      executionId: run.executionId,
      report: run.report,
      recordedOperationDigest:
        run.replayEvidence.preparedCommit.operationDigest,
    });

    if (!isAvailable(view.outcome)) {
      throw new Error('outcome should be available');
    }
    expect(view.outcome.status).toBe(run.report.status);
    expect(view.outcome.status).toBe('match');
    expect(view.outcome.digest.comparison).toBe('equal');
    expect(view.recordedOperationDigest).toBe(
      run.replayEvidence.preparedCommit.operationDigest,
    );
  });

  it('keeps the engine verdict unavailable distinct from no replay at all', async () => {
    // A `hash-only` run keeps no response, so the engine reports
    // `unavailable`. That is a verdict it produced, not a missing section.
    const run = await committedRun('hash-only');
    const verdict = buildReplayView({
      executionId: run.executionId,
      report: run.report,
      recordedOperationDigest:
        run.replayEvidence.preparedCommit.operationDigest,
    });
    const notRun = buildReplayView({ executionId: run.executionId });

    expect(run.report.status).toBe('unavailable');
    if (!isAvailable(verdict.outcome)) {
      throw new Error('the engine verdict should be available');
    }
    expect(verdict.outcome.status).toBe('unavailable');
    expect(verdict.outcome.digest.comparison).toBe('unavailable');
    expect(notRun.outcome).toStrictEqual({
      availability: 'unavailable',
      reason: 'REPLAY_NOT_RUN',
    });
  });
});
