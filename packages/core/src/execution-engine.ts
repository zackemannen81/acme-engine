import type {
  Clock,
  DiagnosticFact,
  Hashing,
  IdGenerator,
  JsonValue,
  Schema,
} from './common.js';
import type {
  ContractRegistry,
  PromptContract,
  ResponsePipeline,
} from './contracts.js';
import { AcmeError, type AcmeErrorData } from './errors.js';
import {
  ACME_MEMORY_RETRIEVAL_LIMIT,
  computeRequestFingerprint,
  computeTaskInputHash,
  deriveExecutionId,
  deriveOperationKey,
  resolveExecutionPolicy,
} from './execution-identity.js';
import type {
  ExecutionPolicy,
  ExecutionRequest,
  ExecutionResult,
  ExecutionStatus,
  ReplayReport,
} from './execution-types.js';
import { nodeHashing } from './hashing.js';
import { createMemoryEngine, type MemoryEngine } from './memory-engine.js';
import type { MemoryQuery, PreparedMemory, RankedMemory } from './memory.js';
import { computeModelRequestHash } from './model-request-hash.js';
import { computeModelResponseHash } from './model-response-hash.js';
import type {
  ModelGateway,
  ModelRequest,
  ModelSelection,
  NormalizedModelResponse,
} from './model.js';
import {
  validateModelRequest,
  validateModelSelection,
  validateNormalizedModelResponse,
} from './model-validation.js';
import type {
  DomainModule,
  ExecutionReadContext,
  ModuleRegistry,
  ModuleResult,
  TaskMap,
} from './modules.js';
import { buildStateProjectionInput } from './state-projection.js';
import type {
  ExecutionReadSet,
  ExecutionReplayEvidence,
  ExecutionReplayReadSet,
  ExecutionRepository,
  PreparedCommit,
  PreparedCommitContent,
  RecordedRankedMemory,
} from './repository.js';
import { computeOperationDigest } from './repository-digest.js';
import type { StateEngine } from './state-engine.js';
import type { PreparedState, StateSnapshot } from './state.js';

export interface ExecutionEngineOptions {
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly modules: ModuleRegistry;
  readonly contracts: ContractRegistry;
  readonly pipeline: ResponsePipeline;
  readonly gateway: ModelGateway;
  readonly memory: MemoryEngine;
  readonly state: StateEngine;
  readonly repository: ExecutionRepository;
  readonly hashing?: Hashing;
}

export interface ExecutionEngine {
  execute<TInput>(request: ExecutionRequest<TInput>): Promise<ExecutionResult>;
  replayVerify(executionId: string): Promise<ReplayReport>;
}

type RuntimeModule = DomainModule<
  JsonValue,
  JsonValue,
  TaskMap<JsonValue, JsonValue>
>;

interface RequestEnvelope {
  readonly requestKey: string;
  readonly namespace: string;
  readonly task: string;
  readonly entityId: string;
  readonly expectedRevision: number;
  readonly input: unknown;
  readonly model: ModelSelection;
  readonly policy?: Partial<ExecutionPolicy>;
}

interface ResolvedExecution {
  readonly module: RuntimeModule;
  readonly task: RuntimeModule['tasks'][string];
  readonly contract: PromptContract<JsonValue, JsonValue>;
  readonly contractFingerprint: string;
  readonly taskInput: JsonValue;
}

/**
 * How a non-terminal execution continues (ADR-0017). `recordedResponse` is
 * present when a successful primary call was retained, and the provider must
 * then not be called again.
 */
interface Resumption {
  readonly attemptNumber: number;
  readonly recordedResponse?: NormalizedModelResponse;
}

const requestKeys = new Set([
  'requestKey',
  'namespace',
  'task',
  'entityId',
  'expectedRevision',
  'input',
  'model',
  'policy',
]);

const requiredRequestKeys = [
  'requestKey',
  'namespace',
  'task',
  'entityId',
  'expectedRevision',
  'input',
  'model',
] as const;

function invalid(
  code: AcmeErrorData['code'],
  message: string,
  stage: ExecutionStatus,
  details?: JsonValue,
  cause?: unknown,
): AcmeError {
  const data = {
    code,
    message,
    stage,
    retryable: false,
    ...(details === undefined ? {} : { details }),
  };
  return cause === undefined
    ? new AcmeError(data)
    : new AcmeError(data, { cause });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw invalid(
      'INVALID_REQUEST',
      `${field} must be a non-empty string.`,
      'accepted',
      { field },
    );
  }
  return value;
}

function requireResultText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw invalid(
      'DOMAIN_INVALID_RESULT',
      `${field} must be a non-empty string.`,
      'interpreting',
      { field },
    );
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

