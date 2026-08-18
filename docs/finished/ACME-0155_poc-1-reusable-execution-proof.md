# Current Task

Task ID: ACME-0155
Parent Task: None
Status: Complete
Owner: Grok
Created: 2026-08-17
Last updated: 2026-08-17
Charter frozen at: 2026-08-17

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- [ADR-0047](../adr/0047-evidence-application-model-reset.md) §9
- [ADR-0048](../adr/0048-evidence-v2-observe-contract.md)
- [ACME-0154](ACME-0154_v2-observation-occurrence.md)
- `docs/CURRENT_STATUS.md`
- `docs/JOURNAL.md`

## Task Summary

ACME-0154 closed with a recorded live run: two planned and two spent provider
calls, 27 occurrences, a re-run that spent nothing, and encrypted payload
retention under a ledger key. That is the first measured proof that an
application can compose ACME's engine and get bounded execution, persist,
resume and retention without inventing that machinery.

This task packages that proof while it is still exact: a short summary, the
measured claims, the tests and ADRs that back them, the operator-saved
provider artifacts, and an honest account of where `packages/core` was and was
not adapted for the domain.

## Task Charter

Frozen at Ready.

### Goal

One durable, scoped proof summary that states exactly what the recorded live
run demonstrated about ACME as reusable execution machinery, and what it did
not.

### Primary Deliverable

`docs/acceptance/poc-1-reusable-execution-proof.md`

### In Scope

- A short proof summary with the measured claims and their bounds.
- Links to ADR-0048, ADR-0047 §9, ACME-0154 and the tests that assert each
  property.
- Cataloguing of the operator-saved provider artifacts already committed under
  `docs/hrd/`, labelled for what they actually contain.
- An explicit account of every `packages/core` change relevant to this proof,
  and of the domain-specific adaptation that lives outside core.
- Pointers from `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `JOURNAL.md` and
  `FILESTRUCTURE.md`.

### Out of Scope

- Review, standing, claims, relations or consensus projection.
- Starting the next V2 implementation task.
- Claiming V1 acceptance of the new application, or claiming ADR-0047 §9 in
  full. §9 is claimed only at V1 acceptance.
- Re-running the live extraction or a digest-comparison replay.
- Changing application code, contracts or ADRs.
- Removing `docs/hrd/desktop.ini`.

### Definition of Done

- The proof summary exists, is internally linked, and distinguishes measured
  claims from still-open ones.
- Every listed test and ADR target resolves.
- The `docs/hrd/` artifacts are labelled without presenting the frozen
  observe-contract log as the V2 two-call run.
- Long-lived docs point at the summary.
- Docs verification passes.

### Minimum Verification Gates

- [x] `pnpm docs:check`
- [x] `pnpm format:check` on the touched Markdown
- [x] `git diff --check`

## References

- [ADR-0047](../adr/0047-evidence-application-model-reset.md) §9
- [ADR-0048](../adr/0048-evidence-v2-observe-contract.md)
- [ACME-0154](ACME-0154_v2-observation-occurrence.md)
- [ADR-0045](../adr/0045-real-material-scale-and-recovery.md) §5 (bounded repair)

## Checklist

- [x] Confirm `packages/core` change set after ADR-0047.
- [x] Write the proof summary.
- [x] Label `docs/hrd/` artifacts.
- [x] Point from status, system, journal and file-structure docs.
- [x] Verify links and format.
- [x] Archive and restore the template.

## Decisions and Notes

- The user's formulation is kept, and immediately bounded: this is a measured
  execution-reuse claim, not V1 product acceptance.
- `docs/hrd/openAI_log.md` uses `evidence-observe-artifact-input/3` and
  `segmentCoverage`. That is the frozen observe contract, not
  `evidence-v2-observe/1`. The summary must say so.

## Charter Amendment Log

- none

## Verification

- [x] `pnpm docs:check`
- [x] Markdown format
- [x] Internal links resolve
- No application code changed. Live re-run and digest-comparison replay were
  out of scope and were not repeated.

## Documentation Updates

- [x] `docs/acceptance/poc-1-reusable-execution-proof.md`
- [x] `docs/hrd/README.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`

## Handoff and Follow-ups

- Current state: **Complete.** The proof is in
  `docs/acceptance/poc-1-reusable-execution-proof.md`.
- Next recommended step: review and standing over occurrences, unchanged from
  ACME-0154.
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: none.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
