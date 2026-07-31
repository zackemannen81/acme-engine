import type {
  ProviderTransport,
  ProviderTransportDelivery,
  ProviderTransportRequest,
  ProviderTransportResult,
} from './transport.js';

export interface FetchTransportOptions {
  /** Injectable so the transport's own classification can be tested offline. */
  readonly fetch?: typeof globalThis.fetch;
}

function headerRecord(headers: Headers): Readonly<Record<string, string>> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return Object.freeze(record);
}

function reasonOf(
  error: unknown,
  timedOut: boolean,
): 'timeout' | 'aborted' | 'network' {
  if (timedOut) {
    return 'timeout';
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return 'aborted';
  }
  return 'network';
}

/**
 * A real network transport for ADR-0014's port.
 *
 * One property is worth stating plainly: `fetch` does not report whether the
 * request bytes reached the server. Once the call has been dispatched, a
 * timeout, an abort and a connection failure are indistinguishable from the
 * outside, so this transport reports `delivery: 'unknown'` for all of them.
 * ADR-0014 treats `unknown` as ambiguous, which is the conservative answer: a
 * call that ran and was billed must never be recorded as though it never
 * happened. `not-sent` is claimed only when the caller had already cancelled
 * before dispatch, which is the one case non-delivery is provable.
 */
export function createFetchTransport(
  options: FetchTransportOptions = {},
): ProviderTransport {
  const send = options.fetch ?? globalThis.fetch;

  return {
    async send(
      request: ProviderTransportRequest,
    ): Promise<ProviderTransportResult> {
      if (request.signal.aborted) {
        return {
          kind: 'no-response',
          reason: 'aborted',
          delivery: 'not-sent',
          message: 'The call was cancelled before dispatch.',
        };
      }

      const timeout = AbortSignal.timeout(request.timeoutMs);
      const signal = AbortSignal.any([request.signal, timeout]);

      try {
        const response = await send(request.url, {
          method: request.method,
          headers: { ...request.headers },
          body: request.body,
          signal,
        });
        return {
          kind: 'response',
          status: response.status,
          headers: headerRecord(response.headers),
          body: await response.text(),
        };
      } catch (error: unknown) {
        // Dispatch already happened, so delivery is unknowable here.
        const delivery: ProviderTransportDelivery = 'unknown';
        return {
          kind: 'no-response',
          reason: reasonOf(error, timeout.aborted),
          delivery,
          message:
            error instanceof Error ? error.message : 'The transport failed.',
        };
      }
    },
  };
}
