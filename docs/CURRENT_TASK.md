# Current Task

Task ID: ACME-0189
Parent Task: None
Status: In Progress
Owner: ChatGPT (operator)
Created: 2026-09-19
Last updated: 2026-09-19
Charter frozen at: b7945f5a9efbae13eb8a7f388e05de5254672ba6

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- Relevant current model-runtime/publication ADRs and package manifests

## Task Summary

Reconcile ACME's current public and governing documentation with merged repository and published package reality through ACME-0188. Historical records remain historical; this task repairs current truth surfaces only.## Task Charter

### Goal

Make current ACME documentation accurately describe the published model-runtime surface, current package versions, implemented multimodal/provider behavior and present project state.

### Primary Deliverable

A bounded docs-only reality sync across README and current governing/reference documents, with stale present-tense assertions removed or explicitly historical.

### In Scope

- Repair stale current claims in `README.md`, `AGENTS.md`, `docs/PROJECT_BRIEF.md`, `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md` and `docs/FILESTRUCTURE.md` where contradicted by merged code/package manifests.
- Reconcile public package state through `acme-engine@0.1.5`.
- Reconcile native Responses/Chat Completions image support and model-runtime publication state.
- Replace obsolete current-objective/current-phase summaries with concise references to current repository authority.
- Record closure in status/system docs/journal/archive.

### Out of Scope

- Runtime, provider, execution, Evidence Workbench or persistence behavior changes.
- Publishing, tagging or changing package versions.
- Rewriting immutable task archives, accepted ADRs or old journal entries.
- Activating a new product/runtime feature programme.

### Definition of Done

- Current docs no longer describe `acme-engine@0.1.2` or `0.1.4` as the current installable release.
- Current docs distinguish historical 0.1.0/0.1.1 publication steps from the current 0.1.5 facade/runtime chain.
- Current project summaries no longer stop at the ACME-0057–0069 era or claim implemented Evidence V2 work is unimplemented.
- Current multimodal execution documentation matches ACME-0182/0188.
- No product/runtime source files change.### Minimum Verification Gates

- [ ] Compare present-tense claims against package manifests and merged ACME-0181 through ACME-0188 records.
- [ ] Search current governing docs for stale version/publication/current-phase assertions.
- [ ] `pnpm docs:check`.
- [ ] `pnpm format:check` for changed Markdown where applicable.
- [ ] `git diff --check`.
- [ ] Confirm changed paths are documentation/control records only.

## Authority and scope reasoning

The docs-first ownership rules in `AGENTS.md` and `docs/TASK_WORKFLOW.md` require current authority surfaces to reflect observed implementation. The existing stale release/current-phase statements can mislead downstream consumers about installable packages and supported execution behavior. The smallest sufficient repair is documentation-only and leaves historical records intact.

## Checklist

- [x] Claim ACME-0189 on main.
- [x] Freeze docs-only charter.
- [ ] Audit current public/governing docs against merged implementation.
- [ ] Repair confirmed stale claims.
- [ ] Run verification gates.
- [ ] Update journal, archive and handoff.
- [ ] Restore `docs/CURRENT_TASK.md` from template before final push.

## Decisions and Notes

- Historical statements remain untouched when clearly scoped to their original task/version.
- Present-tense current claims must match merged package/runtime reality.
- Publication history is preserved; current release state is added where needed.## Charter Amendment Log

-none

## Verification

- Pending.

## Documentation Updates

- [ ] `README.md`
- [ ] `AGENTS.md`
- [ ] `docs/PROJECT_BRIEF.md`
- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/FILESTRUCTURE.md` when maintained descriptions are stale
- [ ] `docs/JOURNAL.md`

## Handoff and Follow-ups

- Current state: audit in progress.
- Next recommended step: reconcile confirmed stale present-tense claims.
- Blockers: none.
- Child tasks: none.
- Resume condition: repository branch state.
- Open questions: none.