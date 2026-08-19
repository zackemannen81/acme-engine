# Current Task

Task ID: ACME-0166
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-19
Last updated: 2026-08-19
Charter frozen at: 2026-08-19

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/CURRENT_STATUS.md`
- `docs/design/evidence-integrity-workbench-product-definition.md`
- `docs/design/evidence-workbench-v2-domain-specification.md`
- `docs/ops/evidence-v2-supabase.md`

## Task Summary
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

POC #1 code is frozen. This task packages it for a reader who was not in
the build: a setup guide, a user manual, and a technical overview of
purpose, architecture and flows.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Someone who was not in the build can set up a self-run, use the workbench,
and understand what the POC is for and how it is put together — without
opening the source.

### Primary Deliverable

An operator pack under `docs/poc-1/`: setup guide, user manual, and
technical overview (purpose, architecture, flows).

### In Scope

- A pack index that states the freeze and where to start.
- A setup guide: prerequisites, secrets, accounts, PostgreSQL, file or
  S3 object store, optional live model, start, health check, and what
  works without a provider.
- A user manual over the delivered surfaces and the reviewer journey.
- A technical overview: purpose, authority ladder, composition,
  persistence, the J3/J4 spend points, and the read-only projections.
- Pointers from the root README and long-lived docs.

### Out of Scope

- Any product code change.
- Docker images, installers, or a new composition.
- Opening Stage B, real-case data, or SKL identity.
- Wiring Supabase Auth.
- Rewriting SYSTEMDOC or the ADRs.

### Definition of Done

- `docs/poc-1/` contains the three documents and an index.
- Setup steps match `startFromEnvironment` and the existing runbook.
- The manual names the surfaces that exist, not ones that do not.
- The technical overview states what the POC is not.
- `docs:check` and `git diff --check` pass.

### Minimum Verification Gates

- [x] `pnpm docs:check`
- [x] `git diff --check`
- [x] Internal links in the pack resolve

## References

- [Product definition](../design/evidence-integrity-workbench-product-definition.md)
- [V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)
- [V2 runbook](../ops/evidence-v2-supabase.md)
- [ADR-0047](../adr/0047-evidence-application-model-reset.md)
- [ADR-0049](../adr/0049-evidence-v2-surface-set.md)

## Checklist

- [x] Charter frozen.
- [x] Write the pack index, setup guide, user manual and technical overview.
- [x] Point to the pack from README and long-lived docs.
- [x] Verify links; archive; restore the template.

## Decisions and Notes
- A checkpoint after each step or substep is required. Checklist is therefore updated along the work and `CURRENT_STATUS.md` is always updated when changes affect the behavior.
- Record decisions and assumptions within the frozen charter.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

Recorded at freeze:

- **Code stays frozen.** This task writes documents only.
- **The pack is the operator entry.** Internal ADRs remain authority;
  the pack does not replace them.
- **Swedish pack, English UI labels.** The documents are for a Swedish
  reader; controls are named as the product renders them.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

Run 2026-08-19. Documentation only. No code change.

- `pnpm docs:check` and `git diff --check`.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs when long-lived decisions change — none

## Handoff and Follow-ups

- Current state: ACME-0166 complete. POC #1 pack is `docs/poc-1/`.
- Next recommended step: none. The code remains frozen.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
