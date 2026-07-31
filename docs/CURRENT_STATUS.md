# Current Status

Last updated: 2026-07-31

## Repository

- Git repository initialized on `main`.
- Remote: `https://github.com/zackemannen81/acme-engine.git`.
- Docs-first foundation is present.
- A pnpm workspace and lockfile now provide the implementation substrate.
- Node `24.18.0` and pnpm `10.34.5` are pinned; all root development
  dependencies use exact versions.
- Strict ESM TypeScript, ESLint, Prettier, Vitest and dependency-cruiser are
  configured.
- `@acme/core` uses exact Zod `4.4.3` for public runtime schemas.
- Secret-free GitHub Actions CI mirrors documentation, formatting, lint,
  typecheck, boundary, test and build commands.
- Frozen task charters, parent/child tasks, paused tasks and backlog proposals
  are governed by `docs/TASK_WORKFLOW.md`.
- LF line endings are enforced through `.gitattributes`.

## Project Phase

The complete design and development specification is approved as the
implementation baseline:

- `docs/design/acme-design-and-development-spec.md`
- ADR-0001: TypeScript and pnpm workspace
- ADR-0002: Static task-typed module composition
- ADR-0003: SQLite revisioned Unit of Work
- ADR-0004: Deterministic transition identity
- ADR-0005: Pure memory decision application
- ADR-0006: Aggregate in-memory Unit of Work
- ADR-0007: Deterministic model mock and gateway conformance
- ADR-0008: Post-memory domain state projection
- ADR-0009: Reference-domain identity and provenance
- ADR-0010: Input-bound validation and interpretation
- ADR-0011: Narrative knowledge and context ownership
- ADR-0012: Milestone 1 execution identity and replay
- ADR-0013: Durable SQLite schema and driver

ACME has a build substrate, pure contract layer, pure StateEngine, pure
MemoryEngine, post-memory state projection, a deterministic in-memory Unit of
Work, a bounded single-task ExecutionEngine and a durable SQLite adapter.
There is currently:

- common JSON, identity, time, document and diagnostic contracts
- deterministic `acme-cjson-1` canonical JSON and SHA-256 hashing
- versioned `acme-model-request-hash-1` over the complete validated
  provider-neutral model request
- versioned deterministic execution ID, operation key, request fingerprint
  and model-response hash algorithms
- the structured ACME error taxonomy
- provider-neutral model, prompt-contract and gateway port types
- closed gateway-boundary validation for selections, requests, capabilities,
  required-capability matching, call contexts and normalized responses
- a strict response pipeline for empty/parse/schema/semantic validation
- input-bound response semantics with non-repairable input validation and
  detached deeply frozen contract input/output
- immutable contract and module registries with deterministic ordering and
  contract fingerprints
- task-typed module authoring plus state/memory envelope and policy types
- typed task-owned post-memory state projection with exact
  candidate/decision correlation, applied-decision filtering and immutable
  replay-stable projection input
- frozen reference-domain v1 identity/evidence contracts: canonical-state
  Narrative alias authority and correction checks plus explicit Research
  proposition, source, independence and retained-evidence keys
- a pure StateEngine that validates current state and typed deltas, enforces
  expected revisions, invokes module initialization/reduction/invariants and
  prepares immutable snapshot/transition candidates without persistence
- versioned deterministic transition identity `acme-transition-id-1`, derived
  from execution/operation/module/entity identity without consuming
  `IdGenerator`
- a pure MemoryEngine that validates candidates and loaded records, executes
  domain-owned resolution against a deterministic evolving working set and
  prepares immutable create/update mutations with expected record versions
- deterministic memory retrieval with validated policy results, stable
  score/identity/ID ordering and enforced limits
- explicit lifecycle preparation for retain, strength-update and forget
  decisions without background wall-clock behavior
- one aggregate `ExecutionRepository` contract with execution, attempt,
  model-call, context, prepared commit and terminal evidence types
- portable replay evidence containing the exact validated task input,
  immutable recorded read set and prepared commit
