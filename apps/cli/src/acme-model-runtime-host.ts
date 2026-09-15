import {
  ACME_MODEL_EXECUTION_MAX_REQUEST_BYTES,
  ACME_MODEL_EXECUTION_MAX_STREAM_EVENT_BYTES,
  type ModelExecutionEngine,
  type ModelExecutionRequest,
  type ModelExecutionResult,
  type ModelSelection,
  type ModelStreamEvent,
  validateModelRequest,
  validateModelSelection,
  validateRequiredModelCapabilities,
} from '@acme/core';

import {
  ACME_MODEL_RUNTIME_COMPATIBILITY_PATH,
  ACME_MODEL_RUNTIME_ERROR_VERSION,
  ACME_MODEL_RUNTIME_EXECUTE_PATH,
  ACME_MODEL_RUNTIME_HEADER,
  ACME_MODEL_RUNTIME_PROTOCOL_VERSION,
  type AcmeModelRuntimeDescriptor,
  type AcmeModelRuntimeErrorEnvelope,
  type AcmeModelRuntimeRequest,
} from './acme-model-runtime-wire.js';

const RETENTION_MODES = new Set(['none', 'hash-only', 'encrypted-payload']);

export type AcmeModelRuntimeAuthorizer = (
  request: Request,
) => boolean | Promise<boolean>;

export interface AcmeModelRuntimeHostOptions {
  readonly engine: ModelExecutionEngine;
  readonly authorize: AcmeModelRuntimeAuthorizer;
  readonly descriptor: AcmeModelRuntimeDescriptor;
}

export interface AcmeModelRuntimeHost {
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
    throw new HostRefusal(
      400,
      'INVALID_MODEL_RUNTIME_REQUEST',
      `${label} has an invalid shape.`,
    );
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
      'INVALID_MODEL_RUNTIME_REQUEST',
      `${label} must be a bounded non-empty string.`,
    );
  }
}

function requirePositiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new HostRefusal(
      400,
      'INVALID_MODEL_RUNTIME_REQUEST',
      `${label} must be a positive safe integer.`,
    );
  }
  return value as number;
}

function validateDescriptor(
  value: AcmeModelRuntimeDescriptor,
): AcmeModelRuntimeDescriptor {
  if (value.protocolVersion !== ACME_MODEL_RUNTIME_PROTOCOL_VERSION) {
    throw new Error(
      `Model runtime descriptor protocolVersion must be ${ACME_MODEL_RUNTIME_PROTOCOL_VERSION}.`,
    );
  }
  requireText(value.engineBuild, 'descriptor.engineBuild', 300);
  if (value.executePath !== ACME_MODEL_RUNTIME_EXECUTE_PATH) {
    throw new Error(
      `Model runtime descriptor executePath must be ${ACME_MODEL_RUNTIME_EXECUTE_PATH}.`,
    );
  }
  return Object.freeze({ ...value });
}

function validateModel(value: unknown): ModelSelection {
  if (!isRecord(value)) {
    throw new HostRefusal(
      400,
      'INVALID_MODEL_RUNTIME_REQUEST',
      'model must be an object.',
    );
  }
  try {
    return validateModelSelection(value as unknown as ModelSelection);
  } catch {
    throw new HostRefusal(
      400,
      'INVALID_MODEL_RUNTIME_REQUEST',
      'model has an invalid shape.',
    );
  }
}

function validatePolicy(value: unknown): AcmeModelRuntimeRequest['policy'] {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new HostRefusal(
      400,
      'INVALID_MODEL_RUNTIME_REQUEST',
      'policy must be an object.',
    );
  }
  exactKeys(value, ['timeoutMs', 'retention'], [], 'policy');
  const policy: {
    timeoutMs?: number;
    retention?: 'none' | 'hash-only' | 'encrypted-payload';
  } = {};
  if (value.timeoutMs !== undefined) {
    policy.timeoutMs = requirePositiveInteger(
      value.timeoutMs,
      'policy.timeoutMs',
    );
  }
  if (value.retention !== undefined) {
    if (
      typeof value.retention !== 'string' ||
      !RETENTION_MODES.has(value.retention)
    ) {
      throw new HostRefusal(
        400,
        'INVALID_MODEL_RUNTIME_REQUEST',
        'policy.retention is unsupported.',
      );
    }
    policy.retention = value.retention as
      'none' | 'hash-only' | 'encrypted-payload';
  }
  return Object.freeze(policy);
}

