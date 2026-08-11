# Current Status

Last updated: 2026-08-11

## Repository

- Git repository initialized on `main`.
- Remote: `https://github.com/zackemannen81/acme-engine.git`.
- Docs-first foundation is present.
- A pnpm workspace and lockfile now provide the implementation substrate.
- Node `24.18.0` and pnpm `10.34.5` are pinned; all root development
  dependencies use exact versions.
- Strict ESM TypeScript, ESLint, Prettier, Vitest and dependency-cruiser are
  configured.
- `@acme/core` uses exact Zod `4.4.3` for public runtime schemas.
- Secret-free GitHub Actions CI mirrors documentation, formatting, lint,
  typecheck, boundary, test and build commands.
- Frozen task charters, parent/child tasks, paused tasks and backlog proposals
  are governed by `docs/TASK_WORKFLOW.md`.
- LF line endings are enforced through `.gitattributes`.

## Project Phase

The complete design and development specification is approved as the
implementation baseline:

- `docs/design/acme-design-and-development-spec.md`
- ADR-0001: TypeScript and pnpm workspace
- ADR-0002: Static task-typed module composition
- ADR-0003: SQLite revisioned Unit of Work
- ADR-0004: Deterministic transition identity
- ADR-0005: Pure memory decision application
- ADR-0006: Aggregate in-memory Unit of Work
- ADR-0007: Deterministic model mock and gateway conformance
- ADR-0008: Post-memory domain state projection
- ADR-0009: Reference-domain identity and provenance
- ADR-0010: Input-bound validation and interpretation
- ADR-0011: Narrative knowledge and context ownership
- ADR-0012: Milestone 1 execution identity and replay
- ADR-0013: Durable SQLite schema and driver
- ADR-0014: Live provider boundary and transport port
- ADR-0015: Strict structured-output schema lowering
- ADR-0016: Encrypted payload retention
- ADR-0017: Durable execution resume
- ADR-0018: Outbox delivery boundary
- ADR-0019: Domain Test UI boundary and versioned view contracts
- ADR-0020: `acme-test-plan/1` schema and compiler
- ADR-0021: Interface workspace storage and launch boundary
- ADR-0022: Measurement semantics and fixture-approval boundary
- ADR-0023: Live evaluation gate for the Domain Test UI
- ADR-0024: Local SPA shell and loopback workbench serve
- ADR-0025: Post-execution quality evaluation
- ADR-0026: Durable quality evaluation store
- ADR-0027: Async launch job progress and cancellation
- ADR-0028: First POC is the Evidence Integrity Workbench
- ADR-0029: POC #1 persistence platform is self-hosted Supabase
- ADR-0030: Evidence V1 identity and canonical placement
- ADR-0031: Evidence reviewer overlay and versioned views
- ADR-0032: Evidence V1 correction-occurrence pairing

Milestones 1 and 2 are delivered. All five Milestone 2 acceptance conditions
are proven: the shared conformance suite passes unchanged for SQLite, a
post-call crash resumes with zero gateway calls (ACME-0033), close and reopen
preserve the replay digest, an interrupted transaction leaves no partial state,
two writers against one revision yield exactly one commit (ACME-0034), and the
outbox work package landed with ACME-0035.

ACME has a build substrate, pure contract layer, pure StateEngine, pure
MemoryEngine, post-memory state projection, a deterministic in-memory Unit of
Work, a bounded single-task ExecutionEngine and a durable SQLite adapter.
There is currently:

- common JSON, identity, time, document and diagnostic contracts
- deterministic `acme-cjson-1` canonical JSON and SHA-256 hashing
- versioned `acme-model-request-hash-1` over the complete validated
  provider-neutral model request
- versioned deterministic execution ID, operation key, request fingerprint
  and model-response hash algorithms
- the structured ACME error taxonomy
- provider-neutral model, prompt-contract and gateway port types
- closed gateway-boundary validation for selections, requests, capabilities,
  required-capability matching, call contexts and normalized responses
- a strict response pipeline for empty/parse/schema/semantic validation
- input-bound response semantics with non-repairable input validation and
  detached deeply frozen contract input/output
- immutable contract and module registries with deterministic ordering and
  contract fingerprints
- task-typed module authoring plus state/memory envelope and policy types
- typed task-owned post-memory state projection with exact
  candidate/decision correlation, applied-decision filtering and immutable
  replay-stable projection input
- frozen reference-domain v1 identity/evidence contracts: canonical-state
  Narrative alias authority and correction checks plus explicit Research
  proposition, source, independence and retained-evidence keys
- a pure StateEngine that validates current state and typed deltas, enforces
  expected revisions, invokes module initialization/reduction/invariants and
  prepares immutable snapshot/transition candidates without persistence
- versioned deterministic transition identity `acme-transition-id-1`, derived
  from execution/operation/module/entity identity without consuming
  `IdGenerator`
- a pure MemoryEngine that validates candidates and loaded records, executes
  domain-owned resolution against a deterministic evolving working set and
  prepares immutable create/update mutations with expected record versions
- deterministic memory retrieval with validated policy results, stable
  score/identity/ID ordering and enforced limits
- explicit lifecycle preparation for retain, strength-update and forget
  decisions without background wall-clock behavior
- one aggregate `ExecutionRepository` contract with execution, attempt,
  model-call, context, prepared commit and terminal evidence types
- portable replay evidence containing the exact validated task input,
  immutable recorded read set and prepared commit
- versioned `acme-operation-digest-1` with canonical ordering rules
- a deterministic `@acme/adapter-memory` that implements request idempotency,
  ledger/model-call evidence, state/memory/document reads and immutable
  copy-on-commit transactions
- atomic promotion of candidate/evaluator evidence, documents, memory
  mutations, optional state, events/outbox and terminal execution results
- state-head and memory-record compare-and-swap with explicit conflict codes
- identical commit replay without new writes or IDs, with divergent identity
  reuse rejected as persistence corruption
