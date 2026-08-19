# Docs-First Continuity Protocol — Open-Source Packaging Concept

- Date: 2026-08-10
- Updated at: 2026-08-19
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
- Undecided ideas have a named, non-authoritative home, and they gain
  authority only by explicit restatement in an owning document.
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
| Excluded ideas | `concepts_sandbox/` | Undecided concepts, visions, sketches and mocks that no work may cite as authority |

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

## Idea Containment and the Concepts Sandbox

### The problem it solves

A docs-first system works only while its documents are trustworthy. As soon as
a reader cannot tell approved direction from speculation, or implemented
reality from intention, every document must be re-verified against the code,
the chat history or the original author. That is precisely the failure the
protocol exists to remove.

Long-running work continuously produces material that is valuable but not
decided: alternative architectures, product visions, domain sketches, visual
mocks, competitor notes and unfinished "what if" threads. Such material has
only three possible destinations:

1. an authoritative document, where it silently contaminates the truth
   surface;
2. chat, mail or a personal note, where it leaves the repository and is lost;
   or
3. a marked, non-authoritative area inside the repository.

Only the third preserves both properties the protocol depends on: nothing
valuable leaves the repository, and nothing undecided gains authority.

The concepts sandbox is that third destination.

### Function

`concepts_sandbox/` is a write-friendly, authority-free annex of the
repository. Its boundary is deliberately asymmetric:

```text
ideas, visions, sketches, mocks, rejected paths
  → enter freely: no task ID, no charter, no verification
concepts_sandbox/
  → leave only by explicit restatement
activated task → design document or decision record → authority
```

Material may enter at any time at almost no cost. Material may leave only by
being restated in an owning document through an activated task or a decision
record. Nothing becomes true by sitting in the sandbox, and nothing becomes
true by being linked from an authoritative document.

The sandbox is therefore not "documentation we have not finished yet". It is
the protocol's containment zone for everything the project is not currently
committed to.

### How it differs from the other non-active containers

A mature docs-first repository has four places for work that is not happening
right now. They are not interchangeable, and collapsing them is a common
adoption error.

| Container | Decided | Inside the project charter | May be cited as authority | Normal exit |
| --- | --- | --- | --- | --- |
| `paused/` | Yes, already chartered | Yes | Yes, when resumed | Restored as the active task |
| `backlog/` | No | Yes, a plausible next task | No | Activation as a task |
| `concepts_sandbox/` | No | No, outside current scope | Never | Restatement in a design document or decision record, or supersession |
| `finished/` | Historically decided | Was | As history only | Retained as evidence |

The distinction carrying the most weight is `backlog/` versus
`concepts_sandbox/`. The backlog answers "what should this project do next?"
The sandbox answers "what might exist one day, here or somewhere else?"
Merging them turns the backlog into a wish list, and a wish list is not a
usable routing target for the scope decision tree.

### Why the protocol needs it

| Function | Why it matters |
| --- | --- |
| Authority hygiene | Speculation stays out of the documents describing current reality, approved direction and system behavior |
| Scope protection | The scope decision tree needs a terminal for "interesting, but not this project now"; without one, a discovery either expands a frozen charter or disappears |
| Agent guardrail | Autonomous actors treat plausible repository text as instruction, so an explicitly marked non-authority zone is what makes speculative material safe to keep near the working set |
| Context minimization | The sandbox sits outside the reading order, so an arbitrarily large idea corpus costs no tokens and no reader attention |
| Creative retention | Writing an idea carries no ceremony, so ideas are externalized instead of hoarded in chat, private notes or model context |
| Decision memory | Rejected and superseded paths remain readable with their original reasoning, which prevents re-litigating the same alternative |
| Strictness affordance | A strict core is tolerable only because a zero-friction annex sits beside it; without the annex, contributors route around the strictness itself |

The last point is the least obvious and the most important. Every rule that
freezes a charter, restricts document ownership or blocks silent scope growth
creates pressure. Pressure with no outlet is released by breaking the rule.
The sandbox is the outlet, and it is a large part of why a strict core
survives contact with real exploratory work.

### Rules that make it work

These are candidate normative requirements, drawn from the reference
implementation:

- The sandbox is never part of the documented reading order.
- No task, specification or decision record may cite a sandbox artifact as
  authority.
- An authoritative document may reference sandbox material only with an
  explicit non-authority label stating what the reference is used for.
- Every sandbox document carries date, updated date, owner and status, plus an
  authority-boundary statement naming what it does not decide.
- Sandbox documents describe possibilities; they never assert implementation
  status.
- Content becomes authoritative only by restatement in an owning document.
  Promotion by reference is not permitted.
- Superseded ideas are marked with a dated status and the deciding record
  rather than deleted, unless they are actively misleading.
- An index lists the contents and the status of each item.
- Repository safety rules still apply. The sandbox is not a place for
  credentials, personal data or unlicensed third-party material.

### Observed promotion path

The reference implementation shows both permitted exits.

```text
concepts_sandbox/legal-evidence-on-acme/
  → non-authoritative input to an activated discovery task
design/first-poc-application-discovery.md
  → decided
ADR-0028 — first product proof of concept
  → normative
design/evidence-integrity-workbench-product-definition.md
```

A visual workbench mock took the shorter path. It informed layout discussion
only, the normative specification states that the mock is not authority, and
that specification's own review checklist asks whether the mock was treated as
non-authority. The idea was used without the sketch ever becoming a
requirement.

### Profile mapping

Every profile needs a sandbox, because every domain produces undecided
material.

| Profile | Typical sandbox contents |
| --- | --- |
| Software | Alternative architectures, future domain sketches, unbuilt tooling, UI mocks |
| Creative production | Mood boards, unpitched campaign concepts, tone experiments, parked formats |
| Operations | Proposed topologies, migration ideas, tooling evaluations |
| Research | Unexplored hypotheses, discarded methods, out-of-scope questions |

### Conformance checks

- an excluded, non-authoritative idea area exists and is named;
- it is absent from the documented reading order;
- every sandbox document states date, owner, status and authority boundary;
- no authoritative document derives a requirement from sandbox material;
- references from authority into the sandbox carry a non-authority label;
- promoted material appears restated in an owning document, with the sandbox
  original retained or marked superseded; and
- a cold-start reviewer can state, for any sandbox document, what it does not
  decide.

### Failure modes when it is missing

| Consequence | Observable symptom |
| --- | --- |
| Aspirational architecture | The system model describes components that do not exist |
| Backlog inflation | Hundreds of proposals no charter will ever activate |
| Idea loss | Reasoning survives only in chat logs and individual memory |
| Charter erosion | Speculation is absorbed into the active task because it has nowhere else to go |
| Agent overreach | An autonomous actor implements a sketch it found and reasonably assumed was intended |

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
- internal links and Markdown fences remain valid;
- speculative material is contained in the excluded idea area, is outside
  the reading order and is never cited as authority; and
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
│   └── structured/          # includes backlog/, paused/, finished/, concepts_sandbox/
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
- [Concepts sandbox index](README.md)
- [Docs-first extraction plan](docs-first-extraction-plan.md)

## External References

- [Open Source Definition](https://opensource.org/osd)
- [OSI-approved licenses](https://opensource.org/licenses)
- [Apache Software Foundation licenses](https://www.apache.org/licenses/)
