# System Documentation

Last updated: 2026-07-30
Status: Approved architecture with pure engines, post-memory projection, reference identity contracts, shared module conformance, in-memory Unit of Work, model mock and a proposed domain-test surface

This document describes long-lived system boundaries. It does not claim that
end-to-end execution orchestration or durable runtime persistence exists.
Exact contracts, storage schema, protocols and milestones are defined in
[`docs/design/acme-design-and-development-spec.md`](design/acme-design-and-development-spec.md).

## Implemented Substrate

- pnpm workspace pinned to Node `24.18.0` and pnpm `10.34.5`
- strict ESM TypeScript project references
- `@acme/core` contract package, `@acme/adapter-memory`,
  `@acme/adapter-model-mock`, reusable repository/gateway conformance support
  in `@acme/testing` and the behavior-free `@acme/cli`
- workspace import test from `@acme/testing` to `@acme/core`
- dependency-cruiser package-boundary enforcement
- source vocabulary guard for `packages/core/src`
- negative fixture proving forbidden core-to-app dependencies fail
- secret-free CI gates for documentation, formatting, lint, typecheck,
  boundaries, tests and builds

This substrate does not implement execution orchestration, durable
persistence, scenarios or live provider behavior.

## Implemented Contract Layer

`@acme/core` now implements:

- common JSON, identity, timestamp, document and diagnostic types
- canonical JSON algorithm `acme-cjson-1` and SHA-256 hashing
- immutable `acme-model-request-hash-1` over a complete validated request
- the ACME error-code taxonomy and structured `AcmeError`
- provider-neutral model request/response and gateway port types
- closed model selection/request/capability/context/response validation and
  required-capability semantics
- versioned prompt-contract types backed by Zod runtime schemas
- a strict response pipeline with empty, parse, schema and semantic stages
- input schema validation before response inspection plus detached deeply
  frozen contract input/output for input-bound semantic checks
- explicit warnings for the permitted BOM and Markdown JSON-fence cleanup
- rejection of schema coercion or other parsed-value transformations
- immutable contract and module registries with deterministic lists
- deterministic contract fingerprints
- task-typed module authoring and compile-time task input/output/projection
  inference
- explicit interpreted state intent plus required task-owned
  `projectState()` hooks
- task interpretation explicitly receives the original typed task input;
  future orchestration must pass the schema-validated immutable value
- exact memory-candidate/decision correlation and filtered immutable
  state-projection input containing only applied decisions
- state and memory envelopes/policy declarations required by module contracts
- execution request/policy/result, evaluation evidence and aggregate
  `ExecutionRepository` contracts
- versioned `acme-operation-digest-1` prepared-commit hashing

ExecutionEngine, durable adapters and reference-domain behavior are not
implemented.

## Implemented Input-Bound Contract Surface

ADR-0010 closes the public contract gap discovered by ACME-0012:

- `ResponsePipeline.process(response, contract, input)` validates contract
  input before reading response text
- invalid, non-JSON or schema-transforming input fails non-repairably at
  `input`
- semantic validation receives detached deeply frozen validated output and
  contract input
- `TaskDefinition.interpret(output, input, context)` binds original typed task
  input to domain interpretation and preserves task inference

The future ExecutionEngine must validate, detach, freeze and retain task input
before reusing it for projection and interpretation. That orchestration is not
implemented by ACME-0013.

## Approved Reference-Domain Identity and Evidence

ADR-0009 fixes the pre-implementation v1 identity/provenance boundary without
adding domain vocabulary to core:

- canonical `NarrativeState.entityAliases` is the only alias authority
- `narrative-entity-key-1` deterministically derives unknown entity keys
- Narrative character-fact supersession requires a matching target identity,
  exact prior value and exact document quote validated during interpretation
- `research-proposition-key-1` identifies the contract's canonical
  proposition while explicit polarity distinguishes supporting and
  contradicting evidence
- `research-source-key-1` identifies a normalized URI, separately from
  `research-source-independence-key-1`, which records the caller's declared
  authority/basis assertion
- Research claim memory values retain URI, publisher, retrieval time,
  document key, locator, quote and both source keys; generic core provenance
  continues to retain execution, contract, model-call and document links
- verified/contested Research state references stable memory IDs rather than
  duplicating complete evidence

All four identifiers use `acme-cjson-1`, SHA-256, immutable algorithm names
and documented golden vectors. They are module contracts, not implemented
reference-module behavior.

## Implemented DomainModule Conformance

`@acme/testing` exports a reusable `domainModuleConformance()` suite over
public `@acme/core` contracts:

- strongly typed task selection retains task input, contract output, state and
  delta inference
- module, task, schema-version and registry identities are checked
- supplied valid/invalid input, state and delta fixtures exercise runtime
  schemas
- `project()`, `interpret()` and `projectState()` must be deterministic,
  detached and deeply frozen
- initialization, reduction and invariants must be deterministic and
  mutation-resistant
- document, memory-candidate and event keys must be non-empty and unique
- caller-supplied validation, identity, retrieval, resolution and lifecycle
  outcomes exercise the memory-policy boundary without genericizing domain
  meaning
- analyzer tasks may return an explicit empty result

