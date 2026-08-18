# Evidence Workbench V2 on self-hosted Supabase (ACME-0156)

## Authority

- [ADR-0029](../adr/0029-poc-1-self-hosted-supabase-persistence-platform.md) —
  self-hosted Supabase is POC #1's persistence platform, the ACME adapter
  speaks plain PostgreSQL, and the browser never reaches the database
- [ADR-0033](../adr/0033-postgresql-persistence-architecture.md) — PostgreSQL
  persistence architecture
- [ADR-0037](../adr/0037-evidence-secure-artifact-foundation.md) — encrypted
  artifact objects behind an S3-compatible port, keys in mounted secret files
- [ADR-0036](../adr/0036-evidence-case-management-and-isolation.md) — case
  isolation
- [V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)

This runbook operates the V2 application. It authorizes no new data class:
Stage A anonymized judicial text remains the only non-synthetic class, and the
product imports text, never a container.

## What the deployment needs

| Component | Value used in the recorded run |
| --- | --- |
| PostgreSQL | Supavisor **session** pooler, `127.0.0.1:5432`, user `postgres.<POOLER_TENANT_ID>`, database `postgres` |
| Schemas | `evidence_v2` (18 tables), `evidence_v2_identity` (8), `acme_v2_ledger` (15) |
| Object store | Supabase Storage S3 protocol endpoint, `http://localhost:8000/storage/v1/s3` |
| Bucket | `evidence-v2-artifacts`, private |
| API | `http://127.0.0.1:8795` |

### The transaction pooler is refused

Port **6543** is Supavisor's transaction pooler and must not be used. ACME
commits at an expected revision with compare-and-swap and holds one connection
across the statements of a transaction; transaction pooling hands a different
backend to each statement, so that guarantee would be silently absent.

`startFromEnvironment` refuses before the first migration:

```text
ACME_V2_POSTGRES_URL points at port 6543, the transaction pooler. ACME commits
at an expected revision and needs a session-scoped connection; use the session
pooler on port 5432 or a direct PostgreSQL connection.
```

### The S3 endpoint host must match `STORAGE_PUBLIC_URL`

Supabase Storage does not verify the signature against the `Host` header it
received. When `STORAGE_PUBLIC_URL` is set it rebuilds the canonical host from
that setting (`getHostHeader` in `storage/protocols/s3/signature-v4.js`).

A request signed against `127.0.0.1:8000` therefore fails
`SignatureDoesNotMatch` even though it routes correctly and the credentials are
right, because the server canonicalizes `localhost:8000`. **The endpoint host
must be spelled exactly as `STORAGE_PUBLIC_URL` spells it.**

The path prefix is fine as it stands: Kong strips `/storage/v1` and forwards
`x-forwarded-prefix`, and storage restores the prefix before signing because
`REQUEST_ALLOW_X_FORWARDED_PATH` is true. The region is not enforced, so
`stub`, `us-east-1` and `auto` are all accepted.

## Configuration

All configuration is environment variables; every secret is a mounted file.
Nothing is read from the repository and no default generates a key — a missing
key is a refusal, because a generated one would silently make yesterday's
encrypted objects unreadable.

| Variable | Meaning |
| --- | --- |
| `ACME_V2_POSTGRES_URL` | session-pooler connection string |
| `ACME_V2_SCHEMA` | default `evidence_v2` |
| `ACME_V2_IDENTITY_SCHEMA` | default `evidence_v2_identity` |
| `ACME_V2_LEDGER_SCHEMA` | default `acme_v2_ledger`, migrated only when live is configured |
| `ACME_V2_PORT` | default `8795`, bound to loopback |
| `ACME_V2_OBJECT_STORE` | `s3` (default) or `file` |
| `ACME_V2_S3_ENDPOINT` / `_REGION` / `_BUCKET` / `_ACCESS_KEY_ID` | Storage S3 protocol endpoint |
| `ACME_V2_S3_SECRET_ACCESS_KEY_FILE` | mounted file holding `S3_PROTOCOL_ACCESS_KEY_SECRET` |
| `ACME_V2_KEK_FILE` | mounted file, one base64 32-byte artifact KEK |
| `ACME_V2_SESSION_KEY_FILE` | mounted file, base64 32-byte session-payload key |
| `ACME_V2_LEDGER_PAYLOAD_KEY_FILE` | mounted file, base64 32-byte retained-payload key — **separate from the session key by design** |
| `ACME_V2_ACCOUNTS_FILE` | development credentials, JSON array |
| `ACME_V2_LIVE_MODEL` | absent means no live capability and extraction answers 501 |
| `OPENAI_API_KEY` | environment-only provider credential (ADR-0040 §5) |

