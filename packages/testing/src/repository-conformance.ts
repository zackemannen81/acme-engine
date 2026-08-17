import {
  AcmeError,
  canonicalJson,
  computeOperationDigest,
  createAes256GcmPayloadEncryptor,
  sha256,
  type AcceptedExecution,
  type ExecutionRepository,
  type IdGenerator,
  type PayloadEncryptor,
  type PreparedCommit,
  type PreparedCommitContent,
} from '@acme/core';
import { describe, expect, it } from 'vitest';

export interface ExecutionRepositoryConformanceOptions {
  readonly createRepository: (deps?: {
    readonly payloadEncryptor?: PayloadEncryptor;
    /**
     * Replaces the adapter's ID generator. A generator that throws raises a
     * fault deep inside `commit()` on every adapter without a production seam.
     */
    readonly ids?: IdGenerator;
  }) => ExecutionRepository;
}

const timestamp = '2026-07-29T12:00:00.000Z';

function accepted(
  executionId: string,
  requestKey = executionId,
  requestFingerprint = `fingerprint-${executionId}`,
  retention: 'none' | 'hash-only' | 'encrypted-payload' = 'hash-only',
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
      retention,
    },
    createdAt: timestamp,
  };
}

const fixtureResponse = {
  provider: 'fixture',
  model: 'fixture',
  receivedAt: timestamp,
  finishReason: 'stop' as const,
  text: '{"secret":"cleartext-must-not-rest"}',
  usage: {},
  metadata: {},
};

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

const documentValue = { note: 'partial-state-must-not-rest' };

/**
 * A commit whose promotion must allocate a document ID and then an event ID,
 * so a generator that fails on `event` raises the fault after at least one
 * write of the same transaction has already happened.
 */
function preparedWithEffects(executionId: string): PreparedCommit {
  return prepared(executionId, {
    documents: [
      {
        key: 'conformance-document-1',
        kind: 'note',
        schemaVersion: '1.0.0',
        value: documentValue,
        contentHash: sha256(canonicalJson(documentValue)),
      },
    ],
    events: [
      {
        key: 'conformance-event-1',
        type: 'conformance.observed',
        schemaVersion: '1.0.0',
        payload: { executionId },
      },
    ],
  });
}

/**
 * Fails once on the first event ID, after the document ID of the same commit
 * has already been handed out. The second attempt succeeds, so the retry after
 * a rolled-back fault is exercised on the same repository.
 */
function faultOnFirstEventId(): IdGenerator {
  let events = 0;
  return {
    next(kind) {
      if (kind !== 'event') {
        return `${kind}-1`;
      }
      events += 1;
      if (events === 1) {
        throw new Error('Simulated storage fault.');
      }
      return `event-${events}`;
    },
  };
}

