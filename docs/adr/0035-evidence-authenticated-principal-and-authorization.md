# ADR 0035 — Evidence authenticated principal and authorization foundation

Status: Accepted

Date: 2026-08-12

Decision owners: ACME maintainers

## Context

ADR-0034 deliberately delivered the synthetic hosted shell with one immutable
`unauthenticated-local` reviewer. The browser currently supplies
`reviewerRef`, may name a `workspaceId`, and reaches product routes without a
verified session. That was sufficient to prove hosted topology and durability,
but it is not an identity or authorization boundary.

The approved product completion plan places verified sessions, organization
membership, product roles and server-derived principals before case management,
secure ingestion and every non-synthetic path. The decision crosses browser,
API, worker, product contracts, persistence and deployment. It therefore must
be fixed before implementation rather than emerging inside route handlers.

Self-hosted Supabase is already the accepted POC persistence platform under
ADR-0029. Supabase Auth is installed but disabled and unadopted. Current
self-hosted Auth supports signup controls, short-lived sessions and asymmetric
JWT signing with a public JWKS endpoint. Supabase recommends established JWT
verification rather than implementing signature algorithms in application
code. Adopting Auth does not authorize PostgREST, browser database access,
Storage, Realtime, Studio or non-synthetic data.

## Decision

### 1. Supabase Auth owns hosted credentials

The hosted Evidence Integrity Workbench adopts **self-hosted Supabase Auth
(GoTrue)** as its credential and upstream session authority.

- Initial authentication is invitation-only email/password.
- Public signup is disabled. User provisioning, invitation delivery, password
  reset, MFA and external OAuth are later administrative/security tasks.
- Hosted Auth uses asymmetric ES256 signing and publishes public keys through
  its JWKS endpoint. The product verifier pins issuer, audience and allowed
  algorithm, checks `exp`, `sub` and `session_id`, rejects missing or ambiguous
  claims and never falls back to decoding without signature verification.
- The legacy shared `JWT_SECRET`, service-role key and publishable key are not
  accepted as user identity. Service credentials never enter browser code.
- Unknown signing keys cause one bounded JWKS refresh and then fail closed.

Supabase Auth decides whether credentials and its upstream session are valid.
It does **not** decide organization membership, product role, workspace access
or Evidence authority.

### 2. The product API is the browser-facing session boundary

The browser continues to communicate only with the product API. It does not
call Supabase Auth directly and does not receive an access token or refresh
token in JavaScript or local storage.

The product API acts as a backend-for-frontend:

1. a same-origin login request sends credentials over TLS to the product API;
2. the API exchanges them with Supabase Auth server-side;
3. the API creates a cryptographically random opaque product-session token;
4. the browser receives only that token in a `Secure`, `HttpOnly`,
   `SameSite=Strict`, `Path=/`, host-only cookie; and
5. the identity repository stores only the product-token digest plus encrypted
   upstream access/refresh material and session metadata.

The raw opaque token is never persisted. Upstream tokens are protected by an
injected key-bearing encryptor; hosted startup refuses missing key material.
Artifact key management remains Stage 4, but authentication secrets cannot be
stored in plaintext while waiting for that stage.

Every unsafe request also requires an exact same-origin check and a session-
bound CSRF value delivered outside the HttpOnly cookie. CORS is deny-by-default.
The login route applies the same origin rule and bounded rate limiting.

The initial session bounds are:

- upstream access-token lifetime no greater than 15 minutes;
- product-session idle timeout of 30 minutes;
- product-session absolute lifetime of 8 hours; and
- rotating upstream refresh tokens handled only by the API.

Configuration may shorten but not lengthen these bounds without a new
security decision. Logout revokes the product session first, clears the cookie
and then attempts upstream logout. A failed upstream logout cannot resurrect
the local session. Missing, malformed, expired, idle-expired or revoked
sessions return `401` without product data.

### 3. Product principals are issuer/subject identities

A principal is identified by the verified `(issuer, subject)` pair, not by
email, display name, browser payload or a JWT role claim. Its stable
`principalRef` is content-derived from the canonical issuer and subject.
Mutable profile labels may be displayed but never participate in identity.

The product owns:

- `Organization`;
- `PrincipalProfile` mapping the verified external identity to
  `principalRef`;
- `OrganizationMembership` with active/suspended status and one product role;
- `WorkspaceOrganizationBinding`; and
- `ProductSession` containing only digests, protected upstream material and
  lifecycle metadata.

These contracts belong in a provider-neutral Evidence identity/auth package,
not `packages/core` or the Evidence domain module. Supabase transport and JWT
verification belong behind adapters. Hosted identity persistence uses its own
PostgreSQL schema and migration ledger; it has no foreign key or atomic
transaction with `acme`, `evidence` or Supabase's managed `auth` schema.

The local/hermetic test composition uses an injected deterministic
authenticator and in-memory identity repository. It may use visibly synthetic
accounts, but it must still authenticate a session and execute the same policy.
There is no hosted `auth=none` mode.

