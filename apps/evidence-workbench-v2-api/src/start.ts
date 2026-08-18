import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import type { EvidenceV2Account } from './auth.js';
import { startEvidenceV2Local, type EvidenceV2LocalOptions } from './local.js';

/**
 * Operator entry point for the V2 workbench.
 *
 * Configuration comes from environment variables and mounted secret files
 * only. Nothing is read from the repository, and no default supplies a key:
 * a missing key is a refusal, not a generated one, because a generated key
 * would silently make yesterday's encrypted objects unreadable.
 *
 * The startup summary is content-free by construction. It names schemas,
 * ports and bucket, and never a credential, a case or a source line.
 */

/** Supavisor's transaction pooler. Named so the refusal can explain itself. */
const TRANSACTION_POOLER_PORT = '6543';

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0)
    throw new Error(`${name} is required.`);
  return value.trim();
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value.trim().length === 0
    ? fallback
    : value.trim();
}

/**
 * Read a secret from a mounted file, or from the environment when the
 * deployment supplies it directly. The file form is preferred and is what the
 * documented run procedure uses; the environment form exists because provider
 * credentials are environment-only by ADR-0040 §5.
 */
async function secret(name: string): Promise<string> {
  const path = process.env[`${name}_FILE`];
  if (path !== undefined && path.trim().length > 0)
    return (await readFile(path.trim(), 'utf8')).trim();
  return required(name);
}

async function optionalSecret(name: string): Promise<string | undefined> {
  const path = process.env[`${name}_FILE`];
  if (path !== undefined && path.trim().length > 0)
    return (await readFile(path.trim(), 'utf8')).trim();
  const value = process.env[name];
  return value === undefined || value.trim().length === 0
    ? undefined
    : value.trim();
}

/**
 * ACME commits at an expected revision with compare-and-swap, and holds a
 * connection across the statements that make one transaction. Supavisor's
 * transaction pooler hands a different backend to each statement, so the
 * guarantee this product's persistence rests on would be silently absent.
 * Refuse before the first migration rather than discover it under contention.
 */
function refuseTransactionPooler(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('ACME_V2_POSTGRES_URL is not a valid URL.');
  }
  if (parsed.port === TRANSACTION_POOLER_PORT)
    throw new Error(
      `ACME_V2_POSTGRES_URL points at port ${TRANSACTION_POOLER_PORT}, the ` +
        'transaction pooler. ACME commits at an expected revision and needs a ' +
        'session-scoped connection; use the session pooler on port 5432 or a ' +
        'direct PostgreSQL connection.',
    );
}

const ORGANIZATION_ROLES = new Set<EvidenceV2Account['organizationRole']>([
  'organization-admin',
  'reviewer',
  'viewer',
]);

function isOrganizationRole(
  value: unknown,
): value is EvidenceV2Account['organizationRole'] {
  return (
    typeof value === 'string' &&
    ORGANIZATION_ROLES.has(value as EvidenceV2Account['organizationRole'])
  );
}

/**
 * Development credentials, in a mounted file rather than in the composition.
 * This is the account source ACME-0153 recorded as a known gap; replacing it
 * with the running Supabase Auth is ACME-0163, not this task.
 */
function readAccounts(source: string): EvidenceV2LocalOptions['accounts'] {
  const parsed: unknown = JSON.parse(source);
  if (!Array.isArray(parsed) || parsed.length === 0)
    throw new Error('ACME_V2_ACCOUNTS_FILE must hold a non-empty JSON array.');
  return parsed.map((entry, index) => {
    const account = entry as Record<string, unknown>;
    for (const field of ['email', 'password', 'subject', 'displayLabel']) {
      const value = account[field];
      if (typeof value !== 'string' || value.length === 0)
        throw new Error(`Account ${String(index)} is missing "${field}".`);
    }
    const role = account['organizationRole'];
    if (!isOrganizationRole(role))
      throw new Error(
        `Account ${String(index)} needs organizationRole of ` +
          'organization-admin, reviewer or viewer.',
      );
    return {
      email: String(account['email']),
      password: String(account['password']),
      subject: String(account['subject']),
      displayLabel: String(account['displayLabel']),
      organizationRole: role,
    };
  });
}