function schemaDetails(
  issues: readonly {
    readonly code: string;
    readonly message: string;
    readonly path: readonly PropertyKey[];
  }[],
): JsonValue {
  return issues.map(({ code, message, path }) => ({
    code,
    message,
    path: path.map((part) => (typeof part === 'symbol' ? String(part) : part)),
  }));
}

function validateSchemaJson<T>(
  schema: Schema<T>,
  input: unknown,
  hashing: Hashing,
  code: AcmeErrorData['code'],
  stage: ExecutionStatus,
  label: string,
): T {
  let result: ReturnType<Schema<T>['safeParse']>;
  try {
    result = schema.safeParse(input);
  } catch (cause) {
    throw invalid(
      code,
      `${label} schema execution failed.`,
      stage,
      { label },
      cause,
    );
  }
  if (!result.success) {
    throw invalid(code, `${label} failed schema validation.`, stage, {
      label,
      issues: schemaDetails(result.error.issues),
    });
  }

  let supplied: string;
  let validated: string;
  try {
    supplied = hashing.canonicalJson(input as JsonValue);
    validated = hashing.canonicalJson(result.data as unknown as JsonValue);
  } catch (cause) {
    throw invalid(
      code,
      `${label} must remain a JSON value.`,
      stage,
      { label },
      cause,
    );
  }
  if (supplied !== validated) {
    throw invalid(
      code,
      `${label} schema must not coerce or transform its value.`,
      stage,
      { label },
    );
  }
  return deepFreeze(JSON.parse(validated) as T);
}

function validateTimestamp(value: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    throw invalid(
      'INTERNAL',
      'Clock returned a non-canonical UTC timestamp.',
      'accepted',
    );
  }
  return value;
}

function validateRequestEnvelope(request: unknown): RequestEnvelope {
  if (!isObject(request)) {
    throw invalid(
      'INVALID_REQUEST',
      'Execution request must be an object.',
      'accepted',
    );
  }
  const unexpected = Object.keys(request)
    .filter((key) => !requestKeys.has(key))
    .sort();
  const missing = requiredRequestKeys.filter(
    (key) => !Object.hasOwn(request, key),
  );
  if (unexpected.length > 0 || missing.length > 0) {
    throw invalid(
      'INVALID_REQUEST',
      'Execution request has an invalid shape.',
      'accepted',
      { missing, unexpected },
    );
  }
  if (
    !Number.isSafeInteger(request.expectedRevision) ||
    (request.expectedRevision as number) < 0
  ) {
    throw invalid(
      'INVALID_REQUEST',
      'expectedRevision must be a non-negative safe integer.',
      'accepted',
    );
  }
  return Object.freeze({
    requestKey: requireText(request.requestKey, 'requestKey'),
    namespace: requireText(request.namespace, 'namespace'),
    task: requireText(request.task, 'task'),
    entityId: requireText(request.entityId, 'entityId'),
    expectedRevision: request.expectedRevision as number,
    input: request.input,
    model: validateModelSelection(request.model as ModelSelection),
    ...(Object.hasOwn(request, 'policy')
      ? { policy: request.policy as Partial<ExecutionPolicy> }
      : {}),
  });
}

function terminalStatus(
  error: AcmeErrorData,
): 'blocked' | 'conflicted' | 'cancelled' | 'failed' {
  if (error.code === 'EVALUATION_BLOCKED') {
    return 'blocked';
  }
  if (
    error.code === 'CONFLICT_IDEMPOTENCY_KEY' ||
    error.code === 'CONFLICT_STATE_REVISION' ||
    error.code === 'CONFLICT_MEMORY_VERSION'
  ) {
    return 'conflicted';
  }
  return error.code === 'CANCELLED' ? 'cancelled' : 'failed';
}

function errorData(error: unknown, stage: ExecutionStatus): AcmeErrorData {
  if (error instanceof AcmeError) {
    return error.data;
  }
  if (
    isObject(error) &&
    isObject(error.data) &&
    typeof error.data.code === 'string' &&
    typeof error.data.message === 'string' &&
    typeof error.data.stage === 'string' &&
    typeof error.data.retryable === 'boolean'
  ) {
    return deepFreeze(error.data as unknown as AcmeErrorData);
  }
  return Object.freeze({
    code: 'INTERNAL',
    message: 'Execution failed with an unexpected internal error.',
    stage,
    retryable: false,
  });
}

function diagnostic(
  code: string,
  severity: DiagnosticFact['severity'],
  value?: JsonValue,
): DiagnosticFact {
  return deepFreeze({
    code,
    severity,
    ...(value === undefined ? {} : { value }),
  });
}

function canonicalEqual(left: unknown, right: unknown, hashing: Hashing) {
  return (
    hashing.canonicalJson(left as JsonValue) ===
    hashing.canonicalJson(right as JsonValue)
  );
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
  label: string,
): void {
  const unexpected = Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .sort();
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  if (unexpected.length > 0 || missing.length > 0) {
    throw invalid(
      'DOMAIN_INVALID_RESULT',
      `${label} has an invalid shape.`,
      'interpreting',
      { label, missing, unexpected },
    );
  }
}

