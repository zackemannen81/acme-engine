# Journal

Add one dated, signed entry for every meaningful work session or handoff.

## 2026-07-29 — Docs-first foundation created

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0001
- Summary: Created ACME's docs-first foundation in the new `acme-engine`
  repository. Added canonical agent guardrails, project brief, contribution
  workflow, current status, pre-implementation system documentation, file
  structure, journal, task template, ADR structure, design directory and
  finished-task archive. Added deterministic LF handling and a conservative
  ignore file. Archived the bootstrap task and made the complete design and
  development specification the active task. No runtime packages, provider
  calls, deployment or production systems were created or changed.
- Verification: Documentation links, Markdown fences and scoped repository
  diff are verified in this work session. No typecheck or tests exist yet
  because runtime tooling has not been bootstrapped.
- Follow-ups: Execute `docs/CURRENT_TASK.md` and create the complete ACME
  design and development specification before implementation bootstrap.
- Signature: Codex

## 2026-07-29 — Frozen task charter workflow created

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0002
- Summary: Added a canonical workflow that freezes each task's Goal, Primary
  Deliverable, In Scope, Out of Scope, Definition of Done and minimum
  verification gates when status reaches `Ready`. Added immutable task IDs,
  explicit task states, scope-change decision tree, paused-parent and
  bounded-child mechanics, backlog proposals, supersession rules and a
  one-active-task invariant. Updated AGENTS, CONTRIBUTING and the task
  template, created `docs/paused/` and `docs/backlog/`, ID-tagged the
  foundation as ACME-0001 and migrated the active design specification to
  ACME-0003 without changing its goal or completion conditions.
- Verification: Documentation links, Markdown fences, trailing whitespace and
  repository diff checked in this work session. Runtime checks are not
  applicable.
- Follow-ups: Continue ACME-0003 against its frozen charter. Route every new
  discovery through `docs/TASK_WORKFLOW.md`.
- Signature: Codex

## 2026-07-29 — Complete design and development specification

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0003
- Summary: Created the normative ACME design and development specification.
  It defines ownership, domain-neutral package boundaries, task-typed
  TypeScript contracts, the model trust pipeline, memory/state semantics,
  evaluator composition, execution/retry/cancellation/replay protocols,
  revisioned SQLite schema and Unit of Work, Narrative and Research vertical
  slices, ScenarioRunner/CLI behavior, quality strategy, security/privacy
  boundaries, governance, milestones and the exact proposed bootstrap task.
  Accepted ADRs 0001–0003 for the toolchain, static module composition and
  SQLite durability. `C:\code\kids_standalone` at commit `e1bb69f3...` was
  inspected as read-only evidence; no source or production system was changed.
- Verification: Internal Markdown links and anchors, balanced fences,
  Mermaid block structure, terminology/ownership, requirement traceability,
  line endings, trailing whitespace and `git diff --check` verified. Runtime
  typecheck/tests are not applicable because no runtime or toolchain exists.
- Follow-ups: Activate the bounded ACME-0004 repository-bootstrap charter from
  specification section 26 when implementation is explicitly approved.
- Signature: Codex

## 2026-07-29 — Repository bootstrap completed

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0004
- Summary: Activated and completed the frozen repository-bootstrap charter.
  Added a pnpm workspace and lockfile, exact Node/pnpm and development
  dependency pins, shared strict ESM TypeScript configuration, ESLint,
  Prettier, Vitest and dependency-cruiser. Added behavior-free `@acme/core`,
  `@acme/testing` and `@acme/cli` skeletons, a passing workspace import test,
  a core vocabulary guard and a negative dependency fixture. Added a
  secret-free GitHub Actions workflow mirroring the local gates. No execution,
  memory, state, persistence, provider or domain behavior was introduced.
