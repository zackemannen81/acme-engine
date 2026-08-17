# Current Task

Task ID: ACME-0153
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- [ADR-0035](../adr/0035-evidence-authenticated-principal-and-authorization.md)
- [ADR-0036](../adr/0036-evidence-case-management-and-isolation.md)
- [ADR-0047](../adr/0047-evidence-application-model-reset.md) §4 and §6 — auth is
  shared infrastructure, carried forward and linked against
- [V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)
  §2 (`Case` is an access boundary), §8 proof rules
- [ACME-0152](ACME-0152_v2-persistence-and-surfaces.md) — the app this
  one closes the hole in

## Task Summary

ACME-0152 made the V2 layers operable and left exactly one thing open, by
decision rather than oversight: the app has no authentication and no
authorization. It binds to loopback, every route names its case, and anyone who
reaches the port reads every case.

That is the only thing standing between this app and a real reviewer touching
it. The specification calls `Case` an access boundary; right now it is a URL
segment.

ADR-0035 and ADR-0036 already decided the model, and `@acme/evidence-auth` plus
its adapters already implement it — principal, session with CSRF and encrypted
upstream credentials, organization and case membership, and a deny-by-default
policy where an unauthorized case is 404 rather than 403. This task wires that
existing machinery into the V2 app. It writes no new authorization model.

## Task Charter

Frozen at Ready.

### Goal

Every V2 route requires an authenticated principal, and case-scoped access is
decided by case membership through the existing policy, with a non-member
unable to distinguish a forbidden case from a missing one.

### Primary Deliverable

The V2 workbench serving sign-in, session and sign-out, with every existing
route authenticated and every case-scoped route authorized through
`authorizeEvidenceCaseAction`, persisted on real PostgreSQL.

### In Scope

- Identity persistence: `@acme/adapter-evidence-auth-postgres` migrated and
  composed alongside the V2 schema, so principals, memberships, cases and
  sessions are durable.
- `POST /auth/session` sign-in, `DELETE /auth/session` sign-out and
  `GET /api/session`, using `createEvidenceSessionService` with its session
  cookie, CSRF token and encrypted upstream session unchanged.
- A development authenticator via
  `createDeterministicEvidenceAuthenticator`, seeded from composition options.
  It is the only credential source this task adds.
- Same-origin enforcement and a CSRF header requirement on every unsafe method,
  matching the frozen application's rule.
- Authentication on every `/api` route and every HTML page except sign-in and
  `/health`.
- Authorization on every case-scoped read and write through
  `authorizeEvidenceCaseAction`, with the action named per route.
- Case creation registers the identity-side case and an owning case membership
  in the same operation, so the creator can immediately read it and nobody else
  can.
- A sign-in page and a signed-in header showing the principal and a sign-out
  control. Nothing more in the surface.
- Tests: a non-member receives 404 for another principal's case on every
  case-scoped route; an unauthenticated request is refused everywhere; a
  missing or wrong CSRF token is refused on writes; sign-out ends the session.
- A PostgreSQL-gated test proving durable sessions and memberships.

### Out of Scope

- Supabase or any real upstream identity provider. ADR-0029 and ADR-0035 allow
  it; wiring it is its own task.
- Password management, invitations, self-registration, password reset.
- New roles, new actions or any change to the policy in `@acme/evidence-auth`.
  If a needed action is missing, stop and charter it.
- Organization administration surfaces, reviewer assignment, audit views.
- `ObservationOccurrence`, extraction, claims, relations, consensus.
- Any change to the frozen set in ADR-0047 §4.
- Any change to `evidence-v2-source-structure/1`, `evidence-v2-chain/1` or the
  V2 persistence schema beyond what identity requires.

### Definition of Done

- An unauthenticated request to any `/api` route or any page other than sign-in
  and `/health` is refused.
- A signed-in principal sees only cases it holds a membership in.
- **A principal with no membership in a case receives 404 — not 403 — from every
  case-scoped route**: case read, artifact list, parts, part source, chains,
  chain read and chain decisions. A test asserts each one.
- A write without a valid CSRF token is refused, and a cross-origin write is
  refused.
- Creating a case makes the creator a member in the same operation; a second
  principal cannot see that case.
- Sign-out invalidates the session for every subsequent request.
- Sessions and memberships survive a process restart.
- The recorded ACME-0152 run still passes with a signed-in operator: fresh
  substrate, real import, 650 parts, 351 chains, the Hussein chain, the
  mis-titled part under `Ammouri, Allia`, and one membership decision.
- No file in the frozen set is modified. `pnpm boundaries` still passes.

### Minimum Verification Gates

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm boundaries`
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance`
- [x] `pnpm test:integration`
- [x] `pnpm test:scenario`
- [x] `pnpm test:postgres`
- [x] `pnpm docs:check`
- [x] Recorded local run: sign-in, the full ACME-0152 journey, a second
      principal denied, sign-out

## References

- ADR-0035 — authenticated principal, BFF session, deny-by-default
  authorization.
