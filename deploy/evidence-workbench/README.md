# Hosted Evidence Integrity Workbench

POC #1 hosted multi-process shell (ACME-0086 / ADR-0034).

## Identity

Single immutable reviewer reference (`unauthenticated-local`). No Supabase Auth.
See [ADR-0034](../../docs/adr/0034-poc-1-hosted-shell-identity-and-topology.md).

## Prerequisites

1. Build the monorepo: `corepack pnpm build`
2. PostgreSQL 15 with direct wire access (not transaction pooler port 6543)
3. Migrate once (composition migrates on start) or run ops migrate steps in
   [postgresql-operations.md](../../docs/ops/postgresql-operations.md)

## Run with Docker Compose

```bash
export ACME_POSTGRES_URL=postgresql://acme:acme@host.docker.internal:55432/acme
docker compose -f deploy/evidence-workbench/docker-compose.yml up
```

Open `http://127.0.0.1:8790/`. Health: `GET /health`.

## Run without Docker

```bash
export ACME_PERSISTENCE=postgres
export ACME_POSTGRES_URL=postgresql://acme:acme@127.0.0.1:55432/acme
export EVIDENCE_WORKBENCH_SEED=development
corepack pnpm --filter @acme/evidence-workbench-api start:local
```

## Boundary

Browser → product API only. Never expose `acme` or `evidence` schemas via
PostgREST or anonymous keys.
