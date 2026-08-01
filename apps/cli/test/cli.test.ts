import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  computeModelRequestHash,
  createAes256GcmPayloadEncryptor,
  deriveExecutionId,
  type IdGenerator,
} from '@acme/core';
import type { ProviderTransport } from '@acme/adapter-model-openai';
import {
  narrativeObserveDocumentContract,
  narrativeObserveDocumentTask,
} from '@acme/module-narrative';
import { afterEach, describe, expect, it } from 'vitest';

import {
  CLI_OUTPUT_VERSION,
  EXIT_OK,
  EXIT_OUTCOME,
  EXIT_USAGE,
  REDACTED,
  run,
  type RunOptions,
} from '../src/index.js';

const testPayloadEncryptor = createAes256GcmPayloadEncryptor({
  key: new Uint8Array(32).fill(0xac),
  keyId: 'cli-test-payload-key',
});

const now = '2026-07-31T12:00:00.000Z';
const entityId = 'cli-story-1';
const requestKey = 'cli-request-1';
const namespace = 'narrative';
const selection = { profile: 'offline-json' };

const input = {
  documentKey: 'cli-chapter-1',
  title: 'Northern Light',
  text: 'Mira tells Ion that her eyes are green. The northern light reveals hidden paths.',
};

const output = {
  observations: [
    {
      type: 'character-fact',
      subject: 'Mira',
      predicate: 'eye color',
      value: 'green',
      confidence: 0.9,
    },
  ],
  scene: {
    location: 'Observatory',
    time: 'Night',
    summary: 'Mira shares the northern-light rule with Ion.',
  },
};

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop() ?? '', { recursive: true, force: true });
  }
});

function workspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'acme-cli-'));
  roots.push(root);
  return root;
}

function createIds(): IdGenerator {
  const counts: Record<string, number> = {};
  return {
    next(kind) {
      counts[kind] = (counts[kind] ?? 0) + 1;
      return `${kind}-cli-${String(counts[kind]).padStart(3, '0')}`;
    },
  };
}

function capture(): {
  readonly options: RunOptions;
  readonly out: string[];
  readonly err: string[];
} {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    options: {
      io: {
        stdout: (line) => out.push(line),
        stderr: (line) => err.push(line),
      },
      clock: { now: () => now },
      ids: createIds(),
      payloadEncryptor: testPayloadEncryptor,
    },
  };
}

/** Writes the request and the deterministic script the mock gateway needs. */
async function fixtureFiles(root: string): Promise<{
  readonly requestPath: string;
  readonly scriptPath: string;
  readonly executionId: string;
}> {
  const executionId = deriveExecutionId(namespace, requestKey);
  const contractInput = await narrativeObserveDocumentTask.project(input, {
    executionId,
    entityId,
    now,
    state: null,
    memories: [],
    documents: [],
  });
  const expectedRequestHash = computeModelRequestHash(
    narrativeObserveDocumentContract.buildRequest(contractInput, {
      executionId,
      now,
    }),
  );

  const requestPath = join(root, 'request.json');
  writeFileSync(
    requestPath,
    JSON.stringify({
      requestKey,
      namespace,
      task: 'observe-document',
      entityId,
      expectedRevision: 0,
      input,
      model: selection,
      policy: { retention: 'encrypted-payload' },
    }),
  );

  const scriptPath = join(root, 'script.json');
  writeFileSync(
    scriptPath,
    JSON.stringify({
      profiles: [
        {
          selection,
          capabilities: { structuredOutput: true, tools: false, vision: false },
        },
      ],
      calls: [
        {
          executionId,
          callKey: 'model:0',
          selection,
          expectedRequestHash,
          outcome: {
            kind: 'response',
            response: {
              provider: 'fixture',
              model: 'fixture-json-1',
              receivedAt: now,
              finishReason: 'stop',
              text: JSON.stringify(output),
              usage: {},
              metadata: {},
            },
          },
        },
      ],
    }),
  );

  return { requestPath, scriptPath, executionId };
}

