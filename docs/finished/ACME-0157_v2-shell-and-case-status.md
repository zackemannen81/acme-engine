# Current Task

Task ID: ACME-0157
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-18
Last updated: 2026-08-18
Charter frozen at: 2026-08-18

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/design/evidence-workbench-v2-domain-specification.md` §6
- `docs/design/evidence-workbench-v2-interface-plan.md`
- `docs/adr/0049-evidence-v2-surface-set.md`

## Task Summary
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

ACME-0156 proved the V2 application holds a real case on a real substrate. What
it does not have is a frame a person can work in. The browser surface is a set
of pages reachable from each other by whatever link happened to be rendered:
there is no persistent case-scoped navigation, no way to see where you are, and
no answer to "what is in this case and where do I resume".

Four of the surfaces ADR-0049 fixes do not exist yet — Timeline, Relations,
Claim and Consensus arrive in ACME-0160 to ACME-0162. The shell must therefore
say so in one explicit named state per surface, because R-07 is the regression
this task is most able to reintroduce: one case reported 40 pending
observations, 0 observations, HTTP 409 and an empty timeline **simultaneously**.
A navigation entry that renders an empty list for a surface that does not exist
is that defect, rebuilt deliberately.

This task delivers the shell and the case-status surface. It adds no domain
object and asserts nothing about evidence.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

A person can open a case, see every surface the product has, know which ones
are not built yet, and read what the case contains and where to resume.

### Primary Deliverable

The case-scoped workbench shell and the `Status` surface, server-rendered,
covering every page the V2 application serves.

### In Scope

- A shared layout: case identity, persistent case-scoped navigation across
  Case, Documents, Chains, Timeline, Relations and Status, and breadcrumbs that
  never lose the case.
- The `Status` surface: a case-scoped read model reporting counts, outstanding
  work and where to resume, behind an authorized route in both HTML and JSON.
- One repository read for that projection, added to the port and implemented in
  the PostgreSQL adapter with aggregate queries. No read path re-derives a
  structure or clones a snapshot (R-10).
- One explicit named state per surface that is not implemented, used by
  navigation and by the status surface alike, so all surfaces answer the same
  way (R-07).
- Bounded, visibly paged lists on every list page, with the bound stated
  (R-08).
- Every row continues to open its exact source (§6 UI rule).
- Offline tests for the projection, the named states and the routes.

### Out of Scope

- Charts, graphs, gauges, progress bars, scores, weights, rankings or any
  credibility indicator (ADR-0049 §2).
- Any new domain object: `Review`, `Standing`, `Claim`, `Relation`,
  `ConsensusProjection` and the timeline projection itself stay unbuilt.
- Implementing the Timeline or Relations surfaces. This task renders their
  named not-implemented state and nothing else.
- PDF or any new source class.
- Any client framework, bundler, or client-side state. Progressive enhancement
  only.
- Any change to `evidence-v2-source-structure/1`, `evidence-v2-chain/1` or
  `evidence-v2-observe/1`, or to their rule versions.
- Any change to the frozen application under `apps/evidence-workbench-*`
  (non-V2).
- Live model spend.
- Wiring Supabase Auth.

### Definition of Done

- Every V2 page renders inside the shared shell, shows which case it belongs
  to, and offers navigation to every surface in ADR-0049's set.
- A surface that is not implemented is reachable, states plainly that it is not
  built and which task delivers it, and returns a non-error status. It never
  renders an empty list.
- The status surface reports, for one authorized case: artifact, part, chain,
  instance, occurrence and extraction-window counts; how many instances have no
  committed extraction; and a resume pointer naming a concrete next instance
  when one exists.
- The status surface reports the not-implemented surfaces with the same named
  state the navigation uses, rather than reporting zero.
- Counts on the status surface agree with the totals the list routes report for
  the same case.
- Every list page states its bound and pages through it.
- A non-member receives 404 on the status route, exactly as on every other
  case-scoped route.
- `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/FILESTRUCTURE.md` and
  `docs/JOURNAL.md` reflect the delivered state.

### Minimum Verification Gates

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm boundaries`
- [x] `pnpm test` (unit, conformance, integration, scenario)
- [x] `pnpm test:postgres` — `evidence-v2-persistence` passes, including the new
      overview read; the stage-A resume failure attributed in
      `docs/backlog/postgres-gate-test-hygiene.md` remains the only failure
- [x] `pnpm docs:check`
- [x] `pnpm build`
- [x] `git diff --check`
- [x] Recorded run against the ACME-0156 Supabase case: status counts agree with
      the list routes, navigation reaches every surface, unbuilt surfaces state
      their named condition, and a second principal gets 404

