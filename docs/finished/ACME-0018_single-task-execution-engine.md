# Current Task

Task ID: ACME-0018
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-07-31
Last updated: 2026-07-31
Charter frozen at: 2026-07-31
Completed: 2026-07-31

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/design/acme-design-and-development-spec.md`, sections 5, 8–16, 19
  and Milestone 1
- `docs/design/narrative-module-build-and-test-plan.md`, especially Phase 5
- `docs/adr/0002-static-task-typed-module-composition.md`
- `docs/adr/0003-sqlite-revisioned-unit-of-work.md`
- `docs/adr/0004-deterministic-transition-identity.md`
- `docs/adr/0005-pure-memory-decision-application.md`
- `docs/adr/0006-aggregate-in-memory-unit-of-work.md`
- `docs/adr/0007-deterministic-model-mock-and-gateway-conformance.md`
- `docs/adr/0008-post-memory-domain-state-projection.md`
- `docs/adr/0009-reference-domain-identity-and-provenance.md`
- `docs/adr/0010-input-bound-validation-and-interpretation.md`
- `docs/adr/0011-narrative-knowledge-and-context-ownership.md`
- `docs/finished/ACME-0008_aggregate-in-memory-unit-of-work.md`
- `docs/finished/ACME-0009_deterministic-model-mock-and-gateway-conformance.md`
- `docs/finished/ACME-0017_narrative-module-observe-document.md`
- `packages/core/src/`
- `packages/adapter-memory/src/repository.ts`
- `packages/adapter-model-mock/src/scripted-model-gateway.ts`
- `packages/module-narrative/src/`

## Task Summary

Implement the bounded Milestone 1 `ExecutionEngine` path that coordinates one
registered task through the existing contract, gateway, response, module,
memory, state and aggregate repository boundaries. Prove the path with
NarrativeModule Phase 5 entirely offline: revision-zero execution, atomic
commit, request-key idempotency and replay verification.

The Draft deliberately excludes the later durability, recovery, evaluator,
repair/revision and workflow layers.

Child task ACME-0019 closed the execution-request identity, effective-policy,
deterministic-retrieval and replay-evidence boundaries inside this charter on
2026-07-31, so the planned ADR records approved decisions instead of
discovering them after the freeze. Two maintainer judgment calls remain open
under `Handoff and Follow-ups`; everything else is decided.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Implement a domain-neutral, deterministic single-task ExecutionEngine that
can run and replay-verify the approved Narrative offline acceptance flow
without network access, wall-clock access or domain branches in core.

### Primary Deliverable

A tested `@acme/core` ExecutionEngine implementation, the minimum aggregate
repository evidence extensions required for deterministic in-memory replay
verification and a non-empty Narrative Phase 5 scenario proving the complete
Milestone 1 execution path.

### In Scope

- Add and accept one ADR before implementation that **records**, rather than
  discovers, the Milestone 1 execution identity and replay decisions already
  fixed by this charter:
  - immutable effective-policy defaults, and validation that rejects any policy
    the bounded Milestone 1 path cannot honor;
  - the versioned deterministic execution-request fingerprint
    `acme-request-fingerprint-1`, and the identity/budget split below;
  - the constant versioned memory-retrieval rule and its participation in
    request identity and replay evidence;
  - a deterministic operation-key rule for one task execution;
  - the exact read-set, model-call and prepared-result evidence required to
    replay without a gateway call, plus the repository read that exposes it;
  - `acme-operation-digest-1` as the single compared replay value, the recorded
    identity/clock replay mode and the `match`, `different` and `unavailable`
    semantics;
  - the bounded public Milestone 1 engine surface for `execute` and
    replay-verify, leaving durable resume and other replay modes for later.
  If drafting the ADR shows that any recorded decision is wrong, stop and apply
  `docs/TASK_WORKFLOW.md` instead of widening this charter.
- Derive the first accepted execution identity with immutable
  `acme-execution-id-1` from namespace and request key. Repository acceptance
  requires an execution ID before it can resolve idempotency, so deterministic
  derivation is required to satisfy the frozen rule that same-key reuse
  allocates no additional ID. A changed fingerprint under the same key
  deliberately addresses the same proposed execution identity and conflicts.
- Implement ExecutionEngine orchestration in `@acme/core` using injected
  `Clock`, `IdGenerator`, registries, `ResponsePipeline`, `ModelGateway`,
  `MemoryEngine`, `StateEngine` and `ExecutionRepository` ports only.
- Define strict runtime validation for `ExecutionRequest` and the effective
  policy. Validate and canonical-JSON-clone the task input without coercion,
  detach it from caller ownership and deeply freeze the value reused by
  `project()` and `interpret()`.
- Reject an effective policy the bounded path cannot honor: `maxRepairCalls`
  and `maxRevisionCalls` must be zero and `maxModelCalls` must be one, so the
  stored policy never advertises behavior this task does not implement. A
  non-zero value is `INVALID_REQUEST` before any repository or gateway effect.
- Resolve module, task and immutable contract before accepting an execution;
  produce deterministic `NOT_FOUND_*` or `INVALID_REQUEST` failures without a
  model call or repository write.
- Compute and retain input hash, contract fingerprint, effective policy and
  the versioned request fingerprint before idempotent repository acceptance.
- Split identity from budget in `acme-request-fingerprint-1`. The preimage
  contains only outcome-determining content: namespace, task, entity, expected
  revision, canonical input, contract fingerprint, module state schema version,
  the exact `ModelSelection` and the constant retrieval configuration.
  Operational limits — timeout, call and cost budgets, retention — are recorded
  as `effectivePolicy` evidence and MUST NOT enter the preimage, so a later
  default change cannot retroactively conflict previously accepted request
  keys. Changing the model selection under an existing request key is therefore
  a deliberate `CONFLICT_IDEMPOTENCY_KEY`, not a silent re-run.
- Resolve the effective policy exactly once, at acceptance. Replay MUST read the
  stored policy and MUST NOT re-resolve it against current defaults.
- Map same-fingerprint request-key reuse to the stored terminal projection
  without another model call, ID allocation or canonical effect. The returned
  result is the stored terminal result with `replayed: true`; every other field
  is byte-identical to the original response. Map changed fingerprint reuse to
  `CONFLICT_IDEMPOTENCY_KEY`.
- Load the exact expected-revision context before a model call and retain the
  immutable read set needed for replay. Treat missing required Narrative
  source evidence and stale state revision as deterministic pre-call
  failures.
- Record the read set as evidence **at execution time**, not by re-reading
  canonical tables at replay time. The retained evidence fixes the state
  snapshot revision, the document keys with their content hashes and, for every
  retrieved memory, its `memoryId`, `recordVersion`, score and rank. Memory
  records that change after commit therefore cannot alter a replayed
  projection.
- Apply one constant, versioned, domain-neutral memory-retrieval rule
  `acme-memory-retrieval-1`: the engine builds
  `{ namespace, entityId, task, limit }` with no `kinds` and no `text`, calls
  `MemoryEngine.retrieve()` and passes only the resulting records in
  `ExecutionReadContext`. Domain relevance, filtering and scoring remain owned
  by the module policy; core keeps ordering and the limit. The limit is a
  constant of the algorithm version and part of the fingerprint preimage, never
  ambient engine configuration and never caller-supplied, so no caller can
  change the projected prompt without a visible algorithm-version change.
  The limit is **50**. It must exceed the
  Phase 5 fixture's record count with margin so the acceptance scenario never
  depends on truncation, and truncation is proved by its own unit test instead.
- Run task `project()`, validate the projected contract input without
  transformation, build and validate the complete provider-neutral
  `ModelRequest` and compute `acme-model-request-hash-1`.
- Reserve deterministic primary call `model:0`, invoke the exact supplied
  `ModelGateway` selection, retain normalized success or structured failure
  evidence and never interpret an unrecorded response.
- Process the response through the input-bound `ResponsePipeline`. For this
  bounded task, invalid output terminates without repair and leaves no
  canonical document, memory, state, event or outbox effect.
- Pass the same validated immutable task input and read context to module
  interpretation. Validate the interpreted documents, candidates, state
  intent, events and unique keys before preparing canonical effects.
- Prepare memory through the module-owned policy and `MemoryEngine`, build the
  exact filtered post-memory projection input, run task-owned
  `projectState()` and pass its untrusted delta through `StateEngine`.
- Build `PreparedCommit`, compute `acme-operation-digest-1` and atomically
  commit documents, memory candidate/decision evidence, memory mutations,
  optional state, evaluator evidence fixed to an empty list, events/outbox and
  the terminal execution projection through `ExecutionRepository`.
- Map expected state/memory conflicts and structured failures to one immutable
  terminal result without partial canonical effects.
- Extend `ExecutionRepository`, `@acme/adapter-memory` and the reusable
  repository conformance suite only as required to retain and load exact
  replay evidence. The extension is one read-only aggregate method,
  `loadReplayEvidence(executionId)`, returning the recorded request, effective
  policy, task input, read set, model calls and prepared commit, or `null`.
  It opens no transaction and preserves aggregate transaction ownership, and
  adapter-specific `evidence()` remains unusable as a core dependency.
  `acme-operation-digest-1` is immutable and its preimage is not touched.
  If the evidence boundary turns out to need more than this one read, stop and
  split it into its own bounded task before implementation continues, per the
  task-size rule in `docs/TASK_WORKFLOW.md`.
- Implement replay verification from recorded task input, exact read context,
  normalized model response, timestamps and deterministic prepared evidence.
  Replay verification must call no model gateway, write no canonical data and
  report matching, different or unavailable evidence explicitly.
- Run replay verification in a recorded-identity, recorded-clock mode: it
  reuses the recorded `executionId` and recorded `committedAt`, and its
  `IdGenerator` is forbidden and fails if invoked. This is required because
  `acme-operation-digest-1` binds execution identity and commit time; without
  it every verification would report `different` for a trivial reason.
- Compare exactly one value, the recorded `acme-operation-digest-1` against the
  recomputed one, so a match keeps one unambiguous meaning: the same committed
  effect. Report input-level divergence — contract fingerprint, model
  request/response hashes, retrieval evidence, missing payload — as
  `DiagnosticFact` entries in `differences`, not as a second digest algorithm.
- Return `unavailable` with an explicit diagnostic, never a failure and never
  fabricated data, when a retention setting means the recorded response payload
  is absent.
- Add unit tests for request/policy validation, fingerprints, terminal mapping,
  immutable input reuse, context/retrieval, primary call durability,
  pipeline/interpretation ordering, memory/state preparation, commit assembly,
  idempotency and replay verification. The matrix must include: a rejected
  non-zero repair/revision budget; fingerprint sensitivity to `ModelSelection`
  and insensitivity to operational budget; retrieval truncation at the constant
  limit; a replay whose `IdGenerator` would fail if invoked; and a replay of an
  execution whose retained memory records changed after commit, proving the
  recorded retrieval evidence is what is replayed.
- Add non-empty integration coverage using only `@acme/core`,
  `@acme/adapter-memory`, `@acme/adapter-model-mock` and a testing-owned neutral
  module fixture.
- Add the non-empty Narrative Phase 5 scenario:
  1. start at Narrative revision zero;
  2. observe one fixture chapter through the exact scripted model mock;
  3. commit one source document, exactly three memory decisions and revision
     one;
  4. repeat the same request key and prove zero additional effects and zero
     additional gateway calls;
  5. replay-verify equal recorded/rebuilt candidate and state evidence with
     zero gateway calls.
- Add negative-path execution tests proving invalid request and stale revision
  perform no model call or canonical write, invalid model output commits no
  domain effects, changed request fingerprint conflicts and memory/state
  conflict exposes no partial Unit of Work.
- Add a retention case that makes the `unavailable` replay branch reachable and
  tested. Under full in-memory retention that branch is unreachable, so it would
  otherwise ship unverified until durable persistence exists. Milestone 1 runs
  the acceptance scenario at full retention; a dedicated test executes with a
  retention setting that retains no response payload and asserts `unavailable`
  plus its diagnostic.
- Update dependency rules and the core vocabulary guard so orchestration
  remains domain-neutral and no concrete adapter or module enters core.
- Correct specification section 14.1 in the same change, so the published
  `ExecutionEngine` interface matches the Milestone 1 subset. Ship only
  `execute` and replay-verify; do not publish `resume`, `fork` or
  `rebuild-candidates` as members that throw, because a surface that looks
  complete and is not is worse than a smaller honest one. Later growth is
  additive and therefore non-breaking.
- Keep the append-only attempt and stage ledger writes even though nothing
  resumes yet. They have no consumer in this task, and they are exactly what
  makes durable resume implementable in Milestone 2 without a rewrite.
- Update the normative specification, Narrative build plan and all affected
  long-lived documentation to implemented reality.

### Out of Scope

- SQLite schema, migrations, WAL behavior, process durability, reopen tests or
  crash recovery.
- `resume(executionId)`, in-flight provider reconciliation or the
  post-response crash-resume guarantee reserved for Milestone 2.
- Automatic provider retry, backoff, jitter, repair calls, evaluator revision
  calls or scheduling. This task executes one primary model call.
- Evaluator registration/execution, safety gates or non-empty evaluator
  evidence; those remain Milestone 3 work.
- Replay `rebuild-candidates` or `fork`, diagnostic candidate persistence or
  mutation of an original execution.
- `AbortSignal` and caller-initiated cancellation in the Milestone 1
  `execute()` surface. It is left out entirely rather than accepted and only
  partially honored. With one scripted call and no I/O wait there is nothing
  real to interrupt, so the checks would be synthetic. `cancelled` remains a
  valid `ExecutionStatus` and becomes reachable when durable resume and live
  providers arrive.
- ScenarioRunner, multi-step workflows, CLI commands or Domain Test UI
  implementation.
- Memory lifecycle maintenance runs or outbox delivery after commit.
- ResearchModule or any Narrative-, Research- or provider-specific branch in
  `@acme/core`.
- Live model adapters, provider SDKs, network access, environment credentials
  or paid evaluation.
- Production optimization, package publication, deployment, push or release.

### Definition of Done

- The accepted ADR records the effective-policy, request-fingerprint,
  operation-identity, replay-evidence/digest and bounded-surface decisions
  exactly as frozen in this charter, with no decision left to discover during
  implementation.
- ExecutionEngine coordinates exactly one registered task exclusively through
  public ports and pure engines; core imports no module or concrete adapter.
- Task input is runtime-validated without coercion, detached, deeply frozen
  and reused exactly across projection and interpretation.
- Invalid request and unknown module/task/contract produce no repository or
  gateway effect; stale expected revision produces ledger-only conflict
  evidence and no gateway or canonical effect.
- The complete validated model request is reserved under `model:0` with its
  exact `acme-model-request-hash-1` before gateway invocation; normalized
  response/failure evidence is recorded before interpretation.
- Invalid technical, schema or semantic output cannot produce canonical
  document, memory, state, event or outbox changes.
- Allowed output flows through interpretation, MemoryEngine, filtered
  task-owned state projection, StateEngine and one aggregate commit in the
  normative order.
- Same request key plus same fingerprint returns the original terminal result
  with `replayed: true` and otherwise byte-identical fields, and allocates no
  additional IDs, model invocation or canonical records. Changed fingerprint
  under the key returns `CONFLICT_IDEMPOTENCY_KEY`. A changed `ModelSelection`
  is proved to be such a conflict; a changed operational budget is proved not
  to be.
- Replay verification uses exact recorded evidence, runs under recorded
  execution identity and recorded clock with a forbidden `IdGenerator`, invokes
  no gateway, performs no canonical write, compares only
  `acme-operation-digest-1` and distinguishes `match`, `different` and
  `unavailable`. Each of the three outcomes has at least one passing test, and
  the recorded retrieval evidence is proved to survive later memory changes.
- The unchanged repository conformance behaviors remain green and new replay
  evidence cases pass for `@acme/adapter-memory`.
- A neutral non-empty integration suite passes without domain branches.
- Narrative Phase 5 passes offline with one source document, exactly three
  memory decisions, revision one, idempotent repeat and matching replay
  candidate/state evidence.
- Required negative-path tests prove no model/canonical effects for invalid
  input and stale revision, no domain commit for invalid output and complete
  rollback for memory/state conflict.
- Full repository gates pass with non-empty integration and Narrative scenario
  suites; no network, provider SDK, environment credential or ambient
  wall-clock dependency is introduced.
- `CURRENT_STATUS`, `SYSTEMDOC`, `FILESTRUCTURE`, the normative specification,
  Narrative plan and journal accurately reflect the implemented boundary and
  retain durable persistence, resume, evaluators and Research as explicit
  gaps.

### Minimum Verification Gates

- [x] `pnpm install --frozen-lockfile`
- [x] `pnpm format:check`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm boundaries`
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance` with the extended non-empty repository suite
- [x] `pnpm test:integration` with a non-empty neutral engine suite
- [x] `pnpm test:scenario` with Narrative Phase 5
- [x] `pnpm build`
- [x] ADR decision/compatibility review and internal documentation links
- [x] Balanced Markdown fences
- [x] Core forbidden-vocabulary scan
- [x] `git diff --check`

## References

- `docs/PROJECT_BRIEF.md`, First Proof Milestone and Next Deliverable
- `docs/design/acme-design-and-development-spec.md`, sections 5, 8–16, 19
  and Milestone 1
- `docs/design/narrative-module-build-and-test-plan.md`, Phase 5 and
  negative-path execution tests
- ADR-0002 through ADR-0011 as listed under Read First
- `packages/core/src/execution-types.ts`
- `packages/core/src/repository.ts`
- `packages/core/src/repository-model-call.ts`
- `packages/core/src/response-pipeline.ts`
- `packages/core/src/memory-engine.ts`
- `packages/core/src/state-projection.ts`
- `packages/core/src/state-engine.ts`
- `packages/core/src/repository-digest.ts`
- `packages/adapter-memory/src/repository.ts`
- `packages/adapter-model-mock/src/scripted-model-gateway.ts`
- `packages/module-narrative/src/tasks/observe-document.ts`

## Checklist

- [x] Read `AGENTS.md` and the required repository documents in order.
- [x] Inspect the implemented contracts, adapters, Narrative Phase 5 plan and
      relevant accepted ADRs.
- [x] Activate ACME-0018 as a bounded ExecutionEngine Draft.
- [x] Resolve request fingerprint, effective-policy, retrieval, operation-key
      and replay-evidence decisions in the Draft, through child task ACME-0019.
- [x] Review and approve the staged Milestone 1 engine surface and the two
      maintainer judgment calls left open below.
- [x] Freeze the approved charter and set status to `Ready`.
- [x] Write and accept the execution identity/replay ADR; correct the normative
      specification before implementation.
- [x] Implement request validation, immutable identity and repository
      acceptance.
- [x] Implement context loading/retrieval and replay evidence retention.
- [x] Implement primary model-call reservation, invocation and response
      durability.
- [x] Implement response, interpretation, memory, projection and state
      orchestration.
- [x] Implement aggregate commit, terminal mapping and request-key
      idempotency.
- [x] Implement write-free, gateway-free replay verification.
- [x] Extend repository conformance and add engine unit/integration coverage.
- [x] Add and pass the Narrative Phase 5 offline scenario and negative paths.
- [x] Run every frozen verification gate and record exact evidence.
- [x] Update long-lived documentation and add a signed completion journal.
- [x] Archive the completed task and restore the task template.

## Decisions and Notes

- The maintainer explicitly requested an ExecutionEngine charter on
  2026-07-31 so Narrative Phase 5 can run.
- The recommended boundary is the Milestone 1 primary path: one task, one
  primary model call, in-memory repository, idempotent terminal reuse and
  replay verification. Durable resume, repair/revision, evaluators and
  multi-step flows are later independently valuable deliverables.
- ACME-0019 hardened this charter on 2026-07-31 after a maintainer-requested
  review found the four pre-freeze decisions named but unresolved. The notes
  below record what was decided and why, so the freeze rests on decisions
  rather than intentions. See `docs/finished/ACME-0019_acme-0018-charter-hardening.md`.
- The maintainer approved the hardened charter on 2026-07-31, including the
  retrieval limit of 50 and omission of `AbortSignal` from the Milestone 1
  surface. The charter was frozen at `Ready` before the ADR or implementation
  changed.
- The immutable effective-policy defaults are `timeoutMs: 30000`,
  `maxModelCalls: 1`, `maxRepairCalls: 0`, `maxRevisionCalls: 0` and
  `retention: "hash-only"`; optional token/cost limits remain absent unless
  supplied. Narrative Phase 5 explicitly selects `"encrypted-payload"` so
  replay verification has a retained normalized response.
- `acme-execution-id-1` hashes
  `{ algorithm, namespace, requestKey }`. This closes the pre-acceptance
  identity requirement without a lookup-port expansion and is necessary for
  same-key reuse to allocate no ID.
- `acme-operation-key-1` hashes
  `{ algorithm, executionId, namespace, task, entityId }`. Expected revision
  remains committed content and does not create a second logical operation
  identity.
- Exact replay read evidence is carried into the existing atomic commit as a
  sidecar on `PreparedCommit`, excluded from the immutable
  `acme-operation-digest-1` preimage. The in-memory repository retains that
  sidecar and the exact prepared commit, while the only new repository method
  remains the frozen read-only `loadReplayEvidence(executionId)`.
- Request fingerprinting and effective-policy defaults are described but not
  versioned by the current public implementation:
  `AcceptedExecution.requestFingerprint` is a caller-supplied string that no
  code in the repository computes. Versioning it as
  `acme-request-fingerprint-1` matches `acme-cjson-1`,
  `acme-transition-id-1`, `acme-model-request-hash-1` and
  `acme-operation-digest-1`; without a version tag any later change to the
  preimage silently reinterprets stored rows as `CONFLICT_IDEMPOTENCY_KEY`.
- Identity answers "what should be computed", policy answers "how hard may it
  try". Operational budgets are therefore excluded from the preimage. Retrieval
  configuration is not a budget: it changes which memories reach `project()`
  and therefore the prompt, so it belongs on the identity side. `ModelSelection`
  belongs there for the same reason, even though specification section 14.1
  omits it from its list.
- The current task contract does not declare a memory query or retrieval limit,
  and `TaskDefinition` has no memory field at all. A constant engine-owned rule
  keeps core domain-neutral and works today, because the Narrative policy treats
  an empty `kinds` set as "all kinds" and filters internally. A per-task memory
  declaration is the better long-term answer but changes a public core contract
  and the shared conformance kit, so it belongs in a separate task rather than
  here.
- `MemoryQuery.text` stays unused in Milestone 1. If a future rule derives it,
  it must be a pure function of validated input; deriving it from model output
  or wall clock would break determinism.
- Generic replay cannot be reproduced from the current public repository port:
  it exposes neither the exact execution read set nor a portable replay
  evidence projection. Adapter-specific `evidence()` is not an acceptable core
  dependency. One read-only aggregate method closes this without weakening
  aggregate ownership.
- Retrieval reads live memory records and `loadContext` returns the whole
  scope-filtered set, with ranking and the limit applied purely in
  `MemoryEngine.retrieve()`. Unless the ranked set is recorded at execution
  time, a replayed projection would silently depend on memory drift. This is the
  single most consequential decision in the task.
- `acme-operation-digest-1` is immutable and stays the only compared replay
  value. A second digest was considered and rejected: because the digest binds
  `executionId` and `committedAt`, replaying under recorded identity and
  recorded clock lets the existing digest be compared directly — which is the
  property the in-memory adapter already enforces when it rejects divergent
  content under one identity as persistence corruption. One algorithm with one
  meaning beats two algorithms to version and keep aligned. A digest match
  proves the same committed effect and nothing more, so input-level divergence
  is reported as diagnostics instead.
- A digest match is not proof of an identical path. Contract version, model
  responses, retrieval set and evaluator versions are reported through
  `differences`, which is why those facts must be retained as evidence.
- Narrowing the published surface is a deviation from specification section
  14.1 and is corrected there in the same change, per the repository rule that
  documentation moves with the contract it describes.
- Narrative Phase 5 is the acceptance proof for the engine, not a reopening of
  ACME-0017 or authorization to add Narrative behavior to core.
- The Domain Test UI implementation remains in backlog.
- Apply `docs/TASK_WORKFLOW.md` to every discovered work item.

## Charter Amendment Log

- None.

## Verification

- [x] Confirm ACME-0018 is the next monotonically increasing task ID.
- [x] Confirm `docs/CURRENT_TASK.md` contained only the inactive Draft
      template before activation.
- [x] Trace the Draft against Project Brief First Proof Milestone, specification
      Milestone 1 and Narrative Phase 5.
- [x] Identify pre-freeze contract gaps: request/policy identity, replay
      evidence/digest, deterministic memory retrieval and staged public engine
      surface.
- [x] `pnpm docs:check` passed for 50 Markdown files and `git diff --check`
      passed for the Draft documentation change.
- [x] Review the proposed ADR decision set with the maintainer.
- [x] Fix the exact fixture IDs, scripted model calls and recorded timestamps
      before implementation. Golden request, model, operation and Narrative
      state digests cannot be known in advance; record them on the first green
      run and freeze them as golden vectors thereafter.
- [x] Define the engine unit, neutral integration, repository conformance and
      Narrative scenario matrices before freeze.
- [x] Record all implementation verification evidence and skipped checks with
      reasons: all frozen checks passed; none were skipped.

Implementation verification completed on 2026-07-31:

- `pnpm install --frozen-lockfile`, formatting, lint, typecheck, boundaries
  and build passed.
- `pnpm test:unit`: 23 files and 162 tests passed.
- `pnpm test:conformance`: 4 files and 29 tests passed.
- `pnpm test:integration`: 1 file and 10 tests passed.
- `pnpm test:scenario`: 1 file and 1 test passed.
- `pnpm docs:check`: 52 Markdown files passed internal-link and balanced-fence
  validation before archival; the final post-archive pass covered 53 files.
- `git diff --check` passed.
- The boundary gate passed dependency, core-vocabulary and forbidden
  core/module fixture checks.
- No check was skipped.

## Documentation Updates

- [x] New execution identity and replay evidence ADR
- [x] `docs/design/acme-design-and-development-spec.md`
- [x] `docs/design/narrative-module-build-and-test-plan.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes

## Handoff and Follow-ups

- Current state: ACME-0018 is complete and archived. The bounded single-task
  engine, replay evidence path and Narrative Phase 5 are implemented.
- Next recommended step: Activate only the next explicitly approved task from
  the remaining Milestone 1 scope.
- Blockers: None.
- Child tasks: ACME-0019, complete and archived as
  `docs/finished/ACME-0019_acme-0018-charter-hardening.md`.
- Resume condition: Met on 2026-07-31 when ACME-0019 was verified and archived.
- Open questions: None.

## Frozen Test Matrix and Fixtures

### Engine unit matrix

- request shape, canonical JSON, no-coercion input and immutable reuse
- default/override policy validation and rejected repair/revision/call budgets
- fingerprint sensitivity to model selection and retrieval identity, plus
  insensitivity to timeout/token/cost/retention budgets
- deterministic execution and operation identity golden vectors
- unknown module/task/contract and invalid input before repository/gateway
- revision-zero context, constant retrieval query and 50-record truncation
- reservation under `model:0`, response/failure durability and ordering
- pipeline, interpretation, memory, projection, state and commit assembly
- terminal mapping, same-key replay flag and changed-fingerprint conflict
- replay `match`, `different` and retention-driven `unavailable`
- replay with a throwing external `IdGenerator` and later canonical memory
  drift while recorded retrieval evidence remains unchanged

