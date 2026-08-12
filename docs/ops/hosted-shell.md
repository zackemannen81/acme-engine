# Hosted Evidence Workbench operations (ACME-0086)

## Authority

- [ADR-0034](../adr/0034-poc-1-hosted-shell-identity-and-topology.md) — identity
  and topology
- [ADR-0033](../adr/0033-postgresql-persistence-architecture.md) — PostgreSQL
- [postgresql-operations.md](postgresql-operations.md) — migrate, pools, backup

## Topology

```text
Browser ──HTTP──► evidence-workbench-api ──pg wire──► PostgreSQL (acme + evidence)
                         │
                         └── in-process worker (same process for V1 hosted shell)
```

V1 hosted shell runs API and worker in one Node process for operational
simplicity. Horizontal split of the worker is a later composition change and
does not require a new identity ADR.

## Health

`GET /health` returns `{ status: "ok", service, workspaceId }` without
database secrets.

## Environment

| Variable | Purpose |
| --- | --- |
| `ACME_PERSISTENCE=postgres` | Select PostgreSQL adapters |
| `ACME_POSTGRES_URL` | Direct wire URL (not transaction pooler) |
| `EVIDENCE_WORKBENCH_PORT` | Listen port (default 8790) |
| `EVIDENCE_WORKBENCH_SEED` | `development` \| `evaluation` \| `none` |

## Deploy

See [deploy/evidence-workbench/README.md](../../deploy/evidence-workbench/README.md).

## Synthetic-only

Hosted composition does not widen product authority. Data policy remains
`synthetic-only`. Non-synthetic paths require slice 9 governance.