The identical suite passes for testing-owned producer and empty-analyzer
fixtures. Narrative and Research must run it with their own fixtures; their
identity, contradiction, merge, promotion and invariant semantics remain
module-owned unit-test concerns. A dependency rule rejects future
`packages/module-*` imports of apps, concrete adapters or `@acme/testing`.

## Implemented Post-Memory State Projection

`@acme/core` now defines the bridge between pure memory resolution and pure
state preparation:

- `ModuleResult.stateIntent` is typed interpreted intent rather than a
  pre-memory final delta
- every task owns a synchronous pure `projectState()` hook
- `buildStateProjectionInput()` requires an exact one-to-one candidate and
  prepared-decision key set
- applied create, reinforce, merge, contest and supersede decisions retain
  their correlated candidates, identities and affected memory IDs
- ignore and reject-candidate remain repository audit evidence but are absent
  from memory-derived projection input
- prepared decision order is preserved and returned input is canonical-JSON
  cloned, detached and deeply frozen
- projected deltas remain untrusted until StateEngine schema, reducer and
  invariant validation succeeds

This boundary adds no persistence or orchestration behavior. The future
ExecutionEngine must run it after evaluators allow the interpreted result and
MemoryEngine prepares decisions, then pass its output to StateEngine before
one aggregate commit.

## Implemented Deterministic Model Mock

`@acme/adapter-model-mock` implements the provider-neutral `ModelGateway` for
offline execution:

- exact immutable `ModelSelection` profiles declare capabilities
- the full profile/call script validates before use
- calls are uniquely addressed by `(executionId, callKey)` and additionally
  require exact selection plus `acme-model-request-hash-1`
- pre-aborted and unsupported-capability calls do not consume scripts
- matching normalized successes and structured `TIMEOUT`/`MODEL_*` failures
  consume once without semantic rewriting
- unexpected, mismatched, repeated and unconsumed calls are deterministic
  non-retryable test-harness failures
- response timestamps, usage, metadata and provider identity are script data;
  no fallback values are generated
- inputs, outputs and invocation inspection are detached and deeply frozen
- runtime source has no provider SDK, network, environment, filesystem, clock
  or random dependency

`@acme/testing` supplies a reusable gateway conformance kit covering
capability discovery, required-capability rejection, pre-call cancellation,
normalized success, structured failure and immutability only through the core
port. Mock-specific invocation evidence remains outside `ModelGateway`.

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
  → ModuleResult candidates and state intent
  → MemoryEngine decisions
  → filtered task-owned state projection
  → StateEngine reducer and invariants
  → committed memory/state/events
```

No earlier stage is canonical truth.

The implemented trust path begins with an already normalized model response
and can produce validated contract output plus a deterministic parsed hash.
The MemoryEngine accepts interpreted memory candidates and prepares validated
record decisions/mutations. The implemented projection builder correlates
those decisions with candidates, excludes ignored/rejected resolutions and
hands immutable applied evidence to the task-owned hook. StateEngine accepts
the resulting typed delta and prepares a validated next-state candidate. The
in-memory repository can atomically promote those prepared effects. Provider
normalization remains a live-adapter responsibility; the deterministic mock
accepts only complete validated normalized fixtures. Execution orchestration,
module interpretation implementations and durable persistence remain future
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

The team-facing construction and verification plans are:

- [`NarrativeModule — Build and Test Plan`](design/narrative-module-build-and-test-plan.md)
- [`ResearchModule — Build and Test Plan`](design/research-module-build-and-test-plan.md)

These guides translate the approved baseline into proposed package layouts,
component ownership, ordered build phases, decision gates and layered test
matrices. They are implementation guidance, not evidence that either module
exists. Both now use ADR-0008's post-memory state-projection boundary, require
ADR-0009's explicit domain identity/evidence contracts, follow the same core
path and forbid domain branches in core or concrete adapter dependencies in a
module.

## Proposed Domain Test Surface

[`Domain Test UI — Specification`](design/domain-test-ui-specification.md)
describes a proposed human surface for configuring, executing, inspecting,
validating and measuring domain tests. It is a reviewed specification only. No
interface, package or view contract exists, and no implementation is
chartered.

The specification constrains any future implementation to the existing
boundaries:

- the interface is a composition-root application under `apps/`, subject to the
  approved `apps → adapters → core` and `apps → modules → core` direction
- it reads execution, attempt, model-call, read-set, prepared-commit and
  terminal evidence through the aggregate `ExecutionRepository` port, plus
  engine and runner reports
- it launches runs and stores its own disposable artifacts, but never commits,
  marks terminal, mutates canonical records or computes a verdict itself
- it compiles configuration into the approved `acme-scenario/1` format and
  `ExecutionRequest` rather than becoming a second source of truth
- it enforces the section 21 data classes, retention modes and environment
  gating at the presentation boundary, and exposes no scripting, shell,
  credential or destructive surface

Its unresolved decisions, including whether the interface belongs in version 1
at all, remain decision gates inside the specification.

## Remaining Implementation Baseline

- Node.js 24 LTS, pnpm 10, strict ESM TypeScript 6 and Zod 4.
- SQLite persistence and a future live model adapter.
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