- a reusable non-empty repository conformance suite in `@acme/testing` that the
  in-memory and SQLite adapters both pass unchanged
- a durable `@acme/adapter-sqlite` in WAL mode with enforced foreign keys,
  ordered checksum-verified migrations that refuse a tampered or unknown
  recorded version, and the ADR-0003 `BEGIN IMMEDIATE` Unit of Work
- durable crash recovery proven by reopening a committed database in a new
  connection with identical replay evidence, identical operation digest, no
  new model call and no new ID allocation
- durable and in-memory repository evidence proven equal for the same neutral
  execution
- observed rollback: a fault inside `commit()` leaves no documents, memory,
  state, events, outbox entries, commit record or terminal result on either
  adapter, and the repository stays usable with the retried commit reaching
  the recorded operation digest
- observed compare-and-swap: two writers on one SQLite file that read the same
  revision produce exactly one commit; the loser fails its commit with
  `CONFLICT_STATE_REVISION` and writes nothing
- an outbox delivery boundary (ADR-0018): `leaseOutbox`,
  `markOutboxDelivered`, `markOutboxFailed` and `listOutbox` on both adapters,
  a domain-neutral `drainOutbox` coordinator over an injected
  `OutboxDispatcher`, and `acme outbox inspect` / `acme outbox drain` in the
  composition root
- at-least-once delivery with a lease visibility timeout, caller-owned retry
  policy, terminal `failed` entries and a versioned
  `acme-outbox-drain-report/1`; nothing drains on its own. The API says lease
  because `claim` is Research vocabulary the core guard forbids; the persisted
  status value stays `claimed`
- a deterministic `@acme/adapter-model-mock` with immutable exact-selection
  profiles, finite exact-call scripts and no provider, network, environment,
  filesystem, clock or random dependency
- exact `(executionId, callKey)`, selection and request-hash matching with
  single consumption, scripted response/error outcomes and immutable
  invocation/unconsumed-call evidence
- a reusable non-empty provider-neutral `ModelGateway` conformance suite in
  `@acme/testing` that the scripted mock and the OpenAI adapter both pass
  unchanged
- an `@acme/adapter-model-openai` targeting the OpenAI Responses API behind an
  injected transport port, with request mapping, response normalization,
  deterministic strict structured-output schema lowering (ADR-0015) and the
  ADR-0014 failure classification
- the first producer of the `ambiguous` model-call status: any transport
  outcome without a status line is ambiguous unless the transport can prove
  the request never left
- a `fetch` transport on a separate entry point, whose delivery
  classification is proven offline against an injected `fetch`. It reports
  `unknown` for every post-dispatch failure, because `fetch` cannot prove
  non-delivery, and claims `not-sent` only for cancellation before dispatch
- an opt-in `pnpm test:live` gate that is structurally excluded from
  `vitest.config.ts`, so no default run and no CI step can reach it, and that
  refuses rather than skips when the opt-in or credential is absent
- live success path confirmed: research and narrative reference contracts both
  reached HTTP `200` and committed under the lowered schema; nested `anyOf`
  is accepted; `OpenAiResponseSchema` matched a real completed body
- real-provider confirmation of the ADR-0014 failure classification and of the
  provider error-body schema (ACME-0028 rejections) plus success-path fixtures
  tolerance (ACME-0029)
- a core `PayloadEncryptor` port and AES-256-GCM reference helper
  (ADR-0016 / ACME-0030); both repository adapters seal `encrypted-payload`
  at rest and decrypt on `loadReplayEvidence` when the key is available
- a reusable non-empty public-core-only `DomainModule` conformance suite in
  `@acme/testing`, proven unchanged against testing-owned producer and empty
  analyzer fixtures
- `@acme/module-research` with strict v1 schemas, deterministic
  `research.observe-evidence@1.0.0`, ADR-0009 proposition/source/independence
  identity, corroboration and contradiction policy, a pure reducer with
  invariants and post-memory verification derived only from applied decisions
- Research-owned execution of the unchanged shared DomainModule conformance
  suite, proving core stays domain-neutral across two reference domains
- `@acme/module-narrative` with strict v1 schemas, deterministic
  `narrative.observe-document@1.0.0`, pure state/reducer/invariants and a
  domain-owned memory policy
- `@acme/module-evidence` slices 0–3 foundation, observation and relation path
  with strict source, locator, embedded actor/time, observation, proposition,
  event, relation, question, assessment, state, delta, observe-contract and
  relate-contract schemas; named ADR-0030 content-derived identities;
  source-binding validation; compact pure state; reducer/invariants; domain
  memory policy; deterministic `evidence.observe-artifact@1.0.0` and
  `evidence.relate-observations@1.0.0`; ADR-0032 correction-occurrence pairing;
  and contest projection for scoped `contradicts` relations
- `@acme/evidence-testing` with the exact seven-artifact/eight-version
  `rillford-annex-review-1` synthetic corpus, manifest, scratch/development
  truth, sealed evaluation truth, deterministic golden outputs, identity
  vectors, fixed evaluation observe candidates and evaluation relate
  candidates. Sealed truth is available only from `./evaluation`; candidate
  fixtures import no truth, and both a prompt dependency guard and a negative
  dependency-boundary fixture enforce that separation
- pure primary work-queue, source-review, observation-ledger,
  account-comparison and relation-review views, plus a loopback Evidence
  Workbench API/web/worker composition with development and evaluation seed
  modes. The evaluation seed contains ten immutable observations (five current,
  three contested, two superseded after relate), eight relations and three open
  questions
- ADR-0011-compliant `narrative-window-1` and source-backed
  `previous-document-tail-1`, including golden request, entity and context
  fixtures
- Narrative-owned execution of the unchanged shared DomainModule conformance
  suite plus compile-time task inference checks
- a domain-neutral `ExecutionEngine` that resolves static registrations,
  accepts one request idempotently, performs one primary call, coordinates
  response validation, memory, post-memory state projection and state
  preparation, and commits atomically
