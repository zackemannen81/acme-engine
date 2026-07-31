# System Documentation

Last updated: 2026-07-31
Status: Approved architecture with a bounded single-task ExecutionEngine, pure engines, NarrativeModule and ResearchModule, replay verification, shared conformance, in-memory and durable SQLite Units of Work, model mock, an offline OpenAI Responses mapping, a ScenarioRunner, a CLI composition root and a proposed domain-test surface

This document describes long-lived system boundaries. It does not claim that
multi-step orchestration or live provider behavior exists.
Exact contracts, storage schema, protocols and milestones are defined in
[`docs/design/acme-design-and-development-spec.md`](design/acme-design-and-development-spec.md).

## Implemented Substrate

- pnpm workspace pinned to Node `24.18.0` and pnpm `10.34.5`
- strict ESM TypeScript project references
- `@acme/core` contract package, `@acme/adapter-memory`,
  `@acme/adapter-sqlite`, `@acme/adapter-model-mock`,
  `@acme/adapter-model-openai`, `@acme/module-narrative`,
  `@acme/module-research`, reusable
  repository/gateway/module conformance support in `@acme/testing` and the
  `@acme/cli` composition root
- workspace import test from `@acme/testing` to `@acme/core`
- dependency-cruiser package-boundary enforcement
- source vocabulary guard for `packages/core/src`
- negative fixtures proving forbidden core-to-app, module-to-adapter,
  module-to-module, core-to-provider-wire and core-to-SQLite-driver
  dependencies fail
- secret-free CI gates for documentation, formatting, lint, typecheck,
  boundaries, tests and builds

This substrate implements bounded single-task execution, durable local
persistence, two offline acceptance scenarios and declarative multi-step
scenarios. It does not implement live provider behavior.

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
- task interpretation receives the exact schema-validated immutable task
  input retained by ExecutionEngine
- exact memory-candidate/decision correlation and filtered immutable
  state-projection input containing only applied decisions
- state and memory envelopes/policy declarations required by module contracts
- execution request/policy/result, evaluation evidence and aggregate
  `ExecutionRepository` contracts
- versioned execution ID, operation key, request fingerprint, deterministic
  retrieval and model-response hash algorithms
- portable immutable replay read-set and prepared-commit evidence
- versioned `acme-operation-digest-1` prepared-commit hashing

Two reference domains now exercise this contract layer.

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

The ExecutionEngine validates, detaches, freezes and retains task input before
reusing the exact value for projection, interpretation and replay evidence.

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
and documented golden vectors. Narrative entity identity is implemented by
`@acme/module-narrative`; the three Research identifiers are implemented by
`@acme/module-research`. Every published golden vector is asserted by test.

## Approved Narrative Knowledge and Context Ownership

ADR-0011 fixes the pre-implementation Narrative v1 ownership and short-range
context boundary:

- memory is the sole canonical owner of character facts, relationships, world
  rules, contradictions and evidence
- state owns the entity/display-name registry, canonical aliases, current
  scene, fixed narrative window and outline progress
- state characters contain no fact attributes, and v1 state contains no
  relationship/world-rule values or memory-ID cache
- `narrative-window-1` retains at most two summaries ordered oldest to newest
- `previous-document-tail-1` deterministically derives the last at most two
  sentences and 320 Unicode code points from the previous immutable source
  document, with key/hash provenance and no summary fallback

The previous tail is projected contract context, not state or memory.
`@acme/module-narrative` implements these contracts with strict schemas,
deterministic derivation and golden fixtures.

## Implemented NarrativeModule

`@acme/module-narrative` implements the bounded module-level phases 1–4:

- strict task, contract, source, memory, state and delta schemas
- immutable `narrative.observe-document@1.0.0` request construction and
  input-bound semantic validation
- deterministic projection of stable state context, two summaries, exact
  previous-document tail and relevant memory
- interpretation into one source document, character-fact, relationship and
  world-rule candidates, direct scene/window/outline intent and diagnostics
- pure post-memory entity/alias projection that accepts only applied memory
  decisions
- pure state initialization, reduction and invariants
- domain-owned memory validation, identity, retrieval, resolution and
  lifecycle behavior, including evidence-backed supersession

The module runs the unchanged shared DomainModule conformance suite and
contains no concrete adapter, provider, database, app or testing-support
dependency. It does not invoke a model, write a repository or claim the Phase
5 acceptance scenario; those remain ExecutionEngine responsibilities.

## Implemented ResearchModule

`@acme/module-research` implements the bounded module-level phases 1–4 and is
the second reference domain:

- strict evidence-input, contract-input/output, source, claim, question, state
  and delta schemas, including absolute credential-free source URIs and
  canonical UTC retrieval timestamps
- ADR-0009 `research-source-key-1`, `research-source-independence-key-1` and
  `research-proposition-key-1`, each reproducing its published golden vector
- immutable `research.observe-evidence@1.0.0` request construction with the
  verification threshold and identity-policy version as fixed configuration
  facts, never model-supplied
