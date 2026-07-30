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
│       │   ├── domain-module-conformance.ts
│       │   ├── index.ts
│       │   ├── model-gateway-conformance.ts
│       │   └── repository-conformance.ts
│       ├── test/
│       │   └── workspace-import.test.ts
│       └── test-d/
│           └── domain-module-conformance.test-d.ts
├── tests/
│   └── conformance/
│       ├── adapter-memory.test.ts
│       ├── adapter-model-mock.test.ts
│       └── domain-module.test.ts
├── tooling/
│   ├── boundaries/
│   │   ├── check-boundaries.mjs
│   │   └── fixtures/
│   │       ├── packages/core/src/forbidden.ts
│   │       └── packages/module-fixture/src/forbidden.ts
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
│   │   ├── 0011-narrative-knowledge-and-context-ownership.md
│   │   ├── README.md
│   │   └── template.md
│   ├── backlog/
│   │   ├── README.md
│   │   └── domain-test-ui-implementation.md
│   ├── design/
│   │   ├── README.md
│   │   ├── acme-design-and-development-spec.md
│   │   ├── domain-test-ui-specification.md
│   │   ├── narrative-module-build-and-test-plan.md
│   │   └── research-module-build-and-test-plan.md
│   ├── finished/
│   │   ├── ACME-0001_docs-first-foundation.md
│   │   ├── ACME-0002_frozen-task-charter-workflow.md
│   │   ├── ACME-0003_complete-design-and-development-specification.md
│   │   ├── ACME-0004_repository-bootstrap.md
│   │   ├── ACME-0005_pure-contracts-and-static-registries.md
│   │   ├── ACME-0006_pure-state-engine.md
│   │   ├── ACME-0007_pure-memory-engine.md
│   │   ├── ACME-0008_aggregate-in-memory-unit-of-work.md
│   │   ├── ACME-0009_deterministic-model-mock-and-gateway-conformance.md
│   │   ├── ACME-0010_reference-module-build-and-test-guides.md
│   │   ├── ACME-0011_post-memory-state-projection.md
│   │   ├── ACME-0012_reference-domain-identity-and-provenance.md
│   │   ├── ACME-0013_input-bound-validation-and-interpretation.md
│   │   ├── ACME-0014_domain-test-ui-specification.md
│   │   ├── ACME-0015_reusable-domain-module-conformance.md
│   │   ├── ACME-0016_documentation-reality-sync.md
│   │   └── README.md
│   ├── paused/
│   │   └── README.md
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
├── FS.txt
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── README.md
├── tsconfig.json
├── tsconfig.tests.json
└── vitest.config.ts
```

`FS.txt` is a legacy tracked Windows filesystem dump that includes generated
directories and stale content. It is non-authoritative; this document is the
canonical maintained repository map. Generated `node_modules/` and `dist/`
content remains intentionally omitted here.

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
- `@acme/testing`: reusable ExecutionRepository, ModelGateway and
  DomainModule conformance plus typed test support.
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
state-projection gate, ADR-0009 resolves their identity/provenance gate and
ACME-0015 supplies their shared executable DomainModule-conformance gate.
`docs/design/domain-test-ui-specification.md` proposes an `apps/test-ui`
composition-root application for configuring, executing, inspecting,
validating and measuring domain tests. No such package exists; the file is a
specification awaiting review, and its readiness prerequisites are
unimplemented.

The remaining `docs/backlog/` proposal records the domain-test-UI
implementation. It must remain separate until its explicit prerequisites
exist.
