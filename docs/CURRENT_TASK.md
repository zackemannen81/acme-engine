# Current Task

Task ID: ACME-0017
Parent Task: None
Status: Draft
Owner:
Created: 2026-07-30
Last updated: 2026-07-30
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
- `docs/design/acme-design-and-development-spec.md`, sections 8–12, 16 and
  19
- `docs/design/narrative-module-build-and-test-plan.md`
- `docs/adr/0002-static-task-typed-module-composition.md`
- `docs/adr/0004-deterministic-transition-identity.md`
- `docs/adr/0005-pure-memory-decision-application.md`
- `docs/adr/0008-post-memory-domain-state-projection.md`
- `docs/adr/0009-reference-domain-identity-and-provenance.md`
- `docs/adr/0010-input-bound-validation-and-interpretation.md`
- `docs/adr/0011-narrative-knowledge-and-context-ownership.md`
- `docs/finished/ACME-0015_reusable-domain-module-conformance.md`
- `packages/core/src/`
- `packages/testing/src/domain-module-conformance.ts`

## Task Summary

Implement ACME's first bounded reference-domain package:
`@acme/module-narrative` with the `narrative.observe-document@1.0.0` analyzer
task. This task covers the pure package, schemas, contract, task,
state/reducer/invariants, memory policy and shared conformance boundary. It
does not claim an end-to-end execution scenario before ExecutionEngine exists.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Implement NarrativeModule's domain-owned behavior entirely through public
ACME contracts, proving that narrative semantics require no domain branch in
core and no concrete adapter dependency.

### Primary Deliverable

A tested `@acme/module-narrative` package implementing namespace `narrative`,
task `observe-document`, contract `narrative.observe-document@1.0.0`, pure
narrative state/memory policy and the unchanged shared DomainModule
conformance suite.

### In Scope

- Add the `packages/module-narrative` workspace package, project reference,
  exports and module-to-core-only dependency enforcement.
- Define strict runtime schemas and inferred types for task input, projected
  contract input/output, narrative documents, memory values, state and delta.
- Implement `NarrativeObserveInput` with non-empty document key/text and
  closed optional title.
- Implement the immutable `narrative.observe-document@1.0.0`
  `PromptContract`, required capabilities, deterministic request construction
  and input-bound semantic validation.
- Implement approved v1 observation kinds: character fact, relationship and
  world rule; correction evidence is limited to character facts.
- Implement ADR-0009 `reference-text-normalization-1`,
  `narrative-entity-key-1` and its golden vector, with canonical
  `NarrativeState.entityAliases` as the sole alias authority.
- Implement ADR-0011's ownership boundary: memory exclusively owns character
  facts, relationships, world rules, contradictions and evidence; state owns
  the entity/alias registry, scene, fixed narrative window and outline
  progress without character attributes or relationship/world-rule caches.
- Implement literal `narrative-window-1` with at most two summaries ordered
  oldest to newest, reducer trimming, invariant enforcement and no runtime
  configuration.
- Implement source-backed `previous-document-tail-1` in projected contract
  input with exact document key/content-hash provenance, deterministic
  whitespace/sentence/suffix behavior, a 320-code-point bound and no summary
  fallback.
- Implement deterministic `project()`, input-bound `interpret()` and
  post-memory `projectState()` with applied-decision filtering semantics from
  ADR-0008.
- Produce the source candidate document, narrative memory candidates, direct
  scene/window/outline state intent and diagnostics with non-empty unique
  keys; emit no domain event until an event schema is separately approved.
- Implement pure initial state, reducer and invariants for entity/display-name
  registration, aliases, scene, fixed narrative window and monotonic outline
  progress.
- Implement pure narrative memory validation, identity, retrieval, resolution
  and lifecycle behavior for create, reinforce, merge, contest, explicit
  evidence-backed supersession and ignore.
- Require exact correction identity, prior value and input-verified quote
  before supersession; failed evidence may contest or reject but never
  supersede.
- Add deterministic fixtures and unit tests covering schemas, contract hash,
  task projection/interpretation, identity, policy, reducer and invariants.
- Run the unchanged exported `domainModuleConformance()` suite with
  Narrative-owned fixtures and add compile-time valid/invalid task inference
  checks.
- Update dependency/vocabulary boundaries and long-lived documentation to
  implemented reality.

### Out of Scope

- ExecutionEngine, ScenarioRunner, CLI composition or the Phase 5 offline
  Narrative acceptance scenario.
- ModelGateway invocation, retries, cancellation, repair, revision, ledger or
  replay orchestration.
- Repository writes, memory IDs, timestamps, record versions, state revisions,
  transition IDs, compare-and-swap or atomic commit behavior.
- SQLite, migrations, durable crash recovery, outbox delivery or a live model
  provider.
- ResearchModule, evaluator/safety composition or any branch/domain vocabulary
  in `@acme/core`.
- Adding Narrative domain events without a separately reviewed event schema.
- A general fuzzy semantic-equivalence algorithm, second model call, store
  lookup, wall-clock, random, environment or network dependency.
- Domain Test UI implementation or changes to its backlog activation status.
- Deployment, publication, push, release or paid evaluation.

### Definition of Done

