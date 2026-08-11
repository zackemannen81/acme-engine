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

The specification must additionally keep the POC a product. The named failure
mode is an application whose visible result is execution status, quality scores
or internal state: that is a second Domain Test UI, not a proof that ACME
supports a real application. The Primary Product Rule under
`Accepted Product Separation` exists to make that failure detectable rather
than a matter of taste.

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
domain contracts, versioned product views, the product/engine separation,
end-to-end proof obligations and an ordered set of separately activatable
implementation slices.

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
- Freeze the Primary Product Rule and the domain-provenance versus
  engine-provenance distinction as normative product constraints.
- Define versioned read/view contracts required to inspect sources,
  observations, relations, timeline, unresolved questions, assessments,
  provenance and replay, and classify every one of them as primary-domain or
  secondary-technical-audit.
- Define the primary entry screen's job in reviewer terms, so the first surface
  is a working view rather than a file list.
- Define the Reviewed Evidence Assessment as the product's durable outcome
  object, including a deterministic export whose citations resolve without the
  application, scoped to the synthetic corpus only.
- Define the derived staleness model and its reviewer-facing behavior.
- Define deterministic mechanical gates, labelled semantic metrics, abstention
  behavior, prohibited-output tests, replay/resume proofs and the two product
  acceptance tests (domain black-box and ACME contribution).
- Map every new invariant to ADR-0028, ADR-0029, the product definition or an
  explicitly identified decision still requiring an ADR.
- Define package/application ownership and dependency direction.
- Divide later implementation into bounded, ordered tasks expressed as reviewer
  capabilities, with prerequisites, verification gates and clear
  local-versus-hosted boundaries.
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
- Rebuilding Domain Test UI surfaces (S1 to S11) inside the Evidence
  application, or taking `apps/test-ui` as an application dependency. The
  secondary audit surface may hand off to it; it must not absorb it.
- Making engine provenance, execution identity, digests or evaluation
  vocabulary part of the primary reviewer workflow.
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
  versioning and locator scheme, canonicalization rules, annotation format, the
  required golden-output format with the expected result for every required
  corpus case, and an explicit development versus sealed-evaluation corpus
  separation, because ADR-0028 requires model-comparison thresholds to be
  frozen before any comparison runs.
- Every canonical domain concept in the product definition's concept table has
  a named owner, an identity rule and an explicit placement in canonical state,
  domain memory or immutable document, and every authority level L0 to L5 has a
  defined transition rule into the next level.
- The Primary Product Rule is stated normatively, every view is classified as
  primary-domain or secondary-technical-audit, and no primary view contract
  requires the client to understand an ACME execution, memory or state object.
- Versioned views cover the complete reviewer path from source through
  observation, relation, timeline, open question, assessment and provenance.
- The proof matrix distinguishes exact mechanical gates, labelled semantic
  metrics, human review and excluded claims, and every comparison threshold is
  written with the denominator it is measured against.
- The ACME contribution table names, for each valuable product behavior, the
  ACME property that makes it possible or robust.
- Staged implementation slices each have one primary outcome expressed as a
  reviewer capability, prerequisites, required tests and documentation targets.
  Only the foundation slice may end without a visible capability.
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
- [ ] Verify that the specification defines both product acceptance tests as
  mechanical checks a later task can execute, not as review opinions: a
  disable-technical-audit configuration the primary journey is exercised
  behind, and a forbidden-vocabulary check over primary view contract field
  names and user-facing strings.
- [ ] Verify that the specification's staleness model is derived from recorded
  revisions and citation identity only, with no model-scored or inferred
  relevance ranking anywhere in it.
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
- `docs/design/domain-test-ui-specification.md` for the surface this product
  must not duplicate
- `docs/concepts_sandbox/legal-evidence-on-acme/` as non-authoritative input
- `docs/design/acme-design-and-development-spec.md`
- ADR-0008, ADR-0009, ADR-0010, ADR-0012, ADR-0017, ADR-0018, ADR-0025 and
  ADR-0026
- Existing DomainModule, repository, evaluation and view conformance kits

## Accepted Product Separation

### Primary Product Rule

> The primary Evidence Integrity Workbench workflow MUST solve the
> evidence-review problem without exposing or requiring ACME execution
> concepts. Source provenance is part of the product workflow. Engine
> provenance and replay are secondary technical evidence. A reviewer MUST be
> able to complete the primary journey while all technical-audit surfaces are
> disabled.

The distinction the rule rests on:

- **Domain provenance** is a primary product function: artifact version,
  locator, observation, relation endpoint, reviewer decision.
