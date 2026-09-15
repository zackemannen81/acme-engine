import type { Clock, Hashing, IdGenerator, JsonValue } from './common.js';
import {
  AcmeError,
  AmbiguousModelCallError,
  type AcmeErrorData,
} from './errors.js';
import type { ExecutionStatus } from './execution-status.js';
import { nodeHashing } from './hashing.js';
import {
  computeModelExecutionFingerprint,
  deriveModelExecutionId,
  resolveModelExecutionPolicy,
} from './model-execution-identity.js';
import {
  ACME_MODEL_EXECUTION_MAX_RETAINED_PAYLOAD_BYTES,
  ACME_MODEL_EXECUTION_MAX_STREAM_EVENT_BYTES,
  type ModelExecuteOptions,
  type ModelExecutionDiagnostic,
  type ModelExecutionFailureKind,
  type ModelExecutionRequest,
  type ModelExecutionResult,
} from './model-execution-types.js';
import { computeModelRequestHash } from './model-request-hash.js';
import { computeModelResponseHash } from './model-response-hash.js';
import {
  isJsonModelOutput,
  type ModelGateway,
  type ModelStreamEvent,
  type NormalizedModelResponse,
} from './model.js';
import {
  assertRequiredModelCapabilities,
  validateGatewayCallContext,
  validateModelRequest,
  validateModelSelection,
  validateModelStreamEvent,
  validateNormalizedModelResponse,
  validateRequiredModelCapabilities,
} from './model-validation.js';
import type { ModelExecutionRepository } from './repository-model-execution.js';

export interface ModelExecutionEngineOptions {
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly gateway: ModelGateway;
  readonly repository: ModelExecutionRepository;
  readonly hashing?: Hashing;
}

export interface ModelExecutionEngine {
  execute(
    request: ModelExecutionRequest,
    options?: ModelExecuteOptions,
  ): Promise<ModelExecutionResult>;
}

const requestKeys = new Set([
  'model',
  'policy',
  'request',
  'requestKey',
  'requiredCapabilities',
]);

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

function invalid(
  message: string,
  details?: JsonValue,
  code: AcmeErrorData['code'] = 'INVALID_REQUEST',
): never {
  throw new AcmeError({
    code,
    message,
    stage: 'accepted',
    retryable: false,
    ...(details === undefined ? {} : { details }),
  });
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    invalid(`${field} must be a non-empty string.`, { field });
  }
  return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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
    message: 'Model execution failed with an unexpected internal error.',
    stage,
    retryable: false,
  });
}

function isAmbiguous(error: unknown): boolean {
  return (
    error instanceof AmbiguousModelCallError ||
    (error instanceof AcmeError &&
      'ambiguous' in error &&
      (error as { readonly ambiguous?: boolean }).ambiguous === true)
  );
}

function diagnosticOf(
  error: AcmeErrorData,
  extra: Partial<ModelExecutionDiagnostic> = {},
): ModelExecutionDiagnostic {
  const details = isObject(error.details) ? error.details : {};
  const delivery =
    details.delivery === 'not-sent' ||
    details.delivery === 'sent' ||
    details.delivery === 'unknown'
      ? details.delivery
      : extra.delivery;
  const httpStatus =
    typeof details.status === 'number' ? details.status : extra.httpStatus;
  const kind = extra.kind ?? kindOf(error, delivery);
  return deepFreeze({
    kind,
    ...(delivery === undefined ? {} : { delivery }),
    ...(httpStatus === undefined ? {} : { httpStatus }),
    ...(extra.finishReason === undefined
      ? {}
      : { finishReason: extra.finishReason }),
  });
}

