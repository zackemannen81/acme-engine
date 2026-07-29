# Completed Task — Frozen task charter workflow

Task ID: ACME-0002
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-07-29
Completed: 2026-07-29

## Goal

Prevent `docs/CURRENT_TASK.md` from becoming an open-ended task whose goal and
Definition of Done change while work is in progress.

## Primary Deliverable

A canonical scope-freeze and parent/child task workflow integrated into the
ACME docs-first foundation.

## Completed

- Added `docs/TASK_WORKFLOW.md`.
- Froze Goal, Primary Deliverable, In Scope, Out of Scope, Definition of Done
  and minimum verification gates when a task reaches `Ready`.
- Defined task states, immutable task IDs and task-size rules.
- Added a decision tree for discovered work.
- Added paused-parent and bounded-child-task mechanics.
- Added backlog handling for non-blocking discoveries.
- Added cancellation and supersession rules.
- Added `docs/paused/` and `docs/backlog/`.
- Updated AGENTS, contributing guidance and the task template.
- Migrated the active design task to frozen-charter format without changing
  its objective or completion conditions.

## Definition of Done

- A task's objective cannot be silently rewritten after `Ready`.
- Blocking prerequisites have an explicit child-task path.
- Non-blocking discoveries cannot expand the active task.
- Invalid original goals are superseded rather than rewritten.
- Exactly one task remains active in `docs/CURRENT_TASK.md`.

## Verification

- Documentation links and Markdown fences checked.
- Trailing whitespace and `git diff --check` checked.
- No runtime verification is applicable.

## Handoff

Continue with `ACME-0003` in `docs/CURRENT_TASK.md`.
