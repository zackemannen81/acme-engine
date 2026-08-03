# Current Task

Task ID: ACME-0044
Parent Task: None
Status: Complete
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
- [`docs/design/domain-test-ui-specification.md`](../design/domain-test-ui-specification.md)
- [`docs/adr/0019-domain-test-ui-boundary-and-view-contracts.md`](../adr/0019-domain-test-ui-boundary-and-view-contracts.md)
- [`docs/adr/0021-interface-workspace-and-launch-boundary.md`](../adr/0021-interface-workspace-and-launch-boundary.md)
- [`docs/adr/0022-measurement-and-fixture-approval.md`](../adr/0022-measurement-and-fixture-approval.md)
- [`docs/adr/0023-live-evaluation-gate.md`](../adr/0023-live-evaluation-gate.md)
- [`docs/finished/ACME-0043_domain-test-ui-measurement-and-fixture-review.md`](ACME-0043_domain-test-ui-measurement-and-fixture-review.md)

## Task Summary
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

Phases 0–5 delivered view contracts S1–S9, the plan compiler, launch history,
measurement and fixture review. Live evaluation (S10) remained absent: the only
supported live path was CLI `execute --gateway openai`.

This task is phase 6: gated live evaluation. It makes a budgeted live run
possible from the interface only with explicit opt-in and confirmation, keeps
credentials out of every view and confirmation document, and keeps live results
partitioned from deterministic measurement (ADR-0022).

## Task Charter

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
- Pure confirmation document `acme-live-confirmation/1` with refusals.
- Environment opt-in (`ACME_TEST_UI_LIVE`) for the local composition.
- `acme-view-live-evaluation/1` projecting gate summary and live-series runs.
- Local `launchLiveExecution` for a single `ExecutionRequest`.
- Budget check against confirmed `maxModelCalls`.
- Tests without network; offline transport path for success.
- Documentation updates required by the Definition of Done.

### Out of Scope

- Multi-step live scenarios / ScenarioRunner changes.
- Measurements block or live gateway field on `acme-test-plan/1`.
- SPA / browser chrome.
- Quality scores.
- Default-CI live network calls.

### Definition of Done

- `acme-view-live-evaluation/1` versioned and JSON-asserted.
- Live launch refused without env opt-in and valid confirmation.
- Credentials not on confirmation or views.
- Live run records `gateway !== mock` for S8 live partition.
- Cost/usage when present; no quality score.
- Default tests perform no network call.
- Long-lived docs reflect delivered reality.

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

## Checklist

- [x] Write this charter and freeze it.
- [x] Write ADR-0023 for the live evaluation gate.
- [x] Add pure confirmation validation and S10 view builder.
- [x] Extend run records for optional live usage/confirmation metadata.
- [x] Add local live launch with env opt-in and injectable transport.
- [x] Write unit tests for every refusal and the live view partition.
- [x] Write an offline integration test launching through the live path.
- [x] Run every minimum verification gate.
- [x] Update long-lived docs and backlog.
- [x] Journal entry and archive this task.

## Decisions and Notes

- **Single-execute live, not ScenarioRunner live.** ScenarioRunner remains
  mock-only.
- **Opt-in is two-keyed:** `ACME_TEST_UI_LIVE` plus confirmation with
  `optIn: true`, confirmer and rationale.
- **No scores.** Outcome, budget and usage only (ADR-0022).
- Session recovered after power loss; implementation was on a `checkpoint`
  commit; verification and docs completion finished this session.

## Verification

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm boundaries`
- [x] `pnpm test` (unit 514, conformance 58, integration 44, scenario 21)
- [x] `pnpm docs:check`
- [x] `pnpm build`
- [x] `git diff --check`
- [x] No live provider call required in any default gate.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] ADR-0023
- [x] design specification and backlog proposal

## Handoff and Follow-ups

- Current state: complete; archived.
- Next recommended step: rendering surface (unchartered) or multi-step live
  scenarios as their own charter.
- Blockers: none.
