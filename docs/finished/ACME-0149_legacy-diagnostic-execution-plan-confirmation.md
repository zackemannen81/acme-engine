# Current Task

Task ID: ACME-0149
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- [ADR-0047](../adr/0047-evidence-application-model-reset.md)
- [V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)
- `docs/CURRENT_STATUS.md`

## Task Summary

ADR-0047 freezes the delivered Evidence Workbench as a diagnostic reference and
permits only maintenance that preserves its diagnostic value.

The 2026-08-16 real-source run found that the workbench's analyze confirmation
states `Maximum model calls: 1` while the job spends one call per coverage
window — 4 and 8 calls in the two observed jobs. An instrument that misreports
what it is about to do is not a usable diagnostic instrument, and the statement
also contradicts the live-call policy in `AGENTS.md`.

The corrective change was written during that run at the user's direct request,
outside any charter. This task regularizes exactly that change and nothing else.

## Task Charter

Frozen at Ready.

### Goal

The frozen diagnostic workbench reports the planner's actual bounded model-call
count before spend, instead of asserting a fixed ceiling of one.

### Primary Deliverable

A read-only case-scoped coverage-plan route plus an analyze confirmation that
states execution windows, planned model calls and the emergency ceiling, and
requests the planned count rather than a hard-coded `1`.

### In Scope

- `GET /api/cases/{caseId}/sources/{artifactVersionId}/coverage-plan?part=`
  returning the planner's own window count, planned model calls, the emergency
  ceiling and whether the plan is within it.
- The browser confirmation reads that plan, states
  `This analysis requires N bounded model calls`, and posts `maxModelCalls: N`
  in both `requestedBudget` and `confirmation`.
- A plan above the emergency ceiling is refused in the confirmation with a
  named reason instead of being started.
- `ACME_EVIDENCE_LIVE_MAX_MODEL_CALLS` in the local startup script becomes an
  emergency ceiling (20) rather than a per-job cap.
- Reality-sync `docs/CURRENT_STATUS.md` and `docs/SYSTEMDOC.md`.

### Out of Scope

- Every V2 item in [ADR-0047](../adr/0047-evidence-application-model-reset.md).
  No new package, app, domain object or surface.
- Any other change to the frozen application: segment quote binding, coverage
  window size, per-window projection, the engine/product revision model, part
  titles, stream pagination or source-structure caching. Those are recorded as
  regression requirements R-01…R-10 in the V2 specification and are not fixed
  here.
- Repairing, retrying or unwedging the 2026-08-16 acceptance case.
- Re-running live Analyze. No provider call is made by this task.
- Changing the observe contract, structure rules or any stored record.
- Committing, pushing or releasing.

### Definition of Done

- The confirmation for a part with N coverage windows states N and requests N.
- A whole-artifact plan above the emergency ceiling is refused before any job
  starts.
- An unknown part id returns 404 from the coverage-plan route.
- No stored record, contract version or request hash changes.
- Offline gates pass. Docs reflect the change.

### Minimum Verification Gates

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm boundaries`
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance`
- [x] `pnpm test:integration`
- [x] `pnpm test:scenario`
- [x] `pnpm docs:check`
- [x] Coverage-plan route exercised against the real 246-part artifact

## References

- [ADR-0047](../adr/0047-evidence-application-model-reset.md) §4 — the frozen
  application may change only to preserve diagnostic value.
- `AGENTS.md` live-call policy — planner-derived bound, separate emergency
  ceiling, unknown cost stays unknown.
- [V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)
  R-09 — the regression requirement this change satisfies for the legacy
  instrument.

## Checklist

- [x] Add the coverage-plan route.
- [x] Rewrite the analyze confirmation to the planner-derived bound.
- [x] Refuse a plan above the emergency ceiling.
- [x] Raise the startup ceiling to an emergency ceiling.
- [x] Verify against the real artifact.
- [x] Run offline gates.
- [x] Reality-sync documentation.
- [x] Archive and restore the template.

## Decisions and Notes

- The planner is the same `planEvidenceStructuralObservationCoverage` the live
  observation job runs, so the confirmation cannot drift from the execution.
- The route is read-only and derives from the already-authorized product
  snapshot. It performs no artifact-store read and makes no provider call.
- The job's own per-window bound is unchanged. This task corrects what the
  confirmation *says*, not what the job *does*.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- none

## Verification

```text
pnpm typecheck                         pass
pnpm lint (apps packages tests tooling) pass
pnpm lint (repository root)            1 pre-existing error, see below
pnpm format:check                      pass
pnpm boundaries                        pass
pnpm docs:check                        269 Markdown files
pnpm test:unit                         800/800 (131 files)
pnpm test:conformance                  78/78
pnpm test:integration                  70/70
pnpm test:scenario                     26/26
```

`pnpm lint` over the repository root reports one error that this task did not
introduce and does not fix:

```text
tmp/source-ab-prep/exercise-more.mjs
  114:9  error  'hearing' is assigned a value but never used  no-unused-vars
```

That file is an untracked ACME-0148 scratch script under `tmp/`, which
`.gitignore` excludes and CI therefore never lints. It is left alone: the same
directory holds the prepared excerpt evidence cited in the 2026-08-16 journal
entry, and editing another session's scratch artifact to make a local gate green
is not a legitimate fix.

Manual verification against the real 246-part `source-A` artifact, on a second
workbench instance so the running one was not disturbed:

```text
part-000169          windowCount 4     plannedModelCalls 4     within ceiling
whole artifact       windowCount 1440  plannedModelCalls 1440  refused
part-999999          HTTP 404 Source part is unavailable
capabilities         liveObservationMaxModelCalls 20
confirmation         "This analysis requires 2 bounded model calls."
```

No provider call was made by this task.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` — no structural change
- [ ] ADRs — no decision changed

## Handoff and Follow-ups

- Current state: complete.
- Next recommended step: activate the first V2 implementation task under the
  normative specification. No further legacy work is chartered.
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: none.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