- **Engine provenance** is secondary technical evidence: execution identity,
  model call, operation digest, state transition, replay report.

The three surfaces stay separate:

| Surface | Question it answers |
| --- | --- |
| Domain Test UI | Does ACME work? |
| Evidence Integrity Workbench | Can I solve this evidence-review problem? |
| Contribution table | What did ACME add when we solved it? |

### Proof 1 — domain black-box test

Run the workbench with technical audit disabled. A reviewer must be able to
open the corpus, read a source, review proposed observations beside the exact
source text, accept, reject or leave unresolved, compare changed accounts
without losing the earlier one, see relations and their exact endpoints,
understand what the timeline permits without invented precision, see open
questions and uncertainty, create and accept a source-bound assessment, and add
new evidence so the earlier assessment goes out of date and a new version is
created.

The journey must complete without CLI, raw JSON, database access, execution
identifiers, operation digests, state or memory inspectors, or scenario and
evaluation vocabulary.

### Proof 2 — ACME contribution test

For every valuable product behavior, the specification names the ACME property
that makes it possible or robust: source tracing to an exact artifact version
and locator; coexisting changed accounts; uncertain time that stays uncertain;
partial contradiction scoped to the incompatible part only; new evidence that
dates an earlier assessment; revised assessments whose history survives;
interrupted work that resumes without a duplicate provider call; and
after-the-fact verification through replay.

This table is the demonstration of ACME. It must not become the product's
primary navigation.

### Negative gate

An implementation fails as a product POC if its main visible result is
execution status, test results, a quality score or internal state.

## Technical Questions and Accepted Answers

The nine questions this Draft opened are answered below. The answers are inputs
the specification must honor; the specification still owns their exact schemas,
names and wording.

1. **Smallest corpus.** The evaluation core is four logical artifacts in five
   immutable versions: a first interview, an explicitly corrected transcription
   of that same interview, a later changed account from the same person, an
   incompatible or partially incompatible account from a second person, and a
   structured log that arrives after the first assessment and contradicts the
   temporal part of both accounts. That core proves correction versus changed
   account, two actors that are never merged, approximate and ranged time
   against exact log time, partial rather than total contradiction, an
   ambiguous name, assessment staleness and idempotent re-import. Provider
   interruption and replay need no extra text; they are run scenarios over the
   same artifacts. Around that core: a development subset of one transcript
   plus one exhibit, and one standalone transcript for prompt scratch work.
   Total seven logical artifacts in eight immutable versions, with actors and
   events disjoint between subsets.
2. **Artifact types.** Two only: `interview-transcript` and
   `structured-exhibit-text`. A corrected transcript is a new version, not a
   new type. Manifest, annotation truth, assessments and review records are
   control or product data, not source artifacts. Locators are line-based only.
3. **First execution task.** Observation extraction only, as a single task in
   the shape of `evidence.observe-artifact@1.0.0`, producing candidates for
   statement occurrence, exhibit assertion, actor reference and temporal bound.
   It creates no L3 relation. Relations need several already-accepted
   observations, a different input shape and their own abstention and scope
   rules, so they are a separate ACME task with separate proof. The corpus
   golden truth nevertheless contains the relations from the start, so the truth
   set does not churn when the relation slice is activated. Correction lineage
   is proved in the first slice through the artifact version predecessor.
4. **Placement.** Product or application owns case workspace, import jobs, user
   identity and review decisions. Immutable documents hold source artifact
   versions, the locator index and assessment versions. Domain memory holds
   statement occurrences, exhibit assertions, accepted propositions and events,
   evidence relations, open questions and actor resolution. Canonical state
   holds a compact index of current memory and document identifiers, the
   evidence revision and each item's standing. Locator, actor reference and
   temporal bound are embedded value objects, not registers of their own. State
   never copies source text or whole observation objects; it expresses current
   standing and references stable memory identifiers, matching the state and
   memory boundary in `docs/SYSTEMDOC.md`. Relations live in memory with every
   relation version immutable: no merge, no forget, and a change creates a new
   version that state points at. Assessment versions carry their basis evidence
   revision.
5. **Views and review records.** Pure over ACME evidence and immutable
   documents: source and observation view, observation ledger, timeline, open
   questions, execution provenance, replay, and a relation's endpoints,
   rationale and domain status. Requiring application-owned records: workspace,
   import and job status, review queue, who accepted or rejected a relation,
   assessment accept/reject/request-revision, shareable status, and review
   history with rationale. The assessment view needs both, so human approval is
   an overlay and never a mutation of ACME evidence. Every review decision
   binds to an explicit object version, never to "current".
