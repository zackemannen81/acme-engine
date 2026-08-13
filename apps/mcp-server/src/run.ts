import { readFile } from 'node:fs/promises';
import type { Readable, Writable } from 'node:stream';

import {
  createAes256GcmPayloadEncryptor,
  type ExecutionPolicy,
  type JsonValue,
  type PayloadEncryptor,
} from '@acme/core';
import { createScriptedModelGateway } from '@acme/adapter-model-mock';

import { createComposition } from './composition.js';
import {
  EMPTY_READ_ALLOW_LIST,
  type EntityReadGrant,
  type ReadAllowList,
} from './read-allow-list.js';
import { createMcpServer } from './server.js';
import { serveStdio } from './stdio.js';

export const EXIT_OK = 0;
export const EXIT_FAILURE = 1;
export const EXIT_USAGE = 2;

export const USAGE = `acme-mcp-server --script <file> [--grants <file>] [--profile <name>]
                 [--retention none|hash-only|encrypted-payload]

Serves the ACME engine over MCP (JSON-RPC 2.0, newline-delimited, stdio).

  --script     Deterministic model script for the mock gateway. Required: an
               MCP consumer must never be able to cause a live provider call.
  --grants     Read allow-list. Without it every acme_read_entity is refused,
               because the engine cannot decide disclosure for a consumer it
               has no way to identify.
  --profile    Model selection profile (default: offline-json).
  --retention  Payload retention for every execution (default: hash-only).
               acme_verify_execution can only reach "match" under
               encrypted-payload, which needs ACME_PAYLOAD_KEY.

Retention is a server flag and not a tool argument on purpose. A consumer that
could choose "encrypted-payload" could make the deployment retain model payloads
it never agreed to hold; a consumer that could choose "none" could destroy the
replay evidence for its own execution. Both are the deployment's decision.`;

export class UsageError extends Error {}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export interface Options {
  readonly script: string;
  readonly grants: string | undefined;
  readonly profile: string;
  readonly retention: ExecutionPolicy['retention'];
}

const RETENTIONS: readonly ExecutionPolicy['retention'][] = [
  'none',
  'hash-only',
  'encrypted-payload',
];

export function parseArgs(argv: readonly string[]): Options {
  let script: string | undefined;
  let grants: string | undefined;
  let profile = 'offline-json';
  let retention: ExecutionPolicy['retention'] = 'hash-only';
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (
      flag === '--script' ||
      flag === '--grants' ||
      flag === '--profile' ||
      flag === '--retention'
    ) {
      if (value === undefined) {
        throw new UsageError(`${flag} requires a value.`);
      }
      index += 1;
      if (flag === '--script') {
        script = value;
      } else if (flag === '--grants') {
        grants = value;
      } else if (flag === '--profile') {
        profile = value;
      } else {
        const candidate = RETENTIONS.find((entry) => entry === value);
        if (candidate === undefined) {
          throw new UsageError(
            `--retention must be one of ${RETENTIONS.join(', ')}.`,
          );
        }
        retention = candidate;
      }
      continue;
    }
    throw new UsageError(`Unknown argument: ${String(flag)}.`);
  }
  if (script === undefined) {
    throw new UsageError('--script is required.');
  }
  return { script, grants, profile, retention };
}

/**
 * Composition owns key acquisition; core never reads the environment.
 * `ACME_PAYLOAD_KEY` is 32 raw bytes as base64.
 */
function payloadEncryptorFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): PayloadEncryptor | undefined {
  const encoded = env['ACME_PAYLOAD_KEY'];
  if (encoded === undefined || encoded.trim().length === 0) {
    return undefined;
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.byteLength !== 32) {
    throw new UsageError(
      'ACME_PAYLOAD_KEY must decode to exactly 32 bytes (AES-256).',
    );
  }
  return createAes256GcmPayloadEncryptor({
    key: new Uint8Array(key),
    keyId: env['ACME_PAYLOAD_KEY_ID'] ?? 'env-default',
  });
}

async function readJson(path: string, label: string): Promise<JsonValue> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    throw new UsageError(`Could not read the ${label} file: ${path}`);
  }
  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    throw new UsageError(`The ${label} file is not valid JSON: ${path}`);
  }
}

export function parseGrants(value: JsonValue): ReadAllowList {
  if (!isObject(value) || !Array.isArray(value['grants'])) {
    throw new UsageError('The grants file must be { "grants": [ ... ] }.');
  }
  const grants = value['grants'].map((entry, index): EntityReadGrant => {
    if (
      !isObject(entry) ||
      typeof entry['namespace'] !== 'string' ||
      typeof entry['entityId'] !== 'string' ||
      typeof entry['state'] !== 'boolean' ||
      typeof entry['memoryValues'] !== 'boolean' ||
      !Array.isArray(entry['memoryKinds']) ||
      entry['memoryKinds'].some((kind) => typeof kind !== 'string')
    ) {
      throw new UsageError(`Grant ${String(index)} has an invalid shape.`);
    }
    return {
      namespace: entry['namespace'],
      entityId: entry['entityId'],
      state: entry['state'],
      memoryKinds: entry['memoryKinds'] as readonly string[],
      memoryValues: entry['memoryValues'],
    };
  });
  return { grants };
}

/**
 * Everything the process supplies, injected. The binary is a shim over this so
 * a test can drive the real argument parsing, the real key acquisition and the
 * real serve loop without spawning, exactly as `@acme/cli` does.
 */
export interface RunOptions {
  readonly input: Readable;
  readonly output: Writable;
  readonly stderr: (line: string) => void;
  readonly env: Readonly<Record<string, string | undefined>>;
}

export async function run(
  argv: readonly string[],
  options: RunOptions,
): Promise<number> {
  let parsed: Options;
  try {
    parsed = parseArgs(argv);
  } catch (error: unknown) {
    options.stderr(
      error instanceof Error ? error.message : 'Invalid arguments.',
    );
    options.stderr(USAGE);
    return EXIT_USAGE;
  }

  try {
    const script = await readJson(parsed.script, 'script');
    const gateway = createScriptedModelGateway(
      script as unknown as Parameters<typeof createScriptedModelGateway>[0],
    );
    const readAllowList =
      parsed.grants === undefined
        ? EMPTY_READ_ALLOW_LIST
        : parseGrants(await readJson(parsed.grants, 'grants'));
    const payloadEncryptor = payloadEncryptorFromEnv(options.env);
    if (
      parsed.retention === 'encrypted-payload' &&
      payloadEncryptor === undefined
    ) {
      throw new UsageError(
        '--retention encrypted-payload requires ACME_PAYLOAD_KEY in the environment.',
      );
    }
    const composition = createComposition(
      payloadEncryptor === undefined ? {} : { payloadEncryptor },
    );
    const server = createMcpServer({
      composition,
      gateway,
      modelSelection: { profile: parsed.profile },
      retention: parsed.retention,
      readAllowList,
    });
    await serveStdio({
      input: options.input,
      output: options.output,
      server,
    });
    return EXIT_OK;
  } catch (error: unknown) {
    options.stderr(
      error instanceof Error ? error.message : 'Unexpected failure.',
    );
    // A refused configuration is a usage error even when it is only detectable
    // after reading a file or the environment. Anything else — a script the
    // mock gateway rejects, a repository that will not open — is a failure.
    return error instanceof UsageError ? EXIT_USAGE : EXIT_FAILURE;
  }
}
