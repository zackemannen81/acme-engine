import type { JsonValue } from '@acme/core';

/**
 * Minimal JSON-RPC 2.0 vocabulary. MCP rides on JSON-RPC 2.0, and this app
 * hand-rolls the subset it needs so the prototype adds no dependency and the
 * whole wire format stays inspectable in one file.
 */
export const JSONRPC_VERSION = '2.0' as const;

export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  readonly jsonrpc: typeof JSONRPC_VERSION;
  /** Absent for notifications. */
  readonly id?: JsonRpcId;
  readonly method: string;
  readonly params?: JsonValue;
}

export interface JsonRpcErrorBody {
  readonly code: number;
  readonly message: string;
  readonly data?: JsonValue;
}

export interface JsonRpcSuccess {
  readonly jsonrpc: typeof JSONRPC_VERSION;
  readonly id: JsonRpcId;
  readonly result: JsonValue;
}

export interface JsonRpcFailure {
  readonly jsonrpc: typeof JSONRPC_VERSION;
  readonly id: JsonRpcId;
  readonly error: JsonRpcErrorBody;
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

export function success(id: JsonRpcId, result: JsonValue): JsonRpcSuccess {
  return { jsonrpc: JSONRPC_VERSION, id, result };
}

export function failure(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: JsonValue,
): JsonRpcFailure {
  return {
    jsonrpc: JSONRPC_VERSION,
    id,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * A structurally valid JSON-RPC request, or the reason it is not one. Framing
 * and dispatch stay separate so a malformed line can be answered without ever
 * reaching the engine.
 */
export type ParsedRequest =
  | { readonly kind: 'request'; readonly request: JsonRpcRequest }
  | {
      readonly kind: 'invalid';
      readonly id: JsonRpcId;
      readonly reason: string;
    };

export function parseRequest(value: unknown): ParsedRequest {
  if (!isObject(value)) {
    return {
      kind: 'invalid',
      id: null,
      reason: 'A request must be an object.',
    };
  }
  const rawId = value['id'];
  const id: JsonRpcId =
    typeof rawId === 'string' || typeof rawId === 'number' ? rawId : null;
  if (value['jsonrpc'] !== JSONRPC_VERSION) {
    return { kind: 'invalid', id, reason: 'jsonrpc must be "2.0".' };
  }
  const method = value['method'];
  if (typeof method !== 'string' || method.length === 0) {
    return {
      kind: 'invalid',
      id,
      reason: 'method must be a non-empty string.',
    };
  }
  const params = value['params'];
  if (params !== undefined && !isObject(params) && !Array.isArray(params)) {
    return {
      kind: 'invalid',
      id,
      reason: 'params must be an object or an array.',
    };
  }
  // `id` absent means notification; `id: null` is a request with a null id.
  const hasId = Object.hasOwn(value, 'id');
  return {
    kind: 'request',
    request: {
      jsonrpc: JSONRPC_VERSION,
      ...(hasId ? { id } : {}),
      method,
      ...(params === undefined ? {} : { params: params as JsonValue }),
    },
  };
}

export function isNotification(request: JsonRpcRequest): boolean {
  return request.id === undefined;
}
