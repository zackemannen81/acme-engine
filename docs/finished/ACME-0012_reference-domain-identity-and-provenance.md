# Current Task

Task ID: ACME-0012
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
- `docs/design/acme-design-and-development-spec.md`, sections 10, 12, 16,
  17 and 22
- `docs/design/narrative-module-build-and-test-plan.md`
- `docs/design/research-module-build-and-test-plan.md`
- `docs/adr/0002-static-task-typed-module-composition.md`
- `docs/adr/0004-deterministic-transition-identity.md`
- `docs/adr/0005-pure-memory-decision-application.md`
- `docs/adr/0008-post-memory-domain-state-projection.md`
- resolved input:
  `docs/backlog/reference-module-identity-and-provenance-fields.md` (removed by
  this task)

## Task Summary

Resolve the second reference-module implementation gate by freezing the
domain-owned identity and evidence contracts required by NarrativeModule and
ResearchModule before either `@1.0.0` prompt contract is implemented. The
decision must make alias authority and correction evidence deterministic for
Narrative, and proposition identity, source independence and retained claim
evidence deterministic for Research, without adding domain policy to core.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Make both reference domains' identity and provenance inputs explicit,
versioned and replayable so their pure memory policies can resolve candidates
without provider, store, clock or hidden heuristic access.

### Primary Deliverable

An accepted architecture decision plus corrected normative specification and
reference-module guides that freeze the v1 ownership, schema placement,
canonicalization algorithms, compatibility rules and golden vectors for
Narrative alias/correction evidence and Research proposition/source/evidence
identity.

### In Scope

- Add an ADR fixing all reference-domain identity/provenance ownership and
  versioning decisions named by the backlog proposal.
- Define Narrative alias authority, canonical entity-key derivation and the
  exact evidence required before a contradictory character fact may request
  supersession.
- Define which Narrative fields belong to canonical state, contract input,
  contract output, memory-candidate value and immutable provenance.
- Define Research proposition identity and contradiction targeting without a
  model or fuzzy equivalence call inside the memory policy.
- Define explicit versioned Research source identity and independence keys,
  including the roles of declared authority, URI, publisher and document
  identity.
- Define the retained Research claim-evidence shape for URI, publisher,
  document key, locator, quote and independence metadata.
- Correct the pre-implementation `@1.0.0` illustrative contract/state/delta
  schemas and behavior in the normative specification and both build guides.
- Add canonical preimages and SHA-256 golden vectors for every new identity
  algorithm.
- Remove the resolved backlog proposal and update long-lived documentation.

### Out of Scope

- Implementing `@acme/module-narrative`,
  `@acme/module-research`, their prompt contracts, policies, reducers,
  fixtures or scenarios.
- Implementing the separate reusable DomainModule conformance kit.
- Changes to domain-neutral core contracts, MemoryEngine, StateEngine,
  state-projection, repository, model gateway or persistence schemas.
- ExecutionEngine, SQLite, live model providers, ScenarioRunner, CLI behavior
  or deployment.
- General natural-language semantic equivalence, registrable-domain/public
  suffix inference, source fact-checking or external source retrieval.
- Migration tooling for published or persisted reference-domain versions;
  none exist yet.
- Package publication, push, release or other remote mutation.

### Definition of Done

- Narrative aliases have exactly one authoritative persisted location and one
  versioned deterministic entity-key algorithm.
- Narrative correction output identifies the prior value and exact source
  evidence; supersession is forbidden unless deterministic policy checks can
  validate both against current records and the supplied document.
- Research claims carry a canonical proposition and explicit support or
  contradiction target from which versioned keys are derived without fuzzy
  matching.
- Research source identity and source independence are distinct; different
  document IDs or URIs alone cannot assert independence.
- Every Research claim candidate retains immutable source metadata,
  independence assertion, document key, locator and optional quote in its
  domain-owned value while core provenance continues to supply generic
  execution/document traceability.
- Algorithm preimages, normalization, serialized prefixes and golden hashes
  are precise enough for byte-identical future implementations.
- The specification, both build guides, ADR index, status, system
  documentation, file structure and journal agree with the decision.
- The completed backlog proposal is removed and the remaining conformance
  proposal is unchanged except for any required dependency wording.
- All minimum verification gates pass.

### Minimum Verification Gates

- [x] `pnpm docs:check`
- [x] Verify balanced Markdown fences and internal links
- [x] Recompute every documented SHA-256 golden vector from its canonical
      preimage
- [x] Verify the normative schemas assign every backlog field to exactly one
      authoritative boundary
- [x] Verify Narrative and Research guides contain no unresolved identity or
      provenance decision gate
- [x] `git diff --check`

## References

- resolved backlog proposal
  `docs/backlog/reference-module-identity-and-provenance-fields.md` (removed by
  this task)
