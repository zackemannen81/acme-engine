# Current Task

Task ID: ACME-0014
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-07-30
Last updated: 2026-07-30
Charter frozen at: 2026-07-30

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/design/acme-design-and-development-spec.md`, sections 5, 13–15 and
  18–22
- `docs/design/narrative-module-build-and-test-plan.md`
- `docs/design/research-module-build-and-test-plan.md`
- `docs/adr/0002-static-task-typed-module-composition.md`
- `docs/adr/0006-aggregate-in-memory-unit-of-work.md`
- `docs/adr/0007-deterministic-model-mock-and-gateway-conformance.md`
- `docs/adr/0008-post-memory-domain-state-projection.md`

## Task Summary

ACME's verification story is currently expressed only as command-line gates,
scenario YAML and prose test matrices. Domain engineers configuring a
reference-module test, and reviewers judging its outcome, have no described
human surface for setting up a run, observing what the engine actually did and
measuring whether the result is acceptable.

This task packages that surface as a reviewable specification. It defines a
domain-test user interface for configuring, executing, inspecting, validating
and measuring domain tests over the existing ACME boundaries, without
implementing any part of it and without changing an approved contract.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Give the team an approvable specification for a domain-test user interface
that operates strictly over ACME's existing ports, ledger evidence and
deterministic verification model.

### Primary Deliverable

`docs/design/domain-test-ui-specification.md`: a normative Markdown
specification covering the interface's purpose, architectural position,
surface map, configuration model, engine read/write contract, measurement
catalog, safety rules, phased build order, its own verification plan and the
decisions that must be approved before implementation.

### In Scope

- Define the interface's audience, jobs and explicit non-goals.
- Place the interface in the approved dependency direction and state which
  dependencies are forbidden to it.
- Define the interface's vocabulary and map it onto the approved test layers,
  execution lifecycle, ledger evidence and memory/state boundaries.
- Specify every screen surface with its purpose, inputs, evidence sources and
  machine-readable view contract.
- Specify a declarative test-plan configuration model that compiles into the
  approved `acme-scenario/1` format and `ExecutionRequest`, without becoming a
  second source of truth.
- Specify exactly what the interface may read and the few writes it may
  perform.
- Specify the measurement catalog, derived from the approved observability
  metrics and mandatory deterministic tests.
- Specify determinism, redaction, retention, budget and safety rules the
  interface must enforce.
- Specify the interface's own verification plan.
- Provide an ordered build sequence with exit criteria and readiness
  prerequisites.
- Record the unresolved decisions as explicit decision gates.
- Record the non-activated implementation proposal under `docs/backlog/`.
- Update long-lived repository documentation, journal and file structure.

### Out of Scope

- Implementing any interface, server, view model, component or test.
- Implementing or changing ExecutionEngine, ScenarioRunner, CLI, adapters,
  modules or core contracts.
- Choosing a concrete UI framework, component library or visual design system.
- Resolving the open reusable DomainModule-conformance gate.
- Repairing the ADR-0009 and ADR-0010 documentation gap inherited from
  ACME-0012 and ACME-0013.
- Live provider behavior, deployment, publication, push or release.

### Definition of Done

- The specification exists, is internally linked and is consistent with the
  approved design specification and current `@acme/core` contracts.
- It contains audience and non-goals, architectural position, vocabulary,
  surface map, configuration model, engine read/write contract, measurement
  catalog, safety rules, build order, verification plan, decision gates and a
  team review checklist.
- Every described surface names the approved evidence it reads; no surface
  invents canonical state, a second ledger or a domain branch in core.
- The configuration model compiles to approved artifacts and adds no
  undeclared contract.
- Determinism, redaction, retention and budget rules match sections 19 to 21
  of the design specification.
- Readiness prerequisites make clear that the interface cannot be implemented
  before the missing engine layers exist.
- The non-activated implementation proposal is recorded in `docs/backlog/`.
- Documentation checks introduce no new failure attributable to this task and
  `git diff --check` passes.
- Journal, status, file structure, archival and restored task template reflect
  reality.

### Minimum Verification Gates

- [x] Internal Markdown links resolve for every file this task adds or edits
- [x] Balanced Markdown fences in every added or edited file
- [x] Mermaid blocks are structurally balanced and readable
- [x] The specification contains every required section
- [x] `pnpm docs:check`, with any pre-existing inherited failure recorded
      exactly
- [x] `git diff --check`

## References

- `docs/design/acme-design-and-development-spec.md`
- `docs/design/narrative-module-build-and-test-plan.md`
- `docs/design/research-module-build-and-test-plan.md`
- `docs/PROJECT_BRIEF.md`
- `docs/SYSTEMDOC.md`
- `docs/CURRENT_STATUS.md`
- ADR-0002, ADR-0006, ADR-0007 and ADR-0008

## Checklist

- [x] Read the repository workflow, approved architecture and current status.
- [x] Rebase the task branch onto the merged `origin/main` containing
  ACME-0012 and ACME-0013.
- [x] Activate and freeze the explicitly requested ACME-0014 charter.
- [x] Draft the specification's framing, architectural position and
  vocabulary.
- [x] Specify the surface map and per-surface evidence sources.
- [x] Specify the configuration model and engine read/write contract.
- [x] Specify the measurement catalog and safety rules.
- [x] Specify the build order, readiness prerequisites and verification plan.
- [x] Record the decision gates and the backlog proposal.
- [x] Run documentation and diff verification.
- [x] Update long-lived docs and add a signed journal entry.
- [x] Archive ACME-0014 and restore the task template.

## Decisions and Notes

- The user's explicit request on 2026-07-30 approves this bounded
  documentation-packaging task. The branch
  `claude/TestUI_Specification_ACME-0014` names the task; the chat reference to
  `ACME-0013` conflicts with the completed child task of ACME-0012 that is
  already on `main`, so `ACME-0014` is used as the unique identifier required
  by `docs/TASK_WORKFLOW.md`.
- Markdown is the normative, reviewable source. No presentation rendition is
  requested for this task.
- The specification separates approved baseline, recommendation and decision
  gate using the same convention as the two reference-module guides.
- No ADR is required. This task records a proposed application surface and its
  unresolved decisions without changing a public contract, dependency
  direction, persistence semantics or compatibility rule. The first ADR
  belongs to the activation task that chooses the runtime and configuration
  schema.
- Discovered on the first rebase: `docs/adr/README.md`, the design
  specification and both reference-module guides linked to `docs/adr/0009-*.md`
  and `docs/adr/0010-*.md`, but neither file existed on `origin/main`, and the
  ACME-0012 and ACME-0013 task files were not archived under `docs/finished/`.
  This was inherited from another contributor's merged work and was reported
  rather than repaired here. The maintainer merged the missing files as
  `719f46c` during this task; the branch was rebased onto it and the
  specification was then sharpened against the readable ADR-0009 and ADR-0010
  text.
- Apply `docs/TASK_WORKFLOW.md` to every discovered item.

## Charter Amendment Log

- None.

## Verification

- [x] Verify the interface never becomes a second source of canonical truth.
- [x] Verify every surface reads only approved ports, ledger or report
  evidence.
- [x] Verify determinism, redaction, retention and budget rules match the
  approved specification.
- [x] Verify approved requirements, recommendations and decision gates are
  distinguishable.
- [x] Verify readiness prerequisites prevent implementation over missing
  engine layers.
- [x] Record exact checks and any skipped verification.

Verification evidence:

- `node tooling/docs/check-docs.mjs` passed cleanly for 47 Markdown files after
  the branch was rebased onto `719f46c`.
- On the earlier base `99e5928` the same check failed with 10 pre-existing
  broken links to the then uncommitted ADR-0009 and ADR-0010 files. Those 10
  errors reproduced on unmodified `origin/main` and none referenced a file
  added or edited by ACME-0014. The maintainer merged the missing ADRs and the
  ACME-0012 and ACME-0013 archives on 2026-07-30, which resolved them.
- Every internal link added by this task was resolved individually against the
  working tree, including its section anchors.
- The specification contains all required sections and four balanced fenced
  blocks, one of them a readable Mermaid diagram.
- `git diff --check` passed.
- No runtime, typecheck, lint, boundary, build or test gate applies. This task
  adds no source file and changes no package.

## Documentation Updates

- [x] `docs/design/domain-test-ui-specification.md`
- [x] `docs/design/README.md`
- [x] `docs/backlog/domain-test-ui-implementation.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`

## Handoff and Follow-ups

- Current state: The domain-test UI specification, its backlog activation
  proposal and the long-lived documentation updates are complete and ready for
  team review.
- Next recommended step: Review the specification's decision gates. The
  interface cannot be chartered for implementation until ExecutionEngine,
  ScenarioRunner and a durable adapter exist.
- Blockers: None for this documentation task.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: None. The inherited ADR-0009, ADR-0010 and archive gap was
  resolved by the maintainer's `719f46c` merge during this task, and
  `pnpm docs:check` now passes.

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0014_domain-test-ui-specification.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes after `Ready`, supersede this task
  instead of rewriting it.
