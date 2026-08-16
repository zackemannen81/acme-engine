import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';

import { createFileEvidenceArtifactObjectStore } from '@acme/adapter-evidence-artifact-file';
import { createS3EvidenceArtifactObjectStore } from '@acme/adapter-evidence-artifact-s3';
import {
  buildEvidenceV2Migrations,
  createEvidenceV2PostgresRepository,
} from '@acme/adapter-evidence-v2-postgres';
import { migratePostgresSchema } from '@acme/adapter-postgres';
import {
  createEvidenceArtifactKeyring,
  type EvidenceArtifactObjectStore,
} from '@acme/evidence-artifacts';
import pg from 'pg';

import { createEvidenceV2App } from './app.js';
import { createEvidenceV2TextStore } from './artifact-store.js';

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
