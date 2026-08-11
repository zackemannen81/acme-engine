# Current Task

Task ID: ACME-0078
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-11
Last updated: 2026-08-11
Charter frozen at: 2026-08-11

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/design/evidence-integrity-workbench-technical-specification.md`
- `docs/design/evidence-integrity-workbench-product-definition.md`
- `docs/adr/0030-evidence-v1-identity-and-canonical-placement.md`
- `docs/adr/0031-evidence-review-overlay-and-versioned-views.md`
- ADR-0010, ADR-0012, ADR-0017 and ADR-0018

## Task Summary

A task is never considered done until:
`docs/JOURNAL.md`, `docs/SYSTEMDOC.md` and `docs/CURRENT_STATUS.md` are à jour.

Implement slice 1 of the Evidence Integrity Workbench: the first visible,
fully offline reviewer path for one synthetic development source. A user can
import the immutable text, launch deterministic observation extraction through
the unchanged ACME engine, review each proposed source-bound observation and
navigate it back to exact numbered lines. The product route remains usable
with technical audit disabled.

## Task Charter

The charter is frozen. Discoveries follow `docs/TASK_WORKFLOW.md` and may not
expand this task into account comparison or later Evidence slices.

### Goal

Deliver one end-to-end, source-first reviewer capability over a single
synthetic development artifact while preserving ACME's candidate, domain and
product authority boundaries.

### Primary Deliverable

An offline local Evidence Workbench composition that imports `DEV-T01` v1,
executes `evidence.observe-artifact@1.0.0` with the deterministic mock, stores
the immutable source and canonical observations, exposes work-queue and
source-review primary views, accepts append-only review decisions and renders
the complete journey through a minimal loopback web/API/worker surface.

### In Scope

- Implement `evidence.observe-artifact@1.0.0` as the first actual
  `TaskDefinition`, including prompt contract, strict interpretation,
  source/quote/actor/time/prohibited-output validation, memory candidates,
  typed state projection, diagnostics and one bounded domain event.
- Add a deterministic mock fixture and development-subset scenario for
  `DEV-T01` v1, including exact request hash, replay and injected post-provider
  resume proof.
- Implement `@acme/evidence-product-contracts` for one local workspace,
  immutable source import, import jobs, proposed-observation records and
  append-only version-bound review decisions with idempotency/collision rules.
- Implement a local file-backed product repository separated from the ACME
  ledger; source and job records survive process recreation and review history
  is append-only.
- Implement `@acme/evidence-views` with a classified primary view registry,
  pure `evidence-primary-work-queue-view/1` and
  `evidence-primary-source-review-view/1` builders, exact citation display and
  no forbidden primary vocabulary.
- Implement minimal `apps/evidence-workbench-api`,
  `apps/evidence-workbench-worker` and `apps/evidence-workbench-web`
  composition sufficient for import, queued processing, progress/polling,
  review commands, work queue, source view and exact-line navigation.
- Keep `technicalAudit.enabled = false` as the default and prove technical
  routes/navigation are absent in that mode.
- Report development observation precision/recall counts as labelled finite-
  corpus metrics without model comparison or production claims.
- Add focused unit, conformance, integration and scenario tests plus local run
  instructions and governing documentation.

### Out of Scope

- `EVAL-T01`, sealed evaluation comparison, account comparison or correction
  review; those begin in slice 2.
- Relation proposal/review, timeline, open-question, assessment, re-review,
  export or new-evidence attention behavior from slices 3–6.
- Secondary technical-audit views, except proving their routes are absent when
  disabled.
- Live provider execution, model/config comparison, external acquisition,
  provider spend or any non-synthetic/real data.
- PostgreSQL/Supabase, object storage, authentication, hosting, deployment or
  cross-process distributed workers.
- Changes to `packages/core`, existing repository contracts, existing
  adapters, Domain Test UI behavior or accepted ADR meanings.

### Definition of Done

- The registered Evidence task executes `DEV-T01` through the unchanged
  ExecutionEngine and deterministic mock, validates both exact observations,
  commits their stable identities and advances Evidence revision exactly once.
- Invalid/missing/multiply bound quotes, kind mismatch, actor labels outside
  the roster, actor auto-merge, invented exact time and prohibited authority
  output are refused before canonical evidence is committed.
- Re-import is idempotent with no new observation, revision or provider call;
  replay is `match` with zero provider calls; injected post-provider
  interruption resumes with total gateway invocation count one.
- The product repository preserves immutable source bytes and append-only
  review decisions across recreation; identical command reuse is idempotent
  and divergent reuse is rejected.
- Work queue and source review views are pure, detached, deterministic,
  primary-domain classified and contain numbered source lines, proposed/review
  standing, exact locator links and review choices without forbidden primary
  vocabulary.
- A local black-box test imports, processes, reviews and reopens `DEV-T01`
  through product API/web/worker interfaces with technical audit disabled and
  without CLI, raw database access or technical navigation.
- Development metrics report 2/2 correct observations with emitted denominator
  while explicitly making no model comparison or generalization claim.
- All new packages obey the accepted dependency direction; no package imports
  sealed evaluation truth or Domain Test UI.
- Governing documentation reflects delivered slice-1 reality, ACME-0078 is
  archived and `docs/CURRENT_TASK.md` returns to the real next state.

### Minimum Verification Gates

- [x] `corepack pnpm install --offline` after workspace manifests are added.
- [x] `corepack pnpm typecheck`.
- [x] `corepack pnpm lint`.
- [x] `corepack pnpm format:check`.
- [x] `corepack pnpm boundaries` including new app/package negative fixtures.
- [x] `corepack pnpm test` including unit, conformance, integration and
  scenario gates.
- [x] `corepack pnpm docs:check`.
- [x] `corepack pnpm build`.
- [x] Development hard-gate and exact-quote negative review.
- [x] Review-store/view conformance and forbidden-vocabulary scan.
- [x] Offline black-box, duplicate, replay and injected-resume verification.
- [x] Confirm no live/provider/network-backed corpus path or spend.
- [x] `git diff --check`; preserve the pre-existing untracked
  `package-lock.json` and all prior ACME-0076/0077 changes.

## References

- `docs/design/evidence-integrity-workbench-technical-specification.md`, slice 1
- `packages/module-narrative/`, `packages/module-research/`
- `packages/adapter-model-mock/`, `packages/adapter-memory/` and
  `packages/adapter-sqlite/`
- `apps/test-ui/src/local/` for bounded local composition patterns only; the
  Evidence product must not depend on that app
- `@acme/evidence-testing` development truth and golden builder

## Checklist

- [x] Activate and freeze ACME-0078 from the accepted slice-1 plan.
- [x] Inspect task, product repository, view and local composition patterns.
- [x] Implement observe-artifact prompt contract, task and validation.
- [x] Author deterministic DEV-T01 response/scenario fixtures.
- [x] Implement product contracts and local file repository.
- [x] Implement primary view schemas/builders and vocabulary guard.
- [x] Implement minimal API/worker/web composition and local entry point.
- [x] Add unit/conformance/integration/scenario tests.
- [x] Synchronize workspace/build/boundary configuration and lockfile.
- [x] Synchronize governing documentation and local run instructions.
- [x] Run all gates, journal, archive and restore task state.

## Decisions and Notes

- Slice 0, ADR-0030 and ADR-0031 are frozen authority. The task may add
  implementation detail but cannot change identity or review semantics.
- Product source/job/review data remains separate from the ACME ledger. A
  local file-backed repository supplies slice-1 durability without preempting
  the slice-7 PostgreSQL schema/transaction ADR.
- The worker is bounded and in-process for V1 local use, but work is started by
  job id and observed through progress/polling contracts rather than a long-
  held request.
- Only development truth is visible to the task/scenario. The sealed
  evaluation entry point remains forbidden to prompt-building paths.
- No new external runtime dependency is expected.
- A checkpoint after every substantive step is required.

## Charter Amendment Log

- none

## Verification

- [x] Task contract/interpretation and source-bound negative review.
- [x] Product repository/review idempotency and persistence review.
- [x] Primary view/vocabulary/product-separation review.
- [x] Full offline black-box and ACME replay/resume review.
- [x] Full repository verification gates.
- [x] Record exact skipped checks and reasons: none skipped.

Observed verification: 634/634 tests across 87 files in the main suite,
69/69 conformance, 57/57 integration and 24/24 scenario tests. `docs:check`
validated 162 Markdown files. Development metrics were 2/2 exact-quote binds,
2/2 actor resolutions and 2/2 temporal normalizations; these are finite-corpus
fixture results, not a model comparison or production claim. Replay matched,
and injected post-provider resume completed with one total gateway invocation.
The exact aggregate test used a temporary PATH-local Corepack pnpm 10.34.5
shim because the desktop exposed global pnpm 11.16.0 to nested scripts; the
shim was removed. A browser smoke test opened an exact citation, recorded an
accepted review and left the second proposal queued; the non-blocking inline
review note has a regression test. No live call, network-backed corpus path or
spend occurred.

## Documentation Updates

- [x] `packages/module-evidence/README.md`
- [x] local Evidence Workbench run instructions
- [x] `docs/design/evidence-integrity-workbench-technical-specification.md`
  only for non-semantic implementation clarification/status
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] ADR review: no new decision was needed; ADR-0030/0031 remained sufficient

## Handoff and Follow-ups

- Current state: Complete; slice 1 is implemented and fully verified.
- Next recommended step: activate a separate slice-2 charter for corrected and
  changed-account comparison over the sealed evaluation harness.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none for slice 1. The hosted React/Vite/Fastify shell,
  cross-process worker recovery and later Evidence views remain later slices.

## Finalize When Complete

- Archive as `docs/finished/ACME-0078_evidence-review-one-source.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md` unless a
  next task is explicitly approved.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done becomes invalid, supersede the task instead of
  rewriting it.
