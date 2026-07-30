# Current Status

Last updated: 2026-07-30

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

ACME has a build substrate, pure contract layer, pure StateEngine, pure
MemoryEngine, post-memory state projection and deterministic in-memory Unit of
Work, but no execution orchestration or durable persistence. There is
currently:

- common JSON, identity, time, document and diagnostic contracts
- deterministic `acme-cjson-1` canonical JSON and SHA-256 hashing
- versioned `acme-model-request-hash-1` over the complete validated
  provider-neutral model request
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
- versioned `acme-operation-digest-1` with canonical ordering rules
- a deterministic `@acme/adapter-memory` that implements request idempotency,
  ledger/model-call evidence, state/memory/document reads and immutable
  copy-on-commit transactions
- atomic promotion of candidate/evaluator evidence, documents, memory
  mutations, optional state, events/outbox and terminal execution results
- state-head and memory-record compare-and-swap with explicit conflict codes
- identical commit replay without new writes or IDs, with divergent identity
  reuse rejected as persistence corruption
- a reusable non-empty repository conformance suite in `@acme/testing`
- a deterministic `@acme/adapter-model-mock` with immutable exact-selection
  profiles, finite exact-call scripts and no provider, network, environment,
  filesystem, clock or random dependency
- exact `(executionId, callKey)`, selection and request-hash matching with
  single consumption, scripted response/error outcomes and immutable
  invocation/unconsumed-call evidence
- a reusable non-empty provider-neutral `ModelGateway` conformance suite in
  `@acme/testing`
- a typed `@acme/cli` composition-root skeleton
- an automated dependency rule, core vocabulary guard and negative boundary
  fixture
- 95 passing unit/conformance tests across canonicalization, model-request
  hashing, response/gateway validation, registries, state/memory preparation,
  post-memory state projection, repository digest, repository/gateway
  conformance, mock matching, immutability, atomic rollback and workspace
  imports
- compile-time task-name/input/output and state-projection inference checks
- non-empty passing repository conformance plus empty passing integration and
  scenario gates
- no ExecutionEngine behavior
- no database schema
- no live model provider adapter
- no published package
- no deployment

## Approved Direction

`docs/PROJECT_BRIEF.md` is the active project direction. Core must be
domain-neutral and proven with NarrativeModule and ResearchModule.

## Active Work

ACME-0012 resolved the reference-domain identity/provenance gate after bounded
child ACME-0013 added the required input-bound public contracts. ADR-0009 now
freezes Narrative alias/correction and Research proposition/source/evidence
ownership with reproducible golden vectors. No reference-module implementation
task is active until the reusable DomainModule-conformance gate is separately
approved and completed.

## Persistent Gaps

- ExecutionEngine behavior is not implemented.
- Durable SQLite persistence and crash recovery are not implemented.
- A live provider adapter and provider-specific normalization are not
  implemented.
- Narrative and Research reference modules are not implemented.
- Reference-module implementation is still gated by a reusable
  DomainModule-conformance boundary. Its bounded proposal is in
  `docs/backlog/`.
- ExecutionEngine must orchestrate the implemented post-memory projection
  boundary and retain the evidence required for replay.
- The persistence schema remains design-only.
- Package boundary enforcement covers core, testing, the in-memory adapter and
  CLI substrate; future adapters and modules must extend its rule set.
- Integration and scenario commands are established but have no behavioral
  suites yet.
- No deterministic scenario or live evaluation harness exists.
- Live provider call reconciliation, encrypted retention and privacy deletion
  intentionally require future ADRs before implementation.
