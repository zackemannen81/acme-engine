import { canonicalJson, type JsonValue } from '@acme/core';
import { describe, expect, it } from 'vitest';

import {
  computeProviderWireSchemaHash,
  lowerStrictStructuredOutputSchema,
} from '../src/schema-lower.js';

describe('lowerStrictStructuredOutputSchema', () => {
  it('is deterministic byte-for-byte for the same canonical schema', () => {
    const schema: JsonValue = {
      type: 'object',
      properties: {
        b: { type: 'string' },
        a: {
          oneOf: [
            {
              type: 'object',
              properties: {
                type: { type: 'string', const: 'x' },
                value: { type: 'string' },
              },
              required: ['type', 'value'],
              additionalProperties: false,
            },
            {
              type: 'object',
              properties: {
                type: { type: 'string', const: 'y' },
                value: { type: 'number' },
              },
              required: ['type', 'value'],
              additionalProperties: false,
            },
          ],
        },
      },
      required: ['a'],
      additionalProperties: false,
    };

    const first = lowerStrictStructuredOutputSchema(schema);
    const second = lowerStrictStructuredOutputSchema(schema);
    expect(canonicalJson(first)).toBe(canonicalJson(second));
    expect(computeProviderWireSchemaHash(first)).toBe(
      computeProviderWireSchemaHash(second),
    );
  });

  it('makes every property required and expresses optionals as nullable', () => {
    const lowered = lowerStrictStructuredOutputSchema({
      type: 'object',
      properties: {
        requiredField: { type: 'string' },
        optionalField: { type: 'string' },
        alreadyNullable: {
          anyOf: [{ type: 'string' }, { type: 'null' }],
        },
      },
      required: ['requiredField'],
      additionalProperties: false,
    });

    expect(lowered).toEqual({
      type: 'object',
      properties: {
        alreadyNullable: {
          anyOf: [{ type: 'string' }, { type: 'null' }],
        },
        optionalField: {
          anyOf: [{ type: 'string' }, { type: 'null' }],
        },
        requiredField: { type: 'string' },
      },
      required: ['alreadyNullable', 'optionalField', 'requiredField'],
      additionalProperties: false,
    });
  });

  it('lowers a discriminated oneOf to anyOf', () => {
    const lowered = lowerStrictStructuredOutputSchema({
      type: 'object',
      properties: {
        observations: {
          type: 'array',
          items: {
            oneOf: [
              {
                type: 'object',
                properties: {
                  type: { const: 'character-fact' },
                  subject: { type: 'string' },
                },
                required: ['type', 'subject'],
                additionalProperties: false,
              },
              {
                type: 'object',
                properties: {
                  type: { const: 'world-rule' },
                  rule: { type: 'string' },
                },
                required: ['type', 'rule'],
                additionalProperties: false,
              },
            ],
          },
        },
      },
      required: ['observations'],
      additionalProperties: false,
    });

    const items = (
      lowered as {
        properties: {
          observations: { items: { anyOf: unknown; oneOf?: unknown } };
        };
      }
    ).properties.observations.items;
    expect(items.oneOf).toBeUndefined();
    expect(items.anyOf).toHaveLength(2);
  });

  it('refuses a plain oneOf without distinct const discriminators', () => {
    expect(() =>
      lowerStrictStructuredOutputSchema({
        type: 'object',
        properties: {
          value: {
            oneOf: [{ type: 'string' }, { type: 'number' }],
          },
        },
        required: ['value'],
        additionalProperties: false,
      }),
    ).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'UNSUPPORTED_CAPABILITY',
          details: expect.objectContaining({
            construct: 'oneOf',
          }),
        }),
      }),
    );
  });

  it('refuses overlapping discriminator consts', () => {
    expect(() =>
      lowerStrictStructuredOutputSchema({
        oneOf: [
          {
            type: 'object',
            properties: { type: { const: 'same' }, a: { type: 'string' } },
            required: ['type', 'a'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: { type: { const: 'same' }, b: { type: 'number' } },
            required: ['type', 'b'],
            additionalProperties: false,
          },
        ],
      }),
    ).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'UNSUPPORTED_CAPABILITY',
          details: expect.objectContaining({ construct: 'oneOf' }),
        }),
      }),
    );
  });

  it('refuses $ref without attempting a network call', () => {
    expect(() =>
      lowerStrictStructuredOutputSchema({
        $ref: '#/$defs/Thing',
      }),
    ).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'UNSUPPORTED_CAPABILITY',
          details: expect.objectContaining({ construct: '$ref' }),
        }),
      }),
    );
  });

  it('strips $schema metadata from the wire form', () => {
    const lowered = lowerStrictStructuredOutputSchema({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
      additionalProperties: false,
    });
    expect(lowered).toEqual({
      type: 'object',
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
      additionalProperties: false,
    });
  });

  it('lowers the research-shaped optional fields without oneOf', () => {
    const lowered = lowerStrictStructuredOutputSchema({
      type: 'object',
      properties: {
        claims: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              proposition: { type: 'string' },
              evidenceQuote: {
                anyOf: [{ type: 'string' }, { type: 'null' }],
              },
              sourceLocator: {
                anyOf: [{ type: 'string' }, { type: 'null' }],
              },
            },
            required: ['proposition'],
            additionalProperties: false,
          },
        },
      },
      required: ['claims'],
      additionalProperties: false,
    });

    const claim = (
      lowered as {
        properties: {
          claims: {
            items: {
              required: string[];
              properties: Record<string, JsonValue>;
            };
          };
        };
      }
    ).properties.claims.items;

    expect([...claim.required].sort()).toEqual(
      ['evidenceQuote', 'proposition', 'sourceLocator'].sort(),
    );
    expect(claim.properties.evidenceQuote).toEqual({
      anyOf: [{ type: 'string' }, { type: 'null' }],
    });
  });
});
