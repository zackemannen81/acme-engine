# Legal / Evidence (interrogation, cross-reference, classification) on ACME — concept sandbox

date: 2026-08-02  
updated at: 2026-08-02  
owner: design sketch (session)  
status: **concept only** — not decided architecture, not roadmap, not scope

## Disclaimer

This folder is a **non-activated design sketch**. Nothing here may be cited as
authority by a task charter, ADR, or implementation. Normative ACME design
lives under `docs/design/`, `docs/adr/`, and the approved development
specification.

**Not legal advice.** This sketch is about software architecture for
evidence-handling systems. It does not claim fitness for real proceedings,
compliance with any jurisdiction, or suitability as a sole decision tool.

## Why this product

If ACME only ever hosts Kids, it looks like a clever narrative engine. A
**legal / evidence** product is the near-ideal final exam:

- Witness A said X at T1; said Y at T2 — both retained.  
- Document D supports X but on a different date — scope matters.  
- Video V contradicts Y — contest, do not delete.  
- Current assessment is Z with explicit sources and uncertainty.  
- Nothing is silently overwritten.

That is the hard ACME problem: contradiction is not automatically deletion;
sometimes supersede, sometimes contest, sometimes coexist under different
time, person, or source scopes — with full provenance and replay.

## Contents

| File | Purpose |
| --- | --- |
| [`01-architecture.md`](01-architecture.md) | Architecture, ownership, audit requirements |
| [`02-package-api.md`](02-package-api.md) | Packages, case state, memory scopes, tasks, ports |
| [`03-task-and-event-map.md`](03-task-and-event-map.md) | Tasks, events, interrogation & cross-ref sequences |

## Sibling sketches

| Product | Folder |
| --- | --- |
| Kids | [`../audioleaf-kids-on-acme/`](../audioleaf-kids-on-acme/) |
| Research paper composer | [`../research-paper-composer-on-acme/`](../research-paper-composer-on-acme/) |
| Legal / evidence | *this folder* |
| Platform proof across three | [`../three-domain-platform-proof/`](../three-domain-platform-proof/) |

## Intentionally not done here

- No backlog activation, ADR, or code
- No changes to ACME-0043 / `CURRENT_TASK.md`
- No jurisdiction-specific rule engines claimed as complete
