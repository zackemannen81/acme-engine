# File Structure

Last updated: 2026-08-16

Generated `node_modules/` and `dist/` directories are intentionally omitted.

```text
acme-engine/
├── .github/
│   └── workflows/
│       └── ci.yml
├── .grok/
│   └── settings.json
├── apps/
│   ├── .npmrc
│   ├── cli/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── args.ts
│   │   │   ├── composition.ts
│   │   │   ├── index.ts
│   │   │   ├── main.ts
│   │   │   ├── outbox-file-dispatcher.ts
│   │   │   ├── output.ts
│   │   │   ├── run.ts
│   │   │   └── scenario.ts
│   │   └── test/
│   │       ├── cli.test.ts
│   │       └── outbox-file-dispatcher.test.ts
│   ├── evidence-workbench-api/
│   │   ├── README.md
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/{index.ts,live.ts,live-observation.ts,live-relation.ts,live-assessment.ts,local.ts,local-main.ts}
│   │   └── test/{auth-blackbox.test.ts,case-management-blackbox.test.ts,execution-scoped-observations.test.ts,live-composition.test.ts,live-coverage-windows.test.ts,live-path-regressions.test.ts,live-repair-budget.test.ts,local-blackbox.test.ts,secret-scan.test.ts}
│   ├── evidence-workbench-web/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/index.ts
│   │   └── test/index.test.ts
│   ├── evidence-workbench-worker/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/index.ts
│   └── test-ui/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts
│       │   ├── local.ts
│       │   ├── node-source.ts
│       │   ├── redaction.ts
│       │   ├── run-record.ts
│       │   ├── job-record.ts
│       │   ├── fixture-approval.ts
│       │   ├── live-gate.ts
│       │   ├── view.ts
│       │   ├── catalog/
│       │   │   └── paths.ts
│       │   ├── local/
│       │   │   ├── composition.ts
│       │   │   ├── launch.ts
│       │   │   ├── job-runner.ts
│       │   │   ├── live-launch.ts
│       │   │   ├── server.ts
│       │   │   ├── workbench-main.ts
│       │   │   └── workspace.ts
│       │   ├── web/
│       │   │   ├── escape.ts
│       │   │   ├── index.ts
│       │   │   ├── render-catalog.ts
│       │   │   ├── render-execution.ts
│       │   │   ├── render-fixture-review.ts
│       │   │   ├── render-live-evaluation.ts
│       │   │   ├── render-memory-decisions.ts
│       │   │   ├── render-measurement.ts
│       │   │   ├── render-replay.ts
│       │   │   ├── render-state.ts
│       │   │   ├── render-plan.ts
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
│       │       ├── quality-evaluation.ts
│       │       ├── replay.ts
│       │       ├── runs.ts
│       │       ├── shared.ts
│       │       └── state.ts
│       └── test/
│           ├── catalog-fixtures.ts
│           ├── catalog.test.ts
│           ├── fixtures.ts
│           ├── job-runner.test.ts
│           ├── live-evaluation.test.ts
│           ├── measurement.test.ts
│           ├── web-render.test.ts
│           ├── node-source.test.ts
│           ├── plan-compile.test.ts
│           ├── plan-view.test.ts
│           ├── quality-evaluation-view.test.ts
│           ├── read-model.test.ts
│           ├── redaction.test.ts
│           └── view-contract.test.ts
├── hrd/
│   ├── ACME-OpenAI-FDE-project-presentation.md
│   ├── ACME-OpenAI-FDE-project-presentation.pdf
│   ├── ACME-OpenAI-FDE-project-presentation.pptx
│   ├── ACME-presentation.pptx
│   ├── ACME-teknisk-systemdokumentation.docx
│   └── ACME-whitepaper.docx
├── packages/
│   ├── .npmrc
│   ├── adapter-memory/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── quality-evaluation-store.ts
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
│   ├── live-safety/
│   │   ├── README.md
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/index.ts
│   │   └── test/live-safety.test.ts
│   ├── adapter-sqlite/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── database.ts
│   │   │   ├── driver-errors.ts
│   │   │   ├── index.ts
│   │   │   ├── migrations.ts
│   │   │   ├── quality-evaluation-store.ts
│   │   │   ├── repository.ts
│   │   │   └── rows.ts
│   │   └── test/
│   │       ├── driver-errors.test.ts
│   │       ├── encrypted-payload.test.ts
│   │       ├── migrations.test.ts
│   │       └── quality-evaluation-store.test.ts
│   ├── adapter-postgres/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── README.md
│   │   ├── sql/roles.sql
│   │   ├── src/
│   │   │   ├── driver-errors.ts
│   │   │   ├── index.ts
│   │   │   ├── migrations.ts
│   │   │   ├── quality-evaluation-store.ts
│   │   │   ├── repository.ts
│   │   │   ├── rows.ts
│   │   │   ├── schema.ts
│   │   │   └── transaction.ts
│   │   └── test/
│   │       └── driver-errors.test.ts
│   ├── adapter-evidence-artifact-file/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/index.ts
│   │   └── test/index.test.ts
│   ├── adapter-evidence-artifact-s3/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/index.ts
│   │   └── test/index.test.ts
│   ├── adapter-evidence-product-postgres/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── README.md
│   │   └── src/
│   │       ├── index.ts
│   │       ├── migrations.ts
│   │       └── repository.ts
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
│   │   │   ├── model-call-usage.ts
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
│   │   │   ├── state.ts
│   │   │   └── stranded-execution.ts
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
│   │   │   ├── state-projection.test.ts
│   │   │   └── stranded-execution.test.ts
│   │   └── test-d/
│   │       └── task-inference.test-d.ts
│   ├── evaluation/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── contracts.ts
│   │   │   ├── errors.ts
│   │   │   ├── harness.ts
│   │   │   ├── identity.ts
│   │   │   ├── index.ts
│   │   │   ├── live-judge.ts
│   │   │   ├── recorded.ts
│   │   │   ├── registry.ts
│   │   │   └── validation.ts
│   │   └── test/
│   │       ├── live-judge.test.ts
│   │       └── quality-evaluation.test.ts
│   ├── evidence-auth/
│   │   ├── README.md
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/{index.ts,policy.ts,repository.ts,schemas.ts,session.ts}
│   │   └── test/policy.test.ts
│   ├── adapter-evidence-auth-memory/
│   │   ├── README.md
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/index.ts
│   │   └── test/{repository.test.ts,session.test.ts}
│   ├── adapter-evidence-auth-postgres/
│   │   ├── README.md
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/{index.ts,migrations.ts,repository.ts}
│   ├── adapter-evidence-auth-supabase/
│   │   ├── README.md
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/index.ts
│   │   └── test/index.test.ts
│   ├── adapter-evidence-product-file/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/index.ts
│   │   └── test/{case-management.test.ts,repository.test.ts}
│   ├── evidence-artifacts/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/{envelope.ts,index.ts,key-provider.ts,ports.ts,schemas.ts}
│   │   └── test/envelope.test.ts
│   ├── evidence-product-contracts/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/{artifact-service.ts,assessment-output.ts,case.ts,case-insights.ts,export.ts,export-operation-schemas.ts,export-operations.ts,index.ts,ingestion.ts,ingestion-service.ts,operations.ts,repository.ts,review.ts,review-operation-schemas.ts,schemas.ts,scope.ts,zip.ts}
│   ├── evidence-testing/
│   │   ├── README.md
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── artifact-object-store-conformance.ts
│   │   │   ├── corpus.ts
│   │   │   ├── development-observe.ts
│   │   │   ├── evaluation-assessment.ts
│   │   │   ├── evaluation-candidates.ts
│   │   │   ├── evaluation-relate.ts
│   │   │   ├── evaluation.ts
│   │   │   ├── golden.ts
│   │   │   ├── index.ts
│   │   │   ├── product-conformance.ts
│   │   │   ├── prompt-guard.ts
│   │   │   └── schemas.ts
│   │   ├── fixtures/rillford-annex-review-1/
│   │   │   ├── manifest.json
│   │   │   ├── identity-vectors.json
│   │   │   ├── scratch/{sources,truth.json,golden.json}
│   │   │   ├── development/{sources,truth.json,golden.json}
│   │   │   └── evaluation/{sources,truth.json,golden.json}
│   │   └── test/
│   │       ├── account-views.test.ts
│   │       ├── assessment-output.test.ts
│   │       ├── assessment-views.test.ts
│   │       ├── case-insights.test.ts
│   │       ├── corpus.test.ts
│   │       ├── development-observe.test.ts
│   │       ├── evaluation-assessment.test.ts
│   │       ├── evaluation-candidates.test.ts
│   │       ├── evaluation-relate.test.ts
│   │       ├── export-operations.test.ts
│   │       ├── identity-vectors.test.ts
│   │       ├── ingestion-redaction.test.ts
│   │       └── prompt-guard.test.ts
│   ├── evidence-views/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/{builders.ts,index.ts,registry.ts,schemas.ts}
│   ├── module-evidence/
│   │   ├── README.md
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── canonical-text.ts
│   │   │   ├── catalogue.ts
│   │   │   ├── contracts/observe-artifact.ts
│   │   │   ├── contracts/repair.ts
│   │   │   ├── coverage.ts
│   │   │   ├── correction.ts
│   │   │   ├── identity.ts
│   │   │   ├── immutable.ts
│   │   │   ├── index.ts
│   │   │   ├── memory-policy.ts
│   │   │   ├── module.ts
│   │   │   ├── schemas.ts
│   │   │   ├── state.ts
│   │   │   ├── tasks/observe-artifact.ts
│   │   │   └── validation.ts
│   │   └── test/
│   │       ├── coverage.test.ts
│   │       ├── identity-and-schemas.test.ts
│   │       ├── memory-and-module.test.ts
│   │       ├── observe-artifact.test.ts
│   │       ├── repair.test.ts
│   │       └── state.test.ts
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
│       │   ├── quality-evaluation-conformance.ts
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
│   │   ├── module-evidence.test.ts
│   │   ├── module-narrative.test.ts
│   │   ├── module-research.test.ts
│   │   ├── quality-evaluation-memory.test.ts
│   │   └── quality-evaluation-sqlite.test.ts
│   ├── fixtures/
│   │   ├── faulting-database.ts
│   │   ├── neutral-execution.ts
│   │   └── process-loss.ts
│   ├── live/
│   │   ├── openai-responses.test.ts
│   │   ├── scenario-multi-step.test.ts
│   │   └── supabase-auth.test.ts
│   ├── postgres/
│   │   ├── adapter-postgres.conformance.test.ts
│   │   ├── evidence-product-postgres.conformance.test.ts
│   │   ├── evidence-auth-postgres.test.ts
│   │   ├── harness.ts
│   │   ├── lazy-repository.ts
│   │   ├── postgres-gates.test.ts
│   │   └── quality-evaluation-postgres.conformance.test.ts
│   ├── integration/
│   │   ├── durability-sqlite.test.ts
│   │   ├── outbox-drain.test.ts
│   │   ├── execution-engine.test.ts
│   │   ├── execution-engine-sqlite.test.ts
│   │   ├── execution-repair.test.ts
│   │   ├── evidence-coverage-windows.test.ts
│   │   ├── evidence-observe-engine.test.ts
│   │   ├── scenario-live-offline.test.ts
│   │   ├── test-ui-launch.test.ts
│   │   ├── test-ui-live-launch.test.ts
│   │   ├── test-ui-live-workbench.test.ts
│   │   ├── test-ui-workbench.test.ts
│   │   └── test-ui-read-model.test.ts
│   └── scenario/
│       ├── quality-evaluation-recording.json
│       ├── quality-evaluation-runner.test.ts
│       ├── quality-evaluation.json
│       ├── files/
│       │   ├── digests/narrative-phase-5.json
│       │   ├── inputs/chapter-1.json
│       │   ├── responses/chapter-1.json
│       │   └── narrative-phase-5.yaml
│       ├── evidence-account-comparison.test.ts
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
│   │       ├── packages/evaluation/src/forbidden-adapter.ts
│   │       ├── packages/module-fixture/src/forbidden.ts
│   │       ├── packages/module-fixture/src/forbidden-module.ts
│   │       └── packages/module-fixture/src/forbidden-sealed-truth.ts
│   ├── docs/
│   │   └── check-docs.mjs
│   ├── postgres/
│   │   └── run-postgres-tests.mjs
│   └── typescript/
│       └── tsconfig.base.json
├── docs/
│   ├── ops/
│   │   ├── evidence-artifact-operations.md
│   │   ├── hosted-shell.md
│   │   └── postgresql-operations.md
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
│   │   ├── 0025-post-execution-quality-evaluation.md
│   │   ├── 0026-durable-quality-evaluation-store.md
│   │   ├── 0027-async-launch-job-progress-cancellation.md
│   │   ├── 0028-first-poc-evidence-integrity-workbench.md
│   │   ├── 0029-poc-1-self-hosted-supabase-persistence-platform.md
│   │   ├── 0030-evidence-v1-identity-and-canonical-placement.md
│   │   ├── 0031-evidence-review-overlay-and-versioned-views.md
│   │   ├── 0032-evidence-v1-correction-occurrence-pairing.md
│   │   ├── 0033-postgresql-persistence-architecture.md
│   │   ├── 0034-poc-1-hosted-shell-identity-and-topology.md
│   │   ├── 0035-evidence-authenticated-principal-and-authorization.md
│   │   ├── 0036-evidence-case-management-and-isolation.md
│   │   ├── 0037-evidence-secure-artifact-foundation.md
│   │   ├── 0038-bounded-text-ingestion-and-immutable-redaction.md
│   │   ├── 0039-evidence-workbench-live-model-boundary.md
│   │   ├── 0040-poc-1-live-product-applicability.md
│   │   ├── 0041-bounded-observation-candidate-batches.md
│   │   ├── 0042-runtime-derived-observation-locators.md
│   │   ├── 0043-runtime-derived-observation-quotes.md
│   │   ├── README.md
│   │   └── template.md
│   ├── concepts_sandbox/
│   │   ├── README.md
│   │   ├── POC_interfacing.md
│   │   ├── acme-open-source-strategy.md
│   │   ├── acme_cm_001_memory_conflict_benchmark.md
│   │   ├── acme_cm_001_memory_conflict_benchmark/
│   │   │   ├── README.md
│   │   │   ├── acme_cm_001_ground_truth.json
│   │   │   ├── acme_cm_001_paper.md
│   │   │   └── acme_cm_001_stream.jsonl
│   │   ├── audioleaf-kids-on-acme/
│   │   │   ├── README.md
│   │   │   ├── 01-architecture.md
│   │   │   ├── 02-package-api.md
│   │   │   └── 03-task-and-event-map.md
│   │   ├── docs-first-open-source-packaging.md
│   │   ├── legal-evidence-on-acme/
│   │   │   ├── README.md
│   │   │   ├── 01-architecture.md
│   │   │   ├── 02-package-api.md
│   │   │   └── 03-task-and-event-map.md
│   │   ├── research-paper-composer-on-acme/
│   │   │   ├── README.md
│   │   │   ├── 01-architecture.md
│   │   │   ├── 02-package-api.md
│   │   │   └── 03-task-and-event-map.md
│   │   ├── three-domain-platform-proof/
│   │   │   ├── README.md
│   │   │   └── 01-platform-proof-criteria.md
│   │   └── temp/
│   │       └── testregistry_workbench_professional_test_engineering_suite.html
│   ├── backlog/
│   │   ├── README.md
│   │   ├── domain-test-ui-implementation.md
│   │   ├── driver-error-classification.md
│   │   └── evidence-authentication-authorization-implementation.md
│   ├── design/
│   │   ├── README.md
│   │   ├── acme-design-and-development-spec.md
│   │   ├── domain-test-ui-specification.md
│   │   ├── evidence-integrity-workbench-product-completion-plan.md
│   │   ├── evidence-integrity-workbench-product-definition.md
│   │   ├── evidence-integrity-workbench-technical-specification.md
│   │   ├── first-poc-application-discovery.md
│   │   ├── gap-resolution-plan.md
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
│   │   ├── ACME-0045_domain-test-ui-local-workbench.md
│   │   ├── ACME-0046_browser-offline-plan-launch.md
│   │   ├── ACME-0047_browser-catalog-renderer.md
│   │   ├── ACME-0048_browser-memory-decisions.md
│   │   ├── ACME-0049_browser-state-inspector.md
│   │   ├── ACME-0050_browser-replay-inspector.md
│   │   ├── ACME-0051_browser-measurement-surface.md
│   │   ├── ACME-0052_browser-fixture-review.md
│   │   ├── ACME-0053_browser-live-evaluation.md
│   │   ├── ACME-0054_quality-evaluation-harness.md
│   │   ├── ACME-0055_acme-human-readable-documents.md
│   │   ├── ACME-0056_gap-resolution-plan.md
│   │   ├── ACME-0057_driver-error-classification.md
│   │   ├── ACME-0058_stranded-execution-ops.md
│   │   ├── ACME-0059_outbox-redrive.md
│   │   ├── ACME-0060_outbox-growth-alarm.md
│   │   ├── ACME-0061_outbox-file-transport.md
│   │   ├── ACME-0062_narrative-domain-event.md
│   │   ├── ACME-0063_plan-model-pin.md
│   │   ├── ACME-0064_scenario-live-multi-step.md
│   │   ├── ACME-0065_durable-quality-store.md
│   │   ├── ACME-0066_quality-cli.md
│   │   ├── ACME-0067_quality-view.md
│   │   ├── ACME-0068_live-quality-judge.md
│   │   ├── ACME-0069_async-launch-progress-cancellation.md
│   │   ├── ACME-0070_documentation-reality-sync.md
│   │   ├── ACME-0071_openai-fde-project-presentation.md
│   │   ├── ACME-0072_openai-fde-presentation-markdown.md
│   │   ├── ACME-0073_first-poc-application-discovery.md
│   │   ├── ACME-0074_lock-evidence-integrity-workbench.md
│   │   ├── ACME-0075_open-source-concepts.md
│   │   ├── ACME-0076_evidence-integrity-workbench-technical-specification.md
│   │   ├── ACME-0077_evidence-corpus-contracts-foundation.md
│   │   ├── ACME-0078_evidence-review-one-source.md
│   │   ├── ACME-0079_compare-evidence-accounts.md
│   │   ├── ACME-0080_evidence-relations-uncertainty.md
│   │   ├── ACME-0081_timeline-open-questions.md
│   │   ├── ACME-0082_assessment-re-review.md
│   │   ├── ACME-0083_secondary-technical-audit.md
│   │   ├── ACME-0084_postgresql-persistence-architecture.md
│   │   ├── ACME-0085_postgresql-slice-7.md
│   │   ├── ACME-0086_hosted-shell.md
│   │   ├── ACME-0087_complete-slice-5-assessment-journey.md
│   │   ├── ACME-0088_reseal-pre-late-e-a01.md
│   │   ├── ACME-0089_reseal-e-a01-without-late-questions.md
│   │   ├── ACME-0090_authenticated-principal-authorization-adr.md
│   │   ├── ACME-0091_authenticated-principal-authorization.md
│   │   └── README.md
│   ├── hrd/
│   │   ├── README.md
│   │   └── (Swedish PDF and PNG explanatory artifacts)
│   ├── paused/
│   │   └── README.md
│   ├── presentations/
│   │   ├── narrative-module-build-and-test-plan.docx
│   │   └── research-module-build-and-test-plan.docx
│   ├── acceptance/
│   │   ├── ACME-0133-frozen-acceptance-report.md
│   │   ├── ACME-0136-frozen-acceptance-report.md
│   │   └── ACME-0136-post-freeze-comparison.md
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
├── startup-full_poc1-autoimport.ps1
├── tsconfig.json
├── tsconfig.tests.json
├── vitest.config.ts
├── vitest.live.config.ts
├── vitest.supabase-auth.config.ts
└── vitest.postgres.config.ts
```

