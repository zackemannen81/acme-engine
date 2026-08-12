import { randomUUID } from 'node:crypto';

import {
  createAes256GcmPayloadEncryptor,
  createContractRegistry,
  createExecutionEngine,
  createMemoryEngine,
  createModuleRegistry,
  createResponsePipeline,
  createStateEngine,
  type Clock,
  type ExecutionEngine,
  type ExecutionRepository,
  type IdGenerator,
  type ModelGateway,
  type PayloadEncryptor,
  type RepositoryEvidence,
} from '@acme/core';
import {
  createInMemoryExecutionRepository,
  createInMemoryQualityEvaluationStore,
} from '@acme/adapter-memory';
import {
  createSqliteExecutionRepository,
  createSqliteQualityEvaluationStore,
  openDatabase,
} from '@acme/adapter-sqlite';
import {
  createPostgresExecutionRepository,
  createPostgresQualityEvaluationStore,
  migratePostgresSchema,
  verifyPostgresSchema,
  type PostgresExecutionRepository,
} from '@acme/adapter-postgres';
import type { QualityEvaluationStore } from '@acme/evaluation';
import {
  narrativeModule,
  narrativeObserveDocumentContract,
} from '@acme/module-narrative';
import {
  researchModule,
  researchObserveEvidenceContract,
} from '@acme/module-research';
import { Pool } from 'pg';

import type { AdapterName } from './args.js';

/**
 * Both repository adapters expose read-only evidence beyond the port. A
 * composition root knows which adapter it selected, so inspection may use it.
 * PostgreSQL snapshot is async; callers should `await` the result.
 */
export type InspectableRepository = ExecutionRepository & {
  snapshot(): RepositoryEvidence | Promise<RepositoryEvidence>;
};

export interface CompositionOverrides {
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
  readonly payloadEncryptor?: PayloadEncryptor;
}

/**
 * Optional env-backed encryptor for live/local CLI use.
 * `ACME_PAYLOAD_KEY` is 32 raw bytes as base64; `ACME_PAYLOAD_KEY_ID` names it.
 * Composition owns key acquisition; core never reads the environment.
 */
function payloadEncryptorFromEnv(): PayloadEncryptor | undefined {
  const encoded = process.env['ACME_PAYLOAD_KEY'];
  if (encoded === undefined || encoded.trim().length === 0) {
    return undefined;
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.byteLength !== 32) {
    throw new Error(
      'ACME_PAYLOAD_KEY must decode to exactly 32 bytes (AES-256).',
    );
  }
  const keyId = process.env['ACME_PAYLOAD_KEY_ID'] ?? 'env-default';
  return createAes256GcmPayloadEncryptor({
    key: new Uint8Array(key),
    keyId,
  });
}

export interface Composition {
  readonly repository: InspectableRepository;
  /** Sibling quality store (memory, SQLite file, or PostgreSQL acme schema). */
  readonly qualityStore: QualityEvaluationStore;
  /** The selected clock, so commands that need time do not invent one. */
  readonly clock: Clock;
  readonly close: () => void | Promise<void>;
  engine(gateway: ModelGateway): ExecutionEngine;
}

function defaultIds(): IdGenerator {
  return {
    next(kind) {
      return `${kind}-${randomUUID()}`;
    },
  };
}

function defaultClock(): Clock {
  return {
    now() {
      return new Date().toISOString();
    },
  };
}

