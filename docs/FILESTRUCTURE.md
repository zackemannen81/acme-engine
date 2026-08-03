# File Structure

Last updated: 2026-08-02

Generated `node_modules/` and `dist/` directories are intentionally omitted.

```text
acme-engine/
├── .github/
│   └── workflows/
│       └── ci.yml
├── apps/
│   ├── cli/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── args.ts
│   │   │   ├── composition.ts
│   │   │   ├── index.ts
│   │   │   ├── main.ts
│   │   │   ├── output.ts
│   │   │   ├── run.ts
│   │   │   └── scenario.ts
│   │   └── test/
│   │       └── cli.test.ts
│   └── test-ui/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts
│       │   ├── local.ts
│       │   ├── node-source.ts
│       │   ├── redaction.ts
│       │   ├── run-record.ts
│       │   ├── fixture-approval.ts
│       │   ├── live-gate.ts
│       │   ├── view.ts
│       │   ├── catalog/
│       │   │   └── paths.ts
│       │   ├── local/
│       │   │   ├── composition.ts
│       │   │   ├── launch.ts
│       │   │   ├── live-launch.ts
│       │   │   ├── server.ts
│       │   │   ├── workbench-main.ts
│       │   │   └── workspace.ts
│       │   ├── web/
│       │   │   ├── escape.ts
│       │   │   ├── index.ts
│       │   │   ├── render-execution.ts
│       │   │   ├── render-runs.ts
│       │   │   ├── shell.ts
│       │   │   └── styles.ts
│       │   ├── plan/
│       │   │   ├── compile.ts
│       │   │   └── schema.ts
│       │   └── read-model/
│       │       ├── catalog.ts
│       │       ├── execution.ts
│       │       ├── fixture-review.ts
│       │       ├── live-evaluation.ts
│       │       ├── measurement.ts
│       │       ├── memory.ts
│       │       ├── plan.ts
│       │       ├── replay.ts
│       │       ├── runs.ts
│       │       ├── shared.ts
│       │       └── state.ts
│       └── test/
│           ├── catalog-fixtures.ts
│           ├── catalog.test.ts
│           ├── fixtures.ts
│           ├── live-evaluation.test.ts
│           ├── measurement.test.ts
│           ├── web-render.test.ts
│           ├── node-source.test.ts
│           ├── plan-compile.test.ts
│           ├── plan-view.test.ts
│           ├── read-model.test.ts
│           ├── redaction.test.ts
│           └── view-contract.test.ts
├── packages/
│   ├── adapter-memory/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── repository.ts
│   │   └── test/
│   │       ├── encrypted-payload.test.ts
│   │       └── repository.test.ts
│   ├── adapter-model-mock/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── scripted-model-gateway.ts
│   │   └── test/
│   │       └── scripted-model-gateway.test.ts
│   ├── adapter-model-openai/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── gateway.ts
│   │   │   ├── immutable.ts
│   │   │   ├── index.ts
│   │   │   ├── request.ts
│   │   │   ├── schema-lower.ts
│   │   │   ├── transport.ts
│   │   │   ├── transport-fetch.ts
│   │   │   └── wire.ts
│   │   └── test/
│   │       ├── fixtures.ts
│   │       ├── gateway.test.ts
│   │       ├── schema-lower.test.ts
│   │       └── transport-fetch.test.ts
│   ├── adapter-sqlite/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── database.ts
│   │   │   ├── index.ts
│   │   │   ├── migrations.ts
│   │   │   ├── repository.ts
│   │   │   └── rows.ts
│   │   └── test/
│   │       ├── encrypted-payload.test.ts
│   │       └── migrations.test.ts
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── common.ts
│   │   │   ├── contracts.ts
│   │   │   ├── errors.ts
│   │   │   ├── evaluation.ts
│   │   │   ├── execution-engine.ts
│   │   │   ├── execution-identity.ts
│   │   │   ├── execution-status.ts
│   │   │   ├── execution-types.ts
│   │   │   ├── hashing.ts
│   │   │   ├── index.ts
│   │   │   ├── memory.ts
│   │   │   ├── memory-engine.ts
│   │   │   ├── model.ts
│   │   │   ├── model-request-hash.ts
│   │   │   ├── model-response-hash.ts
│   │   │   ├── model-validation.ts
│   │   │   ├── modules.ts
│   │   │   ├── outbox.ts
│   │   │   ├── payload-encryptor.ts
│   │   │   ├── registries.ts
│   │   │   ├── response-pipeline.ts
│   │   │   ├── repository-digest.ts
│   │   │   ├── repository-model-call.ts
│   │   │   ├── repository.ts
│   │   │   ├── state-engine.ts
│   │   │   ├── state-projection.ts
│   │   │   └── state.ts
│   │   ├── test/
│   │   │   ├── execution-identity.test.ts
│   │   │   ├── hashing.test.ts
│   │   │   ├── memory-engine.test.ts
│   │   │   ├── model-request-hash.test.ts
│   │   │   ├── outbox.test.ts
│   │   │   ├── payload-encryptor.test.ts
│   │   │   ├── repository-digest.test.ts
│   │   │   ├── registries.test.ts
│   │   │   ├── response-pipeline.test.ts
│   │   │   ├── state-engine.test.ts
│   │   │   └── state-projection.test.ts
│   │   └── test-d/
│   │       └── task-inference.test-d.ts
│   ├── module-narrative/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── contracts/
│   │   │   │   └── observe-document.ts
│   │   │   ├── tasks/
│   │   │   │   └── observe-document.ts
│   │   │   ├── identity.ts
│   │   │   ├── immutable.ts
│   │   │   ├── index.ts
│   │   │   ├── memory-policy.ts
│   │   │   ├── module.ts
│   │   │   ├── observed.ts
│   │   │   ├── previous-document-tail.ts
│   │   │   ├── schemas.ts
│   │   │   └── state.ts
│   │   ├── test/
│   │   │   ├── fixtures.ts
│   │   │   ├── memory-policy.test.ts
│   │   │   ├── observe-document.test.ts
│   │   │   ├── previous-document-tail.test.ts
│   │   │   ├── schemas.test.ts
│   │   │   └── state.test.ts
│   │   └── test-d/
│   │       └── task-inference.test-d.ts
│   ├── module-research/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── contracts/
│   │   │   │   └── observe-evidence.ts
│   │   │   ├── tasks/
│   │   │   │   └── observe-evidence.ts
│   │   │   ├── identity.ts
│   │   │   ├── immutable.ts
│   │   │   ├── index.ts
│   │   │   ├── memory-policy.ts
│   │   │   ├── module.ts
│   │   │   ├── observed.ts
│   │   │   ├── schemas.ts
│   │   │   └── state.ts
│   │   ├── test/
│   │   │   ├── fixtures.ts
│   │   │   ├── identity.test.ts
│   │   │   ├── memory-policy.test.ts
│   │   │   ├── observe-evidence.test.ts
│   │   │   ├── schemas.test.ts
│   │   │   └── state.test.ts
│   │   └── test-d/
│   │       └── task-inference.test-d.ts
│   └── testing/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── domain-module-conformance.ts
│       │   ├── index.ts
│       │   ├── model-gateway-conformance.ts
│       │   ├── repository-conformance.ts
│       │   ├── scenario.ts
│       │   └── test-payload-encryptor.ts
│       ├── test/
│       │   └── workspace-import.test.ts
│       └── test-d/
│           └── domain-module-conformance.test-d.ts
├── tests/
│   ├── conformance/
│   │   ├── adapter-memory.test.ts
│   │   ├── adapter-model-mock.test.ts
│   │   ├── adapter-model-openai.test.ts
│   │   ├── adapter-sqlite.test.ts
│   │   ├── domain-module.test.ts
│   │   ├── module-narrative.test.ts
│   │   └── module-research.test.ts
│   ├── fixtures/
│   │   ├── faulting-database.ts
│   │   ├── neutral-execution.ts
│   │   └── process-loss.ts
│   ├── live/
│   │   └── openai-responses.test.ts
│   ├── integration/
│   │   ├── durability-sqlite.test.ts
│   │   ├── outbox-drain.test.ts
│   │   ├── execution-engine.test.ts
│   │   ├── execution-engine-sqlite.test.ts
│   │   ├── test-ui-launch.test.ts
│   │   ├── test-ui-live-launch.test.ts
│   │   ├── test-ui-workbench.test.ts
│   │   └── test-ui-read-model.test.ts
│   └── scenario/
│       ├── files/
│       │   ├── digests/narrative-phase-5.json
│       │   ├── inputs/chapter-1.json
│       │   ├── responses/chapter-1.json
│       │   └── narrative-phase-5.yaml
│       ├── narrative-phase-5.test.ts
│       ├── research-phase-5.test.ts
│       ├── scenario-runner.test.ts
│       └── test-ui-plan-compile.test.ts
├── tooling/
│   ├── boundaries/
│   │   ├── check-boundaries.mjs
│   │   └── fixtures/
│   │       ├── apps/cli/src/forbidden-test-ui.ts
│   │       ├── apps/test-ui/src/forbidden-core-internal.ts
│   │       ├── packages/core/src/forbidden.ts
│   │       ├── packages/core/src/forbidden-driver.ts
│   │       ├── packages/core/src/forbidden-provider.ts
│   │       ├── packages/module-fixture/src/forbidden.ts
│   │       └── packages/module-fixture/src/forbidden-module.ts
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
│   │   ├── 0012-milestone-1-execution-identity-and-replay.md
│   │   ├── 0013-durable-sqlite-schema-and-driver.md
│   │   ├── 0014-live-provider-boundary-and-transport-port.md
│   │   ├── 0015-strict-structured-output-schema-lowering.md
│   │   ├── 0016-encrypted-payload-retention.md
│   │   ├── 0017-durable-execution-resume.md
│   │   ├── 0018-outbox-delivery-boundary.md
│   │   ├── 0019-domain-test-ui-boundary-and-view-contracts.md
│   │   ├── 0020-acme-test-plan-schema-and-compiler.md
│   │   ├── 0021-interface-workspace-and-launch-boundary.md
│   │   ├── 0022-measurement-and-fixture-approval.md
│   │   ├── 0023-live-evaluation-gate.md
│   │   ├── 0024-local-spa-loopback-workbench.md
│   │   ├── README.md
│   │   └── template.md
│   ├── concepts_sandbox/
│   │   ├── README.md
│   │   ├── POC_interfacing.md
│   │   └── temp/
│   │       └── testregistry_workbench_professional_test_engineering_suite.html
│   ├── backlog/
│   │   ├── README.md
│   │   ├── domain-test-ui-implementation.md
│   │   └── driver-error-classification.md
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
│   │   ├── ACME-0017_narrative-module-observe-document.md
│   │   ├── ACME-0018_single-task-execution-engine.md
│   │   ├── ACME-0019_acme-0018-charter-hardening.md
│   │   ├── ACME-0020_post-merge-execution-documentation-repair.md
│   │   ├── ACME-0021_durable-sqlite-persistence.md
│   │   ├── ACME-0022_research-module-observe-evidence.md
│   │   ├── ACME-0023_research-offline-acceptance-scenario.md
│   │   ├── ACME-0024_governing-document-sync.md
│   │   ├── ACME-0025_openai-responses-provider-boundary.md
│   │   ├── ACME-0026_cli-composition-root.md
│   │   ├── ACME-0027_scenario-runner.md
│   │   ├── ACME-0028_first-live-provider-calls.md
│   │   ├── ACME-0029_strict-structured-output-schema-lowering.md
│   │   ├── ACME-0030_encrypted-payload-retention.md
│   │   ├── ACME-0031_documentation-reality-sync.md
│   │   ├── ACME-0032_cli-live-openai-gateway.md
│   │   ├── ACME-0033_durable-execution-resume.md
│   │   ├── ACME-0034_milestone-2-durability-proofs.md
│   │   ├── ACME-0035_outbox-delivery-boundary.md
│   │   ├── ACME-0036_documentation-reality-sync.md
│   │   ├── ACME-0037_omit-default-temperature.md
│   │   ├── ACME-0038_domain-test-ui-specification-rewrite.md
│   │   ├── ACME-0039_domain-test-ui-read-model.md
│   │   ├── ACME-0040_domain-test-ui-catalog.md
│   │   ├── ACME-0041_domain-test-ui-plan-compiler.md
│   │   ├── ACME-0042_domain-test-ui-launch-and-history.md
│   │   ├── ACME-0043_domain-test-ui-measurement-and-fixture-review.md
│   │   ├── ACME-0044_domain-test-ui-live-evaluation.md
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
├── vitest.config.ts
└── vitest.live.config.ts
```