`hrd/` contains the Swedish, human-readable presentation, whitepaper and
technical system document generated from the synchronized repository
authority, plus the English OpenAI/FDE project presentation, its matching PDF
and a Markdown counterpart. `docs/hrd/` holds the same family of derived
explanatory artifacts in PDF and PNG form, listed here as a group because their
filenames are prose titles rather than stable paths. They are derived
deliverables; the governing Markdown documentation and accepted ADRs remain
normative.

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
  copy-on-commit transactions and read-only evidence inspection, plus a
  separate append-only in-memory quality-evaluation store.
- `@acme/evaluation`: domain-neutral post-execution evaluation contracts,
  immutable content-derived identity, a static evaluator registry, pure
  deterministic execution and exact recorded-external replay.
- `@acme/adapter-model-mock`: deterministic exact-call gateway scripts,
  immutable normalized outcomes and read-only invocation evidence.
- `@acme/adapter-model-openai`: the OpenAI Responses mapping behind an
  injected transport port, so request construction, normalization and failure
  classification are exercised offline. Canonical JSON Schemas are lowered into
  the provider's strict structured-output subset before dispatch, with local
  preflight refusal for unlowerable constructs. A `fetch` transport is
  published from the separate `./transport-fetch` entry point, so the default
  surface stays network-free.
