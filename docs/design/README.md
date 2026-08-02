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
  continued through ACME-0042: the gate freezes are accepted in
  [`../adr/0019-domain-test-ui-boundary-and-view-contracts.md`](../adr/0019-domain-test-ui-boundary-and-view-contracts.md)
  and phases 0–4 (boundary, the S1–S7 view contracts, the `acme-test-plan/1`
  compiler under ADR-0020, and launch and history under ADR-0021) are
  implemented. Phases 5–6 each need their own charter. Implementation backlog:
  [`../backlog/domain-test-ui-implementation.md`](../backlog/domain-test-ui-implementation.md).

Design documents describe the integrated system. Individual durable decisions
that constrain future change belong in `docs/adr/`.