- `@acme/module-narrative` exists, depends only on public core plus its direct
  schema runtime and exports its schemas, contract, task, policy and assembled
  module.
- Strict schemas reject unknown, empty, malformed and non-finite values.
- Request construction and request hash are deterministic and golden-tested;
  semantic validation enforces the v1 observation and correction protocol.
- Narrative identity/alias/correction behavior matches ADR-0009 and its golden
  vector.
- Narrative knowledge/state ownership, `narrative-window-1` and
  `previous-document-tail-1` match ADR-0011 and golden fixtures, including
  deterministic failure when required previous-source evidence is absent or
  mismatched.
- Fixed input/context/output produces byte-equivalent detached deeply frozen
  contract input, module result and projected delta.
- Memory policy and state reducer/invariants are pure, deterministic and
  covered across accepted and rejected paths.
- The unchanged shared DomainModule conformance suite passes with
  Narrative-owned fixtures.
- Invalid task names fail compile-time checks and module source cannot import
  adapters, apps, testing support, providers or database libraries.
- Core vocabulary/boundary checks remain green and no core contract changes.
- Full repository gates pass; integration/scenario remain empty with the
  absent ExecutionEngine recorded accurately.
- Status, system documentation, file structure and journal reflect the
  implemented module without claiming end-to-end execution.

### Minimum Verification Gates

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm boundaries`
- [ ] `pnpm test:unit`
- [ ] `pnpm test:conformance` with repository, gateway, neutral module and
      NarrativeModule suites
- [ ] `pnpm test:integration`
- [ ] `pnpm test:scenario`
- [ ] `pnpm build`
- [ ] Internal documentation links and balanced Markdown fences
- [ ] `git diff --check`

## References

- `docs/design/narrative-module-build-and-test-plan.md`
- `docs/design/acme-design-and-development-spec.md`
- ADR-0002, ADR-0004, ADR-0005 and ADR-0008 through ADR-0011
- `packages/core/src/contracts.ts`
- `packages/core/src/modules.ts`
- `packages/core/src/memory.ts`
- `packages/core/src/state.ts`
- `packages/testing/src/domain-module-conformance.ts`

## Checklist

- [x] Activate ACME-0017 as a bounded NarrativeModule Draft.
- [x] Review the Draft's state/memory and context boundaries.
- [x] Resolve and document state/memory ownership plus the fixed Narrative v1
      window and previous-document-tail policies.
- [ ] Review and freeze the remaining prompt-contract semantics under
      `narrative.observe-document@1.0.0`.
- [ ] Freeze the approved charter and set status to `Ready`.
- [ ] Implement package, schemas and deterministic fixtures.
- [ ] Implement pure state, reducer, invariants and memory policy.
- [ ] Implement the prompt contract and observe-document task.
- [ ] Assemble the module and run shared/type conformance.
- [ ] Run all frozen verification gates and record evidence.
- [ ] Update documentation, journal and archive when complete.

## Decisions and Notes

- The maintainer explicitly approved activation of one bounded reference
  module after ACME-0015 and the ACME-0016 documentation sync.
- Narrative is selected because it is the Milestone 1 reference slice and its
  module-level phases 1–4 can be implemented without the absent
  ExecutionEngine.
- Phase 5 offline acceptance remains a separate future task after
  ExecutionEngine exists.
- The maintainer approved ADR-0011 on 2026-07-30. Memory is the sole canonical
  owner of Narrative knowledge that can be reinforced, merged, contested or
  superseded. State owns the current revisioned working position.
- `narrative-window-1` is fixed at two oldest-to-newest summaries.
  `previous-document-tail-1` derives the bounded exact handoff from the loaded
  previous source document and permits no summary fallback.
- This Draft does not authorize implementation until its charter is reviewed
  and frozen at `Ready`.
- The Domain Test UI implementation remains in backlog.
- Apply `docs/TASK_WORKFLOW.md` to every discovered item.

## Charter Amendment Log

- None.

## Verification

- [ ] Define exact schema and semantic negative matrices.
- [ ] Define contract request-hash and narrative-entity golden evidence.
- [ ] Define and reproduce ADR-0011 window/tail golden fixtures, including
      Unicode whitespace, sentence closers, unterminated fragments, suffix
      truncation and missing/mismatched source evidence.
- [ ] Define policy resolution/retrieval/lifecycle matrix.
- [ ] Define reducer and invariant matrix.
- [ ] Confirm shared conformance fixture coverage.
- [ ] Confirm empty integration/scenario expectations before freeze.

## Documentation Updates

- [ ] `docs/adr/0011-narrative-knowledge-and-context-ownership.md`
- [ ] `docs/design/narrative-module-build-and-test-plan.md`
- [ ] `docs/design/acme-design-and-development-spec.md`
- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md`

## Handoff and Follow-ups

- Current state: Draft charter with state/memory ownership and v1 context
  policy resolved; no NarrativeModule source exists.
- Next recommended step: Review the remaining immutable prompt-contract
  semantics, then freeze or revise the Draft before implementation.
- Blockers: None for Draft review.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions:
  - Are all proposed prompt-contract semantics ready to freeze under
    `narrative.observe-document@1.0.0`?

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0017_narrative-module-observe-document.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes after `Ready`, supersede this task
  instead of rewriting it.
