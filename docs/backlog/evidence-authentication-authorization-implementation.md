# Evidence authentication and authorization implementation

Status: Implemented by ACME-0091; retained as discovery record

Decision: [ADR-0035](../adr/0035-evidence-authenticated-principal-and-authorization.md)

## Discovery Context

ACME-0090 fixed the Stage 2 identity, BFF-session, organization membership and
role/action architecture. The current hosted shell still implements ADR-0034's
temporary `unauthenticated-local` identity. ACME-0091 subsequently delivered
ADR-0035 without widening the synthetic-only data policy.

## Proposed Outcome

Implement ADR-0035 as one reviewable security increment:

- provider-neutral auth/session/membership contracts and pure policy;
- deterministic in-memory identity/auth test seams;
- Supabase Auth transport/JWKS verification adapter;
- PostgreSQL identity/session store with encrypted upstream tokens;
- organization/workspace bootstrap and fail-closed startup;
- authenticated API/BFF cookie, CSRF, login/logout/session routes;
- viewer/reviewer/organization-admin enforcement on every current route;
- browser login/logout and removal of client-supplied reviewer identity; and
- versioned authenticated review commands/decisions with legacy history read.

## Why It Is Outside ACME-0090

ACME-0090 is intentionally documentation-only. Dependencies, schemas,
migrations, API/browser behavior and hosted configuration form a separately
reviewable implementation deliverable under the project task-size rule.

## Dependencies

- Accepted ADR-0035.
- Existing ADR-0033 PostgreSQL migration/checksum rules.
- Existing hosted shell and complete synthetic Slice 5 black-box.
- Operator-provided self-hosted Supabase Auth endpoint, publishable key,
  asymmetric JWKS and server-side session-encryption key for the gated hosted
  integration proof.

## Suggested Verification

Use ADR-0035's complete required-proof list as minimum gates. In addition run
the repository typecheck, lint, formatting, boundaries, unit, conformance,
integration, scenario, PostgreSQL, docs and build gates. Keep all default CI
network-free; run the real self-hosted Auth proof only through an explicit
environment gate.

## Exclusions

- Case management/case-role isolation.
- General user-administration UI, MFA and external OAuth.
- Product audit, object storage, artifact encryption and ingestion.
- Non-synthetic data and Slice 9 authority.
