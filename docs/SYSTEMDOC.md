# System Documentation

Primary observation surfaces share `evidence-observation-card/1`: quote,
source title, citation, review standing, asserted event time and relation
count. Source review and the ledger embed the same card object.
`GET /api/text-imports` is the case source stream: imports sort by
`sourceProvenance.acquiredAt` then `createdAt` then `importId`. The
primary shell is three jobs plus search: Source stream, Claim, Stance
and Search. Default signed-in entry is the source stream
(`?view=stream` or omitted). Claim is `?view=claim`. Stance groups the
review queue by source title and keeps integrity, assessment and the
legacy type views as secondary. Source review places observations
under the block that contains their citation. Legacy `?view=` routes
remain. ACME-0148 derives document-native source parts from section
titles (förhör, analys, ALL-CAPS, numbered) and word-budget slices of
about 2,500 words. The source stream lists those parts as their own
cards. Opening `?part=` returns only that part’s lines. Live Analyze
accepts `sourcePartId` and plans windows only for that part. The
imported artifact stays one object.
Active observe is `evidence.observe-artifact@1.11.0` input `/3` output
`/6`. New analyzes derive a content-addressed `evidence-source-structure/1`
(hash of rule version + canonical text) into Q+A / paragraph / heading
blocks under `evidence-source-structure-rules/3`. Oversized paragraph
units split at sentence boundaries toward 150–350 words (soft 600);
a sentence and a Q+A pair are never split. Paragraph and Q+A-answer
blocks emit one citable segment per sentence. Structural coverage
windows pack those segments toward 800 words, hard-capped at 64. Coverage windows may carry neighbour
`contextSegmentIds`; an observation that names a context id is refused
(`EVIDENCE_CONTEXT_SEGMENT_NOT_EXTRACTABLE`). Historical `@1.10.0` and
line-segment contracts stay registered and byte-exact. Source review
shows those block headings beside the existing line list.
`GET /api/claims` (`?view=claim`) is the claim projection: current
occurrences grouped by relation scope or actor label as unmerged cards.
Optional `sort=source-time|event-time`. Overlap is visible;
`corroborates` is not assigned.
Active relate is `evidence.relate-observations@1.2.0` output `/2` with
continuity kinds (`repeats`, `adds_detail`, `changes_certainty`,
`retracts`, `omits_previous_detail`) and exposure kinds (`prompted_by`,
`exposed_to_before`, `asked_after`). Historical `@1.1.0` stays
byte-exact. These relations do not delete earlier occurrences and do
not infer `corroborates`. Claim groups list those relation kinds.

Reviewer operations are case-bound records (`evidence-review-assignment/1`,
`evidence-review-comment/1`, `evidence-review-activity/1`). Decisions remain
append-only canonical history; an assignment is projected as completed once
its exact target has a decision. Bulk review accepts at most 50 unique targets
and validates the entire case-scoped batch before an atomic repository write.
`evidence-case-search-query/1` provides stable exact filtering and offset
pagination over a case snapshot; it performs no model inference.
`evidence-case-overview/1` and `evidence-case-integrity-report/1` are pure
projections of one authorized case snapshot: every integrity row names the
exact source-bound observations behind it, and classification reads typed
canonical evidence rather than model-authored rationale text.
`evidence-assessment-output/1` renders one reviewed assessment as deterministic
JSON, Markdown, DOCX and PDF bytes under a per-case export policy, and every
release or refusal appends an `evidence-export-audit-record/1`.

Last updated: 2026-08-16
Status: Approved architecture with a bounded single-task ExecutionEngine, pure engines, NarrativeModule and ResearchModule, replay verification, shared conformance, in-memory and durable SQLite Units of Work, model mock, an OpenAI Responses mapping with strict-schema lowering and a confirmed live success path, ScenarioRunner v1/v2 including live multi-step, post-execution quality evaluation with a durable store, CLI quality surfaces and a live-model judge, a CLI composition root and a Domain Test UI through a complete S1–S10 loopback HTML workbench with async launch plus the pure S11 quality view

This document describes long-lived system boundaries. Live provider calls are
opt-in only (`pnpm test:live`) and are not part of default CI.
Exact contracts, storage schema, protocols and milestones are defined in
[`docs/design/acme-design-and-development-spec.md`](design/acme-design-and-development-spec.md).

The English OpenAI/FDE presentation, PDF and Markdown counterpart under `hrd/`
are derived external explanatory artifacts. They summarize this architecture
but do not define or supersede system behavior, contracts or accepted ADRs.

## Implemented Substrate

- pnpm workspace pinned to Node `24.18.0` and pnpm `10.34.5`
- strict ESM TypeScript project references
- `@acme/core` contract package, `@acme/adapter-memory`,
  `@acme/adapter-sqlite`, `@acme/adapter-model-mock`,
  `@acme/adapter-model-openai`, `@acme/module-narrative`,
  `@acme/module-research`, `@acme/evaluation`, reusable
  repository/gateway/module/quality-store conformance support in
  `@acme/testing`, the
  `@acme/cli` composition root and the `@acme/test-ui` read model
- workspace import test from `@acme/testing` to `@acme/core`
- dependency-cruiser package-boundary enforcement
- source vocabulary guard for `packages/core/src`
- negative fixtures proving forbidden core-to-app, module-to-adapter,
  module-to-module, core-to-provider-wire, core-to-SQLite-driver,
  test-UI-to-package-internal and anything-to-test-UI dependencies fail
- secret-free CI gates for documentation, formatting, lint, typecheck,
  boundaries, tests and builds

This substrate implements bounded single-task execution, durable local
persistence, two offline acceptance scenarios, declarative multi-step
scenarios, deterministic offline quality assessment and an opt-in live
provider gate.

## Implemented Contract Layer

`@acme/core` now implements:

- common JSON, identity, timestamp, document and diagnostic types
- canonical JSON algorithm `acme-cjson-1` and SHA-256 hashing
- immutable `acme-model-request-hash-1` over a complete validated request
- the ACME error-code taxonomy and structured `AcmeError`
- provider-neutral model request/response and gateway port types
- closed model selection/request/capability/context/response validation and
  required-capability semantics
- versioned prompt-contract types backed by Zod runtime schemas
- a strict response pipeline with empty, parse, schema and semantic stages
- input schema validation before response inspection plus detached deeply
  frozen contract input/output for input-bound semantic checks
- explicit warnings for the permitted BOM and Markdown JSON-fence cleanup
- rejection of schema coercion or other parsed-value transformations
- immutable contract and module registries with deterministic lists
- deterministic contract fingerprints
- task-typed module authoring and compile-time task input/output/projection
  inference
- explicit interpreted state intent plus required task-owned
  `projectState()` hooks
- task interpretation receives the exact schema-validated immutable task
  input retained by ExecutionEngine
- exact memory-candidate/decision correlation and filtered immutable
  state-projection input containing only applied decisions
- state and memory envelopes/policy declarations required by module contracts
- execution request/policy/result, evaluation evidence and aggregate
  `ExecutionRepository` contracts
- versioned execution ID, operation key, request fingerprint, deterministic
  retrieval and model-response hash algorithms
- portable immutable replay read-set and prepared-commit evidence
- versioned `acme-operation-digest-1` prepared-commit hashing
- `PayloadEncryptor` port plus pure AES-256-GCM reference helper
  (`createAes256GcmPayloadEncryptor`); key material is always
  composition-supplied (no env reads in core)

Two reference domains now exercise this contract layer.

## Implemented Input-Bound Contract Surface

ADR-0010 closes the public contract gap discovered by ACME-0012:

- `ResponsePipeline.process(response, contract, input)` validates contract
  input before reading response text
- invalid, non-JSON or schema-transforming input fails non-repairably at
  `input`
- semantic validation receives detached deeply frozen validated output and
  contract input
- `TaskDefinition.interpret(output, input, context)` binds original typed task
  input to domain interpretation and preserves task inference

The ExecutionEngine validates, detaches, freezes and retains task input before
reusing the exact value for projection, interpretation and replay evidence.

## Approved Reference-Domain Identity and Evidence

ADR-0009 fixes the pre-implementation v1 identity/provenance boundary without
adding domain vocabulary to core:

- canonical `NarrativeState.entityAliases` is the only alias authority
- `narrative-entity-key-1` deterministically derives unknown entity keys
- Narrative character-fact supersession requires a matching target identity,
  exact prior value and exact document quote validated during interpretation
- `research-proposition-key-1` identifies the contract's canonical
  proposition while explicit polarity distinguishes supporting and
  contradicting evidence
- `research-source-key-1` identifies a normalized URI, separately from
  `research-source-independence-key-1`, which records the caller's declared
  authority/basis assertion
- Research claim memory values retain URI, publisher, retrieval time,
  document key, locator, quote and both source keys; generic core provenance
  continues to retain execution, contract, model-call and document links
- verified/contested Research state references stable memory IDs rather than
  duplicating complete evidence

All four identifiers use `acme-cjson-1`, SHA-256, immutable algorithm names
and documented golden vectors. Narrative entity identity is implemented by
`@acme/module-narrative`; the three Research identifiers are implemented by
`@acme/module-research`. Every published golden vector is asserted by test.

## Approved Narrative Knowledge and Context Ownership

ADR-0011 fixes the pre-implementation Narrative v1 ownership and short-range
context boundary:

- memory is the sole canonical owner of character facts, relationships, world
  rules, contradictions and evidence
- state owns the entity/display-name registry, canonical aliases, current
  scene, fixed narrative window and outline progress
- state characters contain no fact attributes, and v1 state contains no
  relationship/world-rule values or memory-ID cache
- `narrative-window-1` retains at most two summaries ordered oldest to newest
- `previous-document-tail-1` deterministically derives the last at most two
  sentences and 320 Unicode code points from the previous immutable source
  document, with key/hash provenance and no summary fallback

The previous tail is projected contract context, not state or memory.
`@acme/module-narrative` implements these contracts with strict schemas,
deterministic derivation and golden fixtures.

## Implemented NarrativeModule

`@acme/module-narrative` implements the bounded module-level phases 1–4:

- strict task, contract, source, memory, state and delta schemas
- immutable `narrative.observe-document@1.0.0` request construction and
  input-bound semantic validation
- deterministic projection of stable state context, two summaries, exact
  previous-document tail and relevant memory
- interpretation into one source document, character-fact, relationship and
  world-rule candidates, direct scene/window/outline intent and diagnostics
- pure post-memory entity/alias projection that accepts only applied memory
  decisions
- pure state initialization, reduction and invariants
- domain-owned memory validation, identity, retrieval, resolution and
  lifecycle behavior, including evidence-backed supersession

The module runs the unchanged shared DomainModule conformance suite and
contains no concrete adapter, provider, database, app or testing-support
dependency. It does not invoke a model, write a repository or claim the Phase
5 acceptance scenario; those remain ExecutionEngine responsibilities.

## Implemented ResearchModule

`@acme/module-research` implements the bounded module-level phases 1–4 and is
the second reference domain:

- strict evidence-input, contract-input/output, source, claim, question, state
  and delta schemas, including absolute credential-free source URIs and
  canonical UTC retrieval timestamps
- ADR-0009 `research-source-key-1`, `research-source-independence-key-1` and
  `research-proposition-key-1`, each reproducing its published golden vector
- immutable `research.observe-evidence@1.0.0` request construction with the
  verification threshold and identity-policy version as fixed configuration
  facts, never model-supplied
- input-bound semantic validation rejecting quotes absent from the supplied
  evidence, locators without that source, and duplicate claims or questions
- interpretation into one evidence document plus source, claim and question
  candidates, each claim retaining complete domain evidence alongside generic
  core provenance
- a memory policy where corroboration counts distinct declared independence
  keys only, duplicate evidence from one authority stays auditable without
  raising the count, and contradictory evidence contests the claim instead of
  overwriting the earlier position
- pure post-memory projection that derives verify, contest and defer decisions
  from applied decisions and prior records, never from model output
