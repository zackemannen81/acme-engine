# Current Task

Task ID: ACME-0142
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Task Summary

Derive document-native SourceBlock / SourceSegment units from canonical
text, and allow coverage windows to carry context-only neighbours.

## Task Charter

Frozen at Ready.

### Goal

Model-free `SourceBlock` / `SourceSegment` derivation from canonical
text. Coverage windows are sets of those segments plus optional
context-only neighbours.

### Primary Deliverable

A module-owned planner that yields Q+A / paragraph blocks for a
synthetic interview fixture, an additive observe contract version that
can name neighbour context, and semantics that refuse an observation
whose sole support is a context id. Historical line-segment contracts
remain registered and replay.

### In Scope

- New module-owned planner. Persist block/segment graph as an immutable
  derivation of one artifact version (hash of rule version + text).
- Observe input continues to name `sourceSegmentId`.
- Prompt: context is not extractable.
- Line locators still derived for each segment so existing citation
  views work.
- UI may show block headings in the source view.

### Out of Scope

- Changing quote binding to a new locator scheme.
- Pass 2/3.
- UI rewrite beyond showing block headings in the source view.
- Recutting committed windows or existing line-segment observations.
- Claim surface (0143). Continuity / exposure (0144).

### Definition of Done

- A synthetic interview fixture yields Q+A blocks, not one line per
  segment.
- Historical line-segment contracts still replay.
- A neighbour-context window refuses an observation that only cites a
  context id.
- New analyzes on a source may use the new planner under a new observe
  contract version.

### Minimum Verification Gates

- [x] Q+A block planner test on a synthetic interview fixture
- [x] Historical line-segment replay / request-hash gate
- [x] Neighbour-context sole-support refusal
- [x] typecheck, lint, format, boundaries, unit, docs

## Verification

```text
pnpm typecheck                         pass
pnpm lint                              pass
pnpm format                            pass
pnpm boundaries                        pass
pnpm docs:check                        261 Markdown files
pnpm test:unit                         793/793
pnpm test:conformance                  78/78
pnpm test:integration                  70/70
pnpm test:scenario                     26/26
```

## Finalize When Complete

- Archive as `docs/finished/ACME-0142_source-blocks-neighbour-context.md`.
