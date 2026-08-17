# Current Task

Task ID: ACME-0145
Parent Task: None
Status: Complete
Owner: Grok
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Task Summary

The 0142 planner advertised 150–350-word blocks with a soft 600-word
maximum, but it only merged small paragraphs. This task implements the
missing split half and sizes structural coverage windows for block-scale
units.

## Task Charter

Frozen at Ready.

### Goal

Oversized paragraph blocks split at sentence boundaries toward 150–350
words, and new structural Analyze windows stay readable.

### Primary Deliverable

`evidence-source-structure-rules/2` that splits oversized paragraph
units without splitting a sentence or a Q+A pair, plus a structural
coverage window sized for those blocks rather than the 64-line
historical constant.

### In Scope

- Split paragraph units that exceed the documented target at sentence
  or blank-line boundaries toward 150–350 words (soft 600).
- Never split inside a sentence, between a question and its answer, or
  between a heading and the text it governs.
- Bump the structure rule version so `structureId` changes with the
  algorithm. Keep schema `evidence-source-structure/1`.
- Size `planEvidenceStructuralObservationCoverage` for block-scale
  segments. Leave the line-segment window at 64.
- Tests: interview fixture still yields Q+A blocks; a long no-blank-line
  exhibit yields multiple in-bounds paragraph blocks; an oversized Q+A
  answer is not split; historical `@1.10.0` request hashes stay pinned.
- Reality-sync docs.

### Out of Scope

- Re-running live Analyze on D1/D2.
- A new observe contract version. `@1.11.0` stays active.
- Recutting committed windows or changing quote binding.
- Changing observation identity or adding a model-authored statement
  field.
- Prompt changes aimed at avoiding `EVIDENCE_DUPLICATE_OBSERVATION`.
- Sentence-level segments inside an already in-bounds paragraph block.
- Helping the model, optimizing for PASS, or editing live DB/projections.

### Definition of Done

- A long paragraph-only exhibit without blank lines yields more than
  one paragraph block, each at most 600 words unless a single
  unsplittable sentence is larger.
- The synthetic interview fixture still yields heading + Q+A blocks.
- A Q+A pair is not split even when the answer exceeds 600 words.
- Structural coverage windows default to a block-scale size, not 64.
- Historical line-segment and `@1.10.0` request hashes remain byte-exact.
- Offline gates pass. Docs reflect rules/2.

### Minimum Verification Gates

- [x] Oversized paragraph split test
- [x] Interview Q+A fixture still holds
- [x] Oversized Q+A is not split
- [x] Structural window default is block-scale
- [x] Historical `@1.10.0` request-hash gate
- [x] typecheck, lint, format, boundaries, unit, docs

## Verification

```text
pnpm typecheck                         pass
pnpm lint                              pass
pnpm format                            pass
pnpm boundaries                        pass
pnpm docs:check                        263 Markdown files
pnpm test:unit                         798/798
pnpm test:conformance                  78/78
pnpm test:integration                  70/70
pnpm test:scenario                     26/26
```

Live Analyze was not re-run.

## Finalize When Complete

- Archive as `docs/finished/ACME-0145_oversized-source-block-split.md`.