### 4. Organization roles and actions are explicit

The initial organization roles are:

- `viewer`;
- `reviewer`; and
- `organization-admin`.

Authorization evaluates a typed product action against an active membership
and the target workspace's organization binding. It does not trust Supabase's
PostgreSQL `role` claim. The initial matrix is:

| Product action | Viewer | Reviewer | Organization admin |
| --- | ---: | ---: | ---: |
| Read primary product views and immutable sources | allow | allow | allow |
| Read review history | allow | allow | allow |
| Download an already shareable synthetic reviewed export | allow | allow | allow |
| Record review decisions or reaffirm an assessment | deny | allow | allow |
| Propose a synthetic assessment/revision | deny | allow | allow |
| Run the fixed synthetic late-evidence/import fixture | deny | allow | allow |
| Cancel a product job started in the organization | deny | allow | allow |
| Read gated technical audit | deny | deny | allow |
| Manage organization membership | deny | deny | allow |

Membership-management policy is decided here, but its API/UI is not part of
the first implementation task. Real ingestion is not an action in this matrix.

All policy code is deny-by-default: a new route or command has no permission
until it names a typed action and the role matrix explicitly grants it. An
authenticated principal without an active membership receives `403`. A target
bound to another organization, or an unknown target, returns the same `404`
shape to avoid existence disclosure.

Stage 2 temporarily grants an organization member the matrix permissions over
every synthetic workspace bound to that organization. Stage 3 must add case
membership and case roles plus cross-case executable isolation before real
ingestion. Organization authorization is not presented as complete case
isolation.

### 5. The server derives actor identity and authorization context

Browser commands must not contain `reviewerRef`, `principalRef`, role,
organization membership or principal assurance. If supplied, strict schemas
reject them.

After authenticating and authorizing a request, the API creates an immutable
authorization context containing:

- `principalRef`;
- `organizationId` and membership ID;
- effective organization role;
- target workspace ID when applicable;
- typed product action;
- policy version; and
- decision time.

This context is passed to commands/workers server-side. Durable records that
represent a human or operational action retain the relevant context. This is
the actor foundation for later product audit; it does not claim that Stage 2
implements the complete access/export/admin audit trail.

### 6. Review history is migrated by version, never rewritten

`evidence-review-command/1` is a historical unauthenticated command containing
client-selected `reviewerRef`. Authenticated APIs do not accept it.

Implementation introduces a new strict command version without any actor
field and a new review-decision version containing the server-derived
`principalRef`, organization, effective role, policy version and
`principalAssurance: authenticated-session`.

Existing `/1` review decisions remain immutable and renderable with
`unauthenticated-local` assurance. They are never upgraded in place or
misrepresented as authenticated. Builders and repositories accept the
historical and current decision union while new writes produce only the new
version. Jobs and other actor-bearing command records receive equivalent
versioned evolution where required; full product audit remains later work.

### 7. Public and protected HTTP surfaces

Only liveness/health, the login shell and the bounded login/callback endpoints
are public. Session inspection, logout, all product views, source bytes,
exports, job events/cancellation, commands and technical-audit routes require
authentication and an explicit action decision.

Authentication failure is `401`; known-member role failure is `403`;
cross-organization and unknown-resource responses are indistinguishable `404`s.
Responses and logs must not echo credentials, cookies, upstream tokens or raw
CSRF values.

## Required Implementation Proofs

The implementation task must include at least:

1. pure table-driven role/action policy tests, including deny-by-default;
2. authentication conformance for valid, missing, malformed, expired, idle-
   expired, absolute-expired and revoked sessions;
3. issuer/audience/algorithm/subject/session-claim and unknown-key rejection;
4. refresh rotation, logout, upstream-failure and cookie-attribute tests;
5. same-origin, CSRF and login rate-limit refusal tests;
6. viewer/reviewer/admin API black-boxes and a no-client-principal proof;
7. cross-organization workspace non-disclosure for every current route family,
   job stream/cancel and export;
8. a browser-visible login/logout journey with no token in rendered HTML,
   JavaScript storage or product responses;
9. immutable rendering of historical `/1` decisions and authenticated new
   review identity after file/PostgreSQL reopen;
10. PostgreSQL migration/restart/concurrency tests proving one active session
    record per token digest and no plaintext stored token; and
11. browser-to-database/Auth dependency guards plus log/fixture secret scans.

Default CI remains network-free through injected clocks, randomness,
authenticator/JWKS transport and deterministic fixtures. A separately gated
self-hosted Auth integration test is required before hosted activation.

## Alternatives Considered

### Browser-side Supabase client with tokens in local storage

- Benefits: standard client integration and automatic refresh.
- Costs: exposes bearer and refresh tokens to browser JavaScript, adds a direct
  browser service dependency and weakens ADR-0029's product-API boundary.
- Reason not selected: the BFF can keep credentials server-side and present one
  same-origin product surface.

### Browser-side Supabase client with SSR cookie helpers

