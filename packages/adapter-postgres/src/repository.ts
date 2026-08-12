import {
  AcmeError,
  applyModelCallRetention,
  computeOperationDigest,
  nodeHashing,
  revealModelCallResponse,
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
  type ExecutionResumeState,
  type LeasedOutboxEntry,
  type DeliveredOutboxEntry,
  type FailedOutboxEntry,
  type OutboxLease,
  type OutboxQuery,
  type FailedModelCall,
  type Hashing,
  type IdGenerator,
  type JsonValue,
  type MemoryRecord,
  type ModelCallRecord,
  type ModelCallReservation,
  type NonCommitTerminalRecord,
  type OutboxRecord,
  type PayloadEncryptor,
  type PreparedCommit,
  type RepositoryEvidence,
  type StateSnapshot,
  type StateTransition,
  type StoredDocument,
  type StoredEvaluatorRun,
  type StoredMemoryCandidate,
} from '@acme/core';
import type { Pool, PoolClient } from 'pg';

import {
  throwMappedPostgresDriverError,
  withPostgresDriverErrors,
} from './driver-errors.js';
import { assertSchemaName, qIdent } from './schema.js';
import {
  execute,
  queryAll,
  queryOne,
  withRepeatableReadTransaction,
  withWriteTransaction,
  type Queryable,
} from './transaction.js';
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
  type StateSnapshotRow,
  type StateTransitionRow,
} from './rows.js';

export interface PostgresExecutionRepositoryOptions {
  readonly pool: Pool;
  readonly ids: IdGenerator;
  readonly hashing?: Hashing;
  /**
   * Required only when an execution uses `retention: 'encrypted-payload'`.
   * Missing encryptor fails at completeModelCall, not at construction.
   */
  readonly payloadEncryptor?: PayloadEncryptor;
  /** Fully-qualified schema name; default `acme`. */
  readonly schema?: string;
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

function requireLimit(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    invalid('limit must be a positive safe integer.');
  }
}

