import { randomBytes } from 'node:crypto';

import { Pool } from 'pg';

import {
  createPostgresExecutionRepository,
  createPostgresQualityEvaluationStore,
  dropPostgresSchema,
  migratePostgresSchema,
  type PostgresExecutionRepository,
} from '../../packages/adapter-postgres/src/index.js';
import {
  createPostgresEvidenceProductRepository,
  dropEvidenceProductSchema,
  migrateEvidenceProductSchema,
} from '../../packages/adapter-evidence-product-postgres/src/index.js';
import type {
  IdGenerator,
  PayloadEncryptor,
} from '../../packages/core/src/index.js';

/**
 * Refuse rather than skip when the gated postgres suite is invoked without a
 * connection string (ADR-0033 / live-gate pattern).
 */
export function requirePostgresUrl(): string {
  const url =
    process.env['ACME_POSTGRES_URL'] ??
    (process.env['ACME_POSTGRES_HOST'] === undefined
      ? undefined
      : buildUrlFromParts());
  if (url === undefined || url.trim().length === 0) {
    throw new Error(
      'ACME_POSTGRES_URL (or ACME_POSTGRES_HOST/PORT/USER/PASSWORD/DATABASE) is required for pnpm test:postgres. Refusing rather than skipping.',
    );
  }
  return url;
}

function buildUrlFromParts(): string | undefined {
  const host = process.env['ACME_POSTGRES_HOST'];
  if (host === undefined) {
    return undefined;
  }
  const port = process.env['ACME_POSTGRES_PORT'] ?? '5432';
  const user = process.env['ACME_POSTGRES_USER'] ?? 'acme';
  const password = process.env['ACME_POSTGRES_PASSWORD'] ?? 'acme';
  const database = process.env['ACME_POSTGRES_DATABASE'] ?? 'acme';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

export function createSharedPool(): Pool {
  return new Pool({
    connectionString: requirePostgresUrl(),
    max: 10,
    application_name: 'acme-test-postgres',
  });
}

export function randomSchema(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString('hex')}`;
}

const appliedAt = '2026-08-12T00:00:00.000Z';

export interface AcmeSchemaFixture {
  readonly pool: Pool;
  readonly schema: string;
  readonly createRepository: (deps?: {
    readonly payloadEncryptor?: PayloadEncryptor;
    readonly ids?: IdGenerator;
  }) => PostgresExecutionRepository;
  readonly createQualityStore: () => ReturnType<
    typeof createPostgresQualityEvaluationStore
  >;
  readonly dispose: () => Promise<void>;
}

/**
 * Schema-per-test isolation: create a unique schema, migrate, dispose with
 * DROP SCHEMA CASCADE (ADR-0033 section 10).
 */
export async function createAcmeSchemaFixture(
  sharedPool: Pool,
): Promise<AcmeSchemaFixture> {
  const schema = randomSchema('acme_test');
  await migratePostgresSchema({
    pool: sharedPool,
    schema,
    appliedAt,
  });

  return {
    pool: sharedPool,
    schema,
    createRepository(deps) {
      return createPostgresExecutionRepository({
        pool: sharedPool,
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
    },
    createQualityStore() {
      return createPostgresQualityEvaluationStore({
        pool: sharedPool,
        schema,
      });
    },
    async dispose() {
      await dropPostgresSchema(sharedPool, schema);
    },
  };
}

export interface EvidenceSchemaFixture {
  readonly pool: Pool;
  readonly schema: string;
  readonly createRepository: () => ReturnType<
    typeof createPostgresEvidenceProductRepository
  >;
  readonly dispose: () => Promise<void>;
}

export async function createEvidenceSchemaFixture(
  sharedPool: Pool,
): Promise<EvidenceSchemaFixture> {
  const schema = randomSchema('evidence_test');
  await migrateEvidenceProductSchema({
    pool: sharedPool,
    schema,
    appliedAt,
  });
  return {
    pool: sharedPool,
    schema,
    createRepository() {
      return createPostgresEvidenceProductRepository({
        pool: sharedPool,
        schema,
      });
    },
    async dispose() {
      await dropEvidenceProductSchema(sharedPool, schema);
    },
  };
}
