# Current Task

Task ID: ACME-0074
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-09
Last updated: 2026-08-09
Charter frozen at: 2026-08-09

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- Relevant ADRs under `docs/adr/`

## Task Summary

Accept and lock the Evidence Integrity Workbench as ACME's first real POC,
replacing ACME-0073's provisional Research-first recommendation with a
normative product definition, explicit safety and authority boundaries, a V1
verification model and a durable architecture decision.

## Task Charter

### Goal

Make the first-POC product direction unambiguous and safe to use as the input
to a later implementation charter.

### Primary Deliverable

An accepted, repository-authoritative Evidence Integrity Workbench product
definition, with ADR-0028 recording the product selection and immutable V1
boundaries.

### In Scope

- Define the product purpose, first consumer, business-value hypothesis and
  end-to-end V1 journey.
- Define the observation, proposition, evidence-relation and excluded legal-
  conclusion authority levels.
- Define the V1 corpus policy, canonical domain concepts, ownership boundaries
  and candidate-to-canonical flow.
- Define mechanical, source-backed and human-reviewed verification gates.
- Accept the product wedge and stack/database direction while preserving
  unresolved provider and implementation choices.
- Update governing project, architecture, status, journal and repository-map
  documentation.
- Mark ACME-0073's discovery recommendation as superseded by the accepted
  product decision without rewriting its historical analysis.

### Out of Scope

- Implementing the product, EvidenceModule, PostgreSQL adapter, web app,
  authentication, ingestion, OCR or deployment.
- Processing real confidential, privileged or criminal-offence personal data.
- Providing legal advice, credibility scoring, guilt findings, charging
  recommendations or automated high-impact decisions.
- Selecting a managed PostgreSQL, identity, object-storage or hosting vendor.
- Defining production compliance, DPIA, conformity assessment or legal advice.
- Activating Research POC #2.

### Definition of Done

- The normative product definition names the user, problem, product promise,
  non-goals, V1 workflow, domain model, authority ladder and success metrics.
- ADR-0028 accepts Evidence Integrity Workbench as POC #1 and records the
  human-authority, corpus, provenance, immutability and provider boundaries.
- Governing documents distinguish the accepted product direction from work
  that remains unimplemented or legally unassessed.
- Current legal/provider-risk statements are supported by official primary
  sources and are framed as design constraints rather than legal advice.
- Documentation verification passes and the completed task is archived.

### Minimum Verification Gates

- [x] Review product boundaries against applicable official EU and OpenAI
  primary sources and the NIST AI RMF GenAI profile.
- [x] Trace every accepted V1 invariant to ACME's existing guardrails or an
  explicit new ADR-0028 decision.
- [x] Verify internal Markdown links and balanced fences with
  `pnpm docs:check`.
- [x] Run `git diff --check` and preserve unrelated worktree changes.

## References

- `docs/design/first-poc-application-discovery.md`
- `docs/concepts_sandbox/legal-evidence-on-acme/` as non-authoritative input
- `docs/PROJECT_BRIEF.md`
- `docs/SYSTEMDOC.md`
- ADR-0009, ADR-0010, ADR-0012, ADR-0016, ADR-0017, ADR-0018 and ADR-0025
- Regulation (EU) 2024/1689, Regulation (EU) 2016/679 Article 10, current
  OpenAI Usage Policies and NIST AI 600-1

## Checklist

- [x] Read governing documentation and relevant accepted ADRs.
- [x] Review the Legal/Evidence concept material as non-authoritative input.
- [x] Verify the external risk and human-review boundary.
- [x] Write the normative product definition.
- [x] Record the accepted decision in ADR-0028.
- [x] Synchronize governing documentation and mark ACME-0073's recommendation
  as superseded.
- [x] Verify, journal, archive and restore the inactive task template.

## Decisions and Notes

- The user's explicit direction on 2026-08-09 approves Evidence Integrity
  Workbench as POC #1 and Research Synthesis as the intended POC #2.
- "Legal/Evidence" describes the corpus and review problem, not authority to
  give legal advice or decide legal outcomes.
- V1 correctness is deliberately concentrated in corpus-grounded facts that
  can be inspected without treating the model as a subject-matter authority.
- External sources constrain risk handling; this task does not make a legal
  classification or provide legal advice.
- A checkpoint after each step is recorded in this checklist and affected
  governing documents are updated within the same change.

## Charter Amendment Log

- none

## Verification

- [x] Official-source boundary review: Regulation (EU) 2024/1689, Regulation
  (EU) 2016/679 Article 10, OpenAI Usage Policies and NIST AI 600-1.
- [x] Normative-decision consistency review: authority ladder, product
  prohibitions, promoted sandbox concepts, ACME invariant traceability and
  governing-document status agree with ADR-0028.
- [x] `pnpm docs:check`.
- [x] `git diff --check`.

## Documentation Updates

- [x] `docs/design/evidence-integrity-workbench-product-definition.md`
- [x] `docs/adr/0028-first-poc-evidence-integrity-workbench.md`
- [x] `docs/PROJECT_BRIEF.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/design/first-poc-application-discovery.md`
- [x] `docs/design/README.md`, `docs/adr/README.md` and `AGENTS.md`

## Handoff and Follow-ups

- Current state: product selection, normative definition and ADR-0028 complete.
- Next recommended step: activate a bounded Evidence Integrity technical-
  specification and synthetic golden-corpus planning task.
- Blockers: none for this documentation decision.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions deferred to implementation planning: initial fixture corpus,
  managed provider, product identity and storage services, and pilot operator.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` from the inactive template.
- Add a signed `docs/JOURNAL.md` entry.
