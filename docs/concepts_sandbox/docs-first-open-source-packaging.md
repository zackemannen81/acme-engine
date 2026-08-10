# Docs-First Continuity Protocol — Open-Source Packaging Concept

- Date: 2026-08-10
- Updated at: 2026-08-10
- Owner: Rickard Zakrisson
- Status: Concept — candidate packaging direction, not approved scope

## Authority Boundary

This document is non-authoritative concept work. It does not create a new
project, select a name or license, authorize publication, change ACME's
workflow or make private case-study material publishable. If activated, those
decisions require their own task and, where durable, their own decision record.

## Executive Concept

Package the latest ACME docs-first iteration as an independent, agent-neutral
open-source protocol for project continuity.

The protocol moves working memory out of individuals, model sessions and chat
history into a small repository state that another competent actor can locate,
verify and continue. Software development is one profile. Creative production,
research, operations and other artifact-producing knowledge work can use the
same lifecycle with different verification gates.

The distribution should contain three distinct things:

1. a normative protocol describing document ownership and task transitions;
2. a reference template implementing the protocol; and
3. a conformance suite testing behavior rather than checking only that files
   exist.

## Problem

Long-running work commonly loses continuity because important knowledge is
spread across individual memory, chat and email history, unindexed documents,
stale plans, undocumented decisions and partially completed deliverables.

Adding more documents does not solve the problem. Twenty-five unindexed
binders are documentation but not an effective knowledge system. A usable
system needs a known entry point, explicit ownership, a route to the relevant
source of truth and a dated record of what changed.

## The Technician Test

Imagine that a printer stops working and flashes red. A repair technician asks
for its manual and service history.

Without docs-first, the answer is: "The information may be somewhere among
the twenty-five binders on that shelf."

With docs-first, the answer is: "Start with the index in the yellow binder. It
points to the printer specification in the blue binder, page 99. Beside it is
a dated service note explaining that the same red light was caused by a fuse,
where the fuse is located, how it was replaced, what was verified and who
performed the work."

The technician does not need the organization's complete history. The system
routes one current problem to the right specification, relevant prior change
and next action.

The protocol passes the technician test when a competent newcomer can answer,
without private chat history:

- What is the active task?
- Which document owns the relevant truth?
- What is implemented or produced now?
- What changed, when, why and by whom?
- What was verified and what was not?
- What remains, and which work is explicitly outside scope?

## Product Thesis

```text
private actor context
  → explicit repository state
  → bounded current task
  → relevant authority only
  → work and verification
  → durable status, decision and handoff
  → next actor resumes without full history
```

The primary benefit is not documentation volume. It is **work continuity with
bounded context loading**.

## Protocol Core

### Core invariants

- There is one known entry point.
- There is at most one active task.
- Every document has one semantic ownership role.
- Current reality, intended direction and historical work are not conflated.
- A task has an explicit goal, deliverable, scope and verification plan before
  work begins.
- A ready task freezes its semantic charter.
- New discoveries follow a decision tree instead of silently expanding scope.
- Incomplete work leaves explicit blockers, next steps and verification gaps.
- Completion updates durable truth, archives the task and restores a clean
  active state.
- A new actor must be able to resume from repository state alone.

### Reference document ownership

| Semantic role | ACME reference name | Owns |
| --- | --- | --- |
| Entry and guardrails | `AGENTS.md` | Reading order, safety, boundaries and operating rules |
| Active work | `CURRENT_TASK.md` | One task's frozen charter, progress, verification and handoff |
| Task state machine | `TASK_WORKFLOW.md` | States, scope routing, parent/child work and completion |
| Approved direction | `PROJECT_BRIEF.md` | Purpose, goals, non-goals and approved direction |
| Current reality | `CURRENT_STATUS.md` | What exists now and persistent gaps |
| Durable system model | `SYSTEMDOC.md` | Architecture, contracts, behavior or production method |
| Work history | `JOURNAL.md` | Dated, signed evidence of meaningful work waves |
| Repository map | `FILESTRUCTURE.md` | Where artifacts live and why |
| Durable decisions | `adr/` | Decisions, alternatives and consequences |
| Completed work | `finished/` | Frozen historical task records |
| Blocked work | `paused/` | Valid parent tasks waiting on an explicit condition |
| Future work | `backlog/` | Non-activated discoveries and proposals |

Profiles may rename presentation-facing documents, but they must preserve
these semantic roles or publish an exact mapping.

### Task state machine

