# Architecture Decision Records

Use ADRs for decisions that constrain multiple packages or future migrations.

## Naming

```text
NNNN-short-kebab-case-title.md
```

Example:

```text
0001-use-typescript-workspaces.md
```

## Statuses

- Proposed
- Accepted
- Superseded
- Deprecated
- Rejected

## Process

1. Copy `docs/adr/template.md`.
2. Describe context and decision drivers.
3. Record considered alternatives.
4. State the decision and consequences.
5. Link implementation tasks and superseded ADRs.

An ADR records why a decision exists. `SYSTEMDOC.md` records the resulting
current architecture.

## Accepted Decisions

- [`0001-typescript-pnpm-workspace.md`](0001-typescript-pnpm-workspace.md)
- [`0002-static-task-typed-module-composition.md`](0002-static-task-typed-module-composition.md)
- [`0003-sqlite-revisioned-unit-of-work.md`](0003-sqlite-revisioned-unit-of-work.md)
- [`0004-deterministic-transition-identity.md`](0004-deterministic-transition-identity.md)
- [`0005-pure-memory-decision-application.md`](0005-pure-memory-decision-application.md)
- [`0006-aggregate-in-memory-unit-of-work.md`](0006-aggregate-in-memory-unit-of-work.md)
- [`0007-deterministic-model-mock-and-gateway-conformance.md`](0007-deterministic-model-mock-and-gateway-conformance.md)
- [`0008-post-memory-domain-state-projection.md`](0008-post-memory-domain-state-projection.md)
- [`0009-reference-domain-identity-and-provenance.md`](0009-reference-domain-identity-and-provenance.md)
- [`0010-input-bound-validation-and-interpretation.md`](0010-input-bound-validation-and-interpretation.md)
- [`0011-narrative-knowledge-and-context-ownership.md`](0011-narrative-knowledge-and-context-ownership.md)
- [`0012-milestone-1-execution-identity-and-replay.md`](0012-milestone-1-execution-identity-and-replay.md)
- [`0013-durable-sqlite-schema-and-driver.md`](0013-durable-sqlite-schema-and-driver.md)
- [`0014-live-provider-boundary-and-transport-port.md`](0014-live-provider-boundary-and-transport-port.md)
- [`0015-strict-structured-output-schema-lowering.md`](0015-strict-structured-output-schema-lowering.md)
- [`0016-encrypted-payload-retention.md`](0016-encrypted-payload-retention.md)
- [`0017-durable-execution-resume.md`](0017-durable-execution-resume.md)
- [`0018-outbox-delivery-boundary.md`](0018-outbox-delivery-boundary.md)
- [`0019-domain-test-ui-boundary-and-view-contracts.md`](0019-domain-test-ui-boundary-and-view-contracts.md)
- [`0020-acme-test-plan-schema-and-compiler.md`](0020-acme-test-plan-schema-and-compiler.md)
- [`0021-interface-workspace-and-launch-boundary.md`](0021-interface-workspace-and-launch-boundary.md)
- [`0022-measurement-and-fixture-approval.md`](0022-measurement-and-fixture-approval.md)
- [`0023-live-evaluation-gate.md`](0023-live-evaluation-gate.md)
- [`0024-local-spa-loopback-workbench.md`](0024-local-spa-loopback-workbench.md)
- [`0025-post-execution-quality-evaluation.md`](0025-post-execution-quality-evaluation.md)
- [`0026-durable-quality-evaluation-store.md`](0026-durable-quality-evaluation-store.md)
- [`0027-async-launch-job-progress-cancellation.md`](0027-async-launch-job-progress-cancellation.md)
- [`0028-first-poc-evidence-integrity-workbench.md`](0028-first-poc-evidence-integrity-workbench.md)
- [`0029-poc-1-self-hosted-supabase-persistence-platform.md`](0029-poc-1-self-hosted-supabase-persistence-platform.md)
- [`0030-evidence-v1-identity-and-canonical-placement.md`](0030-evidence-v1-identity-and-canonical-placement.md)
- [`0031-evidence-review-overlay-and-versioned-views.md`](0031-evidence-review-overlay-and-versioned-views.md)
- [`0032-evidence-v1-correction-occurrence-pairing.md`](0032-evidence-v1-correction-occurrence-pairing.md)
- [`0033-postgresql-persistence-architecture.md`](0033-postgresql-persistence-architecture.md)
- [`0034-poc-1-hosted-shell-identity-and-topology.md`](0034-poc-1-hosted-shell-identity-and-topology.md)
- [`0035-evidence-authenticated-principal-and-authorization.md`](0035-evidence-authenticated-principal-and-authorization.md)
- [`0036-evidence-case-management-and-isolation.md`](0036-evidence-case-management-and-isolation.md)
- [`0037-evidence-secure-artifact-foundation.md`](0037-evidence-secure-artifact-foundation.md)
- [`0038-bounded-text-ingestion-and-immutable-redaction.md`](0038-bounded-text-ingestion-and-immutable-redaction.md)
- [`0039-evidence-workbench-live-model-boundary.md`](0039-evidence-workbench-live-model-boundary.md)
- [`0040-poc-1-live-product-applicability.md`](0040-poc-1-live-product-applicability.md)
- [`0041-bounded-observation-candidate-batches.md`](0041-bounded-observation-candidate-batches.md)
- [`0042-runtime-derived-observation-locators.md`](0042-runtime-derived-observation-locators.md)
- [`0043-runtime-derived-observation-quotes.md`](0043-runtime-derived-observation-quotes.md)
- [`0044-poc1-live-product-acceptance-phase.md`](0044-poc1-live-product-acceptance-phase.md)
- [`0045-real-material-scale-and-recovery.md`](0045-real-material-scale-and-recovery.md)
- [`0046-source-chronology-and-claim-projection.md`](0046-source-chronology-and-claim-projection.md)
- [`0047-evidence-application-model-reset.md`](0047-evidence-application-model-reset.md)
- [`0048-evidence-v2-observe-contract.md`](0048-evidence-v2-observe-contract.md)
- [`0049-evidence-v2-surface-set.md`](0049-evidence-v2-surface-set.md)
- [`0050-evidence-v2-pdf-ingestion-boundary.md`](0050-evidence-v2-pdf-ingestion-boundary.md)
