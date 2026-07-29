# Current Task — Complete ACME design and development specification

Task ID: ACME-0003
Parent Task: None
Status: Ready
Owner: Codex
Created: 2026-07-29
Last updated: 2026-07-29
Charter frozen at: 2026-07-29

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/README.md`

## Task Summary

Create one complete, self-contained design and development specification for
the greenfield `acme-engine` repository. The document must turn the approved
project brief into an implementable architecture and development plan without
requiring future contributors to infer contracts, package boundaries,
persistence, replay behavior, test strategy or milestone order.

The specification must remain independent of existing product runtimes.

## Task Charter (Frozen)

### Goal

The goal is a version-controlled technical source of truth that can guide
repository bootstrap and the first implementation milestones.

### Primary Deliverable

`docs/design/acme-design-and-development-spec.md`

### In Scope

- The integrated architecture and development design required by the
  Definition of Done below.
- Documentation and ADR proposals needed to make that design implementable.
- Documentation QA and repository handoff for the design artifact.

### Definition of Done

The task is complete when the specification:

- defines audience, assumptions, goals, non-goals and glossary
- defines ownership for execution, contracts, modules, documents, memory,
  state, events, ledger and evaluation
- defines logical architecture, package structure and dependency rules
- provides exact TypeScript contract proposals and runtime-schema ownership
- defines validation, retry, cancellation, idempotency, commit and replay
- defines the SQLite schema and Unit of Work
- specifies NarrativeModule and ResearchModule vertical slices
- specifies evaluator composition for safety
- defines ScenarioRunner, CLI and local developer workflow
- defines deterministic, conformance, integration, fault-injection and live
  model evaluation
- defines observability, provenance, privacy, secrets and retention
- recommends tooling, workspace manager and dependency principles
- defines CI, versioning, compatibility, migration and governance
- provides milestones, work packages, acceptance gates, risks and ADR backlog
- defines the exact first implementation task

### Out of Scope

- implementing runtime packages
- choosing or purchasing a production hosting platform
- live provider calls
- package publication or deployment
- importing an existing product backend
- migrating every narrative prompt or domain capability

### Minimum Verification Gates

The checks under `Verification` are the frozen minimum. They may be
strengthened if design risk is discovered, but not removed or weakened.

## Checklist

### A. Foundation

- [ ] Define document status, audience and normative language.
- [ ] Define glossary and ownership matrix.
- [ ] Define goals, non-goals, assumptions and quality attributes.

### B. Architecture and Contracts

- [ ] Define system context and logical/component architecture.
- [ ] Define workspace, package and folder structure.
- [ ] Define allowed dependency direction and automated boundary gates.
- [ ] Define TaskMap, DomainModule and module roles.
- [ ] Define PromptContract, registries and contract versioning.
- [ ] Define ModelGateway, capabilities and normalized responses.
- [ ] Define ResponsePipeline and validation/repair boundaries.
- [ ] Define ModuleResult and candidate-to-commit lifecycle.

### C. Memory, State and Persistence

- [ ] Define MemoryCandidate, MemoryRecord and DomainMemoryPolicy.
- [ ] Define retrieval, relevance, dedupe, contradiction and lifecycle hooks.
- [ ] Define StateSnapshot, StateDelta, reducer and invariants.
- [ ] Define optimistic concurrency and conflict handling.
- [ ] Define execution/model-call/document/event ledger models.
- [ ] Define SQLite schema, Unit of Work, idempotency and outbox.
- [ ] Define retry, cancellation, timeout, budget and replay protocols.

### D. Reference Domains and Developer Experience

- [ ] Specify NarrativeModule thin slice.
- [ ] Specify ResearchModule thin slice.
- [ ] Specify evaluator/safety composition.
- [ ] Define fixtures and scenarios that prove domain neutrality.
- [ ] Define CLI, ScenarioRunner, inspection and debugging.
- [ ] Recommend language/toolchain/workspace dependencies.

### E. Quality and Delivery

- [ ] Define unit, contract, conformance and integration tests.
- [ ] Define failure injection and crash-recovery tests.
- [ ] Define live model evaluation and cost controls.
- [ ] Define observability, provenance and diagnostic records.
- [ ] Define security, privacy, secrets and retention.
- [ ] Define CI, release, compatibility and governance.
- [ ] Create risk register, anti-patterns and ADR backlog.
- [ ] Define milestones, work packages and acceptance gates.
- [ ] Define the first implementation task in executable detail.

### F. Documentation QA

- [ ] Verify internal links.
- [ ] Verify balanced Markdown fences.
- [ ] Validate or structurally inspect Mermaid diagrams.
- [ ] Check terminology and ownership consistency.
- [ ] Map every requirement to a milestone or explicit future decision.
- [ ] Update status, system, structure and journal documentation.

## Decisions and Notes

- Project name: ACME, Adaptive Context Memory Engine.
- Repository identifier: `acme-engine`.
- ACME naming belongs in project/package metadata, not generic contracts.
- Core must be domain-neutral.
- NarrativeModule and ResearchModule are required proof domains.
- Static registries, model mocks, in-memory stores and SQLite are initial
  defaults.
- ExecutionEngine runs one task; ScenarioRunner composes multiple tasks.
- The specification must recommend, not defer, the initial TypeScript
  toolchain and workspace manager.

## Charter Amendment Log

- 2026-07-29: Added Task ID and reorganized the existing goal, deliverable,
  scope and Definition of Done into the new frozen Task Charter format. This
  is a non-semantic workflow migration; the goal, deliverable and completion
  conditions are unchanged.

## Verification

- [ ] Internal Markdown links resolve.
- [ ] Markdown fences are balanced.
- [ ] Mermaid diagrams are structurally valid and rendered if tooling exists.
- [ ] TypeScript examples are mutually consistent.
- [ ] Ownership terms are used consistently.
- [ ] Every milestone has acceptance and exit gates.
- [ ] `git diff --check` passes.
- [ ] Missing runtime checks are documented as not applicable.

## Documentation Updates

- [ ] `docs/design/acme-design-and-development-spec.md`
- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/FILESTRUCTURE.md`
- [ ] `docs/JOURNAL.md`
- [ ] ADRs required by decisions finalized during design

## Handoff and Follow-ups

- Current state: Docs-first foundation is complete. No runtime implementation
  exists.
- Next recommended step: Draft the specification's glossary, ownership matrix
  and quality attributes before locking code contracts.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: The specification must recommend npm or pnpm workspaces and
  the first live model adapter, with rationale.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md` or
  populate the next explicitly approved implementation task.
- Add a signed `docs/JOURNAL.md` entry.
