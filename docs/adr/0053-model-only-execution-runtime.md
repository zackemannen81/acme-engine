# ADR 0053 — Model-only execution runtime

Status: Accepted
Date: 2026-09-15
Decision owners: ACME maintainers

## Context

ACME can durably execute domain tasks and can expose the full `ExecutionEngine`
through `acme-runtime/1`. The provider-neutral `ModelRequest` is structured-JSON
only, and the OpenAI Responses adapter is buffered/text-only with no tool or
streaming contract.

An external AI product must be able to hand ACME one already-prepared model
call and receive reliable provider execution without invoking ACME domain
modules, semantic interpretation, memory or state. Reusing `POST /v1/execute`
would mix that non-cognitive path with full task execution and would change
the meaning of [ADR-0051](0051-canonical-acme-runtime-boundary.md).

The live provider boundary in [ADR-0014](0014-live-provider-boundary-and-transport-port.md)
and the durable resume rule in [ADR-0017](0017-durable-execution-resume.md)
remain the authority for delivery classification, ambiguity and retained
response recovery. This decision adds a model-only owner and a distinct
external protocol without weakening those rules.

## Decision

### 1. Model-only execution is a separate owner

`ModelExecutionEngine` in `@acme/core` executes one prepared model request. It
validates execution shape, checks capabilities, computes request identity,
reserves the model call before dispatch, records success/failure/ambiguity,
applies retention and exposes usage/cost/safe diagnostics.

It does not load domain context, project contracts, interpret model output,
consult memory, reduce state, commit documents/events or call
`ExecutionEngine.execute()`.

Caller-supplied messages, tool schemas, tool results and selected model are
execution input. ACME may validate their shape and required capabilities. It
may not choose, remove, enrich or reinterpret them semantically, approve or
execute tools, or decide whether another model call is useful.

### 2. `acme-model-runtime/1` is the external protocol

The versioned protocol is `acme-model-runtime/1`. It is not an extension of
`acme-runtime/1`.

The frozen wire is
[`docs/design/acme-model-runtime-1.md`](../design/acme-model-runtime-1.md).
The machine-readable twin is `apps/cli/src/acme-model-runtime-wire.ts`.

- Authenticated `GET /v1/model/compatibility` returns an injected build
  descriptor and the model-execute path.
- Authenticated `POST /v1/model/execute` validates one prepared request
  fail-closed, bounds the body at 1 MiB, forwards `AbortSignal`, and returns
  an ordered SSE stream of provider-neutral events ending in a terminal
  normalized result or honest failure diagnostic.
- Authorization remains a composition port. The protocol does not standardize
  bearer, OAuth or mTLS.
- The existing Node listener may adapt sockets for this host. It still owns
  no engine, provider or persistence policy.

`POST /v1/execute` keeps the ADR-0051 meaning: one `ExecutionEngine` task.

### 3. `ModelRequest.output` is a discriminated `json | text` union

JSON mode remains `{ mode: 'json', schemaName, jsonSchema }`. Text mode is
`{ mode: 'text' }`. Optional function-tool definitions sit on the request, not
inside output.

Historical JSON requests omit `tools` and keep the same output object, so
`acme-model-request-hash-1` identities are unchanged. Optional `toolCalls` on
`NormalizedModelResponse` are omitted when absent, so response hashes of
historical JSON completions are unchanged.

A `tool-call` content part lets a later caller-prepared request carry the
prior assistant tool call plus the corresponding `tool-result`. ACME returns
tool calls without executing them.

### 4. Streaming is observability of one model call

`ModelGateway.stream`, when present, yields ordered provider-neutral events:
reasoning deltas, content deltas, fragmented tool-call deltas, then a
terminal `completed` or a thrown/failed outcome. `generate` remains the
buffered contract used by `ExecutionEngine`.

Stream events are not domain events, memory or canonical application state.
Fragmented provider tool-call output is assembled deterministically. Malformed
JSON arguments are `MODEL_INVALID_RESPONSE`; ACME does not repair or guess.