`FS.txt` is a legacy tracked Windows filesystem dump that includes generated
directories and stale content. It is non-authoritative; this document is the
canonical maintained repository map. Generated `node_modules/` and `dist/`
content remains intentionally omitted here.

## Implemented Workspace

- `@acme/core`: pure domain-neutral contracts, deterministic primitives,
  input-bound response validation, static registries, pure revisioned
  state/memory preparation, filtered post-memory state projection and the
  aggregate repository port/digest plus the bounded single-task
  ExecutionEngine and replay verifier. Zod is its only external runtime
  dependency.
- `@acme/adapter-memory`: deterministic aggregate repository with immutable
  copy-on-commit transactions and read-only evidence inspection.
- `@acme/adapter-model-mock`: deterministic exact-call gateway scripts,
  immutable normalized outcomes and read-only invocation evidence.
- `@acme/adapter-model-openai`: the OpenAI Responses mapping behind an
  injected transport port, so request construction, normalization and failure
  classification are exercised offline. Canonical JSON Schemas are lowered into
  the provider's strict structured-output subset before dispatch, with local
  preflight refusal for unlowerable constructs. A `fetch` transport is
  published from the separate `./transport-fetch` entry point, so the default
  surface stays network-free.
- `@acme/adapter-sqlite`: durable WAL-mode aggregate repository with ordered
  checksum-verified migrations and a `BEGIN IMMEDIATE` Unit of Work.
  `better-sqlite3` is its only external runtime dependency.
