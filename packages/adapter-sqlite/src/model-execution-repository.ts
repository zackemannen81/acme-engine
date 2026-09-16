import {
  AcmeError,
  applyModelCallRetention,
  nodeHashing,
  revealModelCallResponse,
  type AcceptedModelExecution,
  type CompletedModelCall,
  type FailedModelCall,
  type Hashing,
  type JsonValue,
  type ModelCallRecord,
  type ModelCallReservation,
  type ModelExecutionAcceptResult,
  type ModelExecutionRecord,
  type ModelExecutionRepository,
  type ModelExecutionResumeState,
  type ModelExecutionTerminal,
  type PayloadEncryptor,
} from '@acme-engine/core';
import type { Database, Statement } from 'better-sqlite3';

import { withSqliteDriverErrors } from './driver-errors.js';
import type { SqlValue } from './rows.js';

export interface SqliteModelExecutionRepositoryOptions {
  readonly database: Database;
  readonly hashing?: Hashing;
  readonly payloadEncryptor?: PayloadEncryptor;
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

function requireText(value: string, field: string): void {
  if (value.trim().length === 0) {
    invalid(`${field} must be a non-empty string.`);
  }
}

function terminal(status: ModelExecutionRecord['status']): boolean {
  return (
    status === 'succeeded' ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'conflicted' ||
    status === 'ambiguous'
  );
}

export class SqliteModelExecutionRepository implements ModelExecutionRepository {
  readonly #database: Database;
  readonly #hashing: Hashing;
  readonly #payloadEncryptor: PayloadEncryptor | undefined;
  readonly #statements = new Map<string, Statement>();

  constructor(options: SqliteModelExecutionRepositoryOptions) {
    this.#database = options.database;
    this.#hashing = options.hashing ?? nodeHashing;
    this.#payloadEncryptor = options.payloadEncryptor;
  }

