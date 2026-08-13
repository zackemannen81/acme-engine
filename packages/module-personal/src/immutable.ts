/** Deep-freezes a JSON value so a policy result cannot be mutated after return. */
export function immutableJson<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value as Record<string, unknown>)) {
      immutableJson(child);
    }
    Object.freeze(value);
  }
  return value;
}
