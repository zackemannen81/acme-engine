# ADR 0054 — Model runtime v2 and multi-provider routing

Status: Accepted
Date: 2026-09-15
Decision owners: ACME maintainers

## Context

`acme-model-runtime/1` proved the model-only execution boundary with an external A008 consumer, including streaming, tools, continuation, durable evidence and structured failures. Its frozen provider-neutral `ModelRequest` exposes `temperature`, `maxOutputTokens` and `stop`, while the consumer already owns additional controls (`topP`, `reasoningBudget`, `enableThinking`, `reasoningEffort`, `seed`). The runnable development composition also has only an OpenAI Responses gateway, so a caller-selected NVIDIA-hosted model cannot be executed without leaving the ACME boundary.

Changing v1 in place would break its exact-key wire contract. Silently dropping the additional controls would also change caller-owned execution semantics.

## Decision

### 1. Keep v1 frozen and add `acme-model-runtime/2`

`acme-model-runtime/1` remains accepted and unchanged. Version 2 keeps the same model-only ownership, endpoints, SSE event vocabulary, body/event bounds, authorization port and failure semantics, but permits the complete provider-neutral request controls needed by the adopting client:

- `temperature`
- `topP`
- `maxOutputTokens`
- `stop`
- `reasoningBudget`
- `enableThinking`
- `reasoningEffort`
- `seed`

Absent new fields do not change historical `acme-model-request-hash-1` inputs or hashes.
### 2. Provider routing is explicit composition, not model strategy

`ModelSelection.providerHint` remains caller-owned. A routed gateway delegates only to a configured gateway whose route key exactly matches that hint. Missing or unknown routes fail before provider dispatch. ACME does not infer a preferred provider, retry on another provider or fall back after dispatch.

The model execution engine remains unchanged in responsibility: it sees one `ModelGateway`, while the composition may supply a routed implementation.

### 3. Add an OpenAI-compatible Chat Completions adapter

A separate adapter implements the existing `ModelGateway` port for providers exposing OpenAI-compatible Chat Completions. It owns provider wire mapping, SSE parsing, tool-call assembly, reasoning-channel normalization and HTTP/error classification. Profiles inject provider name, endpoint, credentials/headers, exact model selection, capabilities and the provider-specific thinking-control mapping.

The adapter may map the caller controls mechanically; it may not choose values or remove controls silently. Unsupported supplied controls fail before network dispatch.

### 4. Keep OpenAI Responses as a separate adapter

OpenAI Responses remains authoritative for configured OpenAI selections. It gains only the provider-neutral controls it can actually honor. Provider-specific incompatibilities remain explicit failures rather than hidden mutation.

### 5. Runnable composition may expose several gateways

The model-runtime service composition may configure OpenAI Responses, NVIDIA-hosted Chat Completions and other explicitly configured compatible endpoints from environment-only credentials. It emits no credential values and does not make a deployment claim.

## Consequences

A008 and other products can retain ownership of model choice and generation parameters while using ACME for execution. v1 consumers are not forced to migrate. The model request hash continues to cover every control that can affect execution. Multi-provider behavior is testable offline behind the same `ModelGateway` contract.

The cost is a second external model-runtime protocol version and another provider adapter. Capability/profile configuration must remain explicit and tested.

## Compatibility

- `acme-model-runtime/1` parser, descriptor and tests remain available unchanged.
- Existing requests that omit the new controls keep their canonical request hash.
- No automatic migration, retry or provider fallback is introduced.
- Domain modules, MemoryEngine, StateEngine and full `ExecutionEngine` semantics are unchanged.

## References

- ADR-0014 — live provider boundary
- ADR-0017 — durable execution resume
- ADR-0053 — model-only execution runtime
- ACME-0180