function kindOf(
  error: AcmeErrorData,
  delivery: ModelExecutionDiagnostic['delivery'],
): ModelExecutionFailureKind | 'completed' {
  if (error.code === 'TIMEOUT') {
    return delivery === 'sent' || delivery === 'unknown'
      ? 'ambiguous-delivery'
      : 'timeout';
  }
  if (error.code === 'CANCELLED') {
    return 'cancel';
  }
  if (error.code === 'MODEL_AUTH') {
    return 'auth';
  }
  if (error.code === 'MODEL_RATE_LIMIT') {
    return 'rate-limit';
  }
  if (error.code === 'MODEL_CONTENT_FILTER') {
    return 'content-filter';
  }
  if (error.code === 'MODEL_INVALID_RESPONSE') {
    if (error.message.includes('truncated')) {
      return 'truncated-stream';
    }
    if (error.message.includes('malformed')) {
      return 'malformed-stream';
    }
    return 'invalid-response';
  }
  if (error.code === 'CONFLICT_IDEMPOTENCY_KEY') {
    return 'conflict';
  }
  if (error.code === 'UNSUPPORTED_CAPABILITY') {
    return 'unsupported-capability';
  }
  if (error.code === 'INVALID_REQUEST') {
    return 'invalid-request';
  }
  if (error.code === 'RESUME_EVIDENCE_UNAVAILABLE') {
    return 'resume-evidence-unavailable';
  }
  if (
    error.code === 'MODEL_UNAVAILABLE' &&
    (delivery === 'sent' || delivery === 'unknown')
  ) {
    return 'ambiguous-delivery';
  }
  if (typeof error.details === 'object' && error.details !== null) {
    const status = (error.details as { status?: unknown }).status;
    if (typeof status === 'number') {
      return 'provider-http';
    }
  }
  if (error.code === 'MODEL_UNAVAILABLE') {
    return 'unavailable';
  }
  return 'internal';
}

function terminalStatus(
  error: AcmeErrorData,
): 'failed' | 'cancelled' | 'conflicted' {
  if (error.code === 'CONFLICT_IDEMPOTENCY_KEY') {
    return 'conflicted';
  }
  return error.code === 'CANCELLED' ? 'cancelled' : 'failed';
}

function validateEnvelope(request: unknown): ModelExecutionRequest {
  if (!isObject(request)) {
    invalid('Model execution request must be an object.');
  }
  const unexpected = Object.keys(request)
    .filter((key) => !requestKeys.has(key))
    .sort();
  const missing = ['requestKey', 'model', 'request'].filter(
    (key) => !Object.hasOwn(request, key),
  );
  if (unexpected.length > 0 || missing.length > 0) {
    invalid('Model execution request has an invalid shape.', {
      missing,
      unexpected,
    });
  }
  return Object.freeze({
    requestKey: requireText(request.requestKey, 'requestKey'),
    model: validateModelSelection(
      request.model as ModelExecutionRequest['model'],
    ),
    request: validateModelRequest(
      request.request as ModelExecutionRequest['request'],
    ),
    ...(Object.hasOwn(request, 'requiredCapabilities') &&
    request.requiredCapabilities !== undefined
      ? {
          requiredCapabilities: validateRequiredModelCapabilities(
            request.requiredCapabilities as Partial<
              import('./model.js').ModelCapabilities
            >,
          ),
        }
      : {}),
    ...(Object.hasOwn(request, 'policy') && request.policy !== undefined
      ? {
          policy: request.policy as Partial<
            import('./model-execution-types.js').ModelExecutionPolicy
          >,
        }
      : {}),
  });
}

function requiredCapabilitiesOf(
  request: ModelExecutionRequest,
): Partial<import('./model.js').ModelCapabilities> {
  const supplied = request.requiredCapabilities ?? {};
  return deepFreeze({
    ...supplied,
    ...(isJsonModelOutput(request.request.output)
      ? { structuredOutput: true as const }
      : {}),
    ...(request.request.tools !== undefined ? { tools: true as const } : {}),
  });
}

function assertRetainedPayloadBound(
  response: NormalizedModelResponse,
  hashing: Hashing,
): void {
  const bytes = hashing.canonicalJson(response as unknown as JsonValue).length;
  if (bytes > ACME_MODEL_EXECUTION_MAX_RETAINED_PAYLOAD_BYTES) {
    invalid(
      'Retained model response exceeds the 1 MiB payload bound.',
      { bytes, limit: ACME_MODEL_EXECUTION_MAX_RETAINED_PAYLOAD_BYTES },
      'BUDGET_EXCEEDED',
    );
  }
}

function assertStreamEventBound(
  event: ModelStreamEvent,
  hashing: Hashing,
): void {
  const bytes = hashing.canonicalJson(event as unknown as JsonValue).length;
  if (bytes > ACME_MODEL_EXECUTION_MAX_STREAM_EVENT_BYTES) {
    invalid(
      'Model stream event exceeds the per-event bound.',
      { bytes, limit: ACME_MODEL_EXECUTION_MAX_STREAM_EVENT_BYTES },
      'BUDGET_EXCEEDED',
    );
  }
}