- pure state initialization, reduction and invariants that reject dual status,
  sub-threshold verification and evidence-free claims

Supporting and contradicting evidence share one proposition identity, so a
contradiction contests the same claim rather than creating a rival record. The
module runs the unchanged shared DomainModule conformance suite. It does not
invoke a model or write a repository itself; the ExecutionEngine does that in
the Research phase 5 acceptance scenario.

The scenario drives three hand-written offline sources through the engine and
proves the standing sequence the domain exists to produce:

- one source retains a deferred claim and cannot verify it, whatever
  confidence the model reported
- a second source with a distinct declared independence key promotes the claim
  to verified with an independent-source count of two
- a contradicting third source contests the claim, preserves every variant and
  leaves the earlier record contested rather than overwritten
- a stale expected revision performs no model call, allocates no ID and writes
  nothing
- every committed execution replay-verifies offline with an unchanged
  operation digest, no gateway call and no clock read

## Implemented DomainModule Conformance

`@acme/testing` exports a reusable `domainModuleConformance()` suite over
public `@acme/core` contracts:

- strongly typed task selection retains task input, contract output, state and
  delta inference
- module, task, schema-version and registry identities are checked
- supplied valid/invalid input, state and delta fixtures exercise runtime
  schemas
- `project()`, `interpret()` and `projectState()` must be deterministic,
  detached and deeply frozen
- initialization, reduction and invariants must be deterministic and
  mutation-resistant
- document, memory-candidate and event keys must be non-empty and unique
- caller-supplied validation, identity, retrieval, resolution and lifecycle
  outcomes exercise the memory-policy boundary without genericizing domain
  meaning
- analyzer tasks may return an explicit empty result

The identical suite passes for testing-owned producer, empty-analyzer and
Narrative-owned fixtures. Research must run it with its own fixtures; domain
identity, contradiction, merge, promotion and invariant semantics remain
module-owned unit-test concerns. A dependency rule rejects future
`packages/module-*` imports of apps, concrete adapters or `@acme/testing`.

## Implemented Post-Memory State Projection

`@acme/core` now defines the bridge between pure memory resolution and pure
state preparation:

- `ModuleResult.stateIntent` is typed interpreted intent rather than a
  pre-memory final delta
- every task owns a synchronous pure `projectState()` hook
- `buildStateProjectionInput()` requires an exact one-to-one candidate and
  prepared-decision key set
- applied create, reinforce, merge, contest and supersede decisions retain
  their correlated candidates, identities and affected memory IDs
- ignore and reject-candidate remain repository audit evidence but are absent
  from memory-derived projection input
- prepared decision order is preserved and returned input is canonical-JSON
  cloned, detached and deeply frozen
- projected deltas remain untrusted until StateEngine schema, reducer and
  invariant validation succeeds

This pure boundary itself adds no persistence or orchestration behavior. The
ExecutionEngine runs it after interpretation and MemoryEngine preparation,
then passes its output to StateEngine before one aggregate commit. Milestone 1
records an empty evaluator list because evaluator execution remains deferred.

## Implemented Deterministic Model Mock

`@acme/adapter-model-mock` implements the provider-neutral `ModelGateway` for
offline execution:

- exact immutable `ModelSelection` profiles declare capabilities
- the full profile/call script validates before use
- calls are uniquely addressed by `(executionId, callKey)` and additionally
  require exact selection plus `acme-model-request-hash-1`
- pre-aborted and unsupported-capability calls do not consume scripts
- matching normalized successes and structured `TIMEOUT`/`MODEL_*` failures
  consume once without semantic rewriting
- unexpected, mismatched, repeated and unconsumed calls are deterministic
  non-retryable test-harness failures
- response timestamps, usage, metadata and provider identity are script data;
  no fallback values are generated
- inputs, outputs and invocation inspection are detached and deeply frozen
- runtime source has no provider SDK, network, environment, filesystem, clock
  or random dependency

`@acme/testing` supplies a reusable gateway conformance kit covering
capability discovery, required-capability rejection, pre-call cancellation,
normalized success, structured failure and immutability only through the core
port. Mock-specific invocation evidence remains outside `ModelGateway`.

## Implemented StateEngine

`@acme/core` implements pure state preparation without store access:

- `StatePrepareContext` carries entity, execution, operation and time context;
  namespace remains module-owned
- revision zero initializes state through
  `module.initialState({ entityId, now })`
- existing snapshots, delta envelopes, reduced state and invariants are
  validated before a candidate can be returned
- stale expected revisions fail with `CONFLICT_STATE_REVISION`
- reducers receive detached, deeply frozen state and delta values
- missing deltas return `null` without invoking initialization, reduction or
  invariants
- accepted results produce immutable next-snapshot and transition candidates
  with canonical SHA-256 hashes and execution provenance
- transition IDs use the immutable `acme-transition-id-1` derivation from
  execution ID, operation key, module namespace and entity ID

The StateEngine does not persist candidates. The in-memory repository enforces
state-head compare-and-swap, transition/operation identity and atomic
promotion.

## Implemented MemoryEngine

`@acme/core` implements pure memory policy execution without store access:

- candidate and loaded-record envelopes are strictly validated at their trust
  boundaries
- candidates run by stable key against an immutable evolving working set
- the domain policy owns identity, resolution value, resulting strength,
  contradiction, relevance and lifecycle choices
- create, reinforce, merge, contest, supersede, reject and ignore decisions
  have explicit application semantics
- create/replacement records use the injected memory ID generator only after a
  complete decision validates
- new records start at version one; updates carry the exact expected prior
  version and increment once
- affected timestamps and deduplicated provenance append are core mechanics
- retrieval rejects foreign, modified, duplicate or non-finite policy results,
  then sorts by score, identity and memory ID before applying its limit
- lifecycle runs only at explicit hooks and prepares retain, strength-update or
  forget decisions

The MemoryEngine returns immutable decisions and mutations. The in-memory
repository retains candidate/decision evidence, enforces memory record-version
compare-and-swap and promotes mutations atomically.

## Implemented In-Memory Unit of Work

`@acme/adapter-memory` implements the aggregate `ExecutionRepository`:

- request-key/fingerprint acceptance, immutable execution lookup and terminal
  outcomes
- idempotent attempt and model-call evidence with divergent-key protection
- deterministic state, memory and document reads
- `acme-operation-digest-1` verification before commit
- private copy-on-commit staging with one final publication point
- state-head CAS even when no state delta exists
- snapshot/transition scope, revision, hash-chain and identity validation
- sequential memory mutation CAS using `CONFLICT_MEMORY_VERSION`
- document hash validation and late document/event ID allocation
- atomic candidate, evaluator, document, memory, state, event/outbox and
  terminal execution promotion
- identical committed retry without new writes or IDs; divergent retry as
  `PERSISTENCE_CORRUPTION`
- atomic retention of the exact prepared commit and portable replay sidecar
- response-payload retention according to the stored execution policy while
  preserving response-hash evidence
- `encrypted-payload` retention (ADR-0016): adapters seal the normalized
  response with an injected `PayloadEncryptor`, store only
  `protectedResponse` (AES-256-GCM envelope), and decrypt on
  `loadReplayEvidence` when the key is available; missing keys yield
  `REPLAY_MODEL_RESPONSE_UNAVAILABLE`
- detached immutable `loadReplayEvidence()` projections for verification
- `loadResumeState()` (ADR-0017): recorded model calls ordered by call key and
  attempt, plus the highest recorded attempt number, revealed under the same
  payload rules as replay evidence
- detached, deeply frozen read results and deterministic evidence snapshots

The adapter is deterministic test persistence only. It does not survive
process termination and makes no crash-durability claim. The same core port is
covered by a reusable non-empty conformance suite in `@acme/testing`.

## Implemented ScenarioRunner

`AGENTS.md` fixes the boundary: the ExecutionEngine runs one task and
multi-step flows belong to a separate runner. `@acme/testing` implements that
runner over compatible `acme-scenario/1` and `acme-scenario/2` formats.

- v1 `execute`, `assert`, `replay` and `assertDigest` steps run serially, with
  later steps naming an earlier execution by alias
- v2 adds `evaluate` and `assertEvaluation`; evaluators receive immutable
  subjects bound to the exact execution/artifact/contract, and a `fail`
  quality verdict fails a scenario only when explicitly asserted
- a run halts at the first failed assertion and reports every step already
  run, because later steps depend on earlier state and a cascade of derived
  failures hides the first real one
- the report is a versioned `acme-scenario-report/1` document
- there is no branching, retry, loop, include or way to run arbitrary code; a
  scenario is data, not a program
- the runner never reads a file and never imports a concrete adapter. The
  caller injects the fixture loader and builds the composition, so
  `@acme/testing` depends only on the domain-neutral `@acme/core` and
  `@acme/evaluation` packages
- the composition is built from the scenario's own `seed`, so the declared
  clock and ID allocation are the ones the run uses
- `composition.gateway` is `mock` (default offline fixtures) or `openai`
  (live multi-step; requires composition `liveGateway`, CLI opt-in
  `ACME_LIVE_TEST` + credentials, or an injected transport under test)
- execute steps may pin `model` and, for live, omit `mockResponse`

Because memory record IDs are part of the operation-digest preimage, a
scenario that pins a digest must also pin its ID scheme. Specification 18.1
names `ids: sequential` without defining what it emits, so the shape is fixed
here and `idPrefix` and `idPadding` make it expressible.

The Narrative Phase 5 acceptance scenario exists in both forms, hand-written
and declarative, and reaches the same operation digest through the same
engine. The agreement is only evidence while both expressions exist.

## Implemented Post-execution Quality Evaluation

ADR-0025 separates quality assessment from both the proposed pre-commit
`EvaluationDecision` safety gate and S8 population measurements.
`@acme/evaluation` is a sibling layer that depends only on public core types;
ExecutionEngine and canonical execution evidence do not depend on it.

- `acme-quality-subject/1` binds run id, execution id, artifact identity and
  digest, contract id/version and the immutable execution result/evidence
- a static registry resolves exact evaluator id/version pairs
- deterministic evaluators run pure rules, thresholds, schema properties and
  consistency checks
- recorded-external evaluators replay a previously captured assessment only
  after exact evaluator/subject/result identity validation; they never call an
  external service
- `acme-quality-evaluation/1` returns finite ranged scores, structured
  findings and a `pass | fail | inconclusive` verdict with content-derived
  subject/result/evaluation identities
- `QualityEvaluationStore` is an append-only port. The in-memory adapter and
  the durable SQLite adapter (`createSqliteQualityEvaluationStore`, migration
  v2, ADR-0026) implement it under identical conformance: both are idempotent
  for byte-identical content, refuse identity collisions and return detached
  records. The SQLite table carries no foreign key to executions, so the
  evaluation lifecycle stays independent of the ledger
- `acme quality list`, `acme quality inspect` and `acme quality judge` read and
  write that store through the composition root, which selects the in-memory
  store or the same SQLite file as the repository
- `runLiveModelQualityJudge` (ACME-0068) runs a live-model judge *outside* the
  synchronous evaluator harness, which still refuses Promise-returning
  evaluators. It stores `kind: live-model`, requires the same opt-in and
  environment-only credentials as every other live path, and is proven offline
  with an injected transport. The recorded-external evaluator remains the
  offline default, and no evaluator reachable from the harness may call an
  external service
- the pure `acme-view-quality-evaluation/1` list/detail view (S11) projects
  stored evaluations for the Domain Test UI without an HTML surface

Assertions remain exact scenario expectations, metrics remain observations
over run populations, and quality evaluations remain versioned judgments over
one bound subject.

## Implemented Composition Root

`@acme/cli` is the only place in the workspace that selects a concrete
repository adapter. Everything else works through core ports.

- `scenario run` executes an `acme-scenario/1` file, owning YAML parsing,
  path resolution and the rule that a fixture path may not escape the
  scenario root