- Benefits: supported PKCE/cookie lifecycle and less custom session code.
- Costs: the current dependency-free client is not an SSR framework; browser-
  readable refresh behavior and direct Auth traffic would still redefine the
  existing topology.
- Reason not selected: an opaque BFF session is a clearer fit for this product
  and keeps upstream tokens out of client code.

### Product-owned password hashes and sessions

- Benefits: no Auth component or upstream tokens.
- Costs: ACME would own password storage, verification, recovery and security
  patching despite already operating self-hosted Supabase.
- Reason not selected: credential infrastructure is not ACME's differentiator;
  Supabase Auth supplies the narrower reviewed boundary.

### Trusted reverse-proxy identity headers

- Benefits: very small application implementation.
- Costs: no actual product login/session lifecycle and a fragile deployment-
  specific trust boundary.
- Reason not selected: it does not prove the complete authenticated product
  foundation requested by Stage 2.

### JWT roles as product authorization

- Benefits: authorization can avoid a database read.
- Costs: role changes remain stale until token refresh, workspace binding is
  absent and an identity provider becomes product-policy authority.
- Reason not selected: memberships and workspace bindings are mutable product
  state and must be checked server-side.

## Consequences

### Positive

- Browser-selected reviewer identity is removed from all new decisions.
- Credentials use an established self-hosted component while ACME retains a
  provider-neutral verification and policy boundary.
- Opaque cookies and the BFF keep upstream bearer/refresh tokens away from
  browser JavaScript.
- Organization membership and typed actions provide an executable foundation
  for later case roles and audit.
- Historical synthetic decisions remain honest and immutable.

### Negative

- The product API now owns a security-sensitive BFF session lifecycle and
  encrypted session-token store.
- Auth availability, SMTP/invitation operations, signing-key rotation and
  recovery become operational dependencies.
- A third PostgreSQL application schema and migrations are required.
- Organization authorization still is not case isolation; Stage 3 remains a
  hard prerequisite for non-synthetic data.
- MFA, account administration and a complete product audit trail remain
  unimplemented.

### Follow-ups

- ACME-0091 implements the provider-neutral auth contracts/policy, Supabase
  adapter, identity stores, API/browser session flow and versioned review
  migration. Its live Supabase and PostgreSQL proofs remain explicit
  environment gates.
- Follow with the separate Stage 3 case/workspace management and isolation ADR.
- Define Auth deployment, signing/encryption-key rotation, invitation and
  recovery runbooks before any environment depends on authenticated access.
- Retain Stage 4 secure-artifact/key-management and Slice 9 legal/data-class
  decisions as separate gates.

## Compatibility and Migration

ADR-0035 supersedes only ADR-0034's temporary hosted identity decision. Its
topology, PostgreSQL requirement, browser-to-product-API boundary, disabled
Storage and opt-in live-provider rules remain accepted.

Rollout is fail-closed and ordered:

1. configure Supabase Auth with asymmetric signing, disabled signup, pinned
   site/redirect origins and bounded token lifetime;
2. migrate the new identity schema and versioned product records;
3. bootstrap one organization, at least one organization admin, principal
   mapping and bindings for every existing synthetic workspace;
4. verify no unbound workspace and no organization without an active admin;
5. enable authenticated routes and the new command versions; and
6. remove hosted acceptance of unauthenticated commands.

Startup refuses hosted mode if Auth configuration, session-encryption keys,
organization admin membership or workspace bindings are missing. Bootstrap is
an explicit operator action, never inferred from an email domain or JWT claim.

The file/local path migrates no credentials. Hermetic composition injects an
in-memory identity store and visibly synthetic authenticator. Existing product
JSON and `/1` review records remain readable.

Rollback may return a synthetic/offline environment to the explicitly labelled
unauthenticated legacy composition. It must not expose any environment or data
class that relied on authenticated authorization. No decision in this ADR
opens a non-synthetic path.

## References

- [ADR-0028 — First POC Evidence Integrity Workbench](0028-first-poc-evidence-integrity-workbench.md)
- [ADR-0029 — Self-hosted Supabase persistence](0029-poc-1-self-hosted-supabase-persistence-platform.md)
- [ADR-0031 — Evidence review overlay and views](0031-evidence-review-overlay-and-versioned-views.md)
- [ADR-0033 — PostgreSQL persistence architecture](0033-postgresql-persistence-architecture.md)
- [ADR-0034 — Hosted shell identity and topology](0034-poc-1-hosted-shell-identity-and-topology.md)
- [Evidence product completion plan](../design/evidence-integrity-workbench-product-completion-plan.md)
- [Supabase self-hosted Auth configuration](https://supabase.com/docs/guides/self-hosting/auth/config)
- [Supabase self-hosted asymmetric Auth keys](https://supabase.com/docs/guides/self-hosting/self-hosted-auth-keys)
- [Supabase JWT verification](https://supabase.com/docs/guides/auth/jwts)
- [Supabase user sessions](https://supabase.com/docs/guides/auth/sessions)