async function* streamFromGenerate(
  gateway: ModelGateway,
  request: ModelExecutionRequest['request'],
  context: import('./model.js').GatewayCallContext,
): AsyncIterable<ModelStreamEvent> {
  const response = await gateway.generate(request, context);
  let sequence = 0;
  if (response.text.length > 0) {
    yield deepFreeze({
      type: 'content-delta' as const,
      sequence,
      text: response.text,
    });
    sequence += 1;
  }
  for (const [index, call] of (response.toolCalls ?? []).entries()) {
    yield deepFreeze({
      type: 'tool-call-delta' as const,
      sequence,
      index,
      toolCallId: call.toolCallId,
      name: call.name,
      argumentsDelta: JSON.stringify(call.arguments),
    });
    sequence += 1;
  }
  yield deepFreeze({
    type: 'completed' as const,
    sequence,
    response,
  });
}

class ModelOnlyExecutionEngine implements ModelExecutionEngine {
  readonly #clock: Clock;
  readonly #ids: IdGenerator;
  readonly #gateway: ModelGateway;
  readonly #repository: ModelExecutionRepository;
  readonly #hashing: Hashing;

  constructor(options: ModelExecutionEngineOptions) {
    this.#clock = options.clock;
    this.#ids = options.ids;
    this.#gateway = options.gateway;
    this.#repository = options.repository;
    this.#hashing = options.hashing ?? nodeHashing;
  }

