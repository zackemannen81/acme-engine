# System Documentation

Last updated: 2026-07-29
Status: Approved architecture with pure state/memory engines and in-memory Unit of Work

This document describes long-lived system boundaries. It does not claim that
the runtime engines currently exist. Exact contracts, storage schema,
protocols and milestones are defined in
[`docs/design/acme-design-and-development-spec.md`](design/acme-design-and-development-spec.md).

## Implemented Substrate

- pnpm workspace pinned to Node `24.18.0` and pnpm `10.34.5`
- strict ESM TypeScript project references
- `@acme/core` contract package, `@acme/adapter-memory`, reusable repository
  conformance support in `@acme/testing` and the behavior-free `@acme/cli`
- workspace import test from `@acme/testing` to `@acme/core`
- dependency-cruiser package-boundary enforcement
- source vocabulary guard for `packages/core/src`
- negative fixture proving forbidden core-to-app dependencies fail
- secret-free CI gates for documentation, formatting, lint, typecheck,
  boundaries, tests and builds

This substrate does not implement execution orchestration, durable
persistence, scenarios or provider behavior.

## Implemented Contract Layer

`@acme/core` now implements:

- common JSON, identity, timestamp, document and diagnostic types
- canonical JSON algorithm `acme-cjson-1` and SHA-256 hashing
- the ACME error-code taxonomy and structured `AcmeError`
- provider-neutral model request/response and gateway port types
- versioned prompt-contract types backed by Zod runtime schemas
- a strict response pipeline with empty, parse, schema and semantic stages
- explicit warnings for the permitted BOM and Markdown JSON-fence cleanup
- rejection of schema coercion or other parsed-value transformations
- immutable contract and module registries with deterministic lists
- deterministic contract fingerprints
- task-typed module authoring and compile-time task input/output inference
- state and memory envelopes/policy declarations required by module contracts
- execution request/policy/result, evaluation evidence and aggregate
  `ExecutionRepository` contracts
- versioned `acme-operation-digest-1` prepared-commit hashing

ExecutionEngine, durable adapters and reference-domain behavior are not
implemented.

## Implemented StateEngine

`@acme/core` implements pure state preparation without store access:

- `StatePrepareContext` carries entity, execution, operation and time context;
  namespace remains module-owned
- revision zero initializes state through
  `module.initialState({ entityId, now })`
- existing snapshots, delta envelopes, reduced state and invariants are
  validated before a candidate can be returned
- stale expected revisions fail with `CONFLICT_STATE_REVISION`
- reducers receive detached, deeply frozen state and delta values
- missing deltas return `null` without invoking initialization, reduction or
  invariants
- accepted results produce immutable next-snapshot and transition candidates
  with canonical SHA-256 hashes and execution provenance
- transition IDs use the immutable `acme-transition-id-1` derivation from
  execution ID, operation key, module namespace and entity ID

The StateEngine does not persist candidates. The in-memory repository enforces
state-head compare-and-swap, transition/operation identity and atomic
promotion.

## Implemented MemoryEngine

`@acme/core` implements pure memory policy execution without store access:

- candidate and loaded-record envelopes are strictly validated at their trust
  boundaries
- candidates run by stable key against an immutable evolving working set
- the domain policy owns identity, resolution value, resulting strength,
  contradiction, relevance and lifecycle choices
- create, reinforce, merge, contest, supersede, reject and ignore decisions
  have explicit application semantics
- create/replacement records use the injected memory ID generator only after a
  complete decision validates
- new records start at version one; updates carry the exact expected prior
  version and increment once
- affected timestamps and deduplicated provenance append are core mechanics
- retrieval rejects foreign, modified, duplicate or non-finite policy results,
  then sorts by score, identity and memory ID before applying its limit
- lifecycle runs only at explicit hooks and prepares retain, strength-update or
  forget decisions

The MemoryEngine returns immutable decisions and mutations. The in-memory
repository retains candidate/decision evidence, enforces memory record-version
compare-and-swap and promotes mutations atomically.

## Implemented In-Memory Unit of Work

`@acme/adapter-memory` implements the aggregate `ExecutionRepository`:

- request-key/fingerprint acceptance, immutable execution lookup and terminal
  outcomes
- idempotent attempt and model-call evidence with divergent-key protection
- deterministic state, memory and document reads
- `acme-operation-digest-1` verification before commit
- private copy-on-commit staging with one final publication point
- state-head CAS even when no state delta exists
- snapshot/transition scope, revision, hash-chain and identity validation
- sequential memory mutation CAS using `CONFLICT_MEMORY_VERSION`
- document hash validation and late document/event ID allocation
- atomic candidate, evaluator, document, memory, state, event/outbox and
  terminal execution promotion