```text
Draft → Ready → In Progress → Complete
                     ↓
                   Paused
                     ↓
                In Progress

Draft / Ready / In Progress / Paused
  → Cancelled or Superseded
```

The protocol must define which fields freeze at `Ready`, what evidence permits
completion and how a task is resumed without rewriting history.

## Context-Minimization Model

The model should teach progressive context loading:

1. Read the entry instructions and active task.
2. Read current status and only the authority named by the task.
3. Follow links to relevant decisions or specifications.
4. Do not preload all journals, archives or unrelated designs.
5. Perform the bounded work.
6. Write durable results back to their owners.

This reduces human information overload and agent context-window pressure
without hiding history. Old context remains addressable but is not part of
every working set.

## Protocol, Template and Tooling Separation

```text
protocol specification
├── semantic roles and invariants
├── task lifecycle
├── scope decision tree
└── conformance requirements

reference template
├── minimal profile
├── structured profile
└── examples

tooling
├── initializer
├── validator
├── migration assistant
└── optional agent adapters
```

This separation prevents the protocol from becoming tied to one folder layout
or one AI tool.

## Proposed Profiles

### Core profile

The smallest usable loop: entry instructions, current task, current status,
system or production specification, journal, file map and finished archive.

### Structured software profile

Adds frozen charters, unique task IDs, ADRs, parent/child tasks, paused work,
backlog routing, architecture boundaries and stack-specific verification.

### Creative production profile

Maps the same roles to campaign brief, audience, brand rules, source assets,
channel constraints, review decisions, approved exports and publication state.
The initial external pilot includes blog posts, TikTok/Instagram reels and
print material such as flyers.

### Operations profile

Adds runbooks, service ownership, incident evidence, configuration authority,
change validation, rollback and operator handoff.

### Stack verification profiles

| Profile | Example verification |
| --- | --- |
| TypeScript | typecheck, lint, unit/integration, build |
| Python | pytest, mypy/pyright, ruff, migrations |
| React Native | typecheck, Expo export, Android/iOS device QA |
| Unreal/C++ | UBT, asset import, editor reopen, PIE, deterministic frame-rate tests |
| Infrastructure | config validation, dry run, health checks, restore proof |
| Creative | brief traceability, brand review, format/export checks, approval state |

The profile supplies proof obligations. It does not change the task lifecycle.

## Agent Neutrality

The normative protocol must remain independent of Codex, Claude, Grok,
Gemini or any future tool. Thin adapters may translate the protocol into each
tool's instruction surface, but adapters may not redefine document ownership
or task states. Human-only operation remains a first-class mode.

## Conformance Model

A validator should test workflow scenarios, not only filenames:

- work cannot start without an active task;
- one and only one task is active;
- frozen charter fields do not change silently;
- a blocking prerequisite creates a paused parent and bounded child;
- non-blocking discoveries are routed outside the active charter;
- a pause records blocker, next step and resume condition;
- completion records verification, updates durable truth and archives the
  task;
- internal links and Markdown fences remain valid; and
- a newcomer can follow the documented reading path to the active authority.

Conformance should have levels rather than a single badge:

| Level | Meaning |
| --- | --- |
| Template present | Required semantic roles exist |
| Workflow conformant | Task transitions and scope rules validate |
| Handoff conformant | A cold-start reviewer can locate state and next action |
| Evidence conformant | Completion claims resolve to recorded verification |

## Evidence Available Today

A bounded local audit on 2026-08-10 found at least 654 author-tagged journal
entries across four top-level repositories: a Phaser fighting game, a React
Native product, ACME and an Unreal Engine port. This number is a snapshot of
journal entries, not unique tasks, commits or statistically independent
experiments.

The observed actors include the project owner/operator, Codex, Claude model
variants, Grok and Gemini. The work covers architecture, implementation,
debugging, visual iteration, live/device verification, releases and handoffs.
Additional Python, infrastructure, web and product repositories exist but are
not required to justify an initial extraction.

Two external colleagues also use an earlier packaged foundation for creative
marketing production. That is an early transferability signal, not a measured
outcome study.

### Public claim ladder

| Claim class | Permitted statement |
| --- | --- |
| Observed | The protocol has been used across named stacks, work types and actor families |
| Supported inference | Repository-owned context contributed to repeatable handoffs and bounded resumption |
| Not yet proven | Universal applicability, causal productivity gain or quantified cost reduction |

Private journals must not be published raw. A public evidence report should
use aggregate counts, anonymized scenarios, selected consented excerpts and a
reproducible counting method.

