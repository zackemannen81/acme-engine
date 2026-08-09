import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  computeModelRequestHash,
  computeOperationDigest,
  createAes256GcmPayloadEncryptor,
  deriveExecutionId,
  type IdGenerator,
  type PreparedCommitContent,
} from '@acme/core';
import type { ProviderTransport } from '@acme/adapter-model-openai';
import {
  createSqliteExecutionRepository,
  openDatabase,
} from '@acme/adapter-sqlite';
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

/**
 * Commits one domain event straight into a database file, because neither
 * reference module emits events yet. The CLI then opens the same file.
 */
async function seedOutbox(database: string): Promise<void> {
  const connection = openDatabase({ location: database, appliedAt: now });
  try {
    const repository = createSqliteExecutionRepository({
      database: connection,
      ids: createIds(),
    });
    const accepted = {
      executionId: 'execution-cli-outbox',
      request: {
        requestKey: 'cli-outbox-1',
        namespace,
        task: 'observe-document',
        entityId,
        expectedRevision: 0,
        input: { seeded: true },
        model: selection,
      },
      requestFingerprint: 'fingerprint-cli-outbox',
      inputHash: 'input-cli-outbox',
      contract: { id: 'narrative.observe-document', version: '1.0.0' },
      contractFingerprint: 'contract-fingerprint',
      effectivePolicy: {
        timeoutMs: 1_000,
        maxModelCalls: 1,
        maxRepairCalls: 0,
        maxRevisionCalls: 0,
        retention: 'hash-only' as const,
      },
      createdAt: now,
    };
    const content: PreparedCommitContent = {
      executionId: accepted.executionId,
      expectedRevision: 0,
      documents: [],
      memoryCandidates: [],
      memory: { decisions: [], mutations: [] },
      state: null,
      evaluatorRuns: [],
      events: [
        {
          key: 'cli-observed-1',
          type: 'cli.observed',
          schemaVersion: '1.0.0',
          payload: { seeded: true },
        },
      ],
      committedAt: now,
    };
    await repository.accept(accepted);
    await repository.commit({
      ...content,
      operationDigest: computeOperationDigest(content),
    });
  } finally {
    connection.close();
  }
}

