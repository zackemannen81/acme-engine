import {
  AcmeError,
  ACME_MEMORY_RETRIEVAL_LIMIT,
  type ExecutionPolicy,
  type ExecutionRequest,
  type JsonValue,
  type MemoryQuery,
  type ModelGateway,
  type ModelSelection,
} from '@acme/core';

import type { Composition } from './composition.js';
import {
  discloseRead,
  findGrant,
  type ReadAllowList,
} from './read-allow-list.js';

export interface ToolContext {
  readonly composition: Composition;
  /**
   * The gateway used for `acme_execute_task`. Deployments inject a
   * deterministic scripted gateway; there is no provider default here, because
   * an MCP consumer must never be able to cause a live provider call by
   * sending a tool request.
   */
  readonly gateway: ModelGateway;
  /**
   * Model selection is a server-side deployment decision. The consumer names a
   * task, never a model.
   */
  readonly modelSelection: ModelSelection;
  /**
   * Payload retention is a data-handling decision, so it belongs to the
   * deployment too. `acme_verify_execution` can only reach `match` for
   * executions recorded under `encrypted-payload`; under the engine default,
   * `hash-only`, replay evidence is unavailable and the report says so.
   */
  readonly retention: ExecutionPolicy['retention'];
  readonly readAllowList: ReadAllowList;
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonValue;
}

export interface ToolContent {
  readonly type: 'text';
  readonly text: string;
}

export interface ToolResult {
  readonly content: readonly ToolContent[];
  readonly structuredContent: JsonValue;
  readonly isError: boolean;
}

function ok(structured: JsonValue): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(structured, null, 2) }],
    structuredContent: structured,
    isError: false,
  };
}

function toolError(
  code: string,
  message: string,
  details?: JsonValue,
): ToolResult {
  const structured: JsonValue = {
    code,
    message,
    ...(details === undefined ? {} : { details }),
  };
  return {
    content: [{ type: 'text', text: JSON.stringify(structured, null, 2) }],
    structuredContent: structured,
    isError: true,
  };
}

export class ToolParamsError extends Error {}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireParams(params: JsonValue | undefined): Record<string, unknown> {
  if (params === undefined) {
    return {};
  }
  if (!isObject(params)) {
    throw new ToolParamsError('Tool arguments must be an object.');
  }
  return params;
}

function requireText(params: Record<string, unknown>, field: string): string {
  const value = params[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ToolParamsError(`${field} must be a non-empty string.`);
  }
  return value;
}

function requireRevision(params: Record<string, unknown>): number {
  const value = params['expectedRevision'];
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new ToolParamsError(
      'expectedRevision must be a non-negative safe integer.',
    );
  }
  return value as number;
}

function requirePresent(
  params: Record<string, unknown>,
  field: string,
): JsonValue {
  if (!Object.hasOwn(params, field)) {
    throw new ToolParamsError(`${field} is required.`);
  }
  return params[field] as JsonValue;
}

/** A gateway that exists only to prove replay never reaches a provider. */
const replayGateway: ModelGateway = {
  async capabilities() {
    throw new AcmeError({
      code: 'INTERNAL',
      message: 'Replay verification must not call a gateway.',
      stage: 'calling-model',
      retryable: false,
    });
  },
  async generate() {
    throw new AcmeError({
      code: 'INTERNAL',
      message: 'Replay verification must not call a gateway.',
      stage: 'calling-model',
      retryable: false,
    });
  },
};

