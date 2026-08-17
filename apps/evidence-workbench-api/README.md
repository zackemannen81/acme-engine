# Local Evidence Integrity Workbench

This is the offline Evidence reviewer surface through Slice 5. It starts a
loopback-only product API, a bounded in-process worker and a dependency-free
browser shell. On a new local workspace it imports the open synthetic
`DEV-T01` fixture through the deterministic model mock, then shows two source-
bound observations ready for review.

The Documents view accepts one attested synthetic UTF-8 `text/plain` document
per bounded request. It stores exact received bytes and LF/NFC canonical text
as independently encrypted representations, then exposes the canonical source
with immutable line locators. Reviewers can save exact-text redaction drafts;
case admins can apply them as a new encrypted source version. Product routes
are `/api/cases/:caseId/text-imports`,
`/api/cases/:caseId/redactions/drafts` and
`/api/cases/:caseId/redactions/:draftId/apply`.

Slice 2 also provides an observation ledger and account comparison over the
five fixed evaluation source versions. It shows the two corrected `EVAL-T01`
occurrences beside the later `EVAL-T02` account, retains every prior source and
observation, and exposes no sealed truth or technical-audit route.

With `EVIDENCE_WORKBENCH_SEED=evaluation`, the product also exposes relation,
timeline, open-question, assessment and immutable review-history views. After
the reviewer accepts the bounded observations and relations, the browser can
create and review E-A01, import the bounded EVAL-E01 late source, show one
source-linked attention notice, reaffirm E-A01 or create E-A02, and download a
deterministic synthetic-only `evidence-reviewed-assessment-export/1` ZIP.

The browser opens on Case overview: entry counts for sources, observations and
relations still awaiting a decision, open questions and assessments needing
re-review, plus recent product activity. The Integrity report view renders the
deterministic Case Integrity Report — changed accounts, corrections,
contradictions, temporal conflicts, qualifications, unresolved questions and
assessments due for attention — and every listed citation opens its exact
source lines. Both read `/api/cases/:caseId/overview` and
`/api/cases/:caseId/integrity-report`, change nothing and add no persistence.
My review work and Search cover assignments, comments, activity history and
bounded case-scoped search.

A reviewed assessment can be downloaded as PDF, DOCX, Markdown or JSON from
`/api/cases/:caseId/assessments/:id/output/:format`, beside the existing
reviewed-bundle ZIP. Repeating a download returns byte-identical bytes: no
creation timestamp, embedded font or host locale reaches the output. Release is
governed per case by `/api/cases/:caseId/export-policy` — a case admin can
disable export or narrow the format allowlist, and a format outside it is
refused with `403`. Every release and every refusal appends a record readable at
`/api/cases/:caseId/export-audit`.

From the repository root:

```powershell
corepack pnpm build
corepack pnpm --filter @acme/evidence-workbench-api start:local
```

Open `http://127.0.0.1:8790/`. Set `EVIDENCE_WORKBENCH_PORT` to choose another
loopback port. Product data is stored in
`.local/evidence-workbench/product.json`; the ACME execution ledger remains a
separate in-memory store in this local slice. Canonical source plaintext is not
stored in that JSON: it is envelope-encrypted into immutable objects beneath
`.local/evidence-workbench/product.json.objects`, using a persistent local
synthetic-only KEK file beside the product file. Sign in with the synthetic-only
development account `reviewer@acme.local` / `acme-synthetic-reviewer`.

To start the account-comparison fixture with a separate product file:

```powershell
$env:EVIDENCE_WORKBENCH_SEED='evaluation'
$env:EVIDENCE_WORKBENCH_DATA_FILE='.local/evidence-workbench/evaluation-product.json'
corepack pnpm --filter @acme/evidence-workbench-api start:local
```

Open `http://127.0.0.1:8790/?view=compare`. The default seed remains
`development`; `EVIDENCE_WORKBENCH_SEED=none` starts without fixture imports.
Use a fresh evaluation product file for a new local session because this
minimal composition deliberately keeps its ACME ledger in memory.

The default configuration has technical audit disabled. The browser calls the
product API only; it has no database, provider or Domain Test UI access. Every
product route requires the ADR-0035 BFF session and ADR-0036 case policy;
unsafe routes additionally require exact origin and CSRF proof. The local shell
uses Node's built-in loopback server, deterministic credentials and a
dependency-free HTML client.

Hosted mode sets `EVIDENCE_AUTH_MODE=supabase`, requires a stable 32-byte
session-encryption key and uses secure cookies behind the exact configured
HTTPS public origin. See
[`docs/ops/hosted-shell.md`](../../docs/ops/hosted-shell.md).

## POC #1 live composition capability

The default and local compositions remain scripted/mock-only. ACME-0105 adds a
closed hosted capability for ADR-0039/0040; startup makes no provider call and
there is not yet a product route that can invoke it. Enabling the capability
requires every setting below:

| Setting | Required value |
| --- | --- |
| `ACME_EVIDENCE_LIVE` | `1`, `true` or `yes` |
| `ACME_EVIDENCE_COMPOSITION_PROFILE` | `evidence-poc1-live/1` |
| `ACME_HOSTED` | `1` |
| `ACME_PERSISTENCE` | `postgres` with the usual PostgreSQL settings |
| `ACME_EVIDENCE_LIVE_MODEL` | Non-empty provider model id |
| `OPENAI_API_KEY` | Environment-only provider credential |
| `ACME_EVIDENCE_PAYLOAD_KEY_FILE` | Mounted file containing one base64-encoded 32-byte key |
| `ACME_EVIDENCE_PAYLOAD_KEY_ID` | Stable non-secret key id |
| `ACME_EVIDENCE_LIVE_MAX_MODEL_CALLS` | Positive deployment ceiling |
| `ACME_EVIDENCE_LIVE_COST_CEILING_MINOR` | Optional non-negative integer |
| `ACME_EVIDENCE_LIVE_CURRENCY` | Required exactly when the cost ceiling is set |

A key, credential or live-looking environment name alone activates nothing.
File persistence, mock gateway metadata, an ephemeral payload key or non-hosted
mode refuses startup before provider contact. Even after startup, the capability
releases a gateway only for a case-bound `evidence-live-confirmation/1`, a
server-derived case-admin `live-model.run` authorization and an attested
`stage-a-anonymized-judicial-text/1` source with `authorized-external` origin.

The browser lists and selects accessible cases and organization administrators
can create a synthetic case. Evidence requests use `/api/cases/:caseId/...`;
the browser never supplies the internal workspace or actor authority. Case
archive/restore, metadata and participants are available through strict
authenticated APIs.

Case admins can inspect content-free artifact status and product security audit
through `/api/cases/:caseId/artifacts` and
`/api/cases/:caseId/security-audit`. Re-wrap and revisioned tombstoned deletion
are same-origin/CSRF protected administrative operations. Hosted object and key
configuration is documented in
[`docs/ops/evidence-artifact-operations.md`](../../docs/ops/evidence-artifact-operations.md).

Known limitations: the callable product workflow is still synthetic text only;
there is no PDF/DOCX/OCR/media ingestion and no live job/API/browser route yet.
The local file composition uses one in-process worker. Hosted composition can
now validate and hold the closed live capability, but it cannot widen data
authority or contact the provider without the still-unimplemented authorized
Stage A job path.