function assertClaimedOutbox(record: OutboxRecord): void {
  if (record.status !== 'claimed') {
    invalid('Outbox entry is not claimed.', {
      eventId: record.eventId,
      status: record.status,
    });
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

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

/**
 * Durable `ExecutionRepository` backed by PostgreSQL. Observable behavior
 * matches `@acme/adapter-sqlite` / `@acme/adapter-memory`; the shared
 * conformance suite is authoritative. ADR-0033 fixes concurrency mechanisms.
 */
export class PostgresExecutionRepository implements ExecutionRepository {
  readonly #pool: Pool;
  readonly #ids: IdGenerator;
  readonly #hashing: Hashing;
  readonly #payloadEncryptor: PayloadEncryptor | undefined;
  readonly #schema: string;
  readonly #s: string;

  constructor(options: PostgresExecutionRepositoryOptions) {
    this.#pool = options.pool;
    this.#ids = options.ids;
    this.#hashing = options.hashing ?? nodeHashing;
    this.#payloadEncryptor = options.payloadEncryptor;
    this.#schema = assertSchemaName(options.schema ?? 'acme');
    this.#s = qIdent(this.#schema);
  }

  get schema(): string {
    return this.#schema;
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

    return this.#write(async (client): Promise<AcceptResult> => {
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

      let rowCount: number;
      try {
        rowCount = await execute(
          client,
          `INSERT INTO ${this.#s}.executions (
            execution_id, namespace, request_key, request_fingerprint, task,
            entity_id, expected_revision, input_json, input_hash, request_json,
            policy_json, contract_id, contract_version, contract_fingerprint,
            status, current_stage, result_json, error_json, created_at,
            updated_at, terminal_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
          ON CONFLICT (namespace, request_key) DO NOTHING`,
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
      } catch (error) {
        if (isUniqueViolation(error)) {
          // execution_id primary key collision with a different request.
          corruption('Execution ID was reused for a different request.', {
            executionId: accepted.executionId,
          });
        }
        throw error;
      }

      if (rowCount === 0) {
        const existing = await this.#findByRequestKey(
          client,
          accepted.request.namespace,
          accepted.request.requestKey,
        );
        if (existing === undefined) {
          corruption('Idempotent accept found no row after conflict.', {
            requestKey: accepted.request.requestKey,
          });
        }
        if (existing.requestFingerprint !== accepted.requestFingerprint) {
          return this.#clone({
            kind: 'conflict',
            existingExecutionId: existing.executionId,
          });
        }
        return this.#clone({ kind: 'existing', execution: existing });
      }

      const byId = await this.#findExecution(client, accepted.executionId);
      if (byId === undefined) {
        corruption('Accept insert reported success but row is missing.', {
          executionId: accepted.executionId,
        });
      }
      return this.#clone({ kind: 'created', execution: record });
    });
  }

  async get(executionId: string): Promise<ExecutionRecord | null> {
    const record = await this.#findExecution(this.#pool, executionId);
    return record === undefined ? null : this.#clone(record);
  }

  async appendAttempt(input: ExecutionAttempt): Promise<void> {
    const attempt = this.#clone(input);
    requireRevision(attempt.attemptNumber, 'attemptNumber');
    if (attempt.attemptNumber === 0) {
      invalid('attemptNumber must be greater than zero.');
    }

    await this.#write(async (client) => {
      const execution = await this.#requireExecution(
        client,
        attempt.executionId,
      );
      assertMutableExecution(execution);
      const existing = await this.#findAttempt(
        client,
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
      await execute(
        client,
        `INSERT INTO ${this.#s}.execution_attempts (
          execution_id, attempt_number, stage, outcome, retry_at,
          diagnostic_json, occurred_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
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
      await execute(
        client,
        `UPDATE ${this.#s}.executions
         SET status = $1, current_stage = $2, updated_at = $3
         WHERE execution_id = $4`,
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

    return this.#write(async (client): Promise<ModelCallRecord> => {
      const execution = await this.#requireExecution(
        client,
        reservation.executionId,
      );
      assertMutableExecution(execution);
      const existing = await this.#findModelCallByKey(
        client,
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
      if (
        (await this.#findModelCall(client, reservation.modelCallId)) !==
        undefined
      ) {
        corruption('Model-call ID was reused.', {
          modelCallId: reservation.modelCallId,
        });
      }

      const record: ModelCallRecord = this.#clone({
        ...reservation,
        status: 'reserved',
      });
      await execute(
        client,
        `INSERT INTO ${this.#s}.model_calls (
          model_call_id, execution_id, call_key, attempt, purpose, provider,
          model, selection_json, request_hash, request_payload, response_hash,
          response_payload, provider_response_id, usage_json, record_json,
          status, error_json, started_at, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
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

    await this.#write(async (client) => {
      const existing = await this.#findModelCall(client, completed.modelCallId);
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
          completedAt: existing.completedAt,
        };
        const expected: CompletedModelCall = {
          modelCallId: completed.modelCallId,
          response: completed.response,
          responseHash: completed.responseHash,
          completedAt: completed.completedAt,
        };
        if (!this.#equivalent(prior, expected)) {
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
      const execution = await this.#requireExecution(
        client,
        existing.executionId,
      );
      const retained = applyModelCallRetention({
        retention: execution.policy.retention,
        completed,
        ...(this.#payloadEncryptor === undefined
          ? {}
          : { payloadEncryptor: this.#payloadEncryptor }),
      });
      const record: ModelCallRecord = this.#clone({
        ...existing,
        status: 'succeeded',
        ...retained,
        completedAt: completed.completedAt,
      });
      await this.#writeModelCall(client, record);
    });
  }

  async failModelCall(input: FailedModelCall): Promise<void> {
    const failed = this.#clone(input);

    await this.#write(async (client) => {
      const existing = await this.#findModelCall(client, failed.modelCallId);
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
      await this.#writeModelCall(client, record);
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

    return this.#read(async (client) => {
      const head = await this.#findStateHead(
        client,
        query.namespace,
        query.entityId,
      );
      const actualRevision = head?.revision ?? 0;
      if (actualRevision !== query.expectedRevision) {
        stateConflict(query.expectedRevision, actualRevision);
      }
      const state =
        actualRevision === 0
          ? null
          : ((await this.#findStateSnapshot(
              client,
              query.namespace,
              query.entityId,
              actualRevision,
            )) ??
            corruption('State head references a missing snapshot.', {
              namespace: query.namespace,
              entityId: query.entityId,
            }));

      const allowedMemoryKinds =
        query.memory.kinds === undefined ? null : new Set(query.memory.kinds);
      const memoryRows = await queryAll<MemoryRecordRow>(
        client,
        `SELECT * FROM ${this.#s}.memory_records
         WHERE namespace = $1 AND entity_id = $2
           AND status NOT IN ('forgotten', 'superseded')
         ORDER BY identity_key, memory_id`,
        [query.namespace, query.entityId],
      );
      const memories = memoryRows
        .map(toMemoryRecord)
        .filter(
          (record) =>
            allowedMemoryKinds === null || allowedMemoryKinds.has(record.kind),
        );

      const allowedDocumentKinds =
        query.documentKinds === undefined ? null : new Set(query.documentKinds);
      const documentRows = await queryAll<DocumentRow>(
        client,
        `SELECT * FROM ${this.#s}.documents
         WHERE namespace = $1 AND entity_id = $2
         ORDER BY document_key, document_id`,
        [query.namespace, query.entityId],
      );
      const documents = documentRows
        .map(toStoredDocument)
        .filter(
          (document) =>
            allowedDocumentKinds === null ||
            allowedDocumentKinds.has(document.kind),
        );

      return this.#clone({ state, memories, documents });
    });
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

    return this.#write(async (client): Promise<CommittedExecution> => {
      const execution = await this.#requireExecution(
        client,
        prepared.executionId,
      );
      const priorCommit = await this.#findCommitted(
        client,
        prepared.executionId,
      );
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
      const head = await this.#findStateHead(client, namespace, entityId);
      const actualRevision = head?.revision ?? 0;
      if (actualRevision !== prepared.expectedRevision) {
        stateConflict(prepared.expectedRevision, actualRevision);
      }

      assertUniqueKeys(prepared.documents, 'document');
      assertUniqueKeys(prepared.memoryCandidates, 'memory candidate');
      assertUniqueKeys(prepared.events, 'event');
      this.#validateEvidence(prepared);
      this.#validateReplayEvidence(prepared, execution);
      await this.#validateState(client, prepared, execution, head);

      await this.#applyMemory(client, prepared, execution);

      // Reserve the state head with CAS before other effects so concurrent
      // writers lose with CONFLICT_STATE_REVISION and roll back cleanly under
      // READ COMMITTED (ADR-0033 section 4). Snapshot/transition follow.
      if (prepared.state !== null) {
        const { snapshot } = prepared.state;
        await this.#casStateHead(
          client,
          namespace,
          entityId,
          prepared.expectedRevision,
          snapshot.revision,
          snapshot.valueHash,
        );
      }

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
        if (
          await this.#hasDocumentKey(
            client,
            prepared.executionId,
            candidate.key,
          )
        ) {
          corruption('Document key was already persisted.', {
            key: candidate.key,
          });
        }
        const documentId = this.#nextId('document');
        if (
          (await queryOne<DocumentRow>(
            client,
            `SELECT * FROM ${this.#s}.documents WHERE document_id = $1`,
            [documentId],
          )) !== undefined
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
        await execute(
          client,
          `INSERT INTO ${this.#s}.documents (
            document_id, execution_id, namespace, entity_id, document_key,
            kind, schema_version, value_json, content_hash, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
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
        if (
          await this.#hasEventKey(client, prepared.executionId, candidate.key)
        ) {
          corruption('Event key was already persisted.', {
            key: candidate.key,
          });
        }
        const eventId = this.#nextId('event');
        if (
          (await queryOne<DomainEventRow>(
            client,
            `SELECT * FROM ${this.#s}.domain_events WHERE event_id = $1`,
            [eventId],
          )) !== undefined
        ) {
          corruption('Generated event ID collided with persisted data.', {
            eventId,
          });
        }
        eventIds.push(eventId);
        await execute(
          client,
          `INSERT INTO ${this.#s}.domain_events (
            event_id, execution_id, event_key, namespace, entity_id, type,
            schema_version, payload_json, occurred_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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
        await execute(
          client,
          `INSERT INTO ${this.#s}.outbox (
            event_id, status, attempt_count, available_at, claimed_at,
            delivered_at, last_error_json
          ) VALUES ($1, 'pending', 0, $2, NULL, NULL, NULL)`,
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
        await execute(
          client,
          `INSERT INTO ${this.#s}.memory_candidates (
            execution_id, candidate_key, kind, schema_version, value_json,
            candidate_json, decision_json, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
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
        await execute(
          client,
          `INSERT INTO ${this.#s}.evaluator_runs (
            evaluator_run_id, execution_id, evaluator_id, evaluator_version,
            attempt, subject_hash, decision_json, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
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
        await execute(
          client,
          `INSERT INTO ${this.#s}.state_snapshots (
            namespace, entity_id, revision, schema_version, value_json,
            value_hash, execution_id, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
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
        await execute(
          client,
          `INSERT INTO ${this.#s}.state_transitions (
            transition_id, operation_key, namespace, entity_id, from_revision,
            to_revision, delta_schema_version, delta_json, previous_hash,
            next_hash, execution_id, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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
      await execute(
        client,
        `INSERT INTO ${this.#s}.execution_commits (
          execution_id, operation_digest, revision, document_keys_json,
          event_ids_json, prepared_commit_json, committed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
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
      await execute(
        client,
        `UPDATE ${this.#s}.executions
         SET status = 'committed', current_stage = 'committed',
             result_json = $1, updated_at = $2, terminal_at = $3
         WHERE execution_id = $4`,
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
    return this.#read(async (client) => {
      const execution = await this.#findExecution(client, executionId);
      const prepared = await this.#findPreparedCommit(client, executionId);
      if (
        execution === undefined ||
        prepared === undefined ||
        prepared.replayEvidence === undefined
      ) {
        return null;
      }
      const modelCalls = (
        await queryAll<{ readonly record_json: string }>(
          client,
          `SELECT record_json FROM ${this.#s}.model_calls
           WHERE execution_id = $1
           ORDER BY call_key, attempt`,
          [executionId],
        )
      ).map((row) => this.#revealCall(toModelCallRecord(row.record_json)));
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
    });
  }

  async loadResumeState(
    executionId: string,
  ): Promise<ExecutionResumeState | null> {
    return this.#read(async (client) => {
      const execution = await this.#findExecution(client, executionId);
      if (execution === undefined) {
        return null;
      }
      const highest = await queryOne<{ readonly last_attempt: number | null }>(
        client,
        `SELECT MAX(attempt_number) AS last_attempt
         FROM ${this.#s}.execution_attempts
         WHERE execution_id = $1`,
        [executionId],
      );
      const modelCalls = (
        await queryAll<{ readonly record_json: string }>(
          client,
          `SELECT record_json FROM ${this.#s}.model_calls
           WHERE execution_id = $1
           ORDER BY call_key, attempt`,
          [executionId],
        )
      ).map((row) => this.#revealCall(toModelCallRecord(row.record_json)));
      return this.#clone({
        executionId,
        lastAttemptNumber: highest?.last_attempt ?? 0,
        modelCalls,
      });
    });
  }

  #revealCall(call: ModelCallRecord): ModelCallRecord {
    const response = revealModelCallResponse({
      call,
      ...(this.#payloadEncryptor === undefined
        ? {}
        : { payloadEncryptor: this.#payloadEncryptor }),
    });
    if (response === undefined) {
      return call;
    }
    return { ...call, response };
  }

  async leaseOutbox(claim: OutboxLease): Promise<readonly LeasedOutboxEntry[]> {
    requireLimit(claim.limit);
    return this.#write(
      async (client): Promise<readonly LeasedOutboxEntry[]> => {
        // Atomic FOR UPDATE SKIP LOCKED lease (ADR-0033 section 5).
        // Claim order is domain_events.occurred_at then event_id (ADR-0018).
        const claimed = await queryAll<{ readonly event_id: string }>(
          client,
          `UPDATE ${this.#s}.outbox AS o
           SET status = 'claimed',
               attempt_count = o.attempt_count + 1,
               available_at = $2,
               claimed_at = $3
         WHERE o.event_id IN (
           SELECT outbox.event_id
             FROM ${this.#s}.outbox
             JOIN ${this.#s}.domain_events
               ON domain_events.event_id = outbox.event_id
            WHERE outbox.status IN ('pending', 'claimed')
              AND outbox.available_at <= $1
            ORDER BY domain_events.occurred_at, outbox.event_id
              FOR UPDATE OF outbox SKIP LOCKED
            LIMIT $4
         )
         RETURNING event_id`,
          [claim.now, claim.leaseExpiresAt, claim.now, claim.limit],
        );

        if (claimed.length === 0) {
          return Object.freeze([]);
        }

        const ids = claimed.map((row) => row.event_id);
        const rows = await queryAll<OutboxRow & DomainEventRow>(
          client,
          `SELECT o.event_id, o.status, o.attempt_count, o.available_at,
                o.claimed_at, o.delivered_at, o.last_error_json,
                d.execution_id, d.event_key, d.namespace, d.entity_id,
                d.type, d.schema_version, d.payload_json, d.occurred_at
           FROM ${this.#s}.outbox o
           JOIN ${this.#s}.domain_events d ON d.event_id = o.event_id
          WHERE o.event_id = ANY($1::text[])
          ORDER BY d.occurred_at, o.event_id`,
          [ids],
        );

        return this.#clone(
          rows.map((row) => ({
            record: toOutboxRecord(row),
            event: toDomainEventRecord(row),
          })),
        );
      },
    );
  }

  async markOutboxDelivered(entry: DeliveredOutboxEntry): Promise<void> {
    requireText(entry.eventId, 'eventId');
    await this.#write(async (client) => {
      const record = await this.#requireOutbox(client, entry.eventId);
      if (record.status === 'delivered') {
        return;
      }
      assertClaimedOutbox(record);
      await execute(
        client,
        `UPDATE ${this.#s}.outbox
           SET status = 'delivered', delivered_at = $1, last_error_json = NULL
         WHERE event_id = $2`,
        [entry.deliveredAt, entry.eventId],
      );
    });
  }

  async markOutboxFailed(entry: FailedOutboxEntry): Promise<void> {
    requireText(entry.eventId, 'eventId');
    await this.#write(async (client) => {
      const record = await this.#requireOutbox(client, entry.eventId);
      if (record.status === 'delivered') {
        corruption('A delivered outbox entry cannot fail.', {
          eventId: entry.eventId,
        });
      }
      if (record.status === 'failed' && entry.retryAt === undefined) {
        return;
      }
      assertClaimedOutbox(record);
      await execute(
        client,
        `UPDATE ${this.#s}.outbox
           SET status = $1, available_at = $2, last_error_json = $3
         WHERE event_id = $4`,
        [
          entry.retryAt === undefined ? 'failed' : 'pending',
          entry.retryAt ?? entry.failedAt,
          this.#json(entry.error),
          entry.eventId,
        ],
      );
    });
  }

  async redriveOutbox(entry: {
    readonly eventId: string;
    readonly availableAt: string;
  }): Promise<void> {
    requireText(entry.eventId, 'eventId');
    await this.#write(async (client) => {
      const record = await this.#requireOutbox(client, entry.eventId);
      if (record.status === 'delivered') {
        corruption('A delivered outbox entry cannot be redriven.', {
          eventId: entry.eventId,
        });
      }
      if (record.status !== 'failed') {
        invalid('Only failed outbox entries can be redriven.', {
          eventId: entry.eventId,
          status: record.status,
        });
      }
      await execute(
        client,
        `UPDATE ${this.#s}.outbox
           SET status = 'pending', available_at = $1, claimed_at = NULL,
               delivered_at = NULL
         WHERE event_id = $2`,
        [entry.availableAt, entry.eventId],
      );
    });
  }

  async listOutbox(query: OutboxQuery): Promise<readonly LeasedOutboxEntry[]> {
    requireLimit(query.limit);
    const rows =
      query.status === undefined
        ? await this.#outboxRows(this.#pool, '', [], query.limit)
        : await this.#outboxRows(
            this.#pool,
            'WHERE o.status = $1',
            [query.status],
            query.limit,
          );
    return this.#clone(rows);
  }

  async #outboxRows(
    client: Queryable,
    where: string,
    params: readonly unknown[],
    limit: number,
  ): Promise<readonly LeasedOutboxEntry[]> {
    const limitParam = params.length + 1;
    const rows = await queryAll<OutboxRow & DomainEventRow>(
      client,
      `SELECT o.event_id, o.status, o.attempt_count, o.available_at,
              o.claimed_at, o.delivered_at, o.last_error_json,
              d.execution_id, d.event_key, d.namespace, d.entity_id,
              d.type, d.schema_version, d.payload_json, d.occurred_at
         FROM ${this.#s}.outbox o
         JOIN ${this.#s}.domain_events d ON d.event_id = o.event_id
         ${where}
        ORDER BY d.occurred_at, o.event_id
        LIMIT $${limitParam}`,
      [...params, limit],
    );
    return rows.map((row) => ({
      record: toOutboxRecord(row),
      event: toDomainEventRecord(row),
    }));
  }

  async #requireOutbox(
    client: Queryable,
    eventId: string,
  ): Promise<OutboxRecord> {
    const row = await queryOne<OutboxRow>(
      client,
      `SELECT * FROM ${this.#s}.outbox WHERE event_id = $1`,
      [eventId],
    );
    if (row === undefined) {
      invalid('Unknown outbox entry.', { eventId });
    }
    return toOutboxRecord(row);
  }

  async markTerminal(input: NonCommitTerminalRecord): Promise<void> {
    const terminal = this.#clone(input);

    await this.#write(async (client) => {
      const execution = await this.#requireExecution(
        client,
        terminal.executionId,
      );
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
      await execute(
        client,
        `UPDATE ${this.#s}.executions
         SET status = $1, current_stage = $2, result_json = $3, error_json = $4,
             updated_at = $5, terminal_at = $6
         WHERE execution_id = $7`,
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
  async snapshot(): Promise<RepositoryEvidence> {
    return this.#read(async (client) => {
      const executions = (
        await queryAll<ExecutionRow>(
          client,
          `SELECT * FROM ${this.#s}.executions ORDER BY execution_id`,
        )
      ).map(toExecutionRecord);
      const attempts = (
        await queryAll<AttemptRow>(
          client,
          `SELECT * FROM ${this.#s}.execution_attempts
           ORDER BY execution_id, attempt_number, stage`,
        )
      ).map(toExecutionAttempt);
      const modelCalls = (
        await queryAll<{ readonly record_json: string }>(
          client,
          `SELECT record_json FROM ${this.#s}.model_calls
           ORDER BY execution_id, call_key, attempt`,
        )
      ).map((row) => toModelCallRecord(row.record_json));
      const documents = (
        await queryAll<DocumentRow>(
          client,
          `SELECT * FROM ${this.#s}.documents ORDER BY execution_id, document_key`,
        )
      ).map(toStoredDocument);
      const memoryCandidates = (
        await queryAll<{
          readonly execution_id: string;
          readonly candidate_json: string;
          readonly decision_json: string;
          readonly created_at: string;
        }>(
          client,
          `SELECT execution_id, candidate_json, decision_json, created_at
           FROM ${this.#s}.memory_candidates ORDER BY execution_id, candidate_key`,
        )
      ).map((row): StoredMemoryCandidate => ({
        executionId: row.execution_id,
        candidate: JSON.parse(row.candidate_json) as never,
        decision: JSON.parse(row.decision_json) as never,
        createdAt: row.created_at,
      }));
      const memoryRecords = (
        await queryAll<MemoryRecordRow>(
          client,
          `SELECT * FROM ${this.#s}.memory_records
           ORDER BY namespace, entity_id, identity_key, memory_id`,
        )
      ).map(toMemoryRecord);
      const snapshots: readonly StateSnapshot<JsonValue>[] = (
        await queryAll<StateSnapshotRow>(
          client,
          `SELECT * FROM ${this.#s}.state_snapshots
           ORDER BY namespace, entity_id, revision`,
        )
      ).map(toStateSnapshot);
      const transitions: readonly StateTransition<JsonValue>[] = (
        await queryAll<StateTransitionRow>(
          client,
          `SELECT * FROM ${this.#s}.state_transitions
           ORDER BY namespace, entity_id, to_revision`,
        )
      ).map(toStateTransition);
      const evaluatorRuns = (
        await queryAll<{
          readonly execution_id: string;
          readonly evaluator_id: string;
          readonly evaluator_version: string;
          readonly attempt: number;
          readonly subject_hash: string;
          readonly decision_json: string;
          readonly created_at: string;
        }>(
          client,
          `SELECT * FROM ${this.#s}.evaluator_runs
           ORDER BY execution_id, evaluator_id, attempt`,
        )
      ).map((row): StoredEvaluatorRun => ({
        executionId: row.execution_id,
        evaluatorId: row.evaluator_id,
        evaluatorVersion: row.evaluator_version,
        attempt: Number(row.attempt),
        subjectHash: row.subject_hash,
        decision: JSON.parse(row.decision_json) as never,
        createdAt: row.created_at,
      }));
      const events: readonly DomainEventRecord[] = (
        await queryAll<DomainEventRow>(
          client,
          `SELECT * FROM ${this.#s}.domain_events
           ORDER BY execution_id, event_key`,
        )
      ).map(toDomainEventRecord);
      const outbox: readonly OutboxRecord[] = (
        await queryAll<OutboxRow>(
          client,
          `SELECT * FROM ${this.#s}.outbox ORDER BY event_id`,
        )
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

  async #validateState(
    client: Queryable,
    prepared: PreparedCommit,
    execution: ExecutionRecord,
    head: StateHead | undefined,
  ): Promise<void> {
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
      (await queryOne<StateTransitionRow>(
        client,
        `SELECT * FROM ${this.#s}.state_transitions WHERE transition_id = $1`,
        [transition.transitionId],
      )) !== undefined
    ) {
      corruption('Transition ID collides with persisted state.', {
        transitionId: transition.transitionId,
      });
    }
    if (
      (await queryOne<StateTransitionRow>(
        client,
        `SELECT * FROM ${this.#s}.state_transitions
         WHERE namespace = $1 AND entity_id = $2 AND operation_key = $3`,
        [
          execution.request.namespace,
          execution.request.entityId,
          transition.operationKey,
        ],
      )) !== undefined
    ) {
      corruption('Operation key collides with persisted state.', {
        operationKey: transition.operationKey,
      });
    }
  }

  async #casStateHead(
    client: Queryable,
    namespace: string,
    entityId: string,
    expectedRevision: number,
    nextRevision: number,
    valueHash: string,
  ): Promise<void> {
    if (expectedRevision === 0) {
      try {
        const rowCount = await execute(
          client,
          `INSERT INTO ${this.#s}.state_heads (namespace, entity_id, revision, value_hash)
           VALUES ($1, $2, $3, $4)`,
          [namespace, entityId, nextRevision, valueHash],
        );
        if (rowCount === 0) {
          stateConflict(expectedRevision, nextRevision);
        }
      } catch (error) {
        // A unique violation aborts the PostgreSQL transaction; do not query
        // again on this client. Report the domain conflict immediately.
        if (isUniqueViolation(error)) {
          stateConflict(expectedRevision, nextRevision);
        }
        throw error;
      }
      return;
    }

    const rowCount = await execute(
      client,
      `UPDATE ${this.#s}.state_heads
          SET revision = $3, value_hash = $4
        WHERE namespace = $1 AND entity_id = $2 AND revision = $5`,
      [namespace, entityId, nextRevision, valueHash, expectedRevision],
    );
    if (rowCount === 0) {
      // Prefer not to issue another statement if the transaction is still open
      // and healthy; rowCount 0 is already the CAS verdict.
      stateConflict(expectedRevision, expectedRevision);
    }
  }

  async #applyMemory(
    client: Queryable,
    prepared: PreparedCommit,
    execution: ExecutionRecord,
  ): Promise<void> {
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
          (await this.#findMemoryRecord(client, record.memoryId)) !==
            undefined ||
          (await this.#findMemoryIdByIdentity(client, record)) !== undefined
        ) {
          corruption('Created memory identity collides with persisted data.', {
            memoryId: record.memoryId,
            identityKey: record.identityKey,
          });
        }
        await this.#writeMemoryRecord(client, record, 'insert');
        continue;
      }

      const existing = await this.#findMemoryRecord(client, record.memoryId);
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
      if (
        (await this.#findMemoryIdByIdentity(client, record)) !== record.memoryId
      ) {
        corruption('Memory identity index is inconsistent.', {
          memoryId: record.memoryId,
        });
      }
      await this.#writeMemoryRecord(
        client,
        record,
        'update',
        mutation.expectedRecordVersion,
      );
    }
  }

  async #writeMemoryRecord(
    client: Queryable,
    record: MemoryRecord,
    mode: 'insert' | 'update',
    expectedRecordVersion?: number,
  ): Promise<void> {
    const values: readonly unknown[] = [
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
      await execute(
        client,
        `INSERT INTO ${this.#s}.memory_records (
          memory_id, namespace, entity_id, identity_key, kind, schema_version,
          value_json, strength, status, record_version, first_seen_at,
          last_seen_at, last_reinforced_at, provenance_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [record.memoryId, ...values],
      );
      return;
    }
    const expected = expectedRecordVersion;
    if (expected === undefined) {
      corruption('Memory update missing expected record version.', {
        memoryId: record.memoryId,
      });
    }
    const rowCount = await execute(
      client,
      `UPDATE ${this.#s}.memory_records
       SET namespace = $1, entity_id = $2, identity_key = $3, kind = $4,
           schema_version = $5, value_json = $6, strength = $7, status = $8,
           record_version = $9, first_seen_at = $10, last_seen_at = $11,
           last_reinforced_at = $12, provenance_json = $13
       WHERE memory_id = $14 AND record_version = $15`,
      [...values, record.memoryId, expected],
    );
    if (rowCount === 0) {
      // CAS miss: do not follow up with another statement if another writer
      // already invalidated this transaction's assumptions.
      memoryConflict(record.memoryId, expected, expected);
    }
  }

  async #writeModelCall(
    client: Queryable,
    record: ModelCallRecord,
  ): Promise<void> {
    await execute(
      client,
      `UPDATE ${this.#s}.model_calls
       SET provider = $1, model = $2, response_hash = $3, response_payload = $4,
           provider_response_id = $5, usage_json = $6, record_json = $7,
           status = $8, error_json = $9, completed_at = $10
       WHERE model_call_id = $11`,
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

  async #findByRequestKey(
    client: Queryable,
    namespace: string,
    requestKey: string,
  ): Promise<ExecutionRecord | undefined> {
    const row = await queryOne<ExecutionRow>(
      client,
      `SELECT * FROM ${this.#s}.executions WHERE namespace = $1 AND request_key = $2`,
      [namespace, requestKey],
    );
    return row === undefined ? undefined : toExecutionRecord(row);
  }

  async #findExecution(
    client: Queryable,
    executionId: string,
  ): Promise<ExecutionRecord | undefined> {
    const row = await queryOne<ExecutionRow>(
      client,
      `SELECT * FROM ${this.#s}.executions WHERE execution_id = $1`,
      [executionId],
    );
    return row === undefined ? undefined : toExecutionRecord(row);
  }

  async #requireExecution(
    client: Queryable,
    executionId: string,
  ): Promise<ExecutionRecord> {
    const execution = await this.#findExecution(client, executionId);
    if (execution === undefined) {
      invalid('Execution does not exist.', { executionId });
    }
    return execution;
  }

  async #findAttempt(
    client: Queryable,
    executionId: string,
    attemptNumber: number,
    stage: string,
  ): Promise<ExecutionAttempt | undefined> {
    const row = await queryOne<AttemptRow>(
      client,
      `SELECT * FROM ${this.#s}.execution_attempts
       WHERE execution_id = $1 AND attempt_number = $2 AND stage = $3`,
      [executionId, attemptNumber, stage],
    );
    return row === undefined ? undefined : toExecutionAttempt(row);
  }

  async #findModelCall(
    client: Queryable,
    modelCallId: string,
  ): Promise<ModelCallRecord | undefined> {
    const row = await queryOne<{ readonly record_json: string }>(
      client,
      `SELECT record_json FROM ${this.#s}.model_calls WHERE model_call_id = $1`,
      [modelCallId],
    );
    return row === undefined ? undefined : toModelCallRecord(row.record_json);
  }

  async #findModelCallByKey(
    client: Queryable,
    executionId: string,
    callKey: string,
    attempt: number,
  ): Promise<ModelCallRecord | undefined> {
    const row = await queryOne<{ readonly record_json: string }>(
      client,
      `SELECT record_json FROM ${this.#s}.model_calls
       WHERE execution_id = $1 AND call_key = $2 AND attempt = $3`,
      [executionId, callKey, attempt],
    );
    return row === undefined ? undefined : toModelCallRecord(row.record_json);
  }

  async #findMemoryRecord(
    client: Queryable,
    memoryId: string,
  ): Promise<MemoryRecord | undefined> {
    const row = await queryOne<MemoryRecordRow>(
      client,
      `SELECT * FROM ${this.#s}.memory_records WHERE memory_id = $1`,
      [memoryId],
    );
    return row === undefined ? undefined : toMemoryRecord(row);
  }

  async #findMemoryIdByIdentity(
    client: Queryable,
    record: MemoryRecord,
  ): Promise<string | undefined> {
    const row = await queryOne<{ readonly memory_id: string }>(
      client,
      `SELECT memory_id FROM ${this.#s}.memory_records
       WHERE namespace = $1 AND entity_id = $2 AND identity_key = $3`,
      [record.namespace, record.entityId, record.identityKey],
    );
    return row?.memory_id;
  }

  async #findStateHead(
    client: Queryable,
    namespace: string,
    entityId: string,
  ): Promise<StateHead | undefined> {
    const row = await queryOne<{
      readonly revision: number;
      readonly value_hash: string;
    }>(
      client,
      `SELECT revision, value_hash FROM ${this.#s}.state_heads
       WHERE namespace = $1 AND entity_id = $2`,
      [namespace, entityId],
    );
    return row === undefined
      ? undefined
      : { revision: Number(row.revision), valueHash: row.value_hash };
  }

  async #findStateSnapshot(
    client: Queryable,
    namespace: string,
    entityId: string,
    revision: number,
  ): Promise<StateSnapshot<JsonValue> | undefined> {
    const row = await queryOne<StateSnapshotRow>(
      client,
      `SELECT * FROM ${this.#s}.state_snapshots
       WHERE namespace = $1 AND entity_id = $2 AND revision = $3`,
      [namespace, entityId, revision],
    );
    return row === undefined ? undefined : toStateSnapshot(row);
  }

  async #findCommitted(
    client: Queryable,
    executionId: string,
  ): Promise<CommittedExecution | undefined> {
    const row = await queryOne<{
      readonly execution_id: string;
      readonly operation_digest: string;
      readonly revision: number;
      readonly document_keys_json: string;
      readonly event_ids_json: string;
    }>(
      client,
      `SELECT * FROM ${this.#s}.execution_commits WHERE execution_id = $1`,
      [executionId],
    );
    return row === undefined
      ? undefined
      : {
          executionId: row.execution_id,
          revision: Number(row.revision),
          documentKeys: JSON.parse(row.document_keys_json) as string[],
          eventIds: JSON.parse(row.event_ids_json) as string[],
          operationDigest: row.operation_digest,
        };
  }

  async #findPreparedCommit(
    client: Queryable,
    executionId: string,
  ): Promise<PreparedCommit | undefined> {
    const row = await queryOne<{ readonly prepared_commit_json: string }>(
      client,
      `SELECT prepared_commit_json FROM ${this.#s}.execution_commits
       WHERE execution_id = $1`,
      [executionId],
    );
    return row === undefined
      ? undefined
      : (JSON.parse(row.prepared_commit_json) as PreparedCommit);
  }

  async #hasDocumentKey(
    client: Queryable,
    executionId: string,
    key: string,
  ): Promise<boolean> {
    return (
      (await queryOne<{ readonly document_id: string }>(
        client,
        `SELECT document_id FROM ${this.#s}.documents
         WHERE execution_id = $1 AND document_key = $2`,
        [executionId, key],
      )) !== undefined
    );
  }

  async #hasEventKey(
    client: Queryable,
    executionId: string,
    key: string,
  ): Promise<boolean> {
    return (
      (await queryOne<{ readonly event_id: string }>(
        client,
        `SELECT event_id FROM ${this.#s}.domain_events
         WHERE execution_id = $1 AND event_key = $2`,
        [executionId, key],
      )) !== undefined
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

  async #write<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    try {
      return await withWriteTransaction(this.#pool, work);
    } catch (error) {
      throwMappedPostgresDriverError(error);
    }
  }

  async #read<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    try {
      return await withRepeatableReadTransaction(this.#pool, work);
    } catch (error) {
      throwMappedPostgresDriverError(error);
    }
  }
}

export function createPostgresExecutionRepository(
  options: PostgresExecutionRepositoryOptions,
): PostgresExecutionRepository {
  return new PostgresExecutionRepository(options);
}

/** Pool-backed single-statement helper used by quality store. */
export async function poolQueryOne<T extends Record<string, unknown>>(
  pool: Pool,
  text: string,
  values: readonly unknown[] = [],
): Promise<T | undefined> {
  return withPostgresDriverErrors(async () => queryOne<T>(pool, text, values));
}