- deterministic memory retrieval capped at 50 records and a replay verifier
  that uses only recorded evidence and reports `match`, `different` or
  `unavailable`
- durable execution resume (ADR-0017): re-submitting the request of an
  accepted but non-terminal execution completes it from the recorded model
  call with no provider call, no reservation and no model-call ID, reaching
  the same operation digest as an uninterrupted run on both repository
  adapters and across a real SQLite close/reopen
- resume refusals that never call the provider: unretained or unreadable
  responses are terminal `RESUME_EVIDENCE_UNAVAILABLE`, unobserved
  reservations are terminal `MODEL_UNAVAILABLE`, and recorded `failed` or
  `ambiguous` calls re-raise their recorded error; a crash before any
  reservation runs from the beginning
- a non-empty neutral integration suite plus the fixed Narrative and Research
  Phase 5 offline scenarios, including repeat-without-effects and
  replay-without-clock, gateway or ID allocation
- a ScenarioRunner in `@acme/testing` that validates an `acme-scenario/1`
  document, resolves aliases, executes `execute`, `assert`, `replay` and
  `assertDigest` steps serially and emits a versioned
  `acme-scenario-report/1`, with no branching, retry, loop or arbitrary code
- proof that the runner drives the real engine: the Narrative Phase 5
  acceptance scenario expressed as a scenario file reaches the same operation
  digest as the hand-written test, and both remain in the suite
- an `@acme/cli` composition root that selects the in-memory or durable
  SQLite repository and exposes `scenario run`, `execute`, `execution replay`,
  `execution inspect`, `execution stranded`, `execution discharge`,
  `state inspect`, `memory inspect`, `outbox inspect|drain|redrive` and
  `quality list|inspect|judge`, with versioned JSON on stdout, diagnostics on
  stderr, payload redaction by default and exit codes separating success, a
  non-committed outcome and a usage error
- an `@acme/test-ui` Domain Test UI package (ADR-0019) holding eleven versioned
  view contracts (`acme-view-execution/1`, `acme-view-memory-decisions/1`,
  `acme-view-state/1`, `acme-view-replay/1`, `acme-view-catalog/1`,
  `acme-view-plan/1`, `acme-view-runs/1`, `acme-view-measurement/1`,
  `acme-view-fixture-review/1`, `acme-view-live-evaluation/1` and
  `acme-view-quality-evaluation/1`) and pure builders over recorded evidence,
  with no clock, network or browser, and no I/O on the default entry point
- a catalog (S1) over the static registries plus discovered scenarios and
  fixtures, preserving registry and task declaration order, rendering full
  contract fingerprints, cross-linking contracts to tasks, and marking broken
  things rather than hiding them: invalid scenarios keep the runner
  validator's own message, references that escape the configured root are
  refused, missing references and orphan fixtures are labelled, and an
  unrecognized conformance kit is `unknown`
- a catalog that owns no schema and invents no registry: scenario validity
  comes from the injected `parseScenario`, and the evaluator section is
  `unavailable` because core enumerates no evaluators
- bounded Node discovery on the separate `@acme/test-ui/node-source` entry
  point: no symlink following, deterministic ordering, and depth and file
  bounds reported as diagnostics instead of silent truncation
- `acme-test-plan/1` and a pure compiler (ADR-0020): a case expands into
  `acme-scenario/1` steps, identical plans compile to byte-identical canonical
  JSON pinned by a golden, and the compiler touches no filesystem, network or
  clock. Policies are validated by the engine's own `resolveExecutionPolicy`,
  so the interface owns no second policy schema
- proof that a compiled plan is a runnable artifact: a plan equivalent to the
  Narrative Phase 5 scenario runs through the existing CLI path and reaches
  the same operation digest the hand-written acceptance test pins
- a plan designer (S2) that previews the compiled scenario and reports an
  invalid plan instead of throwing, and a run console (S3) whose history is
  available and whose live-progress half is `available` when the host supplies
  job evidence (ADR-0027) and `unavailable` for pure history-only callers
- an interface-owned file workspace (`runs/<runId>.json`, `jobs/<jobId>.json`,
  `baselines/<name>.json`, `approvals/<proposalId>.json`) that shares no
  table, file or directory with the ledger, with the history index derived by
  reading the records and run identifiers validated as safe file names
- an app composition beside `@acme/cli` selecting the in-memory or SQLite
  repository, and a `launchPlan` that compiles, runs through the existing
  ScenarioRunner and records the outcome, writing nothing to the ledger
- a proven end-to-end loop: configure, launch, find in history and inspect the
  recorded execution through the S4 read model, offline and without the CLI
- explicit absence in every view: an unread section is `unavailable` with a
  reason code rather than an empty array; content is redacted unless a build
  reveals it; a model payload absent under `none` or `hash-only` retention
  reports `not-retained` instead of looking empty by defect
- trust pipeline outcomes derived only from recorded evidence, reporting
  `reached` instead of guessing when the failing execution stage owns several
  substages, and replay rendered in the engine's exact
  `match | different | unavailable` vocabulary
- a durable SQLite quality-evaluation store (ADR-0026): migration v2 adds an
  append-only `quality_evaluations` table with no foreign key to executions, so
  evaluation lifecycle stays independent of the ledger, and
  `createSqliteQualityEvaluationStore` passes the same conformance kit as the
  in-memory store
- `acme quality list`, `acme quality inspect` and `acme quality judge` over the
  composition-selected quality store, plus a live-model judge
  (`runLiveModelQualityJudge`, `kind: live-model`) that runs outside the
  synchronous evaluator harness and is proven offline with an injected
  OpenAI transport
- a pure `acme-view-quality-evaluation/1` list/detail view (S11) in
  `apps/test-ui`, with no HTML surface and no I/O on the default entry point
- async plan launch (ADR-0027): an in-process single-flight JobRunner,
  interface-owned `jobs/<jobId>.json` (`acme-job-record/1`), `enqueuePlan`
  beside the unchanged synchronous `launchPlan`, S3 live progress when job
  evidence is supplied, cooperative cancel through an `AbortSignal` and
  non-terminal jobs marked `interrupted` after a process restart. Cancel never
  rolls back a committed ledger write