- `execute` runs one task through the bounded ExecutionEngine
- `execution replay --mode verify` reports the ADR-0012 verdict
- `execution stranded` lists open and terminal stranded executions
  (`acme-stranded-list/1`); `execution discharge` marks an open stranded
  execution failed with operator audit in error details (no model outcome
  invented, no state/memory/document write)
- `execution inspect`, `state inspect` and `memory inspect` read recorded
  evidence
- `outbox inspect` lists entries with their events; `outbox drain` leases,
  delivers and settles one bounded batch, bounded by `--limit` and
  `--lease-timeout-ms`; `outbox redrive` returns terminal `failed` entries to
  `pending`; `outbox drain --transport file --outbox-dir <path>` writes one
  file envelope per event instead of reporting only
- `quality list` and `quality inspect` read stored
  `acme-quality-evaluation/1` records; `quality judge` runs the live-model
  judge under `ACME_LIVE_TEST` plus credentials, or an injected transport in
  tests
- `--adapter memory|sqlite` selects the repository; `--database` is required
  for SQLite and rejected for memory
- versioned JSON goes to stdout and diagnostics to stderr
- payloads are redacted unless `--show-payloads` is supplied
- exit codes separate success, a terminal outcome that did not commit or
  verify, and a usage error

`execute` selects a gateway mutually exclusively: `--script` loads the
deterministic mock; `--gateway openai` builds the OpenAI Responses gateway with
`createFetchTransport`, reading `OPENAI_API_KEY` only in the composition root
(model from `ACME_OPENAI_MODEL` or `ACME_LIVE_MODEL`, default `gpt-5.6-luna`).
Scenario runs default to mock; `composition.gateway: openai` enables multi-step
live under opt-in CLI wiring (ACME-0064). Commands that cannot work are absent rather
than present and failing, and resume needs no command of its own: an
interrupted execution is resumed by re-submitting the same request through
`execute` (ADR-0017).

## Implemented Provider Boundary

ADR-0014 fixes how ACME reaches a real provider. `@acme/adapter-model-openai`
implements `ModelGateway` against the OpenAI Responses API and depends on a
transport port that carries only an opaque request and result. The transport
never parses a body, never classifies a failure and never sees an ACME type.

- request mapping turns system messages into instructions and preserves the
  supplied order, so the stable part of a call stays ahead of the changing part
- output JSON Schema is lowered into the provider's strict structured-output
  subset before dispatch: discriminated `oneOf` becomes nested `anyOf`, every
  property is required (optionals as required-and-nullable), and unlowerable
  constructs raise `UNSUPPORTED_CAPABILITY` with no network call
- a separate `providerWireSchemaHash` (`acme-provider-wire-schema-hash-1`)
  records the lowered wire schema without changing
  `acme-model-request-hash-1`, which still digests the canonical request
- content the adapter cannot honor is rejected rather than silently dropped,
  including stop sequences and non-text parts
- classification asks first whether the provider responded at all: a received
  status line is never ambiguous and maps through a fixed table, while a
  missing status line is ambiguous unless the transport proves non-delivery
- `capabilities()` resolves from static configuration and never probes
- credentials are supplied by the composition root; the package reads no
  environment
- a `fetch` transport lives on the separate `./transport-fetch` entry point,
  so the default surface stays network-free. It reports `delivery: 'unknown'`
  for every post-dispatch failure, because `fetch` cannot distinguish a
  request that never left from one that was answered and lost, and ADR-0014
  treats `unknown` as ambiguous

The adapter passes the unchanged shared `ModelGateway` conformance suite, so
the scripted mock and a real provider mapping satisfy one contract. Boundary
rules and a negative fixture prove provider wire shapes are unreachable from
core, modules, apps and other adapters, and the core vocabulary guard now
rejects provider names outright. A live `200` has been observed for both
reference-domain contracts under the lowered schema; the opt-in live gate
still defaults to `hash-only` until the composition root always supplies an
encryptor for live runs. With `encrypted-payload` and a working key, replay
is available without cleartext at rest.

## Implemented Durable Unit of Work

`@acme/adapter-sqlite` implements the same aggregate `ExecutionRepository` over
a local SQLite database. ADR-0003 fixes its shape; ADR-0013 fixes its driver
and first migration.

- WAL journaling, enforced foreign keys and full synchronous writes
- ordered migrations whose checksum is `sha256` over the canonical migration
  source; a tampered checksum or an unknown recorded version refuses to open
  the database as `PERSISTENCE_CORRUPTION`
- one `BEGIN IMMEDIATE` transaction per mutating operation, so digest
  verification, compare-and-swap and every canonical write commit or roll back
  together
- the specification section 15.2 columns as the queryable, indexed and
  constraint-bearing projection, plus canonical `acme-cjson-1` columns where
  the core contract is richer than those columns can express
- an `execution_commits` row holding the operation digest, committed
  projection and exact prepared commit, including the ADR-0012 replay sidecar
- reads for `get()`, `loadContext()`, `loadResumeState()` and
  `loadReplayEvidence()` that return detached, deeply frozen values and open no
  transaction

Observable behavior is identical to `@acme/adapter-memory`, including
encrypted-payload sealing when both are given the same encryptor (ciphertext
bytes differ per call because IVs are random; `responseHash` and presence of
an envelope match). Both adapters run the same conformance suite. A committed
database reopened in a new connection returns identical replay evidence and
the recorded terminal result without a new model call or ID allocation, when
the reopened repository still has the key needed to open sealed payloads.

Rollback is observed rather than assumed. A fault injected inside `commit()`
through the injected `IdGenerator` leaves no partial effect on either adapter,
and a driver-level fault injected inside the `BEGIN IMMEDIATE` transaction —
after documents, memory candidates, the state snapshot, the transition and the
state-head upsert are written — leaves none of them behind once every
connection is closed and the file is reopened. The recorded model call
survives, because it is written outside the commit. Driver failures are
classified inside `@acme/adapter-sqlite` before they leave the repository
(ACME-0057): busy/locked → retryable `PERSISTENCE_TRANSIENT`,
corruption/constraint → non-retryable `PERSISTENCE_CORRUPTION`, otherwise
`INTERNAL` as an `AcmeError` (never a raw driver throw).

Two writers on one file that read the same revision produce exactly one
commit. The loser's compare-and-swap fails at commit time with
`CONFLICT_STATE_REVISION`, and it contributes no document, memory record,
snapshot, transition, event or outbox entry.

## Implemented Durable Execution Resume

An execution that was accepted but never reached a terminal result is resumed
by re-submitting the same request. ADR-0017 fixes the semantics:

- resume never calls the provider; it completes from recorded evidence or
  terminates
- a recorded successful primary call whose response is readable continues from
  response validation, with no reservation, no gateway call and no model-call
  ID allocation
- no reservation at all means no request can have left the process, because
  reservation precedes dispatch, so the execution runs from the beginning
- a `reserved` or `in-flight` call is terminal `MODEL_UNAVAILABLE`: its outcome
  was never observed, and ADR-0014 forbids guessing that it never ran
- a `failed` or `ambiguous` call is terminal, re-raising the recorded error
- a successful call whose response was not retained — `none`/`hash-only`
  retention, or `encrypted-payload` without a working key — is terminal
  `RESUME_EVIDENCE_UNAVAILABLE`
- the resumed run re-reads state, memory and documents; a moved expected
  revision terminates it as `conflicted` rather than committing against a
  world that has changed
- the resumed run records its own attempt number, so the ledger distinguishes
  an interrupted-and-resumed execution from an uninterrupted one

Both repository adapters prove the same behavior, and the SQLite proof
survives a real close and reopen of the database file: the resumed run reaches
the same operation digest as an uninterrupted run of the same request.

## Implemented Outbox Delivery

Committed domain events leave the outbox through an explicit bounded drain
(ADR-0018). This repository starts no timer and no worker: a composition root
calls `drainOutbox`, which performs exactly one leased batch per call.

- `leaseOutbox` atomically leases due entries — `pending`, or leased past
  their expiry, with `availableAt <= now` — ordered by event `occurredAt` then
  `eventId`, incrementing the attempt count and setting the lease expiry. The
  API says lease because `claim` is Research vocabulary the core guard
  forbids; the persisted status value stays `claimed`
- the lease is a visibility timeout rather than a lock, so a holder that dies
  strands nothing; the entry returns by itself
- `markOutboxDelivered` and `markOutboxFailed` settle a leased entry; a
  failure carries `lastError` and either a `retryAt` that returns the entry to
  `pending` or, without one, the terminal `failed` status
- the repository owns no retry policy: backoff and giving up are an injected
  function of the attempt count
- delivery is at-least-once. A crash between a successful delivery and its
  settlement re-delivers after the lease expires, and consumers must
  deduplicate on `eventId`
- `OutboxDispatcher` carries no transport, network or provider vocabulary, and
  `drainOutbox` returns a versioned `acme-outbox-drain-report/1`

`acme outbox inspect`, `acme outbox drain` and `acme outbox redrive` expose
this to an operator. Inspect reports counts by status and optional
`--max-pending` / `--max-failed` growth alarms (composition-root policy;
exit code 1 when exceeded). Host scheduling should call `acme outbox drain`
from cron/`systemd`/CI — not a library timer (ADR-0018). The
CLI default dispatcher hands events to the operator through the drain report
rather than inventing a transport; `--transport file --outbox-dir <path>` also
writes versioned `acme-outbox-file-delivery/1` envelopes (ACME-0061), and any
other real transport remains a composition-root change. Terminal `failed`
entries return to `pending` through `redriveOutbox` and `acme outbox redrive`
(ACME-0059), which never touches a `delivered` entry and deletes no evidence.

## System Purpose

ACME coordinates typed, model-backed tasks while keeping model communication,
domain interpretation, memory mechanics, state transitions and persistence
separate.

## Core Responsibilities

### ExecutionEngine

- Accepts one validated typed task request and resolves static module,
  task and contract registrations before repository acceptance.
- Derives deterministic execution, request-fingerprint and operation
  identities using the algorithms fixed by ADR-0012.
- Loads the expected state revision, immutable context and at most 50
  deterministically ranked memory records.
- Runs one reserved primary model call through the provider-neutral gateway,
  records its request/response hashes and honors the frozen retention mode.
- Resumes an accepted but non-terminal execution from recorded evidence
  without contacting the provider, or terminates it (ADR-0017).
- Validates and interprets the response, then coordinates MemoryEngine,
  post-memory projection and StateEngine.
- Commits prepared evidence and canonical effects atomically through the
  aggregate repository.
- Replays committed evidence without a gateway, clock or ID generator and
  reports `match`, `different` or `unavailable`.

Its public Milestone 1 surface is `execute()` and `replayVerify()`; resume has
no separate entry point, because re-submitting the request is the resume.
It does not own domain vocabulary, multi-step workflow definitions,
repair/revision calls, execution forking or caller cancellation.

### Contract System

- Version prompt/model interfaces.
- Runtime-validate contract input and output.
- Declare required model capabilities.
- Build provider-neutral requests.
- Perform technical and semantic validation.

Contracts do not write state or persistence.

### DomainModule

- Own task definitions and contract selection.
- Project domain context into contract input.
- Interpret validated contract output.
- Own domain memory policy.
- Own state reducer and invariants.

### MemoryEngine

- Manage generic candidate and record lifecycle.
- Preserve provenance and timestamps.
- Execute domain-provided comparison and lifecycle strategies.
- Retrieve records through ports.

It does not define what a relationship, claim or comfort anchor means.

### StateEngine

- Check expected revision.
- Validate a typed domain delta.
- Apply the domain reducer immutably.
- Run domain invariants.
- Produce the next versioned snapshot and transition provenance.

It is not a universal unvalidated JSON Patch engine.

### Persistence and Ledger

- Persist executions and model calls.
- Persist documents, memory and versioned state.
- Make commit idempotent.
- Detect stale state revisions.
- Support replay after partial failure.
- Publish committed events through an outbox boundary.