/** Non-terminal execution with a reserved primary call — stranded for discharge. */
async function seedStranded(database: string): Promise<string> {
  const executionId = 'execution-cli-stranded';
  const connection = openDatabase({ location: database, appliedAt: now });
  try {
    const repository = createSqliteExecutionRepository({
      database: connection,
      ids: createIds(),
    });
    await repository.accept({
      executionId,
      request: {
        requestKey: 'cli-stranded-1',
        namespace,
        task: 'observe-document',
        entityId,
        expectedRevision: 0,
        input: { seeded: true },
        model: selection,
      },
      requestFingerprint: 'fingerprint-cli-stranded',
      inputHash: 'input-cli-stranded',
      contract: { id: 'narrative.observe-document', version: '1.0.0' },
      contractFingerprint: 'contract-fingerprint',
      effectivePolicy: {
        timeoutMs: 1_000,
        maxModelCalls: 1,
        maxRepairCalls: 0,
        maxRevisionCalls: 0,
        retention: 'hash-only',
      },
      createdAt: now,
    });
    await repository.reserveModelCall({
      modelCallId: 'call-cli-stranded',
      executionId,
      callKey: 'model:0',
      attempt: 1,
      purpose: 'primary',
      selection,
      requestHash: 'request-hash-stranded',
      startedAt: now,
    });
  } finally {
    connection.close();
  }
  return executionId;
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

  it('inspects and drains the outbox of one SQLite database', async () => {
    const root = workspace();
    const database = join(root, 'outbox.sqlite');
    const sqlite = ['--adapter', 'sqlite', '--database', database];
    await seedOutbox(database);

    const inspectIo = capture();
    await expect(
      run(['outbox', 'inspect', '--json', ...sqlite], inspectIo.options),
    ).resolves.toBe(EXIT_OK);
    const inspected = JSON.parse(inspectIo.out.join('\n')) as {
      version: string;
      entries: { status: string; type: string; payload: unknown }[];
    };
    expect(inspected.version).toBe(CLI_OUTPUT_VERSION);
    expect(inspected.entries).toHaveLength(1);
    expect(inspected.entries[0]).toMatchObject({
      status: 'pending',
      type: 'cli.observed',
      payload: REDACTED,
    });

    const drainIo = capture();
    await expect(
      run(
        ['outbox', 'drain', '--json', '--show-payloads', ...sqlite],
        drainIo.options,
      ),
    ).resolves.toBe(EXIT_OK);
    const drained = JSON.parse(drainIo.out.join('\n')) as {
      report: string;
      leased: number;
      delivered: number;
      events: { payload: unknown }[];
    };
    expect(drained.report).toBe('acme-outbox-drain-report/1');
    expect(drained).toMatchObject({ leased: 1, delivered: 1 });
    expect(drained.events[0]?.payload).toEqual({ seeded: true });

    // A second drain finds nothing due and says so through the outcome code.
    const emptyIo = capture();
    await expect(
      run(['outbox', 'drain', ...sqlite], emptyIo.options),
    ).resolves.toBe(EXIT_OUTCOME);
    expect(emptyIo.out.join('\n')).toContain('no outbox entries were due');
  });

  it('drains outbox events to a file transport directory', async () => {
    const root = workspace();
    const database = join(root, 'file-outbox.sqlite');
    const outboxDir = join(root, 'delivered');
    const sqlite = ['--adapter', 'sqlite', '--database', database];
    await seedOutbox(database);

    const drainIo = capture();
    await expect(
      run(
        [
          'outbox',
          'drain',
          '--transport',
          'file',
          '--outbox-dir',
          outboxDir,
          '--json',
          '--show-payloads',
          ...sqlite,
        ],
        drainIo.options,
      ),
    ).resolves.toBe(EXIT_OK);
    const drained = JSON.parse(drainIo.out.join('\n')) as {
      transport: string;
      outboxDir: string;
      delivered: number;
      events: { eventId: string }[];
    };
    expect(drained).toMatchObject({
      transport: 'file',
      outboxDir,
      delivered: 1,
    });
    const eventId = drained.events[0]?.eventId ?? '';
    expect(eventId.length).toBeGreaterThan(0);
    const envelope = JSON.parse(
      readFileSync(join(outboxDir, `${eventId}.json`), 'utf8'),
    ) as {
      report: string;
      event: { type: string; payload: { seeded: boolean } };
    };
    expect(envelope.report).toBe('acme-outbox-file-delivery/1');
    expect(envelope.event).toMatchObject({
      type: 'cli.observed',
      payload: { seeded: true },
    });
  });

  it('alarms when outbox pending count exceeds --max-pending', async () => {
    const root = workspace();
    const database = join(root, 'alarm.sqlite');
    const sqlite = ['--adapter', 'sqlite', '--database', database];
    await seedOutbox(database);

    const okIo = capture();
    await expect(
      run(
        ['outbox', 'inspect', '--max-pending', '5', '--json', ...sqlite],
        okIo.options,
      ),
    ).resolves.toBe(EXIT_OK);
    const ok = JSON.parse(okIo.out.join('\n')) as {
      summary: { counts: { pending: number }; alarms: string[] };
    };
    expect(ok.summary.counts.pending).toBe(1);
    expect(ok.summary.alarms).toEqual([]);

    const alarmIo = capture();
    await expect(
      run(
        ['outbox', 'inspect', '--max-pending', '0', '--json', ...sqlite],
        alarmIo.options,
      ),
    ).resolves.toBe(EXIT_OUTCOME);
    const alarmed = JSON.parse(alarmIo.out.join('\n')) as {
      summary: { alarms: string[] };
    };
    expect(alarmed.summary.alarms[0]).toContain('exceeds --max-pending');
  });

  it('redrives a failed outbox entry on SQLite', async () => {
    const root = workspace();
    const database = join(root, 'redrive.sqlite');
    const sqlite = ['--adapter', 'sqlite', '--database', database];
    await seedOutbox(database);

    // Force the only entry into terminal failed via lease + fail.
    const connection = openDatabase({ location: database, appliedAt: now });
    let eventId;
    try {
      const repository = createSqliteExecutionRepository({
        database: connection,
        ids: createIds(),
      });
      const leased = await repository.leaseOutbox({
        now,
        limit: 10,
        leaseExpiresAt: '2026-07-31T12:00:30.000Z',
      });
      eventId = leased[0]?.record.eventId ?? '';
      await repository.markOutboxFailed({
        eventId,
        error: {
          code: 'INTERNAL',
          message: 'fixture give-up',
          stage: 'committed',
          retryable: false,
        },
        failedAt: now,
      });
    } finally {
      connection.close();
    }

    const redriveIo = capture();
    await expect(
      run(
        ['outbox', 'redrive', eventId, '--json', ...sqlite],
        redriveIo.options,
      ),
    ).resolves.toBe(EXIT_OK);
    const redriven = JSON.parse(redriveIo.out.join('\n')) as {
      report: string;
      redriven: number;
      entries: { eventId: string; outcome: string }[];
    };
    expect(redriven.report).toBe('acme-outbox-redrive-report/1');
    expect(redriven).toMatchObject({
      redriven: 1,
      entries: [{ eventId, outcome: 'redriven' }],
    });

    const inspectIo = capture();
    await expect(
      run(
        ['outbox', 'inspect', '--status', 'pending', '--json', ...sqlite],
        inspectIo.options,
      ),
    ).resolves.toBe(EXIT_OK);
    const inspected = JSON.parse(inspectIo.out.join('\n')) as {
      entries: { eventId: string; status: string }[];
    };
    expect(inspected.entries[0]).toMatchObject({
      eventId,
      status: 'pending',
    });
  });

  it('lists and inspects quality evaluations on SQLite', async () => {
    const root = workspace();
    const database = join(root, 'quality.sqlite');
    const sqlite = ['--adapter', 'sqlite', '--database', database];
    const {
      createSqliteQualityEvaluationStore,
      openDatabase,
    } = await import('../../../packages/adapter-sqlite/src/index.js');
    const {
      createQualityEvaluationInput,
      createQualityEvaluationRecord,
    } = await import('../../../packages/evaluation/src/index.js');
    const { sha256 } = await import('../../../packages/core/src/index.js');

    const connection = openDatabase({ location: database, appliedAt: now });
    try {
      const store = createSqliteQualityEvaluationStore({ database: connection });
      const input = createQualityEvaluationInput({
        runId: 'cli-quality-run',
        executionResult: {
          status: 'committed',
          executionId: 'execution-cli-quality',
          replayed: false,
          revision: 1,
          documentKeys: ['doc'],
          eventIds: [],
        },
        operationDigest: sha256('op-cli-quality'),
        artifact: { kind: 'document', id: 'doc', value: { ok: true } },
        contract: {
          id: 'narrative.observe-document',
          version: '1.0.0',
          fingerprint: sha256('contract-cli-quality'),
        },
      });
      const record = createQualityEvaluationRecord({
        input,
        evaluator: {
          id: 'quality.chapter-structure',
          version: '1.0.0',
          kind: 'deterministic',
        },
        result: { scores: [], findings: [], verdict: 'pass' },
      });
      await store.put(record);

      const listIo = capture();
      await expect(
        run(
          [
            'quality',
            'list',
            '--run-id',
            'cli-quality-run',
            '--json',
            ...sqlite,
          ],
          listIo.options,
        ),
      ).resolves.toBe(EXIT_OK);
      const listed = JSON.parse(listIo.out.join('\n')) as {
        count: number;
        entries: { evaluationId: string; verdict: string }[];
      };
      expect(listed.count).toBe(1);
      expect(listed.entries[0]?.verdict).toBe('pass');

      const inspectIo = capture();
      await expect(
        run(
          [
            'quality',
            'inspect',
            record.evaluationId,
            '--json',
            ...sqlite,
          ],
          inspectIo.options,
        ),
      ).resolves.toBe(EXIT_OK);
      const inspected = JSON.parse(inspectIo.out.join('\n')) as {
        evaluation: { evaluationId: string; result: { verdict: string } };
      };
      expect(inspected.evaluation.evaluationId).toBe(record.evaluationId);
      expect(inspected.evaluation.result.verdict).toBe('pass');
    } finally {
      connection.close();
    }
  });

  it('judges quality through an injected live-model gateway offline', async () => {
    const root = workspace();
    const database = join(root, 'judge.sqlite');
    const sqlite = ['--adapter', 'sqlite', '--database', database];
    // Seed a committed execution via normal execute path.
    const files = await fixtureFiles(root);
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
        capture().options,
      ),
    ).resolves.toBe(EXIT_OK);

    const artifactPath = join(root, 'artifact.json');
    writeFileSync(artifactPath, JSON.stringify({ text: 'judge me' }));
    const transport: ProviderTransport = {
      async send() {
        return {
          kind: 'response',
          status: 200,
          headers: {},
          body: JSON.stringify({
            id: 'resp_quality_judge',
            model: 'gpt-fixture-1',
            status: 'completed',
            output: [
              {
                type: 'message',
                content: [
                  {
                    type: 'output_text',
                    text: JSON.stringify({
                      scores: [
                        {
                          id: 'clarity',
                          value: 0.7,
                          scale: { min: 0, max: 1 },
                          interpretation: 'higher-is-better',
                        },
                      ],
                      findings: [],
                      verdict: 'pass',
                    }),
                  },
                ],
              },
            ],
            usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
          }),
        };
      },
    };

    const judgeIo = capture();
    const previousKey = process.env['OPENAI_API_KEY'];
    process.env['OPENAI_API_KEY'] = 'test-not-a-real-key';
    let judgeCode: number;
    try {
      judgeCode = await run(
        [
          'quality',
          'judge',
          files.executionId,
          '--run-id',
          'judge-run-1',
          '--artifact',
          artifactPath,
          '--json',
          ...sqlite,
        ],
        {
          ...judgeIo.options,
          openAiTransport: transport,
          openAiModel: 'gpt-fixture-1',
        },
      );
    } finally {
      if (previousKey === undefined) {
        delete process.env['OPENAI_API_KEY'];
      } else {
        process.env['OPENAI_API_KEY'] = previousKey;
      }
    }
    if (judgeCode !== EXIT_OK) {
      // eslint-disable-next-line no-console
      console.error('judge err', judgeIo.err.join('\n'));
      // eslint-disable-next-line no-console
      console.error('judge out', judgeIo.out.join('\n'));
    }
    expect(judgeCode).toBe(EXIT_OK);
    const judged = JSON.parse(judgeIo.out.join('\n')) as {
      evaluation: {
        evaluator: { kind: string };
        result: { verdict: string };
      };
    };
    expect(judged.evaluation.evaluator.kind).toBe('live-model');
    expect(judged.evaluation.result.verdict).toBe('pass');
  });

  it('lists and discharges a stranded SQLite execution', async () => {
    const root = workspace();
    const database = join(root, 'stranded.sqlite');
    const sqlite = ['--adapter', 'sqlite', '--database', database];
    const executionId = await seedStranded(database);

    const listIo = capture();
    await expect(
      run(['execution', 'stranded', '--json', ...sqlite], listIo.options),
    ).resolves.toBe(EXIT_OK);
    const listed = JSON.parse(listIo.out.join('\n')) as {
      report: string;
      count: number;
      entries: {
        executionId: string;
        disposition: string;
        reasonCode: string;
      }[];
    };
    expect(listed.report).toBe('acme-stranded-list/1');
    expect(listed.count).toBe(1);
    expect(listed.entries[0]).toMatchObject({
      executionId,
      disposition: 'open',
      reasonCode: 'unobserved-reservation',
    });

    const dischargeIo = capture();
    await expect(
      run(
        [
          'execution',
          'discharge',
          executionId,
          '--by',
          'ops-alice',
          '--rationale',
          'abandon unobserved call',
          '--json',
          ...sqlite,
        ],
        dischargeIo.options,
      ),
    ).resolves.toBe(EXIT_OK);
    const discharged = JSON.parse(dischargeIo.out.join('\n')) as {
      executionId: string;
      reasonCode: string;
      status: string;
      error: {
        code: string;
        details: { operatorDischarge: boolean; dischargedBy: string };
      };
    };
    expect(discharged).toMatchObject({
      executionId,
      reasonCode: 'unobserved-reservation',
      status: 'failed',
      error: {
        code: 'MODEL_UNAVAILABLE',
        details: {
          operatorDischarge: true,
          dischargedBy: 'ops-alice',
        },
      },
    });

    // Model-call evidence remains; execution is terminal stranded inventory.
    const inspectIo = capture();
    await expect(
      run(
        ['execution', 'inspect', executionId, '--json', ...sqlite],
        inspectIo.options,
      ),
    ).resolves.toBe(EXIT_OK);
    const inspected = JSON.parse(inspectIo.out.join('\n')) as {
      execution: { status: string };
      modelCalls: { status: string }[];
    };
    expect(inspected.execution.status).toBe('failed');
    expect(inspected.modelCalls[0]?.status).toBe('reserved');

    const afterList = capture();
    await expect(
      run(['execution', 'stranded', '--json', ...sqlite], afterList.options),
    ).resolves.toBe(EXIT_OK);
    const after = JSON.parse(afterList.out.join('\n')) as {
      entries: { disposition: string; reasonCode: string }[];
    };
    expect(after.entries[0]).toMatchObject({
      disposition: 'terminal',
      reasonCode: 'terminal-resume-refusal',
    });

    // Second discharge is refused (already terminal).
    const refuseIo = capture();
    await expect(
      run(
        [
          'execution',
          'discharge',
          executionId,
          '--by',
          'ops-bob',
          '--rationale',
          'again',
          ...sqlite,
        ],
        refuseIo.options,
      ),
    ).resolves.toBe(EXIT_OUTCOME);
    expect(refuseIo.err.join('\n')).toContain('Only non-terminal');
  });

  it.each([
    [['outbox', 'redrive'], 'outbox redrive requires'],
    [['outbox', 'drain', '--limit', '0'], '--limit must be a positive integer'],
    [
      ['outbox', 'drain', '--lease-timeout-ms', 'soon'],
      '--lease-timeout-ms must be a positive integer',
    ],
    [['execution', 'discharge', 'exec-x'], 'execution discharge requires --by'],
    [
      ['execution', 'discharge', 'exec-x', '--by', 'ops'],
      'execution discharge requires --rationale',
    ],
  ])('rejects %j as a usage error', async (argv, expected) => {
    const io = capture();
    await expect(run(argv, io.options)).resolves.toBe(EXIT_USAGE);
    expect(io.err.join('\n')).toContain(expected);
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
