import { once } from 'node:events';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';

import { ACME_RUNTIME_ERROR_VERSION } from './acme-runtime-wire.js';
import type { AcmeRuntimeHost } from './acme-runtime-host.js';

export interface AcmeRuntimeListenerOptions {
  readonly host: AcmeRuntimeHost;
  readonly hostname: string;
  readonly port: number;
}

export interface AcmeRuntimeListenerAddress {
  readonly hostname: string;
  readonly port: number;
  readonly origin: string;
}

export interface AcmeRuntimeListener {
  listen(): Promise<AcmeRuntimeListenerAddress>;
  close(): Promise<void>;
  address(): AcmeRuntimeListenerAddress | undefined;
}

function requireHostname(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 253) {
    throw new Error(
      'Runtime listener hostname must be a bounded non-empty string.',
    );
  }
  return trimmed;
}

function requirePort(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 65_535) {
    throw new Error(
      'Runtime listener port must be an integer from 0 through 65535.',
    );
  }
  return value;
}

function requestHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    const name = request.rawHeaders[index];
    const value = request.rawHeaders[index + 1];
    if (name !== undefined && value !== undefined) {
      headers.append(name, value);
    }
  }
  return headers;
}

function requestUrl(request: IncomingMessage, origin: string): URL {
  const target = request.url ?? '/';
  try {
    return new URL(target, origin);
  } catch {
    throw new Error('Runtime listener received an invalid request target.');
  }
}

/**
 * Adapt an IncomingMessage without delegating cancellation to Readable.toWeb.
 * The Fetch host may cancel its reader when a bounded body is rejected. A Node
 * stream destroy would also destroy the shared HTTP socket and suppress the
 * refusal response, so cancellation detaches the consumer and drains bytes.
 */
function requestBody(
  request: IncomingMessage,
): ReadableStream<Uint8Array> | undefined {
  const method = request.method ?? 'GET';
  if (method === 'GET' || method === 'HEAD') {
    return undefined;
  }

  let active = true;
  let onData: ((chunk: Buffer) => void) | undefined;
  let onEnd: (() => void) | undefined;
  let onError: ((error: Error) => void) | undefined;

  const cleanup = (): void => {
    if (onData !== undefined) request.off('data', onData);
    if (onEnd !== undefined) request.off('end', onEnd);
    if (onError !== undefined) request.off('error', onError);
  };

  return new ReadableStream<Uint8Array>({
    start(controller) {
      onData = (chunk: Buffer): void => {
        if (!active) return;
        controller.enqueue(chunk);
        if ((controller.desiredSize ?? 1) <= 0) {
          request.pause();
        }
      };
      onEnd = (): void => {
        if (!active) return;
        active = false;
        cleanup();
        controller.close();
      };
      onError = (error: Error): void => {
        if (!active) return;
        active = false;
        cleanup();
        controller.error(error);
      };
      request.on('data', onData);
      request.once('end', onEnd);
      request.once('error', onError);
    },
    pull() {
      if (active) request.resume();
    },
    cancel() {
      if (!active) return;
      active = false;
      cleanup();
      request.resume();
    },
  });
}

function toFetchRequest(
  request: IncomingMessage,
  origin: string,
  signal: AbortSignal,
): Request {
  const body = requestBody(request);
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method ?? 'GET',
    headers: requestHeaders(request),
    signal,
    ...(body === undefined ? {} : { body, duplex: 'half' as const }),
  };
  return new Request(requestUrl(request, origin), init);
}

async function releaseUnconsumedRequestBody(
  fetchRequest: Request,
  request: IncomingMessage,
): Promise<void> {
  if (request.complete || request.destroyed || fetchRequest.body === null) {
    return;
  }
  try {
    await fetchRequest.body.cancel(
      'runtime host completed before body consumption',
    );
  } catch {
    if (!request.destroyed) request.resume();
  }
}

