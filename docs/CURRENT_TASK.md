# Current Task

Task ID: ACME-0153
Parent Task: None
Status: Ready
Owner: Claude
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- [ADR-0035](adr/0035-evidence-authenticated-principal-and-authorization.md)
- [ADR-0036](adr/0036-evidence-case-management-and-isolation.md)
- [ADR-0047](adr/0047-evidence-application-model-reset.md) §4 and §6 — auth is
  shared infrastructure, carried forward and linked against
- [V2 domain specification](design/evidence-workbench-v2-domain-specification.md)
  §2 (`Case` is an access boundary), §8 proof rules
- [ACME-0152](finished/ACME-0152_v2-persistence-and-surfaces.md) — the app this
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

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm format:check`
- [ ] `pnpm boundaries`
- [ ] `pnpm test:unit`
- [ ] `pnpm test:conformance`
- [ ] `pnpm test:integration`
- [ ] `pnpm test:scenario`
- [ ] `pnpm test:postgres`
- [ ] `pnpm docs:check`
- [ ] Recorded local run: sign-in, the full ACME-0152 journey, a second
      principal denied, sign-out

## References

- ADR-0035 — authenticated principal, BFF session, deny-by-default
  authorization.
- ADR-0036 — the case boundary and cross-case non-disclosure.
- `@acme/evidence-auth`: `createEvidenceSessionService`,
  `authorizeEvidenceCaseAction`, `EvidenceIdentityRepository`.
- `@acme/adapter-evidence-auth-postgres`, `@acme/adapter-evidence-auth-memory`.

## Checklist

- [ ] Compose the identity repository and migrations beside the V2 schema.
- [ ] Session service, sign-in, sign-out and session read.
- [ ] Same-origin and CSRF enforcement on unsafe methods.
- [ ] Authenticate every route; name the action per case-scoped route.
- [ ] Case creation writes the identity case and owning membership.
- [ ] Scope case listing to the principal's memberships.
- [ ] Sign-in page and signed-in header.
- [ ] Offline tests, including the non-member 404 matrix.
- [ ] PostgreSQL-gated durability test.
- [ ] Recorded run with a signed-in operator and a denied second principal.
- [ ] Reality-sync `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `FILESTRUCTURE.md`.
- [ ] Archive and restore the template.

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

- [ ] Offline gates as listed above.
- [ ] PostgreSQL gate.
- [ ] Recorded run with counts and the denial matrix.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/FILESTRUCTURE.md`
- [ ] `docs/JOURNAL.md`
- [ ] ADRs — none expected. ADR-0035 and ADR-0036 are applied, not amended.

## Handoff and Follow-ups

- Current state: charter frozen at `Ready`.
- Next recommended step: implement against the checklist.
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
