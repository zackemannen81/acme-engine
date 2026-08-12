# @acme/adapter-evidence-auth-postgres

Durable Evidence identity/session persistence over the independent
`evidence_identity` PostgreSQL schema.

- Injected `pg.Pool`; composition owns connection lifecycle.
- Transaction-scoped advisory migration lock and checksummed migration ledger.
- Foreign-key and uniqueness constraints for organizations, principals,
  memberships, workspace bindings and sessions.
- Session secrets remain digests or encrypted envelope content; revocation is
  monotonic under concurrent writes.

The adapter has no dependency on Supabase wire APIs.
