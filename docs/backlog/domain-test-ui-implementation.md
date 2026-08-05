# Domain Test UI implementation

Status: **Partially resolved — phases 0–6 and S1–S9 browser flow delivered (ACME-0039 to ACME-0052); residual live surface and multi-step live remain optional**
Discovered in: ACME-0014
Specification: [`docs/design/domain-test-ui-specification.md`](../design/domain-test-ui-specification.md)
Decisions: [ADR-0019](../adr/0019-domain-test-ui-boundary-and-view-contracts.md), [ADR-0020](../adr/0020-acme-test-plan-schema-and-compiler.md), [ADR-0021](../adr/0021-interface-workspace-and-launch-boundary.md), [ADR-0022](../adr/0022-measurement-and-fixture-approval.md), [ADR-0023](../adr/0023-live-evaluation-gate.md), [ADR-0024](../adr/0024-local-spa-loopback-workbench.md)

## Discovery context

ACME-0014 specified a Domain Test UI when ExecutionEngine, ScenarioRunner,
SQLite and the reference modules did not yet exist. Those engine prerequisites
were satisfied through ACME-0035 / ACME-0036, leaving two activation blockers:

1. accept or amend the **proposed gate freezes** in the design specification
2. implement a **local-only** workbench as a lens and launcher over existing
   ports, ScenarioRunner and conformance kits

Both blockers on the first slice are now cleared. ACME-0039 accepted all seven
gate freezes in ADR-0019 and delivered phases 0 and 1; ACME-0040 through
ACME-0052 delivered phases 2–6 plus the first browser workbench slices.

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
| **Fourth** | Phase 4 offline authoring, launch, history | **Done — ACME-0042 / ADR-0021** |
| **Fifth** | Phase 5 measurement + fixture review | **Done — ACME-0043 / ADR-0022** |
| **Sixth** | Phase 6 gated live evaluation | **Done — ACME-0044 / ADR-0023** |
| **Seventh** | Local loopback workbench (S3/S4 HTML) | **Done — ACME-0045 / ADR-0024** |
| **Eighth** | Browser offline plan preview and launch (S2→S3→S4) | **Done — ACME-0046** |
| **Ninth** | Browser catalog renderer (S1) | **Done — ACME-0047** |
| **Tenth** | Browser memory-decision renderer (S5) | **Done — ACME-0048** |
| **Eleventh** | Browser state inspector (S6) | **Done — ACME-0049** |
| **Twelfth** | Browser replay inspector (S7) | **Done — ACME-0050** |
| **Thirteenth** | Browser measurement renderer (S8) | **Done — ACME-0051** |
| **Fourteenth** | Browser fixture-review renderer (S9) | **Done — ACME-0052** |
| Later | Remaining S10 renderer; live browser controls; multi-step live | Open — optional |

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
- two recorded deviations: no `measurements` block in the plan (S8 measures
  at measurement time instead), and no model field because `acme-scenario/1`
  keeps the selection in the mock fixture

## What ACME-0042 delivered

- `acme-view-plan/1` (S2), which previews the compiled scenario rather than
  the plan and reports an invalid plan instead of throwing
- `acme-view-runs/1` (S3): history available and ordered, live progress
  `unavailable` because launch is synchronous and no queue exists
- an interface-owned workspace of `runs/<runId>.json` files, sharing no table,
  file or directory with the ledger, with the index derived by reading them
- an app composition beside `@acme/cli` and a `launchPlan` that compiles, runs
  through the existing ScenarioRunner and records, writing no ledger state
- run identifiers validated as safe file names before any path is built
- the phase exit proven as one test: configure, launch, find, inspect

## What ACME-0043 delivered

- ADR-0022: measurement semantics and the fixture-approval boundary
- `acme-view-measurement/1` (S8): run / step / replay rates with sample sizes;
  empty sample `unavailable`; thresholds optional; baseline comparison only
  when a baseline is stored; deterministic and live partitions
- `acme-view-fixture-review/1` (S9): proposals, pending vs decided status,
  reviewable change description with `applied: false`
- `decideFixtureChange`: refuses empty approver, empty rationale, unsafe
  proposal id, path escape and identical digests
- workspace `baselines/` and `approvals/` beside `runs/`, same safe-name rule
- unit and integration coverage of refusals, unavailable cases and end-to-end
  measure-after-launch

## What ACME-0044 delivered

- ADR-0023: live evaluation gate (env opt-in + confirmation + budget)
- `acme-view-live-evaluation/1` (S10): live series only; cost when retained
- `acme-live-confirmation/1` with refusals for credentials, missing opt-in,
  empty confirmer/rationale and invalid budget
- `launchLiveExecution`: single ExecutionRequest via OpenAI Responses gateway;
  transport injectable for offline tests; credentials from environment only
- run records may carry optional `live` metadata (never secrets)
- S8 live partition receives non-mock gateway runs only

## What ACME-0045 delivered

- ADR-0024: pure HTML renderers + loopback-only workbench serve
- `src/web/`: shell, S3 runs renderer, S4 execution renderer, stubs, in-package CSS
- `startWorkbenchServer` / `workbench-main` on `@acme/test-ui/local`
- Unit tests for pure renderers; integration test for loopback HTTP
- Non-loopback hosts refused

## What ACME-0046 delivered

