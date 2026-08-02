# Current Task

Task ID: ACME-0040
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
- [`docs/finished/ACME-0039_domain-test-ui-read-model.md`](../finished/ACME-0039_domain-test-ui-read-model.md)

## Task Summary
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

ACME-0039 accepted the Domain Test UI gate freezes (ADR-0019) and delivered
phases 0 and 1: the package boundary and a pure read model with view contracts
for S4–S7 over recorded execution evidence.

This task is the next slice the design specification and the backlog table
name: **phase 2 — catalog and adapter kit listing (S1)**. It answers "what
modules, contracts, adapters, scenarios and fixtures exist?" from the static
registries plus discovery under a configured root.

Phase 2 introduces the first filesystem reads in the package. They stay behind
an injected source port, so the default entry point remains pure and every
catalog test runs without touching a disk.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Render a complete, deterministically ordered catalog of registered modules,
contracts, discovered scenarios and fixtures, and declared adapter kit
targets, without inventing a registry the engine does not have.

### Primary Deliverable

An `acme-view-catalog/1` view contract and a pure builder in `@acme/test-ui`,
plus bounded, traversal-refusing discovery behind an injected source port with
a Node implementation on a separate entry point.

### In Scope

- `acme-view-catalog/1` view contract and its builder.
- Module section from `ModuleRegistry`: namespace, state and delta schema
  versions, tasks with role and contract reference.
- Contract section from `ContractRegistry`: id, version, full fingerprint,
  required capabilities, retention.
- Scenario section over discovered documents, classified by the runner's own
  `parseScenario` validator, never by a second parser.
- Fixture section over discovered files, including which scenarios reference
  each file and which references resolve, are missing or escape the root.
- Cross-links from scenario steps to registered namespaces and tasks, marking
  unknown targets rather than hiding them.
- Adapter kit targets declared by the caller, validated against the kits
  `@acme/testing` actually exports.
- Pure reference-path rules: refuse absolute paths and any path that escapes
  the configured root.
- A Node discovery source on a separate package entry point: bounded depth and
  entry count, no symlink following, deterministic ordering.
- Package tests over injected sources, plus one test that discovers the real
  `tests/scenario/files` tree through the Node source.
- Documentation updates required by the Definition of Done.

### Out of Scope

- Surfaces S2, S3, S4–S7 changes, S8, S9 and S10.
- The optional unit/type health strip; the specification marks it optional and
  no external report ingest exists to read.
- The `acme-test-plan/1` schema and compiler (phase 3).
- Launching scenarios, executions or conformance kits from the app.
- Any SPA, HTTP server, browser chrome or styling work.
- Interface-owned storage, run history and baselines.
- Live provider access, credentials or network calls.
- Changing any `@acme/core`, adapter, module or CLI contract.
- Adding an evaluator registry to core, or any other engine capability.

### Definition of Done

- `acme-view-catalog/1` exists, carries its version in the payload and is
  asserted by tests as JSON.
- Registry order is preserved exactly; the view performs no cosmetic re-sort,
  and every other ordering has a documented, tested tie-breaker.
- Contract fingerprints are rendered in full, never truncated.
- An invalid scenario document is reported as invalid with the validator's own
  error; it is never silently dropped and never repaired.
- A scenario reference that escapes the configured root is refused and
  reported, not resolved.
- A fixture no scenario references is visible as an orphan rather than hidden.
- A scenario step naming an unregistered namespace or task is reported as
  unknown rather than omitted.
- Absent evidence stays an explicit `unavailable` section with a reason code,
  including the evaluator section, because no evaluator registry exists.
- Discovery is bounded and refuses to follow symlinks; exceeding a bound is
  reported, not silently truncated.
- The default package entry point performs no I/O; the Node source is a
  separate entry point.
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
  sections "S1 — Catalog" and "Phase 2"
- [ADR-0019](../adr/0019-domain-test-ui-boundary-and-view-contracts.md)
- `packages/core/src/registries.ts` — static registry ordering and fingerprints
- `packages/core/src/modules.ts` — module and task definition shape
- `packages/testing/src/scenario.ts` — `acme-scenario/1` and `parseScenario`
- `apps/cli/src/scenario.ts` — existing scenario-root traversal refusal
- `packages/adapter-model-openai/package.json` — separate-entry-point precedent

## Checklist

- [x] Confirm phase 1 is committed and the tree is clean.
- [x] Write this charter and freeze it.
- [x] Add the pure reference-path rules and their tests.
- [x] Add the `acme-view-catalog/1` contract and builder.
- [x] Add the Node discovery source on a separate entry point.
- [x] Wire `@acme/testing` and `yaml` into the package and its references.
- [x] Write package tests over injected sources.
- [x] Write the real-tree discovery test.
- [x] Run every minimum verification gate.
- [x] Update `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `FILESTRUCTURE.md`, the
      design specification and the backlog proposal.
- [x] Add the signed `JOURNAL.md` entry and archive this task.

## Decisions and Notes
- A checkpoint after each step or substep is required. Checklist is therefore updated along the work and `CURRENT_STATUS.md` is always updated when changes affect the behavior.

- **No second parser.** Scenario validity is decided by `parseScenario` from
  `@acme/testing`, the same function the ScenarioRunner uses. The catalog
  reports its verdict and its error; it never re-implements the schema.
- **No evaluator registry is invented.** Core has `EvaluationDecision` and
  recorded `PreparedEvaluatorRun` evidence, but no evaluator registry. The
  catalog's evaluator section is therefore `unavailable` with a reason code.
  Adding a registry would be an engine change, which this charter excludes.
- **Adapter targets are declared, not discovered.** Nothing in the workspace
  registers adapter implementations; the CLI composition root hard-codes them.
  The caller declares targets and the catalog validates the kit name against
  the kits `@acme/testing` exports, marking unknown kits rather than dropping
  them.
- **The validator is injected, not imported.** `@acme/testing` publishes its
  conformance kits from the same barrel, and those modules import `vitest` at
  module scope. Importing `parseScenario` from the app's runtime surface would
  therefore pull a test framework into an application package. The builder
  takes the validator as a parameter instead: the caller passes
  `parseScenario`, and without it the scenario section is `unavailable`. This
  keeps the app free of `@acme/testing` at runtime and makes it structurally
  impossible for the catalog to own a competing schema. The package tests
  inject the real `parseScenario`, so interop is proven.
- **Adapter kit ids are asserted against real exports.** `ADAPTER_KITS` is a
  constant, and a test maps each id to the function `@acme/testing` exports,
  so the list cannot drift into naming a kit that does not exist.
- **`zod` is a test-only dependency.** The catalog tests build real
  `createModuleRegistry` / `createContractRegistry` instances rather than fake
  ones, because registry ordering and fingerprints are exactly what is under
  test. Real registries need real schemas. The package source imports no zod.
- **Discovery stays injected.** The builder takes already-decoded documents,
  so YAML decoding and filesystem walking live in the Node source on a
  separate entry point. The default surface keeps the ADR-0019 property that
  the read model performs no I/O.
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
- Next recommended step: phase 3 (`acme-test-plan/1` schema and compiler) as
  its own charter, with the gate-3 ADR at first export.
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
