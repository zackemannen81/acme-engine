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
  continued through ACME-0051: the gate freezes are accepted in
  [`../adr/0019-domain-test-ui-boundary-and-view-contracts.md`](../adr/0019-domain-test-ui-boundary-and-view-contracts.md)
  and phases 0–6 plus the S1–S8 browser flow are implemented: package
  boundary, S1–S10 view contracts, `acme-test-plan/1`, launch/history,
  measurement, fixture review, gated live evaluation and protected offline
  browser launch, memory-decision inspection, state-lineage inspection and
  replay/digest verification and recorded-run measurement.
  Remaining surface renderers and multi-step live scenarios
  require their own charters. Implementation backlog:
  [`../backlog/domain-test-ui-implementation.md`](../backlog/domain-test-ui-implementation.md).

Design documents describe the integrated system. Individual durable decisions
that constrain future change belong in `docs/adr/`.