- `@acme/live-safety`: pure provider-neutral credential-field refusal,
  explicit opt-in, environment-credential and nested budget primitives shared
  by live application surfaces. It performs no I/O and owns no authorization.
- `@acme/adapter-sqlite`: durable WAL-mode aggregate repository with ordered
  checksum-verified migrations and a `BEGIN IMMEDIATE` Unit of Work.
  `better-sqlite3` is its only external runtime dependency.
- `@acme/module-narrative`: strict Narrative v1 schemas, deterministic
  observe-document contract/task, pure state behavior and domain-owned memory
  policy.
- `@acme/module-research`: strict Research v1 schemas, ADR-0009 proposition,
  source and independence identity, deterministic observe-evidence
  contract/task, corroboration and contradiction policy, and a pure reducer.
- `@acme/module-evidence`: Evidence Integrity domain foundation and the
  observe-artifact, relate-observations, build-timeline and propose-assessment
  tasks. It owns strict V1 schemas, named content-derived identities, source-
  bound candidate validation, conservative correction pairing, typed temporal
  behavior, attention/export helpers, compact state/delta, pure reducer/
  invariants and memory policy.
- `@acme/evidence-artifacts`: strict immutable representation, envelope,
  staging, lifecycle, content-free audit and backup contracts plus AES-256-GCM
  envelope encryption, versioned KEK keyring and object/key provider ports.
