# Current Task — Complete ACME design and development specification

Task ID: ACME-0003
Parent Task: None
Status: Complete
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

- [x] Define document status, audience and normative language.
- [x] Define glossary and ownership matrix.
- [x] Define goals, non-goals, assumptions and quality attributes.

### B. Architecture and Contracts

- [x] Define system context and logical/component architecture.
- [x] Define workspace, package and folder structure.
- [x] Define allowed dependency direction and automated boundary gates.
- [x] Define TaskMap, DomainModule and module roles.
- [x] Define PromptContract, registries and contract versioning.
- [x] Define ModelGateway, capabilities and normalized responses.
- [x] Define ResponsePipeline and validation/repair boundaries.
- [x] Define ModuleResult and candidate-to-commit lifecycle.

### C. Memory, State and Persistence

- [x] Define MemoryCandidate, MemoryRecord and DomainMemoryPolicy.
- [x] Define retrieval, relevance, dedupe, contradiction and lifecycle hooks.
- [x] Define StateSnapshot, StateDelta, reducer and invariants.
- [x] Define optimistic concurrency and conflict handling.
- [x] Define execution/model-call/document/event ledger models.
- [x] Define SQLite schema, Unit of Work, idempotency and outbox.
- [x] Define retry, cancellation, timeout, budget and replay protocols.

### D. Reference Domains and Developer Experience

- [x] Specify NarrativeModule thin slice.
- [x] Specify ResearchModule thin slice.
- [x] Specify evaluator/safety composition.
- [x] Define fixtures and scenarios that prove domain neutrality.
- [x] Define CLI, ScenarioRunner, inspection and debugging.
- [x] Recommend language/toolchain/workspace dependencies.

### E. Quality and Delivery

- [x] Define unit, contract, conformance and integration tests.
- [x] Define failure injection and crash-recovery tests.
- [x] Define live model evaluation and cost controls.
- [x] Define observability, provenance and diagnostic records.
- [x] Define security, privacy, secrets and retention.
- [x] Define CI, release, compatibility and governance.
- [x] Create risk register, anti-patterns and ADR backlog.
- [x] Define milestones, work packages and acceptance gates.
- [x] Define the first implementation task in executable detail.

### F. Documentation QA

- [x] Verify internal links.
- [x] Verify balanced Markdown fences.
- [x] Validate or structurally inspect Mermaid diagrams.
- [x] Check terminology and ownership consistency.
- [x] Map every requirement to a milestone or explicit future decision.
- [x] Update status, system, structure and journal documentation.

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

- [x] Internal Markdown links resolve.
- [x] Markdown fences are balanced.
- [x] Mermaid diagrams are structurally valid; rendering tooling is not installed.
- [x] TypeScript examples are mutually consistent by structural inspection.
- [x] Ownership terms are used consistently.
- [x] Every milestone has acceptance and exit gates.
- [x] `git diff --check` passes.
- [x] Missing runtime checks are documented as not applicable.

## Documentation Updates

- [x] `docs/design/acme-design-and-development-spec.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/JOURNAL.md`
- [x] ADRs required by decisions finalized during design

## Handoff and Follow-ups

- Current state: The complete specification and its three accepted ADRs are
  finished. No runtime implementation exists.
- Next recommended step: Explicitly activate the bounded ACME-0004 bootstrap
  task from specification section 26.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: None blocking. Provider reconciliation, encryption/privacy
  deletion and production infrastructure remain deliberate future ADRs.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md` or
  populate the next explicitly approved implementation task.
- Add a signed `docs/JOURNAL.md` entry.
