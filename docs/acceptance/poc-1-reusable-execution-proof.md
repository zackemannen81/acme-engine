# POC #1 — reusable execution proof

Status: Measured, scoped
Date: 2026-08-17
Task: [ACME-0155](../finished/ACME-0155_poc-1-reusable-execution-proof.md)
Source run: [ACME-0154](../finished/ACME-0154_v2-observation-occurrence.md)
Contract: [ADR-0048](../adr/0048-evidence-v2-observe-contract.md)

## The claim this document is allowed to make

> Evidence Workbench POC #1 provides the first concrete proof that ACME
> delivers reusable execution value to applications built on top of it.

That sentence is about the **engine**, not about a finished evidence product.
The recorded run shows that a new application can compose `@acme/core` and
receive bounded execution, persisted state, idempotent resume, encrypted
payload retention and provider-cost control — without implementing those
mechanisms itself.

It is **not** V1 acceptance of the V2 application. Review, standing, claims,
relations and consensus projection are unbuilt. [ADR-0047](../adr/0047-evidence-application-model-reset.md)
§9 is claimed only at that later gate, and only with the `packages/core` diff
as evidence. This document records the first live data point for that
obligation; it does not close it.

## What was measured

Recorded 2026-08-17 on a fresh PostgreSQL database and a fresh object-store
bucket, through the V2 application's own authenticated routes, over the real
74,469-line Stage A `source-A` text, model `gpt-5.6-luna`. Full table:
[ACME-0154 Verification](../finished/ACME-0154_v2-observation-occurrence.md).

| Property | Measured result |
| --- | --- |
| Planned execution | 2 bounded model calls over 2 windows |
| Actual provider calls | 2 |
| Wall time | 11,812 ms to HTTP 201 |
| Committed windows | 2 of 2 |
| Occurrences | 27, complete |
| Quotes not verbatim in their own source lines | 0 of 27 |
| Stored bounds that are not calendar values | 0 of 27 |
| Ledger | 2 calls, 2,438 input + 1,255 output tokens |
| Provider cost | unknown — the provider reported none; not interpreted as zero |
| Retained payloads | 2 of 2 AES-256-GCM, `keyId evidence-v2-ledger` |
| Decrypt under the ledger key | 2 |
| Decrypt under the session key | 0 |
| Re-run | planned 0, actual 0, ledger still 2 |
| Instance page | HTTP 200, 27 occurrences rendered |

The engine composition is `createEvidenceV2Extractor` in
`apps/evidence-workbench-v2-api`, which calls `createExecutionEngine` with
`evidenceV2Module`. The extractor does not call a provider.

## What that proves

These are demonstrated properties of ACME as used by an application, not
assertions about a design.

| ACME property | What the run showed | Where it is specified |
| --- | --- | --- |
| Bounded execution | Planned count stated before spend; planned = actual = 2 | ADR-0048 §4, R-09, `AGENTS.md` live-call policy |
| Persisted state | Both windows and 27 occurrences survive the request | ADR-0048 §6, R-05 |
| Idempotent resume | Re-run planned 0, spent 0, ledger stayed at 2 | ADR-0048 §7, ADR-0017 |
| Encrypted payload retention | Both request/response payloads decrypt only under the ledger key | ADR-0016, ADR-0048 §8 |
| Provider-cost control | Tokens recorded; missing cost stays unknown | ADR-0044, `AGENTS.md` |
| Untrusted model output | Quote and locator come from the cited unit, never the response | ADR-0048 §2 |
| Fail-closed window | A citation outside the window persists nothing | ADR-0048 §5 |

Offline tests assert the same properties without a provider. The live run is
the only claim about the product on real material (W-01).

## What this does not prove

- The V2 application is not a finished POC #1 product. An occurrence is
  canonical evidence, not accepted evidence.
- Replay-to-same-digest through `loadReplayEvidence` was **not** run.
  Nothing was re-sent; both executions are committed with request and
  response hashes. The DoD clause holds in substance, not by digest
  assertion. Recorded in ACME-0154 rather than smoothed over.
- The frozen workbench under `apps/evidence-workbench-*` is not repaired.
  It remains a diagnostic reference (ADR-0047).
- The screenshot and extract under `docs/hrd/` (`openAI_runtime-jobs.png`,
  `openAI_log.md`) are old **V1** provider artifacts from the frozen observe
  contract. They are not this run and are not cited here.
- Stage B, arbitrary ingestion and real-case-data authority remain closed.

## Tests that pin the claim

### Contract and module — `@acme/module-evidence-v2`

[`packages/module-evidence-v2/test/observe.test.ts`](../../packages/module-evidence-v2/test/observe.test.ts)

