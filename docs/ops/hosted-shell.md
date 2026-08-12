# Hosted Evidence Workbench operations (ACME-0086)

## Authority

- [ADR-0034](../adr/0034-poc-1-hosted-shell-identity-and-topology.md) — identity
  and topology
- [ADR-0035](../adr/0035-evidence-authenticated-principal-and-authorization.md)
  — authenticated identity/authorization architecture
- [ADR-0033](../adr/0033-postgresql-persistence-architecture.md) — PostgreSQL
- [ADR-0037](../adr/0037-evidence-secure-artifact-foundation.md) — immutable,
  encrypted artifacts and product security audit
- [postgresql-operations.md](postgresql-operations.md) — migrate, pools, backup

## Topology

```text
Browser ──HTTPS──► evidence-workbench-api ──pg wire──► PostgreSQL
                            │                    (acme + evidence + evidence_identity)
                            ├──HTTPS──► self-hosted Supabase Auth
                            ├──S3 API──► private ciphertext bucket
                            ├──read────► mounted KEK and credential files
                            └── in-process worker
```

V1 hosted shell runs API and worker in one Node process for operational
simplicity. Horizontal split of the worker is a later composition change and
does not require a new identity ADR.

The hosted mode implements ADR-0035. The browser receives only opaque
`HttpOnly; Secure; SameSite=Strict` product-session state plus a non-HttpOnly
CSRF token. Upstream access and refresh tokens remain encrypted server-side.
The deterministic development authenticator is only for loopback synthetic
work and must not be selected for a hosted deployment.

## Health

`GET /health` returns `{ status: "ok", service, caseId }` without
database secrets.

## Secure artifact foundation

ADR-0037 is implemented. Canonical synthetic source text is encrypted with a
per-object DEK before exclusive S3 creation. The DEK is wrapped by a mounted,
versioned KEK and only envelope metadata reaches PostgreSQL. Hosted startup
requires `ACME_HOSTED=1`, S3 configuration and a mounted KEK file or manifest;
missing configuration refuses startup. The browser receives neither object
keys, signed URLs, credentials, wrapped keys nor plaintext secrets. Enabling a
bucket does not authorize arbitrary ingestion.

## Environment

| Variable | Purpose |
| --- | --- |
| `ACME_PERSISTENCE=postgres` | Select PostgreSQL adapters |
| `ACME_POSTGRES_URL` | Direct wire URL (not transaction pooler) |
| `EVIDENCE_WORKBENCH_PORT` | Listen port (default 8790) |
| `EVIDENCE_WORKBENCH_SEED` | `development` \| `evaluation` \| `none` |
| `EVIDENCE_AUTH_MODE=supabase` | Require the hosted Supabase Auth adapter |
| `EVIDENCE_SUPABASE_URL` | Self-hosted Supabase base URL |
| `EVIDENCE_SUPABASE_ISSUER` | Exact external Auth JWT issuer |
| `EVIDENCE_SUPABASE_PUBLISHABLE_KEY` | Publishable Auth API key; never a service-role key |
| `EVIDENCE_BOOTSTRAP_AUTH_SUBJECT` | Explicitly provisioned first product principal subject |
| `EVIDENCE_BOOTSTRAP_AUTH_EMAIL` | Display/login email for the provisioned principal |
| `EVIDENCE_SESSION_KEY_BASE64` | Exactly 32 random bytes, base64 encoded; stable across restarts |
| `EVIDENCE_PUBLIC_ORIGIN` | Exact external HTTPS origin used for origin/CSRF checks |
| `ACME_HOSTED=1` | Enables hosted fail-closed artifact prerequisites |
| `ACME_ARTIFACT_STORE=s3` | Requires the server-only S3-compatible adapter |
| `ACME_ARTIFACT_S3_ENDPOINT` | S3-compatible server endpoint |
| `ACME_ARTIFACT_S3_REGION` | SigV4 region (`local` for self-hosted Supabase) |
| `ACME_ARTIFACT_S3_BUCKET` | Private ciphertext-only bucket |
| `ACME_ARTIFACT_S3_ACCESS_KEY_ID` | Server S3 access-key id |
| `ACME_ARTIFACT_S3_SECRET_FILE` | Mounted file containing the S3 secret |
| `ACME_ARTIFACT_KEK_FILE` | Mounted base64 32-byte single KEK (initial setup) |
| `ACME_ARTIFACT_KEK_MANIFEST` | Mounted JSON keyring manifest used during rotation |
| `ACME_ARTIFACT_KEK_ID` | Active KEK id |
| `ACME_ARTIFACT_KEK_VERSION` | Active positive KEK version |

Public signup is an Auth-service operator setting and must remain disabled.
Rotate the product session key only with an explicit session-invalidation plan;
old sessions cannot be decrypted after replacement.

See [evidence-artifact-operations.md](evidence-artifact-operations.md) for
staging reconciliation, key rotation, deletion and backup/restore verification.

## Deploy

See [deploy/evidence-workbench/README.md](../../deploy/evidence-workbench/README.md).

## Synthetic-only

Hosted composition does not widen product authority. Data policy remains
`synthetic-only`. Non-synthetic paths require slice 9 governance.
