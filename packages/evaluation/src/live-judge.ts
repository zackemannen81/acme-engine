import {
  type GatewayCallContext,
  type JsonValue,
  type ModelGateway,
  type ModelRequest,
  type ModelSelection,
  type NormalizedModelResponse,
} from '@acme/core';

import type {
  QualityEvaluationInput,
  QualityEvaluationRecord,
  QualityEvaluationStore,
} from './contracts.js';
import { QualityEvaluationError } from './errors.js';
import { createQualityEvaluationRecord } from './identity.js';

export const LIVE_MODEL_QUALITY_EVALUATOR_KIND = 'live-model' as const;

/** Fixed JSON Schema name for strict structured quality judgments. */
export const LIVE_QUALITY_RESULT_SCHEMA_NAME =
  'acme_live_quality_result_1' as const;

/**
 * Provider-neutral schema for a quality result body. Matches
 * `parseQualityEvaluationResult` expectations after JSON parse of response text.
 */
export const LIVE_QUALITY_RESULT_JSON_SCHEMA: JsonValue = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['scores', 'findings', 'verdict'],
  properties: {
    scores: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'value', 'scale', 'interpretation'],
        properties: {
          id: { type: 'string', minLength: 1 },
          value: { type: 'number' },
          scale: {
            type: 'object',
            additionalProperties: false,
            required: ['min', 'max'],
            properties: {
              min: { type: 'number' },
              max: { type: 'number' },
            },
          },
          interpretation: {
            type: 'string',
            enum: ['higher-is-better', 'lower-is-better', 'nominal'],
          },
        },
      },
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'severity', 'message'],
        properties: {
          code: { type: 'string', minLength: 1 },
          severity: { type: 'string', enum: ['info', 'warning', 'error'] },
          message: { type: 'string', minLength: 1 },
        },
      },
    },
    verdict: {
      type: 'string',
      enum: ['pass', 'fail', 'inconclusive'],
    },
  },
});

export interface LiveModelQualityJudgeOptions {
  readonly store: QualityEvaluationStore;
  readonly gateway: ModelGateway;
  readonly selection: ModelSelection;
  readonly input: QualityEvaluationInput;
  /** Evaluator identity; kind is always `live-model`. */
  readonly evaluator: {
    readonly id: string;
    readonly version: string;
  };
  readonly timeoutMs?: number;
  /**
   * Builds the model request. Defaults to a bounded JSON judgment over the
   * subject digests and artifact (no ledger mutation).
   */
  readonly buildRequest?: (input: QualityEvaluationInput) => ModelRequest;
}

function defaultRequest(input: QualityEvaluationInput): ModelRequest {
  const payload = {
    subject: input.subject,
    subjectDigest: input.subjectDigest,
    executionResult: input.executionResult,
    artifact: input.artifact,
  };
  return {
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'Judge the supplied execution artifact. Return only the requested JSON quality result. Do not invent ledger facts; score only what the artifact supports.',
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: JSON.stringify(payload),
          },
        ],
      },
    ],
    output: {
      mode: 'json',
      schemaName: LIVE_QUALITY_RESULT_SCHEMA_NAME,
      jsonSchema: LIVE_QUALITY_RESULT_JSON_SCHEMA,
    },
  };
}

function parseResponseText(response: NormalizedModelResponse): unknown {
  const text = response.text?.trim() ?? '';
  if (text.length === 0) {
    throw new QualityEvaluationError(
      'INVALID_QUALITY_EVALUATION',
      'Live quality judge received an empty model response.',
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new QualityEvaluationError(
      'INVALID_QUALITY_EVALUATION',
      'Live quality judge response was not valid JSON.',
    );
  }
}

/**
 * Runs one live (or injected-gateway) quality judgment outside the synchronous
 * harness and appends the result to the store (ACME-0068 / plan Q4).
 *
 * The harness still refuses Promise returns; this path owns async model I/O.
 */
export async function runLiveModelQualityJudge(
  options: LiveModelQualityJudgeOptions,
): Promise<QualityEvaluationRecord> {
  const timeoutMs = options.timeoutMs ?? 60_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new QualityEvaluationError(
      'INVALID_QUALITY_EVALUATION',
      'Live quality judge timeoutMs must be a positive integer.',
    );
  }
  const request =
    options.buildRequest?.(options.input) ?? defaultRequest(options.input);
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  const context: GatewayCallContext = {
    executionId: options.input.subject.executionId,
    callKey: 'quality:live-model:0',
    selection: options.selection,
    requiredCapabilities: { structuredOutput: true, tools: false, vision: false },
    timeoutMs,
    signal: controller.signal,
  };
  let response: NormalizedModelResponse;
  try {
    response = await options.gateway.generate(request, context);
  } catch (error: unknown) {
    throw new QualityEvaluationError(
      'INVALID_QUALITY_EVALUATION',
      error instanceof Error
        ? `Live quality judge model call failed: ${error.message}`
        : 'Live quality judge model call failed.',
    );
  } finally {
    clearTimeout(timer);
  }

  const rawResult = parseResponseText(response);
  const record = createQualityEvaluationRecord({
    input: options.input,
    evaluator: {
      id: options.evaluator.id,
      version: options.evaluator.version,
      kind: LIVE_MODEL_QUALITY_EVALUATOR_KIND,
    },
    result: rawResult,
  });
  await options.store.put(record);
  return record;
}