async function buildObjectStore(): Promise<
  EvidenceV2LocalOptions['objectStore']
> {
  const kind = optional('ACME_V2_OBJECT_STORE', 's3');
  if (kind === 'file')
    return { kind: 'file', root: required('ACME_V2_OBJECT_ROOT') };
  if (kind !== 's3')
    throw new Error('ACME_V2_OBJECT_STORE must be "s3" or "file".');
  return {
    kind: 's3',
    endpoint: required('ACME_V2_S3_ENDPOINT'),
    region: optional('ACME_V2_S3_REGION', 'us-east-1'),
    bucket: required('ACME_V2_S3_BUCKET'),
    accessKeyId: required('ACME_V2_S3_ACCESS_KEY_ID'),
    secretAccessKey: await secret('ACME_V2_S3_SECRET_ACCESS_KEY'),
  };
}

/**
 * Live capability is opt-in and conjunctive: without a model and a key this
 * deployment has no extraction and the route answers 501, which is the
 * required fail-closed behaviour rather than a degraded mode.
 */
async function buildLive(): Promise<EvidenceV2LocalOptions['live']> {
  const model = process.env['ACME_V2_LIVE_MODEL'];
  if (model === undefined || model.trim().length === 0) return undefined;
  const apiKey = await optionalSecret('OPENAI_API_KEY');
  if (apiKey === undefined)
    throw new Error(
      'ACME_V2_LIVE_MODEL is set but OPENAI_API_KEY is not. Live capability ' +
        'fails closed rather than starting without a provider.',
    );
  const payloadKeyBase64 = await optionalSecret('ACME_V2_LEDGER_PAYLOAD_KEY');
  const ceiling = process.env['ACME_V2_EMERGENCY_CALL_CEILING'];
  return {
    apiKey,
    model: model.trim(),
    ledgerSchema: optional('ACME_V2_LEDGER_SCHEMA', 'acme_v2_ledger'),
    ...(payloadKeyBase64 === undefined
      ? {}
      : { payloadKeyBase64, payloadKeyId: 'evidence-v2-ledger' }),
    ...(ceiling === undefined ? {} : { emergencyCallCeiling: Number(ceiling) }),
  };
}

export async function startFromEnvironment(): Promise<{
  readonly port: number;
  close(): Promise<void>;
}> {
  const postgresUrl = required('ACME_V2_POSTGRES_URL');
  refuseTransactionPooler(postgresUrl);

  const schema = optional('ACME_V2_SCHEMA', 'evidence_v2');
  const identitySchema = optional(
    'ACME_V2_IDENTITY_SCHEMA',
    'evidence_v2_identity',
  );
  const objectStore = await buildObjectStore();
  const live = await buildLive();

  const handle = await startEvidenceV2Local({
    postgresUrl,
    schema,
    identitySchema,
    port: Number(optional('ACME_V2_PORT', '8795')),
    objectStore,
    kekBase64: await secret('ACME_V2_KEK'),
    kekId: optional('ACME_V2_KEK_ID', 'evidence-v2-kek'),
    sessionKeyBase64: await secret('ACME_V2_SESSION_KEY'),
    organizationLabel: optional('ACME_V2_ORGANIZATION_LABEL', 'ACME V2'),
    accounts: readAccounts(
      await readFile(required('ACME_V2_ACCOUNTS_FILE'), 'utf8'),
    ),
    ...(live === undefined ? {} : { live }),
  });

  process.stdout.write(
    [
      'evidence-workbench-v2-api listening',
      `  url            http://127.0.0.1:${String(handle.port)}`,
      `  schema         ${schema}`,
      `  identity       ${identitySchema}`,
      `  objects        ${
        objectStore.kind === 's3'
          ? `s3 ${objectStore.bucket} @ ${objectStore.endpoint}`
          : `file ${objectStore.root}`
      }`,
      `  live model     ${live === undefined ? 'none (extraction answers 501)' : live.model}`,
      '',
    ].join('\n'),
  );

  return handle;
}

const entry = process.argv[1];
const invokedDirectly =
  entry !== undefined && import.meta.url === pathToFileURL(entry).href;

if (invokedDirectly) {
  const handle = await startFromEnvironment();
  const stop = (): void => {
    void handle.close().then(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