  async execute(
    rawRequest: ModelExecutionRequest,
    options: ModelExecuteOptions = {},
  ): Promise<ModelExecutionResult> {
    let nextSequence = 0;
    const callerOnEvent = options.onEvent;
    const executionOptions: ModelExecuteOptions =
      callerOnEvent === undefined
        ? options
        : {
            ...options,
            onEvent: async (event) => {
              const numbered = deepFreeze({
                ...event,
                sequence: nextSequence,
              }) as ModelStreamEvent;
              nextSequence += 1;
              await callerOnEvent(numbered);
            },
          };
    const envelope = validateEnvelope(rawRequest);
    const policy = resolveModelExecutionPolicy(envelope.policy);
    const requiredCapabilities = requiredCapabilitiesOf(envelope);
    const requestHash = computeModelRequestHash(
      envelope.request,
      this.#hashing,
    );
    const modelExecutionId = deriveModelExecutionId(
      envelope.requestKey,
      this.#hashing,
    );
    const requestFingerprint = computeModelExecutionFingerprint(
      {
        requestKey: envelope.requestKey,
        model: envelope.model,
        requestHash,
        requiredCapabilities,
        policy,
      },
      this.#hashing,
    );
    const now = this.#clock.now();
    const acceptance = await this.#repository.accept({
      modelExecutionId,
      requestKey: envelope.requestKey,
      requestFingerprint,
      requestHash,
      selection: envelope.model,
      request: envelope.request,
      requiredCapabilities,
      effectivePolicy: policy,
      createdAt: now,
    });

    if (acceptance.kind === 'conflict') {
      const error: AcmeErrorData = {
        code: 'CONFLICT_IDEMPOTENCY_KEY',
        message: 'Request key was already accepted with different identity.',
        stage: 'accepted',
        retryable: false,
        details: { requestKey: envelope.requestKey },
      };
      const result: ModelExecutionResult = deepFreeze({
        status: 'conflicted',
        modelExecutionId: acceptance.existingExecutionId,
        error,
        diagnostic: diagnosticOf(error, { kind: 'conflict' }),
      });
      await executionOptions.onEvent?.({
        type: 'failed',
        sequence: 0,
        error,
      });
      return result;
    }

    try {
      if (acceptance.kind === 'existing') {
        return await this.#resume(acceptance.execution, executionOptions, now);
      }
      return await this.#dispatch(envelope, {
        modelExecutionId,
        requestHash,
        requiredCapabilities,
        policy,
        now,
        options: executionOptions,
      });
    } catch (error) {
      const data = errorData(error, 'calling-model');
      const status = terminalStatus(data);
      const diagnostic = isAmbiguous(error)
        ? diagnosticOf(data, { kind: 'ambiguous-delivery' })
        : diagnosticOf(data);
      const result: ModelExecutionResult = deepFreeze({
        status,
        modelExecutionId,
        error: data,
        diagnostic,
      });
      await this.#repository.markTerminal({
        modelExecutionId,
        status: isAmbiguous(error) ? 'ambiguous' : status,
        result,
        error: data,
        diagnostic,
        terminalAt: now,
      });
      await executionOptions.onEvent?.({
        type: 'failed',
        sequence: 0,
        error: data,
      });
      return result;
    }
  }

  async #resume(
    existing: import('./model-execution-types.js').ModelExecutionRecord,
    options: ModelExecuteOptions,
    now: string,
  ): Promise<ModelExecutionResult> {
    if (existing.result !== undefined) {
      if (existing.result.status === 'succeeded') {
        await options.onEvent?.({
          type: 'completed',
          sequence: 0,
          response: existing.result.response,
        });
        return deepFreeze({ ...existing.result, replayed: true });
      }
      await options.onEvent?.({
        type: 'failed',
        sequence: 0,
        error: existing.result.error,
      });
      return existing.result;
    }

    const resume = await this.#repository.loadResumeState(
      existing.modelExecutionId,
    );
    if (resume === null) {
      invalid(
        'Accepted model execution has no recorded resume state.',
        { modelExecutionId: existing.modelExecutionId },
        'PERSISTENCE_CORRUPTION',
      );
    }
    const primary = resume.modelCalls.find(
      (call) => call.callKey === 'model:0' && call.attempt === 1,
    );
    if (primary === undefined) {
      return this.#dispatchFromAccepted(existing, options, now);
    }
    if (primary.status === 'succeeded') {
      if (primary.response === undefined) {
        const error: AcmeErrorData = {
          code: 'RESUME_EVIDENCE_UNAVAILABLE',
          message:
            'A succeeded model call has no recoverable retained response.',
          stage: 'calling-model',
          retryable: false,
          details: { modelExecutionId: existing.modelExecutionId },
        };
        const result: ModelExecutionResult = deepFreeze({
          status: 'failed',
          modelExecutionId: existing.modelExecutionId,
          error,
          diagnostic: diagnosticOf(error),
        });
        if (existing.status !== 'failed') {
          await this.#repository.markTerminal({
            modelExecutionId: existing.modelExecutionId,
            status: 'failed',
            result,
            error,
            diagnostic: result.diagnostic,
            terminalAt: now,
          });
        }
        await options.onEvent?.({ type: 'failed', sequence: 0, error });
        return result;
      }
      const response = validateNormalizedModelResponse(primary.response);
      const result: ModelExecutionResult = deepFreeze({
        status: 'succeeded',
        modelExecutionId: existing.modelExecutionId,
        replayed: true,
        response,
        usage: response.usage,
        diagnostic: { kind: 'completed', finishReason: response.finishReason },
      });
      if (existing.status !== 'succeeded') {
        await this.#repository.markTerminal({
          modelExecutionId: existing.modelExecutionId,
          status: 'succeeded',
          result,
          diagnostic: result.diagnostic,
          terminalAt: now,
        });
      }
      await options.onEvent?.({
        type: 'completed',
        sequence: 0,
        response,
      });
      return result;
    }
    if (primary.status === 'failed' || primary.status === 'ambiguous') {
      const error = primary.error ?? {
        code: 'MODEL_UNAVAILABLE' as const,
        message: 'Recorded model call failed without error evidence.',
        stage: 'calling-model' as const,
        retryable: false,
      };
      const diagnostic =
        primary.status === 'ambiguous'
          ? diagnosticOf(error, { kind: 'ambiguous-delivery' })
          : diagnosticOf(error);
      const result: ModelExecutionResult = deepFreeze({
        status: 'failed' as const,
        modelExecutionId: existing.modelExecutionId,
        error,
        diagnostic,
      });
      await this.#repository.markTerminal({
        modelExecutionId: existing.modelExecutionId,
        status: primary.status === 'ambiguous' ? 'ambiguous' : 'failed',
        result,
        error,
        diagnostic,
        terminalAt: now,
      });
      await options.onEvent?.({ type: 'failed', sequence: 0, error });
      return result;
    }

    const error: AcmeErrorData = {
      code: 'MODEL_UNAVAILABLE',
      message:
        'The model call was reserved or in flight; the outcome is unobserved and is not retried.',
      stage: 'calling-model',
      retryable: false,
      details: {
        modelExecutionId: existing.modelExecutionId,
        modelCallStatus: primary.status,
      },
    };
    const result: ModelExecutionResult = deepFreeze({
      status: 'failed' as const,
      modelExecutionId: existing.modelExecutionId,
      error,
      diagnostic: diagnosticOf(error, { kind: 'ambiguous-delivery' }),
    });
    await this.#repository.failModelCall({
      modelCallId: primary.modelCallId,
      error,
      ambiguous: true,
      completedAt: now,
    });
    await this.#repository.markTerminal({
      modelExecutionId: existing.modelExecutionId,
      status: 'ambiguous',
      result,
      error,
      diagnostic: result.diagnostic,
      terminalAt: now,
    });
    await options.onEvent?.({ type: 'failed', sequence: 0, error });
    return result;
  }

  async #dispatchFromAccepted(
    existing: import('./model-execution-types.js').ModelExecutionRecord,
    options: ModelExecuteOptions,
    now: string,
  ): Promise<ModelExecutionResult> {
    return this.#dispatch(
      {
        requestKey: existing.requestKey,
        model: existing.selection,
        request: existing.request,
        requiredCapabilities: existing.requiredCapabilities,
        policy: existing.policy,
      },
      {
        modelExecutionId: existing.modelExecutionId,
        requestHash: existing.requestHash,
        requiredCapabilities: existing.requiredCapabilities,
        policy: existing.policy,
        now,
        options,
      },
    );
  }

  async #dispatch(
    envelope: ModelExecutionRequest,
    input: {
      readonly modelExecutionId: string;
      readonly requestHash: string;
      readonly requiredCapabilities: ReturnType<typeof requiredCapabilitiesOf>;
      readonly policy: ReturnType<typeof resolveModelExecutionPolicy>;
      readonly now: string;
      readonly options: ModelExecuteOptions;
    },
  ): Promise<ModelExecutionResult> {
    const available = await this.#gateway.capabilities(envelope.model);
    assertRequiredModelCapabilities(available, input.requiredCapabilities);
    const signal = input.options.signal ?? new AbortController().signal;
    const context = validateGatewayCallContext({
      executionId: input.modelExecutionId,
      callKey: 'model:0',
      selection: envelope.model,
      requiredCapabilities: input.requiredCapabilities,
      timeoutMs: input.policy.timeoutMs,
      signal,
    });
    const modelCallId = this.#ids.next('call');
    await this.#repository.reserveModelCall({
      modelCallId,
      executionId: input.modelExecutionId,
      callKey: 'model:0',
      attempt: 1,
      purpose: 'primary',
      selection: envelope.model,
      requestHash: input.requestHash,
      startedAt: input.now,
    });

    try {
      const stream =
        this.#gateway.stream === undefined
          ? streamFromGenerate(this.#gateway, envelope.request, context)
          : this.#gateway.stream(envelope.request, context);
      let completed: NormalizedModelResponse | undefined;
      let lastSequence = -1;
      for await (const raw of stream) {
        const event = validateModelStreamEvent(raw);
        assertStreamEventBound(event, this.#hashing);
        if (event.sequence !== lastSequence + 1) {
          invalid(
            'Model stream events must be strictly ordered.',
            { expected: lastSequence + 1, actual: event.sequence },
            'MODEL_INVALID_RESPONSE',
          );
        }
        lastSequence = event.sequence;
        if (event.type === 'failed') {
          throw new AcmeError(event.error);
        }
        if (event.type === 'completed') {
          completed = validateNormalizedModelResponse(event.response);
        }
        if (event.type !== 'completed') {
          await input.options.onEvent?.(event);
        }
      }
      if (completed === undefined) {
        throw new AcmeError({
          code: 'MODEL_INVALID_RESPONSE',
          message:
            'The provider stream ended without a completed response; the stream was truncated.',
          stage: 'calling-model',
          retryable: false,
        });
      }
      assertRetainedPayloadBound(completed, this.#hashing);
      await this.#repository.completeModelCall({
        modelCallId,
        response: completed,
        responseHash: computeModelResponseHash(completed, this.#hashing),
        completedAt: input.now,
      });
      const result: ModelExecutionResult = deepFreeze({
        status: 'succeeded',
        modelExecutionId: input.modelExecutionId,
        replayed: false,
        response: completed,
        usage: completed.usage,
        diagnostic: {
          kind: 'completed',
          finishReason: completed.finishReason,
        },
      });
      await this.#repository.markTerminal({
        modelExecutionId: input.modelExecutionId,
        status: 'succeeded',
        result,
        diagnostic: result.diagnostic,
        terminalAt: input.now,
      });
      await input.options.onEvent?.({
        type: 'completed',
        sequence: lastSequence,
        response: completed,
      });
      return result;
    } catch (error) {
      const data = errorData(error, 'calling-model');
      const ambiguous = isAmbiguous(error);
      await this.#repository.failModelCall({
        modelCallId,
        error: data,
        ambiguous,
        completedAt: input.now,
      });
      throw error instanceof AcmeError ? error : new AcmeError(data);
    }
  }
}

export function createModelExecutionEngine(
  options: ModelExecutionEngineOptions,
): ModelExecutionEngine {
  return new ModelOnlyExecutionEngine(options);
}
