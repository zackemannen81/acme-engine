# Current Task

Task ID: ACME-0076
Parent Task: None
Status: Draft
Owner: Codex
Created: 2026-08-10
Last updated: 2026-08-11
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
- `docs/adr/0029-poc-1-self-hosted-supabase-persistence-platform.md`
- `docs/design/evidence-integrity-workbench-product-definition.md`

## Task Summary

A task is never considered done until:
`docs/JOURNAL.md`, `docs/SYSTEMDOC.md` and `docs/CURRENT_STATUS.md` are à jour.

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

- Specify one fictional matter and the bounded synthetic text-only corpus a
  later slice must author: its case inventory, immutable artifact-version rules
  and exact locator rules. This task specifies the corpus; it does not write
  the corpus text.
- Define the annotation protocol and the golden-truth format for attribution,
  statement occurrence, correction lineage, changed accounts, temporal
  uncertainty, evidence relations, open questions and assessment provenance,
  including the expected result each required corpus case must produce.
- Define minimal public Evidence-domain concepts, schemas, task map, state,
  memory meaning, reducer/invariant responsibilities and candidate-to-canonical
  flow without importing sandbox sketches wholesale.
- Define versioned read/view contracts required to inspect sources,
  observations, relations, timeline, unresolved questions, assessments,
  provenance and replay.
- Define deterministic mechanical gates, labelled semantic metrics, abstention
  behavior, prohibited-output tests and replay/resume proofs.
- Map every new invariant to ADR-0028, ADR-0029, the product definition or an
  explicitly identified decision still requiring an ADR.
- Define package/application ownership and dependency direction.
- Divide later implementation into bounded, ordered tasks with prerequisites,
  verification gates and clear local-versus-hosted boundaries.
- Update governing documentation only where the accepted technical
  specification changes persistent project reality or authority.

### Out of Scope

- Implementing `EvidenceModule`, application UI/API/worker, fixtures, prompts,
  evaluators, PostgreSQL adapter, object storage, authentication or deployment.
- Authoring the synthetic corpus text, annotation data or golden-output files.
  This task specifies them; the first implementation slice produces them.
- Reopening the POC #1 persistence platform decided by ADR-0029, and selecting
  the identity provider, object-storage vendor, model, hosting platform or
  Supabase component adoption that ADR-0029 leaves open.
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
  versioning and locator scheme, annotation format, the required golden-output
  format with the expected result for every required corpus case, and an
  explicit train/development/evaluation corpus separation, because ADR-0028
  requires model-comparison thresholds to be frozen before any comparison runs.
- Every canonical domain concept in the product definition's concept table has
  a named owner, an identity rule and an explicit placement in canonical state,
  domain memory or immutable document, and every authority level L0 to L5 has a
  defined transition rule into the next level.
- Versioned views cover the complete reviewer path from source through
  observation, relation, timeline, open question, assessment and provenance.
- The proof matrix distinguishes exact mechanical gates, labelled semantic
  metrics, human review and excluded claims.
- Staged implementation slices each have one primary outcome, prerequisites,
  required tests and documentation targets.
- Deferred choices and required future ADRs are explicit; no vendor beyond
  ADR-0029's decided platform and no product implementation is implied.
- Governing documents, indexes and journal are synchronized, documentation
  checks pass and the completed planning task is archived.

### Minimum Verification Gates

Every gate below is satisfied by reviewing the specification this task
produces. None of them may be read as a demand for implementation evidence,
corpus data or fixtures, all of which are Out of Scope.

- [ ] Verify that every authority level and invariant the specification
  proposes traces to ADR-0028, ADR-0029, the normative product definition or an
  explicitly identified decision still requiring an ADR.
- [ ] Verify that every corpus case the specification requires is described
  precisely enough to be mechanically checkable, and that its corpus rules
  exclude real-person, confidential and criminal-offence data.
- [ ] Verify that the specification requires every accepted observation and
  assessment route to terminate in an immutable artifact version plus a valid
  locator, with no specified route that bypasses it.
- [ ] Verify that the specification defines the negative fixtures and refusal
  cases a later implementation task must produce for every prohibited
  legal/credibility conclusion, without producing those fixtures here.
- [ ] Review the specification's package boundaries against ACME's dependency
  direction and core vocabulary guardrails.
- [ ] Review every Mermaid diagram in the specification by hand, and record
  automated Mermaid validation as a deliberately skipped check with that exact
  reason: the repository has no Mermaid validator, and `tooling/docs/check-docs.mjs`
  verifies internal links and balanced fences only.
- [ ] Verify internal Markdown links and balanced fences with
  `pnpm docs:check`.
- [ ] Run `git diff --check` and preserve unrelated worktree changes.

## References

- `docs/adr/0028-first-poc-evidence-integrity-workbench.md`
- `docs/adr/0029-poc-1-self-hosted-supabase-persistence-platform.md`
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
7. Does the deterministic local SQLite implementation precede the self-hosted
   Supabase PostgreSQL adapter work decided by ADR-0029, or is that adapter a
   prerequisite for the first application slice?
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
8. self-hosted Supabase PostgreSQL adapter proof under its own task, with the
   platform already decided by ADR-0029;
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
- ADR-0029 decides the POC #1 persistence platform: self-hosted Supabase, with
  the ACME repository adapter targeting plain PostgreSQL over the wire protocol
  and ACME schemas never exposed to a browser. This task consumes that
  decision; it neither makes nor reopens it, and the components ADR-0029 leaves
  open stay open.
- Corpus boundary, made explicit on 2026-08-11: this task specifies the corpus,
  contracts, views, proof matrix and slice order. Authoring corpus text,
  annotation data and golden-output files belongs to the first implementation
  slice. The earlier Draft wording let the Definition of Done imply data this
  task's Out of Scope forbids.
- Model comparison is in scope for threshold definition only, so the
  train/development/evaluation corpus separation is unconditional. ADR-0028
  requires those thresholds to be frozen before any comparison is run.
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
- [ ] Manual Mermaid review, recorded together with the skipped automated
  Mermaid validation and its reason.
- [ ] Document any further skipped check and exact reason.

## Documentation Updates

Every target below is required. None of them is conditional. A target whose
correct outcome is "unchanged" is closed by recording that outcome and its
reason in `docs/JOURNAL.md`, not by leaving it unexamined.

- [ ] `docs/design/evidence-integrity-workbench-technical-specification.md`
- [ ] `docs/design/README.md`
- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md`
- [ ] `docs/PROJECT_BRIEF.md`
- [ ] `docs/adr/README.md`, plus every ADR the specification identifies as
  required before implementation

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

- Archive this file under `docs/finished/ACME-0076_<task-slug>.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`, or
  populate it with the next explicitly approved implementation task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done becomes invalid after freeze, supersede this
  task instead of rewriting it.
