#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

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

const USAGE = `acme-mcp-server --script <file> [--grants <file>] [--profile <name>]
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
               encrypted-payload, which needs ACME_PAYLOAD_KEY.`;

class UsageError extends Error {}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

interface Options {
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

function parseArgs(argv: readonly string[]): Options {
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
function payloadEncryptorFromEnv(): PayloadEncryptor | undefined {
  const encoded = process.env['ACME_PAYLOAD_KEY'];
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
    keyId: process.env['ACME_PAYLOAD_KEY_ID'] ?? 'env-default',
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

function parseGrants(value: JsonValue): ReadAllowList {
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

export async function main(argv: readonly string[]): Promise<number> {
  let options: Options;
  try {
    options = parseArgs(argv);
  } catch (error: unknown) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Invalid arguments.'}\n${USAGE}\n`,
    );
    return 2;
  }

  try {
    const script = await readJson(options.script, 'script');
    const gateway = createScriptedModelGateway(
      script as unknown as Parameters<typeof createScriptedModelGateway>[0],
    );
    const readAllowList =
      options.grants === undefined
        ? EMPTY_READ_ALLOW_LIST
        : parseGrants(await readJson(options.grants, 'grants'));
    const payloadEncryptor = payloadEncryptorFromEnv();
    if (
      options.retention === 'encrypted-payload' &&
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
      modelSelection: { profile: options.profile },
      retention: options.retention,
      readAllowList,
    });
    await serveStdio({
      input: process.stdin,
      output: process.stdout,
      server,
    });
    return 0;
  } catch (error: unknown) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Unexpected failure.'}\n`,
    );
    return 1;
  }
}

process.exitCode = await main(process.argv.slice(2));
