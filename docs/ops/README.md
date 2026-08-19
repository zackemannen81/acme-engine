# Operations Documents

Discoverability: index. Every member of this directory is listed below,
and members are never renamed or moved to express a change of state.

Operator-facing procedures for running ACME and the Evidence Workbench outside
a developer machine. These documents describe how to operate what exists. They
are not architecture authority: contracts live in `docs/SYSTEMDOC.md`,
decisions in `docs/adr/` and current reality in `docs/CURRENT_STATUS.md`.

Each document states its own authority and boundary at the top, including which
task or ADR authorized the capability it describes.

## Documents

| Document | Covers |
| --- | --- |
| [`postgresql-operations.md`](postgresql-operations.md) | The durable PostgreSQL path for ACME and the product store (ACME-0085 / ADR-0033) |
| [`evidence-artifact-operations.md`](evidence-artifact-operations.md) | Encrypted artifact staging, reconciliation, re-wrap, tombstoned deletion and restore verification |
| [`hosted-shell.md`](hosted-shell.md) | Running the hosted Evidence Workbench shell (ACME-0086) |
| [`evidence-v2-supabase.md`](evidence-v2-supabase.md) | Evidence Workbench V2 on self-hosted Supabase (ACME-0156) |
