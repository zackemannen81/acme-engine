import { describe, expect, it, vi } from 'vitest';

import { createFetchTransport } from '../src/transport-fetch.js';
import type { ProviderTransportRequest } from '../src/transport.js';

function request(
  overrides: Partial<ProviderTransportRequest> = {},
): ProviderTransportRequest {
  return {
    method: 'POST',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    headers: { 'content-type': 'application/json' },
    body: '{}',
    timeoutMs: 30_000,
    signal: new AbortController().signal,
    ...overrides,
  };
}

describe('Chat Completions fetch transport delivery classification', () => {
  it('returns the status, lowercased headers and body verbatim', async () => {
    const fetch = vi.fn(
      async () =>
        new Response('{"ok":true}', {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'X-Req': 'abc' },
        }),
    );
    const result = await createFetchTransport({
      fetch: fetch as unknown as typeof globalThis.fetch,
    }).send(request());

    expect(result).toEqual({
      kind: 'response',
      status: 200,
      headers: { 'content-type': 'application/json', 'x-req': 'abc' },
      body: '{"ok":true}',
    });
  });

  it('claims not-sent only when the caller cancelled before dispatch', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetch = vi.fn(async () => new Response('{}'));

    const result = await createFetchTransport({
      fetch: fetch as unknown as typeof globalThis.fetch,
    }).send(request({ signal: controller.signal }));

    expect(result).toEqual({
      kind: 'no-response',
      reason: 'aborted',
      delivery: 'not-sent',
      message: 'The call was cancelled before dispatch.',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports delivery unknown after a network failure', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const result = await createFetchTransport({
      fetch: fetch as unknown as typeof globalThis.fetch,
    }).send(request());

    expect(result).toMatchObject({
      kind: 'no-response',
      reason: 'network',
      delivery: 'unknown',
    });
  });
});
