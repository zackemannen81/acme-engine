# Completed Task — ACME docs-first foundation

Task ID: ACME-0001
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-07-29
Completed: 2026-07-29

## Goal

Create a self-contained docs-first foundation for the new `acme-engine`
repository before design or runtime implementation begins.

## Completed

- Added canonical `AGENTS.md` instructions.
- Added approved project brief and pre-implementation system boundaries.
- Added contribution workflow, current status, journal and file map.
- Added active-task and reusable task-template workflow.
- Added ADR and design-document structure.
- Added finished-task archive.
- Added deterministic LF and conservative ignore rules.
- Updated the README as the project entrypoint.
- Made the complete design and development specification the active task.

## Verification

- Documentation links checked.
- Markdown fences checked.
- `git diff --check` run for the repository changes.
- Typecheck and runtime tests not applicable because no runtime tooling exists.

## Runtime Impact

None. No runtime packages, providers, databases or deployments were created.

## Handoff

Continue from `docs/CURRENT_TASK.md`.
