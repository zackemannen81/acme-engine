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
} from '@acme/core';

export interface InMemoryModelExecutionRepositoryOptions {
  readonly hashing?: Hashing;
  readonly payloadEncryptor?: PayloadEncryptor;
}

interface Store {
  readonly executions: Map<string, ModelExecutionRecord>;
  readonly requestKeys: Map<string, string>;
  readonly modelCalls: Map<string, ModelCallRecord>;
  readonly modelCallKeys: Map<string, string>;
}

function emptyStore(): Store {
  return {
    executions: new Map(),
    requestKeys: new Map(),
    modelCalls: new Map(),
    modelCallKeys: new Map(),
  };
}

function stageStore(source: Store): Store {
  return {
    executions: new Map(source.executions),
    requestKeys: new Map(source.requestKeys),
    modelCalls: new Map(source.modelCalls),
    modelCallKeys: new Map(source.modelCallKeys),
  };
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

function clone<T>(value: T, hashing: Hashing): T {
  return deepFreeze(
    JSON.parse(hashing.canonicalJson(value as JsonValue)) as unknown as T,
  );
}

function equivalent(left: unknown, right: unknown, hashing: Hashing): boolean {
  return (
    hashing.canonicalJson(left as JsonValue) ===
    hashing.canonicalJson(right as JsonValue)
  );
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

export class InMemoryModelExecutionRepository implements ModelExecutionRepository {
  readonly #hashing: Hashing;
  readonly #payloadEncryptor: PayloadEncryptor | undefined;
  #store: Store = emptyStore();

  constructor(options: InMemoryModelExecutionRepositoryOptions = {}) {
    this.#hashing = options.hashing ?? nodeHashing;
    this.#payloadEncryptor = options.payloadEncryptor;
  }

  async accept(
    input: AcceptedModelExecution,
  ): Promise<ModelExecutionAcceptResult> {
    const accepted = clone(input, this.#hashing);
    requireText(accepted.modelExecutionId, 'modelExecutionId');
    requireText(accepted.requestKey, 'requestKey');
    requireText(accepted.requestFingerprint, 'requestFingerprint');
    requireText(accepted.requestHash, 'requestHash');

    const existingId = this.#store.requestKeys.get(accepted.requestKey);
    if (existingId !== undefined) {
      const existing = this.#store.executions.get(existingId);
      if (existing === undefined) {
        corruption('Request-key index references a missing model execution.', {
          modelExecutionId: existingId,
        });
      }
      if (existing.requestFingerprint !== accepted.requestFingerprint) {
        return clone(
          { kind: 'conflict', existingExecutionId: existing.modelExecutionId },
          this.#hashing,
        );
      }
      return clone({ kind: 'existing', execution: existing }, this.#hashing);
    }

    const record: ModelExecutionRecord = clone(
      {
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
      },
      this.#hashing,
    );
    if (this.#store.executions.has(record.modelExecutionId)) {
      corruption('Model execution ID was reused for a different request.', {
        modelExecutionId: record.modelExecutionId,
      });
    }
    const staged = stageStore(this.#store);
    staged.executions.set(record.modelExecutionId, record);
    staged.requestKeys.set(record.requestKey, record.modelExecutionId);
    this.#store = staged;
    return clone({ kind: 'created', execution: record }, this.#hashing);
  }

  async get(modelExecutionId: string): Promise<ModelExecutionRecord | null> {
    const record = this.#store.executions.get(modelExecutionId);
    return record === undefined ? null : clone(record, this.#hashing);
  }

  async reserveModelCall(
    input: ModelCallReservation,
  ): Promise<ModelCallRecord> {
    const reservation = clone(input, this.#hashing);
    requireText(reservation.modelCallId, 'modelCallId');
    const execution = this.#require(reservation.executionId);
    if (terminal(execution.status)) {
      corruption('A terminal model execution cannot be mutated.', {
        modelExecutionId: execution.modelExecutionId,
        status: execution.status,
      });
    }
    const logicalKey = `${reservation.executionId}\u0000${reservation.callKey}\u0000${reservation.attempt}`;
    const existingId = this.#store.modelCallKeys.get(logicalKey);
    if (existingId !== undefined) {
      const existing = this.#store.modelCalls.get(existingId);
      if (existing === undefined) {
        corruption('Model-call index references a missing record.', {
          modelCallId: existingId,
        });
      }
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
      if (!equivalent(original, reservation, this.#hashing)) {
        corruption('Divergent model-call key was reused.', { logicalKey });
      }
      return clone(existing, this.#hashing);
    }
    if (this.#store.modelCalls.has(reservation.modelCallId)) {
      corruption('Model-call ID was reused.', {
        modelCallId: reservation.modelCallId,
      });
    }
    const record: ModelCallRecord = clone(
      { ...reservation, status: 'reserved' },
      this.#hashing,
    );
    const staged = stageStore(this.#store);
    staged.modelCalls.set(record.modelCallId, record);
    staged.modelCallKeys.set(logicalKey, record.modelCallId);
    staged.executions.set(
      execution.modelExecutionId,
      clone(
        {
          ...execution,
          status: 'calling-model',
          updatedAt: reservation.startedAt,
        },
        this.#hashing,
      ),
    );
    this.#store = staged;
    return clone(record, this.#hashing);
  }

  async completeModelCall(input: CompletedModelCall): Promise<void> {
    const completed = clone(input, this.#hashing);
    const existing = this.#store.modelCalls.get(completed.modelCallId);
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
      if (!equivalent(prior, expected, this.#hashing)) {
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
    const record: ModelCallRecord = clone(
      {
        ...existing,
        status: 'succeeded',
        ...retained,
        completedAt: completed.completedAt,
      },
      this.#hashing,
    );
    const staged = stageStore(this.#store);
    staged.modelCalls.set(record.modelCallId, record);
    this.#store = staged;
  }

  async failModelCall(input: FailedModelCall): Promise<void> {
    const failed = clone(input, this.#hashing);
    const existing = this.#store.modelCalls.get(failed.modelCallId);
    if (existing === undefined) {
      invalid('Model call does not exist.', {
        modelCallId: failed.modelCallId,
      });
    }
    const status = failed.ambiguous ? 'ambiguous' : 'failed';
    if (existing.status === 'failed' || existing.status === 'ambiguous') {
      if (existing.error === undefined || existing.completedAt === undefined) {
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
      if (!equivalent(prior, failed, this.#hashing)) {
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
    const record: ModelCallRecord = clone(
      {
        ...existing,
        status,
        error: failed.error,
        completedAt: failed.completedAt,
      },
      this.#hashing,
    );
    const staged = stageStore(this.#store);
    staged.modelCalls.set(record.modelCallId, record);
    this.#store = staged;
  }

  async loadResumeState(
    modelExecutionId: string,
  ): Promise<ModelExecutionResumeState | null> {
    const execution = this.#store.executions.get(modelExecutionId);
    if (execution === undefined) {
      return null;
    }
    const modelCalls = [...this.#store.modelCalls.values()]
      .filter((call) => call.executionId === modelExecutionId)
      .sort(
        (left, right) =>
          left.callKey.localeCompare(right.callKey) ||
          left.attempt - right.attempt,
      )
      .map((call) => this.#reveal(call));
    return clone({ modelExecutionId, execution, modelCalls }, this.#hashing);
  }

  async markTerminal(input: ModelExecutionTerminal): Promise<void> {
    const terminalRecord = clone(input, this.#hashing);
    const execution = this.#require(terminalRecord.modelExecutionId);
    if (terminal(execution.status)) {
      if (
        execution.result !== undefined &&
        equivalent(execution.result, terminalRecord.result, this.#hashing)
      ) {
        return;
      }
      corruption('A terminal model execution cannot be mutated.', {
        modelExecutionId: execution.modelExecutionId,
        status: execution.status,
      });
    }
    const staged = stageStore(this.#store);
    staged.executions.set(
      execution.modelExecutionId,
      clone(
        {
          ...execution,
          status: terminalRecord.status,
          result: terminalRecord.result,
          ...(terminalRecord.error === undefined
            ? {}
            : { error: terminalRecord.error }),
          diagnostic: terminalRecord.diagnostic,
          updatedAt: terminalRecord.terminalAt,
        },
        this.#hashing,
      ),
    );
    this.#store = staged;
  }

  #require(modelExecutionId: string): ModelExecutionRecord {
    const execution = this.#store.executions.get(modelExecutionId);
    if (execution === undefined) {
      invalid('Model execution does not exist.', { modelExecutionId });
    }
    return execution;
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
}

export function createInMemoryModelExecutionRepository(
  options: InMemoryModelExecutionRepositoryOptions = {},
): InMemoryModelExecutionRepository {
  return new InMemoryModelExecutionRepository(options);
}
