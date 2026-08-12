# @acme/adapter-evidence-product-postgres

Evidence product store over the PostgreSQL `evidence` schema (ADR-0033 /
ACME-0085). Implements the same `EvidenceProductRepository` port as
`@acme/adapter-evidence-product-file`.

## Notes

- Injected `pg.Pool`; the adapter never owns connection lifecycle.
- Full product objects are stored as canonical JSON `text` columns with key
  columns for lookups and uniqueness (file-snapshot translation).
- Migration 2 adds immutable per-command change sets used to reproduce Slice
  5 late-evidence attention after process restart; assessment and append-only
  exact-version review records remain in their existing product tables.
- Own migration ledger `evidence.schema_migrations` with transaction-scoped
  advisory locking.
- No foreign keys into the `acme` schema.