function countingIds(): IdGenerator {
  const counts = new Map<string, number>();
  return {
    next(kind) {
      const count = (counts.get(kind) ?? 0) + 1;
      counts.set(kind, count);
      return `${kind}-${count}`;
    },
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

    it('reports ordered resume state and unretained responses (ADR-0017)', async () => {
      const repository = options.createRepository();
      await expect(
        repository.loadResumeState('execution-unknown'),
      ).resolves.toBeNull();

      await repository.accept(accepted('execution-resume'));
      await expect(
        repository.loadResumeState('execution-resume'),
      ).resolves.toEqual({
        executionId: 'execution-resume',
        lastAttemptNumber: 0,
        modelCalls: [],
      });

      for (const [attemptNumber, stage] of [
        [1, 'loading'],
        [1, 'calling-model'],
        [2, 'loading'],
      ] as const) {
        await repository.appendAttempt({
          executionId: 'execution-resume',
          attemptNumber,
          stage,
          outcome: 'started',
          occurredAt: timestamp,
        });
      }
      const reservation = {
        executionId: 'execution-resume',
        callKey: 'model:0',
        purpose: 'primary' as const,
        selection: { profile: 'fixture' },
        requestHash: 'request-hash',
        startedAt: timestamp,
      };
      await repository.reserveModelCall({
        ...reservation,
        modelCallId: 'call-resume-2',
        attempt: 2,
      });
      await repository.reserveModelCall({
        ...reservation,
        modelCallId: 'call-resume-1',
        attempt: 1,
      });
      await repository.completeModelCall({
        modelCallId: 'call-resume-1',
        response: fixtureResponse,
        responseHash: 'response-hash',
        completedAt: timestamp,
      });

      const state = await repository.loadResumeState('execution-resume');
      expect(state).toMatchObject({
        executionId: 'execution-resume',
        lastAttemptNumber: 2,
        modelCalls: [
          { modelCallId: 'call-resume-1', attempt: 1, status: 'succeeded' },
          { modelCallId: 'call-resume-2', attempt: 2, status: 'reserved' },
        ],
      });
      // The accepted execution retains `hash-only`, so no response is
      // recoverable and the engine must refuse to resume.
      expect(state?.modelCalls[0]?.response).toBeUndefined();
      expect(state?.modelCalls[0]?.responseHash).toBe('response-hash');
      // Content-free call metadata survives even when the response does not,
      // so cost stays measurable without decrypting or retaining output.
      const metadata = state?.modelCalls[0]?.callMetadata;
      expect(metadata?.provider).toBe('fixture');
      expect(metadata?.model).toBe('fixture');
      expect(metadata?.finishReason).toBe('stop');
      expect(metadata?.usage).toBeDefined();
      expect(JSON.stringify(metadata)).not.toContain('cleartext-must-not-rest');
      expect(Object.isFrozen(state)).toBe(true);
    });

    it('reveals a sealed response for resume when the key is available', async () => {
      const repository = options.createRepository({
        payloadEncryptor: createAes256GcmPayloadEncryptor({
          key: new Uint8Array(32).fill(7),
          keyId: 'conformance-resume-key',
        }),
      });
      await repository.accept(
        accepted(
          'execution-resume-sealed',
          'execution-resume-sealed',
          'fingerprint-execution-resume-sealed',
          'encrypted-payload',
        ),
      );
      await repository.reserveModelCall({
        modelCallId: 'call-resume-sealed',
        executionId: 'execution-resume-sealed',
        callKey: 'model:0',
        attempt: 1,
        purpose: 'primary',
        selection: { profile: 'fixture' },
        requestHash: 'request-hash',
        startedAt: timestamp,
      });
      await repository.completeModelCall({
        modelCallId: 'call-resume-sealed',
        response: fixtureResponse,
        responseHash: 'response-hash',
        completedAt: timestamp,
      });

      const state = await repository.loadResumeState('execution-resume-sealed');
      expect(state?.modelCalls[0]?.response).toEqual(fixtureResponse);
      expect(
        JSON.stringify(state?.modelCalls[0]?.protectedResponse),
      ).not.toContain('cleartext-must-not-rest');
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

    it('leaves no partial state when a fault interrupts commit', async () => {
      const faulted = options.createRepository({
        ids: faultOnFirstEventId(),
      });
      await faulted.accept(accepted('execution-fault'));
      const commit = preparedWithEffects('execution-fault');
      // Both adapters classify the injected failure identically before the
      // transaction unwinds.
      await expect(faulted.commit(commit)).rejects.toMatchObject({
        data: { code: 'INTERNAL', message: 'ID generator failed for event.' },
      });

      // Nothing from the interrupted transaction may survive, including the
      // document written before the fault.
      await expect(
        faulted.loadReplayEvidence('execution-fault'),
      ).resolves.toBeNull();
      await expect(faulted.get('execution-fault')).resolves.toMatchObject({
        status: 'accepted',
      });
      await expect(
        faulted.loadContext({
          namespace: 'conformance',
          entityId: 'entity-1',
          expectedRevision: 0,
          memory: {
            namespace: 'conformance',
            entityId: 'entity-1',
            task: 'observe',
            limit: 10,
          },
        }),
      ).resolves.toEqual({ state: null, memories: [], documents: [] });

      // The repository stays usable, and the retried commit records the
      // digest an uninterrupted run would have recorded.
      const working = options.createRepository();
      await working.accept(accepted('execution-fault'));
      const expected = await working.commit(commit);
      const retried = await faulted.commit(commit);
      expect(retried.operationDigest).toBe(commit.operationDigest);
      expect(retried.documentKeys).toEqual(expected.documentKeys);
      expect(retried.revision).toBe(expected.revision);
    });

    it('claims, settles and re-claims outbox entries (ADR-0018)', async () => {
      const repository = options.createRepository({ ids: countingIds() });
      await repository.accept(accepted('execution-outbox'));
      await repository.commit(
        prepared('execution-outbox', {
          events: [
            {
              key: 'event-b',
              type: 'conformance.observed',
              schemaVersion: '1.0.0',
              payload: { order: 2 },
            },
            {
              key: 'event-a',
              type: 'conformance.observed',
              schemaVersion: '1.0.0',
              payload: { order: 1 },
            },
          ],
        }),
      );
      await expect(repository.listOutbox({ limit: 10 })).resolves.toMatchObject(
        [{ record: { status: 'pending', attemptCount: 0 } }, { record: {} }],
      );

      // The limit is honored and the claim increments the attempt count.
      const claim = {
        now: timestamp,
        limit: 1,
        leaseExpiresAt: '2026-07-29T12:00:30.000Z',
      };
      const first = await repository.leaseOutbox(claim);
      expect(first).toHaveLength(1);
      expect(first[0]?.record).toMatchObject({
        status: 'claimed',
        attemptCount: 1,
        availableAt: claim.leaseExpiresAt,
        claimedAt: timestamp,
      });
      expect(first[0]?.event).toMatchObject({
        executionId: 'execution-outbox',
        type: 'conformance.observed',
      });

      // A claimed entry is exclusive until its claim expires.
      const second = await repository.leaseOutbox(claim);
      expect(second.map((entry) => entry.record.eventId)).not.toContain(
        first[0]?.record.eventId,
      );

      const claimedId = first[0]?.record.eventId ?? '';
      await repository.markOutboxDelivered({
        eventId: claimedId,
        deliveredAt: '2026-07-29T12:00:05.000Z',
      });
      await repository.markOutboxDelivered({
        eventId: claimedId,
        deliveredAt: '2026-07-29T12:00:05.000Z',
      });
      await expect(
        repository.listOutbox({ status: 'delivered', limit: 10 }),
      ).resolves.toMatchObject([
        {
          record: {
            eventId: claimedId,
            status: 'delivered',
            deliveredAt: '2026-07-29T12:00:05.000Z',
          },
        },
      ]);

      // The second entry fails, retries, and is claimable again at its retry
      // time with the attempt count still rising.
      const other = second[0]?.record.eventId ?? '';
      const error = {
        code: 'INTERNAL' as const,
        message: 'fixture dispatcher failure',
        stage: 'committed' as const,
        retryable: true,
      };
      await repository.markOutboxFailed({
        eventId: other,
        error,
        failedAt: timestamp,
        retryAt: '2026-07-29T12:00:10.000Z',
      });
      await expect(
        repository.listOutbox({ status: 'pending', limit: 10 }),
      ).resolves.toMatchObject([
        { record: { eventId: other, attemptCount: 1, lastError: error } },
      ]);
      await expect(
        repository.leaseOutbox({ ...claim, limit: 10 }),
      ).resolves.toEqual([]);
      const retried = await repository.leaseOutbox({
        now: '2026-07-29T12:00:10.000Z',
        limit: 10,
        leaseExpiresAt: '2026-07-29T12:00:40.000Z',
      });
      expect(retried).toMatchObject([
        { record: { eventId: other, status: 'claimed', attemptCount: 2 } },
      ]);

      // Giving up is terminal for the drain and keeps the recorded error.
      await repository.markOutboxFailed({
        eventId: other,
        error,
        failedAt: '2026-07-29T12:00:11.000Z',
      });
      await expect(
        repository.listOutbox({ status: 'failed', limit: 10 }),
      ).resolves.toMatchObject([
        { record: { eventId: other, status: 'failed', lastError: error } },
      ]);
      await expect(
        repository.leaseOutbox({
          now: '2026-07-30T00:00:00.000Z',
          limit: 10,
          leaseExpiresAt: '2026-07-30T00:00:30.000Z',
        }),
      ).resolves.toEqual([]);

      // Operator redrive returns a failed entry to pending without resetting
      // attempt count or erasing lastError (ACME-0059).
      await repository.redriveOutbox({
        eventId: other,
        availableAt: '2026-07-30T01:00:00.000Z',
      });
      await expect(
        repository.listOutbox({ status: 'pending', limit: 10 }),
      ).resolves.toMatchObject([
        {
          record: {
            eventId: other,
            status: 'pending',
            attemptCount: 2,
            availableAt: '2026-07-30T01:00:00.000Z',
            lastError: error,
          },
        },
      ]);
      const afterRedrive = await repository.leaseOutbox({
        now: '2026-07-30T01:00:00.000Z',
        limit: 10,
        leaseExpiresAt: '2026-07-30T01:00:30.000Z',
      });
      expect(afterRedrive).toMatchObject([
        { record: { eventId: other, status: 'claimed', attemptCount: 3 } },
      ]);
      await repository.markOutboxFailed({
        eventId: other,
        error,
        failedAt: '2026-07-30T01:00:01.000Z',
      });

      await expect(
        repository.redriveOutbox({
          eventId: claimedId,
          availableAt: timestamp,
        }),
      ).rejects.toMatchObject({ data: { code: 'PERSISTENCE_CORRUPTION' } });

      // Settling something that was never claimed is a classified error.
      await expect(
        repository.markOutboxDelivered({
          eventId: 'event-unknown',
          deliveredAt: timestamp,
        }),
      ).rejects.toMatchObject({ data: { code: 'INVALID_REQUEST' } });
    });

    it('loads immutable aggregate replay evidence and honors hash-only retention', async () => {
      const repository = options.createRepository();
      await repository.accept(accepted('execution-replay'));
      await expect(
        repository.loadReplayEvidence('execution-replay'),
      ).resolves.toBeNull();

      await repository.reserveModelCall({
        modelCallId: 'call-replay',
        executionId: 'execution-replay',
        callKey: 'model:0',
        attempt: 1,
        purpose: 'primary',
        selection: { profile: 'fixture' },
        requestHash: 'request-hash',
        startedAt: timestamp,
      });
      await repository.completeModelCall({
        modelCallId: 'call-replay',
        response: {
          provider: 'fixture',
          model: 'fixture',
          receivedAt: timestamp,
          finishReason: 'stop',
          text: '{}',
          usage: {},
          metadata: {},
        },
        responseHash: 'response-hash',
        completedAt: timestamp,
      });
      await repository.commit(
        prepared('execution-replay', {
          replayEvidence: {
            taskInput: { executionId: 'execution-replay' },
            readSet: {
              state: null,
              loadedMemories: [],
              retrievedMemories: [],
              documents: [],
            },
          },
        }),
      );

      const evidence = await repository.loadReplayEvidence('execution-replay');
      expect(evidence).toMatchObject({
        executionId: 'execution-replay',
        effectivePolicy: { retention: 'hash-only' },
        taskInput: { executionId: 'execution-replay' },
        readSet: {
          state: null,
          loadedMemories: [],
          retrievedMemories: [],
          documents: [],
        },
        modelCalls: [
          {
            callKey: 'model:0',
            status: 'succeeded',
            responseHash: 'response-hash',
          },
        ],
        preparedCommit: {
          executionId: 'execution-replay',
          replayEvidence: {
            taskInput: { executionId: 'execution-replay' },
          },
        },
      });
      expect(evidence?.modelCalls[0]?.response).toBeUndefined();
      expect(Object.isFrozen(evidence)).toBe(true);
      expect(Object.isFrozen(evidence?.preparedCommit)).toBe(true);
      await expect(
        repository.loadReplayEvidence('execution-replay'),
      ).resolves.toEqual(evidence);
    });

    it('seals encrypted-payload at rest and reveals it for replay with the key', async () => {
      const key = new Uint8Array(32).fill(3);
      const encryptor = createAes256GcmPayloadEncryptor({
        key,
        keyId: 'conformance-key',
      });
      const repository = options.createRepository({
        payloadEncryptor: encryptor,
      });
      await repository.accept(
        accepted(
          'execution-encrypted',
          'execution-encrypted',
          'fingerprint-execution-encrypted',
          'encrypted-payload',
        ),
      );
      await repository.reserveModelCall({
        modelCallId: 'call-encrypted',
        executionId: 'execution-encrypted',
        callKey: 'model:0',
        attempt: 1,
        purpose: 'primary',
        selection: { profile: 'fixture' },
        requestHash: 'request-hash',
        startedAt: timestamp,
      });
      await repository.completeModelCall({
        modelCallId: 'call-encrypted',
        response: fixtureResponse,
        responseHash: 'response-hash',
        completedAt: timestamp,
      });
      await repository.commit(
        prepared('execution-encrypted', {
          replayEvidence: {
            taskInput: { executionId: 'execution-encrypted' },
            readSet: {
              state: null,
              loadedMemories: [],
              retrievedMemories: [],
              documents: [],
            },
          },
        }),
      );

      const evidence = await repository.loadReplayEvidence(
        'execution-encrypted',
      );
      expect(evidence?.modelCalls[0]?.response).toEqual(fixtureResponse);
      expect(evidence?.modelCalls[0]?.responseHash).toBe('response-hash');
      expect(evidence?.modelCalls[0]?.protectedResponse).toEqual(
        expect.any(String),
      );
      expect(
        JSON.stringify(evidence?.modelCalls[0]?.protectedResponse),
      ).not.toContain('cleartext-must-not-rest');
    });

    it('fails encrypted-payload completion without an encryptor', async () => {
      const repository = options.createRepository();
      await repository.accept(
        accepted(
          'execution-missing-encryptor',
          'execution-missing-encryptor',
          'fingerprint-execution-missing-encryptor',
          'encrypted-payload',
        ),
      );
      await repository.reserveModelCall({
        modelCallId: 'call-missing-encryptor',
        executionId: 'execution-missing-encryptor',
        callKey: 'model:0',
        attempt: 1,
        purpose: 'primary',
        selection: { profile: 'fixture' },
        requestHash: 'request-hash',
        startedAt: timestamp,
      });
      await expect(
        repository.completeModelCall({
          modelCallId: 'call-missing-encryptor',
          response: fixtureResponse,
          responseHash: 'response-hash',
          completedAt: timestamp,
        }),
      ).rejects.toMatchObject({
        data: { code: 'INVALID_REQUEST' },
      });
    });
  });
}