- Verification: `pnpm install --frozen-lockfile` and a forced frozen reinstall
  passed with pnpm `10.34.5`. Documentation checks covered 24 Markdown files.
  Format, lint, strict typecheck, dependency boundaries, unit tests and build
  passed. The unit suite passed 1 file and 1 test. Conformance, integration
  and scenario commands passed with no test files, as expected for this
  behavior-free milestone. `git diff --check` passed. Remote GitHub Actions was
  not run because no push was authorized. Local checks used installed Node
  `24.14.1`; CI uses the exact repository pin `24.18.0`.
- Follow-ups: Shape and explicitly approve a bounded Milestone 1 task for pure
  contracts and in-memory execution. Do not begin runtime work from the empty
  task template.
- Signature: Codex

## 2026-07-29 — Pure contracts and static registries completed

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0005
- Summary: Began Milestone 1 with a bounded pure contract-layer task. Added
  Zod-backed public schemas, common JSON/identity/time/document types,
  `acme-cjson-1` canonical JSON, SHA-256 hashing, the ACME error taxonomy,
  provider-neutral model and prompt-contract types, a strict response
  pipeline and immutable contract/module registries. Added task-typed module
  authoring, state/memory envelope and policy declarations and compile-time
  task inference examples. The pipeline records permitted BOM/JSON-fence
  cleanup, rejects parsed-value coercion and produces a deterministic parsed
  hash. No engine, repository, adapter or reference-domain behavior was added.
- Verification: Frozen install, formatting, lint, strict typecheck,
  dependency boundaries and build passed. Typecheck compiled the task
  inference and expected invalid-name example. Unit tests passed 4 files and
  19 tests covering canonicalization, hashing, all pipeline stages, cleanup,
  coercion rejection, fingerprints, ordering, lookup and duplicates.
  Conformance, integration and scenario gates passed empty because their
  implementations remain outside this charter. Documentation checks covered
  25 files before archival and `git diff --check` passed. Remote CI was not
  run because no push was authorized; local checks used Node `24.14.1` while
  CI remains pinned to `24.18.0`.
- Follow-ups: Explicitly activate a bounded pure StateEngine task next.
  MemoryEngine, in-memory repository/model mock and the Narrative slice remain
  separate Milestone 1 tasks.
- Signature: Codex

## 2026-07-29 — Pure StateEngine charter drafted

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0006
- Summary: Drafted the bounded pure StateEngine charter for maintainer review.
  The charter resolves transition identity through the versioned
  `acme-transition-id-1` derivation instead of extending `IdGenerator`. It
  requires `entityId` in the prepare context so revision-zero state can be
  initialized, excludes mutable transition content from identity and requires
  ADR-0004 plus a normative specification correction. No StateEngine code,
  public contract or persistence behavior was changed in this session.
- Verification: Documentation links, balanced Markdown fences and
  `git diff --check` passed. Runtime checks are not applicable because this
  change only drafts the next task charter.
- Follow-ups: Review the Draft charter in the pull request. If approved, merge
  it and explicitly change the task to `Ready` with a recorded freeze
  timestamp before implementation.
- Signature: Codex

## 2026-07-29 — Pure StateEngine completed

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0006
- Summary: Froze the approved StateEngine charter and implemented pure,
  domain-neutral state preparation in `@acme/core`. Added explicit entity,
  execution, operation and time prepare context; initial and existing revision
  handling; current-state, delta, reduced-state and invariant validation;
  immutable reducer inputs; canonical snapshot/transition hashes; complete
  provenance; and no-op behavior when no delta exists. Accepted ADR-0004 and
  implemented versioned deterministic transition identity
  `acme-transition-id-1` without extending `IdGenerator`. No repository,
  persistence, memory, orchestration, provider or reference-domain behavior
  was added.
- Verification: Frozen install, formatting, lint, strict typecheck,
  dependency boundaries and build passed. Unit tests passed 5 files and 35
  tests, including 16 StateEngine tests for the ID golden vector,
  stability/sensitivity, revision behavior, no delta, stale conflicts,
  validation failures, immutability, hashes and provenance. Conformance,
  integration and scenario gates passed empty because those layers remain
  outside this charter. Documentation checks and `git diff --check` passed
  after archival. No checks were skipped. Remote CI was not run because the
  branch was not pushed; local Node was `24.14.1` while CI remains pinned to
  `24.18.0`.
