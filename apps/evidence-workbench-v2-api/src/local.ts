import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';

import { randomBytes } from 'node:crypto';

import { createDeterministicEvidenceAuthenticator } from '@acme/adapter-evidence-auth-memory';
import { createFileEvidenceArtifactObjectStore } from '@acme/adapter-evidence-artifact-file';
import { createS3EvidenceArtifactObjectStore } from '@acme/adapter-evidence-artifact-s3';
import {
  buildEvidenceV2Migrations,
  createEvidenceV2PostgresRepository,
} from '@acme/adapter-evidence-v2-postgres';
import {
  createPostgresEvidenceIdentityRepository,
  createEvidenceIdentityMigrations,
} from '@acme/adapter-evidence-auth-postgres';
import { migratePostgresSchema } from '@acme/adapter-postgres';
import { createAes256GcmPayloadEncryptor } from '@acme/core';
import {
  createEvidenceArtifactKeyring,
  type EvidenceArtifactObjectStore,
} from '@acme/evidence-artifacts';
import pg from 'pg';

import { createEvidenceV2App } from './app.js';
import { createEvidenceV2TextStore } from './artifact-store.js';
import { createEvidenceV2Auth, type EvidenceV2Account } from './auth.js';

/**
 * Local composition for the V2 workbench.
 *
 * Real PostgreSQL, a real object store and the shared artifact envelope. The
 * server binds to loopback: ACME-0152 deliberately defers authentication, so
 * this is a single-operator local tool until the auth task lands.
 */
export interface EvidenceV2LocalOptions {
  readonly postgresUrl: string;
  readonly schema?: string;
  readonly port?: number;
  readonly objectStore:
    | { readonly kind: 'file'; readonly root: string }
    | {
        readonly kind: 's3';
        readonly endpoint: string;
        readonly region: string;
        readonly bucket: string;
        readonly accessKeyId: string;
        readonly secretAccessKey: string;
      };
  readonly kekBase64: string;
  readonly kekId?: string;
  readonly kekVersion?: number;
  readonly now?: () => string;
  /** Session-payload key. Exactly 32 bytes, base64. */
  readonly sessionKeyBase64: string;
  readonly identitySchema?: string;
  readonly issuer?: string;
  readonly organizationId?: string;
  readonly organizationLabel?: string;
  /**
   * Development credentials. The only credential source this composition
   * offers; a real upstream identity provider is a separate task.
   */
  readonly accounts: readonly (EvidenceV2Account & {
    readonly password: string;
  })[];
}

export interface EvidenceV2LocalHandle {
  readonly server: Server;
  readonly port: number;
  close(): Promise<void>;
}

export async function startEvidenceV2Local(
  options: EvidenceV2LocalOptions,
): Promise<EvidenceV2LocalHandle> {
  const schema = options.schema ?? 'evidence_v2';
  const pool = new pg.Pool({ connectionString: options.postgresUrl });
  const now = options.now ?? (() => new Date().toISOString());

  await migratePostgresSchema({
    pool,
    schema,
    appliedAt: now(),
    migrations: buildEvidenceV2Migrations(schema),
  });

  const identitySchema = options.identitySchema ?? 'evidence_v2_identity';
  await migratePostgresSchema({
    pool,
    schema: identitySchema,
    appliedAt: now(),
    migrations: createEvidenceIdentityMigrations(identitySchema),
  });
  const issuer = options.issuer ?? 'https://local.acme.invalid/';
  const auth = createEvidenceV2Auth({
    identity: createPostgresEvidenceIdentityRepository({
      pool,
      schema: identitySchema,
    }),
    authenticator: createDeterministicEvidenceAuthenticator({
      issuer,
      accounts: options.accounts.map((account) => ({
        email: account.email,
        password: account.password,
        subject: account.subject,
        displayLabel: account.displayLabel,
      })),
      // A function, not a fixed instant: a composition that outlives a fixed
      // expiry would issue sessions that are already expired.
      expiresAt: () => new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }),
    protector: createAes256GcmPayloadEncryptor({
      key: Buffer.from(options.sessionKeyBase64, 'base64'),
      keyId: 'evidence-v2-session',
    }),
    issuer,
    organizationId: options.organizationId ?? 'acme-v2-organization',
    organizationLabel: options.organizationLabel ?? 'ACME V2 local',
    accounts: options.accounts,
    now,
    nextToken: () => randomBytes(32).toString('base64url'),
  });
  await auth.bootstrap();

  const objectStore: EvidenceArtifactObjectStore =
    options.objectStore.kind === 'file'
      ? createFileEvidenceArtifactObjectStore({
          root: options.objectStore.root,
        })
      : createS3EvidenceArtifactObjectStore({
          endpoint: options.objectStore.endpoint,
          region: options.objectStore.region,
          bucket: options.objectStore.bucket,
          accessKeyId: options.objectStore.accessKeyId,
          secretAccessKey: options.objectStore.secretAccessKey,
        });

  const keyProvider = createEvidenceArtifactKeyring({
    activeKeyId: options.kekId ?? 'evidence-v2-kek',
    activeKeyVersion: options.kekVersion ?? 1,
    keys: [
      {
        keyId: options.kekId ?? 'evidence-v2-kek',
        keyVersion: options.kekVersion ?? 1,
        key: Buffer.from(options.kekBase64, 'base64'),
      },
    ],
  });

  const handler = createEvidenceV2App({
    repository: createEvidenceV2PostgresRepository({ pool, schema }),
    textStore: createEvidenceV2TextStore({ objectStore, keyProvider }),
    auth,
    now,
  });

  const server = createServer((request, response) => {
    void handler(request, response);
  });

  const port = options.port ?? 8795;
  await new Promise<void>((resolve) => {
    server.listen(port, '127.0.0.1', resolve);
  });

  return {
    server,
    port,
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await pool.end();
    },
  };
}

/** Read a secret file the way the local POC scripts already store keys. */
export async function readBase64KeyFile(path: string): Promise<string> {
  return (await readFile(path, 'utf8')).trim();
}