- versioned `acme-operation-digest-1` with canonical ordering rules
- a deterministic `@acme/adapter-memory` that implements request idempotency,
  ledger/model-call evidence, state/memory/document reads and immutable
  copy-on-commit transactions
- atomic promotion of candidate/evaluator evidence, documents, memory
  mutations, optional state, events/outbox and terminal execution results
- state-head and memory-record compare-and-swap with explicit conflict codes
- identical commit replay without new writes or IDs, with divergent identity
  reuse rejected as persistence corruption
- a reusable non-empty repository conformance suite in `@acme/testing` that the
  in-memory and SQLite adapters both pass unchanged
- a durable `@acme/adapter-sqlite` in WAL mode with enforced foreign keys,
  ordered checksum-verified migrations that refuse a tampered or unknown
  recorded version, and the ADR-0003 `BEGIN IMMEDIATE` Unit of Work
- durable crash recovery proven by reopening a committed database in a new
  connection with identical replay evidence, identical operation digest, no
  new model call and no new ID allocation
- durable and in-memory repository evidence proven equal for the same neutral
  execution
- a deterministic `@acme/adapter-model-mock` with immutable exact-selection
  profiles, finite exact-call scripts and no provider, network, environment,
  filesystem, clock or random dependency
- exact `(executionId, callKey)`, selection and request-hash matching with
  single consumption, scripted response/error outcomes and immutable
  invocation/unconsumed-call evidence
- a reusable non-empty provider-neutral `ModelGateway` conformance suite in
  `@acme/testing`
- a reusable non-empty public-core-only `DomainModule` conformance suite in
  `@acme/testing`, proven unchanged against testing-owned producer and empty
  analyzer fixtures
- `@acme/module-research` with strict v1 schemas, deterministic
  `research.observe-evidence@1.0.0`, ADR-0009 proposition/source/independence
  identity, corroboration and contradiction policy, a pure reducer with
  invariants and post-memory verification derived only from applied decisions
- Research-owned execution of the unchanged shared DomainModule conformance
  suite, proving core stays domain-neutral across two reference domains
- `@acme/module-narrative` with strict v1 schemas, deterministic
  `narrative.observe-document@1.0.0`, pure state/reducer/invariants and a
  domain-owned memory policy
- ADR-0011-compliant `narrative-window-1` and source-backed
  `previous-document-tail-1`, including golden request, entity and context
  fixtures
- Narrative-owned execution of the unchanged shared DomainModule conformance
  suite plus compile-time task inference checks
- a domain-neutral `ExecutionEngine` that resolves static registrations,
  accepts one request idempotently, performs one primary call, coordinates
  response validation, memory, post-memory state projection and state
  preparation, and commits atomically
- deterministic memory retrieval capped at 50 records and a replay verifier
  that uses only recorded evidence and reports `match`, `different` or
  `unavailable`
- a non-empty neutral integration suite and the fixed Narrative Phase 5
  offline scenario, including repeat-without-effects and replay-without-clock,
  gateway or ID allocation
- a typed `@acme/cli` composition-root skeleton
- automated dependency rules, a core vocabulary guard and negative core,
  module, cross-module and SQLite-driver boundary fixtures
- 239 passing tests across canonicalization, execution identity, model-request
  hashing, response/gateway validation, registries, state/memory preparation,
  post-memory state projection, repository digest, repository/gateway
  plus neutral and Narrative module conformance, Narrative schemas, context,
  identity, policy and state behavior, mock matching, immutability, atomic
  rollback, SQLite migrations, Research identity, schemas, policy, state,
  contract and task behavior, and workspace imports
- compile-time task-name/input/output, state-projection and conformance-subject
  inference checks
- non-empty passing repository, gateway and module conformance, integration
  and scenario gates
- no live model provider adapter
- no published package
- no deployment

## Approved Direction

`docs/PROJECT_BRIEF.md` is the active project direction. Core must be
domain-neutral and proven with NarrativeModule and ResearchModule.

## Active Work

