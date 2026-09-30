# ADR 0057 — Explicit per-tool strictness

Status: Accepted
Date: 2026-09-30
Decision owner: Rickard Zakrisson

## Context

A008 embeds `acme-engine` for provider execution and consumes MCP tools whose
schemas can exceed OpenAI's strict subset. ADR-0053/0055 leave tool policy and
execution with the caller; ADR-0015 preserves strict structured final output.
The caller needs a deliberate compatibility option for individual tools.

## Decision

`ModelFunctionTool.strict?: boolean` is part of the embedded public contract.
Omission means true. Only explicit false selects best-effort provider tool
generation. A strict tool's refusal never changes any tool's mode and never
causes an automatic retry. Values other than booleans fail request validation.

OpenAI Responses sends a boolean for every function tool. Strict tools retain
ADR-0015 lowering and local refusal; non-strict tools send the original
parameters without lowering, nullable/required rewrites or keyword removal.
The provider may still reject an unsupported schema. `output.mode: json`
continues to use the independent strict final-output lowerer and wire flag.

Chat Completions sends `function.strict` explicitly with the same default.
Its parameter-schema passthrough remains unchanged; ACME does not promise
strict support from every compatible endpoint. A provider rejection remains
an observable failure. This intentionally changes the earlier Chat Completions
behavior, which omitted the flag and left enforcement to provider defaults.
Consumers requiring best-effort behavior must select false explicitly before
adopting the release carrying this change.

The caller resolves `tool override ?? MCP-server default ?? true` and passes
the resulting boolean per tool. No MCP/server vocabulary or registry enters
core. There is no request-wide fallback flag.

Before executing a completed tool call, the caller must validate arguments
against the **original** tool schema in both modes. Strict provider output is
still an untrusted candidate. Stream fragments must not trigger execution.
ACME parses JSON and normalizes tool calls; it does not implement JSON Schema
argument validation, tool approval/execution or a repair loop. A caller may
return validation errors as a tool result and submit a bounded correction
request with a new request key. It owns the attempt limit and validates again.
Malformed JSON remains `MODEL_INVALID_RESPONSE`; ACME does not guess repairs.

`acme-model-request-hash-1` includes each explicitly supplied boolean.
Omitted fields stay omitted in validated requests, preserving historical
hashes; explicit true, explicit false and omission are distinct inputs even
when omission and true select the same mode. Changing mode under a previously
accepted request key therefore conflicts rather than reusing another mode.

Embedded terminal `ModelExecutionDiagnostic.toolModes` contains only ordered
`{ toolIndex, strict }` entries, absent when there are no tools. It records
effective requested modes on success, failure and conflict and is retained
with execution evidence for replay/resume. This reports configuration, not a
claim that an arbitrary provider enforced its schema. No tool names, schemas
or argument values enter these entries. Historical terminal records are not
rewritten to add diagnostics that were never recorded.

The exact-key HTTP `acme-model-runtime/1` and `/2` tool shapes remain frozen:
both refuse explicit tool strictness. Their SSE diagnostics keep the old
shape. This task adds the option only to the embedded contract; a future HTTP
protocol extension requires separate authority.

## Consequences

One incompatible tool can opt out without weakening strict neighbours or
structured final output. ACME stays a provider execution substrate, while
A008 owns MCP defaults, validation and correction policy. Original schemas
remain available and unchanged for caller validation and canonical hashing.

No npm release is created by this decision. Publication must include the
changed core, both provider adapters, model-runtime and facade with a
registry-safe dependency closure and an explicit Chat Completions migration
note. ACME-0191's separately paused release remains independent.

## Alternatives

- Automatic fallback after lowering/provider failure: rejected because it
  conceals changed guarantees and can duplicate paid work.
- A request-wide non-strict switch: rejected because unrelated tools must
  retain their chosen guarantees.
- Tool argument execution/repair in ACME: rejected because it moves caller
  policy across the ADR-0053/0055 boundary.
- Turning off structured final output: rejected; tool compatibility is an
  independent concern.

## References

- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [ADR-0015](0015-strict-structured-output-schema-lowering.md)
- [ADR-0053](0053-model-only-execution-runtime.md)
- [ADR-0054](0054-model-runtime-v2-multi-provider-routing.md)
- [ADR-0055](0055-public-npm-model-runtime-library.md)
- ACME-0192
