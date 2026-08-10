# Current Task

Task ID: ACME-0075
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-10
Last updated: 2026-08-10
Charter frozen at: 2026-08-10

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

Capture two bounded, non-authoritative strategy concepts before product
implementation begins: one for extracting ACME's latest docs-first workflow
into a reusable open-source continuity protocol, and one for releasing ACME as
an uncrippled open-source core while concentrating durable commercial value in
certification, operations, advanced adapters and domain expertise.

The documents preserve the evidence and reasoning from existing repository
case studies without changing ACME's license, publication state, architecture,
roadmap or active POC decision.

## Task Charter

### Goal

Create a decision-ready, explicitly non-normative concept package for the two
potential open-source initiatives without accidentally authorizing either.

### Primary Deliverable

A paired concept package under `docs/concepts_sandbox/` covering docs-first
packaging and an ACME open-source release strategy, indexed and traceable from
the repository documentation.

### In Scope

- Define the docs-first problem, protocol core, document ownership model,
  task lifecycle, conformance idea, profiles and evidence strategy.
- Capture the demonstrated use across software, creative production, humans
  and several agent families without treating private journals as publishable.
- Define ACME community-core, compatible/certified/fork identities, staged
  release prerequisites, contribution ownership and commercial value layers.
- Compare true open-source and source-available licensing directions using
  official primary sources and mark legal review as required.
- Record current repository facts: no `LICENSE`, private packages and no
  published package.
- Update the concept-sandbox index, repository file map and journal.
- Preserve unrelated worktree changes.

### Out of Scope

- Selecting or adding a license, CLA, DCO, trademark policy or governance
  model.
- Publishing packages, making the repository public, deploying services,
  creating releases or changing package `private` flags.
- Restricting ACME core behavior, retrieval capacity or modification rights.
- Changing ACME contracts, architecture, roadmap, product authority or
  accepted ADRs.
- Implementing docs-first tooling, conformance checks, a certified build or
  either Evidence Integrity Workbench or Research Synthesis.
- Publishing private repository journals, personal data or case-study source
  material.

### Definition of Done

- Two new Markdown documents exist under `docs/concepts_sandbox/`, each with
  date, updated date, owner, status and an explicit non-authority boundary.
- The docs-first document defines the protocol core, reference template,
  conformance model, stack/role profiles, context-minimization mechanism,
  evidence framing and a staged extraction path from ACME.
- The ACME document defines release purpose, community surface, compatibility
  identities, licensing decision matrix, value layers, contribution and
  supply-chain prerequisites, staged release gates and explicit non-decisions.
- Open-source terminology is consistent with official OSI definitions; BSL
  and ELv2 are identified as source-available alternatives rather than open
  source.
- The sandbox index and file map include both documents, the journal records
  the completed task, documentation checks pass and the task is archived.

### Minimum Verification Gates

- [x] Verify current repository license/package-publication facts locally.
- [x] Verify licensing terminology against official OSI, GNU, Apache,
  MariaDB and Elastic sources.
- [x] Verify internal Markdown links and balanced fences with
  `pnpm docs:check`.
- [x] Run `git diff --check` and confirm unrelated worktree changes remain
  intact.

## References

- `docs/TASK_WORKFLOW.md`
- `docs/concepts_sandbox/README.md`
- `docs/adr/0028-first-poc-evidence-integrity-workbench.md`
- `docs/design/evidence-integrity-workbench-product-definition.md`
- `docs/finished/ACME-0001_docs-first-foundation.md`
- `docs/finished/ACME-0002_frozen-task-charter-workflow.md`
- `docs/finished/ACME-0074_lock-evidence-integrity-workbench.md`
- Open Source Definition, GNU AGPLv3, Apache License 2.0, BSL 1.1, ELv2,
  SLSA 1.2 and SPDX specifications

## Checklist

- [x] Read governing documentation, repository reality and accepted POC
  boundaries.
- [x] Inspect current license/publication facts and relevant official sources.
- [x] Write the docs-first packaging concept.
- [x] Write the ACME open-source strategy concept.
- [x] Update concept index and repository file map.
- [x] Verify, journal and archive ACME-0075.
- [x] Populate `docs/CURRENT_TASK.md` with the next explicitly approved POC
  technical-specification task as `Draft`.

## Decisions and Notes

- Both artifacts remain concept-sandbox material and cannot be cited as
  architecture, roadmap or license authority.
- ACME's current docs-first iteration is the extraction baseline because it
  formalizes failure modes observed in earlier repository variants.
- The public evidence claim must distinguish author-tagged journal entries
  from unique tasks and must not expose private journal content.
- The preferred conceptual direction is a complete, uncrippled community core;
  semantic limits such as retrieval count are compatibility/versioning
  concerns, not license gates.
- Final license selection requires qualified legal review and contributor-
  ownership analysis.
- A checkpoint after each step is recorded in this checklist. Governing status
  and architecture docs are not changed because this task introduces no
  behavior or accepted decision.

## Charter Amendment Log

- none

## Verification

- [x] Local fact check: no repository `LICENSE`; root and package manifests are
  private; no package is published according to current status.
- [x] Official-source review completed for OSI open-source requirements,
  AGPLv3, Apache-2.0, BSL 1.1, ELv2, SLSA provenance and SPDX.
- [x] `pnpm docs:check`: 151 Markdown files, links and fences clean.
- [x] `git diff --check`.
- [x] Final scoped-diff and unrelated-change preservation review.

## Documentation Updates

- [x] `docs/concepts_sandbox/docs-first-open-source-packaging.md`
- [x] `docs/concepts_sandbox/acme-open-source-strategy.md`
- [x] `docs/concepts_sandbox/README.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/CURRENT_STATUS.md` not changed: no current implementation or
  authority changed.
- [x] `docs/SYSTEMDOC.md` not changed: no architecture changed.
- [x] ADR not required: the task records alternatives and recommendations but
  accepts no cross-package or release decision.

## Handoff and Follow-ups

- Current state: paired concept package complete, indexed and verified;
  ACME-0075 is ready for archive.
- Next recommended step: review and shape ACME-0076 before freezing its POC
  technical-specification charter.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: final project name, license, contributor agreement strategy,
  trademark policy, release timing and public case-study evidence set.

## Finalize When Complete

- Archive this file under `docs/finished/ACME-0075_open-source-concepts.md`.
- Populate the next approved Evidence Integrity Workbench task as `Draft`.
- Add a signed `docs/JOURNAL.md` entry.