- `@acme/adapter-evidence-artifact-file` and
  `@acme/adapter-evidence-artifact-s3`: exclusive-create, bounded-read
  ciphertext object stores for local and hosted composition under one shared
  conformance contract.
- `@acme/evidence-product-contracts`: explicit case lifecycle, participant,
  immutable case-object scope, secure artifact and bounded ingestion/redaction
  services, local workspace, source-import, job and
  append-only exact-version review, durable change-set and assessment-command
  contracts plus the product repository port, reviewer-operation and case
  search contracts, the pure case overview and Case Integrity Report builders,
  the `evidence-assessment-output/1` document with its deterministic
  JSON/Markdown/DOCX/PDF renderers, the per-case export policy, export-audit
  and product backup/restore contracts, and the deterministic
  reviewed-assessment ZIP renderer over a shared stored-entry ZIP writer.
- `@acme/evidence-auth`: provider-neutral principals, organizations,
  organization/case memberships, case/workspace bindings, protected BFF
  sessions and pure deny-by-default ADR-0035/0036 policies.
- `@acme/adapter-evidence-auth-memory`,
  `@acme/adapter-evidence-auth-postgres` and
  `@acme/adapter-evidence-auth-supabase`: deterministic identity/session test
  seams, durable independent identity persistence and verified hosted
  credential/JWKS transport respectively.