## State Ownership

Core uses a generic state envelope:

```ts
interface StateSnapshot<TState> {
  entityId: string;
  namespace: string;
  schemaVersion: string;
  revision: number;
  value: TState;
  valueHash: string;
  createdAt: string;
  executionId: string;
}
```

Each domain owns and validates its `TState`.

## Trust Boundary

```text
Raw provider response
  → technical normalization
  → parsing
  → runtime schema validation
  → semantic validation
  → ContractOutput
  → DomainModule interpretation
  → ModuleResult candidates and state intent
  → MemoryEngine decisions
  → filtered task-owned state projection
  → StateEngine reducer and invariants
  → committed memory/state/events
```

No earlier stage is canonical truth.

The implemented trust path begins with an already normalized model response
and can produce validated contract output plus a deterministic parsed hash.
The MemoryEngine accepts interpreted memory candidates and prepares validated
record decisions/mutations. The implemented projection builder correlates
those decisions with candidates, excludes ignored/rejected resolutions and
hands immutable applied evidence to the task-owned hook. StateEngine accepts
the resulting typed delta and prepares a validated next-state candidate. The
in-memory and durable SQLite repositories can atomically promote those
prepared effects. Provider normalization remains a live-adapter
responsibility; the deterministic mock accepts only complete validated
normalized fixtures. The bounded ExecutionEngine orchestrates this path; live
normalization remains future work.

## Persistence Direction

- The in-memory adapter is implemented for deterministic tests.
- The SQLite adapter is implemented in WAL mode as the first durable local
  implementation.
- One aggregate repository owns the atomic Unit of Work.
- State uses complete snapshots, explicit transitions and revision
  compare-and-swap.
- Model responses are durably recorded before interpretation and canonical
  commit.
- Domain events and outbox rows commit together.
- SQLite remains the only implemented durable adapter. ADR-0029 selects
  self-hosted Supabase as the POC #1 platform with the adapter on plain
  PostgreSQL wire, and
  [ADR-0033](adr/0033-postgresql-persistence-architecture.md) decides that
  adapter's architecture: `pg` with an injected pool the adapter never owns;
  separate `acme` and `evidence` schemas under separate roles with no
  cross-schema foreign key or transaction; one `READ COMMITTED` transaction per
  Unit of Work with compare-and-swap by conditional update and row count;
  outbox leasing by `FOR UPDATE SKIP LOCKED` under the unchanged ADR-0018
  semantics; canonical JSON, timestamps and hashes stored as `text` because
  content-derived identity requires byte fidelity; the ADR-0003/0013 migration
  format with per-schema ledgers and a transaction-scoped advisory lock; and
  SQLSTATE-keyed error classification into the existing taxonomy. No adapter is
  implemented yet, and no deployment decision is made.

## Domain Proof

- NarrativeModule — implemented, including its offline acceptance scenario
- ResearchModule — implemented, including its offline acceptance scenario

Both domains use the same core, the same shared conformance suite and the same
memory, state and post-memory projection mechanics, with no domain branch in
core. Both reach committed canonical state through the same ExecutionEngine and
replay offline with matching operation digests.

The team-facing construction and verification plans are:

- [`NarrativeModule — Build and Test Plan`](design/narrative-module-build-and-test-plan.md)
- [`ResearchModule — Build and Test Plan`](design/research-module-build-and-test-plan.md)

These guides translate the approved baseline into package layouts, component
ownership, ordered build phases, decision gates and layered test matrices.
Narrative and Research phases 1–5 are both implemented, each with its own
deterministic offline acceptance scenario.
Both use ADR-0008's post-memory state-projection boundary, require ADR-0009's
explicit domain identity/evidence contracts, follow the same core path and
forbid domain branches in core or concrete adapter dependencies in a module.
Narrative additionally follows ADR-0011's exclusive knowledge ownership and
fixed source-backed context policy.

## Implemented Domain Test Surface

[`Domain Test UI — Specification`](design/domain-test-ui-specification.md)
specifies a local human workbench for configuring, launching and inspecting
**module** tests (ScenarioRunner / ExecutionEngine) and **adapter** kit runs
(existing conformance suites). ACME-0039 accepted the seven gate freezes in
ADR-0019 and delivered phases 0 and 1: the `@acme/test-ui` package boundary
and a pure read model with versioned view contracts. ACME-0040 added phase 2,
the catalog. ACME-0041 added phase 3, `acme-test-plan/1` and its compiler
(ADR-0020). ACME-0042 added phase 4, authoring, launch and history (ADR-0021).
ACME-0043 and ACME-0044 added measurement, fixture review and gated live
evaluation (ADRs 0022–0023). ACME-0045 added the loopback shell (ADR-0024),
ACME-0046 connected S2 to protected offline preview and launch, ACME-0047
rendered the existing catalog contract as S1, and ACME-0048 rendered durable
memory-decision evidence as S5. ACME-0049 rendered repository state lineage as
S6, ACME-0050 rendered read-only replay verification as S7, ACME-0051
rendered recorded-run measurement as S8, ACME-0052 rendered fixture review
as S9 and ACME-0053 rendered gated single-execute live evaluation as S10.
ACME-0067 added the pure S11 quality-evaluation view, and ACME-0069 replaced
blocking browser launch with an in-process job runner under ADR-0027.

Implemented today:

- `apps/test-ui` (`@acme/test-ui`), a leaf app. It may read public package
  entry points; it may not import a package internal, and nothing imports it.
  Both directions fail a dependency-cruiser fixture
- eleven versioned view contracts — `acme-view-execution/1` (S4),
  `acme-view-memory-decisions/1` (S5), `acme-view-state/1` (S6),
  `acme-view-replay/1` (S7), `acme-view-catalog/1` (S1),
  `acme-view-plan/1` (S2), `acme-view-runs/1` (S3),
  `acme-view-measurement/1` (S8), `acme-view-fixture-review/1` (S9),
  `acme-view-live-evaluation/1` (S10) and
  `acme-view-quality-evaluation/1` (S11, list and detail over stored quality
  evaluations; pure contract only, with no HTML page)
- pure builders from recorded evidence to those views. No I/O, no clock, no
  network, no browser; every contract is asserted as JSON
- absence as an explicit value: each optional section is `available` or
  `unavailable` with a reason code, so missing evidence never renders as zero
- disclosure rules: content is `redacted` unless a build explicitly reveals
  it, and a model payload absent under `retention: 'none'` or `'hash-only'`
  reports `not-retained` rather than looking empty by defect (ADR-0016)
- trust pipeline outcomes `passed | failed | reached | not-reached`, derived
  only from recorded attempt stages, current stage, terminal status and
  `AcmeErrorData`. Where the failing execution stage owns several substages
  and the error does not name one, every substage reports `reached`
- contract-input failures stay distinct from response validation (ADR-0010),
  read from `details.pipelineStage`
- prepared memory decision order preserved, with ignored and reject-candidate
  decisions kept visible as audit evidence and each mutation correlated to the
  decision that produced it
- replay in the engine's exact vocabulary (`match | different | unavailable`).
  "No replay was run" is a missing section, not a fourth verdict
- a catalog (S1) over the static registries plus discovered scenarios and
  fixtures: registry order preserved verbatim, full contract fingerprints,
  contract-to-task cross-links, and scenario steps checked against registered
  namespaces and tasks
- a catalog that owns no schema: scenario validity is decided by the runner's
  own `parseScenario`, injected by the caller. Without it the section is
  `unavailable`, so the interface cannot grow a competing validator
- broken things stay visible and labelled: an invalid scenario keeps the
  validator's own message, a reference that escapes the root is refused, a
  reference with no file is missing, an unreferenced fixture is an orphan, an
  unrecognized conformance kit is unknown
- no evaluator registry is invented. Core enumerates no evaluators, so the
  catalog's evaluator section is `unavailable` rather than an empty list
- bounded Node discovery on a separate entry point (`@acme/test-ui/node-source`)
  that refuses to follow symbolic links, reports depth and file bounds instead
  of truncating silently, and keeps the default surface free of I/O
- `acme-test-plan/1` (ADR-0020): a thin authoring format whose cases expand
  into `acme-scenario/1` steps. The plan is convenience; the compiled scenario
  is the reviewable unit, and scenarios stay the canonical executable artifact
- a pure, total compiler — no filesystem, network, clock or environment.
  Identical plans produce byte-identical canonical JSON, pinned by a golden
- one policy validator, the engine's own `resolveExecutionPolicy`. A plan
  cannot express a policy the engine would reject, and the compiled step
  carries the complete effective policy rather than a fragment
- refusal before emission: an unknown field, a missing seed, a duplicate case
  id or request key, a request hash that is not a lowercase SHA-256 digest,
  and any reference that escapes the scenario root all fail to compile
- `ExecutionRequest` values only when the caller supplies loaded fixtures,
  because a request needs the task input and the model selection and both are
  file contents the plan only references
- a designer (S2) that previews the compiled scenario rather than the plan,
  and reports an invalid plan instead of throwing, so an author can see where
  the mistake is
- a launch path (ADR-0021) that compiles, runs through the existing
  ScenarioRunner and records the run. Synchronous `launchPlan` remains for
  blocking callers (ADR-0021). Async workbench launch uses `enqueuePlan` /
  JobRunner (ADR-0027): in-process single-flight worker, optional cancel
- an interface-owned workspace of files — `runs/<runId>.json`,
  `jobs/<jobId>.json`, `baselines/<name>.json`, `approvals/<proposalId>.json` —
  sharing no table, file or directory with the execution ledger. Deleting it
  loses interface state and no canonical fact
- a history index derived by reading the records, so it cannot disagree with
  them, and a run identifier validated as a safe file name before any path is
  built
- a run console (S3) whose live-progress section is `available` when the host
  supplies job evidence (including an empty queue). Without job evidence it
  stays `unavailable` (`RUN_PROGRESS_UNAVAILABLE`) for pure history-only
  callers. Progress copies job snapshots; it invents no verdict
- run records that link each case to its execution id, so history reaches the
  S4 inspector and the evidence the repository already owns
- measurement (S8, ADR-0022): rates over recorded run records only —
  `runPassRate`, `stepPassRate`, `replayMatchRate` — each with `sampleSize`.
  An empty sample is `unavailable`, never a perfect rate. Threshold outcomes
  exist only where a threshold was configured; baseline comparison is
  `unavailable` without a stored baseline. Deterministic and live series are
  partitioned at the source so a live run cannot enter a deterministic number
- fixture review (S9, ADR-0022): proposals and approval records with mandatory
  non-empty approver and rationale. Approval describes a reviewable repository
  change (`applied: false`); it never writes, edits or deletes a fixture file
- live evaluation (S10, ADR-0023): `acme-view-live-evaluation/1` is a live-only
  series surface. Launch requires process opt-in (`ACME_TEST_UI_LIVE`) plus
  `acme-live-confirmation/1` (confirmer, rationale, budget). Credentials are
  read only from the environment in `@acme/test-ui/local`. Path is single
  `ExecutionRequest` via ExecutionEngine and OpenAI Responses — not multi-step
  ScenarioRunner. Usage/cost is reported when retained on the live run record
