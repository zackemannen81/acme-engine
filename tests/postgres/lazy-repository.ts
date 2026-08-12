import type {
  AcceptResult,
  AcceptedExecution,
  CommittedExecution,
  CompletedModelCall,
  ContextQuery,
  DeliveredOutboxEntry,
  ExecutionAttempt,
  ExecutionReadSet,
  ExecutionRecord,
  ExecutionReplayEvidence,
  ExecutionRepository,
  ExecutionResumeState,
  FailedModelCall,
  FailedOutboxEntry,
  IdGenerator,
  LeasedOutboxEntry,
  ModelCallRecord,
  ModelCallReservation,
  NonCommitTerminalRecord,
  OutboxLease,
  OutboxQuery,
  PayloadEncryptor,
  PreparedCommit,
} from '../../packages/core/src/index.js';
import {
  createPostgresExecutionRepository,
  migratePostgresSchema,
  type PostgresExecutionRepository,
} from '../../packages/adapter-postgres/src/index.js';
import type { Pool } from 'pg';

import { randomSchema } from './harness.js';

/**
 * Synchronous conformance factory: schema name is eager; migrate + repository
 * construction happen on first use (ADR-0033 compatibility note).
 */
export function createLazyPostgresRepositoryFactory(options: {
  readonly pool: Pool;
  readonly schemas: string[];
}): (deps?: {
  readonly payloadEncryptor?: PayloadEncryptor;
  readonly ids?: IdGenerator;
}) => ExecutionRepository {
  return (deps) => {
    const schema = randomSchema('acme_test');
    options.schemas.push(schema);
    let ready: Promise<PostgresExecutionRepository> | undefined;
    let cached: PostgresExecutionRepository | undefined;

    async function repo(): Promise<PostgresExecutionRepository> {
      if (cached !== undefined) {
        return cached;
      }
      ready ??= (async () => {
        await migratePostgresSchema({
          pool: options.pool,
          schema,
          appliedAt: '2026-08-12T00:00:00.000Z',
        });
        const created = createPostgresExecutionRepository({
          pool: options.pool,
          schema,
          ids: deps?.ids ?? {
            next(kind) {
              return `${kind}-unused`;
            },
          },
          ...(deps?.payloadEncryptor === undefined
            ? {}
            : { payloadEncryptor: deps.payloadEncryptor }),
        });
        cached = created;
        return created;
      })();
      return ready;
    }

    const facade: ExecutionRepository = {
      accept: async (input: AcceptedExecution): Promise<AcceptResult> =>
        (await repo()).accept(input),
      get: async (executionId: string): Promise<ExecutionRecord | null> =>
        (await repo()).get(executionId),
      appendAttempt: async (input: ExecutionAttempt): Promise<void> =>
        (await repo()).appendAttempt(input),
      reserveModelCall: async (
        input: ModelCallReservation,
      ): Promise<ModelCallRecord> => (await repo()).reserveModelCall(input),
      completeModelCall: async (input: CompletedModelCall): Promise<void> =>
        (await repo()).completeModelCall(input),
      failModelCall: async (input: FailedModelCall): Promise<void> =>
        (await repo()).failModelCall(input),
      loadContext: async (query: ContextQuery): Promise<ExecutionReadSet> =>
        (await repo()).loadContext(query),
      commit: async (input: PreparedCommit): Promise<CommittedExecution> =>
        (await repo()).commit(input),
      loadReplayEvidence: async (
        executionId: string,
      ): Promise<ExecutionReplayEvidence | null> =>
        (await repo()).loadReplayEvidence(executionId),
      loadResumeState: async (
        executionId: string,
      ): Promise<ExecutionResumeState | null> =>
        (await repo()).loadResumeState(executionId),
      leaseOutbox: async (
        claim: OutboxLease,
      ): Promise<readonly LeasedOutboxEntry[]> =>
        (await repo()).leaseOutbox(claim),
      markOutboxDelivered: async (entry: DeliveredOutboxEntry): Promise<void> =>
        (await repo()).markOutboxDelivered(entry),
      markOutboxFailed: async (entry: FailedOutboxEntry): Promise<void> =>
        (await repo()).markOutboxFailed(entry),
      redriveOutbox: async (entry: {
        readonly eventId: string;
        readonly availableAt: string;
      }): Promise<void> => (await repo()).redriveOutbox(entry),
      listOutbox: async (
        query: OutboxQuery,
      ): Promise<readonly LeasedOutboxEntry[]> =>
        (await repo()).listOutbox(query),
      markTerminal: async (input: NonCommitTerminalRecord): Promise<void> =>
        (await repo()).markTerminal(input),
    };
    return facade;
  };
}
