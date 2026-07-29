# Current Status

Last updated: 2026-07-29

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

ACME has a build substrate and pure contract layer but remains pre-engine.
There is currently:

- common JSON, identity, time, document and diagnostic contracts
- deterministic `acme-cjson-1` canonical JSON and SHA-256 hashing
- the structured ACME error taxonomy
- provider-neutral model, prompt-contract and gateway port types
- a strict response pipeline for empty/parse/schema/semantic validation
- immutable contract and module registries with deterministic ordering and
  contract fingerprints
- task-typed module authoring plus state/memory envelope and policy types
- a typed `@acme/testing` skeleton that imports `@acme/core` through the
  workspace
- a typed `@acme/cli` composition-root skeleton
- an automated dependency rule, core vocabulary guard and negative boundary
  fixture
- 19 passing unit tests across canonicalization, hashing, response validation,
  registries and workspace imports
- compile-time task-name/input/output inference checks
- empty, passing conformance, integration and scenario gates
- no ExecutionEngine, StateEngine or MemoryEngine behavior
- no database schema
- no model provider adapter
- no published package
- no deployment

## Approved Direction

`docs/PROJECT_BRIEF.md` is the active project direction. Core must be
domain-neutral and proven with NarrativeModule and ResearchModule.

## Active Work

No task is active. `ACME-0005` completed the pure contract and static-registry
foundation. The next implementation task has not been approved or activated.

## Persistent Gaps

- StateEngine, MemoryEngine and ExecutionEngine behavior is not implemented.
- Repository ports, in-memory persistence and model mock are not implemented.
- Narrative and Research reference modules are not implemented.
- The persistence schema remains design-only.
- Package boundary enforcement currently covers the implemented core/testing/
  CLI substrate; future adapters and modules must extend its rule set.
- The conformance, integration and scenario commands are established but have
  no behavioral suites yet.
- No deterministic scenario or live evaluation harness exists.
- Live provider call reconciliation, encrypted retention and privacy deletion
  intentionally require future ADRs before implementation.
