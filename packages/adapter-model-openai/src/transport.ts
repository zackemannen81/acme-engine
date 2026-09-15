/**
 * The transport boundary fixed by ADR-0014.
 *
 * A transport moves opaque bytes. It never parses a body, never classifies a
 * failure and never sees an ACME type. That is what lets the entire provider
 * mapping be exercised against fixtures with no network.
 */

export interface ProviderTransportRequest {
  readonly method: 'POST';
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly timeoutMs: number;
  readonly signal: AbortSignal;
}

/**
 * Whether the request reached the provider.
 *
 * `unknown` is the honest default. A transport may only claim `not-sent` when
 * it can prove the request never left the process; ADR-0014 treats anything
 * else as ambiguous, because a call that ran and was billed must never be
 * recorded as though it never happened.
 */
export type ProviderTransportDelivery = 'not-sent' | 'sent' | 'unknown';

export type ProviderTransportResult =
  | {
      readonly kind: 'response';
      readonly status: number;
      readonly headers: Readonly<Record<string, string>>;
      readonly body: string;
    }
  | {
      readonly kind: 'no-response';
      readonly reason: 'timeout' | 'aborted' | 'network';
      readonly delivery: ProviderTransportDelivery;
      readonly message?: string;
    };

export interface ProviderTransport {
  send(request: ProviderTransportRequest): Promise<ProviderTransportResult>;
}