6. **Metrics and thresholds.** The mechanical gates in the product definition
   are adopted unchanged. Any measure whose correct value is 100% belongs in
   those gates rather than in the model-comparison table. Comparison thresholds
   are expressed as absolute counts wherever the denominator is below roughly
   fifty, and every threshold is written together with its denominator.
   Measurement rules: measure after deterministic and domain validation but
   before human correction; rejected or abstained output counts as a false
   negative wherever a golden object exists; a correct unresolved is a true
   positive for deliberately ambiguous cases; there is no composite quality
   score. A candidate model must pass every hard gate first, then be compared
   on precision, then recall, then cost and latency. Percentages are regression
   gates, not statistical evidence, and the share of assessments requiring major
   rewrite is a measured baseline rather than a gate.
7. **SQLite or PostgreSQL first.** SQLite first. Corpus, Evidence contracts,
   module and task, offline golden scenarios, replay and resume, pure views,
   local reviewer shell, then the PostgreSQL adapter, then the hosted API and
   worker. PostgreSQL is required for the hosted slice, not for the first
   application proof; ADR-0029 keeps SQLite the deterministic development and
   CI default.
8. **First reviewer mode.** Single-user and local, but with identity fields
   from day one: one configured local reviewer reference, append-only review
   decisions, mandatory rationale and timestamp, one reviewer role, and no
   login, invitation, session handling or role matrix. Every V1 review decision
   also records that its principal is unauthenticated, so a later hosted slice
   can tell V1 decisions from authenticated ones without rewriting history. The
   approval contract exists now; identity infrastructure comes later.
9. **New ADRs.** Two are required before the first implementation: *Evidence V1
   identity and canonical placement*, freezing identity algorithms, schema and
   task versions, correction versus changed account and the document, memory
   and state placement; and *Evidence reviewer, review overlay and versioned
   view boundary*, freezing that review records are application-owned, that
   views are pure versioned contracts, how approval, shareability and staleness
   are derived without mutating evidence, and the Primary Product Rule.
   Required before their own later slices: PostgreSQL schema, transaction
   boundary and migrations; identity provider and authorization; object storage
   and consistency between artifact store and database; and every future
   non-synthetic data path, which ADR-0028 already requires. The corpus
   narrative, annotation format, thresholds, local-first ordering and the choice
   of two artifact types need no ADR: they are specification and evaluation
   decisions, not general architecture contracts.

## Accepted Specification Constraints

### Corpus and source binding

- One entirely fictional matter, text-only, with no real-person identity.
- Seven logical artifacts in eight immutable versions, split into an open
  development subset and a sealed evaluation subset. The evaluation golden
  truth is never read during prompt development. The word "train" is not used:
  nothing is trained, and the vocabulary would promise a statistical
  generalization this corpus cannot support.
- Each golden case must be independently assertable. Where one artifact
  necessarily carries several traps, the specification states that coupling
  explicitly so a single extraction failure is not mistaken for several
  independent failures.
- Canonicalization is part of artifact version identity: UTF-8, LF line
  endings, NFC, one-based inclusive line numbering, no other transformation,
  and the content hash taken over the canonicalized bytes.
- Locator granularity is the line range. Quote validation is exact substring
  matching within the addressed range, which is what makes the quote gate
  mechanical without character offsets that drift.
- Precision-first behavior with explicit abstention and unresolved states.
- Model output creates candidates only; domain validation and explicit human
  review precede shareable assessment status.
- Application review records remain separate from core execution evidence.

### Staleness and re-review

The reviewer-facing behavior is part of the product, not a UI detail, because a
correct-but-alarming staleness model would push reviewers to ignore it.

- Staleness is derived, never a stored verdict: an assessment is out of date
  exactly when the workspace evidence revision exceeds its effective basis
  revision.
- Every out-of-date marker carries the mechanical delta since that basis: what
  was added, in what count, and to which artifact versions.
- Two deterministic tiers rank attention without judging relevance: new evidence
  bound to something the assessment cites (same artifact version, actor
  reference, relation endpoint or overlapping temporal bound) and new evidence
  elsewhere. This is set intersection over identifiers. It must be specified as
  a named deterministic rule so it cannot later drift into a model-scored
  relevance ranking.
- The accepted version's presentation never changes. It carries a factual basis
  byline stating what evidence it was accepted against, and is never struck
  through or marked as failed. Its acceptance was valid at its basis revision
  and remains so.
