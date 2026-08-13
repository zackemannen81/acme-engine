import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';

import { deriveExecutionId, type JsonValue } from '@acme/core';
import { describe, expect, it } from 'vitest';

import { EXIT_FAILURE, EXIT_OK, EXIT_USAGE, run } from '../src/run.js';
import {
  createClient,
  expectedRequestHash,
  handshake,
  PAYLOAD_KEY_BASE64,
  resultOf,
  structured,
  type JsonRpcClient,
} from './harness.js';

const EXAMPLE_SCRIPT = fileURLToPath(
  new URL('../example/script.json', import.meta.url),
);
const EXAMPLE_GRANTS = fileURLToPath(
  new URL('../example/grants.json', import.meta.url),
);
const EXAMPLE_SESSION = fileURLToPath(
  new URL('../example/session.jsonl', import.meta.url),
);
const BINARY = fileURLToPath(new URL('../dist/main.js', import.meta.url));

const EXAMPLE_ENTITY_ID = 'demo-story';
const EXAMPLE_REQUEST_KEY = 'demo-observe-1';
const EXAMPLE_EXECUTION_ID = deriveExecutionId(
  'narrative',
  EXAMPLE_REQUEST_KEY,
);
/**
 * Every test below drives the checked-in example rather than a copy of it, so
 * "the example works" and "the tests pass" cannot drift apart.
 */
async function exampleToolCall(
  name: string,
): Promise<Record<string, JsonValue>> {
  const session = await readFile(EXAMPLE_SESSION, 'utf8');
  const call = session
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, JsonValue>)
    .find(
      (message) =>
        message['method'] === 'tools/call' &&
        (message['params'] as Record<string, JsonValue> | undefined)?.[
          'name'
        ] === name,
    );
  if (call === undefined) {
    throw new Error(`The example session has no ${name} call.`);
  }
  return call['params'] as Record<string, JsonValue>;
}

interface RunHarness {
  readonly client: JsonRpcClient;
  code(): Promise<number>;
  stderr(): string;
}

function startInProcess(
  argv: readonly string[],
  env: Record<string, string | undefined> = {},
): RunHarness {
  const input = new PassThrough();
  const output = new PassThrough();
  const errors: string[] = [];
  const finished = run(argv, {
    input,
    output,
    stderr: (line) => errors.push(line),
    env,
  });
  return {
    client: createClient(input, output, finished),
    code: () => finished,
    stderr: () => errors.join('\n'),
  };
}

async function runToCompletion(
  argv: readonly string[],
  env: Record<string, string | undefined> = {},
): Promise<{ code: number; stderr: string }> {
  const harness = startInProcess(argv, env);
  await harness.client.close();
  return { code: await harness.code(), stderr: harness.stderr() };
}

describe('the entry point a person actually starts', () => {
  it('starts the published binary as a real process and answers the example session', async () => {
    expect(
      existsSync(BINARY),
      `${BINARY} is missing. Run "corepack pnpm build" first: this test drives the same file package.json#bin points at.`,
    ).toBe(true);

    const session = await readFile(EXAMPLE_SESSION, 'utf8');
    const child = spawn(
      process.execPath,
      [BINARY, '--script', EXAMPLE_SCRIPT, '--grants', EXAMPLE_GRANTS],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.stdin.end(session);

    const code = await new Promise<number | null>((resolve) => {
      child.on('close', resolve);
    });

    expect(stderr).not.toContain('acme-mcp-server --script');
    expect(code).toBe(EXIT_OK);

    const replies = stdout
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as JsonValue);
    // Five requests and one notification went in. A notification is answered
    // with nothing, so exactly five lines come back, in order.
    expect(
      replies.map((reply) => (reply as Record<string, JsonValue>)['id']),
    ).toEqual([1, 2, 3, 4, 5]);

    expect(resultOf(replies[0] as JsonValue)['protocolVersion']).toBe(
      '2025-06-18',
    );
    expect(
      (resultOf(replies[1] as JsonValue)['tools'] as readonly unknown[]).length,
    ).toBe(3);

    const execute = structured(replies[2] as JsonValue)['result'] as Record<
      string,
      JsonValue
    >;
    expect(execute['status']).toBe('committed');
    expect(execute['executionId']).toBe(EXAMPLE_EXECUTION_ID);
    expect(execute['revision']).toBe(1);

    const read = structured(replies[3] as JsonValue);
    expect((read['state'] as Record<string, JsonValue>)['revision']).toBe(1);
    const memories = read['memories'] as readonly Record<string, JsonValue>[];
    expect(memories.map((memory) => memory['kind'])).toEqual([
      'narrative.character-fact',
    ]);

    // The example runs on the default retention, so the honest answer to "can
    // you prove this execution" is "no evidence was kept".
    const report = structured(replies[4] as JsonValue)['report'] as Record<
      string,
      JsonValue
    >;
    expect(report['status']).toBe('unavailable');
  }, 60_000);

  it('keeps the checked-in example script honest about the current contract', async () => {
    // The mock gateway needs an exact request hash a human cannot compute. If
    // the narrative contract or its input projection changes, the checked-in
    // example silently stops working. This fails loudly instead, and prints the
    // hash to paste in.
    const params = await exampleToolCall('acme_execute_task');
    const args = params['arguments'] as Record<string, JsonValue>;
    const current = await expectedRequestHash(
      args['input'] as Parameters<typeof expectedRequestHash>[0],
    );
    const script = JSON.parse(await readFile(EXAMPLE_SCRIPT, 'utf8')) as {
      calls: readonly { expectedRequestHash: string }[];
    };
    for (const call of script.calls) {
      expect(call.expectedRequestHash).toBe(current);
    }
    expect(args['entityId']).toBe(EXAMPLE_ENTITY_ID);
    expect(args['requestKey']).toBe(EXAMPLE_REQUEST_KEY);
  });

  it('serves a full session in-process through the same run() the binary calls', async () => {
    const harness = startInProcess([
      '--script',
      EXAMPLE_SCRIPT,
      '--grants',
      EXAMPLE_GRANTS,
    ]);
    try {
      await handshake(harness.client);
      const listed = resultOf(await harness.client.send('tools/list'));
      expect((listed['tools'] as readonly unknown[]).length).toBe(3);
    } finally {
      await harness.client.close();
    }
    expect(await harness.code()).toBe(EXIT_OK);
  });
});

