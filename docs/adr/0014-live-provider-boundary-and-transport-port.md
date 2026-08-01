# ADR 0014 — Live provider boundary and transport port

Status: Accepted

Date: 2026-07-31

Decision owners: ACME maintainers

## Context

`ModelGateway`, the provider-neutral `ModelRequest` and
`NormalizedModelResponse` types, the ACME error taxonomy and a non-empty
gateway conformance suite all exist. The only implementation is a scripted
mock. Two things are therefore unproven: whether a real provider's wire format
maps onto the existing contract, and whether that mapping can be built without
provider vocabulary reaching `packages/core`.

[ADR-0003](0003-sqlite-revisioned-unit-of-work.md) recorded that "a live
adapter ADR must define provider idempotency/reconciliation", and
`docs/CURRENT_STATUS.md` records that live call reconciliation and encrypted
retention require an ADR before implementation. This is that ADR.

One existing contract detail forces a decision. `ModelCallRecord.status`
includes `'ambiguous'`, `failModelCall` accepts an `ambiguous` flag, and both
repository adapters implement the resulting semantics. Nothing in the
workspace produces it. A network boundary is exactly where it becomes real: a
call that fails after the request was sent may have executed and been charged.

## Decision

### Provider surface

The first OpenAI adapter targets the **Responses API only**. It is OpenAI's
primary surface for hosted tools, agentic behavior, richer output objects and
current cache control.

Chat Completions is excluded outright, not kept as a fallback or a
compatibility layer. Choosing it for portability would mean testing ACME
against the less expressive boundary. Portability is the `ModelGateway` port's
job to prove; it is not bought by weakening the first adapter.

### Transport port

The adapter owns every provider wire shape. It depends on a transport port
that carries only an opaque request and result:

```ts
interface ProviderTransportRequest {
  readonly method: 'POST';
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly timeoutMs: number;
  readonly signal: AbortSignal;
}

type ProviderTransportResult =
  | {
      readonly kind: 'response';
      readonly status: number;
      readonly headers: Readonly<Record<string, string>>;
      readonly body: string;
    }
  | {
      readonly kind: 'no-response';
      readonly reason: 'timeout' | 'aborted' | 'network';
      /** Whether the request reached the provider. `unknown` is the honest default. */
      readonly delivery: 'not-sent' | 'sent' | 'unknown';
    };

interface ProviderTransport {
  send(request: ProviderTransportRequest): Promise<ProviderTransportResult>;
}
```

The transport never parses a body, never classifies an error and never sees an
ACME type. This is what lets the entire mapping be exercised against fixtures
with no network, and it is why a real network transport can be added later as
a separate budgeted task without redoing mapping work.

### Failure classification

Classification is decided by one question first: **did the provider respond at
all?**

If a status line was received the provider responded, so the outcome is not
ambiguous:

| Provider outcome | ACME code | Retryable |
| --- | --- | --- |
| `200` with a completed response carrying output | success | n/a |
| `200` with an unparsable or schema-invalid body | `MODEL_INVALID_RESPONSE` | no |
| `200` with a provider-reported failed response | `MODEL_UNAVAILABLE` | yes |
| `200` with a refusal and no usable output | `MODEL_CONTENT_FILTER` | no |
| `400`, `404`, `422` | `INVALID_REQUEST` | no |
| `401`, `403` | `MODEL_AUTH` | no |
| `408` | `TIMEOUT` | yes |
| `429` | `MODEL_RATE_LIMIT` | yes |
| `5xx` | `MODEL_UNAVAILABLE` | yes |
| any other status | `MODEL_UNAVAILABLE` | yes |

Content filtering is not an HTTP failure on this surface. It arrives as a
completed response whose incompletion reason names it, and is normalized to
`finishReason: 'content-filter'`. `MODEL_CONTENT_FILTER` is raised only when
the provider returns no usable output for that reason.

If no status line was received, the provider may or may not have executed:

| Transport result | ACME code | Model call status |
| --- | --- | --- |
| `no-response`, `delivery: 'not-sent'` | `MODEL_UNAVAILABLE` or `TIMEOUT` | `failed` |
| `no-response`, `delivery: 'sent'` | `TIMEOUT` or `MODEL_UNAVAILABLE` | `ambiguous` |
| `no-response`, `delivery: 'unknown'` | `TIMEOUT` or `MODEL_UNAVAILABLE` | `ambiguous` |

Cancellation observed before the transport is invoked is `CANCELLED` and
`failed`; nothing was sent.

### Ambiguity is the default

`delivery: 'unknown'` is treated as ambiguous. A transport that cannot prove
the request never left the process must say `unknown`, and only a transport
that can prove non-delivery may claim `not-sent`. Guessing in the safe
direction costs an occasional unnecessary ambiguity; guessing in the unsafe
direction silently loses a call that ran and was billed.

### Idempotency and reconciliation

ACME's request idempotency is local and already implemented: a repeated
request key returns the recorded terminal result without a second call. That
protects against duplicate work only when the ledger recorded the outcome.

