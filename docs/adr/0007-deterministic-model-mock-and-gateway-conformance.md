# ADR 0007 — Deterministic model mock and gateway conformance

Status: Accepted

Date: 2026-07-30

Decision owners: ACME maintainers

## Context

The core exposes a provider-neutral `ModelGateway`, and the aggregate
repository reserves model calls with a `requestHash`, but neither boundary had
an executable identity algorithm or portable behavioral contract. A future
ExecutionEngine needs a deterministic offline adapter before orchestration,
retry, durable call reuse or live providers can be implemented safely.

A response queue or fallback string would hide incorrect call identity,
selection and request construction. Provider-specific fixtures would also
make conformance dependent on one SDK or transport.

## Decision

### Versioned model-request identity

The immutable algorithm identifier is `acme-model-request-hash-1`. Its digest
is:

```text
sha256(acme-cjson-1({
  algorithm: "acme-model-request-hash-1",
  request: <complete validated ModelRequest>
}))
```

`GatewayCallContext` and `ModelSelection` are excluded. The model-call ledger
records execution/call identity and selection separately; the hash identifies
only the provider-neutral request payload. Object insertion order is
irrelevant under `acme-cjson-1`, while message, content-part, stop and every
other array order remain significant.

`ModelCallReservation.requestHash` always means this algorithm until a new
versioned field or compatibility rule is introduced.

### Gateway boundary

Core owns reusable validation for model selections, complete requests,
capabilities, call contexts and normalized responses. Inputs must be
canonical JSON where applicable, shapes are closed, identities are non-empty,
token counts are safe integers and response timestamps are canonical UTC ISO
timestamps.

Required boolean capabilities only constrain the gateway when `true`. A
required numeric limit is a minimum; the supplied profile must declare at
least that limit. A missing requirement produces non-retryable
`UNSUPPORTED_CAPABILITY` at `calling-model`.

An already-aborted call produces non-retryable `CANCELLED` before provider
invocation. Gateways translate provider failures into `AcmeError`; normalized
successes and structured errors cross the port without provider objects or
semantic rewriting.

### Exact scripted mock

`@acme/adapter-model-mock` accepts one complete immutable configuration:

- profiles map an exact `ModelSelection` to immutable capabilities
- calls have a unique `(executionId, callKey)`
- each call declares the exact selection and expected
  `acme-model-request-hash-1`
- each outcome is either one complete `NormalizedModelResponse` or one
  `TIMEOUT`/`MODEL_*` `AcmeErrorData` at `calling-model`

The complete configuration validates before use. Duplicate profile/call
identities, undeclared selections, malformed hashes, invalid response
envelopes and non-model errors are `INVALID_REQUEST`.

Generation checks pre-call cancellation, profile existence and required
capabilities before script lookup or consumption. Identity, exact selection
and request hash must all match. A matching call is consumed once, including
when its outcome is a scripted model error. Unexpected, mismatched, repeated
or unconsumed calls are non-retryable `INTERNAL` test-harness failures; the
mock never selects another entry or creates fallback output.

Responses, errors, capabilities, configuration and inspection values are
detached and deeply frozen. Timestamps, usage, metadata and provider identity
must be scripted. The adapter has no provider SDK, network, environment,
filesystem, clock or random dependency.

Invocation evidence and the unconsumed-call assertion are adapter-specific.
They do not expand `ModelGateway`.

### Portable conformance

`@acme/testing` owns a `ModelGateway` conformance kit. It exercises
deterministic capability discovery, required-capability rejection, pre-call
cancellation, exact normalized success, exact structured model failure and
deep immutability through the core port only.

Future live adapters run the same kit with an injected fixture transport.
Provider-specific normalization, authentication and reconciliation require
additional tests and later decisions.

## Alternatives Considered

### FIFO response queue

- Benefits: minimal fixture configuration.
- Costs: reordered or duplicated calls can still pass; selection and request
  construction are not verified.
- Reason not selected: replayable orchestration requires exact call identity.

### Hash call context and selection with the request

- Benefits: one digest covers the entire invocation.
- Costs: duplicates fields already stored and prevents the request payload
  from having a stable identity independent of ledger placement.
- Reason not selected: the ledger deliberately separates payload, call
  identity and resolved selection.

### Inject a clock and generate missing response fields

- Benefits: shorter scripts.
- Costs: hidden defaults weaken fixture evidence and allow results to differ
  with adapter configuration.
- Reason not selected: normalized provider evidence must be explicit.

### Put invocation inspection on `ModelGateway`

- Benefits: one interface for production and test diagnostics.
- Costs: every live adapter would expose mock bookkeeping unrelated to model
  generation.
- Reason not selected: test evidence belongs to the adapter, as with the
  in-memory repository.

## Consequences

### Positive

- Request identity is explicit before durable call reuse depends on it.
- Incorrect call order, identity, selection or request content fails
  deterministically.
- Offline tests need no provider, clock or fixture filesystem.
- Future adapters receive an executable provider-neutral contract.
- Mock-specific evidence remains outside the production port.

### Negative

- Fixtures must supply complete response envelopes and exact request hashes.
- Exact profile matching is intentionally stricter than a production model
  resolver.
- The mock simulates no delays or in-flight cancellation races.
- Provider normalization correctness still needs adapter-specific tests.

## Compatibility and Migration

No live provider adapter or durable model-call database exists.
`acme-model-request-hash-1` is immutable. Any change to its preimage,
canonicalization or SHA-256 encoding requires a new algorithm identifier and
ledger compatibility handling.

Existing placeholder request hashes in repository tests are opaque fixture
values and do not represent persisted production data.

## Follow-ups

- ExecutionEngine must compute the request hash before model-call reservation
  and use the exact same request for gateway invocation.
- SQLite must persist the algorithm meaning and reuse compatible completed
  calls without calling a provider.
- Live adapters need fixture transports, provider normalization tests and
  reconciliation decisions before use.

## References

- [ACME specification, model gateway](../design/acme-design-and-development-spec.md#9-model-gateway-and-response-pipeline)
- [ACME specification, model-call durability](../design/acme-design-and-development-spec.md#145-model-call-durability)
- [ADR 0006 — Aggregate in-memory Unit of Work](0006-aggregate-in-memory-unit-of-work.md)
- [ACME-0009 task charter](../finished/ACME-0009_deterministic-model-mock-and-gateway-conformance.md)
