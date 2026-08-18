# Backlog Proposals

This directory contains non-activated work proposals discovered outside the
active task's frozen charter.

A proposal should record:

- discovery context
- proposed outcome
- why it is outside the active task
- dependencies
- suggested verification

Assign an `ACME-NNNN` Task ID only when the proposal is explicitly activated
as `docs/CURRENT_TASK.md`.

## Proposals

| Proposal | Status |
| --- | --- |
| [`domain-test-ui-implementation.md`](domain-test-ui-implementation.md) | Core phases 0–6 and complete S1–S10 browser flow delivered through ACME-0053; async launch delivered by ACME-0069; T2/T3/T4 residuals remain optional |
| [`driver-error-classification.md`](driver-error-classification.md) | Resolved by ACME-0057; kept for discovery context |
| [`local-workbench-durable-ledger.md`](local-workbench-durable-ledger.md) | Proposed 2026-08-12; the local file composition cannot serve state-projecting views after a restart because its ACME ledger is in memory |
| [`slice-9-prerequisite-checklist.md`](slice-9-prerequisite-checklist.md) | Working checklist 2026-08-14; ADR-0040 now grants Stage A authority, while this file tracks its remaining executable gates and the prerequisites for later classes |
| [`v2-interface-deferred-features.md`](v2-interface-deferred-features.md) | Proposed 2026-08-18; the analysis report, person-level relations and relation graph visualisation requested for Evidence Workbench 2.0, all outside the V1 boundary |

Resolved proposals are removed from this directory once archived under
`docs/finished/` (ACME-0029 closed strict structured-output schema work;
ACME-0030 closed encrypted-payload retention).