Per-event and retained-payload bounds are explicit. Oversized events or
payloads fail closed.

### 5. Transport streaming stays opaque

The ADR-0014 transport may expose an optional `stream` that yields an HTTP
status line and opaque byte/text chunks. It still never parses a body, never
classifies an ACME error and never sees an ACME type.

If a status line was received, the outcome is not ambiguous. A truncated or
malformed SSE body after HTTP 200 is `MODEL_INVALID_RESPONSE` with a
truncated/malformed-stream diagnostic. No status line keeps the ADR-0014
delivery table, including `unknown` as ambiguous.

### 6. Durability and ambiguity follow ADR-0014 and ADR-0017

The model-only owner uses a dedicated `ModelExecutionRepository` with the
same model-call reservation, completion, failure, retention and reveal rules
as execution model calls.

- Reservation is written before the gateway is invoked.
- Same `requestKey` and fingerprint reuse the terminal result without a
  second provider call when the retained response is recoverable.
- Same `requestKey` with a different fingerprint fails closed
  (`CONFLICT_IDEMPOTENCY_KEY`).
- `reserved` / `in-flight` after interruption is terminal and not retried.
- `ambiguous` is terminal and never automatically retried.
- A successfully retained response survives process/repository restart
  without a second provider call.
- Diagnostics distinguish timeout, cancel, provider HTTP failure,
  malformed/truncated stream, ambiguous delivery and completed response
  without exposing credentials or retained payload by default.

## Alternatives considered

### Overload `acme-runtime/1` `POST /v1/execute`

- Benefits: one external protocol.
- Costs: would change ADR-0051's execute meaning and mix domain-task
  execution with non-cognitive model execution.
- Reason not selected: the charter forbids reusing `/v1/execute`.

### Put model-only execution inside `ExecutionEngine`

- Benefits: one durable owner.
- Costs: would route prepared model calls through modules, contracts,
  memory, state and commit, which this path must not touch.
- Reason not selected: the boundary is the point of the task.

### Automatic retry of ambiguous or truncated calls

- Benefits: fewer stranded calls.
- Costs: silently duplicates billed provider work; contradicts ADR-0014.
- Reason not selected: a later retry design needs its own ADR with
  duplicate-call safety evidence.

### New provider family or Chat Completions fallback

- Benefits: broader provider coverage.
- Costs: out of charter and would weaken the Responses-first adapter.
- Reason not selected: this task extends the existing OpenAI Responses
  mapping only.

## Consequences

### Positive

- External products can use ACME as a durable model-execution runtime
  without adopting ACME domain modules.
- Historical structured-JSON execution, hashes and `acme-runtime/1` keep
  their meaning.
- Streaming, tools and text output have a provider-neutral contract with
  honest failure evidence.

### Negative

- Two external protocols must be documented and composed separately.
- Model-only persistence is a new store, not a row in the domain execution
  ledger.
- Clients must assemble tool results themselves and submit a later prepared
  request.

### Follow-ups

- A runnable service composition that listens for `acme-model-runtime/1` is
  a separate task, as with ADR-0051.
- Mechanical retry of ambiguous calls remains forbidden until an explicit
  architecture decision exists.

## Compatibility and Migration

- Existing JSON `ModelRequest` fixtures, validation, request hashes, gateway
  `generate` behaviour and domain execution are unchanged when `tools` is
  omitted and `output.mode` is `json`.
- `ModelGateway.stream` is optional so existing test doubles and
  `ExecutionEngine` keep compiling.
- The OpenAI adapter adds text, tools and SSE without changing buffered JSON
  success/failure classification.
- No live provider, deployment or publication is authorized by this ADR.

## References

- [ADR-0014](0014-live-provider-boundary-and-transport-port.md)
- [ADR-0017](0017-durable-execution-resume.md)
- [ADR-0051](0051-canonical-acme-runtime-boundary.md)
- ACME-0176
