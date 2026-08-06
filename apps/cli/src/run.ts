import { readFile } from 'node:fs/promises';

import {
  AcmeError,
  drainOutbox,
  type ExecutionRequest,
  type JsonValue,
  type ModelGateway,
  type ModelSelection,
  type OutboxRecord,
} from '@acme/core';
import { createScriptedModelGateway } from '@acme/adapter-model-mock';
import {
  createOpenAiResponsesGateway,
  type ProviderTransport,
} from '@acme/adapter-model-openai';
import { createFetchTransport } from '@acme/adapter-model-openai/transport-fetch';

import {
  parseCommand,
  UsageError,
  USAGE,
  type Command,
  type CommonOptions,
  type ExecuteGateway,
} from './args.js';
import {
  createComposition,
  type Composition,
  type CompositionOverrides,
  type InspectableRepository,
} from './composition.js';
import { emit, payload, type CliIo } from './output.js';
import { runScenarioFile } from './scenario.js';

/**
 * 0 succeeded, 1 a terminal outcome that did not commit or verify, 2 usage.
 */
export const EXIT_OK = 0;
export const EXIT_OUTCOME = 1;
export const EXIT_USAGE = 2;

export interface RunOptions extends CompositionOverrides {
  readonly io: CliIo;
  /**
   * Test injection for the live OpenAI path. Production never sets this;
   * the default builds a real fetch transport.
   */
  readonly openAiTransport?: ProviderTransport;
  /** Test injection of the live model id (defaults to env / gpt-5.6-Luna). */
  readonly openAiModel?: string;
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

async function gatewayFromScript(path: string): Promise<ModelGateway> {
  const script = await readJson(path, 'script');
  try {
    return createScriptedModelGateway(
      script as unknown as Parameters<typeof createScriptedModelGateway>[0],
    );
  } catch (error: unknown) {
    throw new UsageError(
      error instanceof Error
        ? `The script file was rejected: ${error.message}`
        : 'The script file was rejected.',
    );
  }
}

function openAiModelId(options: RunOptions): string {
  if (options.openAiModel !== undefined && options.openAiModel.length > 0) {
    return options.openAiModel;
  }
  return (
    process.env['ACME_OPENAI_MODEL'] ??
    process.env['ACME_LIVE_MODEL'] ??
    'gpt-5.6-Luna'
  );
}

/**
 * Live OpenAI Responses gateway. Credentials stay in the composition root;
 * the adapter package never reads the environment.
 */
function gatewayFromOpenAi(
  selection: ModelSelection,
  options: RunOptions,
): ModelGateway {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (apiKey === undefined || apiKey.trim().length === 0) {
    throw new UsageError(
      'execute --gateway openai requires OPENAI_API_KEY in the environment.',
    );
  }
  const transport = options.openAiTransport ?? createFetchTransport();
  const model = openAiModelId(options);
  return createOpenAiResponsesGateway({
    transport,
    now: () => new Date().toISOString(),
    headers: () => ({ authorization: `Bearer ${apiKey}` }),
    profiles: [
      {
        selection,
        model,
        capabilities: {
          structuredOutput: true,
          tools: false,
          vision: false,
        },
      },
    ],
  });
}

async function resolveExecuteGateway(
  gateway: ExecuteGateway,
  request: ExecutionRequest,
  options: RunOptions,
): Promise<ModelGateway> {
  if (gateway.kind === 'script') {
    return gatewayFromScript(gateway.script);
  }
  return gatewayFromOpenAi(request.model, options);
}

function executionEvidence(
  repository: InspectableRepository,
  executionId: string,
  showPayloads: boolean,
): Readonly<Record<string, JsonValue>> {
  const evidence = repository.snapshot();
  const execution = evidence.executions.find(
    (entry) => entry.executionId === executionId,
  );
  if (execution === undefined) {
    throw new UsageError(`No execution found for ${executionId}.`);
  }
  return {
    execution: {
      executionId: execution.executionId,
      namespace: execution.request.namespace,
      task: execution.request.task,
      entityId: execution.request.entityId,
      status: execution.status,
      currentStage: execution.currentStage,
      createdAt: execution.createdAt,
      updatedAt: execution.updatedAt,
      input: payload(execution.request.input, showPayloads),
      ...(execution.result === undefined
        ? {}
        : { result: execution.result as unknown as JsonValue }),
    },
    attempts: evidence.attempts
      .filter((entry) => entry.executionId === executionId)
      .map((entry) => ({
        attemptNumber: entry.attemptNumber,
        stage: entry.stage,
        outcome: entry.outcome,
        occurredAt: entry.occurredAt,
      })),
    modelCalls: evidence.modelCalls
      .filter((entry) => entry.executionId === executionId)
      .map((entry) => ({
        modelCallId: entry.modelCallId,
        callKey: entry.callKey,
        attempt: entry.attempt,
        status: entry.status,
        requestHash: entry.requestHash,
        ...(entry.responseHash === undefined
          ? {}
          : { responseHash: entry.responseHash }),
        ...(entry.response === undefined
          ? {}
          : {
              response: payload(
                entry.response as unknown as JsonValue,
                showPayloads,
              ),
            }),
      })),
    documents: evidence.documents
      .filter((entry) => entry.executionId === executionId)
      .map((entry) => ({
        documentId: entry.documentId,
        key: entry.key,
        kind: entry.kind,
        contentHash: entry.contentHash,
        value: payload(entry.value, showPayloads),
      })),
  };
}

async function execute(
  command: Extract<Command, { kind: 'execute' }>,
  options: RunOptions,
): Promise<number> {
  const request = (await readJson(
    command.request,
    'request',
  )) as unknown as ExecutionRequest;
  const gateway = await resolveExecuteGateway(
    command.gateway,
    request,
    options,
  );
  const composition = createComposition(
    command.common.adapter,
    command.common.database,
    options,
  );
  try {
    const result = await composition.engine(gateway).execute(request);
    const committed = result.status === 'committed';
    emit(
      options.io,
      'execute',
      { result: result as unknown as JsonValue },
      command.common.json,
      committed
        ? [
            `committed ${result.executionId}`,
            `revision ${String(result.revision)}`,
            `documents ${result.documentKeys.join(', ') || '(none)'}`,
          ]
        : [`${result.status} ${result.executionId}`, result.error.message],
    );
    return committed ? EXIT_OK : EXIT_OUTCOME;
  } finally {
    composition.close();
  }
}

async function scenario(
  command: Extract<Command, { kind: 'scenario-run' }>,
  options: RunOptions,
): Promise<number> {
  // The composition is built from the scenario's own seed, so it cannot exist
  // until the document has been parsed.
  const { report, close } = await runScenarioFile(
    command.scenario,
    (overrides) =>
      createComposition(command.common.adapter, command.common.database, {
        // Preserve composition secrets/keys from the CLI root while the
        // scenario seed still owns clock and ID allocation.
        ...(options.payloadEncryptor === undefined
          ? {}
          : { payloadEncryptor: options.payloadEncryptor }),
        ...(options.clock === undefined ? {} : { clock: options.clock }),
        ...(options.ids === undefined ? {} : { ids: options.ids }),
        ...overrides,
      }),
  );
  try {
    emit(
      options.io,
      'scenario run',
      { report: report as unknown as JsonValue },
      command.common.json,
      [
        `scenario ${report.status} ${report.name}`,
        ...report.steps.map(
          (step) => `  ${String(step.index)} ${step.kind} ${step.status}`,
        ),
        ...(report.failure === undefined ? [] : [report.failure.message]),
      ],
    );
    return report.status === 'passed' ? EXIT_OK : EXIT_OUTCOME;
  } finally {
    close();
  }
}

async function replay(
  command: Extract<Command, { kind: 'execution-replay' }>,
  options: RunOptions,
): Promise<number> {
  const composition = createComposition(
    command.common.adapter,
    command.common.database,
    options,
  );
  try {
    const report = await composition
      .engine({
        async capabilities() {
          throw new Error('Replay must not call a gateway.');
        },
        async generate() {
          throw new Error('Replay must not call a gateway.');
        },
      })
      .replayVerify(command.executionId);
    emit(
      options.io,
      'execution replay',
      { report: report as unknown as JsonValue },
      command.common.json,
      [
        `replay ${report.status} ${report.executionId}`,
        ...(report.recordedDigest === undefined
          ? []
          : [`recorded ${report.recordedDigest}`]),
        ...(report.replayDigest === undefined
          ? []
          : [`replay   ${report.replayDigest}`]),
        ...report.differences.map((entry) => `difference ${entry.code}`),
      ],
    );
    return report.status === 'match' ? EXIT_OK : EXIT_OUTCOME;
  } finally {
    composition.close();
  }
}

function inspectExecution(
  command: Extract<Command, { kind: 'execution-inspect' }>,
  options: RunOptions,
): number {
  const composition = createComposition(
    command.common.adapter,
    command.common.database,
    options,
  );
  try {
    const body = executionEvidence(
      composition.repository,
      command.executionId,
      command.common.showPayloads,
    );
    const execution = body['execution'] as Record<string, JsonValue>;
    emit(options.io, 'execution inspect', body, command.common.json, [
      `execution ${String(execution['executionId'])}`,
      `status ${String(execution['status'])}`,
      `documents ${String((body['documents'] as JsonValue[]).length)}`,
      `model calls ${String((body['modelCalls'] as JsonValue[]).length)}`,
    ]);
    return EXIT_OK;
  } finally {
    composition.close();
  }
}

function inspectState(
  command: Extract<Command, { kind: 'state-inspect' }>,
  options: RunOptions,
): number {
  const composition = createComposition(
    command.common.adapter,
    command.common.database,
    options,
  );
  try {
    const snapshots = composition.repository
      .snapshot()
      .state.snapshots.filter(
        (entry) =>
          entry.namespace === command.namespace &&
          entry.entityId === command.entityId &&
          (command.revision === undefined ||
            entry.revision === command.revision),
      );
    const body = {
      namespace: command.namespace,
      entityId: command.entityId,
      snapshots: snapshots.map((entry) => ({
        revision: entry.revision,
        schemaVersion: entry.schemaVersion,
        valueHash: entry.valueHash,
        createdAt: entry.createdAt,
        executionId: entry.executionId,
        value: payload(entry.value, command.common.showPayloads),
      })),
    } satisfies Readonly<Record<string, JsonValue>>;
    emit(
      options.io,
      'state inspect',
      body,
      command.common.json,
      snapshots.length === 0
        ? ['no state snapshots found']
        : snapshots.map(
            (entry) => `revision ${String(entry.revision)} ${entry.valueHash}`,
          ),
    );
    return snapshots.length === 0 ? EXIT_OUTCOME : EXIT_OK;
  } finally {
    composition.close();
  }
}

function inspectMemory(
  command: Extract<Command, { kind: 'memory-inspect' }>,
  options: RunOptions,
): number {
  const composition = createComposition(
    command.common.adapter,
    command.common.database,
    options,
  );
  try {
    const records = composition.repository
      .snapshot()
      .memoryRecords.filter(
        (entry) =>
          entry.namespace === command.namespace &&
          entry.entityId === command.entityId &&
          (command.status === undefined || entry.status === command.status),
      );
    const body = {
      namespace: command.namespace,
      entityId: command.entityId,
      records: records.map((entry) => ({
        memoryId: entry.memoryId,
        identityKey: entry.identityKey,
        kind: entry.kind,
        status: entry.status,
        strength: entry.strength,
        recordVersion: entry.recordVersion,
        value: payload(entry.value, command.common.showPayloads),
      })),
    } satisfies Readonly<Record<string, JsonValue>>;
    emit(
      options.io,
      'memory inspect',
      body,
      command.common.json,
      records.length === 0
        ? ['no memory records found']
        : records.map(
            (entry) => `${entry.memoryId} ${entry.status} ${entry.identityKey}`,
          ),
    );
    return records.length === 0 ? EXIT_OUTCOME : EXIT_OK;
  } finally {
    composition.close();
  }
}

async function withComposition(
  common: CommonOptions,
  options: RunOptions,
  work: (composition: Composition) => Promise<number>,
): Promise<number> {
  const composition = createComposition(
    common.adapter,
    common.database,
    options,
  );
  try {
    return await work(composition);
  } finally {
    composition.close();
  }
}

function inspectOutbox(
  command: Extract<Command, { kind: 'outbox-inspect' }>,
  options: RunOptions,
): Promise<number> {
  return withComposition(command.common, options, async (composition) => {
    const entries = await composition.repository.listOutbox({
      ...(command.status === undefined
        ? {}
        : { status: command.status as OutboxRecord['status'] }),
      limit: command.limit,
    });
    const body = {
      entries: entries.map(({ record, event }) => ({
        eventId: record.eventId,
        status: record.status,
        attemptCount: record.attemptCount,
        availableAt: record.availableAt,
        type: event.type,
        namespace: event.namespace,
        entityId: event.entityId,
        occurredAt: event.occurredAt,
        payload: payload(event.payload, command.common.showPayloads),
      })),
    } satisfies Readonly<Record<string, JsonValue>>;
    emit(
      options.io,
      'outbox inspect',
      body,
      command.common.json,
      entries.length === 0
        ? ['no outbox entries found']
        : entries.map(
            ({ record, event }) =>
              `${record.eventId} ${record.status} ${event.type}`,
          ),
    );
    return entries.length === 0 ? EXIT_OUTCOME : EXIT_OK;
  });
}

function drainOutboxCommand(
  command: Extract<Command, { kind: 'outbox-drain' }>,
  options: RunOptions,
): Promise<number> {
  return withComposition(command.common, options, async (composition) => {
    const delivered: JsonValue[] = [];
    // The v1 consumer hands events to the operator through the report rather
    // than inventing a transport (ADR-0018).
    const report = await drainOutbox({
      repository: composition.repository,
      clock: composition.clock,
      limit: command.limit,
      leaseTimeoutMs: command.leaseTimeoutMs,
      dispatcher: {
        async deliver(event) {
          delivered.push({
            eventId: event.eventId,
            executionId: event.executionId,
            type: event.type,
            namespace: event.namespace,
            entityId: event.entityId,
            occurredAt: event.occurredAt,
            payload: payload(event.payload, command.common.showPayloads),
          });
        },
      },
    });
    const body = {
      report: report.report,
      leasedAt: report.leasedAt,
      leased: report.leased,
      delivered: report.delivered,
      retryScheduled: report.retryScheduled,
      failed: report.failed,
      entries: report.entries.map((entry) => ({
        eventId: entry.eventId,
        attemptCount: entry.attemptCount,
        outcome: entry.outcome,
        ...(entry.retryAt === undefined ? {} : { retryAt: entry.retryAt }),
      })),
      events: delivered,
    } satisfies Readonly<Record<string, JsonValue>>;
    emit(
      options.io,
      'outbox drain',
      body,
      command.common.json,
      report.leased === 0
        ? ['no outbox entries were due']
        : report.entries.map((entry) => `${entry.eventId} ${entry.outcome}`),
    );
    return report.failed > 0 || report.leased === 0 ? EXIT_OUTCOME : EXIT_OK;
  });
}

export async function run(
  argv: readonly string[],
  options: RunOptions,
): Promise<number> {
  try {
    const command = parseCommand(argv);
    switch (command.kind) {
      case 'help':
        options.io.stdout(USAGE);
        return EXIT_OK;
      case 'execute':
        return await execute(command, options);
      case 'scenario-run':
        return await scenario(command, options);
      case 'execution-replay':
        return await replay(command, options);
      case 'execution-inspect':
        return inspectExecution(command, options);
      case 'state-inspect':
        return inspectState(command, options);
      case 'memory-inspect':
        return inspectMemory(command, options);
      case 'outbox-inspect':
        return await inspectOutbox(command, options);
      case 'outbox-drain':
        return await drainOutboxCommand(command, options);
    }
  } catch (error: unknown) {
    if (error instanceof UsageError) {
      options.io.stderr(error.message);
      options.io.stderr(USAGE);
      return EXIT_USAGE;
    }
    if (error instanceof AcmeError) {
      // Structured engine and adapter failures stay legible on stderr.
      options.io.stderr(`${error.data.code}: ${error.data.message}`);
      return EXIT_OUTCOME;
    }
    options.io.stderr(
      error instanceof Error ? error.message : 'Unexpected failure.',
    );
    return EXIT_OUTCOME;
  }
}