- Follow-ups: Explicitly charter the pure MemoryEngine as the next bounded
  Milestone 1 task. Later repository work must enforce compare-and-swap and
  reject divergent content under one deterministic `transitionId`.
- Signature: Codex

## 2026-07-29 — Pure MemoryEngine completed

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0007
- Summary: Activated and completed the bounded pure MemoryEngine task.
  Corrected the public resolution contract so domain policy supplies complete
  resulting strength and supersede replacement data instead of core inventing
  reinforcement/promotion semantics. Added immutable prepare, retrieval and
  lifecycle contracts plus a pure engine that validates candidates and loaded
  records, resolves candidates against a deterministic evolving working set,
  prepares create/update mutations with expected record versions, appends
  provenance, manages timestamps, validates/sorts retrieval results and
  applies explicit lifecycle hooks. Accepted ADR-0005. No repository,
  persistence, execution orchestration, provider or reference-domain behavior
  was added.
- Verification: Frozen install, formatting, lint, strict typecheck,
  dependency boundaries and build passed. Unit tests passed 6 files and 52
  tests, including 17 MemoryEngine tests covering every resolution action,
  stable candidate/ID order, evolving working-set visibility, versions,
  timestamps, provenance, error mapping, immutability, retrieval ties/limits
  and lifecycle actions. Conformance, integration and scenario gates passed
  empty because those layers remain outside this charter. Documentation checks
  and `git diff --check` passed after archival. No checks were skipped. Remote
  CI was not run because the branch was not pushed; local Node was `24.14.1`
  while CI remains pinned to `24.18.0`.
- Follow-ups: Explicitly charter the aggregate repository port and in-memory
  Unit of Work as the next bounded Milestone 1 task. That work must retain
  candidate decisions, enforce expected memory record versions and combine
  state/memory/document/event effects atomically.
- Signature: Codex

## 2026-07-29 — Aggregate in-memory Unit of Work completed

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0008
- Summary: Froze and completed the aggregate repository boundary and
  deterministic `@acme/adapter-memory`. Added execution, ledger, model-call,
  read-set, evaluation and prepared-commit contracts; accepted ADR-0006;
  defined golden-tested `acme-operation-digest-1`; and added explicit
  `CONFLICT_MEMORY_VERSION`. The adapter implements request acceptance,
  immutable evidence, deterministic reads and private copy-on-commit staging.
  One commit now atomically validates state hashes/identities, applies
  sequential memory CAS, retains candidate/evaluator evidence, validates and
  allocates documents/events late, creates matching outbox rows and marks the
  execution committed. Identical retries return the original projection
  without allocating IDs; divergent retries and identity reuse fail as
  persistence corruption.
- Verification: Frozen install, formatting, lint, strict typecheck,
  dependency boundaries, build, documentation checks and `git diff --check`
  passed. Unit execution passed 9 files and 65 tests, including digest golden/
  ordering/sensitivity, full-effect commit, late-failure rollback, state and
  memory CAS, transition collisions, immutable evidence and the repository
  conformance cases. The dedicated non-empty conformance gate passed 1 file
  and 5 tests. Integration and scenario gates passed empty because execution
  orchestration and reference scenarios remain outside this charter. No
  required checks were skipped.
- Follow-ups: Explicitly charter a deterministic model mock and
  provider-neutral gateway conformance next. ExecutionEngine orchestration and
  the Narrative acceptance slice remain separate bounded Milestone 1 work.
- Signature: Codex

