# Current Task

Task ID: ACME-0045
Parent Task: None
Status: Complete
Owner: Grok
Created: 2026-08-02
Last updated: 2026-08-02
Charter frozen at: 2026-08-02

## Task Summary

First visual slice of the Domain Test UI: localhost workbench that paints
existing S3 and S4 view contracts without inventing verdicts.

## Goal

Let a human open a local browser workbench, browse run history and inspect one
execution through the existing S3 and S4 view contracts, with all other
surfaces reachable as honest stubs that state their contract version.

## Primary Deliverable

A localhost-bound static SPA shell and pure HTML renderers for
`acme-view-runs/1` and `acme-view-execution/1`, served by a thin local process
that binds only to loopback.

## Delivered

- ADR-0024
- `apps/test-ui/src/web/` pure HTML renderers + CSS
- `startWorkbenchServer`, `workbench-main`
- Unit + integration tests
- Docs synchronized

## Out of Scope (kept)

- Complete S1/S2/S5–S10 paint
- Plan-launch chrome
- Remote hosting
- Multi-step live scenarios

## Verification

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm boundaries`
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance`
- [x] `pnpm test:integration`
- [x] `pnpm test:scenario`
- [x] `pnpm docs:check`
- [x] `pnpm build`
- [x] `git diff --check`

## Checklist

- [x] Charter and freeze
- [x] ADR-0024
- [x] Pure HTML renderers S3/S4 + shell
- [x] Loopback HTTP server
- [x] JSON endpoints / workspace wiring
- [x] Unit tests
- [x] Integration test
- [x] Verification gates
- [x] Docs, journal, archive
