# Current Task

Task ID: ACME-0141
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Task Summary

Documents becomes the case source chronology: ingest order, coverage
counts, analyze progress already reports window i of n.

## Task Charter

Frozen at Ready.

### Goal

A reviewer can walk sources in the order they entered and see coverage
on each source card.

### Primary Deliverable

Text-import list sorted by acquired/ingest time. Document cards show
that time and observation coverage. `?view=stream` opens Documents.

### In Scope

- Sort `/api/text-imports` by `acquiredAt` then `createdAt`.
- Document cards show ingest time and coverage (total / awaiting).
- `?view=stream` aliases documents. Default entry stays overview.

### Out of Scope

- Structural blocks (0142). Claim surface (0143). Navigation rewrite.
- Changing default home away from overview.

### Definition of Done

- Imports with earlier `acquiredAt` appear first.
- Each activated source card shows observation coverage.
- `?view=stream` opens the documents surface.

### Minimum Verification Gates

- [x] Sort/coverage test or black-box assertion
- [x] Shell contains view=stream
- [x] typecheck, lint, test, docs

## Checklist

- [x] Freeze charter.
- [x] Sort import list.
- [x] Coverage on cards.
- [x] view=stream.
- [x] Docs, commit, push.

## Verification

```text
pnpm typecheck                         pass
pnpm lint                              pass
pnpm format                            pass
pnpm boundaries                        pass
pnpm docs:check                        260 Markdown files
pnpm test:unit                         790/790
pnpm test:conformance                  78/78
pnpm test:integration                  70/70
pnpm test:scenario                     26/26
```

## Finalize When Complete

- Archive as `docs/finished/ACME-0141_source-stream-home.md`.