## 2026-07-30 — Deterministic model-mock charter drafted

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0009
- Summary: Drafted the bounded deterministic model-mock and gateway
  conformance charter after confirming merged ACME-0008 on synchronized
  `main`. The Draft isolates `@acme/adapter-model-mock`, a reusable
  provider-neutral conformance kit and the missing versioned
  `acme-model-request-hash-1` contract. It proposes exact
  `(executionId, callKey)`, selection and request-hash matching; finite
  single-consumption scripts; fully scripted response timestamps; explicit
  capability/cancellation behavior; immutable invocation evidence; and no
  implicit fallback or external effects. ExecutionEngine, ledger/replay,
  provider SDKs and reference scenarios remain separate tasks.
- Verification: Local `main` and `origin/main` both resolved to merge commit
  `7fceac1`. Documentation links, Markdown fences and `git diff --check` are
  the applicable Draft-charter checks.
- Follow-ups: Review the Draft proposals for request-hash scope, call identity
  and consumption semantics. If approved, explicitly move ACME-0009 to
  `Ready`, record the freeze date and begin implementation.
- Signature: Codex

## 2026-07-30 — Deterministic model mock and gateway conformance completed

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0009
- Summary: Froze the approved charter and implemented immutable
  `acme-model-request-hash-1`, closed core gateway-boundary validation and the
  deterministic `@acme/adapter-model-mock`. The adapter validates exact
  selection profiles and complete finite call scripts before use, matches
  `(executionId, callKey)`, selection and request hash, consumes matching
  response/error outcomes once and exposes immutable invocation/unconsumed
  evidence outside the core port. Added the reusable provider-neutral
  `ModelGateway` conformance kit and accepted ADR-0007. No live provider,
  network, clock, filesystem, retry/orchestration or ledger integration was
  introduced.
- Verification: Frozen install, format, lint, strict typecheck, boundaries
  and build passed. Unit execution passed 12 files and 85 tests. The dedicated
  conformance gate passed 2 files and 10 tests, with non-empty repository and
  gateway suites. Integration and scenario gates passed empty because those
  behaviors remain outside this charter. Documentation checks covered 34
  Markdown files and `git diff --check` passed. No required check was skipped.
  Local Node was `24.14.1` while the repository/CI pin remains `24.18.0`; pnpm
  was the pinned `10.34.5`.
- Follow-ups: Explicitly charter ExecutionEngine orchestration as the next
  bounded Milestone 1 task. Durable ledger reuse, live provider adapters and
  the Narrative acceptance slice remain separate future work.
- Signature: Codex

## 2026-07-30 — Reference-module build and test guides completed

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0010
- Summary: Produced normative build and test guides for NarrativeModule and
  ResearchModule plus matching presentation-ready DOCX renditions. Each guide
  defines module ownership, proposed package and component structure, domain
  contracts, document/memory/state mapping, pure reducer and memory-policy
  responsibilities, five ordered implementation phases, layered unit/type/
  conformance/negative/scenario verification and a team decision checklist.
  The plans deliberately use the same domain-neutral core path while keeping
  Narrative continuity policy and Research evidence policy domain-owned. No
  module or runtime behavior was implemented.
- Verification: `pnpm docs:check` passed for 39 Markdown files and
  `git diff --check` passed. Both guides contained every required section,
  balanced fences and one readable Mermaid block. DOCX structural, preset,
  table-geometry and accessibility audits passed. Microsoft Word opened both
  files read-only as 12-page, three-table documents with all required
  sections. Every page was exported to PDF, rasterized to PNG and visually
  inspected at original resolution with no clipping, overlap, overflow or
  unreadable table. LibreOffice was unavailable, so Word COM provided the
  page-rendering fallback; no visual check was skipped.
- Follow-ups: Team-review and separately charter the three bounded proposals:
  memory decisions to state projection, reference-module identity/provenance
  fields and reusable DomainModule conformance. After those gates are
  resolved, activate one bounded reference-module implementation task; do not
  add domain branches to core.
- Signature: Codex