- ADR-0036 — the case boundary and cross-case non-disclosure.
- `@acme/evidence-auth`: `createEvidenceSessionService`,
  `authorizeEvidenceCaseAction`, `EvidenceIdentityRepository`.
- `@acme/adapter-evidence-auth-postgres`, `@acme/adapter-evidence-auth-memory`.

## Checklist

- [x] Compose the identity repository and migrations beside the V2 schema.
- [x] Session service, sign-in, sign-out and session read.
- [x] Same-origin and CSRF enforcement on unsafe methods.
- [x] Authenticate every route; name the action per case-scoped route.
- [x] Case creation writes the identity case and owning membership.
- [x] Scope case listing to the principal's memberships.
- [x] Sign-in page and signed-in header.
- [x] Offline tests, including the non-member 404 matrix.
- [x] PostgreSQL-gated durability test.
- [x] Recorded run with a signed-in operator and a denied second principal.
- [x] Reality-sync `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `FILESTRUCTURE.md`.
- [x] Archive and restore the template.

## Decisions and Notes

- The V2 `caseId` is also the identity `caseId`, and the identity record's
  `workspaceId` carries the same value. The V2 model has no workspace object,
  and inventing one to satisfy a shared schema field would be worse than
  reusing the case identity.
- 404 for a non-member is the existing policy's behaviour, not a new choice.
  It is called out in Done because it is the property a test can silently lose.
- The development authenticator is a credential source, not an authorization
  shortcut. Every route still goes through the same policy it would in a hosted
  deployment.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- none

## Verification

```text
pnpm typecheck                          pass
pnpm lint (apps packages tests tooling) pass
pnpm format:check                       pass
pnpm boundaries                         pass
pnpm docs:check                         276 Markdown files
pnpm test:unit                          841/841 (was 836; +5 new)
pnpm test:conformance                   78/78
pnpm test:integration                   70/70
pnpm test:scenario                      26/26
pnpm test:postgres                      41/42 — one pre-existing failure
```

The PostgreSQL gate does not pass cleanly, and did not before this task.
Attribution was measured rather than assumed: with this task's working tree
stashed at commit `6c73843`, a clean database gives 1 failure of 41 and a
reused database gives 2 of 41; with this task applied, a clean database gives
the same 1 failure of 42. Both failures belong to the frozen application and
are recorded in [the backlog](../backlog/postgres-gate-test-hygiene.md). The new
`evidence-v2-persistence` suite passes 5/5.

`pnpm lint` at the repository root still reports the pre-existing
`no-unused-vars` in the gitignored ACME-0148 scratch file.

Recorded run: fresh database `acme_v2`, fresh bucket `evidence-v2-poc`, the
real `source-A` text, signed in throughout.

```text
signed in as reviewer@acme.local
import                     988 ms, canonical sha256 matching
lines / parts / chains     74,469 / 650 / 351
--- process restarted, signed in again, all reads from PostgreSQL ---
parts page                 100 of 650      chains page   100 of 351
Hussein chain              13 instances, 2004-10-19 … 2005-09-16
mis-titled part-000387     under Ammouri, Allia, 352 exact source lines
HTML pages                 200 on all six
decision appended          chain view 13 -> 12 instances
                           stored proposal 645 rows, md5 unchanged
                           stored structure 650 rows, md5 unchanged

second principal, no membership
  404  /api/cases/{caseId}
  404  /api/artifacts/{id}/parts
  404  /api/artifacts/{id}/parts/{partId}
  404  /api/artifacts/{id}/chains
  404  /api/artifacts/{id}/chains/{chainId}
  404  /api/artifacts/{id}/chain-decisions
  404  POST import
  case list total 0

unauthenticated /api/cases   401
write without CSRF           401
cross-origin write           403
sign-out 204, then /api/cases 401
```

Every case-scoped refusal is 404. A stranger cannot tell the case exists.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/JOURNAL.md`
- [x] ADRs — none expected. ADR-0035 and ADR-0036 are applied, not amended.

## Discovered While Implementing

**Two case-scoped routes were unguarded, and I believed they were guarded.**
The non-member matrix — one assertion per route, which the charter demanded
precisely because this is the property a test can silently lose — found
`GET /api/cases/{caseId}` and `GET /api/artifacts/{id}/parts/{partId}` still
answering 200 to a principal with no membership. Both now authorize; a test
covers each of the six case-scoped routes plus the write path.

Nothing else discovered was acted on. The two failing PostgreSQL-gate tests
belong to the frozen application and went to the backlog.

## Handoff and Follow-ups

- Current state: complete. The V2 app authenticates every route, scopes case
  visibility to membership, and refuses a non-member with 404.
- Next recommended step: `ObservationOccurrence` — extraction over a chain
  instance, which is the first V2 layer that spends a provider call and the
  first that produces evidence a reviewer accepts or rejects. Alternatively a
  real upstream identity provider, which this task deliberately deferred.
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: none. A real upstream identity provider is deliberately a
  later task.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
