import {
  AcmeError,
  type JsonValue,
  type ModelContentPart,
  type ModelRequest,
} from '@acme/core';

import { immutableJson } from './immutable.js';
import {
  computeProviderWireSchemaHash,
  lowerStrictStructuredOutputSchema,
} from './schema-lower.js';

function invalid(message: string, details?: JsonValue): never {
  throw new AcmeError({
    code: 'INVALID_REQUEST',
    message,
    stage: 'calling-model',
    retryable: false,
    ...(details === undefined ? {} : { details }),
  });
}

function partText(part: ModelContentPart, index: number): string {
  if (part.type !== 'text') {
    // Vision and tool results are out of scope for this adapter. Dropping them
    // would silently change the request, so they are rejected instead.
    invalid('The OpenAI Responses adapter accepts text content only.', {
      partIndex: index,
      partType: part.type,
    });
  }
  return part.text;
}

export interface ResponsesBodyBuild {
  readonly body: JsonValue;
  /** Hash of the lowered schema that is actually sent on the wire. */
  readonly providerWireSchemaHash: string;
}

/**
 * Maps the provider-neutral request onto the Responses API body.
 *
 * System messages become `instructions` and everything else keeps its supplied
 * order, so the stable part of a call stays ahead of the changing part.
 *
 * The output schema is lowered into the provider's strict structured-output
 * subset here. Canonical request identity still hashes the un-lowered schema;
 * `providerWireSchemaHash` records exactly what left the adapter.
 */
export function buildResponsesBody(
  request: ModelRequest,
  model: string,
): ResponsesBodyBuild {
  if (request.stop !== undefined && request.stop.length > 0) {
    // Honoring stop sequences is not available on this surface. Silently
    // ignoring them would change response semantics without saying so.
    invalid(
      'The OpenAI Responses adapter cannot honor stop sequences; remove them from the contract request.',
      { stop: [...request.stop] },
    );
  }
  if (request.messages.length === 0) {
    invalid('A model request requires at least one message.');
  }

  const instructions: string[] = [];
  const input: JsonValue[] = [];

  request.messages.forEach((message, messageIndex) => {
    const text = message.content
      .map((part, partIndex) => partText(part, partIndex))
      .join('');
    if (message.role === 'tool') {
      invalid('Tool messages are out of scope for this adapter.', {
        messageIndex,
      });
    }
    if (message.role === 'system') {
      instructions.push(text);
      return;
    }
    input.push({
      role: message.role,
      content: [{ type: 'input_text', text }],
    });
  });

  if (input.length === 0) {
    invalid('A model request requires at least one non-system message.');
  }

  // Preflight: an unlowerable schema raises UNSUPPORTED_CAPABILITY before any
  // transport call, so a bad contract never spends tokens.
  const wireSchema = lowerStrictStructuredOutputSchema(
    request.output.jsonSchema,
  );
  const providerWireSchemaHash = computeProviderWireSchemaHash(wireSchema);

  return {
    body: immutableJson({
      model,
      ...(instructions.length === 0
        ? {}
        : { instructions: instructions.join('\n\n') }),
      input,
      text: {
        format: {
          type: 'json_schema',
          name: request.output.schemaName,
          schema: wireSchema,
          strict: true,
        },
      },
      ...(request.temperature === undefined
        ? {}
        : { temperature: request.temperature }),
      ...(request.maxOutputTokens === undefined
        ? {}
        : { max_output_tokens: request.maxOutputTokens }),
    }),
    providerWireSchemaHash,
  };
}