An ambiguous call has no recorded outcome. This ADR fixes the v1 rule: **an
ambiguous model call is terminal for its execution and is never automatically
retried.** Milestone 1 permits exactly one model call per execution, so
automatic retry is not merely unwise, it is out of contract. Reconciling an
ambiguous call against provider-side records requires provider history the
adapter does not read in v1 and is deferred.

### Retention

Live executions use `retention: 'hash-only'` until real encrypted retention
exists. The payload is deliberately not persisted, so `replayVerify()` returns
`unavailable` for those executions rather than `failed`. That distinction is
load-bearing: the evidence is absent by policy, not lost by error.

`retention: 'encrypted-payload'` remains implemented as plaintext retention
and must not be used for live provider data. Closing that gap is proposed in
`docs/backlog/encrypted-payload-retention.md` and is not part of this
decision beyond forbidding its use for real payloads.

## Alternatives Considered

### Chat Completions for portability

- Benefits: the shape more providers imitate, so a second adapter looks easier.
- Costs: the first adapter would be built against the less expressive surface,
  and the newer capabilities would be untestable through it.
- Reason not selected: portability is the port's property. Proving it by
  restricting the adapter proves the wrong thing.

### No transport port, adapter calls the network directly

- Benefits: fewer types, one less indirection.
- Costs: every mapping test becomes a network test, CI stops being secret-free
  and offline, and the live task would have to re-derive the mapping.
- Reason not selected: the mapping is the risky part and it is exactly the
  part that can be tested without a network.

### Treat every transport failure as cleanly failed

- Benefits: simpler; no ambiguous status to reason about.
- Costs: a call that executed and was billed would be recorded as if it never
  happened.
- Reason not selected: the contract already models ambiguity, and discarding
  it would make the ledger claim more certainty than exists.

### Automatically retry ambiguous calls

- Benefits: higher apparent success rate.
- Costs: duplicate billed work and duplicate side effects, with no provider
  history to reconcile against.
- Reason not selected: Milestone 1 permits one model call per execution, so
  this is out of contract before it is out of taste.

## Consequences

### Positive

- The provider mapping is fully testable offline, so CI stays secret-free.
- Something finally produces `ambiguous`, exercising a path the repository
  adapters have implemented but never run.
- The real transport becomes a small, budgeted, well-scoped task.
- No provider vocabulary reaches core, enforced by boundary rules rather than
  by convention.

### Negative

- Offline fixtures remain simplified success-path samples. ACME-0028 falsified
  the assumption that canonical JSON Schema could be sent verbatim under
  `strict: true`. ACME-0029 confirmed the success path against real Responses
  bodies: `OpenAiResponseSchema` accepted a completed `200` response,
  `hash-only` retained no payload, and `replayVerify()` reported `unavailable`.
  The committed offline fixtures are still minimal (they omit many provider
  fields the real body includes); they stay valid because the wire schema is
  deliberately tolerant of unknown fields, not because they are byte-identical
  to a live body.
- Conservative ambiguity will sometimes mark a call ambiguous that in fact
  never reached the provider.
- Live executions that stay on `hash-only` cannot be replayed. With
  ACME-0030 / ADR-0016, composition roots may use `encrypted-payload` when they
  supply a `PayloadEncryptor`, which restores replay when the key is present.
- Some provider models reject `temperature` after accepting the rest of the
  request (observed on `gpt-5.6-terra`). The adapter still forwards a supplied
  temperature and omits the field when absent. Reference contracts no longer
  emit a default (ACME-0037). A future profile capability remains useful only
  when a request *explicitly* sets temperature for a model that rejects it.

### Follow-ups

- Schema lowering for strict structured output lives in the adapter
  (`lowerStrictStructuredOutputSchema`); a future multi-provider ADR should
  decide whether wire-schema digests and refusal details stay adapter-local.
- Reconciling ambiguous calls against provider history needs its own decision.
- Encrypted retention is implemented (ADR-0016). KMS / multi-key rotation
  remain future work on the same port. Live gates may switch default retention
  from `hash-only` to `encrypted-payload` once the composition root always
  supplies an encryptor for live runs.

## Compatibility and Migration

The transport port is internal to the adapter and carries no ACME type, so it
may change without a core migration. Changing the failure classification table
changes ledger content and therefore requires an ADR amendment. A second
provider adapter must satisfy the same `ModelGateway` conformance suite; it
does not inherit correctness by resembling this one.

## References

- [ADR-0003 SQLite revisioned Unit of Work](0003-sqlite-revisioned-unit-of-work.md)
- [ADR-0007 deterministic model mock and gateway conformance](0007-deterministic-model-mock-and-gateway-conformance.md)
- [ADR-0012 Milestone 1 execution identity and replay](0012-milestone-1-execution-identity-and-replay.md)
- [Encrypted payload retention proposal](../backlog/encrypted-payload-retention.md)
- [ACME specification, model gateway](../design/acme-design-and-development-spec.md)