export function validateAcmeModelRuntimeRequest(
  value: unknown,
): AcmeModelRuntimeRequest {
  if (!isRecord(value)) {
    throw new HostRefusal(
      400,
      'INVALID_MODEL_RUNTIME_REQUEST',
      'Model runtime request must be an object.',
    );
  }
  exactKeys(
    value,
    [
      'protocolVersion',
      'requestKey',
      'correlationId',
      'model',
      'request',
      'requiredCapabilities',
      'policy',
    ],
    ['protocolVersion', 'requestKey', 'model', 'request'],
    'request',
  );
  if (value.protocolVersion !== ACME_MODEL_RUNTIME_PROTOCOL_VERSION) {
    throw new HostRefusal(
      409,
      'MODEL_RUNTIME_PROTOCOL_MISMATCH',
      'Model runtime request protocol version does not match this host.',
    );
  }
  requireText(value.requestKey, 'requestKey', 300);
  if (value.correlationId !== undefined) {
    requireText(value.correlationId, 'correlationId', 300);
  }
  const model = validateModel(value.model);
  let request;
  try {
    request = validateModelRequest(value.request as never);
  } catch {
    throw new HostRefusal(
      400,
      'INVALID_MODEL_RUNTIME_REQUEST',
      'request is not a valid prepared model request.',
    );
  }
  let requiredCapabilities;
  if (value.requiredCapabilities !== undefined) {
    try {
      requiredCapabilities = validateRequiredModelCapabilities(
        value.requiredCapabilities as never,
      );
    } catch {
      throw new HostRefusal(
        400,
        'INVALID_MODEL_RUNTIME_REQUEST',
        'requiredCapabilities has an invalid shape.',
      );
    }
  }
  const policy = validatePolicy(value.policy);
  return Object.freeze({
    protocolVersion: ACME_MODEL_RUNTIME_PROTOCOL_VERSION,
    requestKey: value.requestKey,
    ...(value.correlationId === undefined
      ? {}
      : { correlationId: value.correlationId }),
    model,
    request,
    ...(requiredCapabilities === undefined ? {} : { requiredCapabilities }),
    ...(policy === undefined ? {} : { policy }),
  });
}

