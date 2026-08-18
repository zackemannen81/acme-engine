import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';

import { randomBytes } from 'node:crypto';

import { createDeterministicEvidenceAuthenticator } from '@acme/adapter-evidence-auth-memory';
import { createFileEvidenceArtifactObjectStore } from '@acme/adapter-evidence-artifact-file';
import { createS3EvidenceArtifactObjectStore } from '@acme/adapter-evidence-artifact-s3';
import { createEvidenceV2PdfExtractor } from '@acme/adapter-evidence-v2-pdf';
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

import { createOpenAiResponsesGateway } from '@acme/adapter-model-openai';
import { createFetchTransport } from '@acme/adapter-model-openai/transport-fetch';
import { createPostgresExecutionRepository } from '@acme/adapter-postgres';

import { createEvidenceV2App } from './app.js';
import {
  EVIDENCE_V2_COMPARE_PROFILE,
  createEvidenceV2Comparer,
} from './compare.js';
import {
  EVIDENCE_V2_OBSERVE_PROFILE,
  createEvidenceV2Extractor,
} from './extract.js';
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
  /**
   * Live model capability. Absent means the deployment has no extraction: the
   * route answers 501 rather than pretending (fail closed).
   */
  readonly live?: {
    readonly apiKey: string;
    readonly model: string;
    readonly baseUrl?: string;
    readonly ledgerSchema?: string;
    readonly emergencyCallCeiling?: number;
    /**
     * Key for retained request and response payloads, separate from the session
     * key. Absent means an ephemeral key: payloads are still encrypted, but a
     * restart cannot read them, which is the safe default for a local run.
     */
    readonly payloadKeyBase64?: string;
    readonly payloadKeyId?: string;
  };
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

  const repository = createEvidenceV2PostgresRepository({ pool, schema });
  const ids = {
    next: (kind: string) => `${kind}-${randomBytes(16).toString('hex')}`,
  };
  let extractor;
  let comparer;
  if (options.live !== undefined) {
    const ledgerSchema = options.live.ledgerSchema ?? 'acme_v2_ledger';
    await migratePostgresSchema({
      pool,
      schema: ledgerSchema,
      appliedAt: now(),
    });
    const observeSelection = {
      profile: EVIDENCE_V2_OBSERVE_PROFILE,
      providerHint: 'openai',
      modelHint: options.live.model,
    };
    const compareSelection = {
      profile: EVIDENCE_V2_COMPARE_PROFILE,
      providerHint: 'openai',
      modelHint: options.live.model,
    };
    const apiKey = options.live.apiKey;
    const ledger = createPostgresExecutionRepository({
      pool,
      ids,
      schema: ledgerSchema,
      // Retained payloads are encrypted at rest, exactly as the frozen
      // application retains them (ADR-0016), under a key of their own. The
      // session key protects upstream sessions and must not also unlock
      // retained model payloads; absent a supplied key this deployment
      // encrypts under an ephemeral one, so a restart cannot read them back.
      payloadEncryptor: createAes256GcmPayloadEncryptor({
        key:
          options.live.payloadKeyBase64 === undefined
            ? new Uint8Array(randomBytes(32))
            : Buffer.from(options.live.payloadKeyBase64, 'base64'),
        keyId:
          options.live.payloadKeyBase64 === undefined
            ? 'ephemeral-local-ledger'
            : (options.live.payloadKeyId ?? 'evidence-v2-ledger'),
      }),
    });
    const capabilities = {
      structuredOutput: true,
      tools: false,
      vision: false,
      maxInputTokens: 32_000,
      maxOutputTokens: 8_192,
    };
    const gateway = createOpenAiResponsesGateway({
      transport: createFetchTransport(),
      now,
      ...(options.live.baseUrl === undefined
        ? {}
        : { baseUrl: options.live.baseUrl }),
      headers: () => ({ authorization: `Bearer ${apiKey}` }),
      profiles: [
        {
          selection: observeSelection,
          model: options.live.model,
          capabilities,
        },
        {
          selection: compareSelection,
          model: options.live.model,
          capabilities,
        },
      ],
    });
    const liveShared = {
      repository,
      ledger,
      gateway,
      clock: { now },
      ids,
      ...(options.live.emergencyCallCeiling === undefined
        ? {}
        : { emergencyCallCeiling: options.live.emergencyCallCeiling }),
    };
    extractor = createEvidenceV2Extractor({
      ...liveShared,
      selection: observeSelection,
    });
    comparer = createEvidenceV2Comparer({
      ...liveShared,
      selection: compareSelection,
    });
  }

  const handler = createEvidenceV2App({
    repository,
    textStore: createEvidenceV2TextStore({ objectStore, keyProvider }),
    auth,
    ...(extractor === undefined ? {} : { extractor }),
    ...(comparer === undefined ? {} : { comparer }),
    pdfExtractor: createEvidenceV2PdfExtractor(),
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
