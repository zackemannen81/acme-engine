import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

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

interface Input {
  readonly minimum: number;
  readonly evidence: {
    readonly text: string;
  };
}

function contract(options?: {
  readonly inputSchema?: z.ZodType<Input>;
  readonly outputSchema?: z.ZodType<Output>;
  readonly semanticIssues?: readonly SemanticIssue[];
  readonly validateSemantics?: (
    output: Output,
    input: Input,
  ) => readonly SemanticIssue[];
}): PromptContract<Input, Output> {
  return {
    ref: { id: 'example.output', version: '1.0.0' },
    inputSchema:
      options?.inputSchema ??
      z
        .object({
          minimum: z.number(),
          evidence: z.object({ text: z.string() }).strict(),
        })
        .strict(),
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
    validateSemantics:
      options?.validateSemantics ?? (() => options?.semanticIssues ?? []),
  };
}

const input: Input = { minimum: 0, evidence: { text: 'fixture' } };

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
    const result = pipeline.process(response(' \n '), contract(), input);

    expect(result).toMatchObject({
      ok: false,
      stage: 'empty',
      repairable: true,
    });
  });

  it('distinguishes strict JSON parse failures', () => {
    const result = pipeline.process(
      response('prefix {"value":1}'),
      contract(),
      input,
    );

    expect(result).toMatchObject({
      ok: false,
      stage: 'parse',
    });
  });

  it('distinguishes schema failures', () => {
    const result = pipeline.process(
      response('{"value":"not-a-number"}'),
      contract(),
      input,
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
      input,
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
      input,
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
      input,
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

  it('rejects invalid input before response inspection or semantics', () => {
    const validateSemantics = vi.fn(() => []);
    const unreadableResponse = {
      ...response(''),
      get text(): string {
        throw new Error('response text must not be read');
      },
    };

    const result = pipeline.process(
      unreadableResponse,
      contract({ validateSemantics }),
      { minimum: Number.NaN, evidence: { text: 'fixture' } },
    );

    expect(result).toMatchObject({
      ok: false,
      stage: 'input',
      repairable: false,
      issues: [{ code: 'CONTRACT_INPUT_SCHEMA' }],
    });
    expect(validateSemantics).not.toHaveBeenCalled();
  });

  it('rejects contract-input schema coercion', () => {
    const result = pipeline.process(
      response('{"value":1}'),
      contract({
        inputSchema: z
          .object({
            minimum: z.coerce.number(),
            evidence: z.object({ text: z.string() }).strict(),
          })
          .strict(),
      }),
      {
        minimum: '0',
        evidence: { text: 'fixture' },
      } as unknown as Input,
    );

    expect(result).toMatchObject({
      ok: false,
      stage: 'input',
      repairable: false,
      issues: [{ code: 'CONTRACT_INPUT_SCHEMA_COERCION' }],
    });
  });

  it('binds immutable detached input and output to semantic validation', () => {
    const callerInput: Input = {
      minimum: 1,
      evidence: { text: 'exact evidence' },
    };
    let observedInput: Input | undefined;
    let observedOutput: Output | undefined;

    const result = pipeline.process(
      response('{"value":2}'),
      contract({
        validateSemantics: (output, validatedInput) => {
          observedInput = validatedInput;
          observedOutput = output;
          expect(Object.isFrozen(validatedInput)).toBe(true);
          expect(Object.isFrozen(validatedInput.evidence)).toBe(true);
          expect(Object.isFrozen(output)).toBe(true);
          return output.value >= validatedInput.minimum
            ? []
            : [
                {
                  code: 'VALUE_BELOW_MINIMUM',
                  path: ['value'],
                  message: 'Value is below the supplied minimum.',
                  severity: 'error',
                },
              ];
        },
      }),
      callerInput,
    );

    expect(result).toMatchObject({ ok: true, value: { value: 2 } });
    expect(observedInput).not.toBe(callerInput);
    expect(observedInput?.evidence).not.toBe(callerInput.evidence);
    expect(observedOutput).toEqual({ value: 2 });
    expect(callerInput).toEqual({
      minimum: 1,
      evidence: { text: 'exact evidence' },
    });
  });

  it('allows semantic validation to compare output with supplied input', () => {
    const result = pipeline.process(
      response('{"value":1}'),
      contract({
        validateSemantics: (output, validatedInput) =>
          output.value >= validatedInput.minimum
            ? []
            : [
                {
                  code: 'VALUE_BELOW_MINIMUM',
                  path: ['value'],
                  message: 'Value is below the supplied minimum.',
                  severity: 'error',
                },
              ],
      }),
      { minimum: 2, evidence: { text: 'fixture' } },
    );

    expect(result).toMatchObject({
      ok: false,
      stage: 'semantic',
      issues: [{ code: 'VALUE_BELOW_MINIMUM' }],
    });
  });
});
