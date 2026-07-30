import { canonicalJson, type JsonValue } from '@acme/core';

export function freezeDeep<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return value;
  }

  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    freezeDeep((value as Record<PropertyKey, unknown>)[key], seen);
  }
  return Object.freeze(value);
}

export function immutableJson<T>(value: T): T {
  return freezeDeep(
    JSON.parse(canonicalJson(value as JsonValue)) as unknown as T,
  );
}