function validateModuleResult(
  raw: unknown,
  hashing: Hashing,
): ModuleResult<JsonValue> {
  let cloned: unknown;
  try {
    cloned = deepFreeze(
      JSON.parse(hashing.canonicalJson(raw as JsonValue)) as unknown,
    );
  } catch (cause) {
    throw invalid(
      'DOMAIN_INVALID_RESULT',
      'Module result must contain only canonical JSON values.',
      'interpreting',
      undefined,
      cause,
    );
  }
  if (!isObject(cloned)) {
    throw invalid(
      'DOMAIN_INVALID_RESULT',
      'Module result must be an object.',
      'interpreting',
    );
  }
  exactKeys(
    cloned,
    ['documents', 'memories', 'stateIntent', 'events', 'diagnostics'],
    ['documents', 'memories', 'events', 'diagnostics'],
    'Module result',
  );
  for (const field of [
    'documents',
    'memories',
    'events',
    'diagnostics',
  ] as const) {
    if (!Array.isArray(cloned[field])) {
      throw invalid(
        'DOMAIN_INVALID_RESULT',
        `Module result ${field} must be an array.`,
        'interpreting',
      );
    }
  }
  const documents = cloned.documents as readonly unknown[];
  const memories = cloned.memories as readonly unknown[];
  const events = cloned.events as readonly unknown[];
  const diagnostics = cloned.diagnostics as readonly unknown[];

  const documentKeys = new Set<string>();
  for (const [index, value] of documents.entries()) {
    if (!isObject(value)) {
      throw invalid(
        'DOMAIN_INVALID_RESULT',
        `Module document ${index} must be an object.`,
        'interpreting',
      );
    }
    exactKeys(
      value,
      ['key', 'kind', 'schemaVersion', 'value', 'contentHash'],
      ['key', 'kind', 'schemaVersion', 'value', 'contentHash'],
      `Module document ${index}`,
    );
    const key = requireResultText(value.key, `documents[${index}].key`);
    requireResultText(value.kind, `documents[${index}].kind`);
    requireResultText(value.schemaVersion, `documents[${index}].schemaVersion`);
    requireResultText(value.contentHash, `documents[${index}].contentHash`);
    if (documentKeys.has(key)) {
      throw invalid(
        'DOMAIN_INVALID_RESULT',
        'Module document keys must be unique.',
        'interpreting',
        { key },
      );
    }
    documentKeys.add(key);
  }

  const memoryKeys = new Set<string>();
  for (const [index, value] of memories.entries()) {
    if (!isObject(value)) {
      throw invalid(
        'DOMAIN_INVALID_RESULT',
        `Module memory ${index} must be an object.`,
        'interpreting',
      );
    }
    const key = requireResultText(value.key, `memories[${index}].key`);
    if (memoryKeys.has(key)) {
      throw invalid(
        'DOMAIN_INVALID_RESULT',
        'Module memory keys must be unique.',
        'interpreting',
        { key },
      );
    }
    memoryKeys.add(key);
  }

  const eventKeys = new Set<string>();
  for (const [index, value] of events.entries()) {
    if (!isObject(value)) {
      throw invalid(
        'DOMAIN_INVALID_RESULT',
        `Module event ${index} must be an object.`,
        'interpreting',
      );
    }
    exactKeys(
      value,
      ['key', 'type', 'schemaVersion', 'payload'],
      ['key', 'type', 'schemaVersion', 'payload'],
      `Module event ${index}`,
    );
    const key = requireResultText(value.key, `events[${index}].key`);
    requireResultText(value.type, `events[${index}].type`);
    requireResultText(value.schemaVersion, `events[${index}].schemaVersion`);
    if (eventKeys.has(key)) {
      throw invalid(
        'DOMAIN_INVALID_RESULT',
        'Module event keys must be unique.',
        'interpreting',
        { key },
      );
    }
    eventKeys.add(key);
  }

  if (cloned.stateIntent !== undefined) {
    if (!isObject(cloned.stateIntent)) {
      throw invalid(
        'DOMAIN_INVALID_RESULT',
        'Module state intent must be an object.',
        'interpreting',
      );
    }
    exactKeys(
      cloned.stateIntent,
      ['schemaVersion', 'value'],
      ['schemaVersion', 'value'],
      'Module state intent',
    );
    requireResultText(
      cloned.stateIntent.schemaVersion,
      'stateIntent.schemaVersion',
    );
  }

  for (const [index, value] of diagnostics.entries()) {
    if (!isObject(value)) {
      throw invalid(
        'DOMAIN_INVALID_RESULT',
        `Module diagnostic ${index} must be an object.`,
        'interpreting',
      );
    }
    exactKeys(
      value,
      ['code', 'severity', 'value'],
      ['code', 'severity'],
      `Module diagnostic ${index}`,
    );
    requireResultText(value.code, `diagnostics[${index}].code`);
    if (
      value.severity !== 'debug' &&
      value.severity !== 'info' &&
      value.severity !== 'warning' &&
      value.severity !== 'error'
    ) {
      throw invalid(
        'DOMAIN_INVALID_RESULT',
        `Module diagnostic ${index} severity is invalid.`,
        'interpreting',
      );
    }
  }

  return cloned as unknown as ModuleResult<JsonValue>;
}