- local workbench (ADR-0024): pure HTML renderers under `src/web/` turn view
  contracts into accessible markup without recomputing verdicts. A loopback-only
  HTTP process (`startWorkbenchServer`, `workbench-main`) serves S1 catalog,
  S2 authoring, S3 history, S4 execution, S5 memory-decision, S6 state, S7
  replay, S8 measurement, S9 fixture-review and S10 live-evaluation pages. S1 reuses
  the composition's static registries, the runner's
  validator and bounded discovery under the configured scenario root; it
  accepts no browser path and keeps invalid, missing, refused, orphan and
  unavailable classifications visible. S5 loads `preparedCommit` through the
  repository's existing durable replay-evidence port, links from S4 with the
  exact execution id, preserves recorded decision order and counts, and keeps
  candidate/mutation payloads redacted with no disclosure control.
  S6 reads repository snapshot state evidence for the exact namespace/entity
  scope carried from S4, renders only `buildStateView` ordering, counts and
  continuity, and keeps state/delta payloads redacted with no disclosure or
  mutation control.
  S7 runs the existing `ExecutionEngine.replayVerify` for the exact execution
  id carried from S4, with a gateway implementation that fails if contacted.
  It renders only `buildReplayView` verdict, digest-comparison and diagnostic
  values, keeps diagnostic payloads redacted and writes no replay report or
  canonical evidence. A programmatic server caller may inject a
  `PayloadEncryptor` for retained encrypted replay; `workbench-main` acquires
  no key from arguments or environment.
  S8 reads every workspace run record, then delegates all rates, threshold
  outcomes and baseline comparisons to `buildMeasurementView`. Thresholds are
  finite `0..1` request-local inputs and are never persisted. A baseline is
  loaded only by an explicit safe name and is never promoted automatically.
  An unreadable run record refuses the complete view so no format change can
  silently shorten a sample. Deterministic and live cards remain separate;
  the route writes no artifact and calls no provider.
  S9 stages one complete proposal request-locally and checks its run/execution
  provenance against the workspace without parsing failure text or reading a
  fixture. A CSRF- and same-server-protected decision calls
  `decideFixtureChange` and records only the resulting approval artifact.
  Existing, conflicting, unreadable and concurrent proposal ids are refused,
  so browser review cannot rewrite its own history. Decided cards reconstruct
  their proposals from the approval record and remain explicitly
  `applied: false`.
  S10 reads all workspace runs through `buildLiveEvaluationView`, so mock
  records cannot enter its live-only series and unreadable records remain
  visible. Its form has no credential field and posts exactly one
  `ExecutionRequest` plus the ADR-0023 confirmation to a CSRF- and
  same-server-protected route. The route delegates to `launchLiveExecution`,
  so process opt-in, named confirmation, budget and environment-only API-key
  acquisition all remain authoritative. Unsafe, existing, unreadable and
  active run ids are refused before provider dispatch; run/approval files use
  exclusive creation and cannot be overwritten by a competing write.
  The S2 form accepts bounded YAML/JSON, requires a per-process token and
  same-server request proof, uses a process-configured scenario root, refuses
  unsafe or duplicate run ids, and enqueues via JobRunner (`enqueuePlan`) so
  the HTTP response returns before the scenario finishes (ADR-0027). Cancel is
  POST `/s3/<runId>/cancel` with the same CSRF/same-server proof. Synchronous
  `launchPlan` remains available for scripts and tests. Non-loopback hosts are
  refused. No CDN; CSS is in-package

Constraints that continue to bind later phases:

- composition-root app under `apps/`, subject to
  `apps → adapters → core` and `apps → modules → core`
- reads evidence through repository ports and runner/kit reports only
- launches runs and stores disposable interface artifacts; never commits,
  marks terminal, mutates canonical records or invents quality scores
- optional thin `acme-test-plan/1` compiles only to `acme-scenario/1` and
  `ExecutionRequest` (ADR required at first export)
- CLI remains the CI/automation entry point; the UI is local-only
- section 21 data classes, retention modes and live gating at the presentation
  boundary; no scripting, shell, credential or destructive surface
- concepts_sandbox mocks are non-authority

Multi-step live scenarios are supported via ScenarioRunner `gateway: openai`
(ACME-0064); remote hosting is not. Plans may pin `model` (ACME-0063). The plan
format's `measurements` block remains absent. S3 live-progress is available
when the workbench supplies job records (ACME-0069 / ADR-0027).

## Accepted First Product POC

[ADR-0028](adr/0028-first-poc-evidence-integrity-workbench.md) accepts the
**Evidence Integrity Workbench** as ACME's first real product POC. The
normative product boundary is
[`evidence-integrity-workbench-product-definition.md`](design/evidence-integrity-workbench-product-definition.md).
Research Synthesis is the intended POC #2 but is not active.

**Application-layer status.** [ADR-0047](adr/0047-evidence-application-model-reset.md)
replaces the Evidence *application* domain model after real-source acceptance
runs invalidated it, and freezes the delivered application
(`apps/evidence-workbench-api`, `apps/evidence-workbench-web` and their evidence
packages) as a diagnostic reference. The replacement model — `Case`, `Artifact`,
`SourcePart`, `Chain`, `ChainInstance`, `ObservationOccurrence`, `Claim`,
`Relation`, `Review`/`Standing`, `ConsensusProjection` — is normative in
[`evidence-workbench-v2-domain-specification.md`](design/evidence-workbench-v2-domain-specification.md)
and is not yet implemented. Everything described below the application layer —
engine, persistence, artifact security, authorization, case isolation and the
live model boundary — is carried forward unchanged, and no data authority
changes. Only maintenance that preserves the frozen application's diagnostic
value is permitted there; ACME-0149 is the first and so far only such change,
replacing a fixed `Maximum model calls: 1` confirmation with the planner's own
bounded call count from a read-only case-scoped `coverage-plan` route.

**Implemented V2 layer.** `@acme/module-evidence-v2` implements
`Artifact → SourcePart → CitableUnit` as `evidence-v2-source-structure/1`. The
derivation is pure, total and offline: it reads no repository, no artifact
store and no clock, consults no model, and depends only on canonical text plus
`evidence-v2-source-structure-rules/1`. Parts partition every line exactly once
and are size-bounded. Unique quote binding is an emission precondition rather
than a later validation — a unit whose text repeats inside its own line range
absorbs its predecessor until it binds, and failing that widens to its whole
line range where uniqueness holds by construction — so no consumer can spend a
provider call on a unit that cannot be located. Parts carry a deterministic
`index-or-front-matter` / `substantive` character from dot-leader density, and a
part's title is a label carrying the line it came from on a type that exposes no
date and no subject identity. `verifyEvidenceV2SourceStructure` proves coverage,
containment and binding against the original text independently of the
derivation, and `createEvidenceV2SourceIndex` gives constant-time lookup so the
structure is derived once. The package depends on nothing and a
`pnpm boundaries` rule forbids it from importing the frozen application.

The same package implements the second layer as `evidence-v2-chain/1`:
`SourcePart → Chain → ChainInstance`. Document identity and time are read from
the body's labelled fields — `Hörd person`, `Förhörsdatum`, `Förhör påbörjat`,
`Diarienr` — each with provenance to the exact line, pinned by
`evidence-v2-chain-rules/1`. The part title is never consulted, because in real
material the header line opening a part is the trailing header of the preceding
document. `proposeEvidenceV2Chains` is deterministic and offline: parts sharing
a normalized subject and case file reference form one chain, a part with no
identity that follows a document continues it, and a part with neither an
identity nor an open document is reported unassigned rather than placed. An
index or front-matter part is never placed and closes the open document.
`instanceSourceTime` is typed `exact` / `range` / `unknown` with no zone
asserted and no conversion performed. `deriveEvidenceV2ChainState` folds
append-only `assign` / `unassign` / `set-primary` decisions over the proposal:
a decision beats a proposal, two decided claims on one part without supersession
produce a named conflict rather than a silently chosen winner, and nothing is
mutated or deleted.

**Operable V2 application.** `@acme/evidence-v2-contracts` fixes the stored
records — case, artifact, structure, chain proposal, chain decision — and one
repository port. `@acme/adapter-evidence-v2-postgres` implements that port in
its own PostgreSQL schema with versioned migrations over the shared
`@acme/adapter-postgres` helpers, keeping proposed and effective memberships in
separate tables so a decision provably cannot rewrite the proposal.
`apps/evidence-workbench-v2-api` composes pool, object store, KEK ring and
repository, stores canonical text through the shared ADR-0037 envelope, derives
structure and chains exactly once inside the import transaction, and serves
bounded JSON and HTML for cases, parts, a part's exact source lines, chains, one
chain's ordered instances and appended membership decisions.
`apps/evidence-workbench-v2-web` renders those pages as plain server-rendered
HTML. A chain view reflects effective membership, so a reviewer's correction is
visible where it was made. No read path re-derives anything.

**V2 workbench shell and status surface.** ACME-0157 gave the application one
shell. `EVIDENCE_V2_SURFACES` in `@acme/evidence-v2-contracts` is the single
list of ADR-0049's surfaces and which of them this build serves; the surface
bar and the status page both read it, which is what makes it impossible for a
case to answer "there is no timeline" on one page and "the timeline is empty"
on another (R-07). `EVIDENCE_V2_SURFACE_GAPS` names, per unbuilt surface, why
it is unbuilt and which task delivers it. An unbuilt surface is a reachable
route answering 200 with that condition — never a redirect, never an error, and
never an empty list, because an empty list for an absent surface is a statement
about the case where the true statement is about the product.

`readCaseOverview` on the repository port is the status projection: two
aggregate statements over the case's stored rows, nothing stored, no structure
re-derived and no snapshot cloned (R-10). Counts come from the rows themselves
rather than from the artifact record's denormalized `partCount` and
`chainCount`, so the surface reports what is persisted rather than what an
import once claimed, and it agrees with the totals the list routes page
through. It reports counts and a resume pointer only — no chart, gauge, score,
weight or ranking (ADR-0049 §2), because a count is a fact about the workspace
and never a finding about the evidence.

Chains belong to an artifact version, so the case-scoped chains entry redirects
when the case holds exactly one source and asks which source when it holds
several. Merging two artifacts' chains into one list would produce a list
belonging to neither. Every list page states its own page bound rather than
implying it (R-08).

**V2 deployment on self-hosted Supabase.** `startFromEnvironment` in
`apps/evidence-workbench-v2-api/src/start.ts` is the operator entry point.
Configuration is environment variables and mounted secret files only: nothing is
read from the repository, and no default generates a key, because a generated
key would silently make existing encrypted objects unreadable. It refuses a
connection string pointing at Supavisor's transaction pooler on port 6543 before
the first migration runs — ACME commits at an expected revision with
compare-and-swap and holds one connection across a transaction's statements,
which transaction pooling cannot provide — and it names the reason rather than
failing later under contention. The live model capability is opt-in and
conjunctive: no model and no key means no extractor, and the extraction route
answers 501 rather than degrading. Configuring the capability also migrates the
ledger schema; it spends nothing by itself. The startup summary is content-free
by construction, naming schemas, port, bucket and model and never a credential,
a case or a source line.

Two substrate rules are properties of the platform rather than of this code, and
both are recorded in [the runbook](ops/evidence-v2-supabase.md). The object-store
endpoint host must be spelled exactly as `STORAGE_PUBLIC_URL` spells it, because
Supabase Storage rebuilds the canonical `Host` header from that setting instead
of from the header it received; the shared S3 adapter needed no change. And
bucket provisioning is an operator script
(`tooling/supabase/provision-v2-bucket.mjs`), not a startup side effect: the
object-store port creates objects, never containers, so a running product cannot
invent storage it was not given. The script is idempotent and refuses a public
bucket.

**V2 authentication and authorization.** ACME-0153 wired the shared identity
machinery in without adding a model. `@acme/adapter-evidence-auth-postgres`
persists principals, organization and case memberships and sessions in their own
schema; `createEvidenceSessionService` issues the session cookie, the CSRF token
and the encrypted upstream session; `authorizeEvidenceCaseAction` decides every
case-scoped read and write. Sign-in, sign-out and session read are the only
unauthenticated routes besides `/health`. Case creation registers the identity
case and an owning `case-admin` membership in the same operation, and the case
list is scoped to the principal's memberships. A principal without membership
receives 404 rather than 403 on every case-scoped route, so a case's existence
is not disclosed (ADR-0036). Credentials come from a development authenticator;
a real upstream identity provider is unwired.