- `@acme/adapter-evidence-product-file` and
  `@acme/adapter-evidence-product-postgres`: atomic local/durable product
  repository implementations, including case-bound artifact metadata,
  synthetic text-import/redaction records and security audit, separate from
  the ACME ledger. PostgreSQL migration v5 owns the Stage 5 tables.
- `@acme/evidence-views`: pure registered primary work-queue, source-review,
  observation-ledger, account-comparison, relation-review, timeline and open-
  question view contracts/builders plus gated technical provenance/replay
  views, assessment/review-history primary views, stable citations and the
  vocabulary guard.
- `@acme/evidence-testing`: exact synthetic corpus plus manifest/open/sealed
  truth loaders, deterministic golden builder, identity vectors, the `DEV-T01`
  mock fixture, truth-free deterministic evaluation candidates and product/view
  conformance registrars. Sealed evaluation truth is isolated on
  `./evaluation`; prompt-capable source is blocked from importing it.
- `@acme/testing`: reusable ExecutionRepository, ModelGateway, DomainModule
  and QualityEvaluationStore conformance, typed test support and the
  ScenarioRunner over `acme-scenario/1` and `acme-scenario/2`. It depends only
  on `@acme/core` and `@acme/evaluation`; the caller injects composition and
  fixture loading.
- `@acme/cli`: the composition root. It is the only place that selects a
  concrete repository adapter, quality store and model gateway (`--script`
  mock or `--gateway openai`), and it exposes `scenario run`, `execute`,
  `execution replay|inspect|stranded|discharge`, `state inspect`,
  `memory inspect`, `outbox inspect|drain|redrive` and
  `quality list|inspect|judge` over both the in-memory and durable SQLite
  repositories.
