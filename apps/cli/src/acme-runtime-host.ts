import type {
  ExecutionEngine,
  ExecutionPolicy,
  ExecutionRequest,
  ExecutionResult,
  JsonValue,
  ModelSelection,
} from '@acme/core';

import {
  ACME_RUNTIME_COMPATIBILITY_PATH,
  ACME_RUNTIME_ERROR_VERSION,
  ACME_RUNTIME_EXECUTE_PATH,
  ACME_RUNTIME_PROTOCOL_VERSION,
  type AcmeRuntimeDescriptor,
  type AcmeRuntimeErrorEnvelope,
  type AcmeRuntimeExecutionPolicy,
  type AcmeRuntimeRequest,
  type AcmeRuntimeResult,
  type RuntimeJsonValue,
} from './acme-runtime-wire.js';

const MAX_REQUEST_BYTES = 1_048_576;
const HEADER_PROTOCOL = 'x-acme-runtime-protocol';
const RETENTION_MODES = new Set(['none', 'hash-only', 'encrypted-payload']);

export type AcmeRuntimeAuthorizer = (
  request: Request,
) => boolean | Promise<boolean>;

export interface AcmeRuntimeHostOptions {
  readonly engine: ExecutionEngine;
  readonly authorize: AcmeRuntimeAuthorizer;
  readonly descriptor: AcmeRuntimeDescriptor;
}

export interface AcmeRuntimeHost {
  fetch(request: Request): Promise<Response>;
}

class HostRefusal extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'HostRefusal';
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
  label: string,
): void {
  const unexpected = Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .sort();
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  if (unexpected.length > 0 || missing.length > 0) {
    throw new HostRefusal(400, 'INVALID_RUNTIME_REQUEST', `${label} has an invalid shape.`);
  }
}

function requireText(
  value: unknown,
  label: string,
  maximum = 500,
): asserts value is string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > maximum
  ) {
    throw new HostRefusal(
      400,
      'INVALID_RUNTIME_REQUEST',
      `${label} must be a bounded non-empty string.`,
    );
  }
}

function requirePositiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new HostRefusal(
      400,
      'INVALID_RUNTIME_REQUEST',
      `${label} must be a positive safe integer.`,
    );
  }
  return value as number;
}

function requireNonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new HostRefusal(
      400,
      'INVALID_RUNTIME_REQUEST',
      `${label} must be a non-negative safe integer.`,
    );
  }
  return value as number;
}

function isJsonValue(value: unknown): value is RuntimeJsonValue {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (!isRecord(value)) {
    return false;
  }
  return Object.values(value).every(isJsonValue);
}

function validateDescriptor(value: AcmeRuntimeDescriptor): AcmeRuntimeDescriptor {
  if (value.protocolVersion !== ACME_RUNTIME_PROTOCOL_VERSION) {
    throw new Error(
      `Runtime descriptor protocolVersion must be ${ACME_RUNTIME_PROTOCOL_VERSION}.`,
    );
  }
  requireText(value.engineBuild, 'descriptor.engineBuild', 300);
  if (value.executePath !== ACME_RUNTIME_EXECUTE_PATH) {
    throw new Error(
      `Runtime descriptor executePath must be ${ACME_RUNTIME_EXECUTE_PATH}.`,
    );
  }
  return Object.freeze({ ...value });
}

function validateModel(value: unknown): ModelSelection {
  if (!isRecord(value)) {
    throw new HostRefusal(
      400,
      'INVALID_RUNTIME_REQUEST',
      'engine.model must be an object.',
    );
  }
  exactKeys(
    value,
    ['profile', 'providerHint', 'modelHint'],
    ['profile'],
    'engine.model',
  );
  requireText(value.profile, 'engine.model.profile', 200);
  if (value.providerHint !== undefined) {
    requireText(value.providerHint, 'engine.model.providerHint', 200);
  }
  if (value.modelHint !== undefined) {
    requireText(value.modelHint, 'engine.model.modelHint', 200);
  }
  return Object.freeze({
    profile: value.profile,
    ...(value.providerHint === undefined
      ? {}
      : { providerHint: value.providerHint }),
    ...(value.modelHint === undefined ? {} : { modelHint: value.modelHint }),
  });
}

