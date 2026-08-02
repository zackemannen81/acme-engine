# Three-domain platform proof — concept index

date: 2026-08-02  
updated at: 2026-08-02  
owner: design sketch (session)  
status: **concept only** — not decided architecture, not roadmap, not scope

## Disclaimer

Non-activated thinking only. Not a charter, not an ADR, not backlog.

## Thesis

If **three brutally different products** run on the **same unchanged ACME core**,
each with their own DomainModules, PromptContracts, state schemas, memory
policies and orchestrators, ACME is demonstrated as a **general AI execution
platform** — not merely a clean architecture around one app.

## The three sketches

| Product | Folder | Domain pressure |
| --- | --- | --- |
| AudioLeaf Kids | [`../audioleaf-kids-on-acme/`](../audioleaf-kids-on-acme/) | Creative generation, continuity, safety loops, multimodal production |
| Research paper composer / validator | [`../research-paper-composer-on-acme/`](../research-paper-composer-on-acme/) | Sources, hypotheses vs results, citations, revision under new data |
| Legal / evidence | [`../legal-evidence-on-acme/`](../legal-evidence-on-acme/) | Strict provenance, timelines, testimony conflict, explicit uncertainty |

Cross-cutting note:

| File | Purpose |
| --- | --- |
| [`01-platform-proof-criteria.md`](01-platform-proof-criteria.md) | What “proven general platform” means operationally; shared ops; anti-goals |

## What already exists in ACME today

The engine already has two **reference** domains (`module-narrative`,
`module-research`) plus ScenarioRunner, ledger, replay and adapters. That is
necessary substrate, not yet the three-product proof. Product sketches above
are deliberately thicker (orchestrators, ports, read models).

## Intentionally not done

- No activation of any of the three products  
- No core changes proposed as required  
- No claim that legal sketch is fit for real proceedings  
