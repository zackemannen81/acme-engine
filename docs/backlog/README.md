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

## Naming and Status Rules

Discoverability: index. Every member of this directory is listed below.
Member state: required. Every member declares a `Status:` line under its
title.

A proposal's filename is a permanent identifier, not a status field.

`docs/JOURNAL.md`, `docs/finished/` and accepted ADRs are append-only or
archived unmodified, and they cite proposals by path. Renaming or moving a
proposal that history already cites would break those references, and the only
way to repair them would be to rewrite records that must not be rewritten.

Therefore:

- Never rename or move a proposal to express that it was resolved.
- Every proposal states its own state in a `Status:` line directly under its
  title, naming the resolving task or decision where one exists.
- This index is the at-a-glance surface. Read it, not the file listing, to see
  what is actually open.
- Every file in this directory appears in exactly one table below, and every
  row points at a file that exists.
- A resolved proposal is retained for discovery context unless it is actively
  misleading. Removal is a deliberate act, and it is only safe once nothing
  links to the file.

## Open Proposals

| Proposal | State |
| --- | --- |
| [`slice-9-prerequisite-checklist.md`](slice-9-prerequisite-checklist.md) | Open working checklist from 2026-08-14. ADR-0040 grants Stage A authority; this file tracks the remaining executable gates and the prerequisites for every later data class |
| [`domain-test-ui-implementation.md`](domain-test-ui-implementation.md) | Partially resolved. Phases 0–6 and the complete S1–S10 browser flow shipped through ACME-0053, async launch through ACME-0069; the T2/T3/T4 residuals remain optional and unactivated |

## Resolved and Retained

Kept as discovery context and as link targets for the records that cite them.
None of these are open work.

| Proposal | Resolution |
| --- | --- |
| [`driver-error-classification.md`](driver-error-classification.md) | Resolved by ACME-0057 (2026-08-06) |
| [`prose-path-citations-unchecked.md`](prose-path-citations-unchecked.md) | Resolved by ACME-0170 (2026-08-19) |
| [`evidence-authentication-authorization-implementation.md`](evidence-authentication-authorization-implementation.md) | Implemented by ACME-0091 under ADR-0035 |
| [`postgres-gate-test-hygiene.md`](postgres-gate-test-hygiene.md) | Fixed by ACME-0167 |
| [`hrd-documentation-update.md`](hrd-documentation-update.md) | Resolved; documentation now matches the actual `docs/hrd/` content |
| [`local-workbench-durable-ledger.md`](local-workbench-durable-ledger.md) | Not applicable; POC #1 accepted as is. Never activated |
| [`poc1-live-product-acceptance.md`](poc1-live-product-acceptance.md) | Not applicable; POC #1 accepted as is. Never activated |
| [`v2-degenerate-chain-subject.md`](v2-degenerate-chain-subject.md) | Not applicable; observed during ACME-0157 and accepted. Never activated |
| [`v2-index-run-part-boundary.md`](v2-index-run-part-boundary.md) | Not applicable; POC #1 accepted as is. Never activated |
| [`v2-interface-deferred-features.md`](v2-interface-deferred-features.md) | Not applicable; deferred out of the 2.0 request and outside the V1 boundary. Never activated |

## Removed Proposals

Some earlier proposals were removed from this directory after being archived
under `docs/finished/`: ACME-0029 closed the strict structured-output schema
work and ACME-0030 closed encrypted-payload retention. Historical records
still mention those filenames in prose. Prefer retention over removal for
anything that is cited as a link.