## Packaging Shape

```text
docs-first-continuity/
├── SPEC.md
├── README.md
├── LICENSE
├── protocol/
├── templates/
│   ├── core/
│   └── structured/
├── profiles/
│   ├── software/
│   ├── creative/
│   ├── operations/
│   └── stacks/
├── adapters/
│   ├── codex/
│   ├── claude/
│   └── generic-agent/
├── conformance/
├── examples/
└── case-studies/
```

The first release should prefer Markdown and small deterministic checks over a
large framework or hosted service.

## Extraction Strategy

1. Snapshot ACME's current semantic roles and workflow invariants.
2. Mark ACME-specific identity, architecture and verification rules.
3. Parameterize project identity; do not weaken the workflow core.
4. Produce the minimal and structured templates.
5. Recreate representative task scenarios in a neutral fixture repository.
6. Test cold-start handoff with humans and multiple agent families.
7. Add creative and Python profiles from real usage.
8. Publish a technical preview with explicit experimental-version semantics.
9. Simplify only when conformance evidence shows no loss of behavior.

## Versioning and Governance

- Version the protocol independently from templates and tool adapters.
- Treat changes to document ownership, task states and frozen fields as
  compatibility changes.
- Require a decision record for protocol-semantic changes.
- Maintain migration notes between protocol versions.
- Let profiles evolve without silently changing the core.
- Use a public proposal process after external adoption begins.

## License Direction

The concept should use a real OSI-approved open-source license. The simplest
candidate is one license for specification, templates and tooling, avoiding a
confusing multi-license boundary. Apache License 2.0 is a candidate because it
is OSI-approved and includes explicit contribution and patent terms. Final
selection still requires a copyright and legal review.

The license must allow modification and derived works and must not restrict a
field of endeavor if the project is called open source. Those requirements
come directly from the [Open Source Definition](https://opensource.org/osd).

## Release Stages

### 0 — Extraction candidate

- exact ACME baseline captured;
- semantic roles separated from ACME content;
- neutral fixtures and conformance scenarios created.

### 0.1 — Technical preview

- core and structured templates;
- protocol specification;
- manual conformance checklist;
- software and creative examples;
- no stability promise.

### 0.5 — External pilot

- initializer and automated validation;
- structured feedback from independent users;
- migration guide from earlier templates;
- first anonymized evidence report.

### 1.0 — Stable protocol

- frozen compatibility policy;
- versioned conformance suite;
- at least three maintained profiles;
- governance and security policies;
- documented upgrade path.

## Success Measures

- time for a cold-start actor to locate the active task and relevant SSOT;
- questions requiring unavailable chat or original-author context;
- stale or conflicting authority findings;
- out-of-scope work detected before merge or publication;
- incomplete verification represented honestly;
- task resumption success after actor or tool change; and
- template retention after several real work waves.

## Risks

| Risk | Control |
| --- | --- |
| Process becomes documentation bureaucracy | Keep a minimal profile and measure retrieval/resumption value |
| Users copy files without adopting ownership rules | Conformance tests behavior and lifecycle |
| Protocol overfits ACME | Neutral fixtures plus software, creative and operations profiles |
| Agent-specific wording becomes normative | Separate thin adapters from the protocol |
| Private evidence leaks | Aggregate and anonymize; require consent for excerpts |
| Claims exceed evidence | Publish the claim ladder and counting method |
| Simplification removes stabilizing rules | Compare conformance before accepting simplification |

## Decisions Required Before Activation

1. Project name and trademark availability.
2. Exact v0 protocol boundary.
3. Apache-2.0 or another OSI-approved license.
4. Whether filenames are normative or only semantic roles are normative.
5. Initial conformance implementation language.
6. Which case-study excerpts can be published with consent.
7. Which external creative users may participate in structured feedback.

## Repository References

- [`TASK_WORKFLOW.md`](../TASK_WORKFLOW.md)
- [`CONTRIBUTING.md`](../CONTRIBUTING.md)
- [`CURRENT_TASK.md`](../CURRENT_TASK.md)
- [`ACME-0001`](../finished/ACME-0001_docs-first-foundation.md)
- [`ACME-0002`](../finished/ACME-0002_frozen-task-charter-workflow.md)

## External References

- [Open Source Definition](https://opensource.org/osd)
- [OSI-approved licenses](https://opensource.org/licenses)
- [Apache Software Foundation licenses](https://www.apache.org/licenses/)
