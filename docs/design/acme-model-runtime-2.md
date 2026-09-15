# acme-model-runtime/2

Status: Accepted
Last updated: 2026-09-15

This is the additive external wire for ACME model-only execution. It keeps
the ownership, endpoints, SSE vocabulary, bounds, authorization port and
failure semantics of `acme-model-runtime/1` and adds the remaining
provider-neutral generation controls required by adopting clients.

Architecture authority: [ADR-0054](../adr/0054-model-runtime-v2-multi-provider-routing.md).
Frozen predecessor: [`acme-model-runtime-1.md`](acme-model-runtime-1.md).
Machine-readable twin: `apps/cli/src/acme-model-runtime-wire.ts`.
Prepared-request types: `packages/core/src/model.ts`.

This protocol is not `acme-runtime/1`. `POST /v1/execute` remains full
`ExecutionEngine` task execution under
[ADR-0051](../adr/0051-canonical-acme-runtime-boundary.md).

## Identity

| Field | Value |
| --- | --- |
| Protocol | `acme-model-runtime/2` |
| Compatibility | `GET /v1/model/compatibility` |
| Execute | `POST /v1/model/execute` |
| Protocol header | `x-acme-model-runtime-protocol: acme-model-runtime/2` |
| Transport refusal envelope | `acme-model-runtime-error/1` |
| Request body bound | 1 MiB |
| Stream event JSON bound | 64 KiB |
| Retained payload bound | 1 MiB |

`acme-model-runtime/1` remains accepted and unchanged. A v2 host rejects a
v1 protocol header and body, and a v1 host rejects a v2 protocol header and
body. There is no automatic migration.

## Authorization

Authorization is a composition port. An unauthorized request receives HTTP
401 with a transport refusal envelope. Clients must send whatever the
composition root requires, plus the protocol header.

## Compatibility

`GET /v1/model/compatibility`

Required headers:

```http
x-acme-model-runtime-protocol: acme-model-runtime/2
```

Success: HTTP 200 `application/json`:

```json
{
  "protocolVersion": "acme-model-runtime/2",
  "engineBuild": "composition-supplied-build-id",
  "executePath": "/v1/model/execute"
}
```

## Execute

`POST /v1/model/execute`

Required headers:

```http
content-type: application/json
x-acme-model-runtime-protocol: acme-model-runtime/2
```

The body is one prepared model call. ACME validates execution shape and
required capabilities. It does not choose, remove, enrich or reinterpret
messages, tool schemas, tool results or the selected model. It does not
approve or execute tools.

Success starts an SSE stream: HTTP 200 `text/event-stream; charset=utf-8`
with `x-acme-model-runtime-protocol: acme-model-runtime/2`. Client disconnect
cancels the in-flight provider call.

Transport refusals (auth, protocol, shape, body bound, missing route) are
JSON envelopes, not SSE, and are not engine terminal states. An unknown or
unconfigured `model.providerHint` fails before provider dispatch. ACME does
not infer a provider, retry on another provider or fall back after dispatch.

### Request

```json
{
  "protocolVersion": "acme-model-runtime/2",
  "requestKey": "caller-stable-key",
  "correlationId": "optional-caller-correlation",
  "model": {
    "profile": "default",
    "providerHint": "nvidia",
    "modelHint": "nemotron"
  },
  "request": {
    "messages": [
      {
        "role": "user",
        "content": [{ "type": "text", "text": "What is the weather in Paris?" }]
      }
    ],
    "output": { "mode": "text" },
    "tools": [
      {
        "type": "function",
        "name": "get_weather",
        "description": "Return current weather for a city.",
        "parameters": {
          "type": "object",
          "properties": { "city": { "type": "string" } },
          "required": ["city"],
          "additionalProperties": false
        }
      }
    ],
    "temperature": 0.6,
    "topP": 0.95,
    "maxOutputTokens": 2048,
    "enableThinking": true,
    "reasoningBudget": 4096,
    "seed": 11
  },
  "requiredCapabilities": { "tools": true },
  "policy": {
    "timeoutMs": 30000,
    "retention": "hash-only"
  }
}
```

Exact keys. Unknown fields fail closed.

| Field | Rule |
| --- | --- |
| `protocolVersion` | Must be `acme-model-runtime/2`. |
| `requestKey` | Caller-owned idempotency key. Same key + same fingerprint reuses the terminal result. Same key + different fingerprint is `CONFLICT_IDEMPOTENCY_KEY`. |
| `correlationId` | Optional. ACME stores nothing domain-meaningful from it. |
| `model` | `profile` required; `providerHint` and `modelHint` optional at the type level. A routed composition requires `providerHint` and fails closed when the hint is missing or unconfigured. ACME does not select a model strategy. |
| `request` | One provider-neutral `ModelRequest`. |
| `requiredCapabilities` | Optional. ACME may add structural requirements (`structuredOutput` for JSON output, `tools` when tools are present). It does not remove caller requirements. |
| `policy.timeoutMs` | Optional positive integer. Default 30000. |
| `policy.retention` | Optional `none` \| `hash-only` \| `encrypted-payload`. Default `hash-only`. |

`output` remains the v1 discriminated union `text | json`.

### Generation controls

All controls are optional. Absent controls keep the historical
`acme-model-request-hash-1` input. Present controls are hashed.

| Field | Rule |
| --- | --- |
| `temperature` | Finite number ≥ 0. |
| `topP` | Finite number from 0 to 1. |
| `maxOutputTokens` | Positive safe integer. |
| `stop` | Non-empty array of non-empty strings. |
| `reasoningBudget` | Safe integer ≥ -1. |
| `enableThinking` | Boolean. |
| `reasoningEffort` | Bounded non-empty string. |
| `seed` | Non-negative safe integer. |

Adapters map only the controls they can honor. Unsupported supplied
controls fail before network dispatch. They are never dropped silently.

OpenAI Responses honors `temperature`, `topP`, `maxOutputTokens` and
`reasoningEffort`. It refuses `stop`, `seed`, `enableThinking` and
`reasoningBudget`.

OpenAI-compatible Chat Completions profiles declare which controls they
honor, including the thinking-template mapping (`enable_thinking` or
`thinking`). NVIDIA-hosted Nemotron, Kimi, DeepSeek, Muse and Laguna
selections use this surface.

## SSE stream

Event types, sequence rules, tool-call assembly, completion/failure
envelopes, bounds and diagnostic kinds are identical to
[`acme-model-runtime-1.md`](acme-model-runtime-1.md) except every `data`
object uses `"protocolVersion": "acme-model-runtime/2"`.

`type` is one of `reasoning-delta`, `content-delta`, `tool-call-delta`,
`completed`, `failed`. `sequence` starts at 0 and increases by 1.

## Transport refusal envelope

Unchanged from v1: `acme-model-runtime-error/1` with the same HTTP mapping.

## Semantics callers must not violate

- One request is one bounded model execution. Tool execution and the next
  model call are the caller's job.
- After dispatch, an unobserved or ambiguous provider outcome is evidence,
  not permission to retry automatically.
- Provider routing is caller-owned. ACME does not infer, retry or fall back.
- Stream events are delivery of this call. They are not domain events,
  memory or canonical application state.
- ACME does not invoke DomainModule, MemoryEngine, StateEngine or
  `ExecutionEngine.execute()` on this path.