describe('acme CLI usage', () => {
  it('prints usage for help and exits successfully', async () => {
    const io = capture();
    await expect(run(['help'], io.options)).resolves.toBe(EXIT_OK);
    expect(io.out.join('\n')).toContain('acme execute --request');
  });

  it.each([
    [['nonsense'], 'Unknown command'],
    [['execute'], 'requires --request'],
    [
      ['execute', '--request', 'r.json'],
      'requires --script <file> or --gateway',
    ],
    [
      [
        'execute',
        '--request',
        'r.json',
        '--script',
        's.json',
        '--gateway',
        'openai',
      ],
      'either --script or --gateway',
    ],
    [
      ['execute', '--request', 'r.json', '--gateway', 'nope'],
      '--gateway must be openai',
    ],
    [['execution', 'replay'], 'Missing required argument'],
    [['execution', 'wander', 'x'], 'Unknown execution action'],
    [['state', 'inspect', 'ns'], 'Missing required argument'],
    [
      [
        'execute',
        '--request',
        'r.json',
        '--script',
        's.json',
        '--adapter',
        'nope',
      ],
      '--adapter must be',
    ],
    [
      [
        'execute',
        '--request',
        'r.json',
        '--script',
        's.json',
        '--adapter',
        'sqlite',
      ],
      'requires --database',
    ],
    [
      [
        'execute',
        '--request',
        'r.json',
        '--script',
        's.json',
        '--database',
        'x.db',
      ],
      'only meaningful',
    ],
    [['execute', '--unknown-flag'], 'Unknown'],
  ])('rejects %j as a usage error', async (argv, fragment) => {
    const io = capture();
    await expect(run(argv, io.options)).resolves.toBe(EXIT_USAGE);
    expect(io.err.join('\n')).toContain(fragment);
    expect(io.out).toEqual([]);
  });

  it('reports a missing execution as a usage error', async () => {
    const io = capture();
    await expect(
      run(['execution', 'inspect', 'missing'], io.options),
    ).resolves.toBe(EXIT_USAGE);
    expect(io.err.join('\n')).toContain('No execution found');
  });

  it('refuses --gateway openai when OPENAI_API_KEY is absent', async () => {
    const root = workspace();
    const requestPath = join(root, 'live-request.json');
    writeFileSync(
      requestPath,
      JSON.stringify({
        requestKey: 'cli-live-missing-key',
        namespace,
        task: 'observe-document',
        entityId,
        expectedRevision: 0,
        input,
        model: selection,
      }),
    );
    const io = capture();
    const previous = process.env['OPENAI_API_KEY'];
    delete process.env['OPENAI_API_KEY'];
    try {
      await expect(
        run(
          ['execute', '--request', requestPath, '--gateway', 'openai'],
          io.options,
        ),
      ).resolves.toBe(EXIT_USAGE);
      expect(io.err.join('\n')).toContain('OPENAI_API_KEY');
      expect(io.out).toEqual([]);
    } finally {
      if (previous === undefined) {
        delete process.env['OPENAI_API_KEY'];
      } else {
        process.env['OPENAI_API_KEY'] = previous;
      }
    }
  });
});

describe('acme CLI execute', () => {
  it('commits through the in-memory adapter and reports versioned JSON', async () => {
    const root = workspace();
    const files = await fixtureFiles(root);
    const io = capture();

    await expect(
      run(
        [
          'execute',
          '--request',
          files.requestPath,
          '--script',
          files.scriptPath,
          '--json',
        ],
        io.options,
      ),
    ).resolves.toBe(EXIT_OK);

    const body = JSON.parse(io.out.join('\n')) as {
      version: string;
      command: string;
      result: { status: string; executionId: string; revision: number };
    };
    expect(body.version).toBe(CLI_OUTPUT_VERSION);
    expect(body.command).toBe('execute');
    expect(body.result).toMatchObject({
      status: 'committed',
      executionId: files.executionId,
      revision: 1,
    });
    expect(io.err).toEqual([]);
  });

  it('prints a text summary when --json is absent', async () => {
    const root = workspace();
    const files = await fixtureFiles(root);
    const io = capture();

    await expect(
      run(
        [
          'execute',
          '--request',
          files.requestPath,
          '--script',
          files.scriptPath,
        ],
        io.options,
      ),
    ).resolves.toBe(EXIT_OK);
    expect(io.out[0]).toBe(`committed ${files.executionId}`);
    expect(io.out).toContain('revision 1');
  });

  it('exits with the outcome code when the request cannot commit', async () => {
    const root = workspace();
    const files = await fixtureFiles(root);
    const stalePath = join(root, 'stale.json');
    writeFileSync(
      stalePath,
      JSON.stringify({
        requestKey: 'cli-stale',
        namespace,
        task: 'observe-document',
        entityId,
        expectedRevision: 7,
        input,
        model: selection,
      }),
    );
    const io = capture();

    await expect(
      run(
        ['execute', '--request', stalePath, '--script', files.scriptPath],
        io.options,
      ),
    ).resolves.toBe(EXIT_OUTCOME);
    expect(io.out.join('\n')).toContain('conflicted');
  });

  it('reports an unreadable request as a usage error', async () => {
    const io = capture();
    await expect(
      run(
        ['execute', '--request', 'missing.json', '--script', 'missing.json'],
        io.options,
      ),
    ).resolves.toBe(EXIT_USAGE);
    expect(io.err.join('\n')).toContain('Could not read the request file');
  });

  it('commits through --gateway openai with an injected offline transport', async () => {
    const root = workspace();
    const requestPath = join(root, 'openai-request.json');
    writeFileSync(
      requestPath,
      JSON.stringify({
        requestKey: 'cli-openai-offline',
        namespace,
        task: 'observe-document',
        entityId,
        expectedRevision: 0,
        input,
        model: selection,
        policy: { retention: 'encrypted-payload' },
      }),
    );

    const body = JSON.stringify({
      id: 'resp_cli_offline',
      model: 'gpt-fixture-1',
      status: 'completed',
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: JSON.stringify(output) }],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
    });
    const transport: ProviderTransport = {
      async send() {
        return { kind: 'response', status: 200, headers: {}, body };
      },
    };

    const io = capture();
    const previous = process.env['OPENAI_API_KEY'];
    process.env['OPENAI_API_KEY'] = 'test-not-a-real-key';
    try {
      await expect(
        run(
          [
            'execute',
            '--request',
            requestPath,
            '--gateway',
            'openai',
            '--json',
          ],
          {
            ...io.options,
            openAiTransport: transport,
            openAiModel: 'gpt-fixture-1',
          },
        ),
      ).resolves.toBe(EXIT_OK);
      const report = JSON.parse(io.out.join('\n')) as {
        result: { status: string; revision: number };
      };
      expect(report.result).toMatchObject({ status: 'committed', revision: 1 });
    } finally {
      if (previous === undefined) {
        delete process.env['OPENAI_API_KEY'];
      } else {
        process.env['OPENAI_API_KEY'] = previous;
      }
    }
  });
});