  async accept(
    input: AcceptedModelExecution,
  ): Promise<ModelExecutionAcceptResult> {
    const accepted = this.#clone(input);
    requireText(accepted.modelExecutionId, 'modelExecutionId');
    requireText(accepted.requestKey, 'requestKey');
    requireText(accepted.requestFingerprint, 'requestFingerprint');
    requireText(accepted.requestHash, 'requestHash');

    return this.#immediate(() => {
      const existing = this.#findByRequestKey(accepted.requestKey);
      if (existing !== undefined) {
        if (existing.requestFingerprint !== accepted.requestFingerprint) {
          return this.#clone({
            kind: 'conflict' as const,
            existingExecutionId: existing.modelExecutionId,
          });
        }
        return this.#clone({ kind: 'existing' as const, execution: existing });
      }
      if (this.#find(accepted.modelExecutionId) !== undefined) {
        corruption('Model execution ID was reused for a different request.', {
          modelExecutionId: accepted.modelExecutionId,
        });
      }
      const record: ModelExecutionRecord = this.#clone({
        modelExecutionId: accepted.modelExecutionId,
        requestKey: accepted.requestKey,
        requestFingerprint: accepted.requestFingerprint,
        requestHash: accepted.requestHash,
        selection: accepted.selection,
        request: accepted.request,
        requiredCapabilities: accepted.requiredCapabilities,
        policy: accepted.effectivePolicy,
        status: 'accepted',
        createdAt: accepted.createdAt,
        updatedAt: accepted.createdAt,
      });
      this.#writeExecution(record);
      return this.#clone({ kind: 'created' as const, execution: record });
    });
  }

  async get(modelExecutionId: string): Promise<ModelExecutionRecord | null> {
    const record = this.#find(modelExecutionId);
    return record === undefined ? null : this.#clone(record);
  }

  async reserveModelCall(
    input: ModelCallReservation,
  ): Promise<ModelCallRecord> {
    const reservation = this.#clone(input);
    requireText(reservation.modelCallId, 'modelCallId');
    return this.#immediate(() => {
      const execution = this.#require(reservation.executionId);
      if (terminal(execution.status)) {
        corruption('A terminal model execution cannot be mutated.', {
          modelExecutionId: execution.modelExecutionId,
          status: execution.status,
        });
      }
      const existing = this.#findCallByKey(
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
            modelExecutionId: reservation.executionId,
            callKey: reservation.callKey,
            attempt: reservation.attempt,
          });
        }
        return this.#clone(existing);
      }
      if (this.#findCall(reservation.modelCallId) !== undefined) {
        corruption('Model-call ID was reused.', {
          modelCallId: reservation.modelCallId,
        });
      }
      const record: ModelCallRecord = this.#clone({
        ...reservation,
        status: 'reserved',
      });
      this.#writeCall(record);
      this.#writeExecution(
        this.#clone({
          ...execution,
          status: 'calling-model',
          updatedAt: reservation.startedAt,
        }),
      );
      return this.#clone(record);
    });
  }

  async completeModelCall(input: CompletedModelCall): Promise<void> {
    const completed = this.#clone(input);
    this.#immediate(() => {
      const existing = this.#findCall(completed.modelCallId);
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
      const execution = this.#require(existing.executionId);
      const retained = applyModelCallRetention({
        retention: execution.policy.retention,
        completed,
        ...(this.#payloadEncryptor === undefined
          ? {}
          : { payloadEncryptor: this.#payloadEncryptor }),
      });
      this.#writeCall(
        this.#clone({
          ...existing,
          status: 'succeeded',
          ...retained,
          completedAt: completed.completedAt,
        }),
      );
    });
  }

  async failModelCall(input: FailedModelCall): Promise<void> {
    const failed = this.#clone(input);
    this.#immediate(() => {
      const existing = this.#findCall(failed.modelCallId);
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
      this.#writeCall(
        this.#clone({
          ...existing,
          status: failed.ambiguous ? 'ambiguous' : 'failed',
          error: failed.error,
          completedAt: failed.completedAt,
        }),
      );
    });
  }

  async loadResumeState(
    modelExecutionId: string,
  ): Promise<ModelExecutionResumeState | null> {
    const execution = this.#find(modelExecutionId);
    if (execution === undefined) {
      return null;
    }
    const modelCalls = this.#all<{ readonly record_json: string }>(
      `SELECT record_json FROM model_execution_calls
       WHERE model_execution_id = ?
       ORDER BY call_key, attempt`,
      [modelExecutionId],
    ).map((row) => this.#reveal(this.#parseCall(row.record_json)));
    return this.#clone({ modelExecutionId, execution, modelCalls });
  }

  async markTerminal(input: ModelExecutionTerminal): Promise<void> {
    const terminalRecord = this.#clone(input);
    this.#immediate(() => {
      const execution = this.#require(terminalRecord.modelExecutionId);
      if (terminal(execution.status)) {
        if (
          execution.result !== undefined &&
          this.#equivalent(execution.result, terminalRecord.result)
        ) {
          return;
        }
        if (
          terminalRecord.status === 'succeeded' &&
          execution.status === 'succeeded'
        ) {
          return;
        }
        corruption('A terminal model execution cannot be mutated.', {
          modelExecutionId: execution.modelExecutionId,
          status: execution.status,
        });
      }
      this.#writeExecution(
        this.#clone({
          ...execution,
          status: terminalRecord.status,
          result: terminalRecord.result,
          ...(terminalRecord.error === undefined
            ? {}
            : { error: terminalRecord.error }),
          diagnostic: terminalRecord.diagnostic,
          updatedAt: terminalRecord.terminalAt,
        }),
      );
    });
  }

  #require(modelExecutionId: string): ModelExecutionRecord {
    const execution = this.#find(modelExecutionId);
    if (execution === undefined) {
      invalid('Model execution does not exist.', { modelExecutionId });
    }
    return execution;
  }

  #find(modelExecutionId: string): ModelExecutionRecord | undefined {
    const row = this.#one<{ readonly record_json: string }>(
      'SELECT record_json FROM model_executions WHERE model_execution_id = ?',
      [modelExecutionId],
    );
    return row === undefined
      ? undefined
      : this.#parseExecution(row.record_json);
  }

  #findByRequestKey(requestKey: string): ModelExecutionRecord | undefined {
    const row = this.#one<{ readonly record_json: string }>(
      'SELECT record_json FROM model_executions WHERE request_key = ?',
      [requestKey],
    );
    return row === undefined
      ? undefined
      : this.#parseExecution(row.record_json);
  }

  #findCall(modelCallId: string): ModelCallRecord | undefined {
    const row = this.#one<{ readonly record_json: string }>(
      'SELECT record_json FROM model_execution_calls WHERE model_call_id = ?',
      [modelCallId],
    );
    return row === undefined ? undefined : this.#parseCall(row.record_json);
  }

  #findCallByKey(
    modelExecutionId: string,
    callKey: string,
    attempt: number,
  ): ModelCallRecord | undefined {
    const row = this.#one<{ readonly record_json: string }>(
      `SELECT record_json FROM model_execution_calls
       WHERE model_execution_id = ? AND call_key = ? AND attempt = ?`,
      [modelExecutionId, callKey, attempt],
    );
    return row === undefined ? undefined : this.#parseCall(row.record_json);
  }

  #writeExecution(record: ModelExecutionRecord): void {
    this.#run(
      `INSERT INTO model_executions (
        model_execution_id, request_key, request_fingerprint, request_hash,
        selection_json, request_json, required_capabilities_json, policy_json,
        status, error_json, diagnostic_json, result_json, record_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(model_execution_id) DO UPDATE SET
        status = excluded.status,
        error_json = excluded.error_json,
        diagnostic_json = excluded.diagnostic_json,
        result_json = excluded.result_json,
        record_json = excluded.record_json,
        updated_at = excluded.updated_at`,
      [
        record.modelExecutionId,
        record.requestKey,
        record.requestFingerprint,
        record.requestHash,
        this.#json(record.selection),
        this.#json(record.request),
        this.#json(record.requiredCapabilities),
        this.#json(record.policy),
        record.status,
        record.error === undefined ? null : this.#json(record.error),
        record.diagnostic === undefined ? null : this.#json(record.diagnostic),
        record.result === undefined ? null : this.#json(record.result),
        this.#json(record),
        record.createdAt,
        record.updatedAt,
      ],
    );
  }

  #writeCall(record: ModelCallRecord): void {
    this.#run(
      `INSERT INTO model_execution_calls (
        model_call_id, model_execution_id, call_key, attempt, purpose,
        selection_json, request_hash, record_json, status, response_hash,
        started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(model_call_id) DO UPDATE SET
        record_json = excluded.record_json,
        status = excluded.status,
        response_hash = excluded.response_hash,
        completed_at = excluded.completed_at`,
      [
        record.modelCallId,
        record.executionId,
        record.callKey,
        record.attempt,
        record.purpose,
        this.#json(record.selection),
        record.requestHash,
        this.#json(record),
        record.status,
        record.responseHash ?? null,
        record.startedAt,
        record.completedAt ?? null,
      ],
    );
  }

  #reveal(call: ModelCallRecord): ModelCallRecord {
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

  #parseExecution(recordJson: string): ModelExecutionRecord {
    return this.#clone(JSON.parse(recordJson) as ModelExecutionRecord);
  }

  #parseCall(recordJson: string): ModelCallRecord {
    return this.#clone(JSON.parse(recordJson) as ModelCallRecord);
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

  #immediate<T>(work: () => T): T {
    return withSqliteDriverErrors(() =>
      this.#database.transaction(work).immediate(),
    );
  }

  #statement(sql: string): Statement {
    return withSqliteDriverErrors(() => {
      const cached = this.#statements.get(sql);
      if (cached !== undefined) {
        return cached;
      }
      const prepared = this.#database.prepare(sql);
      this.#statements.set(sql, prepared);
      return prepared;
    });
  }

  #one<TRow>(sql: string, params: readonly SqlValue[] = []): TRow | undefined {
    return withSqliteDriverErrors(
      () => this.#statement(sql).get(...params) as TRow | undefined,
    );
  }

  #all<TRow>(sql: string, params: readonly SqlValue[] = []): TRow[] {
    return withSqliteDriverErrors(
      () => this.#statement(sql).all(...params) as TRow[],
    );
  }

  #run(sql: string, params: readonly SqlValue[] = []): void {
    withSqliteDriverErrors(() => {
      this.#statement(sql).run(...params);
    });
  }
}

export function createSqliteModelExecutionRepository(
  options: SqliteModelExecutionRepositoryOptions,
): SqliteModelExecutionRepository {
  return new SqliteModelExecutionRepository(options);
}
