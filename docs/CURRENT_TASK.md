# Current Task

Task ID: ACME-0169
Parent Task: None
Status: In Progress
Owner: Felix Nissen / Rickard Zakrisson review
Created: 2026-08-19
Last updated: 2026-08-19
Charter frozen at: 2026-08-19T12:48+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0051-canonical-acme-runtime-boundary.md`
- GitHub issue #36, Rickard decision A

## Task Summary

Add one optional runnable standalone process that composes the already-canonical `acme-runtime/1` host/listener with the existing PostgreSQL execution repository and OpenAI Responses gateway. This is the upstream form of the verified Felix runtime-service experiment, rewritten against current canonical runtime APIs and current `main` rather than porting the old AAL contract.

## Task Charter

The charter is frozen. Goal, primary deliverable, scope and Definition of Done must not expand inside ACME-0169.

### Goal

Make canonical `acme-runtime/1` optionally runnable as an explicit fail-closed ACME process without changing engine semantics, core, the runtime wire contract or frozen POC #1.

### Primary Deliverable

A private CLI executable/service mode named `acme-runtime` that starts the existing canonical runtime host/listener using explicit PostgreSQL + OpenAI composition and shuts down cleanly.

### In Scope

- Add service configuration parsing with explicit repository/provider/model/listen/build/auth choices.
- Require PostgreSQL for the first runnable composition; reuse the existing CLI PostgreSQL composition.
- Require OpenAI Responses for the first runnable provider composition; reuse the existing OpenAI adapter and fetch transport.
- Require an explicit runtime build identity for the canonical compatibility descriptor; no repository/fork pin may be hard-coded.
- Add an optional bearer authorizer helper local to the runnable composition, using constant-time comparison.
- Add `acme-runtime` executable entry point with graceful SIGINT/SIGTERM shutdown and bounded non-secret startup output.
- Add focused offline tests for configuration, composition wiring, auth and lifecycle using injected composition/provider transport where practical.
- Update package/bin exports and long-lived docs required by the task.

### Out of Scope

- Any change to `packages/core/**`.
- Any change to canonical `acme-runtime/1` wire semantics or compatibility endpoint shape.
- Any change to Evidence V2/Workbench or `docs/poc-1/**`.
- New provider abstraction semantics, provider auto-detection or hidden model defaults.
- Memory/mock fallback in service mode.
- Runtime deployment, public URL, TLS, DNS, secret distribution, scheduler or hosted infrastructure.
- OAuth, application ReviewItem/materialization, business mutation or Arbetsyta queue/orchestration.
- Stable Connectors abstraction (separate approved task after this task closes).
- Domain-translation reference documentation (separate docs task after this task closes).

### Definition of Done

- `acme-runtime` can be built as a Node executable and starts only from complete explicit production configuration.
- Missing/unsupported repository, provider, model, build identity, auth or listener configuration fails before opening the listener.
- Default service composition uses PostgreSQL + OpenAI through existing adapters; there is no production memory/mock fallback and no hidden model default.
- Runtime descriptor is canonical `acme-runtime/1` and receives `engineBuild` from explicit service configuration.
- Bearer authorization rejects absent/wrong credentials and compares equal-length secret bytes in constant time; the canonical host remains auth-scheme agnostic.
- Listener and composition resources close idempotently and failed listen closes composition resources.
- Focused tests plus all canonical repository gates pass.
- Protected paths have zero task diff: `packages/core`, Evidence V2/Workbench protected paths, and `docs/poc-1`.
- Long-lived docs describe the optional runnable composition without claiming deployment.
- Task is archived and `CURRENT_TASK` restored only after final docs-inclusive canonical CI is green.

### Minimum Verification Gates

- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] package-boundary gate
- [ ] unit suite
- [ ] conformance suite
- [ ] integration suite including focused runtime-service tests
- [ ] deterministic scenario suite
- [ ] build
- [ ] complete PostgreSQL adapter suite
- [ ] protected-path zero-diff review
- [ ] no live provider call and no credential required by CI

## References

- `docs/adr/0051-canonical-acme-runtime-boundary.md`
- `apps/cli/src/acme-runtime-host.ts`
- `apps/cli/src/acme-runtime-listener.ts`
- `apps/cli/src/composition.ts`
- Felix reference implementation: `felixnissen/acme-engine` PR #7 (`FELIX-ACME-0001`)
- Rickard decision: issue #36 comment `A yes — Behåll som alternativ/valbar körbar för canonical acme-runtime/1`

## Checklist

- [x] Confirm ACME-0169 is unused and start from current upstream `main` after PR #35.
- [x] Read canonical runtime and current CLI composition boundaries.
- [x] Freeze ACME-0169 charter.
- [ ] Implement canonical runtime service configuration/composition.
- [ ] Implement bearer helper and executable lifecycle entry point.
- [ ] Add focused offline tests.
- [ ] Open isolated PR and verify protected-path diff.
- [ ] Run and repair full canonical CI without expanding scope.
- [ ] Synchronize long-lived documentation and archive task.
- [ ] Run final docs-inclusive canonical CI and hand off to Rickard.

## Decisions and Notes

- This task consumes Rickard's explicit approval for item A in GitHub issue #36.
- PR #33/ADR-0051 remain authoritative for the runtime protocol. Service composition may compose that boundary but must not redefine it.
- PostgreSQL and OpenAI are one optional runnable composition, not requirements of the runtime protocol itself.
- The service must be testable offline through injected composition/provider transport; CI must not make live OpenAI calls.

## Charter Amendment Log

-none

## Verification

- Pending implementation and canonical CI.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md`
- [ ] ADR update/new ADR only if implementation changes a long-lived decision beyond ADR-0051

## Handoff and Follow-ups

- Current state: ACME-0169 charter frozen on a clean branch from current `main`.
- Next recommended step: implement the optional PostgreSQL/OpenAI runtime process against canonical `acme-runtime/1`.
- Blockers: None.
- Child tasks: None.
- Resume condition: N/A.
- Open questions: None inside the frozen charter.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes, supersede this task instead of rewriting it.