**V2 observation.** ACME-0154 added the first V2 export,
`evidence-v2-observe/1` ([ADR-0048](adr/0048-evidence-v2-observe-contract.md)).
One execution observes one **window** — an ordered set of at most 24 citable
units, at most 800 quoted words, drawn from one source part of one chain
instance, with no prior instance, no other actor's statement and no neighbour
context. For each unit it judges evidential the model returns a unit id, a kind
and the time span the unit itself states — constrained on the wire to a calendar
value, because a live run returned the word `då` for one and the product typed it
into a bound. The product derives the typed temporal bound from that span, and
the occurrence's **quote and locator come from the cited unit**, never from the
response, so model prose cannot become the record (ADR-0043's principle restated
for units already proven uniquely bindable).
Coverage is derived from stored rows rather than demanded of the model, and an
empty response is valid.

`createEvidenceV2Extractor` in `apps/evidence-workbench-v2-api` composes
`@acme/core`'s `createExecutionEngine` unchanged with `evidenceV2Module`. It
plans the windows, states the exact bounded call count before spending anything,
executes one engine call per outstanding window keyed by a content-derived
request key, and persists each window's occurrences **in the same step that
commits it**. A failed window fails alone: it is recorded with its failure code,
the run stops there, and everything already committed stays committed and
visible. Re-running executes only windows with no committed execution, so a paid
window is never paid for twice. An emergency ceiling guards a runaway only; it is
not the user-facing bound. Retained request and response payloads are encrypted
under a key of their own, separate from the session key, and ephemeral when the
deployment supplies none.

An occurrence is canonical evidence under the authority ladder, not accepted
evidence: review and standing do not exist yet, and neither do claims, relations
or consensus projection.

