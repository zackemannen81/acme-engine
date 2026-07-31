# Current Task

Task ID: ACME-0026
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
- `docs/design/acme-design-and-development-spec.md` section 18.2
- `docs/adr/0013-durable-sqlite-schema-and-driver.md`
- `docs/adr/0014-live-provider-boundary-and-transport-port.md`
- `apps/cli/src/index.ts`
- `tests/integration/execution-engine-sqlite.test.ts`

## Task Summary

Every adapter ACME has is reachable only from tests. `docs/CURRENT_STATUS.md`
records this as a gap in its own words: no composition root selects the
durable adapter. The workspace has a bounded ExecutionEngine, two repository
adapters, two reference domains and a provider mapping, and nothing outside
the test suite can run any of it.

This task gives ACME a thin composition root. It is deliberately small: it
wires what already exists and adds no new engine behavior. `scenario run` is
excluded because ScenarioRunner does not exist yet.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Make the implemented engine, adapters and modules usable from outside the test
suite through one composition root that selects its adapters explicitly.

### Primary Deliverable

An `@acme/cli` application exposing `execute`, `execution replay`,
`execution inspect`, `state inspect` and `memory inspect` over both the
in-memory and durable SQLite repositories, with versioned JSON on stdout and
diagnostics on stderr.

### In Scope

- Argument parsing with `node:util.parseArgs`, matching the specification's
  section 18.2 shape for the implemented subset.
- `acme execute --request <file> [--adapter memory|sqlite] [--database <path>]
  [--json]`, running one task through the bounded ExecutionEngine.
- `acme execution replay <execution-id> --mode verify`, reporting the ADR-0012
  replay verdict.
- `acme execution inspect <execution-id> [--show-payloads]`.
- `acme state inspect <namespace> <entity-id> [--revision N]`.
- `acme memory inspect <namespace> <entity-id> [--status <status>]`.
- Static registration of both reference modules and both prompt contracts.
- Gateway selection limited to the deterministic mock driven by a script file,
  because no network transport exists. The flag must be shaped so the provider
  gateway can be added later without changing the others.
- Versioned JSON on stdout, diagnostics on stderr, and payload redaction
  unless `--show-payloads` is supplied.
- Meaningful process exit codes distinguishing success, a non-committed
  terminal outcome and a usage error.
- Tests that drive the exported entry point in-process, including one that
  executes against a SQLite database in a temporary directory and then replays
  and inspects the same database.
- Documentation updates to `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`,
  `docs/FILESTRUCTURE.md` and `docs/JOURNAL.md`.

### Out of Scope

- `acme scenario run`. ScenarioRunner does not exist; adding a command that
  cannot work would be a lie in the help text.
- `acme execution resume`. Resume behavior is not implemented.
- `acme db migrate` and `acme db verify`. Opening a database already applies
  and verifies migrations, so separate commands would add surface without
  adding capability.
- Any live provider call, network transport, credential handling or budget.
- Any change to `packages/core`, an adapter, a module or the conformance
  suites. The composition root wires what exists; if something cannot be wired
  without changing it, that is a finding.
- A published binary, packaging or release.
- Interactive prompts, colored output and progress rendering.

### Definition of Done

- Every listed command runs against both `--adapter memory` and
  `--adapter sqlite`.
- One test executes a request against a SQLite file, then replays and inspects
  that same file through the CLI, proving the durable adapter is reachable
  from a composition root rather than only from tests.
- JSON output carries an explicit version field and is stdout-only.
- Payloads are redacted unless `--show-payloads` is supplied.
- A usage error, a non-committed terminal outcome and a successful commit are
  distinguishable by exit code.
- Unknown commands, unknown flags and missing required arguments fail with a
  usage error rather than a stack trace.
- No file under `packages/` changes.
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

