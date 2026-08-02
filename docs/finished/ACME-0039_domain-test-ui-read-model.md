# Current Task

Task ID: ACME-0039
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-01
Last updated: 2026-08-01
Charter frozen at: 2026-08-01

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
- [`docs/backlog/domain-test-ui-implementation.md`](../backlog/domain-test-ui-implementation.md)
- Relevant ADRs under `docs/adr/`

## Task Summary
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

ACME-0038 rewrote the Domain Test UI specification and recorded seven
**proposed** gate freezes. It explicitly did not authorize code. The
maintainer has now approved starting the ordered build plan, so the two
remaining activation blockers — accepting the gate freezes and activating an
implementation charter — are resolved by this task.

This task executes exactly the first charter slice named in the design
specification and the backlog proposal: **phase 0 (gate freeze and package
skeleton) and phase 1 (read model over recorded evidence)**. It does not build
the workbench chrome, the plan compiler, the catalog or any launcher. The
expensive missing capability after Milestone 2 is inspectable evidence, so the
deliverable is a machine-readable read model whose view contracts can be
asserted as JSON without a browser.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Activate the Domain Test UI with its boundaries enforced and a pure,
versioned read model that renders recorded execution evidence for surfaces
S4–S7 without inventing a verdict.

### Primary Deliverable

An `apps/test-ui` package (`@acme/test-ui`) that exports versioned view
contracts and pure read-model builders for the execution inspector (S4),
memory decision inspector (S5), state inspector (S6) and replay comparison
(S7), with redaction and retention presentation rules, proven by tests that
assert JSON and never touch a network, a clock or a browser.

### In Scope

- Record acceptance of the seven ACME-0038 gate freezes in an ADR, including
  the one deviation the engine's vocabulary forces (replay outcomes).
- `apps/test-ui` package skeleton: `package.json`, `tsconfig.json`, workspace
  and root project references, no UI chrome.
- `dependency-cruiser` rules for the new app plus negative boundary fixtures
  proving a forbidden import fails.
- Versioned view contracts for S4, S5, S6 and S7.
- Pure read-model builders over recorded evidence types owned by `@acme/core`
  (`ExecutionRecord`, `ExecutionAttempt`, `ModelCallRecord`,
  `ExecutionReplayEvidence`, `PreparedCommit`, `StateSnapshot`,
  `StateTransition`, `ReplayReport`).
- Redaction and retention-mode presentation rules at the view boundary.
- Package tests over handcrafted evidence fixtures, plus one integration test
  that feeds evidence from a real offline engine run through the read model.
- Documentation updates required by the Definition of Done.

### Out of Scope

- Surfaces S1, S2, S3, S8, S9 and S10 in any form.
- The `acme-test-plan/1` schema, its compiler and its ADR (phase 3).
- Launching executions, scenarios or conformance kits from the app.
- Any SPA, HTTP server, browser chrome, screenshot or styling work.
- Interface-owned storage (plans, baselines, approval records, history index).
- Live provider access, credentials, network calls or wall-clock reads.
- Changing any `@acme/core`, adapter, module, CLI or `@acme/testing` contract.
- Making the UI a CI path; `pnpm` and `@acme/cli` remain the CI entry points.

### Definition of Done

- The seven gate freezes are accepted in an ADR that the design specification
  and `CURRENT_STATUS.md` reference; the deviation is stated, not hidden.
- `@acme/test-ui` exists, builds, typechecks and exports the read model.
- Every S4–S7 view contract carries an explicit version identifier and is
  asserted by tests as JSON, not as markup.
- Missing evidence renders as an explicit `unavailable` section with a reason
  code; it never renders as zero, empty or absent-by-default.
- `none` and `hash-only` retention render model payloads as `not-retained`
  rather than as an empty or redacted value.
- Content payloads are redacted unless reveal is explicitly requested.
- Prepared memory decision order is preserved, and ignored and
  reject-candidate decisions remain visible as audit evidence.
- Replay outcomes stay in the engine's exact vocabulary; no outcome the
  engine cannot produce is invented, and "not run" is distinct from the
  engine's `unavailable`.
- No view computes a pass/fail verdict; every verdict shown is copied from
  engine, runner or repository evidence.
