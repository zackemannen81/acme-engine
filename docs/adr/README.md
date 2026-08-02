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