function setResponseHeaders(response: Response, target: ServerResponse): void {
  for (const [name, value] of response.headers) {
    if (name.toLowerCase() !== 'set-cookie') {
      target.setHeader(name, value);
    }
  }

  const headersWithCookies = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const cookies = headersWithCookies.getSetCookie?.() ?? [];
  if (cookies.length > 0) {
    target.setHeader('set-cookie', cookies);
  }
}

async function writeFetchResponse(
  response: Response,
  target: ServerResponse,
): Promise<void> {
  target.statusCode = response.status;
  setResponseHeaders(response, target);

  if (response.body === null) {
    target.end();
    return;
  }

  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!target.write(value)) {
        await once(target, 'drain');
      }
    }
    target.end();
  } finally {
    reader.releaseLock();
  }
}

function transportFailure(target: ServerResponse): void {
  if (target.headersSent || target.writableEnded) {
    target.destroy();
    return;
  }
  const body = JSON.stringify({
    protocolVersion: ACME_RUNTIME_ERROR_VERSION,
    code: 'RUNTIME_TRANSPORT_FAILURE',
    message: 'The runtime HTTP transport could not complete the request.',
  });
  target.statusCode = 500;
  target.setHeader('content-type', 'application/json; charset=utf-8');
  target.setHeader('cache-control', 'no-store');
  target.end(body);
}

async function handleNodeRequest(
  host: AcmeRuntimeHost,
  origin: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const abort = new AbortController();
  const abortIfIncomplete = (): void => {
    if (!request.complete || (!response.writableEnded && response.destroyed)) {
      abort.abort();
    }
  };
  request.once('aborted', () => abort.abort());
  request.once('close', abortIfIncomplete);
  response.once('close', abortIfIncomplete);

  try {
    const fetchRequest = toFetchRequest(request, origin, abort.signal);
    const fetchResponse = await host.fetch(fetchRequest);
    await releaseUnconsumedRequestBody(fetchRequest, request);
    if (response.destroyed) return;
    await writeFetchResponse(fetchResponse, response);
  } catch {
    transportFailure(response);
  }
}

/**
 * Thin socket adapter for the Fetch-compatible runtime host. Authorization,
 * protocol validation, body limits and execution semantics remain host-owned.
 */
export function createAcmeRuntimeListener(
  options: AcmeRuntimeListenerOptions,
): AcmeRuntimeListener {
  const hostname = requireHostname(options.hostname);
  const port = requirePort(options.port);
  let bound: AcmeRuntimeListenerAddress | undefined;
  let listenPromise: Promise<AcmeRuntimeListenerAddress> | undefined;

  const server = createServer((request, response) => {
    const origin = bound?.origin;
    if (origin === undefined) {
      transportFailure(response);
      return;
    }
    void handleNodeRequest(options.host, origin, request, response);
  });

  async function listen(): Promise<AcmeRuntimeListenerAddress> {
    if (bound !== undefined) return bound;
    if (listenPromise !== undefined) return listenPromise;

    listenPromise = new Promise<AcmeRuntimeListenerAddress>(
      (resolve, reject) => {
        const onError = (error: Error): void => {
          server.off('listening', onListening);
          listenPromise = undefined;
          reject(error);
        };
        const onListening = (): void => {
          server.off('error', onError);
          const address = server.address();
          if (address === null || typeof address === 'string') {
            listenPromise = undefined;
            void new Promise<void>((closeResolve) =>
              server.close(() => closeResolve()),
            );
            reject(new Error('Runtime listener did not expose a TCP address.'));
            return;
          }
          bound = Object.freeze({
            hostname,
            port: address.port,
            origin: `http://${hostname.includes(':') ? `[${hostname}]` : hostname}:${address.port}`,
          });
          resolve(bound);
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen({ host: hostname, port });
      },
    );
    return listenPromise;
  }

  return Object.freeze({
    listen,
    async close(): Promise<void> {
      if (!server.listening) {
        bound = undefined;
        listenPromise = undefined;
        return;
      }
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) resolve();
          else reject(error);
        });
        server.closeIdleConnections();
      });
      bound = undefined;
      listenPromise = undefined;
    },
    address(): AcmeRuntimeListenerAddress | undefined {
      return bound;
    },
  });
}