- `@acme/module-narrative`: strict Narrative v1 schemas, deterministic
  observe-document contract/task, pure state behavior and domain-owned memory
  policy.
- `@acme/module-research`: strict Research v1 schemas, ADR-0009 proposition,
  source and independence identity, deterministic observe-evidence
  contract/task, corroboration and contradiction policy, and a pure reducer.
- `@acme/testing`: reusable ExecutionRepository, ModelGateway and
  DomainModule conformance, typed test support and the ScenarioRunner over
  `acme-scenario/1`. It depends on `@acme/core` alone; the caller injects the
  composition and the fixture loader.
- `@acme/cli`: the composition root. It is the only place that selects a
  concrete repository adapter and model gateway (`--script` mock or
  `--gateway openai`), and it exposes `execute`, `execution replay`,
  `execution inspect`, `state inspect` and `memory inspect` over both the
  in-memory and durable SQLite repositories.
- `@acme/test-ui`: the Domain Test UI (ADR-0019 to ADR-0023). Phases 1–6 are
  the read model, catalog, plan compiler, launch path, measurement, fixture
  review and gated live evaluation — view contracts for the S1–S10 surfaces,
  `acme-test-plan/1` with a pure compiler, a local launch path that records
  runs under an interface-owned workspace, rates over recorded runs against
  configured thresholds, fixture approvals that never write a golden, and
  single-execute live launch behind `ACME_TEST_UI_LIVE` plus confirmation.
  The default entry point performs no I/O; discovery lives on `./node-source`
  and everything that selects an adapter or touches a disk lives on
  `./local`. It is a leaf: nothing in the workspace imports it.
