import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';

import type { JsonValue } from '@acme/core';

import {
  failure,
  INVALID_REQUEST,
  PARSE_ERROR,
  parseRequest,
  type JsonRpcResponse,
} from './jsonrpc.js';
import type { McpServer } from './server.js';

export interface StdioOptions {
  readonly input: Readable;
  readonly output: Writable;
  readonly server: McpServer;
}

function write(output: Writable, response: JsonRpcResponse): void {
  // MCP stdio framing: one JSON message per line, no embedded newlines.
  output.write(`${JSON.stringify(response)}\n`);
}

/**
 * Serves one MCP session over newline-delimited JSON. Lines are handled in
 * arrival order: an engine execution must not be overtaken by the read that
 * was meant to observe it.
 */
export async function serveStdio(options: StdioOptions): Promise<void> {
  const lines = createInterface({ input: options.input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.trim().length === 0) {
      continue;
    }
    let value: JsonValue;
    try {
      value = JSON.parse(line) as JsonValue;
    } catch {
      write(options.output, failure(null, PARSE_ERROR, 'Invalid JSON.'));
      continue;
    }
    const parsed = parseRequest(value);
    if (parsed.kind === 'invalid') {
      write(options.output, failure(parsed.id, INVALID_REQUEST, parsed.reason));
      continue;
    }
    const response = await options.server.handle(parsed.request);
    if (response !== null) {
      write(options.output, response);
    }
  }
}
