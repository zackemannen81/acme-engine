# Current Task

Task ID: ACME-0044
Parent Task: None
Status: Ready
Owner: Grok
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
- [`docs/design/domain-test-ui-specification.md`](design/domain-test-ui-specification.md)
- [`docs/adr/0019-domain-test-ui-boundary-and-view-contracts.md`](adr/0019-domain-test-ui-boundary-and-view-contracts.md)
- [`docs/adr/0021-interface-workspace-and-launch-boundary.md`](adr/0021-interface-workspace-and-launch-boundary.md)
- [`docs/adr/0022-measurement-and-fixture-approval.md`](adr/0022-measurement-and-fixture-approval.md)
- [`docs/finished/ACME-0043_domain-test-ui-measurement-and-fixture-review.md`](finished/ACME-0043_domain-test-ui-measurement-and-fixture-review.md)

## Task Summary
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

Phases 0–5 delivered view contracts S1–S9, the plan compiler, launch history,
measurement and fixture review. Live evaluation (S10) remains absent: the only
supported live path is CLI `execute --gateway openai`.

This task is phase 6: gated live evaluation. It must make a budgeted live run
possible from the interface only with explicit opt-in and confirmation, keep
credentials out of every view and confirmation document, and keep live results
partitioned from deterministic measurement (already prepared by ADR-0022).

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Let a human confirm and launch a budgeted live provider execution through the
Domain Test UI composition, inspect the live outcome as a versioned view, and
record it so it can never contaminate a deterministic measurement.

### Primary Deliverable

An `acme-view-live-evaluation/1` surface, a pure live-confirmation gate, and a
local live launch path that builds an OpenAI gateway only after opt-in and
confirmation, never accepts credentials in the confirmation, and writes a run
record with a non-mock gateway.

### In Scope

- ADR for the live evaluation gate (opt-in, confirmation, budget, credentials).
- Pure confirmation document `acme-live-confirmation/1` with refusals for
  missing opt-in, empty confirmer/rationale, non-positive budget, case count
  outside the allowed bound, unknown provider, and any credential-shaped field.
- Environment opt-in for the local composition (`ACME_TEST_UI_LIVE`); without
  it, live composition/launch is refused.
- `acme-view-live-evaluation/1` projecting gate summary and live-series runs
  only (series label `live`), with cost/usage when recorded and `unavailable`
  when not.
- Local `launchLiveExecution` for a single `ExecutionRequest` via
  ExecutionEngine and the OpenAI Responses gateway (transport injectable for
  offline tests), recording a workspace run with `gateway` other than `mock`.
- Budget check: request `maxModelCalls` must not exceed the confirmed ceiling.
- Tests covering every refusal without network access; offline transport path
  for a successful live-shaped launch.
- Documentation updates required by the Definition of Done.

### Out of Scope

- Multi-step live scenarios or any change to ScenarioRunner / `acme-scenario/1`.
- Adding a `measurements` block or live gateway field to `acme-test-plan/1`.
- Any SPA, HTTP server, browser chrome or styling.
- Quality scores, grades or composites (ADR-0022 stands).
- Changing core, reference modules, adapters' public contracts, or CLI flags
  beyond what test-ui already mirrors.
- Default-CI live network calls or requiring `OPENAI_API_KEY` in CI.
- Background workers, queues or cancellation (launch stays synchronous).

### Definition of Done

- `acme-view-live-evaluation/1` is versioned and asserted as JSON.
- Live launch is refused without env opt-in and without a valid confirmation.
- Confirmation cannot carry credential fields; credentials are read only from
  the environment inside the local composition root.
- A confirmed live run records `composition.gateway !== 'mock'` so S8's live
  partition receives it and the deterministic partition does not.
- Cost/usage is reported when present on the live record and `unavailable`
  otherwise; no invented quality score.
- Default package tests perform no network call.
- The default entry point still performs no I/O.
- The app still imports no package internal, and nothing imports the app.
- `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/FILESTRUCTURE.md`,
  `docs/JOURNAL.md`, the design specification and the backlog proposal reflect
  the delivered reality.

### Minimum Verification Gates

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm format:check`
- [ ] `pnpm boundaries`
- [ ] `pnpm test:unit`
- [ ] `pnpm test:conformance`
- [ ] `pnpm test:integration`
- [ ] `pnpm test:scenario`
- [ ] `pnpm docs:check`
- [ ] `pnpm build`
- [ ] `git diff --check`

## References

- [Domain Test UI — Specification](design/domain-test-ui-specification.md),
  sections "S10" and "Phase 6"
- [ADR-0019](adr/0019-domain-test-ui-boundary-and-view-contracts.md) gate 5
- [ADR-0022](adr/0022-measurement-and-fixture-approval.md) live partition
- `apps/cli/src/run.ts` — existing live OpenAI composition pattern

## Checklist

- [ ] Write this charter and freeze it.
- [ ] Write ADR-0023 for the live evaluation gate.
- [ ] Add pure confirmation validation and S10 view builder.
- [ ] Extend run records for optional live usage/confirmation metadata.
- [ ] Add local live launch with env opt-in and injectable transport.
- [ ] Write unit tests for every refusal and the live view partition.
- [ ] Write an offline integration test launching through the live path.
- [ ] Run every minimum verification gate.
- [ ] Update long-lived docs and backlog.
- [ ] Journal entry and archive this task.

## Decisions and Notes

- **Single-execute live, not ScenarioRunner live.** ScenarioRunner remains
  mock-only; multi-step live scenarios are a separate charter. S10 mirrors
  CLI `execute --gateway openai` under a stricter human gate.
- **Opt-in is two-keyed:** process env `ACME_TEST_UI_LIVE` plus a confirmation
  document with `optIn: true`, confirmer and rationale. Either alone is
  insufficient.
- **No scores.** "Live evaluation" means outcome, budget and usage — not a
  quality grade (ADR-0022).
- A checkpoint after each step is required.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm format:check`
- [ ] `pnpm boundaries`
- [ ] `pnpm test` (unit, conformance, integration, scenario)
- [ ] `pnpm docs:check`
- [ ] `pnpm build`
- [ ] `git diff --check`
- [ ] No live provider call required in any default gate.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md`
- [ ] ADR-0023
- [ ] design specification and backlog proposal

## Handoff and Follow-ups

- Current state: Ready; implementation in progress.
- Next recommended step: implement ADR + gate + view + launch.
- Blockers: none.
- Child tasks: none.
- Open questions: none.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