## 2026-07-30 — Post-memory domain state projection completed

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0011
- Summary: Activated and completed the first reference-module decision gate.
  Accepted ADR-0008 and replaced the ambiguous pre-memory
  `ModuleResult.stateDelta` with typed non-canonical `stateIntent`. Every task
  now owns a pure `projectState()` hook. Added
  `buildStateProjectionInput()`, which enforces exact candidate/decision key
  correspondence, preserves prepared decision order, retains correlated
  applied create/reinforce/merge/contest/supersede evidence, filters
  ignore/reject-candidate and returns detached deeply frozen canonical JSON.
  Corrected the normative execution sequence and both reference-module build
  guides, then removed the resolved backlog proposal. No ExecutionEngine,
  reference module, repository/persistence behavior or external effect was
  added.
- Verification: Frozen install, format, lint, strict typecheck, boundaries and
  build passed. Unit execution passed 13 files and 91 tests, including six
  projection cases. Dedicated repository/gateway conformance passed 2 files
  and 10 tests. Integration and scenario gates passed empty because those
  implementations remain outside this charter. Documentation checks covered
  41 Markdown files after archival and `git diff --check` passed. No required
  check was skipped; remote CI was not run because no push was authorized.
- Follow-ups: Explicitly charter the reference-module identity/provenance
  decision next, then separately activate reusable DomainModule conformance.
  Do not begin NarrativeModule or ResearchModule implementation until both
  remaining gates are resolved.
- Signature: Codex

## 2026-07-30 — Reference identity task paused for input-bound contracts

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0012
- Summary: Activated and froze the reference-domain identity/provenance
  charter, then drafted ADR-0009 and the normative Narrative/Research schema
  corrections. The draft exposed a blocking public-contract gap:
  `PromptContract.validateSemantics()`, `ResponsePipeline.process()` and
  `TaskDefinition.interpret()` do not receive the validated input. A reference
  module therefore cannot verify a source quote against the supplied document
  or construct source-backed candidates without hidden state. Paused
  ACME-0012 unchanged and activated bounded child ACME-0013 to add the missing
  input binding before the parent decision is finalized.
- Verification: The partial documentation draft passed `pnpm docs:check` for
  41 Markdown files and `git diff --check`. Runtime verification belongs to
  ACME-0013 and has not yet run.
- Follow-ups: Complete ACME-0013, archive it, restore ACME-0012 from
  `docs/paused/`, then finish and verify ADR-0009 against the implemented
  contract boundary.
- Signature: Codex

## 2026-07-30 — Input-bound validation and interpretation completed

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0013 (child of ACME-0012)
- Summary: Accepted ADR-0010 and closed the public input-binding gap.
  `ResponsePipeline.process()` now validates contract input before response
  inspection, rejects schema/non-JSON/coercing input non-repairably and passes
  detached deeply frozen input/output to input-aware semantics.
  `TaskDefinition.interpret()` now receives original typed task input, with
  compile-time inference proof. Updated the normative specification,
  reference guides and long-lived documentation. No ExecutionEngine,
  reference-domain behavior, repository, provider or persistence behavior was
  added.
- Verification: Frozen install, format, lint, strict typecheck, boundaries and
  build passed. Unit execution passed 13 files and 95 tests, including ten
  response-pipeline tests. Dedicated repository/gateway conformance passed 2
  files and 10 tests. Integration and scenario gates passed empty because
  those layers remain outside the child. Documentation checks covered 43
  Markdown files and `git diff --check` passed. No required check was skipped.
- Follow-ups: Restore ACME-0012 from `docs/paused/`, record this completed
  child and finish its original identity/provenance charter.
- Signature: Codex

## 2026-07-30 — Reference-domain identity and provenance completed

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0012
- Summary: Resumed the frozen parent after ACME-0013 and accepted ADR-0009.
  Canonical Narrative state is now the sole alias authority;
  `narrative-entity-key-1` handles unknown labels, and character-fact
  supersession requires input-verified correction evidence plus matching
  identity/prior value. Research now separates canonical proposition identity,
  exact normalized source identity and caller-declared source independence;
  complete domain evidence stays in claim memory while state references stable
  memory IDs and core provenance retains generic execution/document links.
  Corrected the normative specification and both reference-module guides,
  removed the resolved backlog proposal and retained shared module conformance
  as the one remaining implementation gate. No reference module, provider,
  repository or persistence behavior was added by the parent.
