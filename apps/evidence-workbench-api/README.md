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

Known limitations: synthetic text only, no PDF/DOCX/OCR/media ingestion, no
live model provider and no non-synthetic authority. The local
file composition uses one in-process worker; hosted composition adds
PostgreSQL durability but does not widen data authority.
