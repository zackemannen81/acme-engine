# Local Evidence Integrity Workbench

This is the slice-1 offline reviewer surface. It starts a loopback-only product
API, a bounded in-process worker and a minimal browser shell. On a new local
workspace it imports the open synthetic `DEV-T01` fixture through the
deterministic model mock, then shows two source-bound observations ready for
review.

From the repository root:

```powershell
corepack pnpm build
corepack pnpm --filter @acme/evidence-workbench-api start:local
```

Open `http://127.0.0.1:8790/`. Set `EVIDENCE_WORKBENCH_PORT` to choose another
loopback port. Product data is stored in
`.local/evidence-workbench/product.json`; the ACME execution ledger remains a
separate in-memory store in this local slice.

The default configuration has technical audit disabled. The browser calls the
product API only; it has no database, provider or Domain Test UI access. The
local shell uses Node's built-in loopback server and a dependency-free HTML
client. The accepted React/Vite/Fastify hosted baseline remains work for the
later hosted-shell slice.

Known limitations: one configured unauthenticated local reviewer, synthetic
text only, one in-process worker, no cross-process recovery, no authentication,
no live provider, no relation/timeline/assessment views and no deployment.
