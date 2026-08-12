# Design Documents

This directory contains complete system and package design specifications.

Current implementation baseline:

- [`acme-design-and-development-spec.md`](acme-design-and-development-spec.md)

Team implementation guides:

- [`narrative-module-build-and-test-plan.md`](narrative-module-build-and-test-plan.md)
- [`research-module-build-and-test-plan.md`](research-module-build-and-test-plan.md)

Application surfaces:

- [`evidence-integrity-workbench-product-completion-plan.md`](evidence-integrity-workbench-product-completion-plan.md)
  — approved sequencing from the completed synthetic Slice 5 product through
  later authentication, case isolation, secure ingestion, Case Integrity
  Report and Slice 9 readiness. ACME-0087/0089 completed the Slice 5
  prerequisite, ACME-0090/ADR-0035 decided the Stage 2 identity and
  authorization architecture, and ACME-0091 implements it. Stages 3–8 are
  delivered through ACME-0093/0095/0097/0098/0099/0100; only Stage 9 remains,
  and it is gated. The plan does not authorize real data or later stages.

- [`evidence-integrity-workbench-technical-specification.md`](evidence-integrity-workbench-technical-specification.md)
  — normative implementation plan for POC #1. It freezes the seven-artifact,
  eight-version synthetic corpus contract, Evidence identities and placement,
  primary versus technical-audit views, review overlay, deterministic export,
  proof matrix and separately activatable slices 0–9 under ADR-0030 and
  ADR-0031. ACME-0077–0087 plus corrective child ACME-0089 delivered slices
  0–8, including the full source-bound assessment/re-review product journey;
  every non-synthetic path still requires separate authority.

- [`evidence-integrity-workbench-product-definition.md`](evidence-integrity-workbench-product-definition.md)
  — accepted normative product definition for ACME's first real POC under
  [`ADR-0028`](../adr/0028-first-poc-evidence-integrity-workbench.md). It fixes
  the synthetic-corpus, source-bound authority, human-review and prohibited-
  legal-conclusion boundaries. It authorizes product direction, not
  implementation or real-data handling.

- [`domain-test-ui-specification.md`](domain-test-ui-specification.md) —
  Domain Test UI / TestRegistry Workbench. Activated by ACME-0039 and
  continued through ACME-0053: the gate freezes are accepted in
  [`../adr/0019-domain-test-ui-boundary-and-view-contracts.md`](../adr/0019-domain-test-ui-boundary-and-view-contracts.md)
  and phases 0–6 plus the S1–S10 browser flow are implemented: package
  boundary, S1–S10 view contracts, `acme-test-plan/1`, launch/history,
  measurement, fixture review, gated live evaluation and protected offline
  browser launch, memory-decision inspection, state-lineage inspection and
  replay/digest verification, recorded-run measurement, fixture review and
  protected single-execute live browser launch. ACME-0069 added async launch,
  progress and cancellation under
  [`../adr/0027-async-launch-job-progress-cancellation.md`](../adr/0027-async-launch-job-progress-cancellation.md).
  Multi-step live scenarios run through ScenarioRunner (ACME-0064); S10 stays
  single-execute by decision. Implementation backlog:
  [`../backlog/domain-test-ui-implementation.md`](../backlog/domain-test-ui-implementation.md).

Residual planning:

- [`gap-resolution-plan.md`](gap-resolution-plan.md) — ACME-0056 inventory of
  persistent gaps (G01–G19), work packages, ADR constraints and recommended
  activation order. Planning artifact only; does not authorize implementation.

Design documents describe the integrated system. Individual durable decisions
that constrain future change belong in `docs/adr/`.