function recordedReadSet(
  loaded: ExecutionReadSet,
  ranked: readonly RankedMemory[],
): ExecutionReplayReadSet {
  const retrievedMemories: RecordedRankedMemory[] = ranked.map((entry, index) =>
    deepFreeze({
      record: entry.record,
      score: entry.score,
      reasons: entry.reasons,
      rank: index + 1,
    }),
  );
  return deepFreeze({
    state: loaded.state,
    loadedMemories: loaded.memories,
    retrievedMemories,
    documents: loaded.documents,
  });
}

function readContext(
  executionId: string,
  entityId: string,
  now: string,
  readSet: ExecutionReplayReadSet,
): ExecutionReadContext<JsonValue> {
  return deepFreeze({
    executionId,
    entityId,
    now,
    state: readSet.state,
    memories: readSet.retrievedMemories.map(({ record }) => record),
    documents: readSet.documents,
  });
}

function memoryQuery(
  namespace: string,
  entityId: string,
  task: string,
): MemoryQuery {
  return Object.freeze({
    namespace,
    entityId,
    task,
    limit: ACME_MEMORY_RETRIEVAL_LIMIT,
  });
}

function enforceResponseBudgets(
  response: NormalizedModelResponse,
  policy: ExecutionPolicy,
): void {
  const checks = [
    ['inputTokens', response.usage.inputTokens, policy.maxInputTokens],
    ['outputTokens', response.usage.outputTokens, policy.maxOutputTokens],
    [
      'estimatedCostMinor',
      response.usage.estimatedCostMinor,
      policy.maxEstimatedCostMinor,
    ],
  ] as const;
  for (const [field, actual, limit] of checks) {
    if (limit !== undefined && actual !== undefined && actual > limit) {
      throw invalid(
        'BUDGET_EXCEEDED',
        `Model response exceeded ${field} budget.`,
        'calling-model',
        { field, actual, limit },
      );
    }
  }
}

class SingleTaskExecutionEngine implements ExecutionEngine {
  readonly #clock: Clock;
  readonly #ids: IdGenerator;
  readonly #modules: ModuleRegistry;
  readonly #contracts: ContractRegistry;
  readonly #pipeline: ResponsePipeline;
  readonly #gateway: ModelGateway;
  readonly #memory: MemoryEngine;
  readonly #state: StateEngine;
  readonly #repository: ExecutionRepository;
  readonly #hashing: Hashing;

  constructor(options: ExecutionEngineOptions) {
    this.#clock = options.clock;
    this.#ids = options.ids;
    this.#modules = options.modules;
    this.#contracts = options.contracts;
    this.#pipeline = options.pipeline;
    this.#gateway = options.gateway;
    this.#memory = options.memory;
    this.#state = options.state;
    this.#repository = options.repository;
    this.#hashing = options.hashing ?? nodeHashing;
  }

  async execute<TInput>(
    request: ExecutionRequest<TInput>,
  ): Promise<ExecutionResult> {
    const envelope = validateRequestEnvelope(request);
    const effectivePolicy = resolveExecutionPolicy(envelope.policy);
    const resolved = this.#resolve(
      envelope.namespace,
      envelope.task,
      envelope.input,
    );
    const executionId = deriveExecutionId(
      envelope.namespace,
      envelope.requestKey,
      this.#hashing,
    );
    const requestFingerprint = computeRequestFingerprint(
      {
        namespace: envelope.namespace,
        task: envelope.task,
        entityId: envelope.entityId,
        expectedRevision: envelope.expectedRevision,
        input: resolved.taskInput,
        contractFingerprint: resolved.contractFingerprint,
        stateSchemaVersion: resolved.module.stateSchemaVersion,
        model: envelope.model,
      },
      this.#hashing,
    );
    const now = validateTimestamp(this.#clock.now());
    const storedRequest: ExecutionRequest<JsonValue> = deepFreeze({
      requestKey: envelope.requestKey,
      namespace: envelope.namespace,
      task: envelope.task,
      entityId: envelope.entityId,
      expectedRevision: envelope.expectedRevision,
      input: resolved.taskInput,
      model: envelope.model,
      policy: effectivePolicy,
    });
    const acceptance = await this.#repository.accept({
      executionId,
      request: storedRequest,
      requestFingerprint,
      inputHash: computeTaskInputHash(resolved.taskInput, this.#hashing),
      contract: resolved.contract.ref,
      contractFingerprint: resolved.contractFingerprint,
      effectivePolicy,
      createdAt: now,
    });

