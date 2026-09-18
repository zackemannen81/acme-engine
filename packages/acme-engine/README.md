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

Version 0.1.0 intentionally replaces the experimental 0.0.1 CLI-only package
role with an importable library API.