The recorded live run that first measured those engine properties — planned 2,
spent 2, re-run 0, 27 occurrences, payloads encrypted under a ledger key
separate from the session key — is packaged as
[the POC #1 reusable-execution proof](acceptance/poc-1-reusable-execution-proof.md).
That document is a scoped execution-reuse claim, not V1 acceptance and not the
close of ADR-0047 §9.

The POC is a corpus-bound, non-adjudicative review product. It canonically
records source-bound observations and explicit domain decisions, not real-
world or legal truth. Its authority ladder separates immutable source artifact
versions, statement/exhibit observations, proposition and identity candidates,
typed evidence relations, versioned human-reviewed assessments and excluded
credibility/guilt/legal conclusions.

V1 is constrained to a purpose-built synthetic text corpus. Every accepted
quoted observation must resolve to an exact artifact version and valid locator;
changed accounts remain distinct; supersession is limited to explicit
correction lineage; uncertain time remains typed; relations retain all
endpoints; and new evidence makes earlier assessments due for attention without
modifying history. The model remains a candidate generator behind the existing trust
pipeline. Human acceptance makes an assessment shareable within the POC, not
legally true.

The target product layering is:

```text
Evidence Integrity web / API / worker
  → PostgreSQL, object-storage and model adapters
  → Evidence domain module and pure policies
  → @acme/core
```

The accepted baseline is React/Vite, Fastify, a separate Node worker, the
existing OpenAI Responses adapter, self-hosted Supabase PostgreSQL through a
new plain-wire conformant adapter and S3-compatible object storage. This is a
design constraint for later implementation, not delivered behavior. Identity,
hosting, ingestion formats, the PostgreSQL schema and adoption of any other
Supabase component remain deferred.

### Accepted Evidence technical plan

[`evidence-integrity-workbench-technical-specification.md`](design/evidence-integrity-workbench-technical-specification.md)
is the normative implementation plan. ADR-0030 fixes the V1 Evidence identity
algorithms, correction-versus-changed-account semantics, compact state and
document/memory placement. ADR-0031 fixes the application-owned append-only
review overlay, versioned primary versus secondary views, deterministic
new-evidence attention rule and Primary Product Rule. ADR-0032 fixes the
conservative V1 correction-occurrence pairing shared by state projection and
account views.

The V1 proof corpus is exactly seven logical synthetic text artifacts in eight
immutable versions: one prompt-scratch transcript, an open development
transcript/exhibit pair and a sealed evaluation core of four logical artifacts
in five versions. The sealed truth requires ten observations, eight scoped
relations, three open questions and two assessment versions. Canonicalization
is UTF-8, LF and NFC; locators are one-based inclusive line ranges. Active
observation candidates must quote one passage that occurs exactly once in the
artifact, and runtime derives its range. Historical output `/1` retains its
model-authored range validation for replay.

ACME-0077 delivered the Evidence contract/corpus foundation, ACME-0078
delivered the first executable reviewer slice, ACME-0079 delivered account
comparison and ACME-0080 delivered relation analysis. `@acme/module-evidence`,
namespace `evidence`, exports strict V1 schemas, canonical
source/locator/actor/observation/meaning/relation/question/assessment
identities, source binding, compact state/delta contracts, a pure reducer,
invariants and a domain memory policy. Its registered
`evidence.observe-artifact@1.11.0` task projects one immutable source plus an
explicit actor roster and one coverage window, uses strict structured output
and refuses invalid quote, kind, actor, temporal, prohibited-authority and
incomplete-coverage-ledger candidates before commit. An empty actor roster
requires a null actor reference; unresolved candidates are legal only when
the roster yields identities. Historical `@1.0.0`–`@1.10.0` remain registered
for replay. Active input `/3` requires a unique extractable
`coverageWindow` of at most 64 source segment ids, a `sourceStructureId`
pin, and optional neighbour `contextSegmentIds`. The provider sees
extractable segments plus context-only neighbours; an observation may not
name a context id. Output `/6` accepts line or block segment ids and
keeps `segmentCoverage`. A segment may yield zero or many atomic
observations. Coverage is the ledger, not the observation count. The
structural planner splits oversized paragraphs at sentence boundaries
toward 150–350 words (soft 600, never a sentence or Q+A pair), emits
one segment per sentence inside paragraph and Q+A-answer blocks, and
packs those segments toward 800 words (hard cap 64). It may attach
one previous and one next neighbour as context. Line-segment windows
stay 64.
`@1.9.0` admits up to 128 observations so one window can hold more than
one proposition per segment. Historical input `/2` and output `/5` stay
byte-exact on `@1.8.0`–`@1.10.0`. Output `evidence-observe-artifact-output/2` gives the
model no line fields: exact quotes must occur exactly once in canonical
source text, then runtime derives the inclusive line range before
locator/observation identity and projection. Output `/3` additionally
requires a quote from one canonical source line, at most 500 characters; its
prompt requires temporal `unknown` when a complete date and clock are not
both visible in that quote. Active output `/4` removes provider-authored
quote text entirely. Runtime supplies deterministic non-empty single-line
segments of at most 500 Unicode code points; the provider selects
`sourceSegmentId`, then runtime derives the full quote and one-line locator.
Unknown segment IDs refuse without fuzzy matching. Historical `@1.0.0`–
`@1.8.0` outputs `/1`–`/4` remain registered unchanged for replay.
Applied observation identities and their source document advance Evidence
revision once; exact duplicates advance nothing. Active registered
`evidence.relate-observations@1.1.0` accepts current observations, proposes
scoped relations and open questions, and contests only statement endpoints that
scoped `contradicts` relations require. Its prompt requires unique
lexicographically sorted set-like identifier/rationale arrays and distinct
relation endpoints sorted by kind then id. Historical `@1.0.0` remains
registered byte-exact for replay. When `policy.maxRepairCalls` is positive and
the contract offers `buildRepairRequest`, a recoverably invalid response is
repaired as its own recorded model call (`purpose: repair`, call key
`repair:N`) before the execution fails. Repair never fires on the ADR-0017
resume path and never weakens schema or semantic validation.

For an explicit adjacent `transcription-correction`, the observation task now
pairs complete predecessor/successor occurrence sets through the ADR-0032 V1
key: observation kind, exact line range, source actor label/role and temporal
kind/role. The quote, resolved actor identity and clock value may change. A
pair must be unique and complete; ambiguity, missing occurrences or a
different logical artifact is refused. The predecessor becomes `superseded`
only when its successor becomes `current` in the same Evidence revision. This
is the mechanical correction boundary, not the general relation task.

`@acme/evidence-testing` owns the synthetic corpus, manifest and open truth
loaders, deterministic golden builder, `DEV-T01` mock response/request hash,
five fixed sealed-source candidate responses/request hashes, product/view
conformance registrars and the explicit `./evaluation` entry point for sealed
truth. Candidate fixtures live on `./evaluation-candidates` and import no
truth. The offline scenario executes and validates all candidates before it
dynamically opens the truth entry point. Prompt-capable module/application
source is forbidden from importing sealed truth. Model output remains
candidate evidence; general relations, timeline and assessment stay separate
later task boundaries.

Slice 1 also adds `@acme/evidence-product-contracts`, a file-backed product
adapter and `@acme/evidence-views`. Source/job/review records are separate from
the ACME ledger. Review decisions are append-only and exact-version bound;
identical command-key reuse is idempotent and divergent reuse is refused. The
pure work-queue and source-review builders return detached, deterministically
sorted primary views with stable line citations. A minimal loopback
API/web/worker composition imports the open development source, exposes job
polling/SSE and review commands, and defaults technical audit to disabled.
The local shell is dependency-free Node/HTML; the accepted React/Vite/Fastify
baseline remains for the later hosted shell.

Slice 2 adds the pure observation-ledger and account-comparison builders plus
product routes and browser navigation. The full five-version evaluation seed
produces ten immutable observations: eight remain `current` and the two
`EVAL-T01` v1 occurrences become `superseded`. The view shows those paired
corrections beside the separately retained `EVAL-T02` account and links every
prior source version. Technical audit remains disabled, and annotation truth
ids never enter product responses.

Primary reviewer contracts cover work queue, source review, observation
ledger, account comparison, relations, timeline, open questions, assessment
and review history. Technical provenance and replay are secondary and may be
disabled completely. Human decisions bind exact immutable versions and live in
a separate product repository; approval never mutates Evidence records or an
operation digest.

Implementation is divided into separately activatable slices 0–9. Slices 0–8
are delivered. ACME-0087 completed Slice 5's assessment/review-history views,
immutable product change sets, one
batched late-evidence attention notice, bounded assessment execution, exact
source-locator browser navigation and deterministic synthetic-only reviewed
ZIP. ACME-0089 re-sealed E-A01 with no open-question references because every
sealed question has at least one EVAL-E01-dependent trigger; E-A02 retains all
three questions after that late import. The fixed journey is therefore
source-bound without changing its import order.
The later product/security sequence is recorded
in
[`evidence-integrity-workbench-product-completion-plan.md`](design/evidence-integrity-workbench-product-completion-plan.md).
ADR-0040 accepts the first bounded Slice 9 class and live-profile applicability
boundary. ACME-0105 implements the closed capability and ACME-0106 implements
capability-gated Stage A text import. ACME-0107 implements one bounded live
`observe-artifact` product job and ACME-0108 implements one bounded live
`relate-observations` product job over server-derived current observations;
ACME-0110 implements source-complete live `propose-assessment`, human review
and late-evidence reassessment. The offline/default profile remains
synthetic-only.
SQLite and the file product store remain the local/hermetic CI defaults;
PostgreSQL is opt-in via composition (`--adapter postgres` /
`ACME_PERSISTENCE=postgres`) and `pnpm test:postgres`.

The reviewed ZIP is deterministic over the assessment, effective review
decisions, current newer-evidence notice and cited source bytes. It stores
canonical JSON, NFC/LF Markdown, immutable review history and only cited text
source versions in lexicographic uncompressed ZIP order with fixed metadata
and a bundle SHA-256. Repeated exports from identical inputs are byte-identical;
an attention delta or later review decision is intentionally reflected in a
new export while the assessment artifact itself remains immutable.

ADR-0035's identity and authorization architecture is implemented. Hosted
credentials are verified by self-hosted Supabase Auth behind the product API.
Browser JavaScript receives only an opaque
HttpOnly BFF-session cookie; upstream access/refresh tokens remain protected
server-side. Stable principals derive from verified issuer/subject claims.
Product-owned organizations, active memberships and workspace bindings feed a
pure deny-by-default viewer/reviewer/organization-admin action policy. The API,
not a browser payload, supplies actor identity and authorization context to
versioned `/2` review commands and decisions. Historical `unauthenticated-local`
review decisions remain immutable and explicitly labelled. Case-role isolation
is implemented by ADR-0036, and ADR-0037/ACME-0095 implements content-free
product audit plus secure artifacts. ACME-0106 admits only ADR-0040's Stage A
class; every arbitrary and later non-synthetic class remains closed.

ADR-0036's case boundary is implemented. The product-visible `caseId` owns a
unique internal workspace; explicit active case membership supplies
case-viewer, case-reviewer or case-admin content authority. Organization-admin
does not implicitly read evidence. Every product object receives append-only
case ownership and repository, worker, citation, job and export traversal must
begin from case scope rather than a global identifier. Existing synthetic
objects migrate into one explicit legacy case, and orphaned, duplicate or
mixed-case ownership fails closed. Case lifecycle and participant mutations
use optimistic case revisions; membership and revision advance atomically.
API, browser, worker and repository traversal are case-first, and adversarial
same-organization tests cover every current route family. This does not change
the `synthetic-only` data policy.

ADR-0037 decides the secure artifact boundary. Product metadata owns immutable
original, canonical-text and later derivative representations; encrypted bytes
sit behind filesystem and hosted S3-compatible adapters. Each object uses a
random DEK with AES-256-GCM and a versioned externally supplied KEK. Database/
object writes use staging, verification and case-scoped reconciliation rather
than pretending to share a transaction. Artifact reads fail closed on missing
keys, digest/tag mismatch or unavailable product security audit. Deletion
retains provenance/audit tombstones, and restore requires database, objects and
the separate key catalogue. ACME-0095 implements this boundary: product JSON
or PostgreSQL stores only placeholders and immutable metadata, object adapters
share an exclusive-create/bounded-read conformance contract, startup
reconciles staging and active digests, authenticated API reads append audit
before releasing verified plaintext, and case-admin re-wrap/deletion remain
revisioned and auditable. Hosted composition requires mounted key and S3
secrets. It does not authorize arbitrary or non-synthetic ingestion.

ADR-0038 is implemented by ACME-0097 for one synthetic-only class, and
ACME-0106 reuses its strict text mechanics for ADR-0040's separately authorized
Stage A class. The API
bounds the JSON request before parsing, validates strict UTF-8/media/signature/
control/line/size rules and derives a deterministic server-side logical id.
The artifact service stages separately encrypted exact-original and LF/NFC
canonical representations under different command/object identities. A
durable `EvidenceTextImportRecord/1` binds command digest, attestation,
principal, both hashes and both representations; exact resubmission resumes
or returns the same result, while changed inputs collide. File repositories
serialize transitions and PostgreSQL migration v5 adds import/draft/log
tables; ordinal activation rejects competing logical-artifact versions.

Redaction drafts and logs are product records. Operations are ordered UTF-8
byte intervals, verify removed-byte hashes, cannot overlap or span LF, and use
fixed replacement tokens. Applying a frozen draft creates a separately
encrypted `redacted-text` representation and a new
`SourceArtifactVersion` with `redaction-derivative` lineage. Existing locators,
observations, reviews and assessments remain bound to the predecessor. The
browser exposes case-first import, source navigation, draft and admin apply;
security audit never stores input or removed text.

ACME-0106 adds the Stage A branches without changing the `/1` synthetic
contracts. `evidence-create-case-command/2` chooses exactly `synthetic-only` or
`stage-a-authorized-judicial-text`; `evidence-text-import-metadata/2` and
`evidence-text-import-record/2` bind the Stage A data class, three affirmative
attestations and `evidence-external-source-provenance/1`. Provenance records an
outside PDF's digest/byte length plus `pypdf-text-extraction` version and page
count; ACME stores only the prepared strict UTF-8 bytes. Case policy and import
class must match. `source.import` belongs only to case-admin, and API/browser
Stage A controls exist only when the ACME-0105 capability was constructed.
File and PostgreSQL repositories parse/persist both record versions unchanged.

Stage 7 adds two pure read models over one authorized case snapshot.
`evidence-case-overview/1` reports entry counts — sources, observations and
relations without an effective review decision, open questions and assessments
needing re-review — plus at most twenty most-recent product activity records.
`evidence-case-integrity-report/1` reports traceable rows for changed accounts,
corrections, contradictions, temporal conflicts, qualifications, unresolved
questions and assessments due for attention. Every row carries at least one
citation naming the observation, artifact version, locator and exact quote
behind it; a row whose evidence cannot be resolved inside the case snapshot is
omitted rather than shown uncited.

Row classification uses typed canonical evidence only. A `correction` relation
stays a correction because ADR-0032 pairing already binds it to one logical
artifact lineage. A relation is a changed account when its endpoint
observations share a *resolved* actor key across *different* logical artifacts,
which keeps a later account separate from a correction and never merges an
unresolved actor. A `contradicts` relation is temporal when its comparable
scope's typed bounds cannot both stand — two known bounds do not overlap under
`evidence-temporal-overlap-1`, or a recorded `document-time` is set against a
`claimed-event-time`. Model-authored rationale text classifies nothing, so a
candidate generator cannot steer the report's categories. Relation kinds
outside that set (`supports`, `duplicate`, `scope-mismatch`, `unresolved`)
produce no row.

Both read models share one order-insensitive `snapshotDigest` over the case
evidence and review overlay, so the same case content yields the same basis
regardless of repository ordering, and volatile job, staging and audit material
never changes it. `reportId` derives from the renderer version, that basis and
the ordered rows. Rows sort by kind then row id, and each row id derives from
its kind and its relation, question or assessment identity. `/api/overview` and
`/api/integrity-report` require `workspace.read` on the requested case; a
same-organization foreign case is refused as `404 Not found.` These projections
never mutate canonical evidence or the review overlay, add no persistence and
give no non-synthetic authority.

Stage 8 turns a reviewed assessment into distributable output.
`evidence-assessment-output/1` is one resolved document: every claim's support,
conflict and qualification reference is resolved through the assessment's own
citation list to exactly one observation at that artifact version and locator,
carrying its exact quote. A reference that cannot be resolved that way refuses
the whole document rather than rendering an uncited claim, and an unreviewed or
non-`synthetic-only` assessment is refused outright.

Four renderers read that one document, so the formats cannot drift apart: JSON
(canonical), Markdown, DOCX and PDF. DOCX is OOXML inside the same
deterministic stored-entry ZIP writer that backs the reviewed bundle, with no
document-properties part so no creation timestamp reaches the bytes. PDF is a
minimal PDF 1.4 writer using the base-14 Courier faces — nothing is embedded,
line breaking is exact integer arithmetic, and there is no `/Info`,
`/CreationDate` or `/ModDate`. Repeating an export therefore produces
byte-identical output in every format, and each format has its own digest.

Export is governed by `evidence-export-policy/1`, a case-owned record with an
`enabled` flag, a format allowlist and an optimistic revision. A case without a
stored policy resolves to `EVIDENCE_DEFAULT_EXPORT_POLICY`, an explicit named
constant rather than an implicit allow, and a case admin may narrow or disable
it. The check is deny-oriented: bytes are released only when the effective
policy both enables export and names the exact requested format.

Every release and every refusal appends one `evidence-export-audit-record/1`
naming format, outcome, reason code, output digest and byte length, the
server-derived principal and the time. Identity is generated per event, not
derived from content: two downloads of identical bytes are two release events
and both appear in the trail. A refusal releases no bytes and still records
why. `/api/cases/:caseId/assessments/:id/output/:format`,
`/api/cases/:caseId/export-policy` and `/api/cases/:caseId/export-audit` are
case-first; a same-organization foreign case stays `404 Not found.`

`evidence-product-backup-manifest/1` mirrors the artifact-level backup pair from
ADR-0037 at the product layer. It lists a content digest per durable record and
no source text, quote or rationale. Restore verification fails closed: a missing
record, an altered record, a record the manifest never listed, or a manifest
whose own digest does not match all refuse. File and PostgreSQL adapters persist
both new record kinds under migration v7 with shared conformance. This adds no
data authority; every output remains synthetic-only.

ADR-0039 decides the workbench live model boundary. ACME-0105 implements its
confirmation/composition foundation while the default execution engine remains
the scripted mock. ACME-0106 consumes capability presence for Stage A import,
ACME-0107 adds the provider-capable `observe-artifact` product route, and
ACME-0108 adds `relate-observations` without widening the capability. ACME-0110
adds the final existing task, `propose-assessment`, under the same boundary.
ADR-0040 adds the product applicability boundary and accepts exactly one Stage
A data class, `stage-a-anonymized-judicial-text/1`. The class is real judicial
source text, already anonymized/redacted before import, operator-authorized for
the POC and live-provider transmission, and bounded by ADR-0038's strict UTF-8
text mechanics. It is distinct from fixture origin and requires external-source
provenance. Operator-prepared text may name an outside PDF container and
extraction method in provenance, but the product does not ingest that PDF.
Stage B FUP material, arbitrary ingestion and PDF/DOCX/OCR/media remain
unauthorized.

The versioned `evidence-poc1-live/1` composition is conjunctive and fail closed:
it must prove `durable-postgresql` persistence, `live-provider` gateway,
`authorized-external` source origin and authenticated/configured
`authorized-live` execution. Ambient credentials, deployment labels or any
mixed mock/in-memory/fixture tuple cannot activate it. The existing
synthetic/test profile, sealed corpus and deterministic mocks remain the
offline default.

`@acme/live-safety` owns the provider-neutral recursive credential-field scan,
explicit opt-in parsing, environment credential resolution and nested
run/confirmation/deployment budget checks; the Domain Test UI reuses these
primitives without changing its ADR-0023 confirmation. Evidence adds its own
strict `evidence-live-confirmation/1` with case id and no actor. Only
`case-admin` owns `live-model.run`; organization roles and other case roles do
not.

Hosted startup may create an `EvidenceLiveCapability` only when the profile,
PostgreSQL persistence, hosted mode, provider configuration, deployment
ceilings and base64-mounted 32-byte payload key all validate. The PostgreSQL
execution repository then uses that durable key rather than the ephemeral
local-session key. The capability closes over the provider credential but does
not construct/release its OpenAI gateway until an operation supplies the exact
case authorization, matching confirmation and authorized Stage A source. No
call occurs at startup. ACME-0106 uses capability presence only to admit Stage
A case creation and source import. ACME-0107's case-first observation route
resolves authenticated authorization, the activated `/2` import and immutable
source in one case before the capability releases its gateway. The browser
supplies only source identity, actor roster and non-secret confirmation/budget;
source text, workspace and principal are server-derived.

ACME-0108's `evidence-case-live-relation-command/1` becomes the internal
`evidence-live-relation-command/1`. `evidence-product-job/3` records the
four-unit relation lifecycle, exact sorted observation identities and the
literal one-call ceiling. The API selects only current observations from the
authorized case snapshot, verifies each against an activated Stage A import
and supplies no browser-originated evidence to the engine. After the durable
engine commits, one repository transaction stores typed relations, open
questions, scoped standing changes, case bindings and exactly one evidence-
revision advance. File mutation and PostgreSQL transaction validation both
fail before publishing a partial projection.

`evidence-case-live-observation-command/1` becomes the internal
`evidence-live-observation-command/1`. The live observation job reports
window *i* of *n* and accumulated model calls; `actualModelCalls` is
unbounded across the campaign because coverage is many executions, not one
call. The worker hydrates canonical text through the audited artifact
service, plans structural coverage windows toward 800 words (cap 64 segments),
and executes `evidence.observe-artifact@1.11.0`
once per window under `live-observe:{commandKey}:wNNNNN`. A committed window
replays from that request key. Product observations plus one
evidence-revision advance are written only after the last window commits.
Historical `@1.0.0`–`@1.9.0` prompts/output remain registered for replay.
ADR-0041 sized the first bounded batch; ADR-0045 §6 makes coverage a
workflow over those windows. A successful window is not evidence of
document-complete coverage. ADR-0042 removes model-authored line fields from
active output `/2`; runtime accepts only a globally unique verbatim quote and
derives its canonical line locator before the engine may commit.
ADR-0043 removes exact-quote authorship from active output `/4`; runtime-defined
segment identity now supplies both immutable quote text and locator.

Provider responses use `encrypted-payload` retention. If product projection is
interrupted after provider success, relaunching the same command uses the
original execution request revision and retained response, so the engine
finishes without another transport call. Live audit `/2` records started,
completed, failed and refused outcomes with model/call/budget metadata but no
source, quote, prompt, response, rationale or credential. A source unavailable
inside the requested case returns non-disclosing 404; malformed credentials,
authorization and excess budget refuse before transport.

The relation job applies the same recovery rule. A post-engine/pre-product
fault leaves relation, question and product revision state untouched; exact
command replay reads the committed encrypted provider evidence, projects the
same content-derived identities and finishes with one cumulative call. Live
relation audit `/3` remains content-free. Its browser control appears only
when the live capability exists and at least two current observations are
available, then returns to the existing relation/open-question views; timeline
continues to be the pure temporal projection of source-bound observations.

ACME-0110 retains historical `evidence.propose-assessment@1.0.0` and its
identifier-only synthetic input for replay. Active `@1.2.0` retains `@1.1.0`'s
additive source-complete `evidence-propose-assessment-input/2` and adds only the
explicit sorted-set prompt rule; both earlier versions remain replayable. The live API
derives accepted current observations and relations, open questions, sequence,
predecessor and basis revision from one authorized case. Typed observation
objects carry exact artifact/locator/quote evidence into the provider request;
the browser supplies none of it. `evidence-product-job/4` and security audit
`/4` remain content-free. Assessment projection stores one immutable candidate
and case binding without changing product evidence revision, after which the
existing append-only review and attention views govern human authority.

Stage A import already advances product evidence revision for the new source.
The live observation projection therefore verifies that the engine's source
revision equals the product revision instead of incrementing the same source a
second time. Relation analysis advances both once. This keeps assessment
`basisEvidenceRevision` current across engine and product stores; a later Stage
A import/observation advances them together and makes the predecessor visibly
due for attention before a reviewed successor is proposed.

Four independent keys are required before a provider is contacted: deployment
opt-in from the environment, a valid `evidence-live-confirmation/1` whose
`caseId` equals the requested case, an environment-supplied credential, and a
principal holding the new deny-by-default `live-model.run` action on that case.
The confirmation is a cost and intent gate and never an access gate; it carries
no actor field, because the effective principal stays server-derived under
ADR-0035, and its case binding keeps a live authorization inside the ADR-0036
boundary. Credentials never appear in a payload, confirmation, job record,
audit record or error.

Cost is bounded twice: a run ceiling declared in the confirmation, and a
deployment ceiling in configuration that no route may raise. Retry, repair and
revision calls all count. Exhaustion terminates the run, and because execution
events stay candidates until the state transaction commits, a terminated run
leaves no canonical evidence and no revision increment. Product live executions
use ADR-0016 `encrypted-payload` retention so replay verification and ADR-0017
resume survive going live; a hosted deployment must therefore supply a durable
payload key. ADR-0040 fixes encrypted-payload retention for the Stage A live
profile so provider evidence can resume without a duplicate call.
All three evidence tasks may run live, because the trust pipeline is
gateway-independent — model output is an untrusted candidate whichever gateway
produced it. Live events extend the content-free security-audit vocabulary, and
every refusal is audited even when no call was made.

ADR-0040 preserves the permanent product rules across both profiles: immutable
source/version/locator provenance, candidate-not-truth semantics, append-only
human decisions, typed relations and temporal uncertainty, case isolation,
source-complete persistent assessments and visible attention after new
evidence. A primary browser path rather than technical audit, CLI, JSON or
database access is the completion surface. The live profile is not complete
until an explicitly budgeted real Stage A provider acceptance is proven end to
end. ACME-0111's first call proved fail-closed handling of an incomplete
2,048-token historical contract response; ADR-0041/ACME-0112 supply the bounded
successor. ACME-0113 proved that successor returns complete strict JSON, but it
also exposed that model-authored line numbers are not canonical locators: all
six verbatim quotes carried offset line ranges and semantic validation refused
the entire batch with no commit. A later contract/runtime decision must derive
locators deterministically from uniquely occurring exact quotes before a fresh
acceptance. ADR-0042/ACME-0114 implement that active `@1.3.0` boundary while
preserving historical replay. ACME-0115 then produced complete strict JSON but
failed closed before semantics: one range used time-only strings instead of
full UTC timestamps, and content-free inspection showed two long multi-line
quotes had normalized whitespace rather than exact source form. A new additive
contract must bound quotes to a short single canonical line and withhold
normalized temporal values unless their full date and clock are source-visible.
ACME-0116 implements active `@1.4.0` output `/3` with those wire/prompt bounds
while retaining historical replay. ACME-0117's sole fresh call returned eight
complete strict candidates and no invalid temporal normalization, but five
one-line strings were not verbatim canonical source substrings. Four compressed
content across line boundaries with whitespace and/or punctuation changes; one
also changed alphanumeric content. Exact runtime validation refused the batch
with no commit. ADR-0043/ACME-0118 implement the additive successor as active
`@1.5.0` output `/4`: provider output selects one runtime-defined bounded
segment identifier; runtime copies its complete exact text and derives its
single-line locator. Unknown selectors refuse, and all historical request/
output contracts remain exact. Another acceptance remains.
ACME-0119 proved all eight provider-selected segment IDs existed and were
unique, but strict validation refused one exact temporal value expressed at
local minute precision without seconds or `Z`. A prompt-version successor must
name the canonical UTC grammar explicitly and require `unknown` otherwise.
ACME-0120 implements active `@1.6.0` with literal seconds/terminal-`Z` grammar
and an explicit local/minute-only/numeric-offset prohibition. Output `/4` and
runtime segment authority are unchanged; historical `@1.5.0` remains exact.
ACME-0121's sole active `@1.6.0` call returned eight valid unique segment
selections, passed strict and semantic validation and committed one document
and eight runtime-derived observations. The new-job worker reason is
`LIVE_OBSERVATION_COMPLETED`; an obsolete post-commit live-test expectation
made the Vitest process false only after persistence succeeded. ACME-0122
corrects that assertion and pins the same worker contract in the offline
PostgreSQL journey without changing runtime behavior. This proves bounded
observation interoperability/source binding, not exhaustive coverage or later
relation/assessment provider acceptance.
ACME-0123 supplies the separate opt-in acceptance surface for those remaining
Stage A product outcomes. It uses only authenticated case-first routes over
PostgreSQL/private S3 and two exact external source inputs. Six executions are
individually capped at one call: initial observation/relation/assessment,
restart, later observation/relation/reassessment, then final restart. Domain
assertions cover all three reviewer standings, relations/questions, citation-
complete reviewed assessments, stale immutable history and a reviewed
successor; the technical-audit route must remain unavailable. The harness is
not authority to run live and has passed only offline verification so far.
ACME-0124's first D1 observation job passed and committed eight observations,
then the harness failed before review because it used the domain record field
`observationId` against the primary source view contract, which deliberately
exposes `observationVersionId`. The API refused the undefined review target;
no relation or assessment call occurred. This is an acceptance-harness defect,
not a product persistence/provider defect, and requires an offline correction
before a separately frozen new run.
ACME-0125 removes that harness ambiguity by importing the public source-review
view type directly and using its version identity. Product/view behavior is
unchanged; canonical offline verification is green and another live run still
requires separate authority.
ACME-0126 proves the typed review path and all three reviewer standings against
real D1 observations, then exposes a relation wire dependency: output `/1`
models set-like ID arrays as sorted unique strings, but relation prompt
`@1.0.0` does not instruct lexical sorting. The provider returned two unique
but unsorted open-question trigger arrays; strict validation refused them
before product projection. Version the prompt while preserving `@1.0.0`
request/replay identity; runtime must not silently reorder unvalidated output.
ACME-0127 implements that replay-compatible boundary. Active relation contract
`@1.1.0` states every output `/1` set/endpoint ordering rule, while historical
`@1.0.0` retains its exact prompt and request hash. Registry, composition,
fixtures and replay resolve both versions; canonical offline verification is
green and no provider call occurred.
ACME-0128 applies the same fail-closed lesson to assessment before another paid
journey. Active `evidence.propose-assessment@1.2.0` states the sorted/unique rule
for every strict set-like output `/1` string-ID array. Historical `@1.0.0` and
`@1.1.0` preserve their exact prompts, schema names and request hashes;
registry/composition resolve all three and runtime coercion remains forbidden.
ACME-0107,
ACME-0108 and
ACME-0110 prove observation, relation and
assessment PostgreSQL restart/no-second-call boundaries with injected
transports; ACME-0110 also proves primary review and late-evidence reassessment.

## Remaining Implementation Baseline

- Node.js 24 LTS, pnpm 10, strict ESM TypeScript 6 and Zod 4.
- Core, testing, in-memory, SQLite, PostgreSQL, model adapters and reference
  modules are separate workspace packages.
- `ExecutionEngine` executes one task; `ScenarioRunner` sequences tasks.
- Retry, repair and revision are bounded and ledgered.
- Replay uses recorded model results and never invokes a live provider.
  Live `hash-only` executions report `unavailable` rather than failing replay.
  Live `encrypted-payload` executions can replay when the repository has a
  working `PayloadEncryptor`.
- Structured logs redact content by default.
- An interrupted execution resumes from recorded evidence without a second
  provider call (ADR-0017).
- Committed events leave the outbox through an explicit drain (ADR-0018);
  nothing drains on its own.
- The Domain Test UI read model projects recorded evidence and, for S8 only,
  aggregates rates against configured thresholds (ADR-0019, ADR-0022). Live
  evaluation is gated (ADR-0023). A loopback workbench renders S1–S10 HTML
  from those contracts, launches bounded offline plans and permits one live
  `ExecutionRequest` only through ADR-0023's process + confirmation + budget
  gate (ADR-0024). It invents no quality score, writes no golden fixture and
  accepts no browser credential. It is a leaf; deleting it loses no canonical
  fact.
- ScenarioRunner multi-step live is available (`gateway: openai`); single-execute
  live remains via CLI and test-ui `launchLiveExecution` (S10).
- Residual gaps (trust-stage evidence and related items) are inventoried with
  work packages and activation order in
  [`docs/design/gap-resolution-plan.md`](design/gap-resolution-plan.md)
  (ACME-0056). WP-D through WP-Q (including quality CLI, S11 view and live
  judge) are delivered as ACME-0057–0068, and WP-T's T1 async launch (G08) is
  closed by ACME-0069. Open: G12 trust-stage evidence (WP-E), the WP-T
  residuals T2/T3/T4, and the deferred WP-P, WP-K and WP-X items.

## Deliberately Deferred Decisions

- production hosting, managed providers and final production database
- dynamic module discovery
- workflow runtime beyond ScenarioRunner
- vector retrieval
- provider-specific reconciliation details
- encryption key lifecycle (KMS, rotation) and privacy deletion

These require evidence and ADRs before implementation. See also the accept /
defer dispositions in the gap-resolution plan.

ACME-0073's
[`first-poc-application-discovery.md`](design/first-poc-application-discovery.md)
remains a historical discovery memo. ADR-0028 supersedes its Research-first
recommendation and accepts the Evidence Integrity Workbench plus PostgreSQL as
the hosted POC target. SQLite remains the only delivered durable adapter. The
PostgreSQL adapter, managed provider, hosting, authentication, data handling
and implementation require separately activated work.
