import { describe, expect, it, vi } from 'vitest';

import { createFetchTransport } from '../src/transport-fetch.js';
import type { ProviderTransportRequest } from '../src/transport.js';

function request(
  overrides: Partial<ProviderTransportRequest> = {},
): ProviderTransportRequest {
  return {
    method: 'POST',
    url: 'https://provider.invalid/v1/responses',
    headers: { 'content-type': 'application/json' },
    body: '{}',
    timeoutMs: 30_000,
    signal: new AbortController().signal,
    ...overrides,
  };
}

function abortError(): Error {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

describe('fetch transport delivery classification', () => {
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

  it('passes a non-200 status through without classifying it', async () => {
    // Classification is the gateway's job; the transport only carries bytes.
    const fetch = vi.fn(async () => new Response('nope', { status: 429 }));
    const result = await createFetchTransport({
      fetch: fetch as unknown as typeof globalThis.fetch,
    }).send(request());

    expect(result).toMatchObject({
      kind: 'response',
      status: 429,
      body: 'nope',
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

  it.each([
    ['a network failure', new TypeError('fetch failed'), 'network'],
    ['an abort after dispatch', abortError(), 'aborted'],
  ])(
    'reports delivery unknown after %s, because fetch cannot prove non-delivery',
    async (_label, thrown, reason) => {
      const fetch = vi.fn(async () => {
        throw thrown;
      });
      const result = await createFetchTransport({
        fetch: fetch as unknown as typeof globalThis.fetch,
      }).send(request());

      expect(result).toMatchObject({
        kind: 'no-response',
        reason,
        delivery: 'unknown',
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it('reports a timeout as unknown delivery rather than a clean failure', async () => {
    const fetch = vi.fn(
      async (_url: unknown, init?: { signal?: AbortSignal }) => {
        await new Promise((resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(abortError());
          });
          setTimeout(resolve, 5_000);
        });
        return new Response('{}');
      },
    );

    const result = await createFetchTransport({
      fetch: fetch as unknown as typeof globalThis.fetch,
    }).send(request({ timeoutMs: 10 }));

    expect(result).toMatchObject({
      kind: 'no-response',
      reason: 'timeout',
      delivery: 'unknown',
    });
  });

  it('honors the caller signal by aborting the underlying request', async () => {
    const controller = new AbortController();
    const seen: (AbortSignal | undefined)[] = [];
    const fetch = vi.fn(
      async (_url: unknown, init?: { signal?: AbortSignal }) => {
        seen.push(init?.signal);
        controller.abort();
        throw abortError();
      },
    );

    await createFetchTransport({
      fetch: fetch as unknown as typeof globalThis.fetch,
    }).send(request({ signal: controller.signal }));

    expect(seen[0]?.aborted).toBe(true);
  });
});
