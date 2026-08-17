# Current Task

Task ID: ACME-0130
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15

## Task Summary

Corrective task. The browser shell case-prefixed its own case-catalog request,
so every authenticated session ended at a `404` before the case list loaded.
The client was unusable past sign-in: no case could be selected, and the
Stage A case created for the local POC could not be opened at all.

## Task Charter

### Goal

An authenticated session loads its case catalog, and the operator can select
any case the product returns.

### Primary Deliverable

The corrected `casePath` exemption in the browser shell, plus the local POC
launcher fixes that made the defect hard to see.

### In Scope

- Repair the exemption so it matches the request path, not the query string.
- Confirm no other exempt shell request carries a query string.
- Fix the launcher's recorded process identity and provider-credential source.

### Out of Scope

- Any product behavior, contract, persistence or data-authority change.
- ACME-0129's frozen live acceptance charter, which this task does not touch.
- Provider calls, Stage A import or new browser regression tooling.

### Definition of Done

- The catalog request returns `200` and the case selector is populated.
- A case switch reaches the selected case's own case-first routes.
- Existing web/API gates pass unchanged.

### Minimum Verification Gates

- [x] Browser-observed request/response for the catalog and a case switch.
- [x] Web and API unit suites.

## Checklist

- [x] Reproduce the failure in a real browser and read the network log.
- [x] Locate the exact offending construct in the shell.
- [x] Repair it in the shell source and rebuild.
- [x] Audit every other shell request against the same exemption rule.
- [x] Repair the local launcher defects found while reproducing.
- [x] Verify in the browser and run the focused suites.
- [x] Synchronize docs and journal.

## Decisions and Notes

- Root cause: `casePath` in `apps/evidence-workbench-web/src/index.ts` exempted
  the catalog with `path==='/api/cases'`, comparing the full argument including
  its query string. `loadCaseCatalog` calls
  `/api/cases?organizationId=…`, which is neither equal to `/api/cases` nor
  prefixed by `/api/cases/`, so the exemption missed and the request was
  rewritten to `/api/cases/<caseId>/cases?organizationId=…`.
- The fix compares `new URL(path, location.origin).pathname` instead. Behavior
  for every other request is unchanged, because the catalog is the only exempt
  request that carries a query string; `/api/search?…` and
  `/api/reviewer-work?assignee=me` are meant to be case-scoped and already were.
- The defect entered with `9037ca1` (ACME-0093 case management) and survived
  ACME-0101's parse gate because that gate compiles the emitted module without
  exercising the URLs it builds. Case *creation* kept working throughout, since
  it posts to the separately exempted `/api/organizations/:id/cases`, which is
  why the local POC could create a Stage A case it could then never open.
- Launcher: `startup-full_poc1-autoimport.ps1` recorded the PID of the
  `cmd.exe` wrapper rather than the Node process that owns the port, so a
  restart left the old workbench listening and the script's own
  "already answering" guard then exited `0` without applying the new
  environment or build. It now starts Node directly.
- Launcher: the provider credential was prompted for even when the ignored
  `.env.local` already held one. The workbench process is now started with
  `--env-file-if-exists=.env.local`, so the file's value reaches only the Node
  process. The interactive prompt remains as the fallback.

## Verification

- [x] Before the fix, an authenticated session issued
      `GET /api/cases/rillford-annex-synthetic-case/cases?organizationId=…`
      and received `404`; the case selector stayed empty and the review queue
      never left `Loading…`.
- [x] After the fix the same flow issues `GET /api/cases?organizationId=…` and
      receives `200`, the selector lists both cases, and switching to the
      Stage A case reaches `…/work-queue` and `…/text-imports` with `200`.
      The Documents view renders the Stage A import form.
- [x] `vitest run apps/evidence-workbench-web apps/evidence-workbench-api` —
      23 tests, 8 files, all passing, including `stage-a-blackbox` and
      `local-blackbox`.
- [x] `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm boundaries`,
      `pnpm format:check`, `pnpm docs:check`, `git diff --check`.
- [x] `pnpm test:conformance` 78, `pnpm test:integration` 62,
      `pnpm test:scenario` 26 — all passing.
- [x] `pnpm test:unit` 752/753. `auth-blackbox` times out at its 5,000 ms
      bound under full-suite parallelism on a machine also running the POC
      containers, workbench and a browser; it passes in 566 ms in isolation.
      Proven pre-existing: the identical failure reproduces with this task's
      change stashed and the workspace rebuilt, so it is not caused here. A
      bound for it belongs to a separate charter, like ACME-0103's.
- [x] Launcher: recorded PID equals the process holding port 8790; the run
      reports the credential as read from `.env.local`; `/api/capabilities`
      confirms the complete Stage A live capability.
- [ ] `pnpm test:postgres` — not run; this change touches no persistence.

## Handoff and Follow-ups

- Current state: complete. The client loads, selects and switches cases.
- No provider call occurred and no source content entered Git. The Stage A
  import form was left unsubmitted: its three attestations are operator
  statements, not automation output.
- Follow-up, not a defect: no gate asserts the request paths the shell builds.
  ACME-0101 added a parse gate over the emitted module and this class of defect
  passed straight through it. A shell request-path gate would be a separate
  charter.
- Blockers: none.

## Finalize When Complete

- [x] Archive this file under `docs/finished/`.
- [x] Add a signed `docs/JOURNAL.md` entry.
- [x] Leave `docs/CURRENT_TASK.md` holding the untouched ACME-0129 charter.