- `docs/design/acme-design-and-development-spec.md`
- `docs/design/narrative-module-build-and-test-plan.md`
- `docs/design/research-module-build-and-test-plan.md`
- `docs/adr/0002-static-task-typed-module-composition.md`
- `docs/adr/0004-deterministic-transition-identity.md`
- `docs/adr/0005-pure-memory-decision-application.md`
- `docs/adr/0008-post-memory-domain-state-projection.md`
- `packages/core/src/common.ts`
- `packages/core/src/memory.ts`
- `packages/core/src/modules.ts`

## Checklist

- [x] Read the repository workflow and required project context.
- [x] Confirm ACME-0011 is complete and activate the monotonic ACME-0012 ID.
- [x] Classify the identity/provenance backlog item as the next blocking
      reference-module decision gate.
- [x] Freeze the explicitly approved charter before implementation.
- [x] Add the identity/provenance ADR with exact ownership and algorithms.
- [x] Correct the normative specification and both reference-module guides.
- [x] Recompute and verify every identity golden vector.
- [x] Update long-lived documentation and remove the resolved backlog item.
- [x] Run every minimum verification gate and record exact evidence.
- [x] Add a signed completion journal, archive the task and restore the task
      template.

## Decisions and Notes

- The maintainer explicitly requested setup and immediate implementation of
  ACME-0012 on 2026-07-30.
- ACME-0012 activates the next step named by ACME-0011's handoff and the
  remaining reference-module backlog. Reference-module implementation remains
  blocked by the separate shared-conformance proposal.
- The charter moved through `Draft` to `Ready` on 2026-07-30 without semantic
  changes.
- Implementation began after the frozen charter entered `Ready`; status is
  now `In Progress`.
- Blocking discovery: the implemented `PromptContract.validateSemantics()`,
  `ResponsePipeline.process()` and `TaskDefinition.interpret()` boundaries do
  not carry validated contract/task input. Narrative and Research therefore
  cannot verify document-bound quotes or construct source-backed candidate
  evidence without hidden state. Per `TASK_WORKFLOW.md`, ACME-0012 is paused
  while bounded child ACME-0013 adds that required input binding.
- Completed child: ACME-0013 accepted ADR-0010, added non-repairable
  contract-input validation, immutable input-bound response semantics and
  typed task input for interpretation. All child runtime/type/documentation
  gates passed and the parent resumed on 2026-07-30.
- Checkpoint: ADR-0009, the normative specification and both build guides now
  agree on alias authority, correction checks, proposition polarity, source
  independence and retained evidence ownership.
- Checkpoint: all four documented identity vectors reproduced byte-for-byte
  through the implemented `acme-cjson-1` and SHA-256 functions.
- Checkpoint: every minimum verification gate passed after resumption; no
  required check was skipped.
- No task ID was reused: ACME-0011 is already complete, archived and merged.
- Apply `docs/TASK_WORKFLOW.md` to every discovered item.

## Charter Amendment Log

- None.

## Verification

- [x] Verify every identity algorithm declares normalization, canonical JSON
      input, SHA-256 serialization and an immutable algorithm identifier.
- [x] Verify alias/correction positive and rejection cases are normative.
- [x] Verify same-source, independent-source, equivalent-proposition,
      contradictory-proposition and distinct-proposition cases are normative.
- [x] Verify every promoted or contested state entry remains traceable to
      retained domain evidence and generic provenance.
- [x] Verify compatibility consequences are explicit before the v1 prompt
      contracts are implemented.
- [x] Document skipped checks and exact reasons.

Exact parent evidence on 2026-07-30:

- `pnpm docs:check` passed for 43 Markdown files, including internal links and
  balanced fences.
- All four ADR-0009 canonical preimages reproduced their exact documented
  SHA-256 keys through `packages/core/src/hashing.ts`.
- A decision-gate scan found correction provenance, alias authority,
  proposition identity, source independence and evidence shape marked
  resolved in both guides.
- The ADR schema-placement matrix assigns every activated backlog field to one
  authoritative domain/core boundary.
- `git diff --check` passed. No parent check was skipped.
- ACME-0013 separately passed frozen install, format, lint, strict typecheck,
  boundaries, 95 unit tests, 10 dedicated conformance tests, empty
  integration/scenario gates, build and documentation checks after its core
  contract changes.

## Documentation Updates

- [x] `docs/adr/0009-reference-domain-identity-and-provenance.md`
- [x] `docs/adr/README.md`
- [x] `docs/design/acme-design-and-development-spec.md`
- [x] `docs/design/narrative-module-build-and-test-plan.md`
- [x] `docs/design/research-module-build-and-test-plan.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] removed
      `docs/backlog/reference-module-identity-and-provenance-fields.md`

## Handoff and Follow-ups

- Current state: Complete and ready to archive.
- Next recommended step: Explicitly charter the reusable DomainModule
  conformance kit, then activate one bounded reference-module implementation.
- Blockers: None.
- Child tasks: ACME-0013 — complete and archived.
- Resume condition: Satisfied on 2026-07-30.
- Open questions: None.

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0012_reference-domain-identity-and-provenance.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes after `Ready`, supersede this task
  instead of rewriting it.
