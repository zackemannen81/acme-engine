import {
  AcmeError,
  canonicalJson,
  nodeHashing,
  type JsonValue,
} from '@acme/core';

import { immutableJson } from './immutable.js';

export const PROVIDER_WIRE_SCHEMA_HASH_ALGORITHM =
  'acme-provider-wire-schema-hash-1' as const;

/** Path segments used only in refusal details (not part of the wire schema). */
export type SchemaPath = readonly (string | number)[];

function refuse(construct: string, path: SchemaPath, message: string): never {
  throw new AcmeError({
    code: 'UNSUPPORTED_CAPABILITY',
    message,
    stage: 'calling-model',
    retryable: false,
    details: immutableJson({
      construct,
      path: [...path],
    }),
  });
}

function isPlainObject(
  value: unknown,
): value is { readonly [key: string]: JsonValue } {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (isPlainObject(value)) {
    return Object.values(value).every(isJsonValue);
  }
  return false;
}

function pathLabel(path: SchemaPath): string {
  if (path.length === 0) {
    return '(root)';
  }
  return path
    .map((segment) =>
      typeof segment === 'number' ? `[${segment}]` : String(segment),
    )
    .join('.');
}

/**
 * True when every branch is an object schema that fixes a distinct `const`
 * on the same property key. Under that condition `oneOf` and `anyOf` coincide.
 */
function discriminators(
  branches: readonly JsonValue[],
): { readonly property: string; readonly values: ReadonlySet<string> } | null {
  if (branches.length === 0) {
    return null;
  }

  let property: string | undefined;
  const values = new Set<string>();

  for (const branch of branches) {
    if (!isPlainObject(branch)) {
      return null;
    }
    const properties = branch.properties;
    if (!isPlainObject(properties)) {
      return null;
    }

    const constKeys: string[] = [];
    for (const [key, schema] of Object.entries(properties)) {
      if (isPlainObject(schema) && Object.hasOwn(schema, 'const')) {
        constKeys.push(key);
      }
    }
    if (constKeys.length === 0) {
      return null;
    }

    // Prefer a shared key when several consts exist; for Zod discriminated
    // unions there is exactly one (`type`).
    const candidate =
      property === undefined
        ? constKeys[0]
        : constKeys.includes(property)
          ? property
          : undefined;
    if (candidate === undefined) {
      return null;
    }
    if (property === undefined) {
      property = candidate;
    }

    const field = properties[property];
    if (!isPlainObject(field) || !Object.hasOwn(field, 'const')) {
      return null;
    }
    const constValue = field.const;
    if (
      typeof constValue !== 'string' &&
      typeof constValue !== 'number' &&
      typeof constValue !== 'boolean'
    ) {
      return null;
    }
    const encoded = JSON.stringify(constValue);
    if (values.has(encoded)) {
      return null;
    }
    values.add(encoded);
  }

  if (property === undefined || values.size !== branches.length) {
    return null;
  }
  return { property, values };
}

function allowsNull(schema: JsonValue): boolean {
  if (!isPlainObject(schema)) {
    return false;
  }
  if (schema.type === 'null') {
    return true;
  }
  if (Array.isArray(schema.type) && schema.type.includes('null')) {
    return true;
  }
  const alternatives = schema.anyOf ?? schema.oneOf;
  if (Array.isArray(alternatives)) {
    return alternatives.some(allowsNull);
  }
  return false;
}

function asNullable(schema: JsonValue): JsonValue {
  if (allowsNull(schema)) {
    return schema;
  }
  return { anyOf: [schema, { type: 'null' }] };
}

const STRIP_KEYS = new Set([
  '$schema',
  '$id',
  '$comment',
  'title',
  'description',
  'examples',
  'default',
]);

const FORBIDDEN_KEYS = new Set([
  '$ref',
  '$defs',
  'definitions',
  'not',
  'if',
  'then',
  'else',
  'dependentRequired',
  'dependentSchemas',
  'patternProperties',
  'unevaluatedProperties',
  'unevaluatedItems',
]);