### Neutral integration matrix

- package path uses only core, memory adapter, model mock and a testing-owned
  neutral module
- one revision-zero call commits document, memory and revision one
- same-key reuse creates no new invocation, ID or canonical effect
- invalid request/stale revision/invalid output and memory/state conflict
  expose no partial canonical effects

### Repository conformance additions

- committed replay evidence loads as a detached immutable aggregate
- exact request, stored policy, task input, ranked read set, model calls and
  prepared commit survive inspection
- absent/incomplete evidence returns `null`; evidence loading opens no
  transaction and mutates nothing
- retention omits the normalized response payload while preserving its hash

### Narrative Phase 5 fixture

- request key: `narrative-phase-5-request-1`
- entity: `story-phase-5`; document: `chapter-phase-5`
- model selection: profile `offline-json`, provider hint `fixture`, model hint
  `fixture-json-1`
- model call key/ID: `model:0` / `call-narrative-phase-5`
- memory IDs in prepared candidate order:
  `memory-narrative-phase-5-001` through `003`
- repository document ID: `document-narrative-phase-5-001`
- execution/commit time: `2026-07-31T12:00:00.000Z`
- normalized response time: `2026-07-31T12:00:01.000Z`
- output: one character fact, one directional relationship and one world rule;
  scene summary `Mira shares the northern-light rule with Ion.`
- frozen derived values:
  - execution ID:
    `execution_2c3216d146d3c9c40668e70e0f81ec870e2652ecf8294e3bd96556010914cd27`
  - request fingerprint:
    `65bf152f78569cfd5c632dc4ee5f8d5557bfdc470ee0c6e79d5fa44c0d10bb8b`
  - model request hash:
    `f4bde06e7d2e49883d1d48a8471f938396dc34f0b3eb8aa10a73d548cde16a95`
  - model response hash:
    `e7bc7256e9c6330675a2afaa7c840709757490eb10558e25ab2f89bea73ae40f`
  - operation digest:
    `15f143ba7991e04065ad1ed6bc9f2df6942e05372d18f5d4469b2eba4ae5c94f`
  - state hash:
    `086c05744c4cf0fe9469524b5f2ac52a430bf3edc115c95fb7f82c721bfbae54`

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0018_single-task-execution-engine.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes after `Ready`, supersede this task
  instead of rewriting it.
