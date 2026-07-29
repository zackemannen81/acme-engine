import {
  ACME_MODEL_REQUEST_HASH_ALGORITHM,
  computeModelRequestHash,
  type ModelRequest,
} from '../src/index.js';
import { describe, expect, it } from 'vitest';

function request(): ModelRequest {
  return {
    messages: [
      {
        role: 'system',
        content: [{ type: 'text', text: 'Return one observation.' }],
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Observe alpha.' },
          {
            type: 'tool-result',
            toolCallId: 'lookup-1',
            value: { score: 2, tags: ['stable', 'fixture'] },
          },
        ],
      },
    ],
    output: {
      mode: 'json',
      schemaName: 'observation',
      jsonSchema: {
        additionalProperties: false,
        properties: { observation: { type: 'string' } },
        required: ['observation'],
        type: 'object',
      },
    },
    temperature: 0,
    maxOutputTokens: 128,
    stop: ['END', 'STOP'],
  };
}

describe(ACME_MODEL_REQUEST_HASH_ALGORITHM, () => {
  it('matches the immutable golden vector', () => {
    expect(computeModelRequestHash(request())).toBe(
      'b0ae4b222a04c393ed24e1364b93d828211af5885f721de55f72ff5e76b46bd3',
    );
  });

  it('is stable across object insertion order', () => {
    const reordered = {
      stop: ['END', 'STOP'],
      output: {
        jsonSchema: {
          type: 'object',
          required: ['observation'],
          properties: { observation: { type: 'string' } },
          additionalProperties: false,
        },
        schemaName: 'observation',
        mode: 'json',
      },
      messages: request().messages,
      maxOutputTokens: 128,
      temperature: 0,
    } satisfies ModelRequest;

    expect(computeModelRequestHash(reordered)).toBe(
      computeModelRequestHash(request()),
    );
  });

  it('is sensitive to array order', () => {
    const original = request();
    expect(
      computeModelRequestHash({
        ...original,
        stop: ['STOP', 'END'],
      }),
    ).not.toBe(computeModelRequestHash(original));
  });

  it('is sensitive to complete request content', () => {
    const original = request();
    expect(
      computeModelRequestHash({
        ...original,
        maxOutputTokens: 129,
      }),
    ).not.toBe(computeModelRequestHash(original));
    expect(
      computeModelRequestHash({
        ...original,
        messages: [
          ...original.messages.slice(0, -1),
          {
            role: 'user',
            content: [{ type: 'text', text: 'Observe beta.' }],
          },
        ],
      }),
    ).not.toBe(computeModelRequestHash(original));
  });
});