- Verification: Documentation checks passed for 43 Markdown files. All four
  `acme-cjson-1`/SHA-256 golden vectors reproduced exactly. Both module guides
  contain no unresolved identity/provenance gate, the schema-placement matrix
  covers every activated backlog field and `git diff --check` passed.
  ACME-0013's separate runtime verification passed 95 unit tests, 10 dedicated
  conformance tests, typecheck, lint, boundaries and build. No required check
  was skipped.
- Follow-ups: Explicitly charter the reusable DomainModule conformance kit.
  After it passes, activate one bounded reference-module implementation task;
  keep domain vocabulary out of core.
- Signature: Codex

## 2026-07-30 — Domain test UI specification completed

- Date: 2026-07-30
- Author: Claude
- Task: ACME-0014
- Summary: Packaged the proposed domain-test user interface as a reviewable
  specification. `docs/design/domain-test-ui-specification.md` defines the
  interface's ownership boundaries, its position as a composition-root app
  under the approved dependency direction, its readiness prerequisites, a
  vocabulary mapped onto approved terms, ten surfaces with their exact
  evidence sources, a recommended `acme-test-plan/1` configuration model that
  compiles only into `acme-scenario/1` and `ExecutionRequest`, an explicit
  read/write contract that forbids every canonical write, a measurement
  catalog derived from specification sections 19 and 20, determinism/
  redaction/retention/budget rules from section 21, a five-phase build order,
  the interface's own verification matrix and seven decision gates. The
  interface never computes a verdict, never becomes a second source of truth
  and exposes no scripting, credential or destructive surface. Recorded the
  bounded activation proposal in `docs/backlog/` and updated the design index,
  system documentation, status and file structure. No package, source file,
  contract or ADR was added.
- Verification: The branch was first rebased onto merge commit `99e5928`,
  where `pnpm docs:check` failed with 10 pre-existing broken links to the then
  uncommitted ADR-0009 and ADR-0010 files. The maintainer merged those ADRs and
  the missing ACME-0012 and ACME-0013 archives as `719f46c`; the branch was
  rebased again, the specification was sharpened against the now-readable ADR
  text, and `node tooling/docs/check-docs.mjs` then passed cleanly for 47
  Markdown files. Every link and section anchor added by this task was resolved
  individually. The specification contains all required sections and four
  balanced fenced blocks, one of them a readable Mermaid diagram.
  `git diff --check` passed. No typecheck, lint, boundary, build or test gate
  applies because this task adds no source file; none was skipped.
- Follow-ups: Review the specification's decision gates, starting with whether
  a domain-test interface belongs in version 1 at all. Do not charter
  implementation before ExecutionEngine, ScenarioRunner, a reference module and
  durable persistence exist.
- Signature: Claude

## 2026-07-30 — Reusable DomainModule conformance completed

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0015
- Summary: Completed the final shared pre-reference-module gate. Added the
  strongly typed public-core-only `domainModuleConformance()` kit to
  `@acme/testing`, covering module/task/registry identity, valid and invalid
  runtime schemas, deterministic detached and deeply frozen task projection,
  interpretation and post-memory state projection, unique effect keys, pure
  initialization/reduction/invariants and caller-supplied memory-policy
  outcomes. The identical suite runs against testing-owned producer and empty
  analyzer fixtures. Added compile-time invalid task/input checks and a
  dependency rule plus negative fixture rejecting future module imports of
  apps, concrete adapters or `@acme/testing`. Removed the resolved conformance
  backlog proposal and updated the normative specification, both reference
  guides, the Domain Test UI dependency record and long-lived documentation.
  No reference module, core contract, orchestration, persistence or UI
  behavior was added.