- `docs/design/acme-design-and-development-spec.md` section 18.2
- `packages/core/src/execution-engine.ts`
- `packages/adapter-sqlite/src/index.ts`
- `packages/adapter-memory/src/index.ts`
- `packages/adapter-model-mock/src/scripted-model-gateway.ts`
- `tests/integration/execution-engine-sqlite.test.ts`

## Checklist

- [x] Read the required documents and the specification's CLI shape in order.
- [x] Wire the composition root: registries, engines, adapter selection.
- [x] Implement argument parsing and usage errors.
- [x] Implement `execute`.
- [x] Implement `execution replay` and `execution inspect`.
- [x] Implement `state inspect` and `memory inspect`.
- [x] Implement versioned JSON output, redaction and exit codes.
- [x] Add the durable round-trip test through the CLI.
- [x] Run every frozen verification gate and record evidence.
- [x] Update the long-lived documentation and add the signed journal entry.
- [x] Archive ACME-0026 and restore or repopulate `docs/CURRENT_TASK.md`.

## Decisions and Notes

- A checkpoint after each command is required. The checklist is updated along
  the work and `CURRENT_STATUS.md` is updated when changes affect behavior.
- This is a composition root, not a feature. Its value is that something
  outside the test suite finally selects an adapter and runs the engine. If it
  grows engine behavior, the scope has been misread.
- Gateway selection is limited to the deterministic mock on purpose. No
  network transport exists, so offering a provider gateway would be a command
  that cannot run. The flag is shaped so adding one later is additive.
- Tests drive the exported entry point in-process rather than spawning a
  process. That keeps them deterministic and fast, and it tests the same code
  path the binary would run.
- Discovery, 2026-07-31: no app had ever had tests, so `vitest.config.ts` and
  `tsconfig.tests.json` only included `packages/` and `tests/`. Both were
  extended to include `apps/**/test`. This was required by the frozen charter's
  own verification, not a new deliverable.
- Note, 2026-07-31: the deterministic mock requires an exact
  `expectedRequestHash`, which a human cannot compute by hand. That is the
  mock's contract working as designed, so the CLI passes the script file
  through unchanged and lets the mismatch surface on stderr rather than
  weakening the assertion.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- None.

## Verification

- [x] Prove the durable round trip: execute, replay and inspect one SQLite
      file through the CLI.
- [x] Prove payload redaction is the default.
- [x] Prove exit codes distinguish the three outcomes.
- [x] Confirm no file under `packages/` changed.
- [x] Record exact test counts for every gate.
- [x] Document skipped checks and reasons.

Verification completed on 2026-07-31:

- The durable round trip is asserted end to end: `execute` against a SQLite
  file, then `execution replay --mode verify` reporting `match`, then
  `execution inspect`, `state inspect` and `memory inspect` against that same
  file. Each run opens and closes its own connection.
- Redaction is asserted as the default for the recorded request input,
  document values, state values and memory values, and `--show-payloads` is
  asserted to reveal them.
- Ten argument shapes are asserted to exit with the usage code and print to
  stderr only.
- `pnpm docs:check` passed for 63 Markdown files after archival.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm build` passed.
- `pnpm boundaries` passed.
- `pnpm test:unit` passed 299 tests in 36 files.
- `pnpm test:conformance` passed 46 tests in 7 files.
- `pnpm test:integration` passed 13 tests in 2 files.
- `pnpm test:scenario` passed 5 tests in 2 files.
- `git diff --check` passed.
- `git status` confirms no file under `packages/` changed, and the unchanged
  package test counts confirm it independently.
- Skipped checks: none.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] No ADR expected; this wires decided boundaries rather than making one.

## Handoff and Follow-ups

- Current state: ACME-0026 is complete. `@acme/cli` is the composition root
  and selects either repository from outside the test suite. Every frozen gate
  passed.
- Next recommended step: ScenarioRunner v1 over the named `acme-scenario/1`
  format, which then adds `scenario run` to the CLI. The budgeted live test
  follows, and its transport is the only remaining piece before a real
  provider call is possible.
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
