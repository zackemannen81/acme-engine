import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import {
  createResponsePipeline,
  sha256,
  type NormalizedModelResponse,
  type PromptContract,
  type SemanticIssue,
} from '../src/index.js';

interface Output {
  readonly value: number;
}

function contract(options?: {
  readonly outputSchema?: z.ZodType<Output>;
  readonly semanticIssues?: readonly SemanticIssue[];
}): PromptContract<unknown, Output> {
  return {
    ref: { id: 'example.output', version: '1.0.0' },
    inputSchema: z.unknown(),
    outputSchema:
      options?.outputSchema ?? z.object({ value: z.number() }).strict(),
    requiredCapabilities: { structuredOutput: true },
    retention: 'hash-only',
    buildRequest: () => ({
      messages: [],
      output: {
        mode: 'json',
        schemaName: 'example_output',
        jsonSchema: {},
      },
    }),
    validateSemantics: () => options?.semanticIssues ?? [],
  };
}

function response(text: string): NormalizedModelResponse {
  return {
    provider: 'fixture',
    model: 'fixture-model',
    receivedAt: '2026-01-01T00:00:00.000Z',
    finishReason: 'stop',
    text,
    usage: {},
    metadata: {},
  };
}

describe('strict response pipeline', () => {
  const pipeline = createResponsePipeline();

  it('distinguishes empty output', () => {
    const result = pipeline.process(response(' \n '), contract());

    expect(result).toMatchObject({
      ok: false,
      stage: 'empty',
      repairable: true,
    });
  });

  it('distinguishes strict JSON parse failures', () => {
    const result = pipeline.process(response('prefix {"value":1}'), contract());

    expect(result).toMatchObject({
      ok: false,
      stage: 'parse',
    });
  });

  it('distinguishes schema failures', () => {
    const result = pipeline.process(
      response('{"value":"not-a-number"}'),
      contract(),
    );

    expect(result).toMatchObject({
      ok: false,
      stage: 'schema',
    });
  });

  it('rejects schema coercion or transformation', () => {
    const result = pipeline.process(
      response('{"value":"1"}'),
      contract({
        outputSchema: z.object({ value: z.coerce.number() }).strict(),
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      stage: 'schema',
      issues: [
        {
          code: 'MODEL_RESPONSE_SCHEMA_COERCION',
        },
      ],
    });
  });

  it('distinguishes semantic errors', () => {
    const result = pipeline.process(
      response('{"value":-1}'),
      contract({
        semanticIssues: [
          {
            code: 'VALUE_NEGATIVE',
            path: ['value'],
            message: 'Value must be non-negative.',
            severity: 'error',
          },
        ],
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      stage: 'semantic',
    });
  });

  it('records BOM and one JSON-fence cleanup as warnings', () => {
    const result = pipeline.process(
      response('\uFEFF```json\n{"value":1}\n```'),
      contract({
        semanticIssues: [
          {
            code: 'VALUE_REVIEWED',
            path: ['value'],
            message: 'Value was reviewed.',
            severity: 'warning',
          },
        ],
      }),
    );

    expect(result).toEqual({
      ok: true,
      value: { value: 1 },
      warnings: [
        {
          code: 'MODEL_RESPONSE_BOM_REMOVED',
          path: [],
          message: 'Removed one leading byte-order mark.',
          severity: 'warning',
        },
        {
          code: 'MODEL_RESPONSE_JSON_FENCE_REMOVED',
          path: [],
          message: 'Removed one enclosing Markdown JSON fence.',
          severity: 'warning',
        },
        {
          code: 'VALUE_REVIEWED',
          path: ['value'],
          message: 'Value was reviewed.',
          severity: 'warning',
        },
      ],
      parsedHash: sha256('{"value":1}'),
    });
  });
});
