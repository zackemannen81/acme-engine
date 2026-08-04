# Current Task

Task ID: ACME-0047
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-04
Last updated: 2026-08-04
Archived: 2026-08-04
Charter frozen at: 2026-08-04

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0019-domain-test-ui-boundary-and-view-contracts.md`
- `docs/adr/0024-local-spa-loopback-workbench.md`

## Task Summary

Render the already-delivered `acme-view-catalog/1` contract as S1 in the
loopback workbench. A developer should be able to inspect the static module
and prompt-contract registries together with bounded discovery of scenarios
and fixtures under the configured scenario root, without reading raw JSON or
exposing a browser-controlled path.

## Task Charter

The charter is editable while status is `Draft` and immutable once the task
reaches `Ready`.

### Goal

Make ACME's registered modules, contracts, scenarios and fixtures navigable
and honestly classified in the local browser workbench.

### Primary Deliverable

A pure S1 HTML renderer and read-only loopback catalog routes that compose the
existing `buildCatalogView`, static registries, runner validator and bounded
Node discovery source.

### In Scope

- Pure S1 HTML rendering from `acme-view-catalog/1` for modules, tasks,
  contracts, scenarios, fixture references, diagnostics and unavailable
  sections.
- Accessible section navigation, tables and status labels without client
  JavaScript or external assets.
- `GET /s1` HTML and `GET /api/catalog` JSON routes.
- Reuse of the process-configured scenario root from ACME-0046; the browser
  cannot provide or change discovery paths.
- Reuse of the interface composition's existing Narrative and Research static
  registries and `@acme/testing`'s `parseScenario` validator.
- Existing bounded, symlink-skipping `discoverCatalogSources`; discovery
  failures remain diagnostics or unavailable sections rather than fabricated
  empty results.
- Focused unit, HTTP integration and browser verification.
- Governing status, system, structure, specification, backlog and journal
  documentation.

### Out of Scope

- New catalog/view contract fields or a second scenario validator.
- Dynamic module, contract, evaluator or adapter discovery.
- Launching conformance kits or adapter targets from S1.
- Browser-provided filesystem paths, arbitrary file reading, file content
  display, editing, deletion or shell execution.
- Rendering S5–S10 or changing S2–S4 behavior.
- Live provider calls, remote hosting, authentication, deployment or package
  publication.
- Core, module, adapter, CLI, persistence or canonical execution changes.

### Definition of Done

- `/s1` renders the S1 contract version plus available modules, contracts,
  scenarios and fixtures from the configured composition and scenario root.
- Registry and task order, full contract fingerprints, invalid scenarios,
  missing/refused references, orphan fixtures and discovery diagnostics are
  copied from the view contract without recomputing or hiding them.
- Missing scenario-root configuration renders scenario and fixture sections
  unavailable while keeping static registries visible.
- `/api/catalog` returns the same view contract used by the HTML route.
- No route accepts a path, provider, credential, script or mutation input.
- Untrusted discovered labels and diagnostic values are HTML-escaped.
- Existing S2–S4 behavior and every repository verification gate remain
  green.
- Long-lived docs reflect S1/S2/S3/S4 as rendered surfaces and name the
  remaining stubs accurately.

### Minimum Verification Gates

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
- [x] Browser verification of S1 content, navigation, responsive layout and
      error-overlay/console state against the loopback server

## References

- `apps/test-ui/src/read-model/catalog.ts`
- `apps/test-ui/src/node-source.ts`
- `apps/test-ui/src/local/composition.ts`
- `apps/test-ui/src/local/server.ts`
- `apps/test-ui/src/web/`
- `apps/test-ui/test/catalog.test.ts`
- `apps/test-ui/test/node-source.test.ts`
- `tests/integration/test-ui-workbench.test.ts`
- `docs/design/domain-test-ui-specification.md`
- `docs/backlog/domain-test-ui-implementation.md`

## Checklist

- [x] Review the governing workflow, project state, catalog contract and ADRs.
- [x] Review the Draft, move it through `Ready`, freeze it and start work.
- [x] Expose the composition's existing static registries without duplication.
- [x] Add and export the pure S1 renderer.
- [x] Compose bounded catalog evidence in the loopback server.
- [x] Add S1 HTML and JSON routes and remove the S1 stub.
- [x] Add renderer and HTTP integration coverage.
- [x] Run browser verification against the complete S1 route.
- [x] Run every minimum verification gate.
- [x] Synchronize governing documentation.
- [x] Archive the completed task and restore the empty current-task template.

## Decisions and Notes

- 2026-08-04: the reviewed Draft moved through `Ready` to `In Progress`; the
  Task Charter and Minimum Verification Gates above are frozen.
- S1 remains a lens. `buildCatalogView` continues to own classification; the
  renderer only formats its versioned output.
- The same process-side scenario root used by S2 launch bounds S1 discovery.
  The browser receives neither an absolute path nor a path input.
- Adapter targets remain explicitly unavailable because this task does not
  create a dynamic adapter registry or an adapter-launch workbench.
- No new ADR is expected: this slice implements the explicit ADR-0024
  follow-up while preserving ADR-0019's pure-renderer and absence rules.

## Charter Amendment Log

- None.

## Verification

- Preliminary `pnpm typecheck` passed.
- Preliminary `pnpm lint` and `pnpm build` passed.
- Focused S1/S2/S3/S4 renderer and workbench integration coverage passed:
  17 tests across 2 files.
- Browser: S1 rendered two registered modules and contracts, one valid
  discovered scenario, three referenced fixtures, full 64-character
  fingerprints and honest unavailable adapter/evaluator sections. Navigation
  reached S2 and returned to S1. No console errors or framework overlay were
  present. Browser verification found and drove a CSS min-width fix; final
  desktop width was 983 px inside a 998 px viewport, and the 390 px breakpoint
  also had no document overflow. The default viewport was restored and S1 was
  left open.
- Full repository gates: typecheck, lint, format, boundaries, docs and build
  passed; unit configuration passed 531 tests in 60 files, conformance passed
  58 tests in 7 files, integration passed 51 tests in 8 files, and scenario
  passed 21 tests in 4 files. `git diff --check` passed.

## Documentation Updates

- [x] `AGENTS.md`
- [x] `README.md` if its current-objective summary changes
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/backlog/README.md`
- [x] `docs/backlog/domain-test-ui-implementation.md`
- [x] `docs/design/README.md`
- [x] `docs/design/domain-test-ui-specification.md`
- [x] ADRs if implementation changes a long-lived decision — no new ADR;
      implementation stays within ADR-0019 and ADR-0024

## Handoff and Follow-ups

- Current state: ACME-0047 complete; S1–S4 are rendered and verified in the
  local loopback workbench.
- Next recommended step: choose one S5–S10 renderer as a separately approved
  bounded charter; S5 memory decisions is the closest continuation from S4.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none that block the bounded charter.

## Finalize When Complete

- Archive this file as `docs/finished/ACME-0047_browser-catalog-renderer.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes, supersede this task instead of
  rewriting it.
