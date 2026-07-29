# File Structure

Last updated: 2026-07-29

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
│   │   │   ├── modules.ts
│   │   │   ├── registries.ts
│   │   │   ├── response-pipeline.ts
│   │   │   ├── repository-digest.ts
│   │   │   ├── repository-model-call.ts
│   │   │   ├── repository.ts
│   │   │   ├── state-engine.ts
│   │   │   └── state.ts
│   │   ├── test/
│   │   │   ├── hashing.test.ts
│   │   │   ├── memory-engine.test.ts
│   │   │   ├── repository-digest.test.ts
│   │   │   ├── registries.test.ts
│   │   │   ├── response-pipeline.test.ts
│   │   │   └── state-engine.test.ts
│   │   └── test-d/
│   │       └── task-inference.test-d.ts
│   └── testing/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts
│       │   └── repository-conformance.ts
│       └── test/
│           └── workspace-import.test.ts
├── tests/
│   └── conformance/
│       └── adapter-memory.test.ts
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
│   │   ├── README.md
│   │   └── template.md
│   ├── backlog/
│   ├── design/
│   ├── finished/
│   ├── paused/
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
  response validation, static registries, pure revisioned state/memory
  preparation and the aggregate repository port/digest. Zod is its only
  external runtime dependency.
- `@acme/adapter-memory`: deterministic aggregate repository with immutable
  copy-on-commit transactions and read-only evidence inspection.
- `@acme/testing`: reusable ExecutionRepository conformance plus typed test
  support.
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
