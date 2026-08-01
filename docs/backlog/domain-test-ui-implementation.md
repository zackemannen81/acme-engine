# Domain Test UI implementation

Status: **Open — rewrite 2026-08-01 (ACME-0038)**
Discovered in: ACME-0014
Specification: [`docs/design/domain-test-ui-specification.md`](../design/domain-test-ui-specification.md)

## Discovery context

ACME-0014 specified a Domain Test UI when ExecutionEngine, ScenarioRunner,
SQLite and the reference modules did not yet exist. Those engine prerequisites
are now satisfied (through ACME-0035 / ACME-0036). What remains is not "build
the missing engine" but:

1. accept or amend the **proposed gate freezes** in the design specification
2. implement a **local-only** workbench as a lens and launcher over existing
   ports, ScenarioRunner and conformance kits

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

## Recommended activation sequence

Do **not** charter the full UI in one task. Follow the design-spec phases:

| Charter slice | Content |
| --- | --- |
| **First implementation charter** | Accept gate freezes; package skeleton + boundary rules; **Phase 1** read model + view contracts for S4–S7 over fixtures |
| Second | Phase 2 catalog (modules, contracts, adapters, scenarios) |
| Third | Phase 3 `acme-test-plan/1` + compiler ADR + goldens |
| Fourth | Phase 4 offline authoring, launch, history |
| Later | Phase 5 measurement + fixture review; Phase 6 gated live (optional) |

**Why phase 1 is read model, not plan compiler:** CLI and ScenarioRunner already
run offline domain tests. The human gap is inspectable evidence. View contracts
make the Execution Inspector real and testable without a browser.

## Why this stays outside any non-UI active task

Cross-package application work: new app package, optional versioned plan
contract, read models, rendering, redaction UX and approval workflow. It needs
its own verification story and must not expand an unrelated frozen charter.

## Dependencies

**Satisfied:**

- ExecutionEngine, Narrative + Research, DomainModule conformance
- SQLite + memory repositories, gateway mock + OpenAI adapter
- ScenarioRunner, CLI composition (including live execute)
- encrypted-payload when encryptor supplied
- durable resume, rollback/CAS proofs, outbox boundary

**Blocks activation (decisions, not missing code):**

- maintainer acceptance of the proposed gate freezes (design spec table)
- explicit implementation charter (docs-only ACME-0038 does not authorize code)

**Residuals that shape later phases only:**

- ScenarioRunner has no live step (S10 / CLI live until then)
- no auto outbox drain (UI must not imply silent delivery)

## Suggested verification

From the design specification verification plan, at minimum for first code
charter:

- every S4–S7 view contract asserted as JSON without rendering
- missing evidence renders unavailable, not zero
- redaction defaults under every retention mode
- prepared memory decision order and registry order preserved
- package imports no core internal; nothing imports the app
- no test performs a network call or reads wall-clock time for run identity

Later charters add plan goldens, launch paths, fixture-approval rules and live
gating proofs.

## Explicit non-goals for v1

- remote multi-user hosting
- replacing `pnpm test*` / CLI CI
- auto-approving golden fixtures
- inventing a second conformance suite inside the UI
- writing canonical ledger state from the browser
