# ACME-0071 — OpenAI/FDE Project Presentation

Task ID: ACME-0071
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

Create a complete, externally shareable presentation of ACME for an OpenAI
Forward Deployed Engineer application. The presentation must explain the
problem, purpose, evolution, repository structure, architecture, evidence and
current status without overstating production readiness.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Produce an accurate, persuasive and visually polished account of ACME that a
technical OpenAI audience can evaluate without access to chat history.

### Primary Deliverable

An English-language PowerPoint presentation under `hrd/`, accompanied by a
portable PDF export of the same final deck.

### In Scope

- Derive the narrative and all technical claims from repository authority.
- Explain ACME's purpose, problem framing and design principles.
- Present the development timeline, workspace structure and architecture.
- Explain execution, trust, memory, state, persistence, replay and evaluation.
- Summarize implemented capabilities, verification evidence, limits and next
  work.
- Frame the engineering relevance for an OpenAI FDE audience without making
  claims about OpenAI's hiring process or internal systems.
- Render and visually inspect the complete deck, then export a matching PDF.
- Update task, journal and file-map documentation.

### Out of Scope

- Runtime, package, contract, adapter or test changes.
- New architecture decisions or changes to accepted ADRs.
- Live provider calls, deployment, publication or remote mutation.
- Rewriting or overwriting the existing ACME-0055 presentation.
- Using concept-sandbox material as architectural authority.

### Definition of Done

- The deck covers what ACME is, why it exists, its problem, evolution,
  structure, architecture and current status.
- Statements are consistent with `PROJECT_BRIEF`, `CURRENT_STATUS`,
  `SYSTEMDOC` and accepted ADRs as of 2026-08-09.
- The presentation clearly separates implemented capability, proof,
  experimental live behavior, persistent gaps and deliberately deferred work.
- Every slide renders cleanly with no unintended overlap, clipping or unresolved
  placeholders, and the matching PDF opens successfully.
- Documentation records the new derived artifacts and the task is archived.

### Minimum Verification Gates

- [x] Render and inspect every final slide at full size.
- [x] Run the presentation overflow test with no unresolved errors.
- [x] Verify slide sources and terminology against repository authority.
- [x] Confirm the PDF page count matches the PowerPoint slide count.
- [x] Run `pnpm docs:check`.
- [x] Run `git diff --check` and preserve unrelated worktree changes.

## References

- `AGENTS.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/FILESTRUCTURE.md`
- `docs/JOURNAL.md`
- `docs/design/acme-design-and-development-spec.md`
- `docs/design/gap-resolution-plan.md`
- Accepted ADRs, especially ADR-0002, 0003, 0008, 0012, 0014, 0017, 0018,
  0019, 0025, 0026 and 0027
- Existing ACME-0055 human-readable artifacts under `hrd/`

## Checklist

- [x] Read governing documentation and relevant architecture decisions.
- [x] Inspect the existing presentation and establish the external narrative.
- [x] Build the OpenAI/FDE-targeted PowerPoint with repository-backed notes.
- [x] Render, inspect and iterate until the deck is visually clean.
- [x] Export and verify the matching PDF.
- [x] Update repository documentation and record verification.
- [x] Archive ACME-0071 and restore the task template.

## Decisions and Notes

- The existing `hrd/ACME-presentation.pptx` is preserved as an ACME-0055
  artifact. The new deck receives a distinct filename.
- English is selected because the intended external recipient is OpenAI.
- The Markdown documents and accepted ADRs remain authoritative; the deck and
  PDF are derived explanatory artifacts.
- The pre-existing uncommitted operator entry in `docs/JOURNAL.md` must be
  preserved.

## Charter Amendment Log

- none

## Verification

- [x] Presentation render and individual slide review: 15/15 slides clean.
- [x] Presentation overflow test: passed with no overflow detected.
- [x] PDF export and page-count check: 15 pages for 15 slides; all pages
  visually reviewed and final export matched the inspected render pixel-for-
  pixel.
- [x] Repository terminology and source review: 15/15 slide-note source blocks
  retained after final export.
- [x] `pnpm docs:check`: 142 Markdown files, links and fences clean.
- [x] `git diff --check`: clean; the pre-existing operator journal entry was
  preserved.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] ADRs when long-lived decisions change (none changed)

## Handoff and Follow-ups

- Current state: complete; English PowerPoint and matching PDF delivered under
  `hrd/`, visually verified and documented.
- Next recommended step: no implementation task is active; activate E1
  trust-stage evidence or another explicitly approved bounded charter.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none; English PowerPoint plus PDF is the documented delivery
  assumption.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore or populate `docs/CURRENT_TASK.md` for the actual next task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
