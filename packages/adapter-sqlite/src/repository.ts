import {
  AcmeError,
  computeOperationDigest,
  nodeHashing,
  type AcceptResult,
  type AcceptedExecution,
  type CommittedExecution,
  type CompletedModelCall,
  type ContextQuery,
  type DomainEventRecord,
  type ExecutionAttempt,
  type ExecutionReadSet,
  type ExecutionRecord,
  type ExecutionReplayEvidence,
  type ExecutionRepository,
  type FailedModelCall,
  type Hashing,
  type IdGenerator,
  type JsonValue,
  type MemoryRecord,
  type ModelCallRecord,
  type ModelCallReservation,
  type NonCommitTerminalRecord,
  type OutboxRecord,
  type PreparedCommit,
  type RepositoryEvidence,
  type StateSnapshot,
  type StateTransition,
  type StoredDocument,
  type StoredEvaluatorRun,
  type StoredMemoryCandidate,
} from '@acme/core';
import type { Database, Statement } from 'better-sqlite3';

import {
  toDomainEventRecord,
  toExecutionAttempt,
  toExecutionRecord,
  toMemoryRecord,
  toModelCallRecord,
  toOutboxRecord,
  toStateSnapshot,
  toStateTransition,
  toStoredDocument,
  type AttemptRow,
  type DocumentRow,
  type DomainEventRow,
  type ExecutionRow,
  type MemoryRecordRow,
  type OutboxRow,
  type SqlValue,
  type StateSnapshotRow,
  type StateTransitionRow,
} from './rows.js';

export interface SqliteExecutionRepositoryOptions {
  readonly database: Database;
  readonly ids: IdGenerator;
  readonly hashing?: Hashing;
}

interface StateHead {
  readonly revision: number;
  readonly valueHash: string;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function invalid(message: string, details?: JsonValue): never {
  throw new AcmeError({
    code: 'INVALID_REQUEST',
    message,
    stage: 'preparing-commit',
    retryable: false,
    ...(details === undefined ? {} : { details }),
  });
}

function corruption(message: string, details?: JsonValue): never {
  throw new AcmeError({
    code: 'PERSISTENCE_CORRUPTION',
    message,
    stage: 'preparing-commit',
    retryable: false,
    ...(details === undefined ? {} : { details }),
  });
}

function stateConflict(expected: number, actual: number): never {
  throw new AcmeError({
    code: 'CONFLICT_STATE_REVISION',
    message: `Expected state revision ${expected}, found ${actual}.`,
    stage: 'preparing-commit',
    retryable: false,
    details: { expectedRevision: expected, actualRevision: actual },
  });
}

function memoryConflict(
  memoryId: string,
  expected: number,
  actual: number,
): never {
  throw new AcmeError({
    code: 'CONFLICT_MEMORY_VERSION',
    message: `Expected memory ${memoryId} version ${expected}, found ${actual}.`,
    stage: 'preparing-commit',
    retryable: false,
    details: {
      memoryId,
      expectedRecordVersion: expected,
      actualRecordVersion: actual,
    },
  });
}

function requireText(value: string, field: string): void {
  if (value.trim().length === 0) {
    invalid(`${field} must be a non-empty string.`);
  }
}

function requireRevision(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    invalid(`${field} must be a non-negative safe integer.`);
  }
}

function assertUniqueKeys(
  values: readonly { readonly key: string }[],
  description: string,
): void {
  const seen = new Set<string>();
  for (const value of values) {
    requireText(value.key, `${description}.key`);
    if (seen.has(value.key)) {
      invalid(`Duplicate ${description} key.`, { key: value.key });
    }
    seen.add(value.key);
  }
}

function assertMutableExecution(execution: ExecutionRecord): void {
  if (
    execution.status === 'committed' ||
    execution.status === 'blocked' ||
    execution.status === 'conflicted' ||
    execution.status === 'cancelled' ||
    execution.status === 'failed'
  ) {
    corruption('A terminal execution cannot be mutated.', {
      executionId: execution.executionId,
      status: execution.status,
    });
  }
}

/**
 * Durable `ExecutionRepository` backed by SQLite. Observable behavior matches
 * `@acme/adapter-memory`; the shared conformance suite is authoritative for
 * both. ADR-0003 fixes the revisioned Unit of Work this class implements.
 */
export class SqliteExecutionRepository implements ExecutionRepository {
  readonly #database: Database;
  readonly #ids: IdGenerator;
  readonly #hashing: Hashing;
  readonly #statements = new Map<string, Statement>();

  constructor(options: SqliteExecutionRepositoryOptions) {
    this.#database = options.database;
    this.#ids = options.ids;
    this.#hashing = options.hashing ?? nodeHashing;
  }

