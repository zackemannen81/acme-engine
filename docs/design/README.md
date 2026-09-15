# Design Documents

Discoverability: index. Every member of this directory is listed below,
and members are never renamed or moved to express a change of state.
Member state: required. Every member declares a `Status:` line under its
title.

This directory contains complete system and package design specifications.

POC #1 is frozen. The operator pack is
[`../poc-1/README.md`](../poc-1/README.md).

Current implementation baseline:

- [`acme-design-and-development-spec.md`](acme-design-and-development-spec.md)

Team implementation guides:

- [`narrative-module-build-and-test-plan.md`](narrative-module-build-and-test-plan.md)
- [`research-module-build-and-test-plan.md`](research-module-build-and-test-plan.md)

Discovery and selection:

- [`first-poc-application-discovery.md`](first-poc-application-discovery.md)
  — the bounded comparison that selected ACME's first product proof of
  concept, decided by [`ADR-0028`](../adr/0028-first-poc-evidence-integrity-workbench.md).

Application surfaces:

- [`evidence-integrity-workbench-product-completion-plan.md`](evidence-integrity-workbench-product-completion-plan.md)
  — approved sequencing from the completed synthetic Slice 5 product through
  later authentication, case isolation, secure ingestion, Case Integrity
  Report and Slice 9 readiness. ACME-0087/0089 completed the Slice 5
  prerequisite, ACME-0090/ADR-0035 decided the Stage 2 identity and
  authorization architecture, and ACME-0091 implements it. Stages 3–8 are
  delivered through ACME-0093/0095/0097/0098/0099/0100. ADR-0040 now
  authorizes only the Stage A anonymized judicial text class. ACME-0105
  implements its closed composition capability and ACME-0106 implements
  capability-gated import/browser activation; the live job and later classes
  remain closed.

- [`evidence-integrity-workbench-technical-specification.md`](evidence-integrity-workbench-technical-specification.md)
  — normative implementation plan for POC #1. It freezes the seven-artifact,
  eight-version synthetic corpus contract, Evidence identities and placement,
  primary versus technical-audit views, review overlay, deterministic export,
  proof matrix and separately activatable slices 0–9 under ADR-0030 and
  ADR-0031. ACME-0077–0087 plus corrective child ACME-0089 delivered slices
  0–8, including the full source-bound assessment/re-review product journey;
  ADR-0040 supplies separate authority for one Stage A class and ACME-0106
  implements its import half; Stage B and every broader path still require
  their own decision.

- [`evidence-integrity-workbench-product-definition.md`](evidence-integrity-workbench-product-definition.md)
  — accepted normative product definition for ACME's first real POC under
  [`ADR-0028`](../adr/0028-first-poc-evidence-integrity-workbench.md). It fixes
  the synthetic-corpus, source-bound authority, human-review and prohibited-
  legal-conclusion boundaries. ADR-0040 adds the narrow Stage A live
  applicability decision without weakening those permanent rules.

- [`evidence-workbench-source-and-claim-surfaces.md`](evidence-workbench-source-and-claim-surfaces.md)
  — accepted implementation, migration and UX specification for
  [`ADR-0046`](../adr/0046-source-chronology-and-claim-projection.md).
  Origin and claim stay two graphs over one occurrence. Delivery is six
  stoppable children (ACME-0139–0144), implemented. ACME-0145 completes
  the 0142 size bounds as `evidence-source-structure-rules/2`. ACME-0146
  makes the citable unit a sentence (`rules/3`). ACME-0147 switches the
  default shell to Source stream / Claim / Stance / Search.

- [`evidence-workbench-v2-domain-specification.md`](evidence-workbench-v2-domain-specification.md)
  — proposed domain model, supported flow, V1 boundary, acceptance journeys and
  binding regression knowledge for the replacement Evidence application under
  [`ADR-0047`](../adr/0047-evidence-application-model-reset.md). Normative: the
  ADR is accepted and its §10 decisions are taken. It replaces the surface
  decided by ADR-0046 and inherits the product definition's authority ladder and
  immutable boundaries unchanged. Implementation is not activated by it.

- [`evidence-workbench-v2-interface-plan.md`](evidence-workbench-v2-interface-plan.md)
  — proposed sequencing for the Evidence Workbench 2.0 interface request:
  substrate activation on the running self-hosted Supabase (ACME-0156), the
  workbench shell and case status (ACME-0157), PDF import (ACME-0158), review
  and standing (ACME-0159), claims (ACME-0160), relations and instance
  comparison (ACME-0161) and the global timeline plus consensus (ACME-0162).
  Not activated. Two steps require decisions that do not exist yet: the V2
  surface set and the PDF ingestion boundary.

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