function postgresUrlFromEnv(): string {
  const direct = process.env['ACME_POSTGRES_URL'];
  if (direct !== undefined && direct.trim().length > 0) {
    return direct;
  }
  const host = process.env['ACME_POSTGRES_HOST'];
  if (host === undefined || host.trim().length === 0) {
    throw new Error(
      'The PostgreSQL adapter requires ACME_POSTGRES_URL or ACME_POSTGRES_HOST.',
    );
  }
  const port = process.env['ACME_POSTGRES_PORT'] ?? '5432';
  const user = process.env['ACME_POSTGRES_USER'] ?? 'acme';
  const password = process.env['ACME_POSTGRES_PASSWORD'] ?? 'acme';
  const database = process.env['ACME_POSTGRES_DATABASE'] ?? 'acme';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function createLazyPostgresComposition(
  ids: IdGenerator,
  clock: Clock,
  payloadEncryptor: PayloadEncryptor | undefined,
): {
  repository: InspectableRepository;
  qualityStore: QualityEvaluationStore;
  close: () => Promise<void>;
} {
  const pool = new Pool({
    connectionString: postgresUrlFromEnv(),
    max: 8,
    application_name: 'acme-cli',
  });
  let ready:
    | Promise<{
        repository: PostgresExecutionRepository;
        qualityStore: QualityEvaluationStore;
      }>
    | undefined;
  let cached:
    | {
        repository: PostgresExecutionRepository;
        qualityStore: QualityEvaluationStore;
      }
    | undefined;

  async function ensure() {
    if (cached !== undefined) {
      return cached;
    }
    ready ??= (async () => {
      await migratePostgresSchema({ pool, appliedAt: clock.now() });
      await verifyPostgresSchema({ pool });
      const repository = createPostgresExecutionRepository({
        pool,
        ids,
        ...(payloadEncryptor === undefined ? {} : { payloadEncryptor }),
      });
      const qualityStore = createPostgresQualityEvaluationStore({ pool });
      const pair = { repository, qualityStore };
      cached = pair;
      return pair;
    })();
    return ready;
  }

  const repository = {
    accept: async (input) => (await ensure()).repository.accept(input),
    get: async (id) => (await ensure()).repository.get(id),
    appendAttempt: async (input) =>
      (await ensure()).repository.appendAttempt(input),
    reserveModelCall: async (input) =>
      (await ensure()).repository.reserveModelCall(input),
    completeModelCall: async (input) =>
      (await ensure()).repository.completeModelCall(input),
    failModelCall: async (input) =>
      (await ensure()).repository.failModelCall(input),
    loadContext: async (query) =>
      (await ensure()).repository.loadContext(query),
    commit: async (input) => (await ensure()).repository.commit(input),
    loadReplayEvidence: async (id) =>
      (await ensure()).repository.loadReplayEvidence(id),
    loadResumeState: async (id) =>
      (await ensure()).repository.loadResumeState(id),
    leaseOutbox: async (claim) =>
      (await ensure()).repository.leaseOutbox(claim),
    markOutboxDelivered: async (entry) =>
      (await ensure()).repository.markOutboxDelivered(entry),
    markOutboxFailed: async (entry) =>
      (await ensure()).repository.markOutboxFailed(entry),
    redriveOutbox: async (entry) =>
      (await ensure()).repository.redriveOutbox(entry),
    listOutbox: async (query) => (await ensure()).repository.listOutbox(query),
    markTerminal: async (input) =>
      (await ensure()).repository.markTerminal(input),
    snapshot: async () => (await ensure()).repository.snapshot(),
  } satisfies InspectableRepository;

  const qualityStore: QualityEvaluationStore = {
    put: async (record) => (await ensure()).qualityStore.put(record),
    get: async (id) => (await ensure()).qualityStore.get(id),
    list: async (query) => (await ensure()).qualityStore.list(query),
  };

  return {
    repository,
    qualityStore,
    close: async () => {
      await pool.end();
    },
  };
}

/**
 * The one place that selects concrete adapters. Everything else in the CLI
 * works through core ports. Pool lifecycle for PostgreSQL is owned here.
 */
export function createComposition(
  adapter: AdapterName,
  database: string | undefined,
  overrides: CompositionOverrides = {},
): Composition {
  const ids = overrides.ids ?? defaultIds();
  const clock = overrides.clock ?? defaultClock();
  const payloadEncryptor =
    overrides.payloadEncryptor ?? payloadEncryptorFromEnv();

  let repository: InspectableRepository;
  let qualityStore: QualityEvaluationStore;
  let close: () => void | Promise<void> = (): void => {};

  if (adapter === 'sqlite') {
    if (database === undefined) {
      throw new Error('The SQLite adapter requires a database path.');
    }
    const connection = openDatabase({
      location: database,
      appliedAt: clock.now(),
    });
    close = (): void => {
      connection.close();
    };
    repository = createSqliteExecutionRepository({
      database: connection,
      ids,
      ...(payloadEncryptor === undefined ? {} : { payloadEncryptor }),
    });
    qualityStore = createSqliteQualityEvaluationStore({ database: connection });
  } else if (adapter === 'postgres') {
    if (database !== undefined) {
      throw new Error(
        '--database is only meaningful with --adapter sqlite; PostgreSQL uses ACME_POSTGRES_URL.',
      );
    }
    const pg = createLazyPostgresComposition(ids, clock, payloadEncryptor);
    repository = pg.repository;
    qualityStore = pg.qualityStore;
    close = pg.close;
  } else {
    repository = createInMemoryExecutionRepository({
      ids,
      ...(payloadEncryptor === undefined ? {} : { payloadEncryptor }),
    });
    qualityStore = createInMemoryQualityEvaluationStore();
  }

  return {
    repository,
    qualityStore,
    clock,
    close,
    engine(gateway) {
      return createExecutionEngine({
        clock,
        ids,
        modules: createModuleRegistry([narrativeModule, researchModule]),
        contracts: createContractRegistry([
          narrativeObserveDocumentContract,
          researchObserveEvidenceContract,
        ]),
        pipeline: createResponsePipeline(),
        gateway,
        memory: createMemoryEngine({ ids }),
        state: createStateEngine(),
        repository,
      });
    },
  };
}