- Out-of-date notices batch at the import-job boundary, so one import produces
  one event with a list rather than one notice per affected assessment.
- Reaffirmation is first-class and as cheap as revision: a `reaffirm` review
  decision records the assessment version, the new basis revision, the reviewer,
  a rationale and the time, without minting a content-identical assessment
  version. Effective basis is then derived as the latest reaffirmed revision.
- No automatic revision, and no "probably unaffected" classification. The
  product must never quietly decide an assessment still holds.
- Out-of-date shares the visual weight of unread, never of error. Error styling
  is reserved for real failures such as a failed import or a broken locator.
- The word "stale" does not appear in user-facing language. The marker states
  what happened, not a verdict about the assessment.

## Accepted Implementation Slice Order

Every slice after the foundation ends in a visible reviewer capability, not
merely a new package or schema family. Each becomes its own charter.

0. **Corpus and contracts foundation.** Internal groundwork; no product claim.
1. **Review one source.** Import a text source, display it, propose
   observations, review them beside the exact text and click back to the
   locator. This is the first real product vertical and must carry standalone
   value from independent observations alone, before any relation view exists.
2. **Compare accounts.** Two accounts, changed accounts and the correction
   lineage, with nothing overwritten.
3. **Relations and uncertainty.** Contradictions, qualifications, scope
   mismatch and unresolved.
4. **Timeline and open questions.** Deterministic ordering with exact, range,
   approximate and unknown time.
5. **Assessment and re-review.** Create an assessment, decide on it, add
   evidence, see it go out of date and create a new version.
6. **Secondary technical audit.** Provenance, execution evidence and replay, or
   a handoff to the Domain Test UI.
7. **Self-hosted Supabase PostgreSQL adapter**, with the platform already
   decided by ADR-0029.
8. **Hosted shell.** The same reviewer journey on the decided platform.
9. **Separate readiness work** before any non-synthetic path.

## Checklist

- [x] Review this Draft's proposed scope and technical questions with the
  maintainer.
- [x] Record the accepted answers to the nine technical questions.
- [x] Record the Primary Product Rule, the two product acceptance tests and the
  accepted staleness model.
- [ ] Inventory accepted Evidence meanings and deferred sandbox concepts.
- [ ] Design the synthetic matter, corpus matrix and annotation protocol.
- [ ] Define minimal domain contracts, identity and ownership.
- [ ] Define versioned views, their primary/secondary classification and
  human-review records.
- [ ] Define the primary entry screen's job and the Reviewed Evidence
  Assessment outcome object with its deterministic export.
- [ ] Define proof matrix, thresholds, denominators and prohibited-output
  fixtures.
- [ ] Define dependency boundaries and the two required ADRs.
- [ ] Produce separately activatable implementation slices as reviewer
  capabilities.
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
  slice.
- Model comparison is in scope for threshold definition only, so the
  development versus sealed-evaluation separation is unconditional. ADR-0028
  requires those thresholds to be frozen before any comparison is run.
- The Primary Product Rule is recorded here so the specification can freeze it,
  and question 9 requires it to reach an ADR before the first implementation
  slice. It is the kind of constraint that erodes silently, so a review opinion
  is not sufficient protection; both product acceptance tests must be specified
  as executable checks.
- Both product acceptance tests were deliberately made mechanical. A
  disable-technical-audit configuration and a forbidden-vocabulary check over
  primary view contracts hold a line over time; a written principle does not.
- The deterministic two-tier staleness ranking uses citation identity only. It
  is not a relevance judgment and must never become one: ADR-0028 forbids the
  model from acting as relevance or credibility authority, and the product
  definition forbids presenting absence of evidence as proof.
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
- [ ] Product separation review: Primary Product Rule, view classification and
  both acceptance tests.
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

- Current state: Draft charter with the nine technical questions answered, the
  product separation accepted and the slice order restated as reviewer
  capabilities. No technical specification or product implementation has begun.
- Next recommended step: freeze the charter at `Ready`, then write the
  specification against the accepted answers and constraints.
- Blockers: none for planning. Implementation remains blocked until this task
  completes and later implementation charters are explicitly activated.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none blocking freeze. The two required ADRs are named but not
  yet written, and the specification owns the exact schemas, identifiers and
  wording behind every accepted answer above.

## Finalize When Complete

- Archive this file under `docs/finished/ACME-0076_<task-slug>.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`, or
  populate it with the next explicitly approved implementation task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done becomes invalid after freeze, supersede this
  task instead of rewriting it.
