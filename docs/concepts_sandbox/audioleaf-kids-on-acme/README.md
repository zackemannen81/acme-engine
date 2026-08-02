# AudioLeaf Kids on ACME — concept sandbox

date: 2026-08-02  
updated at: 2026-08-02  
owner: design sketch (session)  
status: **concept only** — not decided architecture, not roadmap, not scope

## Disclaimer

This folder is a **non-activated design sketch**. Nothing here may be cited as
authority by a task charter, ADR, or implementation. Normative ACME design
lives under `docs/design/`, `docs/adr/`, and the approved development
specification.

Source material for the product flow:

- `c:\code\acme-domain_kids\kids-book-creation-end-to-end-2026-07-23.md`
- `c:\code\acme-domain_kids\kids-illustration-end-to-end-pipeline-2026-07-02.md`
- contracts, policies and pipeline extracts under `c:\code\acme-domain_kids\`

ACME constraints are taken from the live engine repo (`AGENTS.md`,
`docs/PROJECT_BRIEF.md`, `docs/SYSTEMDOC.md`) as **guardrails for the sketch**,
not as a claim that this product path is approved work.

## Contents

| File | Purpose |
| --- | --- |
| [`01-architecture.md`](01-architecture.md) | Full architecture draft: layers, ownership, flow mapping, build order |
| [`02-package-api.md`](02-package-api.md) | Concrete package and module API sketch (types, tasks, ports, composition) |
| [`03-task-and-event-map.md`](03-task-and-event-map.md) | Task inventory, outbox events, orchestrator sequence |

## Sibling product sketches

| Product | Folder |
| --- | --- |
| Kids (this) | `.` |
| Research paper composer | [`../research-paper-composer-on-acme/`](../research-paper-composer-on-acme/) |
| Legal / evidence | [`../legal-evidence-on-acme/`](../legal-evidence-on-acme/) |
| Three-domain platform proof | [`../three-domain-platform-proof/`](../three-domain-platform-proof/) |

## Related (elsewhere)

- ACME reference modules: `@acme/module-narrative`, `@acme/module-research`
- Domain Test UI (separate charter; do not conflate with this sketch)
- Product runtime: AudioLeaf Kids (Inngest, Supabase, onboarding) — out of ACME core

## Intentionally not done here

- No activation into `docs/backlog/`
- No ADR
- No changes to `docs/CURRENT_TASK.md` or ACME-0043
- No code packages created