- `@acme/test-ui`: the Domain Test UI (ADR-0019 to ADR-0024, ADR-0027). Phases
  1–6 are view contracts for S1–S10, with the pure `acme-view-quality-evaluation/1`
  (S11) added by ACME-0067; ACME-0045–0053 add pure HTML renderers
  (`src/web/`) and a complete S1–S10 loopback workbench serve on `./local`,
  including bounded registry/scenario/fixture catalog, protected offline
  browser preview/launch and protected single-execute live browser launch.
  Includes plan compiler, launch path, measurement, fixture review and gated
  live evaluation. ACME-0069 adds `src/local/job-runner.ts` and
  `src/job-record.ts`, so browser launch enqueues and can be cancelled while
  synchronous `launchPlan` stays available. Default entry performs no I/O;
  discovery on `./node-source`. Leaf package.
- `@acme/evidence-workbench-api`, `@acme/evidence-workbench-worker` and
  `@acme/evidence-workbench-web`: the Evidence loopback and hosted reviewer
  case-first composition through primary open-question views.
  The API owns commands/queries and local composition, the bounded in-process
  worker owns job progress/cancellation, and the dependency-free HTML shell
  consumes only product endpoints. It serves source review, observation
  ledger, account comparison, relation review, timeline, open questions,
  assessment/re-review, immutable history and reviewed ZIP export; technical
  audit defaults to disabled. ACME-0091 adds login/logout/session BFF routes,
  CSRF/origin enforcement and server-derived authenticated review decisions;
  ACME-0095 adds encrypted artifact hydration, product security audit and
  case-admin artifact inspection, re-wrap and revisioned deletion. ACME-0097
  adds the Documents import view, immutable redaction draft/apply flow and
  restart-safe case-first records. ACME-0105 adds the closed
  `evidence-poc1-live/1` capability: strict case confirmation, case-admin-only
  authority, Stage A source-origin guard, hosted PostgreSQL and durable payload
  key are required before an OpenAI gateway can be released. ACME-0106 adds
  capability-gated Stage A case creation and authenticated text import with
  parent-PDF/extraction provenance. ACME-0107 adds
  `src/live-observation.ts`, additive live command/job/audit contracts and one
  authenticated browser/API `observe-artifact` job with durable resume.
  ACME-0108 adds `src/live-relation.ts`, a capability-gated browser/API
  `relate-observations` job and atomic relation/open-question projection with
  no-second-call restart. ACME-0110 adds `src/live-assessment.ts`, source-
  complete assessment input, live job/audit contracts and the primary review/
  late-evidence/reassessment proof. ADR-0041/ACME-0112 version the active
  observation prompt to a bounded candidate batch with an
  8,192-token output bound while keeping historical versions registered.
  ACME-0137 adds `coverage.ts`, input `/2` and live window iteration so
  full-source observation is a workflow over 64-segment windows.
  ACME-0138 versions active observe to `@1.9.0` output `/5` with a
  `segmentCoverage` ledger and `0..N` atomic observations per segment.
  ADR-0042/ACME-0114 then activate `@1.3.0` output `/2`, remove provider line
  fields, derive unique exact-quote locators in runtime and retain all three
  historical contracts for replay.
  ACME-0116 adds active `@1.4.0` output `/3` with short single-line quote bounds
  and date-less temporal `unknown` instructions while retaining `@1.3.0`.
  ACME-0117 records that strict one-line provider output is still not canonical
  source authority: five of eight candidates failed exact binding, so the next
  offline contract must make runtime-defined bounded segments authoritative.
  ADR-0043/ACME-0118 implement that active `@1.5.0` output `/4` contract and
  retain `@1.0.0`–`@1.4.0` for replay.
  ACME-0120 adds prompt-only active `@1.6.0` canonical UTC grammar and retains
  `@1.5.0` exactly.
  ACME-0121 records the first committed real-provider observation batch under
  `@1.6.0`; ACME-0122 aligns the live and PostgreSQL success-code assertions
  with the worker's established `LIVE_OBSERVATION_COMPLETED` result.
  `tests/live/evidence-stage-a-reviewer-journey.test.ts` is ACME-0123's
  fail-closed two-source Stage A domain-journey gate; it requires explicit
  live authority and never enters the default test suite.