- input-bound semantic validation rejecting quotes absent from the supplied
  evidence, locators without that source, and duplicate claims or questions
- interpretation into one evidence document plus source, claim and question
  candidates, each claim retaining complete domain evidence alongside generic
  core provenance
- a memory policy where corroboration counts distinct declared independence
  keys only, duplicate evidence from one authority stays auditable without
  raising the count, and contradictory evidence contests the claim instead of
  overwriting the earlier position
- pure post-memory projection that derives verify, contest and defer decisions
  from applied decisions and prior records, never from model output
- pure state initialization, reduction and invariants that reject dual status,
  sub-threshold verification and evidence-free claims

Supporting and contradicting evidence share one proposition identity, so a
contradiction contests the same claim rather than creating a rival record. The
module runs the unchanged shared DomainModule conformance suite. It does not
invoke a model or write a repository itself; the ExecutionEngine does that in
the Research phase 5 acceptance scenario.

The scenario drives three hand-written offline sources through the engine and
proves the standing sequence the domain exists to produce:

- one source retains a deferred claim and cannot verify it, whatever
  confidence the model reported
- a second source with a distinct declared independence key promotes the claim
  to verified with an independent-source count of two
- a contradicting third source contests the claim, preserves every variant and
  leaves the earlier record contested rather than overwritten
- a stale expected revision performs no model call, allocates no ID and writes
  nothing
- every committed execution replay-verifies offline with an unchanged
  operation digest, no gateway call and no clock read

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

The identical suite passes for testing-owned producer, empty-analyzer and
Narrative-owned fixtures. Research must run it with its own fixtures; domain
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

This pure boundary itself adds no persistence or orchestration behavior. The
ExecutionEngine runs it after interpretation and MemoryEngine preparation,
then passes its output to StateEngine before one aggregate commit. Milestone 1
records an empty evaluator list because evaluator execution remains deferred.

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
- atomic retention of the exact prepared commit and portable replay sidecar
- response-payload retention according to the stored execution policy while
  preserving response-hash evidence
- detached immutable `loadReplayEvidence()` projections for verification
- detached, deeply frozen read results and deterministic evidence snapshots

The adapter is deterministic test persistence only. It does not survive
process termination and makes no crash-durability claim. The same core port is
covered by a reusable non-empty conformance suite in `@acme/testing`.

## Implemented ScenarioRunner

`AGENTS.md` fixes the boundary: the ExecutionEngine runs one task and
multi-step flows belong to a separate runner. `@acme/testing` implements that
runner over the `acme-scenario/1` format named in specification section 18.1.

- `execute`, `assert`, `replay` and `assertDigest` steps run serially, with
  later steps naming an earlier execution by alias
- a run halts at the first failed assertion and reports every step already
  run, because later steps depend on earlier state and a cascade of derived
  failures hides the first real one
- the report is a versioned `acme-scenario-report/1` document
- there is no branching, retry, loop, include or way to run arbitrary code; a
  scenario is data, not a program
- the runner never reads a file and never imports a concrete adapter. The
  caller injects the fixture loader and builds the composition, so
  `@acme/testing` keeps depending on `@acme/core` alone
- the composition is built from the scenario's own `seed`, so the declared
  clock and ID allocation are the ones the run uses

Because memory record IDs are part of the operation-digest preimage, a
scenario that pins a digest must also pin its ID scheme. Specification 18.1
names `ids: sequential` without defining what it emits, so the shape is fixed
here and `idPrefix` and `idPadding` make it expressible.

The Narrative Phase 5 acceptance scenario exists in both forms, hand-written
and declarative, and reaches the same operation digest through the same
engine. The agreement is only evidence while both expressions exist.

## Implemented Composition Root

`@acme/cli` is the only place in the workspace that selects a concrete
repository adapter. Everything else works through core ports.

- `scenario run` executes an `acme-scenario/1` file, owning YAML parsing,
  path resolution and the rule that a fixture path may not escape the
  scenario root
- `execute` runs one task through the bounded ExecutionEngine
- `execution replay --mode verify` reports the ADR-0012 verdict
- `execution inspect`, `state inspect` and `memory inspect` read recorded
  evidence
- `--adapter memory|sqlite` selects the repository; `--database` is required
  for SQLite and rejected for memory
- versioned JSON goes to stdout and diagnostics to stderr
- payloads are redacted unless `--show-payloads` is supplied
- exit codes separate success, a terminal outcome that did not commit or
  verify, and a usage error

The gateway is limited to the deterministic mock, because no network
transport exists. Commands that cannot work are absent rather than present and
failing: there is no `execution resume` without resume behavior.

## Implemented Provider Boundary

ADR-0014 fixes how ACME reaches a real provider. `@acme/adapter-model-openai`
implements `ModelGateway` against the OpenAI Responses API and depends on a
transport port that carries only an opaque request and result. The transport
never parses a body, never classifies a failure and never sees an ACME type.

- request mapping turns system messages into instructions and preserves the
  supplied order, so the stable part of a call stays ahead of the changing part
