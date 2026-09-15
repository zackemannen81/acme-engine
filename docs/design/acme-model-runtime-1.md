# acme-model-runtime/1

Status: Accepted
Last updated: 2026-09-15

This is the frozen external wire for ACME model-only execution. It is the
integration contract another process or repository may build against. The
additive successor is [`acme-model-runtime-2.md`](acme-model-runtime-2.md);
this document remains the v1 contract.

Architecture authority: [ADR-0053](../adr/0053-model-only-execution-runtime.md).
Machine-readable twin: `apps/cli/src/acme-model-runtime-wire.ts`.
Prepared-request types: `packages/core/src/model.ts`.

This protocol is not `acme-runtime/1`. `POST /v1/execute` remains full
`ExecutionEngine` task execution under
[ADR-0051](../adr/0051-canonical-acme-runtime-boundary.md).

## Identity

| Field | Value |
| --- | --- |
| Protocol | `acme-model-runtime/1` |
| Compatibility | `GET /v1/model/compatibility` |
| Execute | `POST /v1/model/execute` |
| Protocol header | `x-acme-model-runtime-protocol: acme-model-runtime/1` |
| Transport refusal envelope | `acme-model-runtime-error/1` |
| Request body bound | 1 MiB |
| Stream event JSON bound | 64 KiB |
| Retained payload bound | 1 MiB |

An incompatible wire change requires `acme-model-runtime/2`. A new engine
build does not redefine this protocol.

## Authorization

Authorization is a composition port. The protocol does not standardize
bearer, OAuth, mTLS or any other production scheme. An unauthorized request
receives HTTP 401 with a transport refusal envelope. Clients must send
whatever the composition root requires, plus the protocol header.

## Compatibility

`GET /v1/model/compatibility`

Required headers:

```http
x-acme-model-runtime-protocol: acme-model-runtime/1
```

Success: HTTP 200 `application/json`:

```json
{
  "protocolVersion": "acme-model-runtime/1",
  "engineBuild": "composition-supplied-build-id",
  "executePath": "/v1/model/execute"
}
```

`engineBuild` is injected by the composition root. Clients may pin it.

## Execute

`POST /v1/model/execute`

Required headers:

```http
content-type: application/json
x-acme-model-runtime-protocol: acme-model-runtime/1
```

The body is one prepared model call. ACME validates execution shape and
required capabilities. It does not choose, remove, enrich or reinterpret
messages, tool schemas, tool results or the selected model. It does not
approve or execute tools.

Success starts an SSE stream: HTTP 200 `text/event-stream; charset=utf-8`
with `x-acme-model-runtime-protocol: acme-model-runtime/1`. Client disconnect
cancels the in-flight provider call.

Transport refusals (auth, protocol, shape, body bound, missing route) are
JSON envelopes, not SSE, and are not engine terminal states.

### Request

```json
{
  "protocolVersion": "acme-model-runtime/1",
  "requestKey": "caller-stable-key",
  "correlationId": "optional-caller-correlation",
  "model": {
    "profile": "default",
    "providerHint": "openai",
    "modelHint": "gpt-5"
  },
  "request": {
    "messages": [
      {
        "role": "system",
        "content": [{ "type": "text", "text": "Follow the caller instructions." }]
      },
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
    "maxOutputTokens": 1024
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
| `protocolVersion` | Must be `acme-model-runtime/1`. |
| `requestKey` | Caller-owned idempotency key. Same key + same fingerprint reuses the terminal result. Same key + different fingerprint is `CONFLICT_IDEMPOTENCY_KEY`. |
| `correlationId` | Optional. ACME stores nothing domain-meaningful from it. |
| `model` | `profile` required; `providerHint` and `modelHint` optional. ACME does not select a model strategy. |
| `request` | One provider-neutral `ModelRequest`. |
| `requiredCapabilities` | Optional. ACME may add structural requirements (`structuredOutput` for JSON output, `tools` when tools are present). It does not remove caller requirements. |
| `policy.timeoutMs` | Optional positive integer. Default 30000. |
| `policy.retention` | Optional `none` \| `hash-only` \| `encrypted-payload`. Default `hash-only`. |

`output` is a discriminated union:

```json
{ "mode": "text" }
```

or

```json
{
  "mode": "json",
  "schemaName": "fixture_output_1",
  "jsonSchema": { "type": "object" }
}
```

JSON mode is the historical ACME structured-output contract. Its request
hash algorithm remains `acme-model-request-hash-1`.

`tools` is omitted when unused. Empty arrays are rejected. Each tool is
`{ "type": "function", "name", "description?", "parameters" }`.

### Content parts

| `type` | Fields | Typical role |
| --- | --- | --- |
| `text` | `text` | any |
| `tool-call` | `toolCallId`, `name`, `arguments` | `assistant` |
| `tool-result` | `toolCallId`, `value` | `tool` |
| `image` | `mediaType`, `dataRef` | `user`; the OpenAI Responses adapter refuses images |

A later turn that continues a tool call is a **new** bounded execution. The
caller supplies the original messages, the assistant `tool-call` part, and
the corresponding `tool-result`. ACME does not keep an agent loop.

```json
{
  "role": "assistant",
  "content": [
    {
      "type": "tool-call",
      "toolCallId": "call_1",
      "name": "get_weather",
      "arguments": { "city": "Paris" }
    }
  ]
}
```

```json
{
  "role": "tool",
  "content": [
    {
      "type": "tool-result",
      "toolCallId": "call_1",
      "value": { "celsius": 18 }
    }
  ]
}
```

## SSE stream

Each event is:

```text
event: <type>
data: <json>

