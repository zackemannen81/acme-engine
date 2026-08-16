# Current Task

Task ID: ACME-0147
Parent Task: None
Status: Complete
Owner: Grok
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Task Summary

Make Source stream, Claim and Stance the default jobs, with Search
beside them. Legacy type views stay reachable from Stance and `?view=`.

## Task Charter

Frozen at Ready.

### Goal

A reviewer lands on the source stream and can switch among three jobs
plus search, without twelve primary buttons.

### Primary Deliverable

Workbench shell whose default `?view=` is `stream`, whose primary nav
is Source stream / Claim / Stance / Search, and whose source review
places observations under their source block.

## Verification

```text
pnpm typecheck                         pass
pnpm lint                              pass
pnpm docs:check                        265 Markdown files
pnpm test:unit                         799/799
```

No browser tool was available. Verification used the emitted-module
parse test, nav/default-entry string contracts, and local blackbox
HTML assertion.

## Finalize When Complete

- Archive as `docs/finished/ACME-0147_three-mode-default-shell.md`.