- The app imports no package internal, and no package or app imports the app;
  both directions are proven by a failing dependency-cruiser fixture.
- No test in any gate performs a network call, reads wall-clock time or
  requires a browser.
- `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/FILESTRUCTURE.md`,
  `docs/JOURNAL.md`, the design specification and the backlog proposal reflect
  the delivered reality.

### Minimum Verification Gates

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm boundaries`, including the new forbidden-import fixtures
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance`
- [x] `pnpm test:integration`
- [x] `pnpm test:scenario`
- [x] `pnpm docs:check`
- [x] `git diff --check`

## References

- [Domain Test UI — Specification](../design/domain-test-ui-specification.md)
- [Backlog — Domain Test UI implementation](../backlog/domain-test-ui-implementation.md)
- [ADR-0019 Domain Test UI boundary and view contracts](../adr/0019-domain-test-ui-boundary-and-view-contracts.md)
- [ADR-0010 Input-bound validation and interpretation](../adr/0010-input-bound-validation-and-interpretation.md)
- [ADR-0012 Milestone 1 execution identity and replay](../adr/0012-milestone-1-execution-identity-and-replay.md)
- [ADR-0016 Encrypted payload retention](../adr/0016-encrypted-payload-retention.md)
- [ADR-0017 Durable execution resume](../adr/0017-durable-execution-resume.md)
- `packages/core/src/repository.ts` — recorded evidence types
- `packages/core/src/response-pipeline.ts` — trust pipeline substages
- `packages/core/src/memory-engine.ts` — decision and mutation ordering
- `apps/cli/src/run.ts` — existing redaction and inspection precedent

## Checklist

- [x] Read the governing documents and confirm no activation blocker remains.
- [x] Write this charter and freeze it.
- [x] Write ADR-0019 accepting the gate freezes and fixing the app boundary.
- [x] Add the `apps/test-ui` package skeleton and wire workspace references.
- [x] Add dependency-cruiser rules and negative boundary fixtures.
- [x] Implement redaction and retention presentation rules.
- [x] Implement the S4 execution view contract and builder.
- [x] Implement the S5 memory decision view contract and builder.
- [x] Implement the S6 state view contract and builder.
- [x] Implement the S7 replay view contract and builder.
- [x] Write package tests over handcrafted evidence fixtures.
- [x] Write the integration test over real offline engine evidence.
- [x] Run every minimum verification gate.
- [x] Update `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `FILESTRUCTURE.md`, the
      design specification and the backlog proposal.
- [x] Add the signed `JOURNAL.md` entry and archive this task.

## Decisions and Notes
- A checkpoint after each step or substep is required. Checklist is therefore updated along the work and `CURRENT_STATUS.md` is always updated when changes affect the behavior.

- **Gate acceptance.** All seven proposed freezes are accepted as written.
  Phase 1 exercises gates 1, 2, 4, 6 and 7 only by not violating them; gates 3
  and 5 bind later phases.
- **Replay vocabulary deviation.** The specification's S7 lists a `forked`
  outcome "(or the engine's exact vocabulary)". `ReplayReport` produces
  `match | different | unavailable` and nothing else, so the view contract
  uses exactly those. Inventing `forked` would be the interface computing a
  verdict the engine never produced. Recorded in ADR-0019.
- **Trust pipeline honesty.** Substage outcomes are derived only from recorded
  attempt stages, the execution's current stage, terminal status and
  `AcmeErrorData` (including `details.pipelineStage`). Where a recorded
  failure lands in an execution stage that owns several trust substages and
  the error does not identify which one failed, every substage of that stage
  reports `reached` rather than a guessed `passed` or `failed`.
- **Read model input shape.** Builders take plain evidence values, not a
  repository, so phase 1 needs no composition, no adapter and no I/O. The
  composition process that loads evidence belongs to phase 4.
- **Engine-backed proof.** The package suite uses handcrafted fixtures. One
  integration test drives the real `ExecutionEngine` over the in-memory
  repository and the scripted mock gateway, then feeds the recorded evidence
  through the read model, so the contracts are proven against evidence the
  engine actually writes.
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
- Next recommended step: phase 2 (S1 catalog over registries, scenario
  discovery and adapter kit targets) as its own charter.
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
