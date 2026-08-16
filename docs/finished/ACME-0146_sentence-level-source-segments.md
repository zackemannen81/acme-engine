# Current Task

Task ID: ACME-0146
Parent Task: None
Status: Complete
Owner: Grok
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Task Summary

Make the citable unit a sentence so 0..N observations from one
paragraph can carry distinct runtime-owned quotes.

## Task Charter

Frozen at Ready.

### Goal

Two independently usable propositions in one paragraph become two
observations with two quotes.

### Primary Deliverable

`evidence-source-structure-rules/3`: paragraph and Q+A-answer blocks
emit one segment per sentence; structural windows pack those segments
by a word budget with the existing 64-segment coverage ceiling.

## Verification

```text
pnpm typecheck                         pass
pnpm lint                              pass
pnpm format                            pass
pnpm boundaries                        pass
pnpm docs:check                        264 Markdown files
pnpm test:unit                         799/799
pnpm test:conformance                  78/78
pnpm test:integration                  70/70
pnpm test:scenario                     26/26
```

## Finalize When Complete

- Archive as `docs/finished/ACME-0146_sentence-level-source-segments.md`.
