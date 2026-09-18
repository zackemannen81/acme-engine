import {
  AcmeError,
  isJsonModelOutput,
  type JsonValue,
  type ModelContentPart,
  type ModelFunctionTool,
  type ModelRequest,
} from '@acme-engine/core';

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

function unsupported(control: string, details?: JsonValue): never {
  throw new AcmeError({
    code: 'UNSUPPORTED_CAPABILITY',
    message: `The OpenAI Responses adapter cannot honor ${control}.`,
    stage: 'calling-model',
    retryable: false,
    ...(details === undefined ? {} : { details }),
  });
}

function mappedGenerationFields(
  request: ModelRequest,
): Record<string, JsonValue> {
  if (request.reasoningBudget !== undefined) {
    unsupported('reasoningBudget');
  }
  if (request.enableThinking !== undefined) {
    unsupported('enableThinking');
  }
  if (request.seed !== undefined) {
    unsupported('seed');
  }
  return {
    ...(request.temperature === undefined
      ? {}
      : { temperature: request.temperature }),
    ...(request.topP === undefined ? {} : { top_p: request.topP }),
    ...(request.maxOutputTokens === undefined
      ? {}
      : { max_output_tokens: request.maxOutputTokens }),
    ...(request.reasoningEffort === undefined
      ? {}
      : { reasoning: { effort: request.reasoningEffort } }),
  };
}

function partText(part: ModelContentPart, index: number): string {
  if (part.type !== 'text') {
    invalid(
      'The OpenAI Responses adapter cannot flatten this content part as text.',
      {
        partIndex: index,
        partType: part.type,
      },
    );
  }
  return part.text;
}

function userInputContent(
  parts: readonly ModelContentPart[],
  messageIndex: number,
): JsonValue[] {
  const content: JsonValue[] = [];
  parts.forEach((part, partIndex) => {
    if (part.type === 'text') {
      content.push({ type: 'input_text', text: part.text });
      return;
    }
    if (part.type === 'image') {
      if (part.dataRef.trim().length === 0) {
        invalid('A user image content part requires a non-empty dataRef.', {
          messageIndex,
          partIndex,
        });
      }
      content.push({ type: 'input_image', image_url: part.dataRef });
      return;
    }
    if (part.type === 'tool-call') {
      return;
    }
    invalid('The OpenAI Responses adapter cannot map this user content part.', {
      messageIndex,
      partIndex,
      partType: part.type,
    });
  });
  return content;
}

function toolParameters(tool: ModelFunctionTool, index: number): JsonValue {
  try {
    return lowerStrictStructuredOutputSchema(tool.parameters);
  } catch (error) {
    if (error instanceof AcmeError) {
      throw error;
    }
    invalid('Function tool parameters could not be lowered for the provider.', {
      toolIndex: index,
      toolName: tool.name,
    });
  }
}

export interface ResponsesBodyBuild {
  readonly body: JsonValue;
  /** Hash of the lowered schema that is actually sent on the wire. */
  readonly providerWireSchemaHash?: string;
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
    if (message.role === 'system') {
      const text = message.content
        .map((part, partIndex) => partText(part, partIndex))
        .join('');
      instructions.push(text);
      return;
    }
    if (message.role === 'tool') {
      for (const part of message.content) {
        if (part.type !== 'tool-result') {
          invalid('Tool messages may only contain tool-result parts.', {
            messageIndex,
            partType: part.type,
          });
        }
        input.push({
          type: 'function_call_output',
          call_id: part.toolCallId,
          output: JSON.stringify(part.value),
        });
      }
      return;
    }
    const toolCallParts = message.content.filter(
      (part) => part.type === 'tool-call',
    );
    if (message.role === 'user') {
      const content = userInputContent(message.content, messageIndex);
      if (content.length > 0) {
        input.push({ role: 'user', content });
      }
    } else {
      const textParts = message.content.filter((part) => part.type === 'text');
      const other = message.content.filter(
        (part) => part.type !== 'text' && part.type !== 'tool-call',
      );
      if (other.length > 0) {
        invalid('The OpenAI Responses adapter cannot map this content part.', {
          messageIndex,
          partType: other[0]?.type ?? 'unknown',
        });
      }
      if (textParts.length > 0) {
        input.push({
          role: 'assistant',
          content: [
            {
              type: 'output_text',
              text: textParts
                .map((part, partIndex) => partText(part, partIndex))
                .join(''),
            },
          ],
        });
      }
    }
    for (const part of toolCallParts) {
      if (part.type !== 'tool-call') {
        continue;
      }
      input.push({
        type: 'function_call',
        call_id: part.toolCallId,
        name: part.name,
        arguments: JSON.stringify(part.arguments),
      });
    }
  });

  if (input.length === 0) {
    invalid('A model request requires at least one non-system message.');
  }

  const tools =
    request.tools === undefined
      ? undefined
      : request.tools.map((tool, index) =>
          immutableJson({
            type: 'function',
            name: tool.name,
            ...(tool.description === undefined
              ? {}
              : { description: tool.description }),
            parameters: toolParameters(tool, index),
            strict: true,
          }),
        );

  if (isJsonModelOutput(request.output)) {
    const wireSchema = lowerStrictStructuredOutputSchema(
      request.output.jsonSchema,
    );
    return {
      body: immutableJson({
        model,
        ...(instructions.length === 0
          ? {}
          : { instructions: instructions.join('\n\n') }),
        input,
        ...(tools === undefined ? {} : { tools }),
        text: {
          format: {
            type: 'json_schema',
            name: request.output.schemaName,
            schema: wireSchema,
            strict: true,
          },
        },
        ...mappedGenerationFields(request),
      }),
      providerWireSchemaHash: computeProviderWireSchemaHash(wireSchema),
    };
  }

  return {
    body: immutableJson({
      model,
      ...(instructions.length === 0
        ? {}
        : { instructions: instructions.join('\n\n') }),
      input,
      ...(tools === undefined ? {} : { tools }),
      text: { format: { type: 'text' } },
      ...mappedGenerationFields(request),
    }),
  };
}