ACME-0015 completed the final shared pre-reference-module gate. The exported
`domainModuleConformance()` suite now verifies the public module boundary,
runtime schemas, deterministic immutable task/state behavior, unique effects
and caller-supplied memory-policy expectations. It runs unchanged against
testing-owned producer and empty-analyzer fixtures, and future module source
is prevented from importing apps, concrete adapters or `@acme/testing`.
Narrative and Research implementation remain separate tasks.

ACME-0014 added the proposed
[`Domain Test UI — Specification`](design/domain-test-ui-specification.md) as
documentation only. It defines a human surface for configuring, executing,
inspecting, validating and measuring domain tests strictly over existing
ports, ledger evidence and reports. Nothing in it is implemented or chartered,
and its remaining readiness prerequisites do not exist yet.

ACME-0016 synchronized current-facing repository documentation with the
implemented workspace after ACME-0015. It corrected pre-implementation phase
claims and audited the canonical repository map without changing runtime
behavior or historical records.

ACME-0017 completed NarrativeModule build phases 1–4.
`@acme/module-narrative` now implements
`narrative.observe-document@1.0.0`, strict schemas, deterministic projection
and interpretation, post-memory state projection, pure state behavior and the
Narrative memory policy. ADR-0011's exclusive memory/state ownership,
two-summary `narrative-window-1` and source-backed
`previous-document-tail-1` are executable and golden-tested.

ACME-0018 completed the bounded Milestone 1 ExecutionEngine and Narrative
Phase 5 on 2026-07-31. ADR-0012 fixes its default policy, retrieval limit,
identity algorithms and portable replay-evidence boundary. The implementation
coordinates exactly one primary call through the existing ports and pure
engines, commits atomically and verifies replay without external effects.

ACME-0021 completed durable SQLite persistence on 2026-07-31.
`@acme/adapter-sqlite` implements the aggregate `ExecutionRepository` over the
ADR-0003 revisioned Unit of Work and passes the unchanged shared conformance
suite. ADR-0013 fixes the `better-sqlite3` driver, the first ordered
checksum-verified migration and the exact points where the persisted schema
extends specification section 15.2. Durability is proven by reopening a
committed database in a fresh connection: the recovered evidence, operation
digest and terminal result are identical, and repeating the same request
returns the recorded result without a new model call or ID allocation.

ACME-0022 completed ResearchModule build phases 1–4 on 2026-07-31.
`@acme/module-research` implements `research.observe-evidence@1.0.0` and is the
second reference domain, so the shared conformance suite, memory mechanics,
state mechanics and post-memory projection are now proven against two
independent domains. ADR-0009's proposition, source and source-independence
identity algorithms are executable and reproduce their published golden
vectors. Corroboration counts distinct declared independence keys only;
contradictory evidence contests the claim and preserves every variant. Claim
verification is derived post-memory from applied decisions and is never
asserted by the model.

## Persistent Gaps

- A live provider adapter and provider-specific normalization are not
  implemented.
- The Research offline acceptance scenario (build-plan phase 5) is not
  implemented; only NarrativeModule has an executable acceptance scenario.
- Fault injection at every transaction boundary is Milestone 2 work; durability
  is proven by clean reopen, not by simulated mid-transaction failure.
- Outbox delivery, background workers and retention encryption are not
  implemented; the outbox is written atomically but never drained.
- No composition root selects the durable adapter. `@acme/cli` has no
  `--adapter sqlite` flag, so SQLite is currently reachable only from tests.
- Package boundary enforcement covers core, testing, the in-memory, model-mock
  and SQLite adapters, CLI substrate and the future `packages/module-*`
  dependency direction; future adapters must extend its rule set.
- `better-sqlite3` prebuild resolution is verified on Windows only. The Linux
  CI matrix has not been observed since the dependency was added.
- ScenarioRunner and a general evaluation harness are not implemented; the
  single fixed Narrative acceptance scenario is test-owned.
- No human surface exists for configuring or inspecting domain tests. The
  proposed interface is specification-only; ScenarioRunner, durable
  persistence and its unresolved decision gates still block activation, whose
  proposal remains in `docs/backlog/`.
- Live provider call reconciliation, encrypted retention and privacy deletion
  intentionally require future ADRs before implementation.
