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
  stage: 'empty' | 'parse' | 'schema' | 'semantic',
  issues: readonly SemanticIssue[],
): PipelineResult<T> {
  return {
    ok: false,
    stage,
    issues,
    repairable: true,
  };
}

class StrictResponsePipeline implements ResponsePipeline {
  readonly #hashing;

  constructor(options: ResponsePipelineOptions) {
    this.#hashing = options.hashing ?? nodeHashing;
  }

  process<T>(
    response: NormalizedModelResponse,
    contract: PromptContract<unknown, T>,
  ): PipelineResult<T> {
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

    const semanticIssues = contract.validateSemantics(schemaResult.data);
    const semanticErrors = semanticIssues.filter(
      ({ severity }) => severity === 'error',
    );
    if (semanticErrors.length > 0) {
      return failed('semantic', [...cleanupWarnings, ...semanticIssues]);
    }

    return {
      ok: true,
      value: schemaResult.data,
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
