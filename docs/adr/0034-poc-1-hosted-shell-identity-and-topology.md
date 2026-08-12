# ADR 0034 — POC #1 hosted shell identity and topology

Status: Accepted

Date: 2026-08-12

Decision owners: ACME maintainers

> Superseded in part on 2026-08-12: [ADR-0035](0035-evidence-authenticated-principal-and-authorization.md)
> replaces this ADR's temporary `unauthenticated-local` hosted identity with
> the accepted Supabase Auth/BFF-session and organization-authorization
> architecture. The topology, PostgreSQL, browser-to-product-API, object-
> storage and live-provider decisions below remain accepted.

## Context

Evidence Integrity Workbench slice 8 requires a hosted web, API and worker
composition on self-hosted Supabase PostgreSQL. The technical specification
lists a separate identity/authorization ADR as a prerequisite. [ADR-0029] and
[ADR-0033] already forbid browser-to-database access and keep Supabase Auth,
Storage, Realtime and Studio undecided and disabled.

V1 product mode is single-user synthetic review. Introducing a full identity
provider for a synthetic-only POC would expand scope without improving the
slice 8 capability: complete the same primary journey through multi-process
hosted composition with durable PostgreSQL and process restart.

## Decision

### Identity for POC #1 hosted shell

- The hosted shell uses the same **single immutable reviewer reference** model
  as the local workbench (`principalAssurance: unauthenticated-local`).
- No login, session, invitation, authorization matrix or identity-provider
  integration is introduced in this slice.
- Supabase Auth remains disabled and is not a dependency of the hosted shell.
- Multi-tenant isolation, operator accounts and real-data access control require
  a future ADR before any non-synthetic path (slice 9).

### Topology

- Hosted composition is **multi-process**: loopback or container network HTTP
  product API, worker process, and static/HTML web shell served by the API (as
  today) or a co-located reverse-proxy path.
- Persistence is **PostgreSQL only** for the hosted composition (schemas `acme`
  and `evidence` via ADR-0033 adapters). SQLite/file adapters remain local
  defaults.
- Credentials stay **server-side** in the composition root environment.
- The browser continues to call **only the product API**.

### Object storage

- Not adopted. Artifact text remains in the product store as today. Supabase
  Storage remains disabled.

### Live provider

- Hosted shell may expose an **opt-in** bounded live gateway behind the same
  environment-credential and explicit-gate patterns as the CLI. Default seed
  and black-box paths remain deterministic mock fixtures.

## Consequences

### Positive

- Slice 8 can prove multi-process durability and primary journey without
  inventing multi-tenant identity.
- Boundaries from ADR-0028–0033 remain intact.

### Negative

- No authenticated multi-user hosted product yet.
- A later identity ADR must migrate principal modeling before real data.

## Alternatives considered

### Supabase Auth for hosted shell

- Benefits: platform-native sessions.
- Costs: new dependency, browser token surface, out of V1 single-user charter.
- Reason not selected: premature for synthetic POC.

### Defer entire slice 8 until full IdP ADR

- Benefits: cleaner future identity.
- Costs: blocks proof of multi-process hosted durability, which is the slice
  capability.
- Reason not selected: identity is separable; process topology is not.

## Compatibility

No change to core ports. Local single-process workbench remains available.

## References

- ADR-0028, ADR-0029, ADR-0031, ADR-0033
- Technical specification section 15 slice 8
