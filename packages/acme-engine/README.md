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
