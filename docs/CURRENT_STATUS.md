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

ACME has a build substrate, pure contract layer, pure StateEngine, pure
MemoryEngine and deterministic in-memory Unit of Work, but no execution
orchestration or durable persistence. There is currently:

- common JSON, identity, time, document and diagnostic contracts
- deterministic `acme-cjson-1` canonical JSON and SHA-256 hashing
- the structured ACME error taxonomy
- provider-neutral model, prompt-contract and gateway port types
- a strict response pipeline for empty/parse/schema/semantic validation
- immutable contract and module registries with deterministic ordering and
  contract fingerprints
- task-typed module authoring plus state/memory envelope and policy types
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
- a typed `@acme/cli` composition-root skeleton
- an automated dependency rule, core vocabulary guard and negative boundary
  fixture
- 65 passing unit/conformance tests across canonicalization, hashing, response
  validation, registries, state/memory preparation, repository digest,
  repository conformance, atomic rollback and workspace imports
- compile-time task-name/input/output inference checks
- non-empty passing repository conformance plus empty passing integration and
  scenario gates
- no ExecutionEngine behavior
- no database schema
- no model provider adapter
- no published package
- no deployment

## Approved Direction

`docs/PROJECT_BRIEF.md` is the active project direction. Core must be
domain-neutral and proven with NarrativeModule and ResearchModule.

## Active Work

ACME-0009 is the active Draft charter for a deterministic model mock and
provider-neutral gateway conformance suite. Implementation requires explicit
maintainer review and charter freeze.

## Persistent Gaps

- ExecutionEngine behavior is not implemented.
- Durable SQLite persistence and crash recovery are not implemented.
- A deterministic model mock is not implemented.
- Narrative and Research reference modules are not implemented.
- The persistence schema remains design-only.
- Package boundary enforcement covers core, testing, the in-memory adapter and
  CLI substrate; future adapters and modules must extend its rule set.
- Integration and scenario commands are established but have no behavioral
  suites yet.
- No deterministic scenario or live evaluation harness exists.
- Live provider call reconciliation, encrypted retention and privacy deletion
  intentionally require future ADRs before implementation.
