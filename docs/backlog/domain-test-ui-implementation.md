# Domain Test UI implementation

Status: **Partially resolved — phases 0–3 delivered (ACME-0039, ACME-0040, ACME-0041); phases 4–6 open**
Discovered in: ACME-0014
Specification: [`docs/design/domain-test-ui-specification.md`](../design/domain-test-ui-specification.md)
Decisions: [ADR-0019](../adr/0019-domain-test-ui-boundary-and-view-contracts.md), [ADR-0020](../adr/0020-acme-test-plan-schema-and-compiler.md)

## Discovery context

ACME-0014 specified a Domain Test UI when ExecutionEngine, ScenarioRunner,
SQLite and the reference modules did not yet exist. Those engine prerequisites
were satisfied through ACME-0035 / ACME-0036, leaving two activation blockers:

1. accept or amend the **proposed gate freezes** in the design specification
2. implement a **local-only** workbench as a lens and launcher over existing
   ports, ScenarioRunner and conformance kits

Both blockers on the first slice are now cleared. ACME-0039 accepted all seven
gate freezes in ADR-0019 and delivered phases 0 and 1; ACME-0040 and ACME-0041
followed with phases 2 and 3.

A visual mock (non-authority) exists at:

`docs/concepts_sandbox/temp/testregistry_workbench_professional_test_engineering_suite.html`

Resolved backlog items that once competed for attention and are **removed**:

- encrypted-payload retention → ACME-0030 / ADR-0016
- strict structured-output schema subset → ACME-0029 / ADR-0015

## Proposed outcome

Ship a Domain Test UI application beside `@acme/cli` that:

- supports **module workbench** runs (scenario / execution inspection)
- supports **adapter workbench** runs (existing conformance kits only)
- treats composition (repository, gateway, retention, seed, policy) as
  first-class
- exposes versioned **view contracts** before chrome
- compiles optional `acme-test-plan/1` into `acme-scenario/1` and
  `ExecutionRequest` only (ADR at first export)
- never becomes a second source of truth or a CI replacement

## Activation sequence

Do **not** charter the remaining UI in one task. Follow the design-spec phases:

| Charter slice | Content | State |
| --- | --- | --- |
| **First** | Accept gate freezes; package skeleton + boundary rules; **Phase 1** read model + view contracts for S4–S7 | **Done — ACME-0039 / ADR-0019** |
| **Second** | Phase 2 catalog (modules, contracts, adapters, scenarios) | **Done — ACME-0040** |
| **Third** | Phase 3 `acme-test-plan/1` + compiler ADR + goldens | **Done — ACME-0041 / ADR-0020** |
| Fourth | Phase 4 offline authoring, launch, history | Open — next slice |
| Later | Phase 5 measurement + fixture review; Phase 6 gated live (optional) | Open |

**Why phase 1 was read model, not plan compiler:** CLI and ScenarioRunner
already run offline domain tests. The human gap is inspectable evidence. View
contracts made the Execution Inspector real and testable without a browser.

## What ACME-0039 delivered

- `apps/test-ui` (`@acme/test-ui`) as a leaf app, with a dependency-cruiser
  rule and negative fixture in each direction
- `acme-view-execution/1`, `acme-view-memory-decisions/1`,
  `acme-view-state/1`, `acme-view-replay/1`
- pure builders over recorded evidence; no I/O, clock, network or browser
- explicit `unavailable` sections, `not-retained` model payloads under `none`
  and `hash-only`, and redaction by default
- trust pipeline outcomes `passed | failed | reached | not-reached`, with
  `reached` where the recorded error cannot name the failing substage
- one deviation, recorded in ADR-0019: S7 keeps the engine's exact
  `match | different | unavailable` vocabulary and adds no `forked`

## What ACME-0040 delivered

- `acme-view-catalog/1` for S1: modules and contracts in registry order with
  task declaration order preserved, full fingerprints, contract-to-task
  cross-links, discovered scenarios, fixtures and declared adapter targets
- scenario validity decided by the injected `parseScenario`, so the catalog
  owns no competing schema; without a validator the section is `unavailable`
- broken things stay visible: invalid scenarios keep the validator's message,
  references that escape the root are refused, missing references and orphan
  fixtures are labelled, unknown conformance kits are marked
- bounded Node discovery on `@acme/test-ui/node-source`: no symlink following,
  deterministic ordering, depth and file bounds reported as diagnostics
- two absences recorded rather than faked: core registers no evaluators, and
  nothing registers adapter implementations

## What ACME-0041 delivered

- `acme-test-plan/1` exported under ADR-0020, which discharges the gate-3 ADR
  requirement
- a pure, total compiler to `acme-scenario/1`; identical plans produce
  byte-identical canonical JSON, pinned by a golden
- refusal before emission for unknown fields, a missing seed, a policy the
  engine rejects, duplicate case ids or request keys, a request hash that is
  not a lowercase SHA-256 digest, and any reference that escapes the root
- one policy validator, the engine's own `resolveExecutionPolicy`
- proof that the output is runnable: a compiled plan reaches the pinned
  Narrative Phase 5 operation digest through the existing CLI path
- two recorded deviations: no `measurements` block until S8 exists, and no
  model field because `acme-scenario/1` keeps the selection in the mock
  fixture

## Why the rest stays outside any non-UI active task

Cross-package application work: optional versioned plan contract, catalog
discovery, rendering, redaction UX and approval workflow. It needs its own
verification story and must not expand an unrelated frozen charter.

## Dependencies

**Satisfied:**

- ExecutionEngine, Narrative + Research, DomainModule conformance
- SQLite + memory repositories, gateway mock + OpenAI adapter
- ScenarioRunner, CLI composition (including live execute)
- encrypted-payload when encryptor supplied
- durable resume, rollback/CAS proofs, outbox boundary
- gate freezes accepted (ADR-0019), the phase-1 view contracts, the phase-2
  catalog and the phase-3 plan compiler (ADR-0020)

**Blocks the remaining phases (decisions, not missing code):**

- an explicit charter per phase; ADR-0019 authorized the build order, not the
  whole application

**Residuals that shape later phases only:**

- ScenarioRunner has no live step (S10 / CLI live until then)
- no auto outbox drain (UI must not imply silent delivery)
- `preparing-commit` trust substages report `reached`; finer resolution needs
  finer engine evidence, not interface inference

## Suggested verification

Phase 1 verification is delivered:

- every S4–S7 view contract asserted as JSON without rendering
- missing evidence renders unavailable, not zero
- redaction defaults under every retention mode
- prepared memory decision order preserved
- package imports no core internal; nothing imports the app
- no test performs a network call or reads wall-clock time for run identity

Phase 2 verification is delivered:

- registry and task declaration order preserved, with tested tie-breakers
- invalid scenarios reported with the validator's own error, never dropped
- references resolved, missing and refused kept distinct
- orphan fixtures and unknown kits visible
- discovery bounded, symlinks skipped, bounds reported not truncated
- the repository's own scenario tree discovered and rendered under test

Phase 3 verification is delivered:

- valid minimal and full plans compile; the compiled bytes are pinned
- every refusal class fails with a structured error naming the plan field
- the compiled document is accepted by the runner's own `parseScenario`
- a compiled plan reproduces the pinned Narrative Phase 5 digest

Later charters add launch paths, fixture-approval rules and live gating
proofs.

## Explicit non-goals for v1

- remote multi-user hosting
- replacing `pnpm test*` / CLI CI
- auto-approving golden fixtures
- inventing a second conformance suite inside the UI
- writing canonical ledger state from the browser