export function toModelExecutionRequest(
  request: AcmeModelRuntimeRequest,
): ModelExecutionRequest {
  return Object.freeze({
    requestKey: request.requestKey,
    model: request.model,
    request: request.request,
    ...(request.requiredCapabilities === undefined
      ? {}
      : { requiredCapabilities: request.requiredCapabilities }),
    ...(request.policy === undefined ? {} : { policy: request.policy }),
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
  const body: AcmeModelRuntimeErrorEnvelope = {
    protocolVersion: ACME_MODEL_RUNTIME_ERROR_VERSION,
    code: error.code,
    message: error.message,
  };
  return jsonResponse(body, error.status);
}

function checkProtocolHeader(request: Request): void {
  if (
    request.headers.get(ACME_MODEL_RUNTIME_HEADER) !==
    ACME_MODEL_RUNTIME_PROTOCOL_VERSION
  ) {
    throw new HostRefusal(
      409,
      'MODEL_RUNTIME_PROTOCOL_MISMATCH',
      'x-acme-model-runtime-protocol does not match this runtime.',
    );
  }
}

async function authorizeRequest(
  authorize: AcmeModelRuntimeAuthorizer,
  request: Request,
): Promise<void> {
  try {
    if (!(await authorize(request))) {
      throw new HostRefusal(
        401,
        'UNAUTHORIZED',
        'Model runtime authorization failed.',
      );
    }
  } catch (error) {
    if (error instanceof HostRefusal) {
      throw error;
    }
    throw new HostRefusal(
      401,
      'UNAUTHORIZED',
      'Model runtime authorization failed.',
    );
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
    if (parsed > ACME_MODEL_EXECUTION_MAX_REQUEST_BYTES) {
      throw new HostRefusal(
        413,
        'REQUEST_BODY_TOO_LARGE',
        'Model runtime request body exceeds 1 MiB.',
      );
    }
  }
  if (request.body === null) {
    throw new HostRefusal(
      400,
      'MISSING_BODY',
      'Model runtime execute request requires a body.',
    );
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > ACME_MODEL_EXECUTION_MAX_REQUEST_BYTES) {
        await reader.cancel('model runtime request body exceeds 1 MiB');
        throw new HostRefusal(
          413,
          'REQUEST_BODY_TOO_LARGE',
          'Model runtime request body exceeds 1 MiB.',
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
      'Model runtime request body must be valid UTF-8 JSON.',
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HostRefusal(
      400,
      'INVALID_JSON',
      'Model runtime request body must be valid JSON.',
    );
  }
}

function requireJsonContentType(request: Request): void {
  const mediaType = request.headers
    .get('content-type')
    ?.split(';', 1)[0]
    ?.trim();
  if (mediaType !== 'application/json') {
    throw new HostRefusal(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Model runtime execute request requires application/json.',
    );
  }
}

function encodeSse(
  event: ModelStreamEvent,
  result?: ModelExecutionResult,
): string {
  const payload: Record<string, unknown> = {
    protocolVersion: ACME_MODEL_RUNTIME_PROTOCOL_VERSION,
    type: event.type,
    sequence: event.sequence,
  };
  if (event.type === 'reasoning-delta' || event.type === 'content-delta') {
    payload.text = event.text;
  }
  if (event.type === 'tool-call-delta') {
    payload.index = event.index;
    if (event.toolCallId !== undefined) payload.toolCallId = event.toolCallId;
    if (event.name !== undefined) payload.name = event.name;
    if (event.argumentsDelta !== undefined) {
      payload.argumentsDelta = event.argumentsDelta;
    }
  }
  if (event.type === 'completed') {
    payload.response = event.response;
    if (result !== undefined && result.status === 'succeeded') {
      payload.result = {
        status: result.status,
        modelExecutionId: result.modelExecutionId,
        replayed: result.replayed,
        usage: result.usage,
        diagnostic: result.diagnostic,
        response: result.response,
      };
    }
  }
  if (event.type === 'failed') {
    payload.error = event.error;
    if (result !== undefined && result.status !== 'succeeded') {
      payload.result = {
        status: result.status,
        modelExecutionId: result.modelExecutionId,
        diagnostic: result.diagnostic,
      };
    }
  }
  const data = JSON.stringify(payload);
  if (data.length > ACME_MODEL_EXECUTION_MAX_STREAM_EVENT_BYTES) {
    throw new HostRefusal(
      500,
      'STREAM_EVENT_TOO_LARGE',
      'A model runtime stream event exceeded the per-event bound.',
    );
  }
  return `event: ${event.type}\ndata: ${data}\n\n`;
}

export function createAcmeModelRuntimeHost(
  options: AcmeModelRuntimeHostOptions,
): AcmeModelRuntimeHost {
  const descriptor = validateDescriptor(options.descriptor);

  return Object.freeze({
    async fetch(request: Request): Promise<Response> {
      try {
        await authorizeRequest(options.authorize, request);
        checkProtocolHeader(request);
        const path = new URL(request.url).pathname;

        if (path === ACME_MODEL_RUNTIME_COMPATIBILITY_PATH) {
          if (request.method !== 'GET') {
            throw new HostRefusal(
              405,
              'METHOD_NOT_ALLOWED',
              'Compatibility endpoint requires GET.',
            );
          }
          return jsonResponse(descriptor, 200);
        }

        if (path === ACME_MODEL_RUNTIME_EXECUTE_PATH) {
          if (request.method !== 'POST') {
            throw new HostRefusal(
              405,
              'METHOD_NOT_ALLOWED',
              'Execute endpoint requires POST.',
            );
          }
          requireJsonContentType(request);
          const runtimeRequest = validateAcmeModelRuntimeRequest(
            await readBoundedJson(request),
          );
          const encoder = new TextEncoder();
          const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
              const pending: ModelStreamEvent[] = [];
              try {
                const result = await options.engine.execute(
                  toModelExecutionRequest(runtimeRequest),
                  {
                    signal: request.signal,
                    onEvent: (event) => {
                      pending.push(event);
                      if (
                        event.type !== 'completed' &&
                        event.type !== 'failed'
                      ) {
                        controller.enqueue(encoder.encode(encodeSse(event)));
                      }
                    },
                  },
                );
                const terminal =
                  result.status === 'succeeded'
                    ? (pending.find((event) => event.type === 'completed') ?? {
                        type: 'completed' as const,
                        sequence: pending.length,
                        response: result.response,
                      })
                    : (pending.find((event) => event.type === 'failed') ?? {
                        type: 'failed' as const,
                        sequence: pending.length,
                        error: result.error,
                      });
                controller.enqueue(encoder.encode(encodeSse(terminal, result)));
                controller.close();
              } catch (error) {
                if (error instanceof HostRefusal) {
                  controller.error(error);
                  return;
                }
                controller.error(error);
              }
            },
          });
          return new Response(stream, {
            status: 200,
            headers: {
              'cache-control': 'no-store',
              'content-type': 'text/event-stream; charset=utf-8',
              'x-content-type-options': 'nosniff',
              [ACME_MODEL_RUNTIME_HEADER]: ACME_MODEL_RUNTIME_PROTOCOL_VERSION,
            },
          });
        }

        throw new HostRefusal(
          404,
          'NOT_FOUND',
          'Model runtime route was not found.',
        );
      } catch (error) {
        if (error instanceof HostRefusal) {
          return refusalResponse(error);
        }
        return refusalResponse(
          new HostRefusal(
            500,
            'MODEL_RUNTIME_HOST_FAILURE',
            'The model runtime host could not complete the request.',
          ),
        );
      }
    },
  });
}

export const ACME_MODEL_RUNTIME_MAX_REQUEST_BYTES =
  ACME_MODEL_EXECUTION_MAX_REQUEST_BYTES;
