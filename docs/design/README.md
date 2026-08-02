# Design Documents

This directory contains complete system and package design specifications.

Current implementation baseline:

- [`acme-design-and-development-spec.md`](acme-design-and-development-spec.md)

Team implementation guides:

- [`narrative-module-build-and-test-plan.md`](narrative-module-build-and-test-plan.md)
- [`research-module-build-and-test-plan.md`](research-module-build-and-test-plan.md)

Application surfaces:

- [`domain-test-ui-specification.md`](domain-test-ui-specification.md) —
  Domain Test UI / TestRegistry Workbench. Activated by ACME-0039 and
  continued by ACME-0040 and ACME-0041: the gate freezes are accepted in
  [`../adr/0019-domain-test-ui-boundary-and-view-contracts.md`](../adr/0019-domain-test-ui-boundary-and-view-contracts.md)
  and phases 0–3 (boundary, the S4–S7 read model, the S1 catalog and the
  `acme-test-plan/1` compiler under ADR-0020) are implemented. Phases 4–6 each
  need their own charter. Implementation backlog:
  [`../backlog/domain-test-ui-implementation.md`](../backlog/domain-test-ui-implementation.md).

Design documents describe the integrated system. Individual durable decisions
that constrain future change belong in `docs/adr/`.