```

`type` is one of `reasoning-delta`, `content-delta`, `tool-call-delta`,
`completed`, `failed`. `sequence` starts at 0 and increases by 1.

Every `data` object includes `"protocolVersion": "acme-model-runtime/1"`.

### `reasoning-delta`

```json
{
  "protocolVersion": "acme-model-runtime/1",
  "type": "reasoning-delta",
  "sequence": 0,
  "text": "..."
}
```

### `content-delta`

```json
{
  "protocolVersion": "acme-model-runtime/1",
  "type": "content-delta",
  "sequence": 1,
  "text": "Hello"
}
```

### `tool-call-delta`

Fragmented provider tool-call output. Assemble by `index` in arrival order.
`argumentsDelta` is a JSON string fragment, not parsed JSON.

```json
{
  "protocolVersion": "acme-model-runtime/1",
  "type": "tool-call-delta",
  "sequence": 2,
  "index": 0,
  "toolCallId": "call_1",
  "name": "get_weather",
  "argumentsDelta": "{\"city\":"
}
```

ACME returns the assembled tool call on `completed`. It does not execute it.
Malformed final arguments are `MODEL_INVALID_RESPONSE`, not repaired.

### `completed`

Terminal success. `result.replayed` is true when this is idempotent reuse or
retained-response recovery without a second provider call.

```json
{
  "protocolVersion": "acme-model-runtime/1",
  "type": "completed",
  "sequence": 3,
  "response": {
    "provider": "openai",
    "model": "gpt-5",
    "providerResponseId": "resp_123",
    "receivedAt": "2026-09-15T12:00:00.000Z",
    "finishReason": "tool",
    "text": "",
    "toolCalls": [
      {
        "toolCallId": "call_1",
        "name": "get_weather",
        "arguments": { "city": "Paris" }
      }
    ],
    "usage": {
      "inputTokens": 120,
      "outputTokens": 24,
      "totalTokens": 144
    },
    "metadata": {
      "providerStatus": "completed"
    }
  },
  "result": {
    "status": "succeeded",
    "modelExecutionId": "model_execution_…",
    "replayed": false,
    "usage": {
      "inputTokens": 120,
      "outputTokens": 24,
      "totalTokens": 144
    },
    "diagnostic": {
      "kind": "completed",
      "finishReason": "tool"
    },
    "response": { "...": "same normalized response object" }
  }
}
```

`toolCalls` is omitted when there are none. `finishReason` is
`stop` \| `length` \| `tool` \| `content-filter` \| `unknown`.

Missing usage or cost is omitted. Absence is unknown, not zero.

### `failed`

Terminal failure. The stream still ends on HTTP 200; the event carries the
engine outcome. `diagnostic` distinguishes timeout, cancel, provider HTTP
failure, malformed/truncated stream, ambiguous delivery and completed
response. It does not include credentials or retained payload.

```json
{
  "protocolVersion": "acme-model-runtime/1",
  "type": "failed",
  "sequence": 0,
  "error": {
    "code": "TIMEOUT",
    "message": "The provider may have executed this call; no response was received.",
    "stage": "calling-model",
    "retryable": false,
    "details": { "delivery": "unknown", "reason": "timeout" }
  },
  "result": {
    "status": "failed",
    "modelExecutionId": "model_execution_…",
    "diagnostic": {
      "kind": "ambiguous-delivery",
      "delivery": "unknown"
    }
  }
}
```

`result.status` is `failed` \| `cancelled` \| `conflicted`.

## Transport refusal envelope

Not an engine terminal state:

```json
{
  "protocolVersion": "acme-model-runtime-error/1",
  "code": "UNAUTHORIZED",
  "message": "Model runtime authorization failed."
}
```

| HTTP | `code` |
| --- | --- |
| 401 | `UNAUTHORIZED` |
| 404 | `NOT_FOUND` |
| 405 | `METHOD_NOT_ALLOWED` |
| 409 | `MODEL_RUNTIME_PROTOCOL_MISMATCH` |
| 413 | `REQUEST_BODY_TOO_LARGE` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` |
| 400 | `INVALID_MODEL_RUNTIME_REQUEST`, `INVALID_JSON`, `INVALID_UTF8`, `MISSING_BODY`, `INVALID_CONTENT_LENGTH` |

## Semantics callers must not violate

- One request is one bounded model execution. Tool execution and the next
  model call are the caller's job.
- After dispatch, an unobserved or ambiguous provider outcome is evidence,
  not permission to retry automatically.
- `reserved` / `in-flight` after interruption is terminal and is not retried.
- Stream events are delivery of this call. They are not domain events,
  memory or canonical application state.
- ACME does not invoke DomainModule, MemoryEngine, StateEngine or
  `ExecutionEngine.execute()` on this path.

## Diagnostic kinds

`completed` \| `timeout` \| `cancel` \| `provider-http` \|
`malformed-stream` \| `truncated-stream` \| `ambiguous-delivery` \|
`invalid-response` \| `unavailable` \| `auth` \| `rate-limit` \|
`content-filter` \| `conflict` \| `unsupported-capability` \|
`invalid-request` \| `resume-evidence-unavailable` \| `cancelled` \|
`internal`.

Optional `delivery` is `not-sent` \| `sent` \| `unknown`. Optional
`httpStatus` is the provider HTTP status when one was observed.