- automated dependency rules, a core vocabulary guard and negative core,
  module, cross-module, evaluation-adapter, SQLite-driver and Domain-Test-UI
  boundary fixtures (both "the app imports no package internal" and "nothing
  imports the app")
- 644 passing unit-suite tests across packages (93 files) exercised by
  `pnpm test:unit`, with separate conformance (69 tests, 11 files), integration
  (57 tests, 11 files) and scenario (26 tests, 7 files) gates. Counts observed
  2026-08-11
- compile-time task-name/input/output, state-projection and conformance-subject
  inference checks
- non-empty passing repository, gateway and module conformance, integration
  and scenario gates
- no published package
- no deployment

## Approved Direction

`docs/PROJECT_BRIEF.md` is the active project direction. Core must be
domain-neutral and proven with NarrativeModule and ResearchModule. ADR-0028
accepts the Evidence Integrity Workbench as the first real product POC. Its
normative boundary is
[`evidence-integrity-workbench-product-definition.md`](design/evidence-integrity-workbench-product-definition.md).
ADR-0029 selects self-hosted Supabase as POC #1's persistence platform and
requires the ACME repository adapter to target plain PostgreSQL over the wire
protocol rather than any Supabase-specific API. ADR-0030 fixes Evidence V1
identity, correction semantics and document/memory/state placement; ADR-0031
fixes the append-only review overlay, versioned primary/technical views and
Primary Product Rule; ADR-0032 fixes the conservative correction-occurrence
pairing used by state projection and account comparison. The normative
technical plan is
[`evidence-integrity-workbench-technical-specification.md`](design/evidence-integrity-workbench-technical-specification.md).
The direction, platform and implementation plan are accepted. Slices 0–5
exist for domain and product foundations: observe/relate/timeline/assessment
tasks, attention/export helpers, primary views through open questions, and
product assessment storage. Technical-audit UI, PostgreSQL adapter, hosted
shell, deployment and non-synthetic paths remain unimplemented.

## Active Work

No implementation task is active. ACME-0066–0068 closed WP-Q Q2–Q4 (CLI
quality surfaces, pure S11 view, live-model judge) and ACME-0069 closed WP-T
T1 / G08 (async launch, progress and cancellation under ADR-0027); both
landed on `grok/gapfixes2` and are merged to `main`. ACME-0070 then
resynchronized the governing documents with that reality. ACME-0071 produced
an English, repository-derived OpenAI/FDE project deck and matching PDF under
`hrd/`, and ACME-0072 added a Markdown counterpart. ACME-0073 then produced a
decision-ready discovery report for the first real POC application and the
supporting source memo
[`first-poc-application-discovery.md`](design/first-poc-application-discovery.md).
It provisionally recommended an evidence-to-decision Research workbench and a
TypeScript/PostgreSQL product baseline. ACME-0074 then accepted the **Evidence
Integrity Workbench** as POC #1 under ADR-0028, locked its synthetic-corpus,
source-bound, immutable-evidence and human-review boundaries, and retained
Research Synthesis as the intended POC #2. The product selection and boundary
are now authoritative, and ADR-0029 has since decided the POC #1 persistence
platform. ACME-0076 then delivered the normative technical specification and
ADRs 0030–0031: exactly seven logical synthetic artifacts in eight versions,
the first Evidence task and identity family, primary versus technical views,
append-only review decisions, deterministic assessment export, frozen proof
gates and separately activatable slices 0–9. ACME-0077 then delivered slice 0:
the exact synthetic corpus and truth, public Evidence contracts and identities,
compact state/reducer/invariants, memory/module scaffold, deterministic golden
builder and sealed-truth dependency guard. ACME-0078 then delivered slice 1:
the executable source-observation task, deterministic `DEV-T01` mock, separate
file-backed product repository and append-only review overlay, pure work-queue
and source-review views, and a loopback API/web/worker path with technical
audit disabled. ACME-0079 then delivered slice 2: five deterministic evaluation
executions yield the exact ten sealed observations, conservative correction
pairing marks only the two `EVAL-T01` v1 predecessors superseded, and primary
ledger/account-comparison views keep the later changed account and every source
version navigable. ACME-0080 then delivered slice 3: `evidence.relate-
observations@1.0.0`, eight golden L3 relations, three open questions, contest
projection for scoped contradictions, primary relation review and evaluation
seed. ACME-0081 then delivered slice 4: pure timeline ordering, temporal
overlap helper, and primary timeline/open-question views. The recommended next
product task is slice 6, secondary technical audit.
Independent alternatives remain E1
trust-stage evidence (G12) or the WP-T residuals (T2 plan `measurements`, T3
adapter declaration policy, optional T4 browser CI smoke).

### Recent completed work (summary)

- **ACME-0082:** Delivered Evidence Integrity slice 5 domain core:
  `evidence.propose-assessment@1.0.0`, attention-tier and change-set helpers,
  deterministic synthetic-only assessment export, product assessment storage
  and sealed E-A01/E-A02 fixtures. Full late-import UI black-box remains
  light; technical audit still disabled.

- **ACME-0081:** Delivered Evidence Integrity slice 4: pure
  `evidence.build-timeline@1.0.0` / temporal-overlap helper, primary timeline
  and open-question views, API/web navigation. No assessment or live path.

- **ACME-0080:** Delivered Evidence Integrity slice 3: model-backed
  `evidence.relate-observations@1.0.0`, sealed eight-relation and three open-
  question golden gate, contest standings for changed accounts, product
  relation/open-question storage, primary relation-review view and evaluation
  seed with technical audit still disabled. No timeline, assessment or live
  provider path was added.

- **ACME-0079:** Delivered Evidence Integrity slice 2: an offline sealed
  evaluation harness, exact correction supersession with eight current and two
  superseded immutable observations, primary observation-ledger and
  account-comparison views, and a browser-visible evaluation seed. No general
  relation analysis, live provider or non-synthetic path was added.

- **ACME-0078:** Delivered Evidence Integrity slice 1: one offline source-first
  reviewer path over `DEV-T01`, exact source/actor/time validation, stable
  observations, durable product review decisions, pure primary views and
  replay/resume proof with one deterministic mock call. No live provider or
  later Evidence slice was added.

- **ACME-0077:** Delivered Evidence Integrity slice 0: deterministic corpus,
  contract/identity/state foundation, test-support package, sealed-truth guard
  and offline golden/conformance proof. No model-backed task or product UI was
  added.

- **ACME-0017–0023:** Narrative and Research reference modules, offline Phase 5
  scenarios, ExecutionEngine (ADR-0012), SQLite durability (ADR-0013).
- **ACME-0025–0027:** OpenAI Responses adapter behind a transport port, CLI
  composition root (mock gateway only), ScenarioRunner over `acme-scenario/1`.
- **ACME-0028–0029:** `fetch` transport, opt-in live gate, schema lowering
  (ADR-0015), live success for both reference contracts under strict structured
  output.
- **ACME-0030:** Encrypted-payload retention (ADR-0016) with injected
  `PayloadEncryptor`, ciphertext at rest, decrypt-on-replay when the key works.
- **ACME-0031–0032:** Documentation reality sync after the live work, then the
  CLI live OpenAI gateway (`acme execute --gateway openai`).
- **ACME-0033:** Durable execution resume (ADR-0017): an interrupted execution
  completes from its recorded model call without a second provider call, with
  classified terminal refusals where the evidence is insufficient.
- **ACME-0034:** Milestone 2 durability and concurrency proofs: a fault inside
  `commit()` leaves no partial state on either adapter, a driver-level fault
  rolls back across a real reopen, and two writers against one revision yield
  exactly one commit.
- **ACME-0035:** Outbox delivery boundary (ADR-0018): claim, deliver and
  settle through an explicit bounded drain, with at-least-once semantics and
  an `acme outbox` command.
- **ACME-0039:** Domain Test UI activation (ADR-0019): gate freezes accepted,
  `apps/test-ui` boundary enforced in both directions, and phase-1 view
  contracts for S4–S7 proven over handcrafted fixtures and over evidence a
  real offline engine run recorded.
- **ACME-0040:** Domain Test UI phase 2: the `acme-view-catalog/1` surface over
  registries, discovered scenarios and fixtures and declared adapter kit
  targets, with bounded traversal-refusing Node discovery on a separate entry
  point and the repository's own scenario tree discovered under test.
- **ACME-0041:** Domain Test UI phase 3 (ADR-0020): `acme-test-plan/1`, a
  strict validator that refuses before emitting, and a pure deterministic
  compiler whose output reaches the pinned Narrative Phase 5 digest through
  the existing runner.
- **ACME-0042:** Domain Test UI phase 4 (ADR-0021): the S2 designer, the S3
  console and history, an interface-owned workspace whose index is derived
  from its records, an app composition and a synchronous `launchPlan`, proven
  by an end-to-end configure-launch-find-inspect test.
- **ACME-0043–0045:** measurement and fixture review (ADR-0022), gated live
  single-execute evaluation (ADR-0023), and the loopback S3/S4 HTML workbench
  (ADR-0024).
- **ACME-0046:** protected browser-side offline plan preview and launch: S2
  renders the compiled canonical scenario, launch reuses `launchPlan`, and the
  recorded result links through S3 to durable S4 evidence when configured.
- **ACME-0047:** S1 browser catalog over the existing static registries,
  runner validator and bounded scenario/fixture discovery, with full contract
  fingerprints, broken references and unavailable sections kept visible.
- **ACME-0048:** S5 browser memory-decision inspector over durable replay
  evidence, linked from S4 with ordered candidate → decision → mutation cards,
  explicit absence/correlation states and payloads redacted by default.
- **ACME-0049:** S6 browser state inspector over repository snapshot evidence,
  linked from S4 with ordered revision lineage, explicit continuity and
  transition absence, and state/delta payloads redacted by default.
- **ACME-0050:** S7 browser replay inspector over the existing replay engine,
  linked from S4 with exact engine verdicts, digest comparison and redacted
  diagnostic differences; replay is guarded against provider calls and makes
  no canonical write.
- **ACME-0051:** S8 browser measurement over workspace run records, with
  separate deterministic/live rate cards, request-local thresholds, explicit
  stored-baseline selection and refusal when unreadable records would silently
  shrink the evidence set.
- **ACME-0052:** S9 browser fixture review with request-local proposals tied to
  recorded run/execution provenance, CSRF-protected named decisions,
  append-once approval history and an explicit never-applied repository-edit
  instruction.
- **ACME-0053:** S10 browser live evaluation with live-only history, explicit
  process and per-run confirmation gates, protected single-execute launch and
  no credential field or value in browser/workspace artifacts.
- **ACME-0054:** `@acme/evaluation`, deterministic and recorded-external
  evaluators, immutable content-derived identities, append-only in-memory
  storage and ScenarioRunner v2 quality evaluation/assertion steps (ADR-0025).
- **ACME-0055:** Governing-document reality audit plus a repository-derived
  Swedish presentation, whitepaper and technical system document under
  `hrd/`. These are editable explanatory artifacts; Markdown sources and ADRs
  remain authoritative.
- **ACME-0056:** Gap-resolution plan (`docs/design/gap-resolution-plan.md`)
  with G01–G19 and work packages WP-D through WP-X.
- **ACME-0057:** SQLite driver-error classification (G05 / D1): busy/locked →
  `PERSISTENCE_TRANSIENT`; corruption/constraint → `PERSISTENCE_CORRUPTION`;
  unknown → `INTERNAL` AcmeError.
- **ACME-0058:** Stranded execution list/discharge (G06 / D2): pure core
  classifier and CLI operator commands over ledger evidence.
- **ACME-0059:** Outbox redrive for terminal `failed` entries (G04 / O1):
  repository port, both adapters, `redriveOutbox` coordinator and CLI.
- **ACME-0060:** Outbox inspect growth summary and `--max-pending` /
  `--max-failed` alarms (G03 / O4).
- **ACME-0061:** File `OutboxDispatcher` transport for CLI drain
  (`acme-outbox-file-delivery/1`, `--transport file --outbox-dir`).
- **ACME-0062:** Narrative observe-document emits
  `narrative.document-observed` (updates Phase 5 operation digest pin).
- **ACME-0063:** Plan/scenario model pin (`execute.model`, plan `model`).
- **ACME-0064:** ScenarioRunner live multi-step (`gateway: openai`,
  offline injected transport + opt-in live gate).
- **ACME-0065:** Durable SQLite quality evaluation store (Q1, ADR-0026).
- **ACME-0066:** CLI quality list/inspect over composition quality store (Q2).
- **ACME-0067:** Pure Test UI quality evaluation list/detail view S11 (Q3).
- **ACME-0068:** Live-model quality judge + `quality judge` CLI (Q4).
- **ACME-0069:** Async launch, progress and cancellation (T1 / G08, ADR-0027):
  in-process JobRunner, `acme-job-record/1`, `enqueuePlan` beside synchronous
  `launchPlan`, S3 progress, `POST /s3/<runId>/cancel`.
- **ACME-0070:** Documentation reality sync after ACME-0057–0069.
- **ACME-0071:** English OpenAI/FDE project presentation and matching PDF,
  derived from the governing Markdown documents and accepted ADRs, with
  repository-backed slide notes and complete visual verification.
- **ACME-0072:** Markdown counterpart to the OpenAI/FDE presentation, retaining
  its narrative, evidence, maturity caveats, diagrams and repository source
  map in a plain-text format.
- **ACME-0073:** First-POC product and technology discovery report. It compares
  three candidate wedges, recommends an evidence-to-decision workbench as the
  leading hypothesis, separates SQLite's current adapter compatibility from
  PostgreSQL's hosted-product fit, and defines communication, ownership,
  scaling, metrics and decision gates without activating implementation.
- **ACME-0074:** Accepted Evidence Integrity Workbench as POC #1 in ADR-0028
  and a normative product definition. V1 uses a synthetic corpus, distinguishes
  source observations from propositions and legal conclusions, preserves
  changed accounts, requires source locators and human review, prohibits
  credibility/guilt/legal-sufficiency decisions, and keeps Research Synthesis
  as the intended POC #2. No code or real-data authorization was added.
- **ACME-0076:** Delivered the Evidence Integrity Workbench technical
  specification plus ADR-0030 and ADR-0031. It freezes the bounded synthetic
  corpus contract, Evidence identity and placement, product/reviewer view
  boundary, proof matrix and local-first implementation slices without adding
  code, provider calls or real-data authority.

### Domain Test UI (phases 0–6 and S1–S10 browser flow delivered)

[`Domain Test UI — Specification`](design/domain-test-ui-specification.md) is
activated. ACME-0039 accepted the seven proposed gate freezes in
[ADR-0019](adr/0019-domain-test-ui-boundary-and-view-contracts.md) and
delivered phase 0 (package boundary) and phase 1 (read model over recorded
evidence). One deviation is recorded rather than hidden: S7 uses the engine's
exact `match | different | unavailable` vocabulary and adds no `forked`
outcome, because the engine cannot produce one.

Delivered by ACME-0039: `apps/test-ui`, four versioned view contracts for
S4–S7, pure builders, redaction and retention presentation rules, and boundary
fixtures in both directions.

Delivered by ACME-0040 (phase 2): `acme-view-catalog/1` for S1 over the static
registries, discovered scenarios and fixtures, and caller-declared adapter kit
targets, plus bounded Node discovery on a separate entry point.

Delivered by ACME-0041 (phase 3): `acme-test-plan/1` and `compileTestPlan`
under ADR-0020, which discharges the gate-3 ADR requirement.

Delivered by ACME-0042 (phase 4, ADR-0021): the S2 designer, the S3 console
and history, an interface-owned file workspace, an app composition and
`launchPlan`. A plan can now be previewed, launched and inspected offline
without the CLI.

Delivered by ACME-0043 (phase 5, ADR-0022): `acme-view-measurement/1` (S8)
over recorded run records with sample sizes, optional thresholds and optional
baselines, and `acme-view-fixture-review/1` (S9) with mandatory approver and
rationale, producing a described reviewable change rather than a fixture
write. Workspace stores `baselines/` and `approvals/` beside `runs/`.
Deterministic and live series are partitioned.

Delivered by ACME-0044 (phase 6, ADR-0023): `acme-view-live-evaluation/1`
(S10), pure `acme-live-confirmation/1` gate, and `launchLiveExecution` on the
local entry point. Live requires `ACME_TEST_UI_LIVE` plus confirmation
(confirmer, rationale, budget); credentials stay in the environment. Single
ExecutionRequest path (not multi-step ScenarioRunner). Offline transport tests
prove the path without network.

Delivered by ACME-0045 (ADR-0024): localhost workbench shell with pure HTML
renderers for S3 and S4, stub navigation for other surfaces, loopback-only
HTTP serve (`startWorkbenchServer` / `workbench-main`). Not full SPA polish.

Delivered by ACME-0046: the pure S2 renderer and a bounded YAML/JSON form flow
with CSRF and same-server checks, a fixed body limit, safe run identifiers and
an explicitly configured scenario root. Offline launch reuses synchronous
`launchPlan`, refuses duplicate run ids, redirects to S3, reaches S4 for a
configured SQLite ledger and describes memory-run evidence honestly as
non-durable.

Delivered by ACME-0047: the pure S1 catalog renderer plus `/s1` and
`/api/catalog`. The loopback process composes the existing Narrative and
Research registries, `parseScenario` and bounded `discoverCatalogSources`
under the process-configured scenario root. Full fingerprints, invalid
scenarios, missing/refused references, orphan fixtures, diagnostics and
unavailable sections remain explicit; no browser path input exists.

Delivered by ACME-0048: the pure S5 memory-decision renderer plus
`/s5?executionId=...` and `/api/memory-decisions?executionId=...`. S4 carries
the exact execution id into the new view; the route reads the repository's
durable replay evidence, preserves recorded counts and decision order, keeps
ignored/missing/unattributed evidence visible, and never enables payload
disclosure or memory mutation.

Delivered by ACME-0049: the pure S6 state renderer plus
`/s6?namespace=...&entityId=...` and
`/api/state?namespace=...&entityId=...`. S4 carries the exact namespace/entity
scope into the new view; the route reads repository snapshot evidence,
preserves builder-owned revision ordering/counts/continuity, distinguishes an
empty lineage from unavailable evidence, and never enables payload disclosure
or state mutation.

Delivered by ACME-0050: the pure S7 replay renderer plus
`/s7?executionId=...` and `/api/replay?executionId=...`. S4 carries the exact
execution id into read-only `replayVerify`; a fail-closed gateway proves the
path cannot contact a provider. The renderer copies the engine's exact
`match | different | unavailable` verdict, delegates digest comparison to
  `buildReplayView`, keeps diagnostic values redacted and persists no report or
  canonical effect. Programmatic server composition may receive an injected
  payload encryptor; the command-line workbench acquires no key itself.

Delivered by ACME-0051: the pure S8 measurement renderer plus `/s8` and
`/api/measurement`. Both aggregate every readable workspace run through
`buildMeasurementView`, keep deterministic and live records separate, accept
only request-local finite `0..1` min/max thresholds and optionally load one
existing safe-named baseline. An absent baseline makes no comparison; a named
missing/unreadable baseline is refused. Any unreadable run record refuses the
whole measurement so the denominator cannot shrink silently. The route writes
nothing and performs no provider call.

Delivered by ACME-0052: the pure S9 fixture-review renderer plus `/s9`,
`/api/fixture-review` and protected `/s9/decision`. A complete proposal is
request-local and must point to an existing workspace run/execution; no
proposal file is invented. Approval/rejection reuses `decideFixtureChange`
and stores only `acme-fixture-approval/1`. Existing, conflicting, unreadable
or concurrent proposal ids cannot be overwritten. Decided history is rebuilt
from approval records, remains `applied: false` and never reads or writes the
fixture.

Delivered by ACME-0053: the pure S10 live-evaluation renderer plus `/s10`,
`/api/live-evaluation` and protected `/s10/launch`. The page shows only
non-mock run records, explicit confirmation/cost absence and every unreadable
run filename. Launch accepts exactly one `ExecutionRequest`, reuses the
ADR-0023 process + named confirmation + budget gate, reads credentials only
inside the local process and refuses unsafe, existing, unreadable or active
run ids before provider dispatch. Test-only injection proves the complete HTTP
path offline; the command-line workbench still uses the real env/fetch path.

Delivered by ACME-0069 (ADR-0027): async launch. The workbench process owns an
in-process single-flight JobRunner, the interface workspace gains
`jobs/<jobId>.json` (`acme-job-record/1`), and browser launch enqueues through
`enqueuePlan` so the HTTP response returns before the scenario finishes.
Synchronous `launchPlan` is unchanged for scripts and tests. S3 renders live
progress when the host supplies job evidence and still reports
`RUN_PROGRESS_UNAVAILABLE` for pure history-only callers. Cancel is
`POST /s3/<runId>/cancel` under the same CSRF and same-server proof and is
cooperative: it does not roll back a committed ledger write. A process restart
marks non-terminal jobs `interrupted`.

Not delivered: remote hosting; browser CI (T4); a plan `measurements` block
(T2); adapter discovery beyond declaration (T3). Multi-step live scenarios run
through ScenarioRunner `composition.gateway: openai` (ACME-0064); S10 remains
single-execute by decision (ADR-0023). Proposal:
`docs/backlog/domain-test-ui-implementation.md`. A non-authority visual mock
lives under `docs/concepts_sandbox/temp/`.

### Post-execution quality evaluation

Delivered by ACME-0054 (ADR-0025): `@acme/evaluation` accepts an immutable
`acme-quality-subject/1` bound to an exact run, execution, artifact and
contract. A static registry runs named deterministic evaluators or replays an
exact `acme-recorded-quality-evaluation/1`; both produce structured scores,
findings and a `pass | fail | inconclusive` verdict. Content-derived subject,
result and evaluation identities include evaluator id/version and refuse
collisions or mismatched recordings.

The result is stored separately as `acme-quality-evaluation/1`. The in-memory
adapter is append-only, idempotent for byte-identical content, returns detached
records and has a reusable conformance kit. Execution evidence remains
unchanged. `acme-scenario/2` adds `evaluate` and `assertEvaluation` while the
v1 parser and behavior remain compatible. A failed quality verdict is a
successful evaluation step; only an explicit assertion fails the scenario.
All evaluation paths reachable from the synchronous harness are deterministic
offline, and no evaluator may perform a live external call through that
contract.

Delivered by ACME-0065 (ADR-0026): the durable SQLite store. Migration v2 adds
an append-only `quality_evaluations` table with no foreign key to executions,
`createSqliteQualityEvaluationStore` implements the same
`QualityEvaluationStore` port as the in-memory adapter, the shared conformance
kit passes unchanged, and close/reopen preserves records.

Delivered by ACME-0066–0068: `acme quality list`, `acme quality inspect` and
`acme quality judge` over the composition-selected store (memory or the same
SQLite file); the pure `acme-view-quality-evaluation/1` list/detail view (S11)
in `apps/test-ui`; and `runLiveModelQualityJudge`, a live-model judge that runs
outside the synchronous harness — which still refuses Promise-returning
evaluators — stores `kind: live-model`, requires `ACME_LIVE_TEST` plus
credentials, and is proven offline through an injected OpenAI transport.

## Persistent Gaps

Ordering, dependencies and activatable slices live in
[`docs/design/gap-resolution-plan.md`](design/gap-resolution-plan.md)
(ACME-0056). IDs below match that plan (G01–G19).

- **G01/G02 — ScenarioRunner live multi-step:** **Closed by ACME-0064.**
  `composition.gateway: openai` plus execute `model` (and optional
  `liveGateway` injection) run serial multi-step scenarios live; offline
  injected-transport proof and opt-in `tests/live/scenario-multi-step.test.ts`.
  Operator live success 2026-08-06: both `openai-responses` and
  `scenario-multi-step` green under `pnpm test:live` (model `gpt-5.6-luna`;
  evidence in local gitignored `live_test.log`). S10 remains single-execute
  (ADR-0023).
- **G03 — Nothing drains the outbox automatically.** A composition root must
  call the drain (ADR-0018; library auto-drain rejected). **Growth alarm closed
  by ACME-0060:** `outbox inspect` reports status counts and optional
  `--max-pending` / `--max-failed` thresholds. Host drain remains external.
- **G04 — Outbox residuals:** **Closed for WP-O core path.** Redrive
  (ACME-0059), file transport (ACME-0061), and Narrative
  `narrative.document-observed` emission (ACME-0062) make real outbox traffic
  end-to-end. Research still emits no domain events (optional later).
- **G05 — Driver error classification:** **Closed by ACME-0057.** The SQLite
  adapter maps busy/locked codes to retryable `PERSISTENCE_TRANSIENT` and
  corruption/constraint codes to non-retryable `PERSISTENCE_CORRUPTION`;
  unknown failures become `INTERNAL` AcmeErrors (never raw driver throws).
  See `docs/backlog/driver-error-classification.md` (resolved).
- **G06 — Stranded executions:** **Closed by ACME-0058.** Core
  `listStrandedExecutions` / `prepareOperatorDischarge` plus CLI
  `execution stranded` and `execution discharge --by --rationale` inventory
  open and terminal stranded rows and discharge open ones via `markTerminal`
  with operator audit in error details (no invented model outcomes).
- **G07 — Domain Test UI workbench (ACME-0045–0053) delivered.** Phases 0–6
  delivered S1–S10 as JSON contracts. Loopback HTML covers S1–S10 (catalog,
  offline plan preview/launch, durable memory/state inspection, replay,
  measurement, fixture review, gated single-execute live). CI still uses
  CLI/`pnpm` gates, not the browser. **Accepted** as intentional; optional
  browser CI is T4 only. → accept / WP-T optional
- **G08 — Launching blocks its caller:** **Closed by ACME-0069 / ADR-0027.**
  Synchronous `launchPlan` remains for blocking callers. Workbench HTTP launch
  uses in-process `enqueuePlan` / JobRunner with interface-owned
  `acme-job-record/1` files, S3 live-progress when job evidence is supplied,
  and cooperative cancel via AbortSignal (no ledger rollback of commits).
- **G09 — Plans cannot pin a model:** **Closed by ACME-0063.** Case-level
  `model` on `acme-test-plan/1` compiles to `execute.model`; materialization
  prefers plan model over mockResponse selection. Live plans may use
  `composition.gateway: openai` with model and without mockResponse.
- **G10 — `measurements` is not in `acme-test-plan/1`.** S8 (ACME-0043)
  measures recorded runs with thresholds supplied at measurement time; the
  plan format still rejects a `measurements` block (ADR-0020). Embedding
  thresholds in the plan would be a separate charter. → WP-T
- **G11 — Adapter targets are declared, not discovered.** Nothing in the
  workspace registers adapter implementations; the CLI composition root
  hard-codes them. The catalog therefore renders targets a caller declares and
  only validates the kit name, so a workspace adapter nobody declares is
  invisible to it. → WP-T (or accept declaration-only)
- **G12 — Trust pipeline granularity.** `preparing-commit` owns the memory,
  projection and state substages, and a failure there reports `reached` for
  all three because the recorded error does not name one. Finer resolution
  requires the engine to record finer evidence, not the interface to guess.
  → WP-E
- **G13 — Model parameter capability:** some models (e.g. `gpt-5.6-terra`)
  reject `temperature` after accepting the schema. Reference contracts no
  longer emit a default `temperature` (ACME-0037); core and the OpenAI adapter
  already treat it as optional and only forward when present. Residual:
  optional profile / capability gating if a future contract *explicitly* sets
  temperature for a model that rejects it (ADR-0015). → WP-P (defer until pain)
- **G14 — Ambiguous call reconciliation** against provider-side history is not
  implemented. ADR-0014 keeps such calls terminal and non-retried. → WP-P defer
- **G15 — Privacy deletion and full key lifecycle (KMS/rotation)** remain
  deferred. Payload encryption at rest is implemented (ADR-0016); live runs may
  use `encrypted-payload` when the composition root supplies an encryptor. The
  opt-in live gate still defaults to `hash-only` until that wiring is normal.
  → WP-K defer
- **G16 — Offline success-path Responses fixtures** remain simplified samples
  (unknown fields tolerated); they are not byte-identical live captures. → WP-P
  optional
- **G17 — Package boundary enforcement** covers current packages; future
  adapters must extend its rule set. → WP-X process
- **G18 — `better-sqlite3` prebuild** is exercised on Windows locally and on
  `ubuntu-latest` in CI, where the full suite including the SQLite adapter
  passes. No other platform is observed. → WP-X observe-only
- **G19 — Quality evaluation:** **Closed WP-Q (ACME-0065–0068).** Durable
  SQLite store (Q1), CLI `quality list|inspect|judge` (Q2), pure
  `acme-view-quality-evaluation/1` (Q3), and live-model judge outside the
  sync harness with offline injected-transport proof (Q4).
