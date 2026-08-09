# ACME-0072 — OpenAI/FDE Presentation Markdown Counterpart

Task ID: ACME-0072
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

Create a Markdown counterpart to the ACME OpenAI/FDE project presentation so
the same repository-backed narrative can be reviewed, versioned and shared as
plain text.

## Task Charter

### Goal

Produce a faithful, readable Markdown version of the final 15-slide deck.

### Primary Deliverable

`hrd/ACME-OpenAI-FDE-project-presentation.md`.

### In Scope

- Preserve the deck's sequence, claims, evidence counts and maturity caveats.
- Represent the architecture and trust flow with portable Markdown/Mermaid.
- Include repository-relative source links.
- Update task, status, system, journal and file-map documentation.

### Out of Scope

- Changes to the PowerPoint, PDF, runtime, architecture or tests.
- New claims, live provider calls, deployment or publication.

### Definition of Done

- The Markdown document covers all 15 presentation sections.
- Links and Markdown fences pass repository documentation checks.
- The artifact is recorded and the task is archived.

### Minimum Verification Gates

- [x] Compare all sections with the final PowerPoint text and notes.
- [x] Run `pnpm docs:check`.
- [x] Run `git diff --check` and preserve unrelated changes.

## References

- `hrd/ACME-OpenAI-FDE-project-presentation.pptx`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/FILESTRUCTURE.md`
- Accepted ADRs cited by the presentation

## Checklist

- [x] Inspect the final PowerPoint text and speaker-note sources.
- [x] Create the Markdown counterpart.
- [x] Verify section coverage, links and fences.
- [x] Update repository documentation and journal.
- [x] Archive ACME-0072 and restore the task template.

## Decisions and Notes

- The Markdown file is a derived explanatory artifact; governing Markdown and
  accepted ADRs remain authoritative.
- English is retained to match the OpenAI/FDE deck.
- The pre-existing operator journal entry and ACME-0071 changes are preserved.

## Charter Amendment Log

- none

## Verification

- [x] Presentation-to-Markdown coverage review: cover plus all 14 narrative
  sections present, including both architecture/trust diagrams and evidence
  tables.
- [x] `pnpm docs:check`: links and fences clean.
- [x] `git diff --check`: clean; existing unrelated worktree changes retained.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] ADRs when long-lived decisions change (none changed)

## Handoff and Follow-ups

- Current state: complete; Markdown counterpart created and verified.
- Next recommended step: no implementation task is active; activate only an
  explicitly approved bounded charter.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore or populate `docs/CURRENT_TASK.md` for the actual next task.
- Add a signed `docs/JOURNAL.md` entry.
