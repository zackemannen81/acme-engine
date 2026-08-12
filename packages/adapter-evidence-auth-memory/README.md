# @acme/adapter-evidence-auth-memory

Hermetic ADR-0035 adapters for tests and the synthetic local workbench:

- an in-memory identity/session repository with immutable session identity and
  monotonic revocation; and
- a deterministic credential authenticator with no network access.

It is not a hosted credential store.
