# ADR 0051 — Canonical ACME runtime boundary

Status: Accepted
Date: 2026-08-19
Decision owners: ACME maintainers

## Context

`ExecutionEngine` is the domain-neutral execution authority, but until this
decision ACME has no small, canonical external protocol for invoking one
execution from another process or application.

The Felix integration work proved that a strict HTTP/Fetch boundary is useful:
a compatibility handshake, one execute endpoint, fail-closed validation,
bounded request bodies, cancellation propagation and lossless terminal-result
mapping all worked without changing `packages/core`. The first version of that
boundary was nevertheless application-owned. Its wire carried AAL workspace,
subject, artifact and schema metadata and was pinned to a specific Felix fork
commit. Those fields are valid application concerns but they are not ACME
runtime semantics.

The upstream integration review therefore keeps the transport/boundary
properties while replacing the application-specific wire with a canonical ACME
contract. Runnable database/provider composition is intentionally a separate
decision and task.

## Decision

### 1. `acme-runtime/1` is the canonical external execution protocol

The versioned protocol is `acme-runtime/1`.

A request contains only the information required to form the existing public
`ExecutionRequest`, plus optional transport correlation:

- `requestKey`;
- optional `correlationId`;
- engine `namespace`;
- engine `task`;
- engine `entityId`;
- `expectedRevision`;
- model selection;
- optional execution policy;
- JSON `input`.

Application workspace identity, application entity/version metadata, source
artifact ids, AAL task ids, application contract/schema hashes and repository
pins are not part of the canonical runtime request. Applications may retain
those fields on their side of the boundary and correlate them with
`requestKey`/`correlationId`.

### 2. Compatibility identity is injected, not fossilized

The runtime host exposes authenticated `GET /v1/compatibility`.

Its descriptor contains:

- `protocolVersion`;
- an injected `engineBuild` identity;
- the execute path.

The host does not hard-code a repository owner, fork or commit. The composition
root that builds a runtime chooses the build identity. A client may pin and
refuse an unexpected descriptor according to its own compatibility policy.

Changing the canonical wire incompatibly requires a new protocol version; a
new engine build does not by itself redefine the wire.

### 3. Execute is a strict shell around `ExecutionEngine`

Authenticated `POST /v1/execute` validates the request fail-closed and maps one
valid runtime request deterministically to the existing `ExecutionRequest`.

The host:

- checks protocol/media/shape before execution;
- accepts finite JSON only;
- enforces a 1 MiB request-body bound;
- forwards the incoming `AbortSignal` to `ExecutionEngine.execute`;
- returns ACME terminal execution status and structured error evidence without
  inventing a new semantic outcome in the transport layer.

Transport refusal errors remain transport errors and do not masquerade as
engine terminal states.

### 4. Authorization is a port

The host receives an authorization function from composition. The protocol does
not standardize bearer tokens, OAuth, mTLS or any other production auth scheme.

A bearer helper may be useful for a private/local runnable composition later,
but such a helper is an adapter/composition choice, not part of
`acme-runtime/1`.

### 5. The Node listener is a transport adapter only

A thin Node built-in HTTP listener may bridge `IncomingMessage`/`ServerResponse`
to the Fetch-compatible host.

It owns socket mechanics only. Protocol validation, authorization, body bounds
and engine mapping remain in the Fetch host. Client disconnect propagates to
the Fetch request and therefore to the engine `AbortSignal`.

The listener does not select a database, model provider, model, secret source,
process supervisor, TLS certificate or deployment environment.

### 6. Runtime composition remains a separate layer

A runnable ACME runtime process may later compose this boundary with, for
example, PostgreSQL persistence and an OpenAI model gateway. That composition
is independently reviewable and is not the definition of the runtime
protocol.

In particular, this ADR does not make PostgreSQL or OpenAI mandatory runtime
architecture and does not claim that a runtime service is deployed.

### 7. Core and POC #1 remain unchanged

The boundary lives in the application/composition layer. It does not require
changes to `packages/core`, Evidence V2 modules/contracts/adapters, Evidence
Workbench V2 or frozen POC #1 material.

`ExecutionEngine` remains the execution authority; the runtime host is only a
strict external adapter around its existing public request/result surface.

## Consequences

### Positive

- Any application can target one small ACME-owned execution protocol instead of
  importing engine source or adopting another application's metadata model.
- Compatibility checks are explicit without coupling ACME to a particular fork.
- Cancellation, request bounds and fail-closed parsing are reusable and tested
  once at the runtime boundary.
- Engine terminal semantics remain authoritative across process boundaries.
- Provider/database/deployment choices can evolve independently from the wire.

### Costs

- Existing AAL clients must adapt their application-owned metadata to the
  smaller canonical request and keep application correlation/pinning policy on
  their side.
- A runtime descriptor's `engineBuild` must be supplied truthfully by each
  composition root.
- A runnable service still needs a separate composition task before this
  boundary can be deployed as a process.

## Alternatives considered

### Keep the AAL wire as ACME's runtime contract

Rejected. It would make application workspace/artifact/schema concepts and a
Felix repository review point part of the engine's public protocol.

### Hard-code the upstream repository commit in the host

Rejected. Build pinning is valuable to clients, but the identity belongs to the
composition descriptor, not source-code constants tied to one repository.

### Put HTTP/runtime concerns in `packages/core`

Rejected. Core remains transport/provider/database neutral and already exposes
the request/result types the adapter needs.

### Standardize bearer authentication now

Rejected. Bearer is a useful optional composition default, not a sufficient
general production authentication architecture.

### Bundle Postgres/OpenAI runnable composition into the same change

Rejected. It couples a generic external boundary to deployment/provider choices
and makes regression review against frozen POC #1 unnecessarily broad.

## Verification and implementation

- Implemented by ACME-0167 / PR #33 in `apps/cli/src/acme-runtime-*.ts` with
  focused Fetch-host and real loopback HTTP tests.
- ACME-0168 / PR #34 separately repaired a stale PostgreSQL restart fixture;
  it changed no runtime or product behavior.
- Canonical run `32235955771` on the ACME-0167 branch after merging the corrected
  baseline passed both `verify` and `postgres`: docs, format, lint, typecheck,
  package boundaries, unit, conformance, integration, deterministic scenarios,
  build and the complete PostgreSQL suite.
- The runtime PR file set contains no `packages/core`, frozen Evidence/POC #1 or
  Evidence adapter/module changes.

## Follow-up

A separate task may define an optional runnable runtime composition (process
entry point, persistence adapter, model gateway, private/local auth helper and
environment configuration). Deployment, TLS/DNS and provider credentials remain
outside this ADR.
