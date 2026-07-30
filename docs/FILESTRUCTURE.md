# File Structure

Last updated: 2026-07-30

Generated `node_modules/` and `dist/` directories are intentionally omitted.

```text
acme-engine/
├── .github/
│   └── workflows/
│       └── ci.yml
├── apps/
│   └── cli/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts
├── packages/
│   ├── adapter-memory/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── repository.ts
│   │   └── test/
│   │       └── repository.test.ts
│   ├── adapter-model-mock/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── scripted-model-gateway.ts
│   │   └── test/
│   │       └── scripted-model-gateway.test.ts
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── common.ts
│   │   │   ├── contracts.ts
│   │   │   ├── errors.ts
│   │   │   ├── evaluation.ts
│   │   │   ├── execution-status.ts
│   │   │   ├── execution-types.ts
│   │   │   ├── hashing.ts
│   │   │   ├── index.ts
│   │   │   ├── memory.ts
│   │   │   ├── memory-engine.ts
│   │   │   ├── model.ts
│   │   │   ├── model-request-hash.ts
│   │   │   ├── model-validation.ts
│   │   │   ├── modules.ts
│   │   │   ├── registries.ts
│   │   │   ├── response-pipeline.ts
│   │   │   ├── repository-digest.ts
│   │   │   ├── repository-model-call.ts
│   │   │   ├── repository.ts
│   │   │   ├── state-engine.ts
│   │   │   ├── state-projection.ts
│   │   │   └── state.ts
│   │   ├── test/
│   │   │   ├── hashing.test.ts
│   │   │   ├── memory-engine.test.ts
│   │   │   ├── model-request-hash.test.ts
│   │   │   ├── repository-digest.test.ts
│   │   │   ├── registries.test.ts
│   │   │   ├── response-pipeline.test.ts
│   │   │   ├── state-engine.test.ts
│   │   │   └── state-projection.test.ts
│   │   └── test-d/
│   │       └── task-inference.test-d.ts
│   └── testing/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts
│       │   ├── model-gateway-conformance.ts
│       │   └── repository-conformance.ts
│       └── test/
│           └── workspace-import.test.ts
├── tests/
│   └── conformance/
│       ├── adapter-memory.test.ts
│       └── adapter-model-mock.test.ts
├── tooling/
│   ├── boundaries/
│   │   ├── check-boundaries.mjs
│   │   └── fixtures/
│   │       └── packages/core/src/forbidden.ts
│   ├── docs/
│   │   └── check-docs.mjs
│   └── typescript/
│       └── tsconfig.base.json
├── docs/
│   ├── adr/
│   │   ├── 0001-typescript-pnpm-workspace.md
│   │   ├── 0002-static-task-typed-module-composition.md
│   │   ├── 0003-sqlite-revisioned-unit-of-work.md
│   │   ├── 0004-deterministic-transition-identity.md
│   │   ├── 0005-pure-memory-decision-application.md
│   │   ├── 0006-aggregate-in-memory-unit-of-work.md
│   │   ├── 0007-deterministic-model-mock-and-gateway-conformance.md
│   │   ├── 0008-post-memory-domain-state-projection.md
│   │   ├── 0009-reference-domain-identity-and-provenance.md
│   │   ├── 0010-input-bound-validation-and-interpretation.md
│   │   ├── README.md
│   │   └── template.md
│   ├── backlog/
│   │   ├── domain-test-ui-implementation.md
│   │   └── reusable-domain-module-conformance-kit.md
│   ├── design/
│   │   ├── README.md
│   │   ├── acme-design-and-development-spec.md
│   │   ├── domain-test-ui-specification.md
│   │   ├── narrative-module-build-and-test-plan.md
│   │   └── research-module-build-and-test-plan.md
│   ├── finished/
│   ├── paused/
│   ├── presentations/
│   │   ├── narrative-module-build-and-test-plan.docx
│   │   └── research-module-build-and-test-plan.docx
│   ├── CONTRIBUTING.md
│   ├── CURRENT_STATUS.md
│   ├── CURRENT_TASK.md
│   ├── FILESTRUCTURE.md
│   ├── JOURNAL.md
│   ├── PROJECT_BRIEF.md
│   ├── SYSTEMDOC.md
│   ├── TASK_WORKFLOW.md
│   └── template_CURRENT_TASK.md
├── .gitattributes
├── .gitignore
├── .node-version
├── .npmrc
├── .prettierignore
├── .prettierrc.json
├── AGENTS.md
├── dependency-cruiser.config.mjs
├── eslint.config.mjs
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── README.md
├── tsconfig.json
├── tsconfig.tests.json
└── vitest.config.ts
```

## Implemented Workspace

- `@acme/core`: pure domain-neutral contracts, deterministic primitives,
  input-bound response validation, static registries, pure revisioned
  state/memory preparation, filtered post-memory state projection and the
  aggregate repository port/digest. Zod is its only external runtime
  dependency.
- `@acme/adapter-memory`: deterministic aggregate repository with immutable
  copy-on-commit transactions and read-only evidence inspection.
- `@acme/adapter-model-mock`: deterministic exact-call gateway scripts,
  immutable normalized outcomes and read-only invocation evidence.
- `@acme/testing`: reusable ExecutionRepository and ModelGateway conformance
  plus typed test support.
- `@acme/cli`: behavior-free composition-root skeleton importing
  `@acme/core`.
- `tooling/typescript/`: shared strict ESM compiler configuration.
- `tooling/boundaries/`: dependency graph, core vocabulary and negative
  fixture verification.
- `tooling/docs/`: internal Markdown link and fence verification.
- `.github/workflows/ci.yml`: secret-free mirror of local verification gates.

## Planned Structure

The design specification retains the future package map for engine behavior,
SQLite/model adapters, Narrative and Research modules and scenarios. Those
files and directories must be added only by explicitly activated tasks.

The two reference-module build and test plans under `docs/design/` are the
normative implementation guides. Their `docs/presentations/` DOCX renditions
are ACME-0010 review snapshots; the Markdown guides remain normative after
later architecture decisions. ADR-0008 resolves their post-memory
state-projection gate, and ADR-0009 resolves their identity/provenance gate.
`docs/design/domain-test-ui-specification.md` proposes an `apps/test-ui`
composition-root application for configuring, executing, inspecting,
validating and measuring domain tests. No such package exists; the file is a
specification awaiting review, and its readiness prerequisites are
unimplemented.

The two `docs/backlog/` proposals record the reusable DomainModule-conformance
work and the domain-test-UI implementation. Both must be chartered separately
rather than absorbed into reference-module implementation.
