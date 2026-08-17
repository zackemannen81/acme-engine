# Current Task

Task ID: ACME-0103
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-14
Last updated: 2026-08-14
Charter frozen at: 2026-08-14

## Task Summary

Corrective task. The PostgreSQL restart durability test failed in CI with
`expected 404 to be 201`. The test had gone stale against ADR-0036 case-first
routing and nothing executed it, because no PostgreSQL environment was
configured in any prior session.

## Task Charter

### Goal

`pnpm test:postgres` passes against a real PostgreSQL server, and the restart
test proves what it claims through the routes the product actually serves.

### Primary Deliverable

The modernized restart test, verified against a live `postgres:15`.

### In Scope

- Diagnose the CI failure against a real server rather than by reading.
- Modernize the restart test to ADR-0036 case-first routing.
- Confirm the whole PostgreSQL suite passes from a clean database.
- Address any flake the run exposes in the default suite.

### Out of Scope

- Product behavior, contracts, persistence and data authority.
- The unreachable legacy `/api/reviews` branch — reported, not removed.

### Definition of Done

- The PostgreSQL suite passes from a clean database.
- The default suite, typecheck, lint, format, build, docs and diff gates pass.
- The breakage's origin is recorded truthfully.

### Minimum Verification Gates

- [x] `pnpm test:postgres` against a real server from a clean database.
- [x] Canonical typecheck/lint/tests/build/format/docs/diff gates.

## Checklist

- [x] Reproduce the CI failure locally against `postgres:15`.
- [x] Establish whether recent work caused it.
- [x] Find the real cause rather than the first plausible one.
- [x] Modernize the test to case-first routing.
- [x] Verify from a clean database.
- [x] Run canonical verification and address what it exposed.
- [x] Synchronize docs and journal.

## Decisions and Notes

- **Origin.** The case-first route guard that 404s `/api/reviews` without a
  case prefix was introduced in `9037ca1`, before ACME-0099 and ACME-0100.
  Commit `756042b` only added two new prefixes to the same list. The test has
  been broken since `9037ca1` and nothing ran it: the ACME-0098 journal records
  `pnpm test:postgres` refusing for want of a configured server, and every
  session since claimed the same gap.
- **The guard was not the only cause.** Removing `/api/reviews` from the guard
  locally still produced 404, because the test reviewed an observation under
  `first.workspaceId` while the change set bound it to a separate
  `durableWorkspaceId`. Two independent staleness bugs in one assertion.
- **Why the separate workspace existed.** Startup adopts unbound objects of the
  composition's workspace into its case. The original test parked the golden
  E-A01 assessment in a workspace the composition did not manage, to keep it
  out of that adoption. ADR-0036 then made that impossible: reconciliation
  requires every workspace to own exactly one case, so the parked workspace
  fails on restart. Both routes out were blocked, which is why the fix had to
  change what the assessment cites rather than where it lives.
- **What changed in the test.** It now uses the composition's own workspace and
  case, binds source and observation to that case, posts to
  `/api/cases/:caseId/reviews` with `evidence-review-command/3`, and asserts
  `evidence-review-decision/3` with `authenticated-case-session`. The assessment
  cites this case's single observation instead of the evaluation corpus, so it
  survives adoption and scoped-reference validation. Durability is what the
  test proves; which evidence the assessment cites was never material to that.
- **Assertions changed, deliberately.** `/2` to `/3` and
  `authenticated-session` to `authenticated-case-session` is a real change in
  what is proven. It is the correct change: the legacy `/2` path is unreachable
  and implements the caller-supplied `workspaceId` pattern ADR-0036 forbids.
- **Reported, not fixed.** `POST /api/reviews` still contains a
  `requestCaseId === null` branch that reads `command.workspaceId` from the
  request body. The guard makes it unreachable, so it is dead code implementing
  a forbidden pattern. Removing it is a separate cleanup and needs its own
  charter; leaving it means the next person to touch the guard could revive it.
- **A second flake, addressed.** The full default suite intermittently failed
  `compares corrected and later accounts…` at 17s against the default 5s
  timeout, while passing at 4.3s when the machine was idle. It is
  load-sensitive, not a regression, and it sits close enough to the bound to
  flake in CI. It now carries an explicit 30s timeout, matching its sibling in
  the same file. A separate ENOENT race in `test-ui-workbench.test.ts` appeared
  once under the same load and is *not* addressed here — see Follow-ups.

## Verification

- [x] `pnpm test:postgres` — 34 tests, 6 files, against `postgres:15` in Docker
      from a freshly created database, matching the CI service configuration.
- [x] `pnpm test` — 728 unit (115 files), 78 conformance, 62 integration, 26
      scenario.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`,
      `pnpm docs:check`, `git diff --check` — all clean.
- The disposable PostgreSQL container was removed afterwards. The operator's
  Supabase stack was never used for test migrations.

## Handoff and Follow-ups

- Current state: complete. CI's PostgreSQL job should pass.
- Follow-ups, not defects:
  - Remove the unreachable legacy `/api/reviews` branch, or record why it
    stays.
  - The ENOENT race in `tests/integration/test-ui-workbench.test.ts` around
    `workspace/jobs/*.json` reproduced once under load and will likely flake in
    CI eventually.
- Blockers: none.

## Finalize When Complete

- [x] Archive this file under `docs/finished/`.
- [x] Add a signed `docs/JOURNAL.md` entry.
- [x] Leave `docs/CURRENT_TASK.md` with no active task.