- Verification: Frozen install, format, lint, strict typecheck, boundaries and
  build passed. Unit execution passed 14 files and 107 tests. Dedicated
  conformance passed 3 files and 22 tests: 5 repository, 5 gateway and 12
  DomainModule cases. Compile-time valid/invalid examples and the intended
  module-to-adapter boundary failure passed. Integration and scenario gates
  passed empty because their implementations remain outside the charter.
  Documentation checks covered 46 Markdown files and `git diff --check`
  passed. No required check was skipped.
- Follow-ups: Execute the separately approved documentation-reality sync, then
  activate one bounded reference-module task. Keep the Domain Test UI
  implementation proposal in backlog until its explicit dependencies exist.
- Signature: Codex

## 2026-07-30 — Current documentation synchronized with repository reality

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0016
- Summary: Audited current-facing documentation against the actual
  non-generated workspace after ACME-0015. Updated `AGENTS.md` from the stale
  design-only claim to the implemented Milestone 1 reality and changed its
  verification wording from future code to current code tasks. Updated the
  root README and project brief with the shared DomainModule conformance and
  next reference-module direction. Corrected system/status wording and
  repaired `docs/FILESTRUCTURE.md` with the backlog/paused/archive README
  files, the complete ACME-0001 through ACME-0016 archive, ACME-0015
  code/type/conformance/boundary fixtures and the tracked `FS.txt`. The latter
  remains unchanged and is explicitly non-authoritative because it is a stale
  raw filesystem dump containing generated content. Historical tasks and
  journal entries were not rewritten. The Domain Test UI implementation
  remains in backlog.
- Verification: The non-generated workspace inventory was compared with the
  canonical map. A current-facing stale-language search returned no obsolete
  design-only phase, inactive-task, old test-count or unresolved-conformance
  claims. `pnpm docs:check` passed for 47 Markdown files and
  `git diff --check` passed. No runtime gate applies to this documentation-only
  task.
- Follow-ups: Activate one bounded NarrativeModule implementation task using
  the shared conformance kit. Do not implement the Domain Test UI until its
  remaining explicit prerequisites exist.
- Signature: Codex

## 2026-07-30 — NarrativeModule implementation charter activated as Draft

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0017
- Summary: Activated a bounded Draft charter for the first reference-domain
  package, `@acme/module-narrative`, implementing
  `narrative.observe-document@1.0.0`. The proposed scope covers package and
  strict schemas, ADR-0009 identity/alias/correction behavior, pure
  state/reducer/invariants, narrative memory policy, input-bound contract/task
  behavior, post-memory state projection, deterministic fixtures, type checks
  and the unchanged shared DomainModule conformance suite. ExecutionEngine,
  ScenarioRunner, persistence, model invocation and the Phase 5 offline
  acceptance scenario remain separate.
- Verification: `pnpm docs:check` and `git diff --check` are required for the
  Draft. Runtime gates belong to implementation after the charter reaches
  `Ready`.
- Follow-ups: Review the v1 prompt-contract semantics, choose an explicit
  versioned narrative-window limit and confirm state/memory ownership. Revise
  the Draft if needed; freeze it only after those questions are resolved.
- Signature: Codex

## 2026-07-30 — Narrative knowledge and context ownership accepted

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0017
- Summary: Accepted ADR-0011 before the NarrativeModule Draft is frozen.
  Memory is now the sole canonical owner of character facts, relationships,
  world rules, contradictions and evidence; Narrative state owns only the
  entity/display-name and alias authority plus the current scene, fixed
  short-range window and outline progress. Fixed `narrative-window-1` at two
  oldest-to-newest summaries. Defined source-backed
  `previous-document-tail-1` as deterministic Unicode-whitespace
  normalization, the last at most two sentences and last at most 320 Unicode
  code points, with document key/content-hash provenance and no summary
  fallback. Corrected the normative specification, implementation guide,
  project brief, system/status documentation, repository map and active Draft.
  No Narrative source or runtime behavior was added, and ACME-0017 remains
  `Draft`.
