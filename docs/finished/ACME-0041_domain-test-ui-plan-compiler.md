# Current Task

Task ID: ACME-0041
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
- [`docs/finished/ACME-0040_domain-test-ui-catalog.md`](../finished/ACME-0040_domain-test-ui-catalog.md)

## Task Summary
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

ACME-0039 and ACME-0040 delivered phases 0–2 of the Domain Test UI: the
package boundary, the S4–S7 read model and the S1 catalog.

This task is phase 3: the `acme-test-plan/1` schema and its compiler. Gate 3
of ADR-0019 accepted a thin compilable plan and required **an ADR when the
schema is first exported**, so this task introduces one.

The plan is convenience; the compiled artifact is the reviewable unit.
Scenarios stay the canonical executable artifact, and the compiler is pure and
deterministic so identical plans produce identical bytes.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Publish a versioned `acme-test-plan/1` and a pure compiler that turns a valid
plan into artifacts the existing ScenarioRunner already accepts, and refuses
to compile anything else.

### Primary Deliverable

An exported `acme-test-plan/1` schema with a strict validator, plus
`compileTestPlan`, producing a byte-identical `acme-scenario/1` document for
identical plans, governed by a new ADR.

### In Scope

- ADR for `acme-test-plan/1` at first export, as gate 3 requires.
- The versioned plan shape: identity, seed, composition, policy, cases.
- A strict validator that rejects unknown fields, a missing or malformed seed,
  a bad policy and any fixture reference that escapes the scenario root.
- Policy validation through the engine's own `resolveExecutionPolicy`, not a
  second policy schema.
- A pure deterministic compiler to `acme-scenario/1`.
- Optional materialization of `ExecutionRequest` values when the caller
  supplies already-loaded fixtures; the compiler itself reads no file.
- A golden test pinning the compiled bytes.
- A scenario-gate test proving a compiled plan runs through the existing
  runner and reaches the digest the hand-written Narrative Phase 5 test pins.
- Documentation updates required by the Definition of Done.

### Out of Scope

- Surfaces S2, S3, S8, S9 and S10, and any change to S1 or S4–S7.
- The `measurements` block; it belongs to S8 in phase 5.
- Authoring UI, launch controls, run history and interface-owned storage.
- Any SPA, HTTP server, browser chrome or styling work.
- Filesystem or network access inside the compiler.
- Changing `acme-scenario/1`, the ScenarioRunner, core, adapters or the CLI.
- Adding a second scenario validator or a second policy schema.
- Compiling to anything other than `acme-scenario/1` and `ExecutionRequest`.

### Definition of Done

- `acme-test-plan/1` is exported with its version in the document, and an ADR
  records the decision, the alternatives and the compatibility rule.
- A valid minimal plan and a valid full plan both compile.
- Compiling the same plan twice produces byte-identical canonical JSON, and a
  golden test pins those bytes.
- An unknown field, a missing seed, a malformed policy and a reference that
  escapes the root each refuse to compile with a structured error.
- The compiler performs no filesystem, network or clock access.
- The compiled document is accepted by the runner's own `parseScenario`.
- A compiled plan executed through the existing CLI scenario path reaches the
  operation digest the hand-written Narrative Phase 5 test pins.
- The compiler emits only `acme-scenario/1` and `ExecutionRequest` values.
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
  sections "Test plan configuration model" and "Phase 3"
- [ADR-0019](../adr/0019-domain-test-ui-boundary-and-view-contracts.md), gate 3
- `packages/testing/src/scenario.ts` — `acme-scenario/1` and `parseScenario`
- `packages/core/src/execution-identity.ts` — `resolveExecutionPolicy`
- `tests/scenario/narrative-phase-5.test.ts` — the pinned operation digest
- `tests/scenario/scenario-runner.test.ts` — the existing runner harness

## Checklist

- [x] Confirm phase 2 is committed and the tree is clean.
- [x] Write this charter and freeze it.
- [x] Write the ADR for `acme-test-plan/1`.
- [x] Implement the plan schema and its strict validator.
- [x] Implement the pure compiler.
- [x] Write the golden and refusal tests.
- [x] Write the compile-and-run scenario-gate test.
- [x] Run every minimum verification gate.
- [x] Update `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `FILESTRUCTURE.md`, the
      design specification and the backlog proposal.
- [x] Add the signed `JOURNAL.md` entry and archive this task.

## Decisions and Notes
- A checkpoint after each step or substep is required. Checklist is therefore updated along the work and `CURRENT_STATUS.md` is always updated when changes affect the behavior.

- **`measurements` is excluded from v1.** The specification lists it as
  normative intent, but nothing reads it until S8 exists in phase 5. Shipping
  a field no code honors would be a promise the artifact cannot keep. Adding
  an optional field later needs no version bump, so deferring is reversible.
- **The model selection is not in the plan.** `acme-scenario/1` takes the
  `ModelSelection` from the mock-response fixture, not from the execute step.
  A plan therefore cannot name a model, and an `ExecutionRequest` cannot be
  materialized from a plan alone.
- **Fixtures are injected, never read.** The compiler emits full
  `ExecutionRequest` values only when the caller supplies already-loaded
  fixture contents. Without them that output is unavailable, and the compiler
  keeps the ADR-0019 property of performing no I/O.
- **Found while building: `expectedRequestHash` must be a lowercase SHA-256
  digest.** `parseScenario` enforces it, so a plan accepting any string would
  have compiled into a document the runner refuses. The plan validator now
  enforces the same rule, and the refusal names the plan field rather than
  surfacing at run time. `operationDigest` deliberately keeps the runner's
  weaker non-empty-text rule rather than inventing a stricter one.
- **Found while building: the default policy is not what the golden guessed.**
  `maxRepairCalls` and `maxRevisionCalls` default to `0`, not `1`. The golden
  caught it on first run, which is the entire point of pinning bytes.
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
- Next recommended step: phase 4 (authoring, launch and history) as its own
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
