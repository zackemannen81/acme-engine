# Current Task

Task ID: ACME-0045
Parent Task: None
Status: Ready
Owner: Grok
Created: 2026-08-02
Last updated: 2026-08-02
Charter frozen at: 2026-08-02

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- [`docs/design/domain-test-ui-specification.md`](design/domain-test-ui-specification.md)
- [`docs/adr/0019-domain-test-ui-boundary-and-view-contracts.md`](adr/0019-domain-test-ui-boundary-and-view-contracts.md)
- [`docs/finished/ACME-0044_domain-test-ui-live-evaluation.md`](finished/ACME-0044_domain-test-ui-live-evaluation.md)
- Non-authority layout mock only:
  `docs/concepts_sandbox/temp/testregistry_workbench_professional_test_engineering_suite.html`

## Task Summary
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

Phases 0–6 delivered S1–S10 as versioned JSON view contracts, a plan compiler,
launch path, measurement, fixture review and gated live evaluation. A person
still uses the Domain Test UI only by writing TypeScript. ADR-0019 gate 2
accepted a **local static SPA + thin local composition process**; that shell
does not exist yet.

This task is the first rendering slice: a localhost-only workbench that paints
existing view contracts without inventing verdicts, and without making the
browser a second source of truth.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Let a human open a local browser workbench, browse run history and inspect one
execution through the existing S3 and S4 view contracts, with all other
surfaces reachable as honest stubs that state their contract version.

### Primary Deliverable

A localhost-bound static SPA shell and pure HTML renderers for
`acme-view-runs/1` and `acme-view-execution/1`, served by a thin local process
that binds only to loopback, reads the interface workspace, and never accepts
a non-loopback listen address.

### In Scope

- ADR (or short accepted note under ADR-0019 consequences) for the local SPA
  shell boundary: loopback only, no business verdicts in render code, pure
  renderers unit-testable without a browser driver.
- Pure HTML render functions under `apps/test-ui/src/web/` that take view
  contract JSON and produce accessible markup (text labels for every status;
  no color-only meaning).
- SPA shell: navigation for S1–S10, working pages for S3 (run history) and S4
  (execution inspector), stub pages for other surfaces that name the contract
  and say “not rendered in this slice”.
- Local HTTP process on `@acme/test-ui/local` (or a dedicated subpath) that:
  - listens only on `127.0.0.1`
  - serves static shell assets
  - exposes minimal JSON endpoints backed by existing workspace + read-model
    builders (list runs; load one run’s linked execution view when evidence is
    supplied via a local composition/repository path)
- Self-contained CSS (no CDN, no network required to render).
- Unit tests: given fixed view JSON, HTML contains expected labels and never
  fabricates a sample size or pass rate from absence.
- One integration test: start server on loopback, GET shell and a runs view,
  assert status and content.
- Documentation updates for FILESTRUCTURE, SYSTEMDOC, CURRENT_STATUS, JOURNAL,
  design specification and backlog.

### Out of Scope

- Remote binding, multi-user hosting, authentication products.
- Replacing or wrapping the CLI as CI.
- Full pixel-perfect recreation of the concepts_sandbox mock.
- Rich editors for plans (S2 authoring beyond read-only preview if timeboxed).
- Complete renderers for S1, S5–S10 in this slice (stubs only).
- Live evaluation UI actions beyond showing existing S10 JSON if already
  recorded (no new live launch chrome required).
- Changing core, ScenarioRunner, plan schema or S1–S10 contract shapes.
- Browser automation frameworks (Playwright/Cypress) as a gate.

### Definition of Done

- A developer can start the local workbench bound to `127.0.0.1` and open a
  shell in a browser.
- S3 renders run history from `acme-view-runs/1` without inventing rows.
- S4 renders an execution inspector from `acme-view-execution/1` without
  inventing stages or counts.
- Unavailable sections show the reason code or a clear “unavailable” label,
  never a silent zero.
- Renderers are pure and covered by unit tests without a real browser.
- Server refuses or never offers a non-loopback host configuration.
- Default `@acme/test-ui` entry remains pure (no I/O).
- App remains a leaf; nothing imports it.
- Docs reflect the delivered shell and its limits.

### Minimum Verification Gates

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm format:check`
- [ ] `pnpm boundaries`
- [ ] `pnpm test:unit`
- [ ] `pnpm test:conformance`
- [ ] `pnpm test:integration`
- [ ] `pnpm test:scenario`
- [ ] `pnpm docs:check`
- [ ] `pnpm build`
- [ ] `git diff --check`

## References

- ADR-0019 gate 2 (local SPA + composition process)
- Design specification “Proposed package structure” (`web/` leaf)
- Existing builders: `buildRunsView`, `buildExecutionView`
- Workspace: `createFileWorkspace`, `launchPlan`

## Checklist

- [x] Write this charter and freeze it.
- [x] Write ADR-0024 for the local SPA / loopback serve boundary.
- [x] Add pure HTML renderers for S3 and S4 (+ shell chrome).
- [x] Add loopback-only local HTTP server and static assets.
- [x] Wire JSON endpoints to workspace + read models.
- [x] Unit tests for pure renderers.
- [x] Integration test against loopback server.
- [ ] Run every minimum verification gate.
- [ ] Update long-lived docs; journal; archive.

## Decisions and Notes

- **Render contracts, not invent them.** The browser receives view JSON already
  produced by pure builders; templates must not recompute verdicts or rates.
- **Loopback only.** Gate 6 (localhost / local process) is load-bearing; the
  server must not bind `0.0.0.0` in this slice.
- **No CDN.** Offline and secret-free CI require in-package CSS/fonts policy
  (system fonts acceptable).
- **concepts_sandbox mock is non-authority** for layout density only.
- Checkpoint after each step; keep CURRENT_STATUS truthful.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm format:check`
- [ ] `pnpm boundaries`
- [ ] `pnpm test` (unit, conformance, integration, scenario)
- [ ] `pnpm docs:check`
- [ ] `pnpm build`
- [ ] `git diff --check`
- [ ] No network dependency to render the shell.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md`
- [ ] ADR-0024
- [ ] design specification and backlog

## Handoff and Follow-ups

- Current state: Ready; implementation starting.
- Next after this slice: deeper S1/S2/S5–S10 renderers, optional plan launch
  from UI, polish from mock.
- Blockers: none.
- Open questions: none for this bounded slice.

## Finalize When Complete

- Archive under `docs/finished/`.
- Restore template or next approved task.
- Signed JOURNAL entry.
