# Current Status

Last updated: 2026-08-01

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
  `execution inspect`, `state inspect` and `memory inspect`, with versioned
  JSON on stdout, diagnostics on stderr, payload redaction by default and exit
  codes separating success, a non-committed outcome and a usage error
- automated dependency rules, a core vocabulary guard and negative core,
  module, cross-module and SQLite-driver boundary fixtures
- 384 passing unit-suite tests across packages, integration and scenario paths
  exercised by `pnpm test:unit` (45 files), with separate conformance (58),
  integration (29) and scenario (19) gates
- compile-time task-name/input/output, state-projection and conformance-subject
  inference checks
- non-empty passing repository, gateway and module conformance, integration
  and scenario gates
- no published package
- no deployment

## Approved Direction

`docs/PROJECT_BRIEF.md` is the active project direction. Core must be
domain-neutral and proven with NarrativeModule and ResearchModule.

## Active Work

No product implementation task is active. `docs/CURRENT_TASK.md` is the empty
template until the next charter is explicitly approved.

### Recent completed work (summary)

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

### Domain Test UI (not active)

[`Domain Test UI — Specification`](design/domain-test-ui-specification.md)
remains documentation only. Engine prerequisites (ExecutionEngine, both
reference domains, SQLite, ScenarioRunner, CLI) exist. Activation is still
blocked by the specification’s own **decision gates** (runtime shape,
`acme-test-plan/1`, storage location, and whether the UI is in v1 at all), not
by missing ScenarioRunner or durability. Proposal:
`docs/backlog/domain-test-ui-implementation.md`.

## Persistent Gaps

- **ScenarioRunner has no live provider step.** `acme execute --gateway openai`
  reaches a live model (ACME-0032), but a scenario file cannot; scenario runs
  are mock-only.
- **Nothing drains the outbox automatically.** A composition root must call the
  drain, and no alarm exists for a growing outbox (ADR-0018).
- **Outbox residuals:** `failed` entries have no redrive path, no real
  transport exists beyond the CLI's report dispatcher, and neither reference
  module emits domain events yet, so production outbox traffic is still
  hypothetical.
- **Driver error classification:** a `better-sqlite3` failure reaches the
  caller as non-retryable `INTERNAL`, so a transient `SQLITE_BUSY` would be
  indistinguishable from an internal defect. Proposal:
  `docs/backlog/driver-error-classification.md`.
- **Stranded executions:** an execution interrupted between model-call
  reservation and outcome, or one whose response was not retained, is terminal
  and needs a human decision. No operator command lists or discharges them.
- **Domain Test UI:** specification only; decision gates unresolved. First
  meaningful charter would be gates + phase 1 plan compiler, not the full UI.
- **Model parameter capability:** some models (e.g. `gpt-5.6-terra`) reject
  `temperature` after accepting the schema. Reference contracts still emit
  `temperature: 0`; the live gate defaults to a chat model that accepts it.
  Optional residual from ACME-0029 / ADR-0015.
- **Ambiguous call reconciliation** against provider-side history is not
  implemented. ADR-0014 keeps such calls terminal and non-retried.
- **Privacy deletion and full key lifecycle (KMS/rotation)** remain deferred.
  Payload encryption at rest is implemented (ADR-0016); live runs may use
  `encrypted-payload` when the composition root supplies an encryptor. The
  opt-in live gate still defaults to `hash-only` until that wiring is normal.
- Offline success-path Responses fixtures remain simplified samples (unknown
  fields tolerated); they are not byte-identical live captures.
- Package boundary enforcement covers current packages; future adapters must
  extend its rule set.
- `better-sqlite3` prebuild resolution is exercised on Windows locally and on
  `ubuntu-latest` in CI, where the full suite including the SQLite adapter
  passes. No other platform is observed.
- A general evaluation / quality-scoring harness is not implemented.
  ScenarioRunner asserts recorded evidence only.
