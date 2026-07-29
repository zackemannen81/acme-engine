import { describe, expect, it } from 'vitest';

import { canonicalJson, sha256, type JsonValue } from '../src/index.js';

describe('acme-cjson-1', () => {
  it('sorts object keys recursively and preserves array order', () => {
    expect(
      canonicalJson({
        z: 1,
        a: {
          second: true,
          first: ['b', 'a'],
        },
      }),
    ).toBe('{"a":{"first":["b","a"],"second":true},"z":1}');
  });

  it('preserves negative zero and does not normalize Unicode', () => {
    expect(canonicalJson(-0)).toBe('-0');
    expect(canonicalJson('é')).toBe('"é"');
    expect(canonicalJson('e\u0301')).toBe('"é"');
    expect(canonicalJson('é')).not.toBe(canonicalJson('e\u0301'));
  });

  it.each([
    ['non-finite number', Number.NaN],
    ['undefined', undefined],
    ['date object', new Date('2026-01-01T00:00:00.000Z')],
  ])('rejects %s', (_label, value) => {
    expect(() => canonicalJson(value as JsonValue)).toThrow(TypeError);
  });

  it('rejects sparse arrays, accessors, and cycles', () => {
    const sparse = Array.from({ length: 1 }) as JsonValue;
    delete (sparse as JsonValue[])[0];

    const accessor = {};
    Object.defineProperty(accessor, 'value', {
      enumerable: true,
      get: () => 1,
    });

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    expect(() => canonicalJson(sparse)).toThrow('sparse arrays');
    expect(() => canonicalJson(accessor as JsonValue)).toThrow(
      'accessor properties',
    );
    expect(() => canonicalJson(cyclic as JsonValue)).toThrow('cyclic values');
  });
});

describe('SHA-256', () => {
  it('matches the standard abc vector', () => {
    expect(sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a3' + '96177a9cb410ff61f20015ad',
    );
  });
});
