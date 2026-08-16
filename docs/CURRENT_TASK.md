# Current Task

Task ID: ACME-0143
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
- `docs/design/evidence-workbench-source-and-claim-surfaces.md` §2.3, §5 ACME-0143
- `docs/finished/ACME-0142_source-blocks-neighbour-context.md`

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

### In Scope

- Read-only view + route.
- Reuse the 0140 card.
- Optional sort: source time vs asserted event time.
- Overlap is visible. `corroborates` is not auto-assigned.

### Out of Scope

- Information-exposure types.
- Knowledge-time replay slider.
- Assessment rewrite.
- Continuity / exposure job (0144).
- Automatic `corroborates` from string overlap.

### Definition of Done

- Three “red Volvo” occurrences from two sources appear as three cards
  in one group, each opening its source.
- No stored merge.

### Minimum Verification Gates

- [ ] Claim-group view test with three unmerged cards
- [ ] Shell contains view=claim
- [ ] typecheck, lint, format, unit, docs

## References

- ADR-0046
- `docs/design/evidence-workbench-source-and-claim-surfaces.md`
- `packages/evidence-views`

## Checklist

- [x] Freeze charter.
- [ ] Pure claim-group view builder.
- [ ] Route and `?view=claim`.
- [ ] Sort source time vs event time.
- [ ] Tests, docs, archive, commit, push.

## Decisions and Notes

- Grouping is a projection. Occurrences stay source-bound.
- Compare-accounts becomes a person thread inside Claim.

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
- Next recommended step: implement the claim-group view.
- Blockers: none.

## Finalize When Complete

- Archive as `docs/finished/ACME-0143_claim-surface.md`.
- Charter ACME-0144 from the surfaces spec.
