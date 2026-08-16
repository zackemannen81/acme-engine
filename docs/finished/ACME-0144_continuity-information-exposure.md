# Current Task

Task ID: ACME-0144
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Task Summary

Additive relation families for statement evolution and information flow.
A Pass 2/3 job over frozen occurrences only.

## Task Charter

Frozen at Ready.

### Goal

Represent statement evolution and information flow as reviewable
relations over frozen occurrences, without deleting earlier ones.

### Definition of Done

- The X#1 “unknown colour” → X#2 “maybe red Volvo” after a question
  that named the colour can be represented as `changes_certainty` +
  `prompted_by` without deleting X#1.

## Verification

```text
pnpm typecheck                         pass
pnpm lint                              pass
pnpm format                            pass
pnpm boundaries                        pass
pnpm docs:check                        263 Markdown files
pnpm test:unit                         795/795
pnpm test:conformance                  78/78
pnpm test:integration                  70/70
pnpm test:scenario                     26/26
```

## Finalize When Complete

- Archive as `docs/finished/ACME-0144_continuity-information-exposure.md`.
