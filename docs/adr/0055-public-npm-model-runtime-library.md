# ADR 0055 — Public npm model-runtime library boundary

Status: Accepted
Date: 2026-09-16
Decision owners: Rickard Zakrisson

## Context

ACME's source is already Apache-2.0 open source, but ADR-0052 deliberately kept
all workspace packages npm-private until publication had an explicit owner.
ADR-0053 and ADR-0054 then established a model-only execution engine and a
runnable HTTP composition used by A008. That service proves the boundary, but a
consumer that wants ACME in-process must currently either depend on unpublished
workspace internals or run a separate ACME process.

The accepted model-runtime semantics must remain unchanged: callers prepare the
messages, tools, selected model and generation controls; ACME owns execution,
streaming, cancellation, evidence, idempotency and provider isolation. ACME
must not absorb A008 cognition, memory, tool execution or model strategy.

## Decision

### 1. Add a public in-process model-runtime package

`@acme-engine/model-runtime` is the supported Node library composition for
model-only execution. It composes the existing `ModelExecutionEngine`, routed
`ModelGateway`, provider adapters and model-execution repository and exposes an
in-process API. Creating the library does not start a listener or choose an
external transport protocol.

The existing `acme-model-runtime/1` and `/2` HTTP/SSE protocols remain separate
transport contracts. The private CLI service composes the same library and then
adds its host, listener, authorization and environment parsing.
### 2. Publish only the required dependency closure

The initial public package set is:

- `@acme-engine/core`
- `@acme-engine/evaluation`
- `@acme-engine/adapter-memory`
- `@acme-engine/adapter-model-openai`
- `@acme-engine/adapter-model-chat-completions`
- `@acme-engine/model-runtime`

These packages start at version `0.1.0`. Their package manifests carry
Apache-2.0 license metadata, the repository location, the supported Node engine
range and `publishConfig.access = public`. The workspace root remains
`private: true` and is never a release artifact.

Packages outside this dependency closure remain private and keep their existing
`@acme/*` package names until a later explicit distribution decision. Private
workspace packages may depend on the public package names.

### 3. The library is composition, not a new execution owner

The model-runtime package may provide configuration validation, explicit route
composition and a convenient default in-memory `ModelExecutionRepository`.
It delegates execution to `ModelExecutionEngine`; it does not fork or wrap the
engine with different retry, retention, sequencing, hashing or error rules.

Provider routing remains exact caller-owned `providerHint` matching. Unsupported
controls still fail before dispatch. No fallback or model-selection policy is
introduced.
### 4. Package publication and source openness remain separate effects

This ADR authorizes the package contract and release metadata. ACME-0181 may
build, pack, inspect and install local tarballs to prove the boundary, but it
does not publish to the npm registry, create a Git tag/release or deploy a
service. Registry publication requires a separately explicit external effect.

Before any real registry publish, the existing content-redacted secret audit
must be considered and the release candidate must be packed and inspected.

## Consequences

### Positive

- A008 and other Node consumers can embed ACME model execution without running
  a third process.
- The HTTP service and embedded path share one provider-routing composition.
- The root workspace remains protected from accidental publication.
- Public dependencies are versioned and installable without exposing unrelated
  Evidence, Narrative, Research or product packages.

### Negative

- Selected existing packages change npm identity from `@acme/*` to
  `@acme-engine/*`; every live workspace import/dependency must migrate in one
  coherent change.
- Initial publication contains several packages instead of one bundled
  artifact because the architecture preserves package boundaries.
- Semver now applies to the public surfaces and later breaking changes require
  deliberate versioning.
## Compatibility and Migration

- `acme-model-runtime/1` and `/2` request/response/event contracts do not
  change.
- Existing private CLI commands and executables remain available.
- `ModelExecutionEngine`, request hashes, response hashes, repository evidence
  and ambiguity semantics are unchanged.
- Internal source imports of the selected packages migrate mechanically to the
  new npm scope; unrelated private package identities do not change.
- No A008 source change is part of this decision.

## Alternatives Considered

### Publish the CLI package

Rejected because `@acme/cli` is an application composition root that pulls in
unrelated domains, persistence and test surfaces. It is not the library
contract an embedding consumer needs.

### Bundle all ACME implementation into one package

Rejected because it would erase existing dependency boundaries and make a
release artifact structurally different from the tested workspace packages.

### Keep ACME as a required sidecar process

Rejected as the only integration model. The external protocol remains useful,
but process topology is a deployment choice and must not be required for an
in-process Node consumer.

## References

- ADR-0052 — Apache-2.0 open-source source distribution
- ADR-0053 — model-only execution runtime
- ADR-0054 — model runtime v2 and multi-provider routing
- ACME-0181
