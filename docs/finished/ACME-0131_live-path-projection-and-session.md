# Current Task

Task ID: ACME-0131
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-15
Last updated: 2026-08-16
Charter frozen at: 2026-08-15

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- ADR-0039, ADR-0040 and ADR-0044
- ACME-0107, ACME-0110, ACME-0129 and ACME-0130

## Task Summary

Repair the four defects that the first sustained real browser session exposed
in the live observation path and the local composition, and restore a case that
those defects wedged.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

A real reviewer can keep a session, run repeated live observations on a case,
and have every refused projection leave the product exactly as it was.

### Primary Deliverable

The corrected session lifetime, execution-scoped observation collection,
transactional projection ordering and workspace-scoped evidence projection,
each with a gate that fails when the defect is reintroduced.

### In Scope

- Issue each product session its own upstream expiry instead of one fixed
  process-lifetime expiry, so a session's lifetime starts at sign-in.
- Collect only the executing run's observations in the live observation job
  rather than every ledger record matching the artifact.
- Order the worker's product projection so no observation is written before the
  revision guard that can reject the projection.
- Scope the evidence projection to the requested workspace instead of the
  globally latest ledger snapshot.
- Add regression gates for session lifetime, projection ordering and workspace
  scoping.
- Record a recovery path for a case whose product and engine revisions have
  already diverged.

### Out of Scope

- ADR-0044's retirement of the deployment call ceiling and cost ceiling, and
  the three-tier suite separation. That is the successor task.
- Any provider call, new data class, contract or prompt version change.
- Repairing the wedged `POC1-AUTO-UI` case in place, or migrating its history.
- Deployment, release or the acceptance run itself.

### Definition of Done

- A session signed in after the process has been running for longer than the
  configured lifetime resolves normally.
- A second live observation on the same source projects only that run's
  observations.
- A refused projection leaves observation count, workspace revision and review
  queue unchanged.
- Each case's views read that case's own evidence projection.
- Offline gates pass; a real run is not required to close this task.

### Minimum Verification Gates

- [x] Focused regression gates for all four defects
- [x] typecheck, lint, boundaries, test, build, format, docs and diff
- [x] Fresh PostgreSQL journey

## References

- `apps/evidence-workbench-api/src/local.ts` — session expiry, evidence
  projection
- `packages/evidence-auth/src/session.ts` — refresh and expiry resolution
- `packages/adapter-evidence-auth-memory/src/index.ts` — development
  authenticator
- `apps/evidence-workbench-api/src/live-observation.ts` — observation
  collection
- `apps/evidence-workbench-worker/src/index.ts` — product projection ordering
- `packages/evidence-views/src/builders.ts` — projection revision guard

## Checklist

- [x] Freeze the corrective charter.
- [x] Repair session lifetime and prove it across the old boundary.
- [x] Scope observation collection to the executing run.
- [x] Reorder the worker projection and prove refusal leaves no partial state.
- [x] Scope the evidence projection per workspace.
- [x] Scope the case overview, integrity report and export policy per case.
- [x] Run focused and canonical offline verification.
- [x] Reality-sync docs, archive and commit.

## Decisions and Notes

- Observed state at discovery: engine state revision 5 against product
  workspace revision 2 for `evidence-workspace-c5e0629…`, 35 product
  observations, and jobs recording one `LIVE_OBSERVATION_COMPLETED`, two
  `MODEL_INVALID_RESPONSE` and four `EVIDENCE_PRODUCT_COMMAND_COLLISION`.
- The revision divergence is a symptom. The cause is the worker writing
  observations before the guard that rejects the projection, combined with the
  job collecting observations by artifact rather than by execution.
- The wedged case is not repairable through the product. A new case with a
  fresh import is the recovery path, and import makes no provider call.
- Session expiry is a local-composition defect only. The hosted Supabase
  authenticator issues real upstream expiries and is unaffected.
- The workspace-scoping defect is latent today because only one workspace holds
  engine state. It becomes a case-isolation failure as soon as a second does.
- Fixing the guard is not the same as removing it. The revision guard stays;
  what changes is that nothing mutates before it runs.

## Charter Amendment Log

- 2026-08-16: added a fifth defect of the same class, found while verifying the
  first four against the running instance. `/api/overview`,
  `/api/integrity-report` and `GET /api/export-policy` resolved
  `options.workspaceId` — the composition default — instead of the requested
  case, so Case overview and Integrity report answered `404` for every case
  except the default one. Had authorization passed, they would have rendered
  the default case's content under another case's heading, which is the
  ADR-0036 isolation failure the `404` happened to mask. The amendment is
  in-goal: it is the same "case-scoped read using the composition default"
  defect as the evidence projection already in scope, and excluding it would
  have closed this task with two dead navigation buttons.

## Verification

- [x] Every gate is load-bearing. Each fix was reverted individually, rebuilt
      and re-run, and exactly its own gate failed with the original symptom:
      `Refreshed session is already expired.` (`401`),
      `Workspace evidence revision does not match the supplied Evidence
      projection.` (`409`), `putObservations` recorded before the guard, and
      the earlier run's observation re-selected. Restoring each fix returned
      the gate to green.
- [x] `pnpm test:unit` 759/759 across 120 files, up from 753/118.
      `pnpm test:conformance` 78, `pnpm test:integration` 62,
      `pnpm test:scenario` 26.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm boundaries`, `pnpm build`,
      `pnpm format:check`, `pnpm docs:check`, `git diff --check`.
- [x] `pnpm test:postgres` 36/36 on a disposable `postgres:15` created for this
      task and removed afterwards, covering migrations, case-object scope,
      concurrent outbox leasing, anonymous-role denial and restart durability.
- [x] Running instance, real PostgreSQL and MinIO, case `Linkoping_realcase`:
      overview, integrity-report, observations, relations, open-questions,
      timeline, work-queue, text-imports and export-policy all `200`. Before
      the task four of those answered `409` and three answered `404`.
- [x] The wedged `POC1-AUTO-UI` case still answers `409` on its projection
      views. That is correct: its engine and product revisions genuinely
      diverged, and these fixes prevent new divergence rather than rewriting
      recorded history.
- [ ] No provider call was made. The live path's own execution was not
      exercised end to end here; that belongs to the acceptance run.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`

## Handoff and Follow-ups

- Current state: complete. Five defects repaired, each with a load-bearing
  gate. The running instance serves every case view for a real case.
- The `POC1-AUTO-UI` case remains wedged by design of these fixes; the
  acceptance run needs a fresh case, and import costs no provider call.
- Follow-up, not a defect: `GET /api/assessments` does not exist, so the
  browser's assessment list request answers `404` for every case. The shell
  copes by offering creation, so it is not blocking, but it should either
  exist or stop being requested.
- Next task: implement ADR-0044's retirement of the deployment call ceiling
  and cost ceiling, and the three-tier suite separation, then activate
  `docs/backlog/poc1-live-product-acceptance.md`.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- [x] Archive as
      `docs/finished/ACME-0131_live-path-projection-and-session.md`.
- [x] Restore the task template and add a signed Journal entry.
- Supersede rather than rewrite if the Goal changes.