- `tooling/typescript/`: shared strict ESM compiler configuration.
- `tooling/boundaries/`: dependency graph, core vocabulary and negative
  core, module, cross-module and SQLite-driver fixture verification.
- `tooling/docs/`: internal Markdown link and fence verification.
- `.github/workflows/ci.yml`: secret-free mirror of local verification gates.

## Planned Structure

NarrativeModule and ResearchModule phases 1–5, the bounded ExecutionEngine,
the durable SQLite adapter, the OpenAI Responses adapter (with schema
lowering and a live success path), ScenarioRunner v1/v2, post-execution
quality evaluation and the CLI composition root are implemented. The
live-model path is experimental and opt-in; the CLI
selects the mock through `--script` or OpenAI through `--gateway openai`.
Further packages and workers must be added only by explicitly activated tasks.

The two reference-module build and test plans under `docs/design/` are the
normative implementation guides. Their `docs/presentations/` DOCX renditions
are ACME-0010 review snapshots; the Markdown guides remain normative after
later architecture decisions. ADR-0008 resolves their post-memory
state-projection gate, ADR-0009 resolves their identity/provenance gate and
ACME-0015 supplies their shared executable DomainModule-conformance gate.
`docs/design/domain-test-ui-specification.md` specifies the `apps/test-ui`
composition-root application (module and adapter workbenches, view contracts,
optional `acme-test-plan/1`). ACME-0039 accepted its gate freezes in ADR-0019
and delivered phases 0 and 1; ACME-0040 through ACME-0053 added phases 2–6,
the loopback HTML workbench, protected offline plan preview/launch and catalog
rendering for S1–S10 under ADR-0020 through ADR-0024. ACME-0069 added async
launch, progress and cancellation under ADR-0027. Multi-step live scenarios run
through ScenarioRunner `composition.gateway: openai` (ACME-0064); S10 stays
single-execute by decision (ADR-0023). A non-authority workbench mock lives
under `docs/concepts_sandbox/temp/`.

