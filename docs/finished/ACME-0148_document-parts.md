# Current Task

Task ID: ACME-0148
Parent Task: None
Status: Complete
Owner: Grok
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Task Summary

Derive document-native parts so a large judicial extract can be opened
and analyzed one förhör, analysis or bounded slice at a time.

## Task Charter

Frozen at Ready.

### Goal

A reviewer can open and analyze one named part of a large source
without loading or paying for the rest.

### Primary Deliverable

Deterministic `SourcePart` cards on the source stream, a part-scoped
source view, and part-scoped live Analyze.

## Verification

```text
pnpm typecheck                         pass
pnpm lint                              pass
pnpm docs:check                        266 Markdown files
pnpm test:unit                         800/800
```

## Finalize When Complete

- Archive as `docs/finished/ACME-0148_document-parts.md`.