- pure `renderPlanViewHtml` over `acme-view-plan/1`
- bounded YAML/JSON preview with parser and validator failures rendered inert
- per-process CSRF token, same-server checks, a fixed request-body limit and
  process-configured scenario root
- safe and duplicate run-id refusal before the existing synchronous
  `launchPlan` boundary
- `303` to S3 after launch, S4 links for configured durable evidence, and an
  honest non-durable evidence page for memory runs
- unit, HTTP integration and loopback browser-flow verification using mock
  fixtures only

## What ACME-0047 delivered

- pure `renderCatalogViewHtml` over `acme-view-catalog/1`
- `/s1` HTML and `/api/catalog` JSON over one read-only composition helper
- the same static Narrative/Research registries used by execution, without a
  duplicate registry declaration
- `parseScenario` and bounded `discoverCatalogSources` under the existing
  process-configured scenario root; no browser path input
- full contract fingerprints and explicit invalid, missing, refused, orphan,
  diagnostic and unavailable states
- unit, HTTP integration and responsive loopback browser verification

## What ACME-0048 delivered

- pure `renderMemoryDecisionsViewHtml` over
  `acme-view-memory-decisions/1`
- `/s5?executionId=...` HTML and `/api/memory-decisions?executionId=...`
  JSON over the repository's existing durable replay evidence
- exact S4→S5 execution correlation, ordered decision cards, domain reasons,
  missing candidates and unattributed mutations kept explicit
- default-redacted candidate and mutation payloads with no browser disclosure
  control
- unit, HTTP integration and responsive loopback browser verification

## What ACME-0049 delivered

- pure `renderStateViewHtml` over `acme-view-state/1`
- `/s6?namespace=...&entityId=...` HTML and
  `/api/state?namespace=...&entityId=...` JSON over repository snapshot
  evidence
- exact S4→S6 scope correlation, ordered revisions, head count, hashes,
  schema/execution provenance and accepted transition identity
- explicit linked/broken/unknown continuity, missing transition, empty lineage
  and unavailable evidence states
- default-redacted state and delta payloads with no browser disclosure control
- unit, HTTP integration and responsive loopback browser verification

## What ACME-0050 delivered

- pure `renderReplayViewHtml` over `acme-view-replay/1`
- `/s7?executionId=...` HTML and `/api/replay?executionId=...` JSON over the
  existing `ExecutionEngine.replayVerify` and durable replay evidence
- exact S4→S7 execution correlation, engine-owned
  `match | different | unavailable` verdicts and builder-owned digest
  comparison
- fail-closed gateway composition, default-redacted diagnostic values and no
  replay-report or canonical write
- unit, HTTP integration and loopback browser verification against retained
  match and hash-only unavailable evidence

## What ACME-0051 delivered

- pure `renderMeasurementViewHtml` over `acme-view-measurement/1`
- `/s8` HTML and `/api/measurement` JSON over every readable workspace run
  record and an optional explicitly named stored baseline
- request-local finite `0..1` min/max thresholds for the three existing
  measures, with builder-owned outcomes and no persisted rule or score
- separate deterministic/live cards, observed/sample counts and explicit
  empty-sample and no-baseline states
- refusal for unsafe/missing baselines, invalid bounds and any unreadable run
  record that would silently shrink the evidence set
- unit, HTTP integration and loopback browser verification without writes or
  provider calls

## What ACME-0052 delivered

- pure `renderFixtureReviewViewHtml` over `acme-view-fixture-review/1`
- `/s9` HTML and `/api/fixture-review` JSON over stored decisions and one
  request-local proposal tied to a readable workspace run/execution
- CSRF- and same-server-protected `/s9/decision`, using
  `decideFixtureChange` and `Workspace.recordApproval` only
- mandatory named reviewer/rationale, explicit pending/approved/rejected and
  `applied: false` repository-edit instructions
- append-once refusal for existing, conflicting, unreadable or concurrent
  proposal ids; no proposal file and no fixture read/write
- unit, HTTP integration and loopback browser verification, including a
  byte-identical golden before/after a recorded decision

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
  catalog, the phase-3 plan compiler (ADR-0020), the phase-4 launch path
  (ADR-0021), phase-5 measurement / fixture review (ADR-0022) and phase-6
  gated live evaluation (ADR-0023), the first workbench shell (ADR-0024), and
  protected browser offline plan launch (ACME-0046), S1 catalog rendering
  (ACME-0047), S5 memory-decision rendering (ACME-0048), S6 state-lineage
  inspection (ACME-0049), S7 replay verification (ACME-0050), S8 measurement
  rendering (ACME-0051) and S9 fixture review (ACME-0052)

**Blocks remaining polish (decisions, not missing code):**

- an explicit charter per residual (S10 renderer, live browser controls,
  multi-step live scenarios)

**Residuals that shape later work only:**

- ScenarioRunner has no multi-step live step (S10 is single-execute)
- no auto outbox drain (UI must not imply silent delivery)
- `preparing-commit` trust substages report `reached`; finer resolution needs
  finer engine evidence, not interface inference
- workbench is bounded: S1–S9 HTML; S10 remains a stub

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

Later charters may deepen remaining HTML surfaces, add explicitly gated live
browser controls or add multi-step live scenarios.

## Explicit non-goals for v1

- remote multi-user hosting
- replacing `pnpm test*` / CLI CI
- auto-approving golden fixtures
- inventing a second conformance suite inside the UI
- writing canonical ledger state from the browser
