# Current Task

Task ID: ACME-0042
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
- [`docs/adr/0020-acme-test-plan-schema-and-compiler.md`](../adr/0020-acme-test-plan-schema-and-compiler.md)
- [`docs/finished/ACME-0041_domain-test-ui-plan-compiler.md`](../finished/ACME-0041_domain-test-ui-plan-compiler.md)

## Task Summary
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

Phases 0–3 delivered the package boundary, the S4–S7 read model, the S1
catalog and `acme-test-plan/1` with its compiler. Nothing wires any of it up:
a compiled plan runs today only because a test writes it to disk and calls the
CLI.

This task is phase 4 — offline authoring, launch and history. It closes the
loop the specification names: a domain engineer can configure a run, launch
it, and inspect what the engine did, without a browser and without the CLI.

It is the first slice where the app owns a composition and writes files, so it
is also where gate 4 (interface storage) stops being a promise.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Let a plan be previewed, launched through the existing ScenarioRunner, and
found again afterwards with its evidence, entirely offline.

### Primary Deliverable

An `acme-view-plan/1` designer surface, an `acme-view-runs/1` console and
history surface, and a local launch path that compiles a plan, runs it through
the ScenarioRunner and records the run under an interface-owned workspace.

### In Scope

- ADR for interface workspace storage and the launch boundary.
- `acme-view-plan/1` (S2): plan identity, composition, seed, case summaries
  and the compiled scenario, with validation reported rather than thrown.
- `acme-view-runs/1` (S3): run history with stable ordering, and a per-run
  projection of the scenario report.
- A file workspace under a configured root: run records written as one file
  per run, with the history index derived by reading them.
- An app-owned composition selecting the in-memory or SQLite repository and
  the scripted mock gateway, through the same entry points the CLI uses.
- A launch function that compiles, runs and records, on a separate entry
  point so the default surface keeps performing no I/O.
- Refusal of any run identifier that is not a safe file name.
- An end-to-end test: preview a plan, launch it, read it back from history,
  and inspect the recorded execution through the existing S4 read model.
- Documentation updates required by the Definition of Done.

### Out of Scope

- Surfaces S8, S9 and S10, and any change to S1, S4–S7 or the plan schema.
- Any SPA, HTTP server, browser chrome, screenshot or styling work.
- A queue, a scheduler, background execution, retry or cancellation.
- Baselines, thresholds, measurements and fixture approval.
- Live provider access, credentials or network calls.
- Changing `acme-scenario/1`, the ScenarioRunner, core, adapters or the CLI.
- Writing anything into the execution ledger from the interface.
- Adapter workbench kit launching.

### Definition of Done

- `acme-view-plan/1` and `acme-view-runs/1` are versioned, JSON-asserted, and
  report an invalid plan rather than throwing.
- A plan can be launched offline through the ScenarioRunner and produces a
  recorded run under the workspace root.
- The history index is derived from the recorded run files, so it cannot
  disagree with them.
- Run records live in files the interface owns and share no table, file or
  directory with the execution ledger.
- A run identifier that is not a safe file name is refused, so a record can
  never be written outside the workspace root.
- The live-progress half of S3 is reported unavailable rather than simulated,
  because launch is synchronous and no queue exists.
- The interface performs no ledger write: no commit, no markTerminal, no
  model-call mutation.
- The default entry point still performs no I/O.
- The app still imports no package internal, and nothing imports the app.
- An end-to-end test configures, launches, finds and inspects one run.
- No test in any gate performs a network call, reads wall-clock time for run
  identity, or requires a browser.
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
  sections "S2", "S3", "Engine read and write contract" and "Phase 4"
- [ADR-0019](../adr/0019-domain-test-ui-boundary-and-view-contracts.md), gate 4
- [ADR-0020](../adr/0020-acme-test-plan-schema-and-compiler.md)
- `apps/cli/src/composition.ts` — the existing composition-root pattern
- `packages/testing/src/scenario.ts` — `runScenario` and its report

## Checklist

- [x] Confirm phase 3 is committed and the tree is clean.
- [x] Write this charter and freeze it.
- [x] Write the ADR for workspace storage and the launch boundary.
- [x] Add the `acme-view-plan/1` designer surface.
- [x] Add the `acme-view-runs/1` console and history surface.
- [x] Add the file workspace with a derived history index.
- [x] Add the app composition and the launch path on a local entry point.
- [x] Write the package tests.
- [x] Write the end-to-end configure, launch, find and inspect test.
- [x] Run every minimum verification gate.
- [x] Update `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `FILESTRUCTURE.md`, the
      design specification and the backlog proposal.
- [x] Add the signed `JOURNAL.md` entry and archive this task.

## Decisions and Notes
- A checkpoint after each step or substep is required. Checklist is therefore updated along the work and `CURRENT_STATUS.md` is always updated when changes affect the behavior.

- **No queue is invented.** Launch is a synchronous call. S3's live-progress
  half is therefore `unavailable` with a reason, not a simulated queue with a
  single entry. The specification's console fields describe a system that
  runs work in the background; this one does not.
- **The history index is derived.** Listing reads the run files rather than
  maintaining a separate index, so the index cannot drift from what was
  actually recorded. Gate 4 permits a separate SQLite index; nothing needs one
  yet.
- **Run identifiers are file names.** A record is written as
  `runs/<runId>.json`, so `runId` is validated as a safe token and anything
  else is refused before a path is built.
- **Found while building: the runner owns the gateway.** `runScenario` builds
  the scripted gateway itself from each step's mock fixture and hands it to
  `composition.engine()`. The launch path therefore needs no gateway
  dependency at all, and `@acme/adapter-model-mock` was dropped from the
  package before it was ever used.
- **The composition is returned, not hidden.** `launchPlan` hands back the
  composition it built so the caller can read evidence through the repository
  port and close it. Hiding it would have forced either a second composition
  for inspection or an evidence copy the interface does not own.
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

- Current state: complete.
- Next recommended step: phase 5 (measurement and fixture review) as its own
  charter.
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