`docs/design/evidence-integrity-workbench-technical-specification.md` is the
normative POC #1 implementation plan. Slices 0–8 are delivered; ACME-0087 and
corrective child ACME-0089 completed Slice 5's source-bound assessment journey.
ADR-0035 now decides the Stage 2 Supabase Auth/BFF-session, product-principal,
organization-membership and deny-by-default role architecture; ACME-0091
implements it in the new auth packages and Evidence workbench apps. The
approved later sequence is
recorded in
`docs/design/evidence-integrity-workbench-product-completion-plan.md`; ADR-0040
is the separate authority for the sole Stage A class.

ADR-0036 decides the Stage 3 case/workspace management and isolation boundary:
case-first product routes, explicit case roles, immutable case-object ownership
and same-organization isolation proofs over uniquely bound internal workspaces.
ACME-0093 implements it and remains synthetic-only. ADR-0037/ACME-0095 add the
secure artifact foundation, ACME-0097 adds bounded synthetic ingestion and
redaction, and ACME-0106 adds only ADR-0040's Stage A import class.

ADR-0040 distinguishes permanent Evidence Workbench invariants from the
synthetic/test phase controls. It authorizes one bounded Stage A anonymized
judicial text class. ACME-0105 implements its fail-closed PostgreSQL/live-
provider/external-source/authorized-execution capability and ACME-0106 adds the
case/import/browser data path. ACME-0107 opens the bounded observation
operation and ACME-0108 opens bounded relation/open-question analysis over its
committed observations. ACME-0110 completes the Stage A engineering journey
through reviewed assessment and reassessment. ADR-0041/ACME-0112 define the
observation operation as one bounded non-exhaustive candidate batch after the
first provider acceptance attempt failed closed. ADR-0042/ACME-0114 move
canonical locator authority from model output into exact runtime derivation;
ACME-0116 then bounds active quotes to one short source line and tightens the
temporal generation rule. ACME-0117 proves that the provider can still compress
or alter text inside that wire shape. ADR-0043/ACME-0118 implement the
deterministic successor: provider output selects one runtime-defined segment ID
and runtime derives the immutable quote/locator. Stage B remains closed.
ACME-0127 versions the active relation prompt to `@1.1.0` so strict sorted-set
and endpoint-order rules are explicit, while the historical `@1.0.0` contract
remains registered byte-exact for replay.
ACME-0128 similarly versions active assessment to `@1.2.0` with explicit
sorted-set output rules and retains both `@1.0.0` and `@1.1.0` byte-exact for
replay.

`docs/design/gap-resolution-plan.md` (ACME-0056) inventories every Persistent
Gaps item (G01–G19), groups them into work packages with ordered steps and ADR
constraints, and recommends an activation order. It does not authorize
implementation; each package needs its own activated ACME task.

`docs/concepts_sandbox/` holds explicitly excluded concept work. Nothing in it
is decided architecture, roadmap or current scope, and no task may cite it as
authority.

The `docs/backlog/` proposals record residual work. ADR-0035's authentication/
authorization proposal is retained as implemented discovery context. Driver-error
classification is resolved (ACME-0057); the file remains as resolved context.
Domain Test UI implementation notes remain for optional residuals. Resolved
proposals may stay for discovery context or be removed once finished.