describe('retention is a deployment decision the entry point makes', () => {
  it('defaults to hash-only, so verification is unavailable and names the retention', async () => {
    const harness = startInProcess([
      '--script',
      EXAMPLE_SCRIPT,
      '--grants',
      EXAMPLE_GRANTS,
    ]);
    try {
      await handshake(harness.client);
      await harness.client.send(
        'tools/call',
        await exampleToolCall('acme_execute_task'),
      );
      const response = await harness.client.send('tools/call', {
        name: 'acme_verify_execution',
        arguments: { executionId: EXAMPLE_EXECUTION_ID },
      });
      const report = structured(response)['report'] as Record<
        string,
        JsonValue
      >;
      expect(report['status']).toBe('unavailable');
      const differences = report['differences'] as readonly Record<
        string,
        JsonValue
      >[];
      expect(differences[0]?.['code']).toBe(
        'REPLAY_MODEL_RESPONSE_UNAVAILABLE',
      );
      expect(differences[0]?.['value']).toEqual({ retention: 'hash-only' });
    } finally {
      await harness.client.close();
    }
  });

  it('reaches a real replay match only under encrypted-payload with a key', async () => {
    const harness = startInProcess(
      [
        '--script',
        EXAMPLE_SCRIPT,
        '--grants',
        EXAMPLE_GRANTS,
        '--retention',
        'encrypted-payload',
      ],
      { ACME_PAYLOAD_KEY: PAYLOAD_KEY_BASE64 },
    );
    try {
      await handshake(harness.client);
      await harness.client.send(
        'tools/call',
        await exampleToolCall('acme_execute_task'),
      );
      const response = await harness.client.send('tools/call', {
        name: 'acme_verify_execution',
        arguments: { executionId: EXAMPLE_EXECUTION_ID },
      });
      const report = structured(response)['report'] as Record<
        string,
        JsonValue
      >;
      expect(report['status']).toBe('match');
      expect(report['recordedDigest']).toBe(report['replayDigest']);
    } finally {
      await harness.client.close();
    }
    expect(await harness.code()).toBe(EXIT_OK);
  });

  it('refuses encrypted-payload retention without a key, before serving anything', async () => {
    const { code, stderr } = await runToCompletion([
      '--script',
      EXAMPLE_SCRIPT,
      '--retention',
      'encrypted-payload',
    ]);
    expect(code).toBe(EXIT_USAGE);
    expect(stderr).toContain('ACME_PAYLOAD_KEY');
  });

  it('rejects a key that is not 32 bytes rather than serving with a weak one', async () => {
    const { code, stderr } = await runToCompletion(
      ['--script', EXAMPLE_SCRIPT, '--retention', 'encrypted-payload'],
      { ACME_PAYLOAD_KEY: Buffer.alloc(16).toString('base64') },
    );
    expect(code).toBe(EXIT_USAGE);
    expect(stderr).toContain('32 bytes');
  });

  it('rejects an unknown retention, a missing script and an unreadable script', async () => {
    const bad = await runToCompletion([
      '--script',
      EXAMPLE_SCRIPT,
      '--retention',
      'keep-everything',
    ]);
    expect(bad.code).toBe(EXIT_USAGE);
    expect(bad.stderr).toContain('--retention must be one of');

    const missing = await runToCompletion([]);
    expect(missing.code).toBe(EXIT_USAGE);
    expect(missing.stderr).toContain('--script is required');

    const unreadable = await runToCompletion(['--script', 'no-such-file.json']);
    expect(unreadable.code).toBe(EXIT_USAGE);
    expect(unreadable.stderr).toContain('Could not read the script file');
  });

  it('fails rather than serving when the script itself is rejected', async () => {
    const { code, stderr } = await runToCompletion([
      '--script',
      EXAMPLE_GRANTS,
    ]);
    expect(code).toBe(EXIT_FAILURE);
    expect(stderr.length).toBeGreaterThan(0);
  });
});
