# Current Task

Task ID: ACME-0018
Parent Task: None
Status: Paused
Owner: Codex
Created: 2026-07-31
Last updated: 2026-07-31
Charter frozen at:

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
repair/revision and workflow layers. Before the charter reaches `Ready`, it
must close the currently unspecified execution-request identity, effective
policy defaults and replay-evidence boundary through one reviewed ADR.

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

- Add and accept one ADR before implementation that fixes the Milestone 1
  execution identity and replay boundary:
  - immutable effective-policy defaults and validation;
  - a versioned deterministic execution-request fingerprint over the approved
    request, contract and module identity;
  - the deterministic memory-query/retrieval limit and how its effective
    configuration participates in request identity and replay;
  - a deterministic operation-key rule for one task execution;
  - exact read-set/model-call/prepared-result evidence required to replay
    without a gateway call;
  - the replay digest and `match`, `different` and `unavailable` semantics;
  - the bounded public Milestone 1 engine surface for `execute` and
    replay-verify, leaving durable resume and other replay modes for later.
- Implement ExecutionEngine orchestration in `@acme/core` using injected
  `Clock`, `IdGenerator`, registries, `ResponsePipeline`, `ModelGateway`,
  `MemoryEngine`, `StateEngine` and `ExecutionRepository` ports only.
- Define strict runtime validation for `ExecutionRequest` and the effective
  policy. Validate and canonical-JSON-clone the task input without coercion,
  detach it from caller ownership and deeply freeze the value reused by
  `project()` and `interpret()`.
- Resolve module, task and immutable contract before accepting an execution;
  produce deterministic `NOT_FOUND_*` or `INVALID_REQUEST` failures without a
  model call or repository write.
- Compute and retain input hash, contract fingerprint, effective policy and
  the versioned request fingerprint before idempotent repository acceptance.
- Map same-fingerprint request-key reuse to the stored terminal projection
  without another model call, ID allocation or canonical effect. Map changed
  fingerprint reuse to `CONFLICT_IDEMPOTENCY_KEY`.
- Load the exact expected-revision context before a model call and retain the
  immutable read set needed for replay. Treat missing required Narrative
  source evidence and stale state revision as deterministic pre-call
  failures.
- Apply one documented deterministic memory-retrieval rule to the loaded
  records, use `MemoryEngine.retrieve()` and pass only the resulting records
  in `ExecutionReadContext`.
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
- Map expected state/memory conflicts, cancellation and structured failures to
  one immutable terminal result without partial canonical effects.
- Extend `ExecutionRepository`, `@acme/adapter-memory` and the reusable
  repository conformance suite only as required to retain and load exact
  replay evidence. Preserve aggregate transaction ownership and existing
  `acme-operation-digest-1` semantics unless the ADR proves a versioned change
  is unavoidable.
- Implement replay verification from recorded task input, exact read context,
  normalized model response, timestamps and deterministic prepared evidence.
  Replay verification must call no model gateway, write no canonical data and
  report matching, different or unavailable evidence explicitly.
- Add unit tests for request/policy validation, fingerprints, terminal mapping,
  immutable input reuse, context/retrieval, primary call durability,
  pipeline/interpretation ordering, memory/state preparation, commit assembly,
  idempotency and replay verification.
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
- Update dependency rules and the core vocabulary guard so orchestration
  remains domain-neutral and no concrete adapter or module enters core.
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
- ScenarioRunner, multi-step workflows, CLI commands or Domain Test UI
  implementation.
- Memory lifecycle maintenance runs or outbox delivery after commit.
- ResearchModule or any Narrative-, Research- or provider-specific branch in
  `@acme/core`.
- Live model adapters, provider SDKs, network access, environment credentials
  or paid evaluation.
- Production optimization, package publication, deployment, push or release.

### Definition of Done

- The accepted ADR removes ambiguity from effective-policy defaults, request
  fingerprinting, operation identity, replay evidence/digest and the bounded
  Milestone 1 public engine surface.
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
  with no additional IDs, model invocation or canonical records. Changed
  fingerprint under the key returns `CONFLICT_IDEMPOTENCY_KEY`.
