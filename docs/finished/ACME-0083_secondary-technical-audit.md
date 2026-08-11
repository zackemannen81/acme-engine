# ACME-0083 — Secondary technical audit

Task ID: ACME-0083
Parent Task: None
Status: Complete
Owner: Grok
Created: 2026-08-11
Last updated: 2026-08-11
Charter frozen at: 2026-08-11

## Task Summary

Evidence Integrity Workbench slice 6: secondary technical audit surfaces that
remain disabled by default and never block the primary journey.

## Task Charter

### Goal

Optional technical provenance and replay views behind `technicalAudit.enabled`,
with primary journey unchanged when disabled.

### Primary Deliverable

`evidence-technical-provenance-view/1` and `evidence-technical-replay-view/1`
builders plus API routes that 404 when audit is disabled; primary navigation
has no technical links when disabled.

### In Scope

- Pure technical view contracts/builders
- API routes gated by technicalAudit.enabled
- Tests: primary path unchanged when off; routes present only when on
- Docs

### Out of Scope

- PostgreSQL (7), hosted shell (8)
- Changing primary view schemas

### Definition of Done

- With audit off: technical routes 404, primary black-box still passes
- With audit on: provenance/replay views available without primary vocabulary
  regression
- Full gates pass

### Minimum Verification Gates

- [x] typecheck, lint, format:check, test, docs:check, build
- [x] blackbox with audit disabled still green