  async accept(input: AcceptedExecution): Promise<AcceptResult> {
    const accepted = this.#clone(input);
    requireText(accepted.executionId, 'executionId');
    requireText(accepted.request.requestKey, 'request.requestKey');
    requireText(accepted.request.namespace, 'request.namespace');
    requireText(accepted.request.entityId, 'request.entityId');
    requireText(accepted.requestFingerprint, 'requestFingerprint');
    requireText(accepted.inputHash, 'inputHash');
    requireRevision(
      accepted.request.expectedRevision,
      'request.expectedRevision',
    );

    return this.#immediate((): AcceptResult => {
      const existing = this.#findByRequestKey(
        accepted.request.namespace,
        accepted.request.requestKey,
      );
      if (existing !== undefined) {
        if (existing.requestFingerprint !== accepted.requestFingerprint) {
          return this.#clone({
            kind: 'conflict',
            existingExecutionId: existing.executionId,
          });
        }
        return this.#clone({ kind: 'existing', execution: existing });
      }
      if (this.#findExecution(accepted.executionId) !== undefined) {
        corruption('Execution ID was reused for a different request.', {
          executionId: accepted.executionId,
        });
      }

      const record: ExecutionRecord = this.#clone({
        executionId: accepted.executionId,
        request: accepted.request,
        requestFingerprint: accepted.requestFingerprint,
        inputHash: accepted.inputHash,
        contract: accepted.contract,
        contractFingerprint: accepted.contractFingerprint,
        policy: accepted.effectivePolicy,
        status: 'accepted',
        currentStage: 'accepted',
        createdAt: accepted.createdAt,
        updatedAt: accepted.createdAt,
      });
      this.#run(
        `INSERT INTO executions (
          execution_id, namespace, request_key, request_fingerprint, task,
          entity_id, expected_revision, input_json, input_hash, request_json,
          policy_json, contract_id, contract_version, contract_fingerprint,
          status, current_stage, result_json, error_json, created_at,
          updated_at, terminal_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.executionId,
          record.request.namespace,
          record.request.requestKey,
          record.requestFingerprint,
          record.request.task,
          record.request.entityId,
          record.request.expectedRevision,
          this.#json(record.request.input),
          record.inputHash,
          this.#json(record.request),
          this.#json(record.policy),
          record.contract.id,
          record.contract.version,
          record.contractFingerprint,
          record.status,
          record.currentStage,
          null,
          null,
          record.createdAt,
          record.updatedAt,
          null,
        ],
      );
      return this.#clone({ kind: 'created', execution: record });
    });
  }

  async get(executionId: string): Promise<ExecutionRecord | null> {
    const record = this.#findExecution(executionId);
    return record === undefined ? null : this.#clone(record);
  }

  async appendAttempt(input: ExecutionAttempt): Promise<void> {
    const attempt = this.#clone(input);
    requireRevision(attempt.attemptNumber, 'attemptNumber');
    if (attempt.attemptNumber === 0) {
      invalid('attemptNumber must be greater than zero.');
    }

    this.#immediate(() => {
      const execution = this.#requireExecution(attempt.executionId);
      assertMutableExecution(execution);
      const existing = this.#findAttempt(
        attempt.executionId,
        attempt.attemptNumber,
        attempt.stage,
      );
      if (existing !== undefined) {
        if (!this.#equivalent(existing, attempt)) {
          corruption('Divergent execution attempt key was reused.', {
            executionId: attempt.executionId,
            attemptNumber: attempt.attemptNumber,
            stage: attempt.stage,
          });
        }
        return;
      }
      this.#run(
        `INSERT INTO execution_attempts (
          execution_id, attempt_number, stage, outcome, retry_at,
          diagnostic_json, occurred_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          attempt.executionId,
          attempt.attemptNumber,
          attempt.stage,
          attempt.outcome,
          attempt.retryAt ?? null,
          attempt.diagnostic === undefined
            ? null
            : this.#json(attempt.diagnostic),
          attempt.occurredAt,
        ],
      );
      this.#run(
        `UPDATE executions
         SET status = ?, current_stage = ?, updated_at = ?
         WHERE execution_id = ?`,
        [attempt.stage, attempt.stage, attempt.occurredAt, attempt.executionId],
      );
    });
  }

  async reserveModelCall(
    input: ModelCallReservation,
  ): Promise<ModelCallRecord> {
    const reservation = this.#clone(input);
    requireText(reservation.modelCallId, 'modelCallId');
    requireText(reservation.callKey, 'callKey');
    requireRevision(reservation.attempt, 'attempt');
    if (reservation.attempt === 0) {
      invalid('Model-call attempt must be greater than zero.');
    }

    return this.#immediate((): ModelCallRecord => {
      const execution = this.#requireExecution(reservation.executionId);
      assertMutableExecution(execution);
      const existing = this.#findModelCallByKey(
        reservation.executionId,
        reservation.callKey,
        reservation.attempt,
      );
      if (existing !== undefined) {
        const original: ModelCallReservation = {
          modelCallId: existing.modelCallId,
          executionId: existing.executionId,
          callKey: existing.callKey,
          attempt: existing.attempt,
          purpose: existing.purpose,
          selection: existing.selection,
          requestHash: existing.requestHash,
          ...(existing.protectedRequest === undefined
            ? {}
            : { protectedRequest: existing.protectedRequest }),
          startedAt: existing.startedAt,
        };
        if (!this.#equivalent(original, reservation)) {
          corruption('Divergent model-call key was reused.', {
            executionId: reservation.executionId,
            callKey: reservation.callKey,
            attempt: reservation.attempt,
          });
        }
        return this.#clone(existing);
      }
      if (this.#findModelCall(reservation.modelCallId) !== undefined) {
        corruption('Model-call ID was reused.', {
          modelCallId: reservation.modelCallId,
        });
      }

      const record: ModelCallRecord = this.#clone({
        ...reservation,
        status: 'reserved',
      });
      this.#run(
        `INSERT INTO model_calls (
          model_call_id, execution_id, call_key, attempt, purpose, provider,
          model, selection_json, request_hash, request_payload, response_hash,
          response_payload, provider_response_id, usage_json, record_json,
          status, error_json, started_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.modelCallId,
          record.executionId,
          record.callKey,
          record.attempt,
          record.purpose,
          null,
          null,
          this.#json(record.selection),
          record.requestHash,
          record.protectedRequest ?? null,
          null,
          null,
          null,
          null,
          this.#json(record),
          record.status,
          null,
          record.startedAt,
          null,
        ],
      );
      return this.#clone(record);
    });
  }

  async completeModelCall(input: CompletedModelCall): Promise<void> {
    const completed = this.#clone(input);

    this.#immediate(() => {
      const existing = this.#findModelCall(completed.modelCallId);
      if (existing === undefined) {
        invalid('Model call does not exist.', {
          modelCallId: completed.modelCallId,
        });
      }
      if (existing.status === 'succeeded') {
        if (
          existing.responseHash === undefined ||
          existing.completedAt === undefined
        ) {
          corruption('Succeeded model-call evidence is incomplete.', {
            modelCallId: existing.modelCallId,
          });
        }
        const prior: CompletedModelCall = {
          modelCallId: existing.modelCallId,
          response: completed.response,
          responseHash: existing.responseHash,
          ...(existing.protectedResponse === undefined
            ? {}
            : { protectedResponse: existing.protectedResponse }),
          completedAt: existing.completedAt,
        };
        if (!this.#equivalent(prior, completed)) {
          corruption('Divergent model-call completion was attempted.', {
            modelCallId: completed.modelCallId,
          });
        }
        return;
      }
      if (existing.status === 'failed' || existing.status === 'ambiguous') {
        corruption('A failed model call cannot be completed.', {
          modelCallId: completed.modelCallId,
        });
      }
      const execution = this.#requireExecution(existing.executionId);
      const retainPayload = execution.policy.retention === 'encrypted-payload';
      const record: ModelCallRecord = this.#clone({
        ...existing,
        status: 'succeeded',
        ...(retainPayload ? { response: completed.response } : {}),
        responseHash: completed.responseHash,
        ...(retainPayload && completed.protectedResponse !== undefined
          ? { protectedResponse: completed.protectedResponse }
          : {}),
        completedAt: completed.completedAt,
      });
      this.#writeModelCall(record);
    });
  }

  async failModelCall(input: FailedModelCall): Promise<void> {
    const failed = this.#clone(input);

    this.#immediate(() => {
      const existing = this.#findModelCall(failed.modelCallId);
      if (existing === undefined) {
        invalid('Model call does not exist.', {
          modelCallId: failed.modelCallId,
        });
      }
      if (existing.status === 'failed' || existing.status === 'ambiguous') {
        if (
          existing.error === undefined ||
          existing.completedAt === undefined
        ) {
          corruption('Failed model-call evidence is incomplete.', {
            modelCallId: existing.modelCallId,
          });
        }
        const prior: FailedModelCall = {
          modelCallId: existing.modelCallId,
          error: existing.error,
          ambiguous: existing.status === 'ambiguous',
          completedAt: existing.completedAt,
        };
        if (!this.#equivalent(prior, failed)) {
          corruption('Divergent model-call failure was attempted.', {
            modelCallId: failed.modelCallId,
          });
        }
        return;
      }
      if (existing.status === 'succeeded') {
        corruption('A completed model call cannot be failed.', {
          modelCallId: failed.modelCallId,
        });
      }
      const record: ModelCallRecord = this.#clone({
        ...existing,
        status: failed.ambiguous ? 'ambiguous' : 'failed',
        error: failed.error,
        completedAt: failed.completedAt,
      });
      this.#writeModelCall(record);
    });
  }

  async loadContext(queryInput: ContextQuery): Promise<ExecutionReadSet> {
    const query = this.#clone(queryInput);
    requireRevision(query.expectedRevision, 'expectedRevision');
    if (
      query.memory.namespace !== query.namespace ||
      query.memory.entityId !== query.entityId
    ) {
      invalid('Memory query scope must match the context scope.');
    }

    const head = this.#findStateHead(query.namespace, query.entityId);
    const actualRevision = head?.revision ?? 0;
    if (actualRevision !== query.expectedRevision) {
      stateConflict(query.expectedRevision, actualRevision);
    }
    const state =
      actualRevision === 0
        ? null
        : (this.#findStateSnapshot(
            query.namespace,
            query.entityId,
            actualRevision,
          ) ??
          corruption('State head references a missing snapshot.', {
            namespace: query.namespace,
            entityId: query.entityId,
          }));

    const allowedMemoryKinds =
      query.memory.kinds === undefined ? null : new Set(query.memory.kinds);
    const memories = this.#all<MemoryRecordRow>(
      `SELECT * FROM memory_records
       WHERE namespace = ? AND entity_id = ?
         AND status NOT IN ('forgotten', 'superseded')
       ORDER BY identity_key, memory_id`,
      [query.namespace, query.entityId],
    )
      .map(toMemoryRecord)
      .filter(
        (record) =>
          allowedMemoryKinds === null || allowedMemoryKinds.has(record.kind),
      );

    const allowedDocumentKinds =
      query.documentKinds === undefined ? null : new Set(query.documentKinds);
    const documents = this.#all<DocumentRow>(
      `SELECT * FROM documents
       WHERE namespace = ? AND entity_id = ?
       ORDER BY document_key, document_id`,
      [query.namespace, query.entityId],
    )
      .map(toStoredDocument)
      .filter(
        (document) =>
          allowedDocumentKinds === null ||
          allowedDocumentKinds.has(document.kind),
      );

    return this.#clone({ state, memories, documents });
  }

  async commit(input: PreparedCommit): Promise<CommittedExecution> {
    const prepared = this.#clone(input);
    requireRevision(prepared.expectedRevision, 'expectedRevision');
    const computedDigest = computeOperationDigest(prepared, this.#hashing);
    if (computedDigest !== prepared.operationDigest) {
      invalid('Prepared commit operation digest does not match its content.', {
        supplied: prepared.operationDigest,
        computed: computedDigest,
      });
    }

    return this.#immediate((): CommittedExecution => {
      const execution = this.#requireExecution(prepared.executionId);
      const priorCommit = this.#findCommitted(prepared.executionId);
      if (priorCommit !== undefined) {
        if (priorCommit.operationDigest !== prepared.operationDigest) {
          corruption(
            'A committed execution was retried with divergent content.',
            { executionId: prepared.executionId },
          );
        }
        return this.#clone(priorCommit);
      }
      assertMutableExecution(execution);
      if (execution.request.expectedRevision !== prepared.expectedRevision) {
        invalid('Prepared commit revision differs from the accepted request.');
      }

      const namespace = execution.request.namespace;
      const entityId = execution.request.entityId;
      const head = this.#findStateHead(namespace, entityId);
      const actualRevision = head?.revision ?? 0;
      if (actualRevision !== prepared.expectedRevision) {
        stateConflict(prepared.expectedRevision, actualRevision);
      }

      assertUniqueKeys(prepared.documents, 'document');
      assertUniqueKeys(prepared.memoryCandidates, 'memory candidate');
      assertUniqueKeys(prepared.events, 'event');
      this.#validateEvidence(prepared);
      this.#validateReplayEvidence(prepared, execution);
      this.#validateState(prepared, execution, head);

      this.#applyMemory(prepared, execution);

      const documentKeys: string[] = [];
      for (const candidate of [...prepared.documents].sort((left, right) =>
        compareText(left.key, right.key),
      )) {
        const contentHash = this.#hashing.sha256(this.#json(candidate.value));
        if (contentHash !== candidate.contentHash) {
          invalid('Document content hash does not match its value.', {
            key: candidate.key,
          });
        }
        if (this.#hasDocumentKey(prepared.executionId, candidate.key)) {
          corruption('Document key was already persisted.', {
            key: candidate.key,
          });
        }
        const documentId = this.#nextId('document');
        if (
          this.#one<DocumentRow>(
            'SELECT * FROM documents WHERE document_id = ?',
            [documentId],
          ) !== undefined
        ) {
          corruption('Generated document ID collided with persisted data.', {
            documentId,
          });
        }
        documentKeys.push(candidate.key);
        const record: StoredDocument = {
          documentId,
          executionId: prepared.executionId,
          namespace,
          entityId,
          key: candidate.key,
          kind: candidate.kind,
          schemaVersion: candidate.schemaVersion,
          value: candidate.value,
          contentHash: candidate.contentHash,
          createdAt: prepared.committedAt,
        };
        this.#run(
          `INSERT INTO documents (
            document_id, execution_id, namespace, entity_id, document_key,
            kind, schema_version, value_json, content_hash, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            record.documentId,
            record.executionId,
            record.namespace,
            record.entityId,
            record.key,
            record.kind,
            record.schemaVersion,
            this.#json(record.value),
            record.contentHash,
            record.createdAt,
          ],
        );
      }

      const eventIds: string[] = [];
      for (const candidate of [...prepared.events].sort((left, right) =>
        compareText(left.key, right.key),
      )) {
        if (this.#hasEventKey(prepared.executionId, candidate.key)) {
          corruption('Event key was already persisted.', {
            key: candidate.key,
          });
        }
        const eventId = this.#nextId('event');
        if (
          this.#one<DomainEventRow>(
            'SELECT * FROM domain_events WHERE event_id = ?',
            [eventId],
          ) !== undefined
        ) {
          corruption('Generated event ID collided with persisted data.', {
            eventId,
          });
        }
        eventIds.push(eventId);
        this.#run(
          `INSERT INTO domain_events (
            event_id, execution_id, event_key, namespace, entity_id, type,
            schema_version, payload_json, occurred_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            eventId,
            prepared.executionId,
            candidate.key,
            namespace,
            entityId,
            candidate.type,
            candidate.schemaVersion,
            this.#json(candidate.payload),
            prepared.committedAt,
          ],
        );
        this.#run(
          `INSERT INTO outbox (
            event_id, status, attempt_count, available_at, claimed_at,
            delivered_at, last_error_json
          ) VALUES (?, 'pending', 0, ?, NULL, NULL, NULL)`,
          [eventId, prepared.committedAt],
        );
      }

      for (const candidate of prepared.memoryCandidates) {
        const decision = prepared.memory.decisions.find(
          (entry) => entry.candidateKey === candidate.key,
        );
        if (decision === undefined) {
          corruption('Validated memory decision correlation was lost.', {
            candidateKey: candidate.key,
          });
        }
        this.#run(
          `INSERT INTO memory_candidates (
            execution_id, candidate_key, kind, schema_version, value_json,
            candidate_json, decision_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            prepared.executionId,
            candidate.key,
            candidate.kind,
            candidate.schemaVersion,
            this.#json(candidate.value),
            this.#json(candidate),
            this.#json(decision),
            prepared.committedAt,
          ],
        );
      }

      for (const evaluator of prepared.evaluatorRuns) {
        this.#run(
          `INSERT INTO evaluator_runs (
            evaluator_run_id, execution_id, evaluator_id, evaluator_version,
            attempt, subject_hash, decision_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `${prepared.executionId}\u0000${evaluator.evaluatorId}\u0000${evaluator.attempt}`,
            prepared.executionId,
            evaluator.evaluatorId,
            evaluator.evaluatorVersion,
            evaluator.attempt,
            evaluator.subjectHash,
            this.#json(evaluator.decision),
            prepared.committedAt,
          ],
        );
      }

      if (prepared.state !== null) {
        const { snapshot, transition } = prepared.state;
        this.#run(
          `INSERT INTO state_snapshots (
            namespace, entity_id, revision, schema_version, value_json,
            value_hash, execution_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            snapshot.namespace,
            snapshot.entityId,
            snapshot.revision,
            snapshot.schemaVersion,
            this.#json(snapshot.value),
            snapshot.valueHash,
            snapshot.executionId,
            snapshot.createdAt,
          ],
        );
        this.#run(
          `INSERT INTO state_transitions (
            transition_id, operation_key, namespace, entity_id, from_revision,
            to_revision, delta_schema_version, delta_json, previous_hash,
            next_hash, execution_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            transition.transitionId,
            transition.operationKey,
            transition.namespace,
            transition.entityId,
            transition.fromRevision,
            transition.toRevision,
            transition.deltaSchemaVersion,
            this.#json(transition.delta),
            transition.previousHash,
            transition.nextHash,
            transition.executionId,
            transition.createdAt,
          ],
        );
        this.#run(
          `INSERT INTO state_heads (namespace, entity_id, revision, value_hash)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (namespace, entity_id)
           DO UPDATE SET revision = excluded.revision,
                         value_hash = excluded.value_hash`,
          [namespace, entityId, snapshot.revision, snapshot.valueHash],
        );
      }

      const revision =
        prepared.state?.snapshot.revision ?? prepared.expectedRevision;
      const committed: CommittedExecution = this.#clone({
        executionId: prepared.executionId,
        revision,
        documentKeys: [...documentKeys].sort(compareText),
        eventIds,
        operationDigest: prepared.operationDigest,
      });
      this.#run(
        `INSERT INTO execution_commits (
          execution_id, operation_digest, revision, document_keys_json,
          event_ids_json, prepared_commit_json, committed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          committed.executionId,
          committed.operationDigest,
          committed.revision,
          this.#json([...committed.documentKeys]),
          this.#json([...committed.eventIds]),
          this.#json(prepared),
          prepared.committedAt,
        ],
      );
      this.#run(
        `UPDATE executions
         SET status = 'committed', current_stage = 'committed',
             result_json = ?, updated_at = ?, terminal_at = ?
         WHERE execution_id = ?`,
        [
          this.#json({
            status: 'committed',
            executionId: prepared.executionId,
            replayed: false,
            revision,
            documentKeys: [...committed.documentKeys],
            eventIds: [...committed.eventIds],
          }),
          prepared.committedAt,
          prepared.committedAt,
          prepared.executionId,
        ],
      );
      return this.#clone(committed);
    });
  }

  async loadReplayEvidence(
    executionId: string,
  ): Promise<ExecutionReplayEvidence | null> {
    const execution = this.#findExecution(executionId);
    const prepared = this.#findPreparedCommit(executionId);
    if (
      execution === undefined ||
      prepared === undefined ||
      prepared.replayEvidence === undefined
    ) {
      return null;
    }
    const modelCalls = this.#all<{ readonly record_json: string }>(
      `SELECT record_json FROM model_calls
       WHERE execution_id = ?
       ORDER BY call_key, attempt`,
      [executionId],
    ).map((row) => toModelCallRecord(row.record_json));
    return this.#clone({
      executionId,
      request: execution.request,
      requestFingerprint: execution.requestFingerprint,
      inputHash: execution.inputHash,
      contract: execution.contract,
      contractFingerprint: execution.contractFingerprint,
      effectivePolicy: execution.policy,
      taskInput: prepared.replayEvidence.taskInput,
      readSet: prepared.replayEvidence.readSet,
      modelCalls,
      preparedCommit: prepared,
    });
  }

  async markTerminal(input: NonCommitTerminalRecord): Promise<void> {
    const terminal = this.#clone(input);

    this.#immediate(() => {
      const execution = this.#requireExecution(terminal.executionId);
      if (execution.status === terminal.status) {
        if (
          execution.error !== undefined &&
          this.#equivalent(execution.error, terminal.error) &&
          execution.updatedAt === terminal.terminalAt
        ) {
          return;
        }
        corruption('Divergent terminal outcome was attempted.', {
          executionId: terminal.executionId,
        });
      }
      assertMutableExecution(execution);
      this.#run(
        `UPDATE executions
         SET status = ?, current_stage = ?, result_json = ?, error_json = ?,
             updated_at = ?, terminal_at = ?
         WHERE execution_id = ?`,
        [
          terminal.status,
          terminal.status,
          this.#json({
            status: terminal.status,
            executionId: terminal.executionId,
            error: terminal.error,
          }),
          this.#json(terminal.error),
          terminal.terminalAt,
          terminal.terminalAt,
          terminal.executionId,
        ],
      );
    });
  }

  /** Ordered durable evidence, mirroring the in-memory adapter's snapshot. */
  snapshot(): RepositoryEvidence {
    const executions = this.#all<ExecutionRow>(
      'SELECT * FROM executions ORDER BY execution_id',
    ).map(toExecutionRecord);
    const attempts = this.#all<AttemptRow>(
      `SELECT * FROM execution_attempts
       ORDER BY execution_id, attempt_number, stage`,
    ).map(toExecutionAttempt);
    const modelCalls = this.#all<{ readonly record_json: string }>(
      'SELECT record_json FROM model_calls ORDER BY execution_id, call_key, attempt',
    ).map((row) => toModelCallRecord(row.record_json));
    const documents = this.#all<DocumentRow>(
      'SELECT * FROM documents ORDER BY execution_id, document_key',
    ).map(toStoredDocument);
    const memoryCandidates = this.#all<{
      readonly execution_id: string;
      readonly candidate_json: string;
      readonly decision_json: string;
      readonly created_at: string;
    }>(
      `SELECT execution_id, candidate_json, decision_json, created_at
       FROM memory_candidates ORDER BY execution_id, candidate_key`,
    ).map((row): StoredMemoryCandidate => ({
      executionId: row.execution_id,
      candidate: JSON.parse(row.candidate_json) as never,
      decision: JSON.parse(row.decision_json) as never,
      createdAt: row.created_at,
    }));
    const memoryRecords = this.#all<MemoryRecordRow>(
      `SELECT * FROM memory_records
       ORDER BY namespace, entity_id, identity_key, memory_id`,
    ).map(toMemoryRecord);
    const snapshots: readonly StateSnapshot<JsonValue>[] =
      this.#all<StateSnapshotRow>(
        'SELECT * FROM state_snapshots ORDER BY namespace, entity_id, revision',
      ).map(toStateSnapshot);
    const transitions: readonly StateTransition<JsonValue>[] =
      this.#all<StateTransitionRow>(
        'SELECT * FROM state_transitions ORDER BY namespace, entity_id, to_revision',
      ).map(toStateTransition);
    const evaluatorRuns = this.#all<{
      readonly execution_id: string;
      readonly evaluator_id: string;
      readonly evaluator_version: string;
      readonly attempt: number;
      readonly subject_hash: string;
      readonly decision_json: string;
      readonly created_at: string;
    }>(
      `SELECT * FROM evaluator_runs
       ORDER BY execution_id, evaluator_id, attempt`,
    ).map((row): StoredEvaluatorRun => ({
      executionId: row.execution_id,
      evaluatorId: row.evaluator_id,
      evaluatorVersion: row.evaluator_version,
      attempt: row.attempt,
      subjectHash: row.subject_hash,
      decision: JSON.parse(row.decision_json) as never,
      createdAt: row.created_at,
    }));
    const events: readonly DomainEventRecord[] = this.#all<DomainEventRow>(
      'SELECT * FROM domain_events ORDER BY execution_id, event_key',
    ).map(toDomainEventRecord);
    const outbox: readonly OutboxRecord[] = this.#all<OutboxRow>(
      'SELECT * FROM outbox ORDER BY event_id',
    ).map(toOutboxRecord);

    return this.#clone({
      executions,
      attempts,
      modelCalls,
      documents,
      memoryCandidates,
      memoryRecords,
      state: { snapshots, transitions },
      evaluatorRuns,
      events,
      outbox,
    });
  }

  #validateEvidence(prepared: PreparedCommit): void {
    const decisions = new Map<string, string>();
    for (const decision of prepared.memory.decisions) {
      requireText(decision.candidateKey, 'memory decision candidateKey');
      if (decision.resolution.candidateKey !== decision.candidateKey) {
        invalid('Memory decision and resolution candidate keys differ.', {
          candidateKey: decision.candidateKey,
        });
      }
      if (decisions.has(decision.candidateKey)) {
        invalid('Duplicate memory decision candidate key.', {
          candidateKey: decision.candidateKey,
        });
      }
      decisions.set(decision.candidateKey, decision.identityKey);
    }
    if (decisions.size !== prepared.memoryCandidates.length) {
      invalid('Every memory candidate must have exactly one decision.');
    }
    for (const candidate of prepared.memoryCandidates) {
      if (!decisions.has(candidate.key)) {
        invalid('Memory candidate is missing its decision.', {
          candidateKey: candidate.key,
        });
      }
    }

    const evaluators = new Set<string>();
    for (const evaluator of prepared.evaluatorRuns) {
      requireText(evaluator.evaluatorId, 'evaluatorId');
      requireRevision(evaluator.attempt, 'evaluator attempt');
      const key = `${evaluator.evaluatorId}\u0000${evaluator.attempt}`;
      if (evaluators.has(key)) {
        invalid('Duplicate evaluator run identity.', { key });
      }
      evaluators.add(key);
    }
  }

  #validateReplayEvidence(
    prepared: PreparedCommit,
    execution: ExecutionRecord,
  ): void {
    const replay = prepared.replayEvidence;
    if (replay === undefined) {
      return;
    }
    if (!this.#equivalent(replay.taskInput, execution.request.input)) {
      invalid('Replay task input differs from the accepted request input.');
    }
    const { readSet } = replay;
    const stateRevision = readSet.state?.revision ?? 0;
    if (stateRevision !== prepared.expectedRevision) {
      invalid('Replay read-set state revision is inconsistent.', {
        expectedRevision: prepared.expectedRevision,
        stateRevision,
      });
    }
    const loadedById = new Map(
      readSet.loadedMemories.map((record) => [record.memoryId, record]),
    );
    for (const [index, ranked] of readSet.retrievedMemories.entries()) {
      if (ranked.rank !== index + 1) {
        invalid('Replay ranked memory evidence has an invalid rank.', {
          memoryId: ranked.record.memoryId,
          rank: ranked.rank,
        });
      }
      const loaded = loadedById.get(ranked.record.memoryId);
      if (loaded === undefined || !this.#equivalent(loaded, ranked.record)) {
        invalid(
          'Replay ranked memory evidence is absent from the loaded read set.',
          { memoryId: ranked.record.memoryId },
        );
      }
    }
  }

  #validateState(
    prepared: PreparedCommit,
    execution: ExecutionRecord,
    head: StateHead | undefined,
  ): void {
    if (prepared.state === null) {
      return;
    }
    const { snapshot, transition } = prepared.state;
    const nextRevision = prepared.expectedRevision + 1;
    if (
      snapshot.namespace !== execution.request.namespace ||
      snapshot.entityId !== execution.request.entityId ||
      transition.namespace !== execution.request.namespace ||
      transition.entityId !== execution.request.entityId ||
      snapshot.executionId !== prepared.executionId ||
      transition.executionId !== prepared.executionId
    ) {
      invalid('Prepared state scope or execution correlation is invalid.');
    }
    if (
      snapshot.revision !== nextRevision ||
      transition.fromRevision !== prepared.expectedRevision ||
      transition.toRevision !== nextRevision
    ) {
      invalid('Prepared state revisions are not a single revision increment.');
    }
    const computedHash = this.#hashing.sha256(this.#json(snapshot.value));
    if (
      snapshot.valueHash !== computedHash ||
      transition.nextHash !== computedHash ||
      transition.previousHash !== (head?.valueHash ?? null)
    ) {
      invalid('Prepared state hash chain is invalid.');
    }
    requireText(transition.transitionId, 'transitionId');
    requireText(transition.operationKey, 'operationKey');
    if (
      this.#one<StateTransitionRow>(
        'SELECT * FROM state_transitions WHERE transition_id = ?',
        [transition.transitionId],
      ) !== undefined
    ) {
      corruption('Transition ID collides with persisted state.', {
        transitionId: transition.transitionId,
      });
    }
    if (
      this.#one<StateTransitionRow>(
        `SELECT * FROM state_transitions
         WHERE namespace = ? AND entity_id = ? AND operation_key = ?`,
        [
          execution.request.namespace,
          execution.request.entityId,
          transition.operationKey,
        ],
      ) !== undefined
    ) {
      corruption('Operation key collides with persisted state.', {
        operationKey: transition.operationKey,
      });
    }
  }

  #applyMemory(prepared: PreparedCommit, execution: ExecutionRecord): void {
    for (const mutation of prepared.memory.mutations) {
      const record = this.#clone(mutation.record);
      if (
        record.namespace !== execution.request.namespace ||
        record.entityId !== execution.request.entityId
      ) {
        invalid('Memory mutation is outside the execution scope.', {
          memoryId: record.memoryId,
        });
      }
      requireText(record.memoryId, 'memoryId');
      requireText(record.identityKey, 'memory identityKey');
      if (mutation.action === 'create') {
        if (record.recordVersion !== 1) {
          invalid('Created memory records must start at version 1.', {
            memoryId: record.memoryId,
          });
        }
        if (
          this.#findMemoryRecord(record.memoryId) !== undefined ||
          this.#findMemoryIdByIdentity(record) !== undefined
        ) {
          corruption('Created memory identity collides with persisted data.', {
            memoryId: record.memoryId,
            identityKey: record.identityKey,
          });
        }
        this.#writeMemoryRecord(record, 'insert');
        continue;
      }

      const existing = this.#findMemoryRecord(record.memoryId);
      if (existing === undefined) {
        corruption('Updated memory record does not exist.', {
          memoryId: record.memoryId,
        });
      }
      if (existing.recordVersion !== mutation.expectedRecordVersion) {
        memoryConflict(
          record.memoryId,
          mutation.expectedRecordVersion,
          existing.recordVersion,
        );
      }
      if (
        record.recordVersion !== existing.recordVersion + 1 ||
        record.namespace !== existing.namespace ||
        record.entityId !== existing.entityId ||
        record.identityKey !== existing.identityKey ||
        record.kind !== existing.kind ||
        record.schemaVersion !== existing.schemaVersion
      ) {
        invalid('Memory update changed immutable identity or version fields.', {
          memoryId: record.memoryId,
        });
      }
      if (this.#findMemoryIdByIdentity(record) !== record.memoryId) {
        corruption('Memory identity index is inconsistent.', {
          memoryId: record.memoryId,
        });
      }
      this.#writeMemoryRecord(record, 'update');
    }
  }

  #writeMemoryRecord(record: MemoryRecord, mode: 'insert' | 'update'): void {
    const values: readonly SqlValue[] = [
      record.namespace,
      record.entityId,
      record.identityKey,
      record.kind,
      record.schemaVersion,
      this.#json(record.value),
      record.strength,
      record.status,
      record.recordVersion,
      record.firstSeenAt,
      record.lastSeenAt,
      record.lastReinforcedAt,
      this.#json([...record.provenance]),
    ];
    if (mode === 'insert') {
      this.#run(
        `INSERT INTO memory_records (
          memory_id, namespace, entity_id, identity_key, kind, schema_version,
          value_json, strength, status, record_version, first_seen_at,
          last_seen_at, last_reinforced_at, provenance_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [record.memoryId, ...values],
      );
      return;
    }
    this.#run(
      `UPDATE memory_records
       SET namespace = ?, entity_id = ?, identity_key = ?, kind = ?,
           schema_version = ?, value_json = ?, strength = ?, status = ?,
           record_version = ?, first_seen_at = ?, last_seen_at = ?,
           last_reinforced_at = ?, provenance_json = ?
       WHERE memory_id = ?`,
      [...values, record.memoryId],
    );
  }

  #writeModelCall(record: ModelCallRecord): void {
    this.#run(
      `UPDATE model_calls
       SET provider = ?, model = ?, response_hash = ?, response_payload = ?,
           provider_response_id = ?, usage_json = ?, record_json = ?,
           status = ?, error_json = ?, completed_at = ?
       WHERE model_call_id = ?`,
      [
        record.response?.provider ?? null,
        record.response?.model ?? null,
        record.responseHash ?? null,
        record.response === undefined ? null : this.#json(record.response),
        record.response?.providerResponseId ?? null,
        record.response === undefined
          ? null
          : this.#json(record.response.usage),
        this.#json(record),
        record.status,
        record.error === undefined ? null : this.#json(record.error),
        record.completedAt ?? null,
        record.modelCallId,
      ],
    );
  }

  #findByRequestKey(
    namespace: string,
    requestKey: string,
  ): ExecutionRecord | undefined {
    const row = this.#one<ExecutionRow>(
      'SELECT * FROM executions WHERE namespace = ? AND request_key = ?',
      [namespace, requestKey],
    );
    return row === undefined ? undefined : toExecutionRecord(row);
  }

  #findExecution(executionId: string): ExecutionRecord | undefined {
    const row = this.#one<ExecutionRow>(
      'SELECT * FROM executions WHERE execution_id = ?',
      [executionId],
    );
    return row === undefined ? undefined : toExecutionRecord(row);
  }

  #requireExecution(executionId: string): ExecutionRecord {
    const execution = this.#findExecution(executionId);
    if (execution === undefined) {
      invalid('Execution does not exist.', { executionId });
    }
    return execution;
  }

  #findAttempt(
    executionId: string,
    attemptNumber: number,
    stage: string,
  ): ExecutionAttempt | undefined {
    const row = this.#one<AttemptRow>(
      `SELECT * FROM execution_attempts
       WHERE execution_id = ? AND attempt_number = ? AND stage = ?`,
      [executionId, attemptNumber, stage],
    );
    return row === undefined ? undefined : toExecutionAttempt(row);
  }

  #findModelCall(modelCallId: string): ModelCallRecord | undefined {
    const row = this.#one<{ readonly record_json: string }>(
      'SELECT record_json FROM model_calls WHERE model_call_id = ?',
      [modelCallId],
    );
    return row === undefined ? undefined : toModelCallRecord(row.record_json);
  }

  #findModelCallByKey(
    executionId: string,
    callKey: string,
    attempt: number,
  ): ModelCallRecord | undefined {
    const row = this.#one<{ readonly record_json: string }>(
      `SELECT record_json FROM model_calls
       WHERE execution_id = ? AND call_key = ? AND attempt = ?`,
      [executionId, callKey, attempt],
    );
    return row === undefined ? undefined : toModelCallRecord(row.record_json);
  }

  #findMemoryRecord(memoryId: string): MemoryRecord | undefined {
    const row = this.#one<MemoryRecordRow>(
      'SELECT * FROM memory_records WHERE memory_id = ?',
      [memoryId],
    );
    return row === undefined ? undefined : toMemoryRecord(row);
  }

  #findMemoryIdByIdentity(record: MemoryRecord): string | undefined {
    const row = this.#one<{ readonly memory_id: string }>(
      `SELECT memory_id FROM memory_records
       WHERE namespace = ? AND entity_id = ? AND identity_key = ?`,
      [record.namespace, record.entityId, record.identityKey],
    );
    return row?.memory_id;
  }

  #findStateHead(namespace: string, entityId: string): StateHead | undefined {
    const row = this.#one<{
      readonly revision: number;
      readonly value_hash: string;
    }>(
      'SELECT revision, value_hash FROM state_heads WHERE namespace = ? AND entity_id = ?',
      [namespace, entityId],
    );
    return row === undefined
      ? undefined
      : { revision: row.revision, valueHash: row.value_hash };
  }

  #findStateSnapshot(
    namespace: string,
    entityId: string,
    revision: number,
  ): StateSnapshot<JsonValue> | undefined {
    const row = this.#one<StateSnapshotRow>(
      `SELECT * FROM state_snapshots
       WHERE namespace = ? AND entity_id = ? AND revision = ?`,
      [namespace, entityId, revision],
    );
    return row === undefined ? undefined : toStateSnapshot(row);
  }

  #findCommitted(executionId: string): CommittedExecution | undefined {
    const row = this.#one<{
      readonly execution_id: string;
      readonly operation_digest: string;
      readonly revision: number;
      readonly document_keys_json: string;
      readonly event_ids_json: string;
    }>('SELECT * FROM execution_commits WHERE execution_id = ?', [executionId]);
    return row === undefined
      ? undefined
      : {
          executionId: row.execution_id,
          revision: row.revision,
          documentKeys: JSON.parse(row.document_keys_json) as string[],
          eventIds: JSON.parse(row.event_ids_json) as string[],
          operationDigest: row.operation_digest,
        };
  }

  #findPreparedCommit(executionId: string): PreparedCommit | undefined {
    const row = this.#one<{ readonly prepared_commit_json: string }>(
      'SELECT prepared_commit_json FROM execution_commits WHERE execution_id = ?',
      [executionId],
    );
    return row === undefined
      ? undefined
      : (JSON.parse(row.prepared_commit_json) as PreparedCommit);
  }

  #hasDocumentKey(executionId: string, key: string): boolean {
    return (
      this.#one<{ readonly document_id: string }>(
        'SELECT document_id FROM documents WHERE execution_id = ? AND document_key = ?',
        [executionId, key],
      ) !== undefined
    );
  }

  #hasEventKey(executionId: string, key: string): boolean {
    return (
      this.#one<{ readonly event_id: string }>(
        'SELECT event_id FROM domain_events WHERE execution_id = ? AND event_key = ?',
        [executionId, key],
      ) !== undefined
    );
  }

  #nextId(kind: 'document' | 'event'): string {
    let id: string;
    try {
      id = this.#ids.next(kind);
    } catch (cause) {
      throw new AcmeError(
        {
          code: 'INTERNAL',
          message: `ID generator failed for ${kind}.`,
          stage: 'preparing-commit',
          retryable: false,
        },
        { cause },
      );
    }
    requireText(id, `${kind} ID`);
    return id;
  }

  #json(value: unknown): string {
    return this.#hashing.canonicalJson(value as JsonValue);
  }

  #clone<T>(value: T): T {
    return deepFreeze(JSON.parse(this.#json(value)) as T);
  }

  #equivalent(left: unknown, right: unknown): boolean {
    return this.#json(left) === this.#json(right);
  }

  #statement(sql: string): Statement {
    const cached = this.#statements.get(sql);
    if (cached !== undefined) {
      return cached;
    }
    const prepared = this.#database.prepare(sql);
    this.#statements.set(sql, prepared);
    return prepared;
  }

  #one<TRow>(sql: string, params: readonly SqlValue[] = []): TRow | undefined {
    return this.#statement(sql).get(...params) as TRow | undefined;
  }

  #all<TRow>(sql: string, params: readonly SqlValue[] = []): TRow[] {
    return this.#statement(sql).all(...params) as TRow[];
  }

  #run(sql: string, params: readonly SqlValue[] = []): void {
    this.#statement(sql).run(...params);
  }

  #immediate<T>(work: () => T): T {
    return this.#database.transaction(work).immediate();
  }
}

export function createSqliteExecutionRepository(
  options: SqliteExecutionRepositoryOptions,
): SqliteExecutionRepository {
  return new SqliteExecutionRepository(options);
}