function lowerNode(schema: JsonValue, path: SchemaPath): JsonValue {
  if (!isPlainObject(schema)) {
    return schema;
  }

  for (const key of Object.keys(schema)) {
    if (FORBIDDEN_KEYS.has(key)) {
      refuse(
        key,
        path,
        `The OpenAI strict structured-output subset cannot express JSON Schema construct '${key}' at ${pathLabel(path)}.`,
      );
    }
  }

  const working: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (STRIP_KEYS.has(key)) {
      continue;
    }
    working[key] = value;
  }

  if (Object.hasOwn(working, 'oneOf')) {
    const branches = working.oneOf;
    if (!Array.isArray(branches) || branches.length === 0) {
      refuse(
        'oneOf',
        path,
        `JSON Schema 'oneOf' at ${pathLabel(path)} is empty or not an array.`,
      );
    }
    if (discriminators(branches) === null) {
      refuse(
        'oneOf',
        [...path, 'oneOf'],
        `JSON Schema 'oneOf' at ${pathLabel(path)} cannot be lowered without loss: branches are not a discriminated union with distinct constant discriminators.`,
      );
    }
    delete working.oneOf;
    working.anyOf = branches.map((branch, index) =>
      lowerNode(branch, [...path, 'oneOf', index]),
    );
  } else if (Object.hasOwn(working, 'anyOf')) {
    const branches = working.anyOf;
    if (!Array.isArray(branches)) {
      refuse(
        'anyOf',
        path,
        `JSON Schema 'anyOf' at ${pathLabel(path)} is not an array.`,
      );
    }
    working.anyOf = branches.map((branch, index) =>
      lowerNode(branch, [...path, 'anyOf', index]),
    );
  }

  if (Object.hasOwn(working, 'allOf')) {
    const branches = working.allOf;
    if (!Array.isArray(branches)) {
      refuse(
        'allOf',
        path,
        `JSON Schema 'allOf' at ${pathLabel(path)} is not an array.`,
      );
    }
    working.allOf = branches.map((branch, index) =>
      lowerNode(branch, [...path, 'allOf', index]),
    );
  }

  if (Object.hasOwn(working, 'items')) {
    const items = working.items;
    if (items === undefined) {
      refuse(
        'items',
        [...path, 'items'],
        `JSON Schema 'items' at ${pathLabel(path)} is missing.`,
      );
    }
    if (Array.isArray(items)) {
      refuse(
        'items',
        [...path, 'items'],
        `Tuple-form 'items' at ${pathLabel(path)} is not supported by the strict structured-output lowering.`,
      );
    }
    working.items = lowerNode(items, [...path, 'items']);
  }

  if (Object.hasOwn(working, 'properties')) {
    const properties = working.properties;
    if (!isPlainObject(properties)) {
      refuse(
        'properties',
        [...path, 'properties'],
        `JSON Schema 'properties' at ${pathLabel(path)} must be an object.`,
      );
    }

    const propertyKeys = Object.keys(properties).sort();
    const loweredProperties: Record<string, JsonValue> = {};
    const originalRequired = new Set<string>();
    if (Object.hasOwn(working, 'required')) {
      const required = working.required;
      if (
        !Array.isArray(required) ||
        !required.every((entry) => typeof entry === 'string')
      ) {
        refuse(
          'required',
          [...path, 'required'],
          `JSON Schema 'required' at ${pathLabel(path)} must be an array of strings.`,
        );
      }
      for (const key of required) {
        originalRequired.add(key);
      }
    }

    for (const key of propertyKeys) {
      const propertyPath = [...path, 'properties', key] as const;
      const propertySchema = properties[key];
      if (propertySchema === undefined) {
        refuse(
          'properties',
          propertyPath,
          `JSON Schema property '${key}' at ${pathLabel(path)} is missing.`,
        );
      }
      let lowered = lowerNode(propertySchema, propertyPath);
      // Strict mode forbids optional fields. Express absence as required null.
      if (!originalRequired.has(key)) {
        lowered = asNullable(lowered);
      }
      loweredProperties[key] = lowered;
    }

    working.properties = loweredProperties;
    // Stable required order matches sorted property keys so the wire form is
    // deterministic even when the input listed a different required order.
    working.required = propertyKeys;
    // Strict structured output requires a closed object shape.
    if (!Object.hasOwn(working, 'additionalProperties')) {
      working.additionalProperties = false;
    } else if (working.additionalProperties !== false) {
      refuse(
        'additionalProperties',
        [...path, 'additionalProperties'],
        `The OpenAI strict structured-output subset requires additionalProperties: false at ${pathLabel(path)}.`,
      );
    }
  }

  // Preserve non-structural keywords (type, const, enum, minLength, ...) as-is.
  return working;
}

/**
 * Lower a canonical JSON Schema into the OpenAI strict structured-output
 * subset. Refuses with `UNSUPPORTED_CAPABILITY` when a construct cannot be
 * rewritten without changing meaning.
 *
 * The function is pure and deterministic: identical input yields identical
 * output byte-for-byte under `canonicalJson`.
 */
export function lowerStrictStructuredOutputSchema(
  schema: JsonValue,
): JsonValue {
  if (!isJsonValue(schema)) {
    refuse(
      'schema',
      [],
      'The output schema is not a JSON value and cannot be lowered.',
    );
  }
  return immutableJson(lowerNode(schema, []));
}

/**
 * Hash of exactly the schema that would be sent on the wire. Canonical request
 * identity stays on `acme-model-request-hash-1`; this second digest records the
 * provider dialect without contaminating it.
 */
export function computeProviderWireSchemaHash(wireSchema: JsonValue): string {
  return nodeHashing.sha256(
    canonicalJson({
      algorithm: PROVIDER_WIRE_SCHEMA_HASH_ALGORITHM,
      schema: wireSchema,
    }),
  );
}
