# Current Task

Task ID: ACME-0143
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Task Summary

A read-only claim surface groups current occurrences by a stable aspect
and lists them as shared cards. Overlap is visible. No stored merge.

## Task Charter

Frozen at Ready.

### Goal

A projection that groups current occurrences by a stable aspect key
(actor label, place string, vehicle string, or an existing relation
scope) and lists them as cards.

### Primary Deliverable

A read-only view + route. Reuse the 0140 card. Optional sort: source
time vs asserted event time. Compare-accounts content is reachable as a
person thread here.

### Definition of Done

- Three “red Volvo” occurrences from two sources appear as three cards
  in one group, each opening its source.
- No stored merge.

## Verification

```text
pnpm typecheck                         pass
pnpm lint                              pass
pnpm format                            pass
pnpm boundaries                        pass
pnpm docs:check                        262 Markdown files
pnpm test:unit                         794/794
pnpm test:conformance                  78/78
pnpm test:integration                  70/70
pnpm test:scenario                     26/26
```

## Finalize When Complete

- Archive as `docs/finished/ACME-0143_claim-surface.md`.