describe('acme CLI durable round trip', () => {
  it('executes, replays and inspects one SQLite database', async () => {
    const root = workspace();
    const database = join(root, 'acme.sqlite');
    const files = await fixtureFiles(root);
    const sqlite = ['--adapter', 'sqlite', '--database', database];

    const executeIo = capture();
    await expect(
      run(
        [
          'execute',
          '--request',
          files.requestPath,
          '--script',
          files.scriptPath,
          ...sqlite,
        ],
        executeIo.options,
      ),
    ).resolves.toBe(EXIT_OK);

    // A fresh process would open the same file; each run closes its connection.
    const replayIo = capture();
    await expect(
      run(
        [
          'execution',
          'replay',
          files.executionId,
          '--mode',
          'verify',
          '--json',
          ...sqlite,
        ],
        replayIo.options,
      ),
    ).resolves.toBe(EXIT_OK);
    const report = JSON.parse(replayIo.out.join('\n')) as {
      report: { status: string; recordedDigest: string; replayDigest: string };
    };
    expect(report.report.status).toBe('match');
    expect(report.report.recordedDigest).toBe(report.report.replayDigest);

    const inspectIo = capture();
    await expect(
      run(
        ['execution', 'inspect', files.executionId, '--json', ...sqlite],
        inspectIo.options,
      ),
    ).resolves.toBe(EXIT_OK);
    const inspected = JSON.parse(inspectIo.out.join('\n')) as {
      execution: { status: string; input: unknown };
      documents: { value: unknown }[];
      modelCalls: { status: string }[];
    };
    expect(inspected.execution.status).toBe('committed');
    expect(inspected.modelCalls[0]?.status).toBe('succeeded');

    // Redaction is the default, including for the recorded request input.
    expect(inspected.execution.input).toBe(REDACTED);
    expect(inspected.documents[0]?.value).toBe(REDACTED);

    const shownIo = capture();
    await expect(
      run(
        [
          'execution',
          'inspect',
          files.executionId,
          '--show-payloads',
          '--json',
          ...sqlite,
        ],
        shownIo.options,
      ),
    ).resolves.toBe(EXIT_OK);
    const shown = JSON.parse(shownIo.out.join('\n')) as {
      execution: { input: { documentKey: string } };
    };
    expect(shown.execution.input.documentKey).toBe('cli-chapter-1');

    const stateIo = capture();
    await expect(
      run(
        ['state', 'inspect', namespace, entityId, '--json', ...sqlite],
        stateIo.options,
      ),
    ).resolves.toBe(EXIT_OK);
    const state = JSON.parse(stateIo.out.join('\n')) as {
      snapshots: { revision: number; value: unknown }[];
    };
    expect(state.snapshots).toHaveLength(1);
    expect(state.snapshots[0]?.revision).toBe(1);
    expect(state.snapshots[0]?.value).toBe(REDACTED);

    const memoryIo = capture();
    await expect(
      run(
        [
          'memory',
          'inspect',
          namespace,
          entityId,
          '--status',
          'active',
          '--json',
          ...sqlite,
        ],
        memoryIo.options,
      ),
    ).resolves.toBe(EXIT_OK);
    const memory = JSON.parse(memoryIo.out.join('\n')) as {
      records: { status: string; value: unknown }[];
    };
    expect(memory.records.length).toBeGreaterThan(0);
    expect(memory.records[0]?.status).toBe('active');
    expect(memory.records[0]?.value).toBe(REDACTED);
  });

  it('reports the outcome code when nothing matches an inspection filter', async () => {
    const root = workspace();
    const database = join(root, 'empty.sqlite');
    const io = capture();
    await expect(
      run(
        [
          'state',
          'inspect',
          namespace,
          'absent-entity',
          '--adapter',
          'sqlite',
          '--database',
          database,
        ],
        io.options,
      ),
    ).resolves.toBe(EXIT_OUTCOME);
    expect(io.out.join('\n')).toContain('no state snapshots found');
  });
});
