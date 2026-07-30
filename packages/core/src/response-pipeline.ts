import type { JsonValue } from './common.js';
import type {
  PipelineResult,
  PromptContract,
  ResponsePipeline,
  ResponsePipelineOptions,
  SemanticIssue,
} from './contracts.js';
import { nodeHashing } from './hashing.js';
import type { NormalizedModelResponse } from './model.js';

const jsonFencePattern = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/iu;

function issue(
  code: string,
  message: string,
  severity: 'error' | 'warning' = 'error',
  path: readonly (string | number)[] = [],
): SemanticIssue {
  return { code, path, message, severity };
}

function schemaIssuePath(
  path: readonly PropertyKey[],
): readonly (string | number)[] {
  return path.map((part) => (typeof part === 'symbol' ? String(part) : part));
}

function failed<T>(
  stage: 'input' | 'empty' | 'parse' | 'schema' | 'semantic',
  issues: readonly SemanticIssue[],
  repairable = true,
): PipelineResult<T> {
  return {
    ok: false,
    stage,
    issues,
    repairable,
  };
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

class StrictResponsePipeline implements ResponsePipeline {
  readonly #hashing;

  constructor(options: ResponsePipelineOptions) {
    this.#hashing = options.hashing ?? nodeHashing;
  }

  process<TInput, TOutput>(
    response: NormalizedModelResponse,
    contract: PromptContract<TInput, TOutput>,
    input: TInput,
  ): PipelineResult<TOutput> {
    const inputResult = contract.inputSchema.safeParse(input);
    if (!inputResult.success) {
      return failed(
        'input',
        inputResult.error.issues.map((schemaIssue) =>
          issue(
            'CONTRACT_INPUT_SCHEMA',
            schemaIssue.message,
            'error',
            schemaIssuePath(schemaIssue.path),
          ),
        ),
        false,
      );
    }

    let inputCanonical: string;
    let validatedInputCanonical: string;
    try {
      inputCanonical = this.#hashing.canonicalJson(input as JsonValue);
      validatedInputCanonical = this.#hashing.canonicalJson(
        inputResult.data as JsonValue,
      );
    } catch {
      return failed(
        'input',
        [
          issue(
            'CONTRACT_INPUT_NON_JSON_VALUE',
            'Validated contract input must remain a JSON value.',
          ),
        ],
        false,
      );
    }

    if (inputCanonical !== validatedInputCanonical) {
      return failed(
        'input',
        [
          issue(
            'CONTRACT_INPUT_SCHEMA_COERCION',
            'Input schema changed the supplied JSON value.',
          ),
        ],
        false,
      );
    }

    const semanticInput = deepFreeze(
      JSON.parse(validatedInputCanonical) as TInput,
    );
    const cleanupWarnings: SemanticIssue[] = [];
    let text = response.text;

    if (text.startsWith('\uFEFF')) {
      text = text.slice(1);
      cleanupWarnings.push(
        issue(
          'MODEL_RESPONSE_BOM_REMOVED',
          'Removed one leading byte-order mark.',
          'warning',
        ),
      );
    }

    if (text.trim().length === 0) {
      return failed('empty', [
        ...cleanupWarnings,
        issue('MODEL_RESPONSE_EMPTY', 'Model response is empty.'),
      ]);
    }

    const trimmed = text.trim();
    const fenceMatch = trimmed.match(jsonFencePattern);
    if (fenceMatch !== null) {
      text = fenceMatch[1] ?? '';
      cleanupWarnings.push(
        issue(
          'MODEL_RESPONSE_JSON_FENCE_REMOVED',
          'Removed one enclosing Markdown JSON fence.',
          'warning',
        ),
      );
    } else {
      text = trimmed;
    }

    if (text.trim().length === 0) {
      return failed('empty', [
        ...cleanupWarnings,
        issue('MODEL_RESPONSE_EMPTY', 'Model response is empty.'),
      ]);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return failed('parse', [
        ...cleanupWarnings,
        issue('MODEL_RESPONSE_PARSE', 'Model response is not strict JSON.'),
      ]);
    }

    const schemaResult = contract.outputSchema.safeParse(parsed);
    if (!schemaResult.success) {
      return failed('schema', [
        ...cleanupWarnings,
        ...schemaResult.error.issues.map((schemaIssue) =>
          issue(
            'MODEL_RESPONSE_SCHEMA',
            schemaIssue.message,
            'error',
            schemaIssuePath(schemaIssue.path),
          ),
        ),
      ]);
    }

    let parsedCanonical: string;
    let validatedCanonical: string;
    try {
      parsedCanonical = this.#hashing.canonicalJson(parsed as JsonValue);
      validatedCanonical = this.#hashing.canonicalJson(
        schemaResult.data as JsonValue,
      );
    } catch {
      return failed('schema', [
        ...cleanupWarnings,
        issue(
          'MODEL_RESPONSE_NON_JSON_VALUE',
          'Validated model output must remain a JSON value.',
        ),
      ]);
    }

    if (parsedCanonical !== validatedCanonical) {
      return failed('schema', [
        ...cleanupWarnings,
        issue(
          'MODEL_RESPONSE_SCHEMA_COERCION',
          'Output schema changed the parsed JSON value.',
        ),
      ]);
    }

    const semanticOutput = deepFreeze(
      JSON.parse(validatedCanonical) as TOutput,
    );
    const semanticIssues = contract.validateSemantics(
      semanticOutput,
      semanticInput,
    );
    const semanticErrors = semanticIssues.filter(
      ({ severity }) => severity === 'error',
    );
    if (semanticErrors.length > 0) {
      return failed('semantic', [...cleanupWarnings, ...semanticIssues]);
    }

    return {
      ok: true,
      value: semanticOutput,
      warnings: Object.freeze([...cleanupWarnings, ...semanticIssues]),
      parsedHash: this.#hashing.sha256(validatedCanonical),
    };
  }
}

export function createResponsePipeline(
  options: ResponsePipelineOptions = {},
): ResponsePipeline {
  return new StrictResponsePipeline(options);
}