- Replay verification uses exact recorded evidence, invokes no gateway,
  performs no canonical write and distinguishes `match`, `different` and
  `unavailable`.
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

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm boundaries`
- [ ] `pnpm test:unit`
- [ ] `pnpm test:conformance` with the extended non-empty repository suite
- [ ] `pnpm test:integration` with a non-empty neutral engine suite
- [ ] `pnpm test:scenario` with Narrative Phase 5
- [ ] `pnpm build`
- [ ] ADR decision/compatibility review and internal documentation links
- [ ] Balanced Markdown fences
- [ ] Core forbidden-vocabulary scan
- [ ] `git diff --check`

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
- [ ] Review and approve the staged Milestone 1 engine surface.
- [ ] Resolve request fingerprint, effective-policy, operation-key and
      replay-evidence decisions in the Draft.
- [ ] Freeze the approved charter and set status to `Ready`.
- [ ] Write and accept the execution identity/replay ADR; correct the normative
      specification before implementation.
- [ ] Implement request validation, immutable identity and repository
      acceptance.
- [ ] Implement context loading/retrieval and replay evidence retention.
- [ ] Implement primary model-call reservation, invocation and response
      durability.
- [ ] Implement response, interpretation, memory, projection and state
      orchestration.
- [ ] Implement aggregate commit, terminal mapping and request-key
      idempotency.
- [ ] Implement write-free, gateway-free replay verification.
- [ ] Extend repository conformance and add engine unit/integration coverage.
- [ ] Add and pass the Narrative Phase 5 offline scenario and negative paths.
- [ ] Run every frozen verification gate and record exact evidence.
- [ ] Update long-lived documentation and add a signed completion journal.
- [ ] Archive the completed task and restore the task template.

## Decisions and Notes

- The maintainer explicitly requested an ExecutionEngine charter on
  2026-07-31 so Narrative Phase 5 can run.
- The recommended boundary is the Milestone 1 primary path: one task, one
  primary model call, in-memory repository, idempotent terminal reuse and
  replay verification. Durable resume, repair/revision, evaluators and
  multi-step flows are later independently valuable deliverables.
- Request fingerprinting and effective-policy defaults are described but not
  versioned by the current public implementation. They must be fixed before
  repository acceptance depends on them.
- The current task contract does not declare a memory query or retrieval
  limit. The ADR must fix one domain-neutral Milestone 1 rule and include its
  effective configuration in execution identity/replay evidence rather than
  allowing ambient engine configuration to change projected prompts.
- Generic replay cannot be reproduced from the current public repository port:
  it exposes neither the exact execution read set nor a portable replay
  evidence projection. Adapter-specific `evidence()` is not an acceptable core
  dependency. The ADR must close this boundary without weakening aggregate
  repository ownership.
- `acme-operation-digest-1` is immutable. Prefer a separate versioned replay
  digest/evidence contract over silently changing its preimage.
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
- [ ] Review the proposed ADR decision set with the maintainer.
- [ ] Define exact fixture IDs, timestamps, request/model/operation/replay
      digests and expected Narrative state hash before implementation.
- [ ] Define the engine unit, neutral integration, repository conformance and
      Narrative scenario matrices before freeze.
- [ ] Record all implementation verification evidence and skipped checks with
      reasons.

## Documentation Updates

- [ ] New execution identity and replay evidence ADR
- [ ] `docs/design/acme-design-and-development-spec.md`
- [ ] `docs/design/narrative-module-build-and-test-plan.md`
- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` when structure changes

## Handoff and Follow-ups

- Current state: Paused as a `Draft` charter; no ExecutionEngine code or public
  contract has changed. A maintainer-requested review on 2026-07-31 found the
  four pre-freeze decisions under-specified in ways that would make the freeze
  dishonest, so the charter is paused for a bounded hardening child task.
- Next recommended step: Complete ACME-0019, then resume this task as `Draft`,
  review the hardened decision set and freeze at `Ready` only if approved.
- Blockers: The charter cannot be frozen while request/policy identity,
  deterministic memory retrieval, replay evidence/digest and the staged public
  engine surface remain unresolved inside it. Implementation is additionally
  blocked by `Draft` status.
- Child tasks: ACME-0019 — harden this Draft charter against the reviewed
  pre-freeze findings.
- Resume condition: ACME-0019 is verified and archived, after which this task
  returns to `docs/CURRENT_TASK.md` as `Draft` for maintainer freeze approval.
- Open questions:
  - Should Milestone 1 expose only `execute` plus replay-verify, with
    `resume`, replay-fork and replay-rebuild deferred as proposed?
  - Should exact replay read-set/prepared evidence be added to the aggregate
    repository port under one accepted ADR as proposed?
  - Are one primary call and zero evaluators/repair/revision attempts the
    approved policy subset for this task?
  - What fixed or request-bound memory retrieval limit should Milestone 1 use,
    and where should it participate in the request fingerprint?

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0018_single-task-execution-engine.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes after `Ready`, supersede this task
  instead of rewriting it.