## References

- [ADR-0049 — V2 surface set](../adr/0049-evidence-v2-surface-set.md)
- [V2 domain specification §6](../design/evidence-workbench-v2-domain-specification.md)
- [Interface plan](../design/evidence-workbench-v2-interface-plan.md)
- [ACME-0156](../finished/ACME-0156_v2-supabase-substrate.md) — the substrate this
  runs on
- [V2 Supabase runbook](../ops/evidence-v2-supabase.md)
- `apps/evidence-workbench-v2-web/src/index.ts` — the surface being reframed
- `packages/evidence-v2-contracts/src/index.ts` — the port gaining one read

## Checklist

- [x] Define the named not-implemented state and the surface set in one place
      both navigation and status read from.
- [x] Add the case-overview read model to the contracts port.
- [x] Implement it in the PostgreSQL adapter with aggregate queries.
- [x] Complete the in-memory stand-in repository in the app tests.
- [x] Build the shared shell: identity, navigation, breadcrumbs, page bound.
- [x] Render every existing page inside the shell.
- [x] Render the status surface, HTML and JSON.
- [x] Render the not-implemented surfaces.
- [x] Add offline tests: projection shape, named states, routes, authorization.
- [x] Run every verification gate; record results and any skips with reasons.
- [x] Recorded run against the live Supabase case.
- [x] Update `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `FILESTRUCTURE.md` and
      `JOURNAL.md`.
- [x] Archive this task and restore the template.

## Decisions and Notes
- A checkpoint after each step or substep is required. Checklist is therefore updated along the work and `CURRENT_STATUS.md` is always updated when changes affect the behavior.
- Record decisions and assumptions within the frozen charter.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

Recorded at freeze:

- Reporting `0 claims` for a product that has no claims is a false statement
  about the case, not a neutral default. Every unbuilt surface therefore
  reports a named condition, never a number.
- The status surface is a projection. It stores nothing, and it must be
  recomputable from stored rows after any restart.
- Counts come from aggregate queries over stored rows rather than from the
  denormalized `partCount` / `chainCount` on the artifact record, so the
  surface reports what is actually persisted.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

Run 2026-08-18. Nothing skipped.

- typecheck, lint, format:check, boundaries, docs:check (289 files), build and
  `git diff --check`: clean.
- `pnpm test`: unit 871/871 (up from 866), conformance 78, integration 70,
  scenario 26.
- `pnpm test:postgres`: `evidence-v2-persistence` **7/7**, including the new
  overview gate. Two failures of 44, both attributed in
  `docs/backlog/postgres-gate-test-hygiene.md`. The gate above anticipated only
  the stage-A resume failure; the restart collision is now also visible because
  ACME-0156 left this database populated, which is exactly the **reused
  database** condition that backlog entry documents, failing with
  `EvidenceProductCommandCollisionError` on the command key it names. Neither
  test is touched by this task. Recorded rather than smoothed over: the frozen
  gate's wording was optimistic, not the result.
- Recorded run against the ACME-0156 Supabase case: status projection in
  **132 ms** — 650 parts, 29,971 citable units, 351 chains, 467 instances,
  0 occurrences, 0 committed windows, 467 instances without extraction — with
  parts and chains counts **equal** to the list routes' totals.
- All seven case-scoped pages carried the surface bar, named the case and
  marked the correct active surface. Timeline and Relations answered 200 with
  their named condition and the delivering task, in HTML and JSON.
- Case-scoped `/chains` redirected 303 to the single source's chains.
- A second principal received 404 on the status, documents and timeline routes
  and on the status API; unauthenticated received 401.

Two assertions I wrote were wrong and the code was right; both were corrected
to what the system does. The fixture holds two parts, so a page bound of two
correctly offers no next page. And a window stored against a synthetic instance
key correctly leaves every real instance outstanding, because outstanding work
is counted against instances that exist rather than against whatever key a
window carries.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs when long-lived decisions change — none anticipated; ADR-0049 already
      decides the surface set

## Handoff and Follow-ups

- Current state: `Complete`. Every Definition of Done item is satisfied and
  recorded above.
- Next recommended step: ACME-0158 (PDF import under ADR-0050) or ACME-0159
  (review and standing). The plan sequences PDF first; the evidence spine is
  the defensible alternative if a working review loop matters more than the
  ingestion boundary.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.
- Recorded, not fixed: one chain of 351 carries a degenerate subject label and
  sorts first, so the resume pointer names it. `evidence-v2-chain/1` is out of
  this charter's scope; see `docs/backlog/v2-degenerate-chain-subject.md`.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