- `tooling/typescript/`: shared strict ESM compiler configuration.
- `tooling/boundaries/`: dependency graph, core vocabulary and negative
  core, module, cross-module and SQLite-driver fixture verification.
- `tooling/docs/`: internal Markdown link and fence verification.
- `.github/workflows/ci.yml`: secret-free mirror of local verification gates.

## Planned Structure

NarrativeModule and ResearchModule phases 1–5, the bounded ExecutionEngine,
the durable SQLite adapter, the OpenAI Responses adapter (with schema
lowering and a live success path), ScenarioRunner and the CLI composition
root are implemented. The live-model path is experimental and opt-in; the CLI
still selects only the mock gateway. Further packages (Domain Test UI, workers)
must be added only by explicitly activated tasks.

The two reference-module build and test plans under `docs/design/` are the
normative implementation guides. Their `docs/presentations/` DOCX renditions
are ACME-0010 review snapshots; the Markdown guides remain normative after
later architecture decisions. ADR-0008 resolves their post-memory
state-projection gate, ADR-0009 resolves their identity/provenance gate and
ACME-0015 supplies their shared executable DomainModule-conformance gate.
`docs/design/domain-test-ui-specification.md` specifies the `apps/test-ui`
composition-root application (module and adapter workbenches, view contracts,
optional `acme-test-plan/1`). ACME-0039 accepted its gate freezes in ADR-0019
and delivered phases 0 and 1; ACME-0040 through ACME-0044 added phases 2–6
under ADR-0020 through ADR-0023. The package therefore holds the full S1–S10
read/launch path including gated live evaluation: no multi-step live scenarios
and no browser surface. A non-authority workbench mock lives under
`docs/concepts_sandbox/temp/`.

`docs/concepts_sandbox/` holds explicitly excluded concept work. Nothing in it
is decided architecture, roadmap or current scope, and no task may cite it as
authority.

The `docs/backlog/` proposals record open residual work (Domain Test UI
implementation; driver-error classification). Resolved proposals
(encrypted-payload, strict structured-output) are removed once finished.
