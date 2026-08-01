# Current Task

Task ID: ACME-0031
Parent Task: None
Status: Complete
Owner: Grok
Created: 2026-08-01
Last updated: 2026-08-01
Charter frozen at: 2026-08-01

## Task Summary

Documentation-only reality sync after ACME-0029/0030 so governing docs match
implementation. No runtime product behavior beyond clarifying CLI usage text.

## Task Charter

### Goal

Make current-facing documentation match implementation reality.

### Primary Deliverable

Updated CURRENT_STATUS, SYSTEMDOC, AGENTS, README, Domain Test UI readiness
claims, backlog status table, and related phase blurbs.

### Definition of Done

- No current-facing doc claims the OpenAI adapter, live success, schema
  lowering or encrypted retention are absent.
- Domain Test UI backlog/spec list engine prerequisites as satisfied.
- CLI docs distinguish mock-only composition root vs existing live path.
- docs:check and git diff --check pass.

### Minimum Verification Gates

- [x] `pnpm docs:check`
- [x] `pnpm format:check` / `pnpm lint` (usage string change)
- [x] CLI tests
- [x] `git diff --check`

## Checklist

- [x] Sync CURRENT_STATUS, SYSTEMDOC, AGENTS, README, PROJECT_BRIEF
- [x] Sync Domain Test UI backlog + specification readiness
- [x] Sync FILESTRUCTURE planned section; backlog README
- [x] Clarify CLI usage strings
- [x] JOURNAL; archive

## Verification

docs:check 72 files; format; lint; apps/cli 18 tests; git diff --check.
