# ADR 0056 — Public acme-engine facade package

Status: Accepted
Date: 2026-09-18
Decision owner: Rickard Zakrisson

## Context

ADR 0055 established `@acme-engine/model-runtime` and its scoped public dependency closure for in-process consumers while keeping the ACME workspace root private. Separately, npm already contains `acme-engine@0.0.1`, a CLI-only bundled sidecar package with no importable library exports.

A008 now intends to embed ACME in-process. The owner wants the simple public dependency name `acme-engine` rather than requiring consumers to know the internal scoped package topology.

## Decision

### 1. Add a public facade package

A new workspace package at `packages/acme-engine` owns npm package name `acme-engine`.

It is a thin facade only: it re-exports the supported public API of `@acme-engine/model-runtime` and contains no duplicate execution implementation.

### 2. Version 0.1.0 replaces the old package role

`acme-engine@0.1.0` is an importable ESM library with generated TypeScript declarations.

The previous `acme-engine@0.0.1` bundled sidecar binary is not a compatibility contract for 0.1.0. The private CLI/service composition remains available from the repository, but the npm package name now denotes the in-process library facade.

### 3. Workspace root remains private

The repository root keeps `private: true` and is never published. The facade is a separate workspace package even though both have the same package name in different package manifests.

### 4. Scoped packages remain the implementation boundary

`@acme-engine/model-runtime` and its existing public dependency closure remain the versioned implementation packages. The facade depends on the model-runtime package and exposes its API; it does not collapse or duplicate those package boundaries.

### 5. Publication follows packed-consumer proof

Before publishing 0.1.0, pack and inspect the facade plus public closure and install them into a clean consumer outside the workspace. The consumer must import and construct the model runtime using only packed artifacts.

## Consequences

Consumers may use:

```ts
import { createAcmeModelRuntime } from "acme-engine";
```

Advanced consumers may still depend directly on `@acme-engine/model-runtime`.

The package-name transition is intentionally breaking relative to experimental 0.0.1 CLI behavior.
