# acme-engine

Provider-neutral model execution runtime for embedding ACME directly in Node applications.

## Install

```bash
npm install acme-engine
```

## Use

```ts
import { createAcmeModelRuntime } from 'acme-engine';
```

`acme-engine` is the convenience facade for the supported in-process
`@acme-engine/model-runtime` package. It does not own application cognition,
memory, prompts, tool policy, or model-selection strategy.

Current release: 0.1.5.

Release lineage after the repaired registry baseline:

- 0.1.1 is the first installable registry release of the importable library API.
- 0.1.2 preserves explicit non-stream execution intent.
- 0.1.3 preserves explicit transport timeouts after response start.
- 0.1.4 adds profile-selected Chat Completions output-token wire naming.
- 0.1.5 adds native OpenAI Responses ordered user text/image input.

Version 0.1.0 was published with unresolved workspace protocol dependencies and must not be used.

## Per-tool strictness (unreleased source API)

`ModelFunctionTool` and `ModelRequest` are exported from `acme-engine` and
`@acme-engine/model-runtime`. The new option requires a future package release;
it is not present in the published 0.1.5 facade.

`strict` defaults to true per tool. To retain a caller-owned MCP-server default
while letting individual tools override it:

```ts
import type { ModelFunctionTool } from 'acme-engine';

// A008 owns these settings; resolve them before calling runtime.execute().
const mcpServerDefault: boolean = false;
const toolOverride: boolean | undefined = undefined;
const tool: ModelFunctionTool = {
  type: 'function',
  name: 'search',
  strict: toolOverride ?? mcpServerDefault ?? true,
  parameters: {
    type: 'object',
    properties: { query: { type: 'string' } },
    additionalProperties: true,
  },
};
// Include tool in request.tools. Other tools retain their own strict defaults.
```

OpenAI Responses uses strict lowering only for strict tools. Explicit false
sends the original schema unchanged, without a schema-adherence guarantee.
Structured JSON final output remains strict. Chat Completions sends the same
boolean under `function.strict`; this changes its earlier omitted-field
behavior. Its schemas still pass through unchanged, so callers must supply
schemas supported by the selected provider. Unsupported requests fail visibly;
ACME never retries them in a weaker mode.

Inspect `result.diagnostic.toolModes` for the effective requested boolean by
zero-based tool index. Explicit settings participate in request identity;
changing them requires a new request key. No tool names or arguments appear
in this diagnostic.

Before executing any complete tool call, validate its arguments locally against
the original schema, **in both modes**. Do not execute streamed argument fragments.
ACME only parses JSON and returns untrusted candidates; it does not execute
tools, validate arguments against their schemas or retry for correction.
A008 may return validation errors as a tool result and make another prepared
request with a new key, subject to its own explicit correction-attempt limit.
The HTTP v1/v2 protocols do not accept this new embedded-only field.
