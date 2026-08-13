import type { JsonValue } from '@acme/core';

import {
  failure,
  INTERNAL_ERROR,
  INVALID_PARAMS,
  METHOD_NOT_FOUND,
  success,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from './jsonrpc.js';
import {
  callTool,
  TOOL_DEFINITIONS,
  ToolParamsError,
  type ToolContext,
} from './tools.js';

/** The MCP revision this prototype speaks. Negotiated in `initialize`. */
export const MCP_PROTOCOL_VERSION = '2025-06-18';

export const SERVER_INFO = Object.freeze({
  name: 'acme-mcp-server',
  version: '0.0.0',
});

export interface McpServer {
  /** Returns `null` for notifications, which carry no response. */
  handle(request: JsonRpcRequest): Promise<JsonRpcResponse | null>;
  initialized(): boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function negotiateVersion(params: JsonValue | undefined): string {
  if (isObject(params) && typeof params['protocolVersion'] === 'string') {
    const requested = params['protocolVersion'];
    if (requested === MCP_PROTOCOL_VERSION) {
      return requested;
    }
  }
  return MCP_PROTOCOL_VERSION;
}

function toolArguments(params: JsonValue | undefined): JsonValue | undefined {
  if (!isObject(params)) {
    return undefined;
  }
  const args = params['arguments'];
  return args === undefined ? undefined : (args as JsonValue);
}

export function createMcpServer(context: ToolContext): McpServer {
  let ready = false;

  async function dispatch(
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse | null> {
    const id = request.id ?? null;
    const notification = request.id === undefined;

    switch (request.method) {
      case 'initialize': {
        ready = false;
        return success(id, {
          protocolVersion: negotiateVersion(request.params),
          capabilities: { tools: { listChanged: false } },
          serverInfo: { ...SERVER_INFO },
        });
      }

      case 'notifications/initialized': {
        ready = true;
        return null;
      }

      case 'ping':
        return notification ? null : success(id, {});

      case 'tools/list': {
        if (!ready) {
          return failure(
            id,
            INTERNAL_ERROR,
            'The session is not initialized. Send initialize, then ' +
              'notifications/initialized.',
          );
        }
        return success(id, {
          tools: TOOL_DEFINITIONS as unknown as JsonValue,
        });
      }

      case 'tools/call': {
        if (!ready) {
          return failure(
            id,
            INTERNAL_ERROR,
            'The session is not initialized. Send initialize, then ' +
              'notifications/initialized.',
          );
        }
        const params = request.params;
        if (!isObject(params) || typeof params['name'] !== 'string') {
          return failure(id, INVALID_PARAMS, 'tools/call requires a name.');
        }
        const name = params['name'];
        let result;
        try {
          result = await callTool(context, name, toolArguments(params));
        } catch (error: unknown) {
          if (error instanceof ToolParamsError) {
            return failure(id, INVALID_PARAMS, error.message);
          }
          throw error;
        }
        if (result === null) {
          return failure(id, METHOD_NOT_FOUND, `Unknown tool: ${name}.`, {
            name,
          });
        }
        return success(id, {
          content: result.content as unknown as JsonValue,
          structuredContent: result.structuredContent,
          isError: result.isError,
        });
      }

      default:
        return notification
          ? null
          : failure(
              id,
              METHOD_NOT_FOUND,
              `Unknown method: ${request.method}.`,
              { method: request.method },
            );
    }
  }

  return {
    async handle(request) {
      try {
        return await dispatch(request);
      } catch (error: unknown) {
        if (request.id === undefined) {
          return null;
        }
        return failure(
          request.id,
          INTERNAL_ERROR,
          error instanceof Error ? error.message : 'Unexpected failure.',
        );
      }
    },
    initialized() {
      return ready;
    },
  };
}