- identical committed retry without new writes or IDs; divergent retry as
  `PERSISTENCE_CORRUPTION`
- detached, deeply frozen read results and deterministic evidence snapshots

The adapter is deterministic test persistence only. It does not survive
process termination and makes no crash-durability claim. The same core port is
covered by a reusable non-empty conformance suite in `@acme/testing`.

## System Purpose

ACME coordinates typed, model-backed tasks while keeping model communication,
domain interpretation, memory mechanics, state transitions and persistence
separate.

## Core Responsibilities

### ExecutionEngine

- Accept one typed task request.
- Resolve the module and task definition.
- Load the expected state revision and relevant memory.
- Build and execute a model request when required.
- Validate and interpret the response.
- Coordinate memory and state processing.
- Commit results through persistence ports.
- Return a structured execution result.

It does not own domain vocabulary or multi-step workflow definitions.

### Contract System

- Version prompt/model interfaces.
- Runtime-validate contract input and output.
- Declare required model capabilities.
- Build provider-neutral requests.
- Perform technical and semantic validation.

Contracts do not write state or persistence.

### DomainModule

- Own task definitions and contract selection.
- Project domain context into contract input.
- Interpret validated contract output.
- Own domain memory policy.
- Own state reducer and invariants.

### MemoryEngine

- Manage generic candidate and record lifecycle.
- Preserve provenance and timestamps.
- Execute domain-provided comparison and lifecycle strategies.
- Retrieve records through ports.

It does not define what a relationship, claim or comfort anchor means.

### StateEngine

- Check expected revision.
- Validate a typed domain delta.
- Apply the domain reducer immutably.
- Run domain invariants.
- Produce the next versioned snapshot and transition provenance.

It is not a universal unvalidated JSON Patch engine.

### Persistence and Ledger

- Persist executions and model calls.
- Persist documents, memory and versioned state.
- Make commit idempotent.
- Detect stale state revisions.
- Support replay after partial failure.
- Publish committed events through an outbox boundary.

## State Ownership

Core uses a generic state envelope:

```ts
interface StateSnapshot<TState> {
  entityId: string;
  namespace: string;
  schemaVersion: string;
  revision: number;
  value: TState;
  valueHash: string;
  createdAt: string;
  executionId: string;
}
```

Each domain owns and validates its `TState`.

## Trust Boundary

```text
Raw provider response
  → technical normalization
  → parsing
  → runtime schema validation
  → semantic validation
  → ContractOutput
  → DomainModule interpretation
  → ModuleResult candidates
  → domain policies and invariants
  → committed memory/state/events
```

No earlier stage is canonical truth.

The implemented trust path begins with an already normalized model response
and can produce validated contract output plus a deterministic parsed hash.
Separately, the StateEngine accepts an interpreted typed delta and prepares a
validated next-state candidate. The MemoryEngine accepts interpreted memory
candidates and prepares validated record decisions/mutations. The in-memory
repository can atomically promote those prepared effects. Provider
normalization, module interpretation and durable persistence remain future
work.

## Initial Persistence Direction

- The in-memory adapter is implemented for deterministic tests.
- SQLite in WAL mode for the first durable local implementation.
- One aggregate repository owns the atomic Unit of Work.
- State uses complete snapshots, explicit transitions and revision
  compare-and-swap.
- Model responses are durably recorded before interpretation and canonical
  commit.
- Domain events and outbox rows commit together.
- No production database decision has been made.

## Initial Domain Proof

- NarrativeModule
- ResearchModule

Core is not accepted as domain-neutral until both use it without domain
branches in core.

## Remaining Implementation Baseline

- Node.js 24 LTS, pnpm 10, strict ESM TypeScript 6 and Zod 4.
- SQLite persistence and a deterministic model mock.
- Core, testing, in-memory, SQLite, model adapters and reference modules are
  separate workspace packages.
- `ExecutionEngine` executes one task; `ScenarioRunner` sequences tasks.
- Retry, repair and revision are bounded and ledgered.
- Replay uses recorded model results and never invokes a live provider.
- Structured logs redact content by default.

## Deliberately Deferred Decisions

- production hosting and production database
- dynamic module discovery
- workflow runtime beyond ScenarioRunner
- vector retrieval
- provider-specific reconciliation details
- encryption key lifecycle and privacy deletion

These require evidence and ADRs before implementation.