Every `*_FILE` variable has a direct-value counterpart without the suffix. The
file form is what this runbook uses.

## Procedure

Generate the three keys once, outside the repository, and never regenerate them
for an existing deployment:

```bash
node -e "const{randomBytes}=require('node:crypto');const fs=require('node:fs');for(const n of ['artifact-kek','session-key','ledger-payload-key'])fs.writeFileSync('.local/v2/secrets/'+n+'.b64',randomBytes(32).toString('base64'))"
```

Provision the bucket. Idempotent, and it refuses a public bucket:

```bash
node --env-file=.env.v2.local tooling/supabase/provision-v2-bucket.mjs
```

Start the API. Migrations run on startup:

```bash
node --env-file=.env.local --env-file=.env.v2.local apps/evidence-workbench-v2-api/dist/start.js
```

The startup summary is content-free — schemas, port, bucket and model name, no
credential, no case, no source line:

```text
evidence-workbench-v2-api listening
  url            http://127.0.0.1:8795
  schema         evidence_v2
  identity       evidence_v2_identity
  objects        s3 evidence-v2-artifacts @ http://localhost:8000/storage/v1/s3
  live model     gpt-5
```

## Recorded run, 2026-08-18

Real `source-A`: 1,915 pages, container SHA-256
`ab2b9a56…2f7a86`, text prepared outside the product with
`pypdf 6.10.0; default; LF-page-separator/1`.

| Measurement | Value |
| --- | --- |
| Canonical text | 74,469 lines, 3,521,477 bytes, SHA-256 `d9113164…b53f2d` |
| Import | 1,603 ms |
| Persisted | 650 source parts, 351 chains, 1 artifact |
| Stored object | 3,521,477 bytes of ciphertext; `HEMLIG` from source line 1 appears 0 times in the stored file |
| After restart | canonical SHA-256, line, part and chain counts identical; all reads from PostgreSQL |
| Read latency | 261 ms for case, parts page, chains page, part detail and chain detail |
| Pagination | 25 of 650 parts per page, 25 of 351 chains |
| Hussein chain | `chain-000009` "Ammouri, Hussein", 13 instances in body-date order, instances spanning 5 and 3 parts |
| Second principal | 404 on all three case-scoped routes, empty case list |
| Unauthenticated | 401 on `/` and `/api/cases` |

Browser isolation, verified rather than assumed:

| Probe | Result |
| --- | --- |
| PostgREST exposed schemas | `public,storage,graphql_public` — `evidence_v2` is not among them |
| anon key on `/rest/v1/{cases,artifacts,source_parts,chains}` | 404 |
| service-role key on the same tables | 404, `PGRST205` — not an RLS question, the schema is not exposed at all |
| anon key on the artifact object | 400 |
| `anonymous role is denied against acme and evidence schemas` | passes in the PostgreSQL gate |

## Backup and restore

Unchanged from
[postgresql-operations.md](postgresql-operations.md) and
[evidence-artifact-operations.md](evidence-artifact-operations.md). Two things
are worth restating for this deployment: the artifact objects are useless
without the KEK, so a database backup that omits the mounted key files is not a
restorable backup; and the ledger payload key is separate from the session key,
so both belong in the key inventory.

## Known limitations

- Credentials come from a development authenticator reading
  `ACME_V2_ACCOUNTS_FILE`. Wiring the running Supabase Auth is ACME-0163.
- The server binds to loopback. No remote exposure is configured or authorized.
- An acceptance run may not reuse this deployment's database: proof rule 1
  requires a clean database and bucket per proof run.