- Verification: `pnpm docs:check` passed for 49 Markdown files,
  `pnpm format:check` passed and `git diff --check` passed. No runtime gate
  applies to this Draft-decision documentation session.
- Follow-ups: Review the remaining immutable
  `narrative.observe-document@1.0.0` prompt-contract semantics. Freeze
  ACME-0017 at `Ready` only after that review; implementation remains
  unauthorized while the task is `Draft`.
- Signature: Codex

## 2026-07-30 — NarrativeModule observe-document implementation complete

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0017
- Summary: Implemented `@acme/module-narrative` through build-plan phases
  1–4. Added strict v1 schemas, ADR-0009 identity normalization and golden
  entity keys, ADR-0011 `previous-document-tail-1` and
  `narrative-window-1`, the immutable
  `narrative.observe-document@1.0.0` contract, deterministic project and
  input-bound interpretation, applied-decision-only state projection, pure
  state/reducer/invariants and the domain-owned memory validation, retrieval,
  resolution and lifecycle policy. The module emits the source document,
  three approved memory-candidate kinds, direct scene/window/outline intent
  and diagnostics without domain events. Added Narrative-owned schema,
  context, task, policy, reducer, type-inference and unchanged shared
  DomainModule conformance coverage. No core contract, adapter, repository,
  model invocation, orchestration, persistence, ResearchModule or UI behavior
  was added.
- Verification: Frozen install, format, lint, strict typecheck, boundaries and
  build passed. Unit execution passed 20 files and 146 tests. Dedicated
  conformance passed 4 files and 28 tests: 5 repository, 5 gateway, 12 neutral
  DomainModule and 6 NarrativeModule cases. Integration and scenario gates
  passed empty because ExecutionEngine and ScenarioRunner remain outside the
  charter. Documentation links/fences and `git diff --check` passed. No
  required check was skipped.
- Follow-ups: Explicitly charter the single-task ExecutionEngine to exercise
  Narrative Phase 5 offline acceptance. Keep ResearchModule and durable
  persistence as separate, explicitly approved tasks. The Domain Test UI
  remains in backlog.
- Signature: Codex

## 2026-07-31 — Single-task ExecutionEngine charter drafted

- Date: 2026-07-31
- Author: Codex
- Task: ACME-0018
- Summary: Activated a bounded Draft charter for the domain-neutral Milestone
  1 ExecutionEngine needed by Narrative Phase 5. The proposed task coordinates
  one primary model call through the existing registries, response pipeline,
  Narrative task, MemoryEngine, post-memory state projection, StateEngine and
  aggregate in-memory repository. Its required offline acceptance proves a
  revision-zero Narrative commit with one source document, exactly three
  memory decisions, revision one, request-key idempotency and gateway-free
  replay verification. The Draft explicitly leaves SQLite durability, resume,
  repair/revision, retries, evaluators, ScenarioRunner, ResearchModule and live
  providers outside scope.
- Decisions: Identified four pre-freeze contract gaps. A reviewed ADR must
  version effective-policy/request fingerprint and operation identity, define
  deterministic memory retrieval, define portable replay read-set/prepared
  evidence plus replay digest semantics and fix the staged Milestone 1 public
  surface to execute plus replay-verify.
  Existing `acme-operation-digest-1` must not be changed silently. No runtime
  source, public contract or adapter behavior changed in this session.
- Verification: The Draft was traced against the Project Brief First Proof
  Milestone, specification sections 5 and 8–16, Milestone 1, Narrative Phase
  5 and ADR-0002 through ADR-0011. `pnpm docs:check` passed for 50 Markdown
  files, including internal links and balanced fences, and
  `git diff --check` passed.
- Follow-ups: Review the four Draft decisions. If approved, freeze ACME-0018
  at `Ready`, accept the execution identity/replay ADR and implement only the
  frozen Milestone 1 path.
- Signature: Codex
