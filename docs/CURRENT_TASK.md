# Current Task

Task ID: ACME-0076
Parent Task: None
Status: Draft
Owner: Codex
Created: 2026-08-10
Last updated: 2026-08-10
Charter frozen at: Not frozen

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0028-first-poc-evidence-integrity-workbench.md`
- `docs/design/evidence-integrity-workbench-product-definition.md`

## Task Summary

Shape the first implementation-ready technical specification for the Evidence
Integrity Workbench without writing product code. The task converts ADR-0028
and the normative product definition into a bounded synthetic golden-corpus
plan, minimal Evidence-domain contracts, versioned read/view contracts,
evaluation proof matrix and staged implementation slices.

The specification must make the first vertical slice mechanically verifiable
against corpus truth while preserving the product's non-adjudicative authority
boundary. It must also separate the local deterministic proof from later
PostgreSQL, hosted product and non-synthetic data work.

## Task Charter

The charter remains editable while this task is `Draft`. No implementation or
external effect is authorized until the charter is reviewed and frozen at
`Ready`.

### Goal

Define an implementation-ready, traceable technical plan for the first
Evidence Integrity Workbench vertical slices and their synthetic proof corpus.

### Primary Deliverable

A normative
`docs/design/evidence-integrity-workbench-technical-specification.md` that
defines the V1 synthetic corpus and annotation protocol, minimal Evidence
domain contracts, versioned product views, end-to-end proof obligations and an
ordered set of separately activatable implementation slices.

### In Scope

- Define one fictional matter and a bounded synthetic text-only corpus with
  immutable artifact versions and exact locator rules.
- Define the annotation protocol and golden truth for attribution, statement
  occurrence, correction lineage, changed accounts, temporal uncertainty,
  evidence relations, open questions and assessment provenance.
- Define minimal public Evidence-domain concepts, schemas, task map, state,
  memory meaning, reducer/invariant responsibilities and candidate-to-canonical
  flow without importing sandbox sketches wholesale.
- Define versioned read/view contracts required to inspect sources,
  observations, relations, timeline, unresolved questions, assessments,
  provenance and replay.
- Define deterministic mechanical gates, labelled semantic metrics, abstention
  behavior, prohibited-output tests and replay/resume proofs.
- Map every new invariant to ADR-0028, the product definition or an explicitly
  identified decision still requiring an ADR.
- Define package/application ownership and dependency direction.
- Divide later implementation into bounded, ordered tasks with prerequisites,
  verification gates and clear local-versus-hosted boundaries.
- Update governing documentation only where the accepted technical
  specification changes persistent project reality or authority.

### Out of Scope

- Implementing `EvidenceModule`, application UI/API/worker, fixtures, prompts,
  evaluators, PostgreSQL adapter, object storage, authentication or deployment.
- Selecting Supabase, another PostgreSQL provider, identity provider, object
  storage vendor, model or hosting platform.
- Processing PDFs, images, audio, video, OCR, URLs or external search in V1.
- Processing real confidential, privileged, criminal-offence or identifiable
  case data.
- Determining credibility, truthfulness, guilt, liability, admissibility,
  privilege, evidentiary weight or legal sufficiency.
- Giving tailored legal advice or automating a legal, justice or law-
  enforcement high-impact decision.
- Defining production compliance, DPIA, legal classification or professional
  workflow fitness.
- Activating Research Synthesis POC #2.
- Selecting ACME or docs-first licensing/open-source strategy.
- Changing `packages/core`, existing reference modules or retrieval
  algorithms.

### Definition of Done

- The technical specification defines a finite corpus inventory, artifact
  versioning and locator scheme, annotation format, golden outputs and an
  explicit train/development/evaluation separation if model comparison is in
  scope.
- Minimal Evidence-domain contracts and ownership are complete enough that a
  later implementation task does not need to invent authority levels or state
  semantics while coding.
- Versioned views cover the complete reviewer path from source through
  observation, relation, timeline, open question, assessment and provenance.
- The proof matrix distinguishes exact mechanical gates, labelled semantic
  metrics, human review and excluded claims.
- Staged implementation slices each have one primary outcome, prerequisites,
  required tests and documentation targets.
- Deferred choices and required future ADRs are explicit; no managed provider
  or product implementation is implied.
- Governing documents, indexes and journal are synchronized, documentation
  checks pass and the completed planning task is archived.

### Minimum Verification Gates

- [ ] Trace every proposed authority level and invariant to ADR-0028 or the
  normative product definition.
- [ ] Review every golden-corpus item for mechanical verifiability and absence
  of real-person or confidential case data.
- [ ] Prove that every accepted observation and assessment route terminates in
  an immutable artifact version plus valid locator.
- [ ] Verify that prohibited legal/credibility conclusions have explicit
  negative fixtures or refusal cases.
- [ ] Review package boundaries against ACME's dependency direction and core
  vocabulary guardrails.
- [ ] Verify internal Markdown links and balanced fences with
  `pnpm docs:check`.
- [ ] Run `git diff --check` and preserve unrelated worktree changes.

## References

- `docs/adr/0028-first-poc-evidence-integrity-workbench.md`
- `docs/design/evidence-integrity-workbench-product-definition.md`
- `docs/design/first-poc-application-discovery.md` as historical discovery
- `docs/concepts_sandbox/legal-evidence-on-acme/` as non-authoritative input
- `docs/design/acme-design-and-development-spec.md`
- ADR-0008, ADR-0009, ADR-0010, ADR-0012, ADR-0017, ADR-0018, ADR-0025 and
  ADR-0026
- Existing DomainModule, repository, evaluation and view conformance kits

## Proposed Technical Questions Before Freeze

1. What is the smallest corpus that still proves changed accounts,
   corrections, contradictions, artifact conflict and uncertain time?
2. Which artifact types are needed beyond interview transcript and structured
   exhibit text?
3. Is the first execution task observation extraction only, with relations and
   assessments as later tasks, or should the first slice include one relation?
4. Which concepts belong in canonical state versus domain memory versus
   immutable documents?
5. Which views are pure projections over ACME evidence and which require
   application-owned review records?
6. What exact labelled metrics and thresholds freeze before any model
   comparison?
7. Does the deterministic local implementation precede PostgreSQL adapter work,
   or is PostgreSQL a prerequisite for the first application slice?
8. Is the first reviewer mode single-user/local, or must identity and approval
   roles exist in the first product shell?
9. Which decisions constrain multiple packages or compatibility and therefore
   require a new ADR before implementation?

## Proposed Starting Assumptions for Review

- One entirely fictional matter, text-only, with no real-person identity.
- Transcript and exhibit-text artifacts only; exact line or paragraph
  locators; no OCR or media ingestion.
- Deterministic local/offline proof first using existing ACME composition,
  followed by a separately chartered PostgreSQL adapter and hosted slice.
- Precision-first behavior with explicit abstention and unresolved states.
- Model output creates candidates only; domain validation and explicit human
  review precede shareable assessment status.
- The first implementation slice should prove immutable source-bound
  observations before relations, timeline and assessments are layered on.
- Application review records remain separate from core execution evidence.

These assumptions are proposals only and may change while the task remains
`Draft`.

## Proposed Implementation Slice Order

The planning task should confirm, split or replace this sequence before it is
frozen:

1. synthetic corpus and annotation fixtures;
2. pure Evidence schemas, identities, reducer and invariants;
3. Evidence DomainModule conformance and observation task;
4. offline ExecutionEngine golden scenario and replay/resume proof;
5. relation, timeline and assessment domain slices;
6. pure versioned reviewer views;
7. local application shell and explicit human review workflow;
8. PostgreSQL adapter proof under its own ADR/task;
9. hosted synthetic-corpus pilot;
10. separate readiness work before any non-synthetic path.

## Checklist

- [ ] Review this Draft's proposed scope and technical questions with the
  maintainer.
- [ ] Inventory accepted Evidence meanings and deferred sandbox concepts.
- [ ] Design the synthetic matter, corpus matrix and annotation protocol.
- [ ] Define minimal domain contracts, identity and ownership.
- [ ] Define versioned views and human-review records.
- [ ] Define proof matrix, thresholds and prohibited-output fixtures.
- [ ] Define dependency boundaries and required ADRs.
- [ ] Produce separately activatable implementation slices.
- [ ] Write and cross-review the normative technical specification.
- [ ] Synchronize relevant governing docs and indexes.
- [ ] Verify, journal, archive and restore the next real task state.

## Decisions and Notes

- ADR-0028 and the product definition are already authoritative. This task may
  refine implementation detail but must not weaken their immutable V1
  restrictions.
- The Legal/Evidence sandbox may supply discovery input only. Public contracts
  must be derived through this task's accepted specification.
- POC means a complete platform/reference-application proof, not a commitment
  to sell the application as a service.
- A checkpoint after every substantive step is required. Checklist and handoff
  state must remain truthful.
- Discoveries must follow `docs/TASK_WORKFLOW.md`; this Draft must be split
  before freeze if it contains independently valuable deliverables.

## Charter Amendment Log

- none; charter not frozen

## Verification

- [ ] Draft review completed before transition to `Ready`.
- [ ] Corpus and annotation consistency review.
- [ ] Authority/invariant traceability matrix review.
- [ ] Architecture and dependency-boundary review.
- [ ] `pnpm docs:check`.
- [ ] `git diff --check`.
- [ ] Document any skipped check and exact reason.

## Documentation Updates

- [ ] `docs/design/evidence-integrity-workbench-technical-specification.md`
- [ ] `docs/design/README.md`
- [ ] `docs/CURRENT_STATUS.md` if an accepted technical baseline changes
  current project status
- [ ] `docs/SYSTEMDOC.md` if durable product architecture is accepted
- [ ] `docs/PROJECT_BRIEF.md` only if approved direction is clarified without
  changing the accepted product
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md`
- [ ] ADR index and new ADRs only when the specification accepts qualifying
  cross-package or compatibility decisions

## Handoff and Follow-ups

- Current state: Draft charter only; no technical specification or product
  implementation has begun.
- Next recommended step: review the proposed assumptions, corpus boundary and
  slice ordering, then revise this Draft before any `Ready` transition.
- Blockers: none for planning. Implementation remains blocked until this task
  completes and later implementation charters are explicitly activated.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: the nine proposed technical questions above.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore the inactive task template or populate the next explicitly approved
  implementation task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done becomes invalid after freeze, supersede this
  task instead of rewriting it.
