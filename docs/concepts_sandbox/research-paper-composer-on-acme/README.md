# Research Paper Composer / Validator on ACME — concept sandbox

date: 2026-08-02  
updated at: 2026-08-02  
owner: design sketch (session)  
status: **concept only** — not decided architecture, not roadmap, not scope

## Disclaimer

This folder is a **non-activated design sketch**. Nothing here may be cited as
authority by a task charter, ADR, or implementation. Normative ACME design
lives under `docs/design/`, `docs/adr/`, and the approved development
specification.

## Why this product

If Kids proves creative multi-step generation and the legal/evidence domain
proves hard provenance under contradiction, a **research paper composer /
validator** is the bridge: generative structure *and* evidence discipline.

It must:

- separate **hypotheses** from **results** and **claims**
- track which **statements** are supported by which **sources**
- revise conclusions when stronger evidence arrives without silent overwrite
- produce a paper (outline → sections → citations) that can be re-validated

Existing ACME substrate to build on (not replace):

- `@acme/module-research` — observe-evidence, proposition keys, corroboration /
  contest (reference domain, not the full product)
- `docs/concepts_sandbox/acme_cm_001_memory_conflict_benchmark/` — conflict
  scenarios for memory policy stress tests

## Contents

| File | Purpose |
| --- | --- |
| [`01-architecture.md`](01-architecture.md) | Product architecture, ownership, proof criteria vs core |
| [`02-package-api.md`](02-package-api.md) | Packages, state/memory, tasks, ports, composition |
| [`03-task-and-event-map.md`](03-task-and-event-map.md) | Task inventory, events, orchestrator sequences |

## Sibling sketches

| Product | Folder | Domain character |
| --- | --- | --- |
| Kids book creation | [`../audioleaf-kids-on-acme/`](../audioleaf-kids-on-acme/) | Creative continuity, safety, multimodal |
| Research paper composer | *this folder* | Sources, hypotheses, synthesis, revision |
| Legal / evidence | [`../legal-evidence-on-acme/`](../legal-evidence-on-acme/) | Strict provenance, timelines, contested testimony |
| Cross-product platform proof | [`../three-domain-platform-proof/`](../three-domain-platform-proof/) | What “general execution platform” means in practice |

## Intentionally not done here

- No activation into `docs/backlog/`
- No ADR, no charter, no code packages
- No changes to ACME-0043 or `docs/CURRENT_TASK.md`
