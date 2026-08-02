# Current Task

Task ID: ACME-0043
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-02
Last updated: 2026-08-02
Charter frozen at: 2026-08-02

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- [`docs/design/domain-test-ui-specification.md`](../design/domain-test-ui-specification.md)
- [`docs/adr/0019-domain-test-ui-boundary-and-view-contracts.md`](../adr/0019-domain-test-ui-boundary-and-view-contracts.md)
- [`docs/adr/0021-interface-workspace-and-launch-boundary.md`](../adr/0021-interface-workspace-and-launch-boundary.md)
- [`docs/adr/0022-measurement-and-fixture-approval.md`](../adr/0022-measurement-and-fixture-approval.md)
- [`docs/finished/ACME-0042_domain-test-ui-launch-and-history.md`](ACME-0042_domain-test-ui-launch-and-history.md)

## Task Summary
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

Phases 0–4 delivered the boundary, the S1–S7 view contracts, the plan
compiler, and a launch path that records runs under an interface-owned
workspace.

This task is phase 5: measurement (S8) and fixture review (S9).

It is the first phase whose output is not a projection of recorded evidence.
S8 computes: it aggregates over recorded verdicts and compares the result to a
configured threshold. That makes the ADR-0019 rule — the interface never
computes a verdict — load-bearing rather than incidental, so the boundary
between aggregating recorded verdicts and inventing a new one is drawn
explicitly here.

Scoring models are deliberately excluded. A threshold is a rule someone wrote
down; a score is a model this interface would be inventing, and nothing has
asked for one.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Measure a series of recorded runs against explicitly configured thresholds and
baselines, and route a proposed golden-fixture change to a human approver,
without inventing a verdict or writing a fixture.

### Primary Deliverable

An `acme-view-measurement/1` surface computing rates over recorded run
records against configured thresholds and an optional baseline, and an
`acme-view-fixture-review/1` surface whose approval requires an approver and a
non-empty rationale and produces a reviewable change rather than a file write.

### In Scope

- ADR for measurement semantics and the fixture-approval boundary.
- Measures derived only from recorded run records: run pass rate, step pass
  rate and replay match rate, each with its sample size stated.
- Configured thresholds (`min` / `max`) per measure, with an explicit
  `met` / `not-met` / `unavailable` outcome.
- An empty sample reported as `unavailable`, never as a rate of one or zero.
- Baseline comparison against a stored measurement snapshot; with no baseline,
  no regression or improvement claim is made.
- A partition between deterministic and live series, so the two can never be
  aggregated into one deterministic number.
- Fixture-change proposals and approval records: approver identity, non-empty
  rationale, no automatic acceptance, and a described reviewable change.
- Workspace storage for baselines and approvals under the existing root, with
  the same safe-name rule run records already use.
- Tests covering every refusal and every unavailable case.
- Documentation updates required by the Definition of Done.

### Out of Scope

- Surface S10 and live evaluation of any kind.
- Any SPA, HTTP server, browser chrome or styling work.
- Any scoring model, weighting, grade or composite quality number.
- Writing, editing or deleting a fixture file from the interface.
- Changing S1–S7, the plan schema, the compiler or the launch path.
- Changing `acme-scenario/1`, the ScenarioRunner, core, adapters or the CLI.
- Trend analysis, statistics beyond a rate, or anomaly detection.
- Automatic baseline promotion.

### Definition of Done

- `acme-view-measurement/1` and `acme-view-fixture-review/1` are versioned and
  asserted as JSON.
- Every measure states its sample size, and a zero sample is `unavailable`
  rather than a rate.
- A threshold outcome is stated only when a threshold was configured;
  otherwise the measure reports its value with no verdict.
- With no baseline, the comparison is `unavailable` and no regression or
  improvement is claimed.
- Deterministic and live runs are partitioned, and a live run can never enter
  a deterministic measurement.
- Approval requires a non-empty approver and a non-empty rationale; both are
  refused when absent.
- No approval writes, edits or deletes a fixture file; the change is described
  for a human to apply.
- An approval record identifier that is not a safe file name is refused.
- Measurements are reproducible: the same records and configuration produce
  the same numbers.
- The default entry point still performs no I/O.
- The app still imports no package internal, and nothing imports the app.
- No test in any gate performs a network call, reads wall-clock time or
  requires a browser.
- `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/FILESTRUCTURE.md`,
  `docs/JOURNAL.md`, the design specification and the backlog proposal reflect
  the delivered reality.

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
- [x] `pnpm build`
- [x] `git diff --check`

## References

- [Domain Test UI — Specification](../design/domain-test-ui-specification.md),
  sections "S8", "S9" and "Phase 5"
- [ADR-0019](../adr/0019-domain-test-ui-boundary-and-view-contracts.md) — the
  interface never computes a verdict
- [ADR-0021](../adr/0021-interface-workspace-and-launch-boundary.md) — workspace
  storage and safe identifiers
- [ADR-0022](../adr/0022-measurement-and-fixture-approval.md) — measurement and
  fixture approval
- `apps/test-ui/src/run-record.ts` — the recorded series being measured

## Checklist

- [x] Confirm phase 4 is committed and the tree is clean.
- [x] Write this charter and freeze it.
- [x] Write the ADR for measurement and fixture approval.
- [x] Add the measurement contract and its pure builder.
- [x] Add the fixture review contract, proposals and approval records.
- [x] Extend the workspace with baselines and approvals.
- [x] Write the package tests, covering every refusal and unavailable case.
- [x] Write an end-to-end test measuring real recorded runs.
- [x] Run every minimum verification gate.
- [x] Update `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `FILESTRUCTURE.md`, the
      design specification and the backlog proposal.
- [x] Add the signed `JOURNAL.md` entry and archive this task.

## Decisions and Notes
- A checkpoint after each step or substep is required. Checklist is therefore updated along the work and `CURRENT_STATUS.md` is always updated when changes affect the behavior.

- **Thresholds, not scores.** A threshold is a configured rule; a score is a
  model. The only concrete scoring proposal seen so far lives in
  `docs/concepts_sandbox/`, which no charter may cite as authority, so
  designing against it would be designing against nothing.
- **A rate over zero samples is not a rate.** An empty series reports
  `unavailable`. Returning `1` because nothing failed is the arithmetic form
  of the "missing evidence renders as zero" defect ADR-0019 rules out.
- **The deterministic/live partition is built before it is needed.**
  `acme-test-plan/1` only permits `gateway: mock`, so every recorded run is
  deterministic today and the live partition is always empty. Encoding it now
  means phase 6 cannot accidentally aggregate a live run into a deterministic
  number later.
- **Approving a fixture change writes no fixture.** The approval record says a
  human accepted the change; applying it stays a reviewable repository action.
  A silent write would make the interface the author of a golden.
- **Session handoff:** implementation and ADR-0022 were already on `main`
  when verification resumed; this completion run re-verified every gate and
  synchronized long-lived docs that still described phase 4 as the tip.
- Record decisions and assumptions within the frozen charter.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm boundaries`
- [x] `pnpm test` (unit, conformance, integration, scenario)
- [x] `pnpm docs:check`
- [x] `pnpm build`
- [x] `git diff --check`
- [x] No live provider call and no network access in any gate.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs when long-lived decisions change

## Handoff and Follow-ups

- Current state: complete; archived under `docs/finished/`.
- Next recommended step: phase 6 (gated live evaluation) as its own charter,
  or a rendering surface, which the build plan does not currently charter.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
