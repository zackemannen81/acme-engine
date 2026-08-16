# Current Task

Task ID: ACME-0142
Parent Task: None
Status: Ready
Owner: Claude
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- ADR-0046
- `docs/design/evidence-workbench-source-and-claim-surfaces.md` §2.1, §5 ACME-0142
- `docs/finished/ACME-0141_source-stream-home.md`

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

- [ ] Q+A block planner test on a synthetic interview fixture
- [ ] Historical line-segment replay / request-hash gate
- [ ] Neighbour-context sole-support refusal
- [ ] typecheck, lint, format, boundaries, unit, docs

## References

- ADR-0046
- `docs/design/evidence-workbench-source-and-claim-surfaces.md`
- `packages/module-evidence/src/coverage.ts`
- `packages/module-evidence/src/contracts/observe-artifact.ts`

## Checklist

- [x] Freeze charter.
- [ ] Planner: blocks then segments, hash of rule version + text.
- [ ] Persist derivation per artifact version.
- [ ] New observe contract version + neighbour context input.
- [ ] Prompt and semantics: context is not extractable.
- [ ] Source view may show block headings.
- [ ] Tests, docs, archive, commit, push.

## Decisions and Notes

- Existing line-segment observations remain. New analyzes only.
- Segment identity is immutable for that artifact version.
- Soft block size ~150–350 words, never split a sentence or Q+A pair.
- Window size stays 64 extractable segments.

## Charter Amendment Log

- None.

## Verification

- [ ] Record offline commands and results.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` when structure changes

## Handoff and Follow-ups

- Current state: charter frozen; implementation not started.
- Next recommended step: implement the planner against a synthetic
  interview fixture.
- Blockers: none.
- Child tasks: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0142_source-blocks-neighbour-context.md`.
- Charter ACME-0143 from the surfaces spec.
