# Hosted Evidence Integrity Workbench

POC #1 hosted multi-process shell (ACME-0086 / ADR-0034).

## Identity

The hosted composition requires ADR-0035's self-hosted Supabase Auth adapter,
opaque product-API BFF session and product-owned organization authorization.
The browser never receives upstream tokens. See
[ADR-0034](../../docs/adr/0034-poc-1-hosted-shell-identity-and-topology.md) and
[ADR-0035](../../docs/adr/0035-evidence-authenticated-principal-and-authorization.md).
Case access additionally follows
[ADR-0036](../../docs/adr/0036-evidence-case-management-and-isolation.md): the
public boundary is `caseId`, explicit case membership grants content access and
the internal workspace identifier is never browser authority.

## Prerequisites

1. Build the monorepo: `corepack pnpm build`
2. PostgreSQL 15 with direct wire access (not transaction pooler port 6543)
3. Migrate once (composition migrates on start) or run ops migrate steps in
   [postgresql-operations.md](../../docs/ops/postgresql-operations.md)
4. A private S3-compatible bucket, server credentials and mounted artifact KEK
   files as specified in
   [evidence-artifact-operations.md](../../docs/ops/evidence-artifact-operations.md)

## Run with Docker Compose

```bash
export ACME_POSTGRES_URL=postgresql://acme:acme@host.docker.internal:55432/acme
export EVIDENCE_SUPABASE_URL=https://auth.example.invalid
export EVIDENCE_SUPABASE_ISSUER=https://auth.example.invalid/auth/v1
export EVIDENCE_SUPABASE_PUBLISHABLE_KEY=...
export EVIDENCE_BOOTSTRAP_AUTH_SUBJECT=...
export EVIDENCE_BOOTSTRAP_AUTH_EMAIL=reviewer@example.invalid
export EVIDENCE_SESSION_KEY_BASE64=...
export EVIDENCE_PUBLIC_ORIGIN=https://evidence.example.invalid
export ACME_ARTIFACT_S3_ENDPOINT=https://storage.example.invalid/storage/v1/s3
export ACME_ARTIFACT_S3_REGION=local
export ACME_ARTIFACT_S3_BUCKET=evidence-private
export ACME_ARTIFACT_S3_ACCESS_KEY_ID=...
export ACME_ARTIFACT_S3_SECRET_HOST_FILE=/secure/s3-secret
export ACME_ARTIFACT_KEK_MANIFEST_HOST_FILE=/secure/kek-manifest.json
export ACME_ARTIFACT_KEK_V1_HOST_FILE=/secure/evidence-kek-v1.base64
docker compose -f deploy/evidence-workbench/docker-compose.yml up
```

Terminate TLS in front of port 8790 and open the exact
`EVIDENCE_PUBLIC_ORIGIN`; secure hosted cookies are intentionally not usable
over direct HTTP. The internal health probe remains `GET /health` on loopback.

## Run without Docker

```bash
export ACME_PERSISTENCE=postgres
export ACME_POSTGRES_URL=postgresql://acme:acme@127.0.0.1:55432/acme
export EVIDENCE_WORKBENCH_SEED=development
export EVIDENCE_AUTH_MODE=development
corepack pnpm --filter @acme/evidence-workbench-api start:local
```

The development mode prints no password. Its synthetic-only credentials are
`reviewer@acme.local` / `acme-synthetic-reviewer`; use it only on loopback.
Local mode creates a persistent `0600` synthetic-only KEK file beside the
configured product JSON and stores ciphertext beneath `<product>.objects`.
Neither path is a hosted configuration.

## Boundary

Browser → product API only. Never expose `acme`, `evidence` or
`evidence_identity` schemas via PostgREST or anonymous keys. Public signup must
remain disabled.