function validatePolicy(value: unknown): AcmeRuntimeExecutionPolicy | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new HostRefusal(
      400,
      'INVALID_RUNTIME_REQUEST',
      'engine.policy must be an object.',
    );
  }
  exactKeys(
    value,
    [
      'timeoutMs',
      'maxModelCalls',
      'maxRepairCalls',
      'maxRevisionCalls',
      'maxInputTokens',
      'maxOutputTokens',
      'maxEstimatedCostMinor',
      'retention',
    ],
    [],
    'engine.policy',
  );

  const policy: AcmeRuntimeExecutionPolicy = Object.freeze({
    ...(value.timeoutMs === undefined
      ? {}
      : { timeoutMs: requirePositiveInteger(value.timeoutMs, 'engine.policy.timeoutMs') }),
    ...(value.maxModelCalls === undefined
      ? {}
      : {
          maxModelCalls: requireNonNegativeInteger(
            value.maxModelCalls,
            'engine.policy.maxModelCalls',
          ),
        }),
    ...(value.maxRepairCalls === undefined
      ? {}
      : {
          maxRepairCalls: requireNonNegativeInteger(
            value.maxRepairCalls,
            'engine.policy.maxRepairCalls',
          ),
        }),
    ...(value.maxRevisionCalls === undefined
      ? {}
      : {
          maxRevisionCalls: requireNonNegativeInteger(
            value.maxRevisionCalls,
            'engine.policy.maxRevisionCalls',
          ),
        }),
    ...(value.maxInputTokens === undefined
      ? {}
      : {
          maxInputTokens: requirePositiveInteger(
            value.maxInputTokens,
            'engine.policy.maxInputTokens',
          ),
        }),
    ...(value.maxOutputTokens === undefined
      ? {}
      : {
          maxOutputTokens: requirePositiveInteger(
            value.maxOutputTokens,
            'engine.policy.maxOutputTokens',
          ),
        }),
    ...(value.maxEstimatedCostMinor === undefined
      ? {}
      : {
          maxEstimatedCostMinor: requirePositiveInteger(
            value.maxEstimatedCostMinor,
            'engine.policy.maxEstimatedCostMinor',
          ),
        }),
    ...(value.retention === undefined
      ? {}
      : (() => {
          if (
            typeof value.retention !== 'string' ||
            !RETENTION_MODES.has(value.retention)
          ) {
            throw new HostRefusal(
              400,
              'INVALID_RUNTIME_REQUEST',
              'engine.policy.retention is unsupported.',
            );
          }
          return {
            retention: value.retention as AcmeRuntimeExecutionPolicy['retention'],
          };
        })()),
  });

  return policy;
}

export function validateAcmeRuntimeRequest(value: unknown): AcmeRuntimeRequest {
  if (!isRecord(value)) {
    throw new HostRefusal(
      400,
      'INVALID_RUNTIME_REQUEST',
      'Runtime request must be an object.',
    );
  }
  exactKeys(
    value,
    ['protocolVersion', 'requestKey', 'correlationId', 'engine', 'input'],
    ['protocolVersion', 'requestKey', 'engine', 'input'],
    'request',
  );
  if (value.protocolVersion !== ACME_RUNTIME_PROTOCOL_VERSION) {
    throw new HostRefusal(
      409,
      'RUNTIME_PROTOCOL_MISMATCH',
      'Runtime request protocol version does not match this host.',
    );
  }
  requireText(value.requestKey, 'requestKey', 300);
  if (value.correlationId !== undefined) {
    requireText(value.correlationId, 'correlationId', 300);
  }

  if (!isRecord(value.engine)) {
    throw new HostRefusal(
      400,
      'INVALID_RUNTIME_REQUEST',
      'engine must be an object.',
    );
  }
  exactKeys(
    value.engine,
    ['namespace', 'task', 'entityId', 'expectedRevision', 'model', 'policy'],
    ['namespace', 'task', 'entityId', 'expectedRevision', 'model'],
    'engine',
  );
  requireText(value.engine.namespace, 'engine.namespace', 200);
  requireText(value.engine.task, 'engine.task', 300);
  requireText(value.engine.entityId, 'engine.entityId', 300);
  const expectedRevision = requireNonNegativeInteger(
    value.engine.expectedRevision,
    'engine.expectedRevision',
  );
  const model = validateModel(value.engine.model);
  const policy = validatePolicy(value.engine.policy);

  if (!isJsonValue(value.input)) {
    throw new HostRefusal(
      400,
      'INVALID_RUNTIME_REQUEST',
      'input must contain only finite JSON values.',
    );
  }

  return Object.freeze({
    protocolVersion: ACME_RUNTIME_PROTOCOL_VERSION,
    requestKey: value.requestKey,
    ...(value.correlationId === undefined
      ? {}
      : { correlationId: value.correlationId }),
    engine: Object.freeze({
      namespace: value.engine.namespace,
      task: value.engine.task,
      entityId: value.engine.entityId,
      expectedRevision,
      model,
      ...(policy === undefined ? {} : { policy }),
    }),
    input: value.input,
  });
}

export function toExecutionRequest(
  request: AcmeRuntimeRequest,
): ExecutionRequest {
  const policy: Partial<ExecutionPolicy> | undefined = request.engine.policy;
  return Object.freeze({
    requestKey: request.requestKey,
    namespace: request.engine.namespace,
    task: request.engine.task,
    entityId: request.engine.entityId,
    expectedRevision: request.engine.expectedRevision,
    input: request.input as JsonValue,
    model: Object.freeze({ ...request.engine.model }),
    ...(policy === undefined ? {} : { policy: Object.freeze({ ...policy }) }),
  } satisfies ExecutionRequest);
}