    if (acceptance.kind === 'conflict') {
      return deepFreeze({
        status: 'conflicted',
        executionId: acceptance.existingExecutionId,
        error: {
          code: 'CONFLICT_IDEMPOTENCY_KEY',
          message: 'Request key was already accepted with different identity.',
          stage: 'accepted',
          retryable: false,
          details: {
            namespace: envelope.namespace,
            requestKey: envelope.requestKey,
          },
        },
      });
    }
    if (acceptance.kind === 'existing') {
      const result = acceptance.execution.result;
      if (result !== undefined) {
        return result.status === 'committed'
          ? deepFreeze({ ...result, replayed: true })
          : result;
      }
    }

    try {
      const resumption =
        acceptance.kind === 'existing'
          ? await this.#planResume(executionId)
          : undefined;
      return await this.#runAccepted(
        storedRequest,
        resolved,
        executionId,
        effectivePolicy,
        now,
        resumption,
      );
    } catch (error) {
      const data = errorData(error, 'failed');
      const status = terminalStatus(data);
      await this.#repository.markTerminal({
        executionId,
        status,
        error: data,
        terminalAt: now,
      });
      return deepFreeze({ status, executionId, error: data });
    }
  }

  async replayVerify(executionId: string): Promise<ReplayReport> {
    requireText(executionId, 'executionId');
    const evidence = await this.#repository.loadReplayEvidence(executionId);
    if (evidence === null) {
      return deepFreeze({
        executionId,
        mode: 'verify',
        status: 'unavailable',
        differences: [
          diagnostic('REPLAY_EVIDENCE_UNAVAILABLE', 'error', { executionId }),
        ],
      });
    }
    return this.#replay(evidence);
  }

  #resolve(
    namespace: string,
    taskName: string,
    input: unknown,
  ): ResolvedExecution {
    const module = this.#modules.get(namespace) as RuntimeModule;
    const task = module.tasks[taskName];
    if (task === undefined) {
      throw invalid(
        'NOT_FOUND_TASK',
        `Task not found: ${namespace}.${taskName}.`,
        'accepted',
        { namespace, task: taskName },
      );
    }
    const contract = this.#contracts.get<JsonValue, JsonValue>(task.contract);
    const contractFingerprint = this.#contracts.fingerprint(task.contract);
    const taskInput = validateSchemaJson(
      task.inputSchema as Schema<JsonValue>,
      input,
      this.#hashing,
      'INVALID_REQUEST',
      'accepted',
      'Task input',
    );
    return Object.freeze({
      module,
      task,
      contract,
      contractFingerprint,
      taskInput,
    });
  }

  async #stage(
    executionId: string,
    attemptNumber: number,
    stage: ExecutionStatus,
    now: string,
  ): Promise<void> {
    await this.#repository.appendAttempt({
      executionId,
      attemptNumber,
      stage,
      outcome: 'started',
      occurredAt: now,
    });
  }

  /**
   * Decide how an accepted but non-terminal execution continues (ADR-0017).
   * Resume never calls the provider: it either continues from a recorded
   * response, runs from the beginning when no reservation exists, or throws a
   * terminal error.
   */
  async #planResume(executionId: string): Promise<Resumption> {
    const state = await this.#repository.loadResumeState(executionId);
    if (state === null) {
      throw invalid(
        'PERSISTENCE_CORRUPTION',
        'Accepted execution has no recorded resume state.',
        'accepted',
        { executionId },
      );
    }
    const attemptNumber = state.lastAttemptNumber + 1;
    const call = state.modelCalls.find(
      (candidate) =>
        candidate.callKey === 'model:0' &&
        candidate.attempt === 1 &&
        candidate.purpose === 'primary',
    );
    // No reservation exists, and reservation precedes dispatch, so no request
    // can have left the process. Running from the beginning is safe.
    if (call === undefined) {
      return Object.freeze({ attemptNumber });
    }
    if (call.status === 'succeeded') {
      if (call.response === undefined) {
        throw invalid(
          'RESUME_EVIDENCE_UNAVAILABLE',
          'Recorded model response is not readable; the execution cannot be resumed.',
          'calling-model',
          { modelCallId: call.modelCallId },
        );
      }
      return Object.freeze({ attemptNumber, recordedResponse: call.response });
    }
    if (call.status === 'failed' || call.status === 'ambiguous') {
      throw new AcmeError(
        call.error ?? {
          code: 'MODEL_UNAVAILABLE',
          message: `Recorded model call is ${call.status} without a recorded error.`,
          stage: 'calling-model',
          retryable: false,
        },
      );
    }
    // Reserved or in-flight: the outcome was never recorded, so the request may
    // have reached the provider. ADR-0014 forbids guessing in that direction.
    throw invalid(
      'MODEL_UNAVAILABLE',
      `Recorded model call is ${call.status}; its outcome was never observed and it is not retried.`,
      'calling-model',
      { modelCallId: call.modelCallId },
    );
  }

  #nextCallId(): string {
    let id: string;
    try {
      id = this.#ids.next('call');
    } catch (cause) {
      throw invalid(
        'INTERNAL',
        'Model-call ID allocation failed.',
        'calling-model',
        undefined,
        cause,
      );
    }
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw invalid(
        'INTERNAL',
        'Model-call ID allocation returned an invalid ID.',
        'calling-model',
      );
    }
    return id;
  }

  async #runAccepted(
    request: ExecutionRequest<JsonValue>,
    resolved: ResolvedExecution,
    executionId: string,
    policy: ExecutionPolicy,
    now: string,
    resumption?: Resumption,
  ): Promise<ExecutionResult> {
    const attemptNumber = resumption?.attemptNumber ?? 1;
    await this.#stage(executionId, attemptNumber, 'loading', now);
    const query = memoryQuery(
      request.namespace,
      request.entityId,
      request.task,
    );
    const loaded = await this.#repository.loadContext({
      namespace: request.namespace,
      entityId: request.entityId,
      expectedRevision: request.expectedRevision,
      memory: query,
    });
    const ranked = this.#memory.retrieve(
      resolved.module.memoryPolicy,
      query,
      loaded.memories,
    );
    const replayReadSet = recordedReadSet(loaded, ranked);
    const context = readContext(
      executionId,
      request.entityId,
      now,
      replayReadSet,
    );
    const contractInput = await resolved.task.project(
      resolved.taskInput,
      context,
    );
    const validatedContractInput = validateSchemaJson(
      resolved.contract.inputSchema,
      contractInput,
      this.#hashing,
      'DOMAIN_INVALID_RESULT',
      'loading',
      'Projected contract input',
    );
    const modelRequest = validateModelRequest(
      resolved.contract.buildRequest(validatedContractInput, {
        executionId,
        now,
      }),
    );
    const requestHash = computeModelRequestHash(modelRequest, this.#hashing);

    await this.#stage(executionId, attemptNumber, 'calling-model', now);
    let response: NormalizedModelResponse;
    if (resumption?.recordedResponse !== undefined) {
      // ADR-0017: the recorded response replaces the call. The provider is not
      // contacted, no reservation is made and no model-call ID is allocated.
      response = validateNormalizedModelResponse(resumption.recordedResponse);
    } else {
      const modelCallId = this.#nextCallId();
      await this.#repository.reserveModelCall({
        modelCallId,
        executionId,
        callKey: 'model:0',
        attempt: 1,
        purpose: 'primary',
        selection: request.model,
        requestHash,
        startedAt: now,
      });

      try {
        response = validateNormalizedModelResponse(
          await this.#gateway.generate(modelRequest, {
            executionId,
            callKey: 'model:0',
            selection: request.model,
            requiredCapabilities: resolved.contract.requiredCapabilities,
            timeoutMs: policy.timeoutMs,
            signal: new AbortController().signal,
          }),
        );
      } catch (error) {
        const data = errorData(error, 'calling-model');
        await this.#repository.failModelCall({
          modelCallId,
          error: data,
          ambiguous: false,
          completedAt: now,
        });
        throw new AcmeError(data);
      }
      await this.#repository.completeModelCall({
        modelCallId,
        response,
        responseHash: computeModelResponseHash(response, this.#hashing),
        completedAt: now,
      });
    }
    enforceResponseBudgets(response, policy);

    await this.#stage(executionId, attemptNumber, 'validating', now);
    const pipeline = this.#pipeline.process(
      response,
      resolved.contract,
      validatedContractInput,
    );
    if (!pipeline.ok) {
      throw invalid(
        'MODEL_INVALID_RESPONSE',
        'Model response failed the bounded response pipeline.',
        'validating',
        {
          pipelineStage: pipeline.stage,
          repairable: pipeline.repairable,
          issues: pipeline.issues as unknown as JsonValue,
        },
      );
    }

    await this.#stage(executionId, attemptNumber, 'interpreting', now);
    const moduleResult = validateModuleResult(
      await resolved.task.interpret(
        pipeline.value,
        resolved.taskInput,
        context,
      ),
      this.#hashing,
    );

    await this.#stage(executionId, attemptNumber, 'evaluating', now);
    await this.#stage(executionId, attemptNumber, 'preparing-commit', now);
    const preparedMemory = this.#memory.prepare(
      resolved.module.memoryPolicy,
      moduleResult.memories,
      loaded.memories,
      {
        namespace: request.namespace,
        entityId: request.entityId,
        executionId,
        now,
      },
    );
    const projectionInput = buildStateProjectionInput(
      moduleResult,
      preparedMemory,
      this.#hashing,
    );
    const delta = resolved.task.projectState(projectionInput, context);
    const operationKey = deriveOperationKey(
      {
        executionId,
        namespace: request.namespace,
        task: request.task,
        entityId: request.entityId,
      },
      this.#hashing,
    );
    const preparedState = this.#state.prepare(
      resolved.module,
      loaded.state as StateSnapshot<JsonValue> | null,
      request.expectedRevision,
      delta,
      {
        entityId: request.entityId,
        executionId,
        operationKey,
        now,
      },
    ) as PreparedState<JsonValue, JsonValue> | null;

    const content: PreparedCommitContent = {
      executionId,
      expectedRevision: request.expectedRevision,
      documents: moduleResult.documents,
      memoryCandidates: moduleResult.memories,
      memory: preparedMemory,
      state: preparedState,
      evaluatorRuns: [],
      events: moduleResult.events,
      committedAt: now,
      replayEvidence: {
        taskInput: resolved.taskInput,
        readSet: replayReadSet,
      },
    };
    const prepared: PreparedCommit = {
      ...content,
      operationDigest: computeOperationDigest(content, this.#hashing),
    };
    const committed = await this.#repository.commit(prepared);
    return deepFreeze({
      status: 'committed',
      executionId,
      replayed: false,
      revision: committed.revision,
      documentKeys: committed.documentKeys,
      eventIds: committed.eventIds,
    });
  }

  async #replay(evidence: ExecutionReplayEvidence): Promise<ReplayReport> {
    const differences: DiagnosticFact[] = [];
    const recordedDigest = evidence.preparedCommit.operationDigest;
    const unavailable = (code: string, value?: JsonValue): ReplayReport =>
      deepFreeze({
        executionId: evidence.executionId,
        mode: 'verify',
        status: 'unavailable',
        recordedDigest,
        differences: [...differences, diagnostic(code, 'error', value)],
      });
    const changed = (code: string, value?: JsonValue): ReplayReport =>
      deepFreeze({
        executionId: evidence.executionId,
        mode: 'verify',
        status: 'different',
        recordedDigest,
        differences: [...differences, diagnostic(code, 'error', value)],
      });

    const call = evidence.modelCalls.find(
      (candidate) =>
        candidate.callKey === 'model:0' &&
        candidate.attempt === 1 &&
        candidate.purpose === 'primary',
    );
    if (
      call === undefined ||
      call.status !== 'succeeded' ||
      call.response === undefined
    ) {
      return unavailable('REPLAY_MODEL_RESPONSE_UNAVAILABLE', {
        retention: evidence.effectivePolicy.retention,
      });
    }

    try {
      const resolved = this.#resolve(
        evidence.request.namespace,
        evidence.request.task,
        evidence.taskInput,
      );
      if (resolved.contractFingerprint !== evidence.contractFingerprint) {
        differences.push(
          diagnostic('REPLAY_CONTRACT_FINGERPRINT_DIFFERENT', 'warning', {
            recorded: evidence.contractFingerprint,
            current: resolved.contractFingerprint,
          }),
        );
      }
      const inputHash = computeTaskInputHash(resolved.taskInput, this.#hashing);
      if (inputHash !== evidence.inputHash) {
        differences.push(
          diagnostic('REPLAY_TASK_INPUT_HASH_DIFFERENT', 'warning', {
            recorded: evidence.inputHash,
            current: inputHash,
          }),
        );
      }
      const now = evidence.preparedCommit.committedAt;
      const context = readContext(
        evidence.executionId,
        evidence.request.entityId,
        now,
        evidence.readSet,
      );
      const projected = await resolved.task.project(
        resolved.taskInput,
        context,
      );
      const contractInput = validateSchemaJson(
        resolved.contract.inputSchema,
        projected,
        this.#hashing,
        'DOMAIN_INVALID_RESULT',
        'loading',
        'Replay contract input',
      );
      const modelRequest: ModelRequest = validateModelRequest(
        resolved.contract.buildRequest(contractInput, {
          executionId: evidence.executionId,
          now,
        }),
      );
      const requestHash = computeModelRequestHash(modelRequest, this.#hashing);
      if (requestHash !== call.requestHash) {
        differences.push(
          diagnostic('REPLAY_MODEL_REQUEST_HASH_DIFFERENT', 'warning', {
            recorded: call.requestHash,
            current: requestHash,
          }),
        );
      }
      const response = validateNormalizedModelResponse(call.response);
      const responseHash = computeModelResponseHash(response, this.#hashing);
      if (responseHash !== call.responseHash) {
        differences.push(
          diagnostic('REPLAY_MODEL_RESPONSE_HASH_DIFFERENT', 'warning', {
            recorded: call.responseHash ?? null,
            current: responseHash,
          }),
        );
      }
      const pipeline = this.#pipeline.process(
        response,
        resolved.contract,
        contractInput,
      );
      if (!pipeline.ok) {
        return changed('REPLAY_RESPONSE_PIPELINE_DIFFERENT', {
          stage: pipeline.stage,
          issues: pipeline.issues as unknown as JsonValue,
        });
      }
      const moduleResult = validateModuleResult(
        await resolved.task.interpret(
          pipeline.value,
          resolved.taskInput,
          context,
        ),
        this.#hashing,
      );

      const replayQuery = memoryQuery(
        evidence.request.namespace,
        evidence.request.entityId,
        evidence.request.task,
      );
      const replayIds = evidence.preparedCommit.memory.mutations
        .filter((mutation) => mutation.action === 'create')
        .map((mutation) => mutation.record.memoryId);
      let idIndex = 0;
      const replayMemory = createMemoryEngine({
        hashing: this.#hashing,
        ids: {
          next(kind) {
            if (kind !== 'memory') {
              throw new Error(`Replay forbids ${kind} ID allocation.`);
            }
            const id = replayIds[idIndex];
            if (id === undefined) {
              throw new Error('Replay has no recorded memory ID remaining.');
            }
            idIndex += 1;
            return id;
          },
        },
      });
      const reranked = replayMemory.retrieve(
        resolved.module.memoryPolicy,
        replayQuery,
        evidence.readSet.loadedMemories,
      );
      const recordedRanked = evidence.readSet.retrievedMemories.map(
        ({ record, score, reasons }) => ({ record, score, reasons }),
      );
      if (!canonicalEqual(reranked, recordedRanked, this.#hashing)) {
        differences.push(diagnostic('REPLAY_RETRIEVAL_DIFFERENT', 'warning'));
      }
      const preparedMemory: PreparedMemory = replayMemory.prepare(
        resolved.module.memoryPolicy,
        moduleResult.memories,
        evidence.readSet.loadedMemories,
        {
          namespace: evidence.request.namespace,
          entityId: evidence.request.entityId,
          executionId: evidence.executionId,
          now,
        },
      );
      if (idIndex !== replayIds.length) {
        differences.push(
          diagnostic('REPLAY_RECORDED_MEMORY_IDS_UNUSED', 'warning', {
            recorded: replayIds.length,
            used: idIndex,
          }),
        );
      }
      const projection = buildStateProjectionInput(
        moduleResult,
        preparedMemory,
        this.#hashing,
      );
      const delta = resolved.task.projectState(projection, context);
      const operationKey = deriveOperationKey(
        {
          executionId: evidence.executionId,
          namespace: evidence.request.namespace,
          task: evidence.request.task,
          entityId: evidence.request.entityId,
        },
        this.#hashing,
      );
      const preparedState = this.#state.prepare(
        resolved.module,
        evidence.readSet.state,
        evidence.request.expectedRevision,
        delta,
        {
          entityId: evidence.request.entityId,
          executionId: evidence.executionId,
          operationKey,
          now,
        },
      ) as PreparedState<JsonValue, JsonValue> | null;
      const content: PreparedCommitContent = {
        executionId: evidence.executionId,
        expectedRevision: evidence.request.expectedRevision,
        documents: moduleResult.documents,
        memoryCandidates: moduleResult.memories,
        memory: preparedMemory,
        state: preparedState,
        evaluatorRuns: [],
        events: moduleResult.events,
        committedAt: now,
        replayEvidence: {
          taskInput: resolved.taskInput,
          readSet: evidence.readSet,
        },
      };
      const replayDigest = computeOperationDigest(content, this.#hashing);
      if (replayDigest !== recordedDigest) {
        differences.push(
          diagnostic('REPLAY_OPERATION_DIGEST_DIFFERENT', 'error', {
            recorded: recordedDigest,
            current: replayDigest,
          }),
        );
      }
      return deepFreeze({
        executionId: evidence.executionId,
        mode: 'verify',
        status: replayDigest === recordedDigest ? 'match' : 'different',
        recordedDigest,
        replayDigest,
        differences,
      });
    } catch (error) {
      const data = errorData(error, 'failed');
      return changed('REPLAY_RECOMPUTATION_FAILED', {
        code: data.code,
        stage: data.stage,
        message: data.message,
      });
    }
  }
}

export function createExecutionEngine(
  options: ExecutionEngineOptions,
): ExecutionEngine {
  return new SingleTaskExecutionEngine(options);
}
