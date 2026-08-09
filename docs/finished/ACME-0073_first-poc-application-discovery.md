# Current Task

Task ID: ACME-0073
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

Prepare a decision-ready discovery report for ACME's first real POC
application: product purpose, candidate wedge, business value, consumer
communication, ownership boundaries, recommended technology stack, database
options, ACME compatibility, scaling path, tradeoffs and decision gates.

## Task Charter

### Goal

Turn the broad first-POC question into an evidence-backed recommendation and a
small set of explicit product decisions that can be frozen before design or
implementation begins.

### Primary Deliverable

A product-stakeholder discovery report rendered through the Data Analytics
report surface, supported by
`docs/design/first-poc-application-discovery.md` as the repository source memo.

### In Scope

- Compare plausible first-POC product wedges without activating concept work.
- Recommend a stack baseline and explain why it fits ACME.
- Compare SQLite, managed PostgreSQL and relevant managed-Postgres variants.
- Separate best current ACME compatibility from best hosted-product fit.
- Define API/progress communication, responsibility ownership and scaling
  stages.
- State business-value hypotheses, pilot metrics, caveats and open decisions.
- Use current official primary sources for time-sensitive technology claims.
- Update task, journal, status and file-map documentation.

### Out of Scope

- Implementing the POC, a PostgreSQL adapter, authentication or hosting.
- Selecting a regulated legal use case without user approval.
- Promoting `docs/concepts_sandbox/` to architecture authority.
- A production SLA, security certification, market-size claim or financial
  forecast.
- New ADRs or changes to existing ACME contracts.

### Definition of Done

- The report answers the user's product, stack, database, scale,
  communication, ownership and business-value questions.
- Recommendations distinguish evidence from working assumptions.
- The database recommendation includes migration triggers and tradeoffs.
- The report exposes the one user decision required before a build charter.
- The rendered report validates and the repository source memo passes docs
  checks.

### Minimum Verification Gates

- [x] Validate every current technology claim against an official source.
- [x] Validate and render the complete report artifact.
- [x] Review the report reading path and decision usefulness.
- [x] Run `pnpm docs:check`.
- [x] Run `git diff --check` and preserve unrelated worktree changes.

## References

- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/design/gap-resolution-plan.md`
- Accepted persistence, execution, outbox and UI ADRs
- Non-authoritative product sketches under `docs/concepts_sandbox/`, used only
  as comparison inputs
- Official Node.js, SQLite, PostgreSQL, OpenAI, Neon and Supabase documentation

## Checklist

- [x] Audit governing ACME constraints and deferred product decisions.
- [x] Inventory non-authoritative POC candidates and current external options.
- [x] Create the decision matrix and recommendation.
- [x] Write the repository source memo.
- [x] Build, validate and render the stakeholder report.
- [x] Record verification and archive ACME-0073.

## Decisions and Notes

- Audience: product stakeholders; answer-first strategy memo.
- Delivery mode: Data Analytics MCP report; the repository Markdown file is
  supporting source material rather than a second rendered report surface.
- A weighted candidate score is explicitly a decision heuristic, not observed
  market data.
- No product concept becomes approved architecture through this task.
- The pre-existing ACME-0071/0072 and operator journal changes are preserved.

## Charter Amendment Log

- none

## Verification

- [x] Source and claim review: official Node.js, SQLite, PostgreSQL, OpenAI,
  Supabase, Neon, Vite, Fastify, Docker and MDN documentation.
- [x] Report artifact validation and final render: report manifest, four
  bounded datasets, five canonical sources, one native comparison chart and
  four decision tables validated before the single final render.
- [x] Manual stakeholder reading-path review: title, executive answer,
  candidate comparison, product contract, stack/database decision, scaling,
  ownership, metrics, caveats and next decisions.
- [x] `pnpm docs:check`.
- [x] `git diff --check`.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] ADRs when long-lived decisions change (none; discovery remains
  non-authoritative)

## Handoff and Follow-ups

- Current state: discovery report and repository source memo complete.
- Next recommended step: confirm the evidence-to-decision product wedge, first
  consumer and deployment tenancy, then activate a bounded product-spec task.
- Blockers: the POC product wedge must be confirmed before implementation; a
  managed PostgreSQL provider is intentionally not selected until identity,
  storage and operating constraints are known.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: which consumer workflow should the first POC prove, and is
  the pilot internal single-organization or external multi-tenant?

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore or populate `docs/CURRENT_TASK.md` for the actual next task.
- Add a signed `docs/JOURNAL.md` entry.
