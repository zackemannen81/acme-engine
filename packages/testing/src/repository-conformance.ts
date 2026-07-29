import {
  AcmeError,
  computeOperationDigest,
  type AcceptedExecution,
  type ExecutionRepository,
  type PreparedCommit,
  type PreparedCommitContent,
} from '@acme/core';
import { describe, expect, it } from 'vitest';

export interface ExecutionRepositoryConformanceOptions {
  readonly createRepository: () => ExecutionRepository;
}

const timestamp = '2026-07-29T12:00:00.000Z';

function accepted(
  executionId: string,
  requestKey = executionId,
  requestFingerprint = `fingerprint-${executionId}`,
): AcceptedExecution {
  return {
    executionId,
    request: {
      requestKey,
      namespace: 'conformance',
      task: 'observe',
      entityId: 'entity-1',
      expectedRevision: 0,
      input: { executionId },
      model: { profile: 'fixture' },
    },
    requestFingerprint,
    inputHash: `input-${executionId}`,
    contract: { id: 'conformance.observe', version: '1.0.0' },
    contractFingerprint: 'contract-fingerprint',
    effectivePolicy: {
      timeoutMs: 1_000,
      maxModelCalls: 1,
      maxRepairCalls: 0,
      maxRevisionCalls: 0,
      retention: 'hash-only',
    },
    createdAt: timestamp,
  };
}

function prepared(
  executionId: string,
  overrides: Partial<PreparedCommitContent> = {},
): PreparedCommit {
  const content: PreparedCommitContent = {
    executionId,
    expectedRevision: 0,
    documents: [],
    memoryCandidates: [],
    memory: { decisions: [], mutations: [] },
    state: null,
    evaluatorRuns: [],
    events: [],
    committedAt: timestamp,
    ...overrides,
  };
  return {
    ...content,
    operationDigest: computeOperationDigest(content),
  };
}

async function expectCode(
  operation: Promise<unknown>,
  code: AcmeError['data']['code'],
): Promise<void> {
  await expect(operation).rejects.toMatchObject({
    data: { code, stage: 'preparing-commit', retryable: false },
  });
}

export function executionRepositoryConformance(
  name: string,
  options: ExecutionRepositoryConformanceOptions,
): void {
  describe(`ExecutionRepository conformance: ${name}`, () => {
    it('accepts idempotently and reports request-fingerprint conflicts', async () => {
      const repository = options.createRepository();
      const first = accepted('execution-1', 'request-1');

      await expect(repository.accept(first)).resolves.toMatchObject({
        kind: 'created',
      });
      await expect(repository.accept(first)).resolves.toMatchObject({
        kind: 'existing',
      });
      await expect(
        repository.accept(
          accepted('execution-2', 'request-1', 'changed-fingerprint'),
        ),
      ).resolves.toEqual({
        kind: 'conflict',
        existingExecutionId: 'execution-1',
      });
      await expect(repository.get('execution-2')).resolves.toBeNull();
    });

    it('protects attempt and model-call evidence from divergent reuse', async () => {
      const repository = options.createRepository();
      await repository.accept(accepted('execution-ledger'));
      const attempt = {
        executionId: 'execution-ledger',
        attemptNumber: 1,
        stage: 'calling-model' as const,
        outcome: 'started' as const,
        occurredAt: timestamp,
      };
      await repository.appendAttempt(attempt);
      await repository.appendAttempt(attempt);
      await expectCode(
        repository.appendAttempt({ ...attempt, outcome: 'failed' }),
        'PERSISTENCE_CORRUPTION',
      );

      const reservation = {
        modelCallId: 'call-1',
        executionId: 'execution-ledger',
        callKey: 'primary',
        attempt: 1,
        purpose: 'primary' as const,
        selection: { profile: 'fixture' },
        requestHash: 'request-hash',
        startedAt: timestamp,
      };
      await repository.reserveModelCall(reservation);
      await repository.reserveModelCall(reservation);
      await expectCode(
        repository.reserveModelCall({
          ...reservation,
          modelCallId: 'call-2',
          requestHash: 'changed',
        }),
        'PERSISTENCE_CORRUPTION',
      );

      const completion = {
        modelCallId: 'call-1',
        response: {
          provider: 'fixture',
          model: 'fixture',
          receivedAt: timestamp,
          finishReason: 'stop' as const,
          text: '{}',
          usage: {},
          metadata: {},
        },
        responseHash: 'response-hash',
        completedAt: timestamp,
      };
      await repository.completeModelCall(completion);
      await repository.completeModelCall(completion);
      await expectCode(
        repository.completeModelCall({
          ...completion,
          responseHash: 'changed',
        }),
        'PERSISTENCE_CORRUPTION',
      );
    });

    it('loads a deterministic empty context and rejects stale revisions', async () => {
      const repository = options.createRepository();
      const query = {
        namespace: 'conformance',
        entityId: 'entity-1',
        expectedRevision: 0,
        memory: {
          namespace: 'conformance',
          entityId: 'entity-1',
          task: 'observe',
          limit: 10,
        },
      };
      await expect(repository.loadContext(query)).resolves.toEqual({
        state: null,
        memories: [],
        documents: [],
      });
      await expectCode(
        repository.loadContext({ ...query, expectedRevision: 1 }),
        'CONFLICT_STATE_REVISION',
      );
    });

    it('marks non-commit outcomes terminal and idempotent', async () => {
      const repository = options.createRepository();
      await repository.accept(accepted('execution-terminal'));
      const terminal = {
        executionId: 'execution-terminal',
        status: 'blocked' as const,
        error: {
          code: 'EVALUATION_BLOCKED' as const,
          message: 'blocked by fixture',
          stage: 'evaluating' as const,
          retryable: false,
        },
        terminalAt: timestamp,
      };
      await repository.markTerminal(terminal);
      await repository.markTerminal(terminal);
      await expect(repository.get('execution-terminal')).resolves.toMatchObject(
        {
          status: 'blocked',
          result: { status: 'blocked' },
        },
      );
      await expectCode(
        repository.commit(prepared('execution-terminal')),
        'PERSISTENCE_CORRUPTION',
      );
    });

    it('commits once, replays the same digest, and rejects divergence', async () => {
      const repository = options.createRepository();
      await repository.accept(accepted('execution-commit'));
      const commit = prepared('execution-commit');
      const first = await repository.commit(commit);
      const replay = await repository.commit(commit);
      expect(replay).toEqual(first);

      const divergent = prepared('execution-commit', {
        committedAt: '2026-07-29T12:00:01.000Z',
      });
      await expectCode(repository.commit(divergent), 'PERSISTENCE_CORRUPTION');
    });
  });
}
