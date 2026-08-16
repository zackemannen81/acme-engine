# Current Task

Task ID: ACME-0144
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
- `docs/design/evidence-workbench-source-and-claim-surfaces.md` §2.3, §5 ACME-0144
- `docs/finished/ACME-0143_claim-surface.md`

## Task Summary

Additive relation families for statement evolution and information flow.
A Pass 2/3 job over frozen occurrences only.

## Task Charter

Frozen at Ready.

### Goal

Represent statement evolution and information flow as reviewable
relations over frozen occurrences, without deleting earlier ones.

### Primary Deliverable

New relation codes; a new optional live/offline job; reviewable like
today’s relations. UI shows those relations on the claim group and on
the card.

### In Scope

- New relation codes for continuity and information flow.
- New optional live/offline job over frozen occurrences only.
- Reviewable like today’s relations.
- Interview question may be modelled as a procedural occurrence if the
  observe contract already emits it; otherwise a minimal additive
  occurrence kind.

### Out of Scope

- Psychological or credibility scoring.
- Automatic `corroborates` from exposure.
- Legal conclusions.
- Knowledge-time replay slider.

### Definition of Done

- The X#1 “unknown colour” → X#2 “maybe red Volvo” after a question
  that named the colour can be represented as `changes_certainty` +
  `prompted_by` without deleting X#1.

### Minimum Verification Gates

- [ ] Continuity / exposure relation codes and semantic tests
- [ ] Offline job or fixture representing the X#1 → X#2 example
- [ ] typecheck, lint, format, unit, docs

## References

- ADR-0046
- `docs/design/evidence-workbench-source-and-claim-surfaces.md`

## Checklist

- [x] Freeze charter.
- [ ] Additive relation codes.
- [ ] Pass 2/3 job over frozen occurrences.
- [ ] Show relations on claim group and card.
- [ ] Tests, docs, archive, commit, push.

## Decisions and Notes

- Pass 1 must not receive prior interviews. Pass 2/3 may.
- `corroborates` is not inferred from overlap plus exposure.

## Charter Amendment Log

- None.

## Verification

- [ ] Record offline commands and results.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` when structure changes

## Finalize When Complete

- Archive as `docs/finished/ACME-0144_continuity-information-exposure.md`.
- Restore the task template or the next approved task.
