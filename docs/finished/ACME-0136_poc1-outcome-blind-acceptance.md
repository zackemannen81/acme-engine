# Current Task

Task ID: ACME-0136
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Task Summary

Ran the second POC #1 outcome-blind, closed-evidence acceptance of the
Evidence Integrity Workbench against a new case built only from
`source-A.pdf` and `source-B.pdf`.

## Result

**FAIL.** The frozen report is
[`docs/acceptance/ACME-0136-frozen-acceptance-report.md`](../acceptance/ACME-0136-frozen-acceptance-report.md).
Post-freeze comparison is
[`docs/acceptance/ACME-0136-post-freeze-comparison.md`](../acceptance/ACME-0136-post-freeze-comparison.md)
and does not alter the frozen result.

## Charter

Unchanged from the frozen `Ready` charter: decide whether the product can
import real investigation material and present a usable domain result
through the normal Workbench path.

## Checklist

- [x] Freeze the charter.
- [x] Confirm the Workbench is reachable and start a new case.
- [x] Import source-A and source-B only.
- [x] Run live observation on each imported source.
- [x] Review candidates through the product's normal rules.
- [x] Run live relation analysis and live assessment if the product offers them.
- [x] Inspect the listed product surfaces.
- [x] Freeze the acceptance report.
- [x] Open the sealed source and compare without altering the frozen report.
- [x] Reality-sync docs and archive.

## Verification

- [x] Case id, hashes, executions, usage and cost recorded from product evidence.
- [x] Sealed source unopened until freeze.

## Documentation Updates

- [x] `docs/acceptance/ACME-0136-frozen-acceptance-report.md`
- [x] `docs/acceptance/ACME-0136-post-freeze-comparison.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/JOURNAL.md`

## Handoff and Follow-ups

- Next: ADR-0045 §6 full-source coverage; date-only temporal bounds; the
  409 revision mismatch on ledger/relations/questions after a two-import
  case; source-A live observation `INVALID_REQUEST`.
- The acceptance case remains in PostgreSQL database `acme0136`.