| Test | Property |
| --- | --- |
| `pins its identity` | Contract version and `encrypted-payload` retention |
| `shows the model the units and asks for ids, not text` | Provider-safe schema name `evidence_v2_observe_output_1`; no `temperature` |
| `accepts an empty answer, because a window may state nothing` | R-04: empty is valid |
| `never asks the model to enumerate the units it skipped` | No coverage field in the output schema |
| `refuses a unit outside the window` | ADR-0048 §5 |
| `refuses the same unit twice` | ADR-0048 §5 |
| `rejects a stated time that is not a calendar value` | The `då` defect, constrained on the wire |
| `never asks the model to type the time it reports` | Product types the bound |
| `derives a stable request key so a resume addresses the same execution` | ADR-0048 §7 |
| `builds an occurrence from the unit, not from the response` | Authority ladder L2 |

### Extractor — composition onto the unchanged engine

[`apps/evidence-workbench-v2-api/test/extract.test.ts`](../../apps/evidence-workbench-v2-api/test/extract.test.ts)

| Test | Property |
| --- | --- |
| `states the planned call count before spending anything` | R-09 |
| `commits every window and projects its occurrences` | R-05 |
| `builds each occurrence from its unit, never from the response` | ADR-0048 §2 |
| `keeps earlier windows when a later one fails, and reports the failure` | R-05, injected mid-job failure |
| `re-runs only the outstanding windows, re-sending nothing paid for` | ADR-0048 §7 |
| `fails a window closed when the response cites a unit outside it` | ADR-0048 §5 |

### Durability

[`tests/postgres/evidence-v2-persistence.test.ts`](../../tests/postgres/evidence-v2-persistence.test.ts)
— `stores occurrences idempotently and window state per window`.

The PostgreSQL gate's remaining failure is a pre-existing frozen-app resume
test, attributed in
[the backlog](../backlog/postgres-gate-test-hygiene.md). It is not a V2
finding.

## Where core was adapted — and where it was not

### The V2 application did not change the engine

From the ADR-0047 acceptance commit through HEAD, the change set under
`packages/core` is empty. ACME-0150 through ACME-0154 add a domain module, a
contract, a planner, a composition root, persistence and surfaces. They do
not patch the engine to understand occurrences, windows, binders or Swedish
time words.

That is the first live evidence for ADR-0047 §9:

> Materially redefining the application domain did not require materially
> redefining the engine.

§9 is still open as a claim. This is the data point, not the close.

### The one earlier core change that this run depends on

The last commit that touched `packages/core` is `f40264a` ("segmentering
kvar"), **before** ADR-0047. It implements [ADR-0045](../adr/0045-real-material-scale-and-recovery.md)
§5: a bounded repair call.

| File | What changed | Domain-specific? |
| --- | --- | --- |
| `packages/core/src/contracts.ts` | Optional `buildRepairRequest` on `PromptContract` | No. Any contract may offer a repair; a contract without the method is never repaired. |
| `packages/core/src/execution-engine.ts` | Budgeted repair loop; each repair is its own ledgered model call; never on the ADR-0017 resume path | No. Core decides whether a repair is permitted and budgeted, never what it says. |
| `packages/core/src/execution-identity.ts` | `maxRepairCalls` may be greater than zero; still exactly one primary call and zero revision calls | No. Milestone-1 bound relaxed only for the already-declared repair budget. |

The engine did not learn evidence vocabulary. Prompt authorship stayed with
the contract. The V2 observe contract uses that port; it does not extend it.

Integration coverage for the port:
[`tests/integration/execution-repair.test.ts`](../../tests/integration/execution-repair.test.ts).

### Domain-specific adaptation lives outside core

Every defect the live run found was fixed in the application or the contract,
not in the engine.

| Defect found by the live run | Where it was fixed | Why it is not a core change |
| --- | --- | --- |
| Structured-output schema name contained `/`; provider HTTP 400 | `evidence_v2_observe_output_1` in `@acme/module-evidence-v2` | The contract owns the wire name. Core already lowers schemas (ADR-0015). |
| Model rejected `temperature` | Contract sends none | Request shape is the contract's. |
| Model-typed `temporalBound` refused twice (primary + repair) | ADR-0048 §2 amended: model reports the span, product types the kind | Removing an obligation the model cannot meet. |
| Swedish `då` ("then") typed into a temporal bound | Calendar-only `from`/`to` in the output schema and the record type | A word is not a time; the unit's words stay verbatim. |
| Ledger payloads encrypted under the **session** key | Composition root uses `keyId evidence-v2-ledger`, ephemeral if unset | Key selection is a composition concern. Core already encrypts (ADR-0016). |

The first four were invisible offline. The fifth was found by reading the
composition root. Each has an offline test, and the live run was re-recorded
after the key split rather than reported against code that no longer existed.

## Why the live trouble makes the proof stronger

The provider rejected a slash in a schema name, rejected `temperature`,
refused an untyped bound twice, and then answered `då` as a time. Reality
tried to puncture the design. Each hole was closed by making the bad shape
unrepresentable — in the contract or the composition root — and the engine
was left alone. The numbers in the table above were measured on the code
that resulted, not on a prior revision.

## Next

Review and standing over occurrences. An occurrence produced here is
canonical evidence under the authority ladder, not accepted evidence.
That work has its own charter. This document does not start it.
