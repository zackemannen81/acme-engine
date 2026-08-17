import type {
  ExecutionEngine,
  ExecutionPolicy,
  ExecutionRequest,
  ExecutionResult,
  JsonValue,
  ModelSelection,
} from '@acme/core';

import {
  ACME_ADAPTER_V3_CONTRACT_VERSION,
  ACME_ENGINE_V3_REVIEW_POINT,
  ACME_RUNTIME_COMPATIBILITY_PATH,
  ACME_RUNTIME_DESCRIPTOR,
  ACME_RUNTIME_ERROR_VERSION,
  ACME_RUNTIME_EXECUTE_PATH,
  ACME_RUNTIME_PROTOCOL_VERSION,
  type AcmeAdapterV3ExecutionStage,
  type AcmeAdapterV3Request,
  type AcmeAdapterV3Result,
  type AcmeRuntimeErrorEnvelope,
  type AdapterJsonValue,
} from './aal-runtime-wire.js';

const MAX_REQUEST_BYTES = 1_048_576;
const HEADER_PROTOCOL = 'x-acme-runtime-protocol';
const HEADER_ADAPTER = 'x-acme-adapter-contract';
const HEADER_ENGINE_COMMIT = 'x-acme-engine-commit';
const RETENTION_MODES = new Set(['none', 'hash-only', 'encrypted-payload']);

export type AcmeRuntimeAuthorizer = (
  request: Request,
) => boolean | Promise<boolean>;

export interface AcmeRuntimeHostOptions {
  readonly engine: ExecutionEngine;
  readonly authorize: AcmeRuntimeAuthorizer;
}

export interface AcmeRuntimeHost {
  fetch(request: Request): Promise<Response>;
}

class HostRefusal extends Error {
  readonly status: number;
  readonly code: string;
  readonly headers: Readonly<Record<string, string>> | undefined;

  constructor(
    status: number,
    code: string,
    message: string,
    headers?: Readonly<Record<string, string>>,
  ) {
    super(message);
    this.name = 'HostRefusal';
    this.status = status;
    this.code = code;
    this.headers = headers;
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
    throw new HostRefusal(
      400,
      'INVALID_V3_REQUEST',
      `${label} has an invalid shape.`,
    );
  }
}

function requireText(
  value: unknown,
  label: string,
  maximum = 500,
): asserts value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum) {
    throw new HostRefusal(
      400,
      'INVALID_V3_REQUEST',
      `${label} must be a bounded non-empty string.`,
    );
  }
}

function requireInteger(
  value: unknown,
  label: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): asserts value is number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < minimum ||
    (value as number) > maximum
  ) {
    throw new HostRefusal(
      400,
      'INVALID_V3_REQUEST',
      `${label} must be a safe integer in range.`,
    );
  }
}

function requireExactInteger(
  value: unknown,
  label: string,
  expected: number,
): asserts value is number {
  requireInteger(value, label, expected, expected);
}

function optionalPositiveInteger(value: unknown, label: string): void {
  if (value !== undefined) {
    requireInteger(value, label, 1);
  }
}

