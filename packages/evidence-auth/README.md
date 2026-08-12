# @acme/evidence-auth

Provider-neutral Evidence product identity, BFF-session and authorization
contracts (ADR-0035 and ADR-0036).

- Stable principals derive from a verified issuer/subject pair.
- Product-owned organizations, memberships and workspace bindings feed a pure
  deny-by-default action policy.
- Explicit cases and case-viewer/reviewer/admin memberships gate content;
  organization-admin alone has no implicit evidence-read authority.
- Case lifecycle and participant changes use monotonic revisions; participant
  persistence advances membership and case revision atomically.
- Opaque product sessions retain only token/CSRF digests and an encrypted
  upstream session envelope.
- Idle, absolute, refresh and revocation rules are deterministic behind
  injected clocks, secrets, hashing and encryption.

This package does not own credentials, HTTP, PostgreSQL or Evidence domain
semantics.
