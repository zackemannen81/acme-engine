# ACME-0051 — Browser Measurement Surface

Task ID: ACME-0051
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-05
Last updated: 2026-08-05
Charter frozen at: 2026-08-05

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0019-domain-test-ui-boundary-and-view-contracts.md`
- `docs/adr/0021-interface-workspace-and-launch-boundary.md`
- `docs/adr/0022-measurement-and-fixture-approval.md`
- `docs/adr/0024-local-spa-loopback-workbench.md`

## Task Summary

Render the already-delivered `acme-view-measurement/1` contract as S8 in the
local loopback workbench. A developer should be able to measure all readable
workspace run records, supply optional rate thresholds, select an existing
stored baseline and inspect deterministic and live evidence separately without
creating a score or changing any recorded artifact.

## Task Charter

The charter is editable while status is `Draft` and immutable once the task
reaches `Ready`.

### Goal

Make recorded-run measurement, threshold outcomes and deliberate baseline
comparison inspectable and auditable in the local browser workbench.

### Primary Deliverable

A pure S8 HTML renderer plus read-only loopback HTML/JSON routes over the
existing workspace, `buildMeasurementView` contract and stored baselines.

### In Scope

- Pure S8 HTML rendering from `acme-view-measurement/1`.
- The three existing run, step and replay pass rates with numerator, sample
  size and explicit empty-sample unavailability.
- Deterministic and live series rendered separately.
- Optional `min` / `max` threshold input for each existing measure through a
  bounded GET form/query, with validation as rates in the inclusive `0..1`
  range.
- Optional lookup of one already stored baseline by safe workspace name.
- Existing `met | not-met | unavailable` threshold outcomes and
  `improved | unchanged | regressed` baseline comparisons, copied from the
  view contract rather than recomputed by the renderer.
- `GET /s8` HTML and `GET /api/measurement` JSON routes using the same view.
- Honest refusal for invalid threshold configuration, unsafe/missing baseline
  selection and unreadable run records that would otherwise shrink a sample.
- Health-contract registration and removal of the S8 stub.
- Focused unit, HTTP integration and browser verification.
- Governing status, system, structure, specification, backlog and journal
  documentation.

### Out of Scope

- New measures, composite scores, weighting, trends, anomaly detection or
  quality grades.
- Automatic baseline capture, promotion, update or deletion.
- Persisting thresholds or any other S8 form state.
- Reclassifying run, step or replay verdicts.
- Mutating run records, execution evidence, fixtures, approvals or canonical
  engine state.
- Rendering S9 or S10, or adding live launch controls.
- Provider calls, authentication, remote hosting, deployment or publication.
- Core, module, adapter, CLI, persistence or canonical execution changes.

### Definition of Done

- `/s8` renders `acme-view-measurement/1` from every readable workspace run
  record and `/api/measurement` returns the exact same configured view.
- Each measure visibly states observed count, sample size and rate; zero
  samples remain `MEASUREMENT_SAMPLE_EMPTY`, never zero or 100 percent.
- Mock and non-mock records remain in visibly separate deterministic and live
  series.
- Threshold outcomes exist only for explicitly supplied, valid bounds and are
  copied from `buildMeasurementView`.
- Baseline comparison occurs only when the caller selects an existing safe
  baseline name; absent baseline remains explicitly unavailable.
- An unreadable run file refuses the complete measurement instead of silently
  reducing its evidence set.
- The browser path performs no provider call and writes no workspace or
  canonical artifact.
- Existing S1–S7 behavior and every repository verification gate remain green.
- Long-lived docs reflect S1–S8 as rendered surfaces and name S9–S10 as the
  remaining stubs.

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
- [x] Browser verification of S8 default/configured/empty-series evidence,
      responsive layout and error-overlay/console state

## References

- `apps/test-ui/src/read-model/measurement.ts`
- `apps/test-ui/src/local/workspace.ts`
- `apps/test-ui/src/local/server.ts`
- `apps/test-ui/src/web/`
- `apps/test-ui/test/measurement.test.ts`
- `apps/test-ui/test/web-render.test.ts`
- `tests/integration/test-ui-launch.test.ts`
- `tests/integration/test-ui-workbench.test.ts`
- `docs/design/domain-test-ui-specification.md`
- `docs/backlog/domain-test-ui-implementation.md`

## Checklist

- [x] Confirm S7 is committed, pushed and the worktree is clean.
- [x] Review the governing workflow, S8 contract, workspace boundary and ADRs.
- [x] Review the Draft, move it through `Ready`, freeze it and start work.
- [x] Add and export the pure S8 renderer.
- [x] Compose validated read-only measurement over workspace runs/baselines.
- [x] Add S8 HTML/JSON routes, health registration and remove the S8 stub.
- [x] Add renderer and HTTP integration coverage.
- [x] Run browser verification over default, configured and empty S8 states.
- [x] Run every minimum verification gate.
- [x] Synchronize governing documentation.
- [x] Archive the completed task and restore the empty current-task template.

## Decisions and Notes

- 2026-08-05: the reviewed Draft moved through `Ready` to `In Progress`; the
  Task Charter and Minimum Verification Gates above are frozen.
- S8 may compute only the three rates ADR-0022 defines. The HTML renderer
  formats the supplied numbers but does not decide threshold or baseline
  outcomes.
- Threshold configuration is request-local. The browser may state a human
  rule, but it neither persists that rule nor invents one by default.
- Baseline selection is read-only and explicit. No query means no baseline;
  naming a missing or unreadable baseline is a refusal, not an implicit
  no-baseline comparison.
- The workspace already reports unreadable run files. S8 refuses the complete
  calculation when that list is non-empty so an unknown format cannot silently
  improve a rate by disappearing from its denominator.
- No new ADR is expected: this is an ADR-0024 follow-up preserving ADR-0021
  storage and ADR-0022 measurement semantics.

## Charter Amendment Log

- None.

## Verification

- [x] Focused renderer and workbench integration tests: 26 tests passed across
      `web-render.test.ts` and `test-ui-workbench.test.ts`; package typecheck
      passed.
- [x] Full repository gates listed above.
- [x] Manual browser verification with no live provider call: default and
      configured measurement on seven demo records, plus an empty workspace;
      no horizontal overflow or error overlay observed.
- `pnpm test:unit`: 540 tests / 60 files passed.
- `pnpm test:conformance`: 58 tests / 7 files passed.
- `pnpm test:integration`: 52 tests / 8 files passed.
- `pnpm test:scenario`: 21 tests / 4 files passed.
- `pnpm docs:check`: 117 Markdown files passed before archive; rerun after
  archive passed 118 files.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm boundaries`,
  `pnpm build` and `git diff --check` passed.

## Documentation Updates

- [x] `AGENTS.md`
- [x] `README.md` if its current-objective summary changes
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/backlog/README.md`
- [x] `docs/backlog/domain-test-ui-implementation.md`
- [x] `docs/design/README.md`
- [x] `docs/design/domain-test-ui-specification.md`
- [x] ADRs if implementation changes a long-lived decision — no ADR required;
      implementation stays within ADR-0021, ADR-0022 and ADR-0024.

## Handoff and Follow-ups

- Current state: complete and ready to archive.
- Next recommended step: charter S9 fixture review separately if approved.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none that block the bounded charter.

## Finalize When Complete

- Archive this file as `docs/finished/ACME-0051_browser-measurement-surface.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes, supersede this task instead of
  rewriting it.