function isJsonValue(value: unknown): value is AdapterJsonValue {
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

function validateModel(value: unknown): ModelSelection {
  if (!isRecord(value)) {
    throw new HostRefusal(
      400,
      'INVALID_V3_REQUEST',
      'engineTarget.model must be an object.',
    );
  }
  exactKeys(
    value,
    ['profile', 'providerHint', 'modelHint'],
    ['profile'],
    'engineTarget.model',
  );
  requireText(value.profile, 'engineTarget.model.profile', 200);
  if (value.providerHint !== undefined) {
    requireText(value.providerHint, 'engineTarget.model.providerHint', 200);
  }
  if (value.modelHint !== undefined) {
    requireText(value.modelHint, 'engineTarget.model.modelHint', 200);
  }
  return Object.freeze({
    profile: value.profile,
    ...(value.providerHint === undefined
      ? {}
      : { providerHint: value.providerHint }),
    ...(value.modelHint === undefined ? {} : { modelHint: value.modelHint }),
  });
}

function validatePolicy(value: unknown): ExecutionPolicy {
  if (!isRecord(value)) {
    throw new HostRefusal(
      400,
      'INVALID_V3_REQUEST',
      'engineTarget.policy must be an object.',
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
    [
      'timeoutMs',
      'maxModelCalls',
      'maxRepairCalls',
      'maxRevisionCalls',
      'retention',
    ],
    'engineTarget.policy',
  );
  requireInteger(value.timeoutMs, 'policy.timeoutMs', 1, 300_000);
  requireExactInteger(value.maxModelCalls, 'policy.maxModelCalls', 1);
  requireExactInteger(value.maxRepairCalls, 'policy.maxRepairCalls', 0);
  requireExactInteger(value.maxRevisionCalls, 'policy.maxRevisionCalls', 0);
  optionalPositiveInteger(value.maxInputTokens, 'policy.maxInputTokens');
  optionalPositiveInteger(value.maxOutputTokens, 'policy.maxOutputTokens');
  optionalPositiveInteger(
    value.maxEstimatedCostMinor,
    'policy.maxEstimatedCostMinor',
  );
  if (
    typeof value.retention !== 'string' ||
    !RETENTION_MODES.has(value.retention)
  ) {
    throw new HostRefusal(
      400,
      'INVALID_V3_REQUEST',
      'policy.retention is unsupported.',
    );
  }
  return Object.freeze({
    timeoutMs: value.timeoutMs,
    maxModelCalls: value.maxModelCalls,
    maxRepairCalls: value.maxRepairCalls,
    maxRevisionCalls: value.maxRevisionCalls,
    ...(value.maxInputTokens === undefined
      ? {}
      : { maxInputTokens: value.maxInputTokens as number }),
    ...(value.maxOutputTokens === undefined
      ? {}
      : { maxOutputTokens: value.maxOutputTokens as number }),
    ...(value.maxEstimatedCostMinor === undefined
      ? {}
      : { maxEstimatedCostMinor: value.maxEstimatedCostMinor as number }),
    retention: value.retention as ExecutionPolicy['retention'],
  });
}

function validateV3Request(value: unknown): AcmeAdapterV3Request {
  if (!isRecord(value)) {
    throw new HostRefusal(
      400,
      'INVALID_V3_REQUEST',
      'AAL v3 request must be an object.',
    );
  }
  exactKeys(
    value,
    [
      'contractVersion',
      'requestKey',
      'correlationId',
      'workspaceId',
      'subject',
      'engineTarget',
      'task',
      'sourceArtifactIds',
      'input',
    ],
    [
      'contractVersion',
      'requestKey',
      'correlationId',
      'workspaceId',
      'subject',
      'engineTarget',
      'task',
      'sourceArtifactIds',
      'input',
    ],
    'request',
  );
  if (value.contractVersion !== ACME_ADAPTER_V3_CONTRACT_VERSION) {
    throw new HostRefusal(
      409,
      'ADAPTER_CONTRACT_MISMATCH',
      'AAL adapter contract does not match the runtime host.',
    );
  }
  requireText(value.requestKey, 'requestKey', 300);
  requireText(value.correlationId, 'correlationId', 300);
  requireText(value.workspaceId, 'workspaceId', 300);

  if (!isRecord(value.subject)) {
    throw new HostRefusal(
      400,
      'INVALID_V3_REQUEST',
      'subject must be an object.',
    );
  }
  exactKeys(
    value.subject,
    ['entityType', 'entityId', 'expectedApplicationVersion'],
    ['entityType', 'entityId', 'expectedApplicationVersion'],
    'subject',
  );
  requireText(value.subject.entityType, 'subject.entityType', 100);
  requireText(value.subject.entityId, 'subject.entityId', 300);
  requireInteger(
    value.subject.expectedApplicationVersion,
    'subject.expectedApplicationVersion',
    1,
  );

  if (!isRecord(value.engineTarget)) {
    throw new HostRefusal(
      400,
      'INVALID_V3_REQUEST',
      'engineTarget must be an object.',
    );
  }
  exactKeys(
    value.engineTarget,
    [
      'repository',
      'commit',
      'namespace',
      'entityId',
      'expectedEngineRevision',
      'model',
      'policy',
    ],
    [
      'repository',
      'commit',
      'namespace',
      'entityId',
      'expectedEngineRevision',
      'model',
      'policy',
    ],
    'engineTarget',
  );
  if (
    value.engineTarget.repository !== ACME_ENGINE_V3_REVIEW_POINT.repository ||
    value.engineTarget.commit !== ACME_ENGINE_V3_REVIEW_POINT.commit
  ) {
    throw new HostRefusal(
      409,
      'ENGINE_PIN_MISMATCH',
      'AAL request is pinned to another engine review point.',
    );
  }
  requireText(value.engineTarget.namespace, 'engineTarget.namespace', 200);
  requireText(value.engineTarget.entityId, 'engineTarget.entityId', 300);
  requireInteger(
    value.engineTarget.expectedEngineRevision,
    'engineTarget.expectedEngineRevision',
    0,
  );
  const model = validateModel(value.engineTarget.model);
  const policy = validatePolicy(value.engineTarget.policy);

  if (!isRecord(value.task)) {
    throw new HostRefusal(400, 'INVALID_V3_REQUEST', 'task must be an object.');
  }
  exactKeys(
    value.task,
    [
      'id',
      'engineTask',
      'version',
      'contractRef',
      'inputSchemaSha256',
      'outputSchemaSha256',
    ],
    [
      'id',
      'engineTask',
      'version',
      'contractRef',
      'inputSchemaSha256',
      'outputSchemaSha256',
    ],
    'task',
  );
  requireText(value.task.id, 'task.id', 300);
  requireText(value.task.engineTask, 'task.engineTask', 300);
  requireText(value.task.version, 'task.version', 100);
  if (!/^\d+\.\d+\.\d+$/u.test(value.task.version)) {
    throw new HostRefusal(
      400,
      'INVALID_V3_REQUEST',
      'task.version must be semantic.',
    );
  }
  requireText(value.task.contractRef, 'task.contractRef', 500);
  requireText(value.task.inputSchemaSha256, 'task.inputSchemaSha256', 64);
  requireText(value.task.outputSchemaSha256, 'task.outputSchemaSha256', 64);
  if (
    !/^[0-9a-f]{64}$/u.test(value.task.inputSchemaSha256) ||
    !/^[0-9a-f]{64}$/u.test(value.task.outputSchemaSha256)
  ) {
    throw new HostRefusal(
      400,
      'INVALID_V3_REQUEST',
      'task schema hashes must be lowercase SHA-256 hex.',
    );
  }

  if (
    !Array.isArray(value.sourceArtifactIds) ||
    !value.sourceArtifactIds.every(
      (entry) =>
        typeof entry === 'string' && entry.length > 0 && entry.length <= 300,
    ) ||
    new Set(value.sourceArtifactIds).size !== value.sourceArtifactIds.length
  ) {
    throw new HostRefusal(
      400,
      'INVALID_V3_REQUEST',
      'sourceArtifactIds must contain unique bounded strings.',
    );
  }
  if (!isJsonValue(value.input)) {
    throw new HostRefusal(
      400,
      'INVALID_V3_REQUEST',
      'input must contain only finite JSON values.',
    );
  }

  return Object.freeze({
    contractVersion: ACME_ADAPTER_V3_CONTRACT_VERSION,
    requestKey: value.requestKey,
    correlationId: value.correlationId,
    workspaceId: value.workspaceId,
    subject: Object.freeze({
      entityType: value.subject.entityType,
      entityId: value.subject.entityId,
      expectedApplicationVersion: value.subject.expectedApplicationVersion,
    }),
    engineTarget: Object.freeze({
      repository: ACME_ENGINE_V3_REVIEW_POINT.repository,
      commit: ACME_ENGINE_V3_REVIEW_POINT.commit,
      namespace: value.engineTarget.namespace,
      entityId: value.engineTarget.entityId,
      expectedEngineRevision: value.engineTarget.expectedEngineRevision,
      model,
      policy,
    }),
    task: Object.freeze({
      id: value.task.id,
      engineTask: value.task.engineTask,
      version: value.task.version as `${number}.${number}.${number}`,
      contractRef: value.task.contractRef,
      inputSchemaSha256: value.task.inputSchemaSha256,
      outputSchemaSha256: value.task.outputSchemaSha256,
    }),
    sourceArtifactIds: Object.freeze([...value.sourceArtifactIds]),
    input: value.input,
  });
}

export function toExecutionRequestV3(
  request: AcmeAdapterV3Request,
): ExecutionRequest {
  return Object.freeze({
    requestKey: request.requestKey,
    namespace: request.engineTarget.namespace,
    task: request.task.engineTask,
    entityId: request.engineTarget.entityId,
    expectedRevision: request.engineTarget.expectedEngineRevision,
    input: request.input as JsonValue,
    model: Object.freeze({ ...request.engineTarget.model }),
    policy: Object.freeze({ ...request.engineTarget.policy }),
  } satisfies ExecutionRequest);
}

export function toAcmeAdapterV3Result(
  requestKey: string,
  result: ExecutionResult,
): AcmeAdapterV3Result {
  if (result.status === 'committed') {
    return Object.freeze({
      contractVersion: ACME_ADAPTER_V3_CONTRACT_VERSION,
      requestKey,
      status: 'committed',
      executionId: result.executionId,
      replayed: result.replayed,
      engineRevision: result.revision,
      documentKeys: Object.freeze([...result.documentKeys]),
      eventIds: Object.freeze([...result.eventIds]),
    });
  }
  return Object.freeze({
    contractVersion: ACME_ADAPTER_V3_CONTRACT_VERSION,
    requestKey,
    status: result.status,
    executionId: result.executionId,
    error: Object.freeze({
      code: result.error.code,
      message: result.error.message,
      stage: result.error.stage as AcmeAdapterV3ExecutionStage,
      retryable: result.error.retryable,
      ...(result.error.details === undefined
        ? {}
        : { details: result.error.details as AdapterJsonValue }),
      ...(result.error.causeRef === undefined
        ? {}
        : { causeRef: result.error.causeRef }),
    }),
  });
}

function hostError(
  status: number,
  code: string,
  message: string,
  headers?: Readonly<Record<string, string>>,
): Response {
  const envelope: AcmeRuntimeErrorEnvelope = {
    protocolVersion: ACME_RUNTIME_ERROR_VERSION,
    code,
    message,
  };
  return new Response(JSON.stringify(envelope), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function verifyProtocolHeaders(request: Request): void {
  if (request.headers.get(HEADER_PROTOCOL) !== ACME_RUNTIME_PROTOCOL_VERSION) {
    throw new HostRefusal(
      409,
      'RUNTIME_PROTOCOL_MISMATCH',
      'Runtime protocol header does not match this host.',
    );
  }
  if (
    request.headers.get(HEADER_ADAPTER) !== ACME_ADAPTER_V3_CONTRACT_VERSION
  ) {
    throw new HostRefusal(
      409,
      'ADAPTER_CONTRACT_MISMATCH',
      'Adapter contract header does not match this host.',
    );
  }
  if (
    request.headers.get(HEADER_ENGINE_COMMIT) !==
    ACME_ENGINE_V3_REVIEW_POINT.commit
  ) {
    throw new HostRefusal(
      409,
      'ENGINE_PIN_MISMATCH',
      'Engine commit header does not match this host.',
    );
  }
}

function isJsonContentType(request: Request): boolean {
  const contentType = request.headers.get('content-type');
  if (contentType === null) {
    return false;
  }
  return (
    contentType.split(';', 1)[0]?.trim().toLowerCase() === 'application/json'
  );
}

async function readBoundedBody(request: Request): Promise<Uint8Array> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null) {
    const parsed = Number(declaredLength);
    if (
      !Number.isSafeInteger(parsed) ||
      parsed < 0 ||
      parsed > MAX_REQUEST_BYTES
    ) {
      throw new HostRefusal(
        413,
        'REQUEST_TOO_LARGE',
        'Execute request body exceeds the 1 MiB host limit.',
      );
    }
  }
  if (request.body === null) {
    return new Uint8Array();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel('request body too large');
        throw new HostRefusal(
          413,
          'REQUEST_TOO_LARGE',
          'Execute request body exceeds the 1 MiB host limit.',
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function parseExecuteBody(
  request: Request,
): Promise<AcmeAdapterV3Request> {
  if (!isJsonContentType(request)) {
    throw new HostRefusal(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Execute requires application/json.',
    );
  }
  const bytes = await readBoundedBody(request);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new HostRefusal(
      400,
      'MALFORMED_JSON',
      'Execute body is not valid UTF-8 JSON.',
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new HostRefusal(
      400,
      'MALFORMED_JSON',
      'Execute body is not valid JSON.',
    );
  }
  return validateV3Request(value);
}

async function authorized(
  authorize: AcmeRuntimeAuthorizer,
  request: Request,
): Promise<boolean> {
  try {
    return (await authorize(request)) === true;
  } catch {
    return false;
  }
}

/**
 * Create a Fetch-compatible host around an already composed execution engine.
 * No repository, provider, module or credentials are constructed here.
 */
export function createAcmeRuntimeHost(
  options: AcmeRuntimeHostOptions,
): AcmeRuntimeHost {
  return Object.freeze({
    async fetch(request: Request): Promise<Response> {
      if (!(await authorized(options.authorize, request))) {
        return hostError(
          401,
          'UNAUTHORIZED',
          'Runtime request was not authorized.',
        );
      }

      let url: URL;
      try {
        url = new URL(request.url);
      } catch {
        return hostError(400, 'INVALID_URL', 'Runtime request URL is invalid.');
      }

      try {
        verifyProtocolHeaders(request);

        if (url.pathname === ACME_RUNTIME_COMPATIBILITY_PATH) {
          if (request.method !== 'GET') {
            throw new HostRefusal(
              405,
              'METHOD_NOT_ALLOWED',
              'Compatibility supports GET only.',
              { allow: 'GET' },
            );
          }
          return jsonResponse(ACME_RUNTIME_DESCRIPTOR);
        }

        if (url.pathname === ACME_RUNTIME_EXECUTE_PATH) {
          if (request.method !== 'POST') {
            throw new HostRefusal(
              405,
              'METHOD_NOT_ALLOWED',
              'Execute supports POST only.',
              { allow: 'POST' },
            );
          }
          const v3Request = await parseExecuteBody(request);
          const engineRequest = toExecutionRequestV3(v3Request);
          let result: ExecutionResult;
          try {
            result = await options.engine.execute(engineRequest, {
              signal: request.signal,
            });
          } catch {
            throw new HostRefusal(
              500,
              'ENGINE_HOST_FAILURE',
              'Execution engine escaped its terminal result contract.',
            );
          }
          return jsonResponse(
            toAcmeAdapterV3Result(v3Request.requestKey, result),
          );
        }

        throw new HostRefusal(404, 'NOT_FOUND', 'Runtime route was not found.');
      } catch (error) {
        if (error instanceof HostRefusal) {
          return hostError(
            error.status,
            error.code,
            error.message,
            error.headers,
          );
        }
        return hostError(
          500,
          'INTERNAL_HOST_FAILURE',
          'Runtime host failed unexpectedly.',
        );
      }
    },
  });
}
