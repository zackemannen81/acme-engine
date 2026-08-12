# Local Evidence Integrity Workbench

This is the offline Evidence reviewer surface through Slice 5. It starts a
loopback-only product API, a bounded in-process worker and a dependency-free
browser shell. On a new local workspace it imports the open synthetic
`DEV-T01` fixture through the deterministic model mock, then shows two source-
bound observations ready for review.

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
separate in-memory store in this local slice.

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
product API only; it has no database, provider or Domain Test UI access. The
local shell uses Node's built-in loopback server and a dependency-free HTML
client. The accepted React/Vite/Fastify hosted baseline remains work for the
later hosted-shell slice.

Known limitations: one configured unauthenticated local reviewer, synthetic
text only, no authentication/authorization, no arbitrary ingestion, no live
provider and no non-synthetic authority. The local file composition uses one
in-process worker; the separately documented hosted composition supplies the
PostgreSQL multi-process shell.