- content the adapter cannot honor is rejected rather than silently dropped,
  including stop sequences and non-text parts
- classification asks first whether the provider responded at all: a received
  status line is never ambiguous and maps through a fixed table, while a
  missing status line is ambiguous unless the transport proves non-delivery
- `capabilities()` resolves from static configuration and never probes
- credentials are supplied by the composition root; the package reads no
  environment and ships no network transport

The adapter passes the unchanged shared `ModelGateway` conformance suite, so
the scripted mock and a real provider mapping satisfy one contract. Boundary
rules and a negative fixture prove provider wire shapes are unreachable from
core, modules, apps and other adapters, and the core vocabulary guard now
rejects provider names outright.

## Implemented Durable Unit of Work

`@acme/adapter-sqlite` implements the same aggregate `ExecutionRepository` over
a local SQLite database. ADR-0003 fixes its shape; ADR-0013 fixes its driver
and first migration.

- WAL journaling, enforced foreign keys and full synchronous writes
- ordered migrations whose checksum is `sha256` over the canonical migration
  source; a tampered checksum or an unknown recorded version refuses to open
  the database as `PERSISTENCE_CORRUPTION`
- one `BEGIN IMMEDIATE` transaction per mutating operation, so digest
  verification, compare-and-swap and every canonical write commit or roll back
  together
- the specification section 15.2 columns as the queryable, indexed and
  constraint-bearing projection, plus canonical `acme-cjson-1` columns where
  the core contract is richer than those columns can express
- an `execution_commits` row holding the operation digest, committed
  projection and exact prepared commit, including the ADR-0012 replay sidecar
- reads for `get()`, `loadContext()` and `loadReplayEvidence()` that return
  detached, deeply frozen values and open no transaction

Observable behavior is identical to `@acme/adapter-memory`. Both adapters run
the same unchanged conformance suite, and the same neutral execution produces
equal repository evidence in both. A committed database reopened in a new
connection returns identical replay evidence and the recorded terminal result
without a new model call or ID allocation. Fault injection at arbitrary
transaction boundaries remains Milestone 2 work.

## System Purpose

ACME coordinates typed, model-backed tasks while keeping model communication,
domain interpretation, memory mechanics, state transitions and persistence
separate.

## Core Responsibilities

### ExecutionEngine

- Accepts one validated typed task request and resolves static module,
  task and contract registrations before repository acceptance.
- Derives deterministic execution, request-fingerprint and operation
  identities using the algorithms fixed by ADR-0012.
- Loads the expected state revision, immutable context and at most 50
  deterministically ranked memory records.
- Runs one reserved primary model call through the provider-neutral gateway,
  records its request/response hashes and honors the frozen retention mode.
- Validates and interprets the response, then coordinates MemoryEngine,
  post-memory projection and StateEngine.
- Commits prepared evidence and canonical effects atomically through the
  aggregate repository.
- Replays committed evidence without a gateway, clock or ID generator and
  reports `match`, `different` or `unavailable`.

Its public Milestone 1 surface is `execute()` and `replayVerify()`. It does not
own domain vocabulary, multi-step workflow definitions, repair/revision calls,
resume/fork or caller cancellation.

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
in-memory and durable SQLite repositories can atomically promote those
prepared effects. Provider normalization remains a live-adapter
responsibility; the deterministic mock accepts only complete validated
normalized fixtures. The bounded ExecutionEngine orchestrates this path; live
normalization remains future work.

## Persistence Direction

- The in-memory adapter is implemented for deterministic tests.
- The SQLite adapter is implemented in WAL mode as the first durable local
  implementation.
- One aggregate repository owns the atomic Unit of Work.
- State uses complete snapshots, explicit transitions and revision
  compare-and-swap.
- Model responses are durably recorded before interpretation and canonical
  commit.
- Domain events and outbox rows commit together.
- No production database decision has been made.

## Domain Proof

- NarrativeModule — implemented, including its offline acceptance scenario
- ResearchModule — implemented, including its offline acceptance scenario

Both domains use the same core, the same shared conformance suite and the same
memory, state and post-memory projection mechanics, with no domain branch in
core. Both reach committed canonical state through the same ExecutionEngine and
replay offline with matching operation digests.

The team-facing construction and verification plans are:

- [`NarrativeModule — Build and Test Plan`](design/narrative-module-build-and-test-plan.md)
- [`ResearchModule — Build and Test Plan`](design/research-module-build-and-test-plan.md)

These guides translate the approved baseline into package layouts, component
ownership, ordered build phases, decision gates and layered test matrices.
Narrative and Research phases 1–5 are both implemented, each with its own
deterministic offline acceptance scenario.
Both use ADR-0008's post-memory state-projection boundary, require ADR-0009's
explicit domain identity/evidence contracts, follow the same core path and
forbid domain branches in core or concrete adapter dependencies in a module.
Narrative additionally follows ADR-0011's exclusive knowledge ownership and
fixed source-backed context policy.

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
- A network transport for the implemented provider mapping.
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