const textField = { type: 'string', minLength: 1 } as const;

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = Object.freeze([
  {
    name: 'acme_execute_task',
    description:
      'Run one ACME task through the ExecutionEngine and commit it. Returns ' +
      'the execution result: committed revision and document keys, or the ' +
      'terminal error. The model profile is a server-side decision.',
    inputSchema: {
      type: 'object',
      properties: {
        namespace: textField,
        task: textField,
        entityId: textField,
        requestKey: textField,
        expectedRevision: { type: 'integer', minimum: 0 },
        input: { type: 'object' },
      },
      required: [
        'namespace',
        'task',
        'entityId',
        'requestKey',
        'expectedRevision',
        'input',
      ],
      additionalProperties: false,
    },
  },
  {
    name: 'acme_read_entity',
    description:
      'Read committed state and ranked memory for one entity, through the ' +
      'repository and the domain memory policy. Refused unless the server ' +
      'configuration holds an explicit read grant for that entity.',
    inputSchema: {
      type: 'object',
      properties: {
        namespace: textField,
        entityId: textField,
        task: textField,
        expectedRevision: { type: 'integer', minimum: 0 },
      },
      required: ['namespace', 'entityId', 'task', 'expectedRevision'],
      additionalProperties: false,
    },
  },
  {
    name: 'acme_verify_execution',
    description:
      'Replay a recorded execution from its stored evidence and compare the ' +
      'operation digest. Never calls a model provider. Reports "unavailable" ' +
      'when the execution was not recorded under a retaining policy.',
    inputSchema: {
      type: 'object',
      properties: {
        executionId: textField,
      },
      required: ['executionId'],
      additionalProperties: false,
    },
  },
]);

async function executeTask(
  context: ToolContext,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  const request: ExecutionRequest = {
    requestKey: requireText(params, 'requestKey'),
    namespace: requireText(params, 'namespace'),
    task: requireText(params, 'task'),
    entityId: requireText(params, 'entityId'),
    expectedRevision: requireRevision(params),
    input: requirePresent(params, 'input'),
    model: context.modelSelection,
    policy: { retention: context.retention },
  };
  const result = await context.composition
    .engine(context.gateway)
    .execute(request);
  return ok({
    result: result as unknown as JsonValue,
    // Surfaced rather than silently omitted: nothing in the committed evidence
    // says an MCP consumer caused this execution, because `ExecutionRequest`
    // has no principal and rejects unknown top-level keys.
    recordedConsumer: null,
  });
}

async function readEntity(
  context: ToolContext,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  const namespace = requireText(params, 'namespace');
  const entityId = requireText(params, 'entityId');
  const task = requireText(params, 'task');
  const expectedRevision = requireRevision(params);

  const grant = findGrant(context.readAllowList, namespace, entityId);
  if (grant === undefined) {
    return toolError(
      'ACME_MCP_NO_READ_GRANT',
      'This server has no configured read grant for that entity, and the ' +
        'engine cannot decide disclosure for an unknown consumer. Refusing ' +
        'the read.',
      { namespace, entityId },
    );
  }

  const module = context.composition.modules.get(namespace);
  const query: MemoryQuery = {
    namespace,
    entityId,
    task,
    limit: ACME_MEMORY_RETRIEVAL_LIMIT,
  };
  const loaded = await context.composition.repository.loadContext({
    namespace,
    entityId,
    expectedRevision,
    memory: query,
  });
  const ranked = context.composition.memory.retrieve(
    module.memoryPolicy,
    query,
    loaded.memories,
  );
  const disclosed = discloseRead(grant, ranked, loaded.state);
  return ok({
    namespace,
    entityId,
    state: disclosed.state as unknown as JsonValue,
    memories: disclosed.memories as unknown as JsonValue,
    withheld: disclosed.withheld as unknown as JsonValue,
  });
}

async function verifyExecution(
  context: ToolContext,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  const executionId = requireText(params, 'executionId');
  const report = await context.composition
    .engine(replayGateway)
    .replayVerify(executionId);
  return ok({ report: report as unknown as JsonValue });
}

export async function callTool(
  context: ToolContext,
  name: string,
  rawParams: JsonValue | undefined,
): Promise<ToolResult | null> {
  const params = requireParams(rawParams);
  try {
    switch (name) {
      case 'acme_execute_task':
        return await executeTask(context, params);
      case 'acme_read_entity':
        return await readEntity(context, params);
      case 'acme_verify_execution':
        return await verifyExecution(context, params);
      default:
        return null;
    }
  } catch (error: unknown) {
    if (error instanceof ToolParamsError) {
      throw error;
    }
    if (error instanceof AcmeError) {
      return toolError(
        error.data.code,
        error.data.message,
        error.data as unknown as JsonValue,
      );
    }
    return toolError(
      'ACME_MCP_INTERNAL',
      error instanceof Error ? error.message : 'Unexpected failure.',
    );
  }
}
