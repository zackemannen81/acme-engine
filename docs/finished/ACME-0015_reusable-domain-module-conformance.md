# Current Task

Task ID: ACME-0015
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-07-30
Last updated: 2026-07-30
Charter frozen at: 2026-07-30
Archived: 2026-07-30

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/design/acme-design-and-development-spec.md`, sections 5, 10, 12,
  19 and Milestone 1
- `docs/design/narrative-module-build-and-test-plan.md`
- `docs/design/research-module-build-and-test-plan.md`
- `docs/adr/0002-static-task-typed-module-composition.md`
- `docs/adr/0005-pure-memory-decision-application.md`
- `docs/adr/0008-post-memory-domain-state-projection.md`
- `docs/adr/0009-reference-domain-identity-and-provenance.md`
- `docs/adr/0010-input-bound-validation-and-interpretation.md`
- `docs/backlog/reusable-domain-module-conformance-kit.md`
- `packages/core/src/modules.ts`
- `packages/core/src/memory.ts`
- `packages/core/src/registries.ts`
- `packages/testing/src/`

## Task Summary

Complete the remaining pre-reference-module gate by adding one reusable,
provider- and adapter-neutral executable conformance contract for
`DomainModule`. The kit must prove the shared public module boundary without
implementing Narrative or Research policy, changing core contracts or
requiring ExecutionEngine orchestration.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Provide a reusable executable conformance kit that verifies any
`DomainModule` composes deterministically and immutably through public
`@acme/core` contracts while leaving domain meaning to module-owned unit
tests.

### Primary Deliverable

An exported `domainModuleConformance()` kit in `@acme/testing`, proven by the
same non-empty suite running unchanged against two distinct testing-owned,
domain-neutral module fixtures and by compile-time task inference checks.

### In Scope

- Define a strongly typed conformance subject/options contract that infers the
  selected task name, task input, contract output, module state and delta.
- Exercise only public `@acme/core` types, registries and schemas; require no
  adapter-specific inspection or concrete repository.
- Verify non-empty namespace, schema-version and task identity plus
  deterministic `ModuleRegistry` lookup/list behavior.
- Verify supplied valid and invalid task-input, state and delta fixtures
  against the module-owned runtime schemas.
- Verify deterministic, detached, deeply frozen task `project()`,
  `interpret()` and `projectState()` results from immutable inputs.
- Verify mutation resistance and deterministic behavior for
  `initialState()`, `reduce()` and `invariants()`.
- Verify interpreted document, memory-candidate and event keys are non-empty
  and unique within their effect category.
- Verify supplied memory-policy fixtures for deterministic validation,
  identity, retrieval, resolution and lifecycle behavior without asserting
  module-specific policy meaning.
- Permit an analyzer task to return an explicitly empty `ModuleResult`
  without manufacturing state, memory, document or event effects.
- Add two testing-owned domain-neutral fixtures: one producer with complete
  effects and one analyzer with an empty result. Run the identical exported
  suite against both.
- Add compile-time examples proving valid task-name/input/output inference and
  rejecting an invalid task name or mismatched fixture type.
- Add a package-boundary rule and negative fixture proving future
  `packages/module-*` source may depend on core but not on adapters, apps or
  other concrete packages.
- Export the kit from `@acme/testing` and keep existing repository/gateway
  conformance suites green.
- Remove the resolved DomainModule-conformance backlog proposal and update the
  normative specification, reference-module guides and long-lived
  documentation to implemented reality.

### Out of Scope

- Implementing NarrativeModule, ResearchModule or any domain-owned identity,
  equivalence, contradiction, merge, promotion, reducer or invariant policy.
- Adding a generic "reference domain" abstraction or domain vocabulary to
  `@acme/core`.
- Changing `DomainModule`, `TaskDefinition`, `ModuleResult`,
  `DomainMemoryPolicy`, StateEngine, MemoryEngine or repository contracts.
- Running a complete task through ExecutionEngine, ScenarioRunner, a model
  gateway or persistence adapter.
- Implementing ExecutionEngine, SQLite, a reference-module acceptance
  scenario, live providers, the Domain Test UI or any UI prerequisite.
- Requiring domain modules to import `@acme/testing` at runtime; the kit is
  test-only support.
- Defining module-specific semantic expectations beyond caller-supplied
  fixture outcomes.
- Deployment, publication, push, release, paid evaluation or other remote
  mutation.

### Definition of Done

- `@acme/testing` exports a typed `domainModuleConformance()` API that imports
  only public `@acme/core` contracts plus test-runner support.
- The same exported suite runs unchanged and non-empty for producer and empty
  analyzer fixtures.
- Schema, registry, task, state, memory-policy, reducer/invariant,
  determinism, immutability and unique-effect-key cases pass.
- Compile-time checks prove correct task inference and reject invalid task
  names or mismatched inputs.
- Boundary verification rejects a module-to-adapter import and all existing
  dependency/vocabulary checks remain green.
- Existing repository and gateway conformance suites remain unchanged and
  passing.
- No reference-domain vocabulary or policy enters core or the reusable kit.
- All required repository verification gates pass, with empty integration and
  scenario gates recorded accurately while orchestration remains absent.
- The backlog, specification, reference guides, status, system documentation,
  file structure and journal reflect the completed gate.

### Minimum Verification Gates

- [x] `pnpm install --frozen-lockfile`
- [x] `pnpm format:check`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm boundaries`
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance` with non-empty repository, gateway and module
      suites
- [x] `pnpm test:integration`
- [x] `pnpm test:scenario`
- [x] `pnpm build`
- [x] Internal documentation links and balanced Markdown fences
- [x] `git diff --check`

## References

- `docs/backlog/reusable-domain-module-conformance-kit.md`
- `docs/design/acme-design-and-development-spec.md`
- `docs/design/narrative-module-build-and-test-plan.md`
- `docs/design/research-module-build-and-test-plan.md`
- ADR-0002, ADR-0005 and ADR-0008 through ADR-0010
- `packages/core/src/modules.ts`
- `packages/core/src/memory.ts`
- `packages/core/src/registries.ts`
- `packages/testing/src/model-gateway-conformance.ts`
- `packages/testing/src/repository-conformance.ts`

## Checklist

- [x] Re-read the repository workflow, current status and latest handoff.
- [x] Activate ACME-0015 as a bounded Draft charter.
- [x] Review the Draft for one outcome, dependency direction and executable
      verification.
- [x] Freeze the approved charter and set status to `Ready`.
- [x] Implement and export the typed DomainModule conformance kit.
- [x] Add producer and empty-analyzer fixtures using the same suite.
- [x] Add compile-time inference and invalid-use checks.
- [x] Add the future-module boundary rule and negative fixture.
- [x] Run all minimum verification gates and record exact evidence.
- [x] Update normative and long-lived documentation.
- [x] Remove the resolved backlog proposal.
- [x] Add a signed journal entry, archive ACME-0015 and restore the task
      template.

## Decisions and Notes

- The maintainer explicitly approved activation, review, freeze and
  implementation of ACME-0015 on 2026-07-30.
- ACME-0014 is already assigned to the completed Domain Test UI
  specification; ACME-0015 is the next unique task identifier.
- Testing-owned neutral fixtures prove that the kit itself is reusable before
  a reference module exists. Narrative and Research must later run this same
  exported suite with their own fixtures.
- The Domain Test UI implementation remains a non-activated backlog proposal
  and is outside this task.
- The reviewed charter was frozen unchanged at `Ready` on 2026-07-30 before
  implementation began.
- Status moved from `Ready` to `In Progress` after the freeze.
- Apply `docs/TASK_WORKFLOW.md` to every discovered item.

## Charter Amendment Log

- None.

## Verification

- [x] Verify the suite uses only public core contracts and test-runner APIs.
- [x] Verify producer and analyzer fixtures execute the identical suite.
- [x] Verify deterministic results and mutation resistance.
- [x] Verify runtime schema and unique-effect-key failures are observable.
- [x] Verify memory-policy methods against caller-supplied outcomes.
- [x] Verify valid and invalid compile-time task examples.
- [x] Verify a module-to-adapter import fails the boundary gate.
- [x] Verify existing repository/gateway conformance remains green.
- [x] Document empty or skipped gates and exact reasons.

Exact evidence on 2026-07-30:

- Frozen install, format, lint, strict typecheck, boundaries and build passed.
- Unit execution passed 14 files and 107 tests.
- Dedicated conformance passed 3 files and 22 tests: 5 repository, 5 gateway
  and 12 DomainModule cases across producer and empty-analyzer fixtures.
- Compile-time checks accepted the valid task fixture and rejected invalid
  task names and task inputs.
- The module-to-adapter negative fixture failed under the intended dependency
  rule; existing core vocabulary and package-boundary checks remained green.
- Integration and scenario gates passed with no files because ExecutionEngine,
  reference modules and ScenarioRunner remain outside this charter.
- Documentation checks covered 46 Markdown files after the resolved backlog
  proposal was removed; `git diff --check` passed.
- No required check was skipped.

## Documentation Updates

- [x] `docs/design/acme-design-and-development-spec.md`
- [x] `docs/design/narrative-module-build-and-test-plan.md`
- [x] `docs/design/research-module-build-and-test-plan.md`
- [x] `docs/design/domain-test-ui-specification.md`
- [x] `docs/backlog/domain-test-ui-implementation.md` dependency updated and
      proposal retained
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/backlog/reusable-domain-module-conformance-kit.md` removed

## Handoff and Follow-ups

- Current state: Complete and archived.
- Next recommended step: Execute the separately approved repository
  documentation synchronization task, then activate one bounded reference
  module.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: None.

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0015_reusable-domain-module-conformance.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes after `Ready`, supersede this task
  instead of rewriting it.
