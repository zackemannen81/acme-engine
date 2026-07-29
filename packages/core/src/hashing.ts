import { createHash } from 'node:crypto';

import type { Hashing, JsonValue } from './common.js';

export const ACME_CANONICAL_JSON_ALGORITHM = 'acme-cjson-1' as const;

function assertJsonObject(value: object): void {
  const prototype = Object.getPrototypeOf(value) as unknown;
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Canonical JSON accepts only plain objects.');
  }

  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError('Canonical JSON does not accept symbol keys.');
  }
}

function serializeJson(value: JsonValue, ancestors: Set<object>): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Canonical JSON accepts only finite numbers.');
    }
    return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  }

  if (typeof value !== 'object') {
    throw new TypeError('Canonical JSON received a non-JSON value.');
  }

  if (ancestors.has(value)) {
    throw new TypeError('Canonical JSON does not accept cyclic values.');
  }
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
          throw new TypeError('Canonical JSON does not accept sparse arrays.');
        }
      }

      const indexKeys = new Set(
        Array.from({ length: value.length }, (_, index) => String(index)),
      );
      if (Object.keys(value).some((key) => !indexKeys.has(key))) {
        throw new TypeError(
          'Canonical JSON arrays cannot have named enumerable properties.',
        );
      }

      return `[${value.map((entry) => serializeJson(entry, ancestors)).join(',')}]`;
    }

    assertJsonObject(value);
    const entries = Object.keys(value)
      .sort()
      .map((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (
          descriptor === undefined ||
          descriptor.get !== undefined ||
          descriptor.set !== undefined
        ) {
          throw new TypeError(
            'Canonical JSON does not accept accessor properties.',
          );
        }

        return `${JSON.stringify(key)}:${serializeJson(
          descriptor.value as JsonValue,
          ancestors,
        )}`;
      });

    return `{${entries.join(',')}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalJson(value: JsonValue): string {
  return serializeJson(value, new Set());
}

export function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export const nodeHashing: Hashing = Object.freeze({
  canonicalJson,
  sha256,
});