export function toAcmeRuntimeResult(
  requestKey: string,
  result: ExecutionResult,
): AcmeRuntimeResult {
  if (result.status === 'committed') {
    return Object.freeze({
      protocolVersion: ACME_RUNTIME_PROTOCOL_VERSION,
      requestKey,
      status: 'committed',
      executionId: result.executionId,
      replayed: result.replayed,
      revision: result.revision,
      documentKeys: Object.freeze([...result.documentKeys]),
      eventIds: Object.freeze([...result.eventIds]),
    });
  }
  return Object.freeze({
    protocolVersion: ACME_RUNTIME_PROTOCOL_VERSION,
    requestKey,
    status: result.status,
    executionId: result.executionId,
    error: Object.freeze({
      code: result.error.code,
      message: result.error.message,
      stage: result.error.stage,
      retryable: result.error.retryable,
      ...(result.error.details === undefined
        ? {}
        : { details: result.error.details as RuntimeJsonValue }),
      ...(result.error.causeRef === undefined
        ? {}
        : { causeRef: result.error.causeRef }),
    }),
  });
}

function jsonResponse(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
    },
  });
}

function refusalResponse(error: HostRefusal): Response {
  const body: AcmeRuntimeErrorEnvelope = {
    protocolVersion: ACME_RUNTIME_ERROR_VERSION,
    code: error.code,
    message: error.message,
  };
  return jsonResponse(body, error.status);
}

function checkProtocolHeader(request: Request): void {
  if (request.headers.get(HEADER_PROTOCOL) !== ACME_RUNTIME_PROTOCOL_VERSION) {
    throw new HostRefusal(
      409,
      'RUNTIME_PROTOCOL_MISMATCH',
      'x-acme-runtime-protocol does not match this runtime.',
    );
  }
}

async function authorizeRequest(
  authorize: AcmeRuntimeAuthorizer,
  request: Request,
): Promise<void> {
  try {
    if (!(await authorize(request))) {
      throw new HostRefusal(401, 'UNAUTHORIZED', 'Runtime authorization failed.');
    }
  } catch (error) {
    if (error instanceof HostRefusal) {
      throw error;
    }
    throw new HostRefusal(401, 'UNAUTHORIZED', 'Runtime authorization failed.');
  }
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const declared = request.headers.get('content-length');
  if (declared !== null) {
    const parsed = Number(declared);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      throw new HostRefusal(
        400,
        'INVALID_CONTENT_LENGTH',
        'Content-Length must be a non-negative integer.',
      );
    }
    if (parsed > MAX_REQUEST_BYTES) {
      throw new HostRefusal(
        413,
        'REQUEST_BODY_TOO_LARGE',
        'Runtime request body exceeds 1 MiB.',
      );
    }
  }

  if (request.body === null) {
    throw new HostRefusal(400, 'MISSING_BODY', 'Runtime execute request requires a body.');
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) {
        await reader.cancel('runtime request body exceeds 1 MiB');
        throw new HostRefusal(
          413,
          'REQUEST_BODY_TOO_LARGE',
          'Runtime request body exceeds 1 MiB.',
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(body);
  } catch {
    throw new HostRefusal(
      400,
      'INVALID_UTF8',
      'Runtime request body must be valid UTF-8 JSON.',
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HostRefusal(
      400,
      'INVALID_JSON',
      'Runtime request body must be valid JSON.',
    );
  }
}

function requireJsonContentType(request: Request): void {
  const mediaType = request.headers.get('content-type')?.split(';', 1)[0]?.trim();
  if (mediaType !== 'application/json') {
    throw new HostRefusal(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Runtime execute request requires application/json.',
    );
  }
}

export function createAcmeRuntimeHost(
  options: AcmeRuntimeHostOptions,
): AcmeRuntimeHost {
  const descriptor = validateDescriptor(options.descriptor);

  return Object.freeze({
    async fetch(request: Request): Promise<Response> {
      try {
        await authorizeRequest(options.authorize, request);
        checkProtocolHeader(request);
        const path = new URL(request.url).pathname;

        if (path === ACME_RUNTIME_COMPATIBILITY_PATH) {
          if (request.method !== 'GET') {
            throw new HostRefusal(
              405,
              'METHOD_NOT_ALLOWED',
              'Compatibility endpoint requires GET.',
            );
          }
          return jsonResponse(descriptor, 200);
        }

        if (path === ACME_RUNTIME_EXECUTE_PATH) {
          if (request.method !== 'POST') {
            throw new HostRefusal(
              405,
              'METHOD_NOT_ALLOWED',
              'Execute endpoint requires POST.',
            );
          }
          requireJsonContentType(request);
          const runtimeRequest = validateAcmeRuntimeRequest(
            await readBoundedJson(request),
          );
          const result = await options.engine.execute(
            toExecutionRequest(runtimeRequest),
            { signal: request.signal },
          );
          return jsonResponse(
            toAcmeRuntimeResult(runtimeRequest.requestKey, result),
            200,
          );
        }

        throw new HostRefusal(404, 'NOT_FOUND', 'Runtime route was not found.');
      } catch (error) {
        if (error instanceof HostRefusal) {
          return refusalResponse(error);
        }
        return refusalResponse(
          new HostRefusal(
            500,
            'RUNTIME_HOST_FAILURE',
            'The runtime host could not complete the request.',
          ),
        );
      }
    },
  });
}

export const ACME_RUNTIME_MAX_REQUEST_BYTES = MAX_REQUEST_BYTES;
