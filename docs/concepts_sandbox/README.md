# Concept work, ideas, sandboxing and future Visions.

This directory contains non-activated and strictly excluded work-in-progress
ideas.

Nothing here is decided architecture, roadmap or current scope. No task may
cite a concepts_sandbox artifact as authority. Normative design lives under
`docs/design/`, `docs/adr/` and the approved development specification.

Each document should state:

- date: `<date>`
- updated at: `<date>`
- owner: `<name or signature>`
- status: `<current status>`

Discoverability: index. Every member of this directory is listed below.
Member state: required. Every document declares date, updated date, owner
and status.

## Known contents

| Path | Notes |
| --- | --- |
| `POC_interfacing.md` | Concept notes only |
| `docs-first-open-source-packaging.md` | Candidate extraction of ACME's latest docs-first workflow into an agent-neutral continuity protocol, templates, profiles and conformance model. Includes the idea-containment model that explains what a concepts sandbox is for, stable addressing, and multi-actor identity allocation. |
| `docs-first-extraction-plan.md` | Candidate operational plan for lifting the docs-first model out of ACME into an independent repository: baseline freeze, extraction ledger, numbered specification requirements, templates, validator, profiles, evidence handling and milestones. Its M0 was executed by ACME-0173 into the separate private `docs-first_continuity-protocol` repository; the plan itself remains non-authority and no name or license is decided. |
| `acme-open-source-strategy.md` | Candidate uncrippled-community-core, licensing, compatibility, certification and staged public-release strategy for ACME. No release decision. |
| `audioleaf-kids-on-acme/` | Design sketch: full AudioLeaf Kids book path on ACME (architecture, package API, task/event map). |
| `research-paper-composer-on-acme/` | Design sketch: research paper composer/validator on ACME (evidence, outline, draft, validate, revise). |
| `legal-evidence-on-acme/` | Design sketch: legal/evidence — interrogation support, classification, cross-ref, assessments with strict provenance. |
| `three-domain-platform-proof/` | Index + criteria for treating Kids + Research + Legal as a general platform proof (still concept only). |
| `acme_cm_001_memory_conflict_benchmark/` | Memory conflict benchmark materials (related stress tests for memory policy). |
| `acme_cm_001_memory_conflict_benchmark.md` | Title stub pointing at the benchmark directory above. Idea bank, not decided architecture. |
| `temp/` | Frozen, despite the name. See the note below. |
| `temp/testregistry_workbench_professional_test_engineering_suite.html` | Visual mock for a Domain Test UI / TestRegistry Workbench. Informs layout discussion only. Normative behavior is `docs/design/domain-test-ui-specification.md` (ACME-0038). |

## `temp/` is frozen, not temporary

The archived `docs/finished/ACME-0038_domain-test-ui-specification-rewrite.md`
names the mock by path, and the normative
`docs/design/domain-test-ui-specification.md` cites the same path as the
layout hypothesis it deliberately did not treat as authority. An archived task
cannot be edited, so the mock became permanently addressed on 2026-08-02 and
the directory name has been misleading ever since.

Do not rename, move or delete anything under `temp/`. Do not add new
disposable material there either: anything an immutable record cites is frozen
from that moment, whatever the directory is called.
