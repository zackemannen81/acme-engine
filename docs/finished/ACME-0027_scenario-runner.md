# Current Task

Task ID: ACME-0027
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-07-31
Last updated: 2026-07-31
Charter frozen at: 2026-07-31

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/design/acme-design-and-development-spec.md` sections 5.1, 5.2 and 18.1
- `docs/adr/0012-milestone-1-execution-identity-and-replay.md`
- `docs/finished/ACME-0026_cli-composition-root.md`
- `tests/scenario/narrative-phase-5.test.ts`
- `packages/testing/src/domain-module-conformance.ts`

## Task Summary

`AGENTS.md` states the guardrail plainly: the ExecutionEngine runs one task,
and multi-step flows belong to a separate ScenarioRunner. That runner does not
exist, so both acceptance scenarios are hand-written TypeScript and the CLI
has no `scenario run`. The specification already names the file format
`acme-scenario/1` and assigns the runner to `@acme/testing`, so this task
implements a decided boundary rather than inventing one.

The runner must sequence executions without enlarging the engine contract. It
is a caller of the engine, not an extension of it.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Sequence multiple executions against the existing bounded ExecutionEngine from
a declarative `acme-scenario/1` file, without enlarging the engine contract.

### Primary Deliverable

A ScenarioRunner in `@acme/testing` that validates an `acme-scenario/1`
document, executes its steps serially against an injected composition and
emits a versioned JSON report, plus `acme scenario run` in the CLI.

### In Scope

- Strict validation of the `acme-scenario/1` document shape from
  specification section 18.1: `schemaVersion`, `name`, `seed`, `composition`
  and `steps`.
- The four step kinds the specification shows: `execute`, `assert`, `replay`
  and `assertDigest`.
- Alias resolution, so a later step refers to an earlier execution by its
  `as` name.
- Serial execution, halting at the first failed assertion while still
  reporting every step already run.
- A versioned `acme-scenario-report/1` JSON report naming each step, its
  outcome and the identity, digest and revision evidence it observed.
- An injected composition: the runner receives a repository and a gateway
  factory and never imports a concrete adapter, so `@acme/testing` keeps
  depending on `@acme/core` alone.
- An injected fixture loader, so the runner never touches the filesystem.
- `acme scenario run <file> [--adapter memory|sqlite] [--database <path>]
  [--json]` in the CLI, which owns YAML parsing, path resolution and the
  rejection of any fixture path escaping the scenario root.
- A `seed` that fixes the clock and makes IDs sequential, so a scenario is
  reproducible.
- Re-expressing the Narrative Phase 5 acceptance scenario as an
  `acme-scenario/1` file and proving it reaches the same operation digest as
  the hand-written test.
- Documentation updates to `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`,
  `docs/FILESTRUCTURE.md` and `docs/JOURNAL.md`.

### Out of Scope

- Any change to `ExecutionEngine`, `ExecutionRepository`, `ModelGateway` or
  the error taxonomy. The runner is a caller. If sequencing cannot be
  expressed without enlarging the engine contract, that is a finding: pause
  and raise a bounded child task.
- A workflow runtime, branching, conditionals, loops, retries or parallel
  steps. The specification requires a future workflow layer to be separate.
- Arbitrary JavaScript or shell execution from a scenario file, in any form.
- Scenario includes and composition of one scenario from another. The v1
  format shows none, and adding them would require the cycle and root rules
  before there is anything to compose.
- Deleting or rewriting the existing hand-written acceptance tests. The new
  file must agree with them, which is only evidence while both exist.
- Any live provider call, network transport or budget.
- The Domain Test UI.

### Definition of Done

- A scenario file drives at least two executions serially, with a later step
  referring to an earlier one by alias.
- The Narrative Phase 5 scenario, expressed as `acme-scenario/1`, reaches the
  same operation digest as the hand-written test, and both remain in the
  suite.
- A failing assertion halts the run, is named in the report and produces a
  non-zero CLI exit code.
- The report carries an explicit version field.
- `@acme/testing` still depends on `@acme/core` alone, proven by the boundary
  check.
- A scenario file cannot cause a filesystem read outside the scenario root,
  proven by an explicit rejected-path test.
- A malformed scenario, an unknown step kind and an unresolved alias each fail
  with a structured error rather than a stack trace.
- No file under `packages/core`, the adapters or the modules changes.
- All frozen verification gates pass, or every skipped check is recorded with
  its reason.
- The task is archived under `docs/finished/` and `docs/CURRENT_TASK.md` is
  restored or repopulated.

### Minimum Verification Gates

- [x] `pnpm docs:check`
- [x] `pnpm format:check`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm boundaries`
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance`
- [x] `pnpm test:integration`
- [x] `pnpm test:scenario`
- [x] `pnpm build`
- [x] `git diff --check`

## References

- `docs/design/acme-design-and-development-spec.md` section 18.1
- `packages/core/src/execution-engine.ts`
- `packages/adapter-model-mock/src/scripted-model-gateway.ts`
- `apps/cli/src/composition.ts`
- `tests/scenario/narrative-phase-5.test.ts`

## Checklist

- [x] Read the required documents and the `acme-scenario/1` format in order.
- [x] Define the scenario and report schemas in `@acme/testing`.
- [x] Implement validation, alias resolution and serial step execution.
- [x] Implement the four step kinds.
- [x] Implement the versioned JSON report.
- [x] Add `scenario run` to the CLI, including YAML parsing and path safety.
- [x] Express Narrative Phase 5 as a scenario file and prove the digest match.
- [x] Run every frozen verification gate and record evidence.
- [x] Update the long-lived documentation and add the signed journal entry.
- [x] Archive ACME-0027 and restore or repopulate `docs/CURRENT_TASK.md`.

## Decisions and Notes

- A checkpoint after each step kind is required. The checklist is updated
  along the work and `CURRENT_STATUS.md` is updated when changes affect
  behavior.
- Placement decision: the specification assigns ScenarioRunner to
  `@acme/testing`. That package depends on `@acme/core` alone today, and this
  task keeps it that way by injecting the composition rather than importing
  adapters. The CLI already knows how to build a composition, so it supplies
  one.
- Boundary decision: the runner never reads a file. The CLI owns YAML
  parsing, path resolution and the rule that a fixture path may not escape the
  scenario root. This keeps the runner deterministic, filesystem-free and
  usable directly from a test.
- Model-hash decision: the deterministic mock requires an exact
  `expectedRequestHash`, but the specification's scenario shape carries only
  `mockResponse`. A scenario may pin the hash, and when it does the mock's
  assertion stands unchanged. When it does not, the runner records the actual
  hash in its report and marks that call unpinned, so an author can pin it
  afterwards. The runner must never compute the hash and then assert it
  against itself, which would be a vacuous check.
- Halting decision: the run stops at the first failed assertion rather than
  continuing, because later steps depend on earlier state and a cascade of
  derived failures obscures the first real one. Every step already run is
  still reported.
- Finding, 2026-07-31: the operation-digest preimage includes memory record
  IDs, so a scenario that pins a digest must also pin its ID scheme. The first
  attempt left `seed` parsed but unused and the digest differed for that
  reason alone. Specification 18.1 names `ids: sequential` without defining
  what it emits, so the emitted shape is defined in the runner and
  `idPrefix` and `idPadding` make an existing scheme expressible. This
  completes the specification rather than deviating from it, so no ADR was
  raised.
- Consequence, 2026-07-31: the composition cannot be built before the document
  is parsed, because the seed lives in the document. The CLI therefore parses
  first and builds the composition from the parsed seed.
- Reporting decision, 2026-07-31: a non-committed execute step records the
  terminal error in its report detail. Without it the report says a step
  failed and sends the reader back to the engine to learn what the run
  already knew.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- None.

## Verification

- [x] Prove the scenario-expressed Narrative Phase 5 digest equals the
      hand-written test's digest.
- [x] Prove a failing assertion halts the run and is named in the report.
- [x] Prove a fixture path escaping the scenario root is rejected.
- [x] Prove `@acme/testing` still depends on core alone.
- [x] Confirm no core, adapter or module source file changed.
- [x] Record exact test counts for every gate.
- [x] Document skipped checks and reasons.

Verification completed on 2026-07-31:

- The scenario-expressed Narrative Phase 5 run reaches operation digest
  `15f143ba7991e04065ad1ed6bc9f2df6942e05372d18f5d4469b2eba4ae5c94f`, the same
  value the hand-written test pins. Both expressions remain in the suite.
- A failing digest assertion halts the run: the report marks step 1 failed,
  step 2 skipped, names the failure and the CLI exits non-zero.
- Fixture paths escaping the scenario root are rejected for `..`, nested
  traversal and absolute paths.
- `pnpm boundaries` passes and `@acme/testing` still depends on
  `@acme/core` alone.
- `pnpm docs:check` passed for 66 Markdown files after archival.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm build` passed.
- `pnpm test:unit` passed 313 tests in 37 files.
- `pnpm test:conformance` passed 46 tests in 7 files.
- `pnpm test:integration` passed 13 tests in 2 files.
- `pnpm test:scenario` passed 19 tests in 3 files.
- `git diff --check` passed.
- `git status` confirms no file under `packages/core`, the adapters or the
  modules changed.
- Skipped checks: none.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] ADR only if the scenario or report format deviates from specification
      section 18.1.

## Handoff and Follow-ups

- Current state: ACME-0027 is complete. The ScenarioRunner sequences
  executions over `acme-scenario/1`, the CLI exposes `scenario run`, and the
  Narrative Phase 5 scenario reaches the same digest in both expressions.
  Every frozen gate passed.
- Next recommended step: The budgeted live test. A `fetch` transport
  implementing `ProviderTransport` is the only remaining piece before a real
  provider call is possible, and ADR-0014 already fixes its failure
  classification, ambiguity rule and `hash-only` retention.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: None.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
