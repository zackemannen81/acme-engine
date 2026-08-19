# Docs-First Continuity Protocol — Repository Extraction Plan

- Date: 2026-08-19
- Updated at: 2026-08-19
- Owner: Rickard Zakrisson
- Status: Concept — concrete extraction proposal, not approved scope

## Authority Boundary

This document is non-authoritative concept work. It does not create a
repository, select a name, license or hosting account, authorize publication,
commit ACME to any change, or make private case-study material publishable.
It proposes *how* an extraction would be performed if a task were activated.
Every decision listed here remains open until decided by its own record.

## What This Document Adds

[`docs-first-open-source-packaging.md`](docs-first-open-source-packaging.md)
defines *what* the protocol is and why it is worth extracting. This document
answers the operational question: how the working model is lifted out of ACME
and packaged as an independent repository without losing the strictness that
made it work, and without blocking or destabilizing ACME itself.

## Three Governing Principles

### 1. Extract by transcription, not redesign

The ACME workflow is the hardened artifact. Its value comes from rules that
were added *after* observing a real failure. A generalization pass that
rewrites rules from memory will silently discard the failure knowledge, keep
the parts that read well and produce a plausible-looking process that has
never been tested. The extraction therefore copies first, classifies second
and generalizes only project identity.

### 2. The new repository runs the protocol on itself

From its first commit, the extracted repository has its own `AGENTS.md`,
active task, journal, status, archive, backlog and concepts sandbox. This
gives three things at once: the first conformance test, a permanently
maintained live example, and immediate falsification if a rule is unusable in
practice. A continuity protocol whose own repository cannot pass the
technician test has answered its own question.

### 3. Ship a specimen, not a framework

The first release is Markdown plus one dependency-free validator script. No
service, no website, no plugin, no schema registry. The protocol's claim is
that a small amount of well-owned text beats tooling; the distribution should
demonstrate that claim rather than contradict it.

## Decision Summary

| # | Decision | Recommendation | Rationale | Reversible later |
| --- | --- | --- | --- | --- |
| 1 | Repository count | One repository | Pre-1.0 multi-repo overhead kills momentum; the conformance suite needs the templates in-tree | Yes, split when tooling needs its own cadence |
| 2 | Name | A brandable short name plus a descriptive method name, after an availability check | "Docs-first" describes the method well but is generic and unownable as a brand | Painful after adoption; decide before publishing |
| 3 | License | Apache-2.0 for the whole repository, with an explicit statement that files produced from the templates carry no obligation | A template project must be permissive or nobody can adopt it; the patent grant and contribution terms are already explicit | Effectively no; decide before external contributions |
| 4 | Normativity | Semantic roles are normative; filenames are recommended defaults with a required mapping if renamed | Roles survive translation, localization and non-software profiles; filenames do not | Yes |
| 5 | Baseline handling | Keep a verbatim frozen ACME copy in-tree plus a line-level extraction ledger | Makes every generalization auditable and reversible; protects principle 1 | Yes |
| 6 | Validator | One dependency-free Python 3 file, `python3 conformance/validate.py .` | Runs on every developer and CI machine without install, in software and non-software repositories alike | Yes; add an `npx` wrapper if adoption asks |
| 7 | Self-hosting | Yes, from commit 1 | See principle 2 | No reason to reverse |
| 8 | Case studies | Aggregate counts, anonymized scenarios and consented excerpts only | Journals contain client, product and personal material | Yes, more can be released later; nothing can be unpublished |
| 9 | First public stage | Technical preview `v0.1`, explicit "no stability promise" | Invites falsification without freezing the semantics too early | Yes |
| 10 | Relation to ACME | One-way. ACME declares conformance; it never depends on the new repository | A private product must not be blocked by an experimental public project | Yes |

### On the name

The technician story is the strongest asset the project has, and it names
itself: the index that routes a stranger from a blinking light to the right
specification lives in the yellow binder. Candidates worth an availability
check, in the order I would check them:

| Candidate | Positioning | Main risk |
| --- | --- | --- |
| `Yellow Binder` | Human, memorable, non-jargon, ties directly to the founding story | Reads as stationery until the story is told |
| `Binder` | Short, direct, works as a CLI verb (`binder check`) | Likely contested in package registries |
| `Docs-First Continuity Protocol` (`DFCP`) | Precise and self-explanatory as a method name | Generic, unbrandable, hard to search |

Recommendation: use a brandable repository/tool name and keep
"docs-first continuity protocol" as the descriptive method name in the
subtitle and specification title. Verify the name against trademark databases,
package registries and existing projects before any public commit; a rename
after adoption is expensive and permanent in third-party links.

## Step 0 — Freeze the baseline

Goal: an exact, dated, provable copy of the model being extracted.

1. Tag the source state in ACME: `protocol-baseline-2026-08-19`.
2. Copy the following files, unedited, into the new repository under
   `baseline/acme-2026-08-19/`, preserving relative paths.
3. Add `baseline/README.md` recording the source repository, revision, date,
   copier and the rule that this tree is never edited again.

| Source in ACME | Role in the extraction |
| --- | --- |
| `AGENTS.md` | Entry point, reading order, guardrails, workflow summary, verification baseline, definition of done |
| `docs/TASK_WORKFLOW.md` | Task states, scope freeze, decision tree, parent/child rules |
| `docs/CONTRIBUTING.md` | Contribution and documentation obligations |
| `docs/template_CURRENT_TASK.md` | Charter structure |
| `docs/CURRENT_TASK.md` | One real filled charter, as an anonymization source |
| `docs/backlog/README.md` | Backlog routing rules |
| `docs/paused/README.md` | Pause semantics |
| `docs/concepts_sandbox/README.md` | Idea containment rules |
| `docs/FILESTRUCTURE.md` (conventions sections only) | Repository map conventions |
| 3–5 archived tasks from `docs/finished/` | Real lifecycle evidence for fixtures |
| 5–10 `docs/JOURNAL.md` entries | Real handoff evidence for fixtures |

The baseline tree is retained in the published repository. It is the project's
own provenance: any reader can compare the shipped template against the
hardened original that produced the evidence.

## Step 1 — Classify every rule

Goal: a line-level ledger so that no rule is generalized by accident and no
ACME-specific rule leaks into the core.

Create `extraction/ledger.md` with one row per rule or rule group:

| Baseline location | Rule | Class | Destination | Change made |
| --- | --- | --- | --- | --- |
| `AGENTS.md` "Start Here" | Read the named documents in order before changing the repository | CORE | `SPEC.md` C-01 | Names parameterized |
| `AGENTS.md` "Documentation Ownership" | One owning document per semantic truth | CORE | `SPEC.md` C-02 | Verbatim intent |
| `AGENTS.md` "Task Workflow" | Freeze the charter when status becomes `Ready` | CORE | `SPEC.md` C-06 | Verbatim intent |
| `AGENTS.md` "Fixed Architecture Guardrails" | `packages/core` stays domain-neutral | PROJECT | Dropped from core | Shown as a profile example only |
| `AGENTS.md` "Dependency Direction" | apps → adapters → modules → core | PROFILE | `profiles/software/` | Presented as an example guardrail, not a requirement |
| `AGENTS.md` "Live-call policy" | Bounded plan, derived call count, no arbitrary ceiling | PROFILE | `profiles/software/ai-systems.md` | Retained as an optional add-on |
| `AGENTS.md` "Verification Baseline" | Docs-only tasks verify links, fences, diagrams | PROFILE | `profiles/stacks/documentation.md` | Retained |
| `AGENTS.md` "Verification Baseline" | Record exactly what was skipped and why | CORE | `SPEC.md` C-12 | Verbatim intent |
| `TASK_WORKFLOW.md` | Blocking prerequisite pauses the parent, activates a bounded child | CORE | `SPEC.md` C-07 | Verbatim intent |
| `AGENTS.md` project identity block | ACME purpose, phase, milestone history | PROJECT | Dropped | Replaced by a placeholder section |
| `docs/backlog/README.md` | A proposal keeps its path; state lives in the file and the index | CORE | `SPEC.md` C-16, C-17 | Added 2026-08-19 after an observed link break; not present in the original baseline |

Three classes, applied to every line:

- **CORE** — true for any long-running work in any domain. Enters the
  specification, unchanged in force.
- **PROFILE** — true for a stack, domain or work type. Enters a profile
  document, clearly optional.
- **PROJECT** — ACME identity, architecture or history. Dropped from the
  distribution, or replaced by a placeholder.

Rule for disputes: when a rule cannot be confidently classified as CORE, it is
PROFILE. The core stays small; profiles can be promoted later once several
independent adopters need the same rule.

## Step 2 — Write the specification

`SPEC.md` carries numbered, quotable requirements so that conformance results,
issues and profiles can reference them precisely. The proposed v0.1 core, all
derived from the baseline:

### Entry and ownership

- **C-01** The repository has exactly one documented entry point, and that
  entry point names the reading order.
- **C-02** Every durable fact has exactly one owning document.
- **C-03** Current reality, approved direction and historical record are kept
  in separate documents.

### Active work

- **C-04** At most one task is active at any time.
- **C-05** Work on a deliverable does not begin before the active task states
  goal, deliverable, scope, out-of-scope, definition of done and verification
  plan.
- **C-06** When a task becomes ready, its charter freezes. A charter is
  superseded, never quietly rewritten.
- **C-07** Discovered work is routed by an explicit decision tree: inside the
  charter it becomes a checklist item; if it blocks, the parent pauses and a
  bounded child task is activated; if it is in project scope but not needed
  now, it goes to the backlog; if it is outside project scope, it goes to the
  idea sandbox.

### Continuity

- **C-08** Every pause or handoff records blockers, next steps, verification
  gaps and a resume condition.
- **C-09** Every meaningful work wave appends a dated, signed journal entry.
  Journal entries are append-only.
- **C-10** Durable documentation is updated in the same change as the behavior
  or artifact it describes.
- **C-11** A completed task is archived unmodified under a stable identifier,
  and the active-task document is restored to a clean state.
- **C-12** Completion states what was verified and what was not. A skipped
  check is recorded with its reason.

### Containment

- **C-13** Undecided material has a named, non-authoritative home outside the
  reading order.
- **C-14** No normative document derives a requirement from that area.

### Addressing

- **C-16** A record cited by an append-only or archived document keeps its
  path. Status is expressed in content, never in a filename or a location.
- **C-17** Each collection of records has an index naming every member
  exactly once, updated in the same change as the records it describes.

### Resumability

- **C-15** A competent actor with no access to chat history can identify the
  active task, its authority documents, current reality and the next action
  from the repository alone.

Seventeen requirements is deliberate. The specification must be readable in
one sitting, and every requirement must be either machine-checkable or
checkable by a named review ritual.

C-16 and C-17 were not in the first draft of this plan. They were added on
2026-08-19 after the reference implementation broke 39 links by renaming
nine backlog proposals to show their resolved state in the file listing.
That is the intended way for this specification to grow: a rule earns its
place by having been paid for once.

### Conformance levels

| Level | Name | Requirements | Checked by |
| --- | --- | --- | --- |
| L1 | Structure | C-01, C-02, C-03, C-13, C-17 | Validator |
| L2 | Workflow | C-04, C-05, C-06, C-07, C-11, C-16 | Validator, partly with git history |
| L3 | Handoff | C-08, C-09, C-15 | Validator plus the cold-start review ritual |
| L4 | Evidence | C-10, C-12, C-14 | Validator plus review |

## Step 3 — Build the templates

Two templates, both complete and both self-consistent.

```text
templates/
├── core/                     smallest usable loop
│   ├── AGENTS.md
│   └── docs/
│       ├── CURRENT_TASK.md
│       ├── CURRENT_STATUS.md
│       ├── SYSTEMDOC.md
│       ├── JOURNAL.md
│       ├── FILESTRUCTURE.md
│       ├── finished/README.md
│       └── concepts_sandbox/README.md
└── structured/               the hardened ACME shape
    ├── AGENTS.md
    └── docs/
        ├── CURRENT_TASK.md
        ├── template_CURRENT_TASK.md
        ├── TASK_WORKFLOW.md
        ├── PROJECT_BRIEF.md
        ├── CONTRIBUTING.md
        ├── CURRENT_STATUS.md
        ├── SYSTEMDOC.md
        ├── JOURNAL.md
        ├── FILESTRUCTURE.md
        ├── adr/README.md
        ├── backlog/README.md
        ├── paused/README.md
        ├── finished/README.md
        └── concepts_sandbox/README.md
```

Both templates ship the concepts sandbox. It is not an advanced feature: a
project without an idea container starts contaminating its status document in
its first week.

Placeholders are limited to identity, so that a reader can see that the rules
themselves were not softened:

| Placeholder | Meaning | Example |
| --- | --- | --- |
| `{{PROJECT_NAME}}` | Human project name | ACME |
| `{{PROJECT_PURPOSE}}` | One-paragraph purpose | Build and evaluate ... |
| `{{TASK_PREFIX}}` | Task ID prefix | `ACME` in `ACME-0167` |
| `{{PROFILE}}` | Selected profile | `software`, `creative` |
| `{{VERIFICATION_COMMANDS}}` | Stack verification | `pnpm typecheck && pnpm test` |
| `{{OWNER_SIGNATURE}}` | Journal signature convention | Initials or handle |

Every other difference between `baseline/acme-2026-08-19/` and
`templates/structured/` must appear as a ledger row. That constraint is the
mechanical guarantee behind principle 1.

## Step 4 — Build the validator

One file, standard library only, no install:

```bash
python3 conformance/validate.py . --level L3
```

### Checks that need only the working tree

- the entry point exists and every document it names resolves;
- exactly one active task exists, and it is either clean or filled;
- the active task contains every required charter section;
- archived tasks follow the identifier and naming convention;
- the newest journal entry has a date and a signature;
- internal links resolve and Markdown fences are balanced;
- every sandbox document has date, owner, status and an authority boundary;
- no document outside the sandbox links into the sandbox without an explicit
  non-authority marker;
- each collection index lists every member of its directory exactly once,
  and every member declares a state in its own content.

### Checks that use git history

- charter fields have not changed since the commit that set the task to ready
  (C-06);
- existing journal entries were not modified, only appended (C-09);
- when the active task was reset, a matching archive file appeared in the same
  or an earlier commit (C-11);
- no path cited by an append-only or archived document changed in this
  revision range (C-16). Renaming such a record is a conformance failure
  even when every citation is repaired in the same commit, because the
  repair itself edits records that must not be edited.

### Checks that are deliberately human

- the technician test (C-15);
- whether the status document actually matches reality (C-10);
- whether a skipped verification was recorded honestly (C-12).

The validator prints one line per requirement, exits `0` on pass at the
requested level and `1` on failure, and supports `--json` for CI. It must
never rewrite files. A tool that edits the documents would recreate the exact
problem the protocol solves: authority without an author.

## Step 5 — Self-host the repository

The published repository is simultaneously the specification and a specimen,
which creates one real hazard: two docs-first instances in one tree. Resolve
it with an explicit two-level rule.

| Path | Level | Meaning |
| --- | --- | --- |
| `/AGENTS.md`, `/docs/**` | Live instance | The project's own working state; must pass conformance |
| `/templates/**` | Shipped artifact | Contains placeholders; validated in template mode only |
| `/baseline/**` | Frozen provenance | Never edited, never validated |
| `/examples/**` | Fixtures | Deliberately conformant and deliberately broken repositories for testing the validator |

CI runs the validator three times: on the repository itself, on each template
in template mode, and on the example fixtures with expected results.

The new repository's first three tasks write themselves:

1. Import the frozen baseline and publish the extraction ledger.
2. Produce `SPEC.md` C-01 to C-15 with the ledger reference for each
   requirement.
3. Produce the two templates and the validator, and make the repository pass
   its own L3.

By the time task 3 closes, the repository contains one archived task set, a
journal with three signed handoffs, a filled status document and a working
example — which is exactly the artifact a visitor needs to see.

## Step 6 — Profiles

Ship two profiles in the preview, and only two.

| Profile | Contents | Source of truth |
| --- | --- | --- |
| Software | Charter freeze, ADRs, parent/child tasks, architecture guardrail examples, stack verification tables | ACME plus the game, native and Unreal repositories |
| Creative production | Brief, audience, brand rules, channel constraints, review and approval state, publication record | The package the two external colleagues already use |

Operations, research and the individual stack profiles are listed as planned
and left empty. An empty, honest profile list is better than four speculative
profiles that no one has run.

The stack verification table stays as evidence of neutrality:

| Stack | Verification profile |
| --- | --- |
| TypeScript | typecheck, lint, unit and integration tests, build |
| Python | pytest, type checking, lint, migrations |
| React Native | typecheck, export, device QA on both platforms |
| Unreal and C++ | build, asset import, editor reopen, in-editor play, deterministic frame-rate checks |
| Infrastructure | config validation, dry run, health checks, restore proof |
| Creative | brief traceability, brand review, format and export checks, approval state |

## Step 7 — Evidence and case studies

The evidence is the project's strongest differentiator and its largest
disclosure risk. Handle it as a measured artifact, not as marketing.

1. Write `evidence/method.md` first: what is counted, from which repositories,
   at which revision, with which script, and what the count does *not* mean.
2. Ship the counting script. A reader must be able to reproduce the number on
   their own repositories.
3. Publish aggregates and anonymized narratives. No raw journals, no client
   names, no personal data, no product internals.
4. Request written consent for every quoted excerpt, including from the two
   external colleagues.
5. Keep the claim ladder visible in the report itself: observed, supported
   inference, not yet proven.

| Case | Domain | Why it is in the set |
| --- | --- | --- |
| Fighting game | Fast, creative, visually iterative development | Shows the protocol under rapid iteration |
| Native mobile product | Production, device QA, legal and release constraints | Shows it under real release pressure |
| ACME | Contract, architecture and evidence-heavy AI infrastructure | The hardened reference implementation |
| Unreal Engine port | Editor state, binary assets, C++ toolchain | Shows that "the code compiles" is only the first truth level |
| External creative pilot | Non-technical marketing production by two independent users | Shows transferability without the author driving the work |

The fifth case is the most valuable and the most sensitive. It is the only one
demonstrating use by people who did not invent the method, and it is the one
requiring explicit consent and the heaviest anonymization.

## Step 8 — Public repository hygiene

`README.md` order, chosen for a first-time visitor:

1. The technician story, in full. It explains the entire idea in 150 words.
2. What this is: a protocol, a template and a validator.
3. A sixty-second quickstart: copy a template, fill five placeholders, run the
   validator.
4. What it is not: not a framework, not an AI tool, not a documentation
   standard, not a methodology certification.
5. Conformance levels and the current status of this repository itself.
6. Evidence summary with the claim ladder and a link to the method.
7. Links to the specification, profiles and case studies.

Also required before publishing:

- `LICENSE` and a `NOTICE` clarifying template output;
- `CONTRIBUTING.md` with the proposal path for specification changes;
- `SECURITY.md` with a private disclosure channel;
- `CODE_OF_CONDUCT.md`;
- `MIGRATING.md` for existing docs-first repositories;
- issue templates for conformance defects and specification proposals;
- a secret and personal-data scan across the whole history, not just the tip.

`MIGRATING.md` matters more than it looks. There are already four to five
internal repositories and one external group running earlier variants. Their
upgrade path from "we have a JOURNAL and a CURRENT_TASK" to L2 conformance is
the first real adoption story the project can tell, and it can be written from
observation rather than speculation.

## Milestones

| Milestone | Exit criterion |
| --- | --- |
| M0 Baseline | Tagged ACME revision, frozen copy in-tree, ledger skeleton |
| M1 Specification | C-01 to C-15 written, every requirement traced to a ledger row |
| M2 Templates | Core and structured templates complete; diffs against baseline are all explained by ledger rows |
| M3 Validator | L1 to L3 checks implemented; example fixtures pass and fail as expected; the repository passes its own L3 |
| M4 Profiles and migration | Software and creative profiles; `MIGRATING.md` validated by upgrading one real existing repository |
| M5 Evidence | Counting method, script and anonymized report; consent obtained for every excerpt |
| M6 Preview | Legal, security and naming decisions closed; `v0.1` published as a technical preview |

M0 to M3 are the extraction proper and are achievable in a small number of
focused work waves, because they are transcription and mechanical checking
rather than invention. M4 to M6 depend on external factors: consent, legal
review and a real migration.

## What Not to Build in v0

- a website, documentation portal or logo program;
- a CI action, editor extension or hosted service;
- a JSON schema or machine-readable document format;
- adapters beyond a thin, honest mapping file per agent tool;
- a certification, badge or partner program;
- any claim that the protocol makes AI agents more capable, rather than the
  narrower and defensible claim that it makes work resumable;
- simplification of the core rules before conformance evidence shows the
  simplification costs nothing.

## Acceptance Rituals

The project should define named rituals, because they are what stops the
protocol from decaying into file templates.

| Ritual | Question | When |
| --- | --- | --- |
| Technician test | Can a competent stranger route from the entry point to the active truth and next action without asking anyone? | Before each release |
| Cold-start test | Can a fresh agent session, given only the repository, resume the work correctly? | Every meaningful handoff |
| Empty-repo test | Does a brand-new project using the template reach a first useful task without editing the protocol? | After every template change |
| Colleague test | Can a non-technical user adopt the creative profile without support? | Before the creative profile is called stable |

## Risks Specific to the Extraction

| Risk | Control |
| --- | --- |
| Rules are copied without the enforcement culture, producing cargo cult | Conformance levels plus named rituals; the repository demonstrates enforcement on itself |
| Generalization silently weakens hardened rules | Verbatim baseline, line-level ledger and an explained-diff requirement |
| The core absorbs ACME architecture opinions | Three-way classification with the "when in doubt, PROFILE" tie-break |
| The project is read as one more agent-instructions repository | Lead with the technician story and the multi-actor, multi-domain evidence, not with agent tooling |
| Evidence disclosure harms a client, colleague or product | Method-first publishing, aggregates, anonymization, written consent, full-history secret scan |
| ACME work is disturbed by the extraction | One-way dependency; ACME changes nothing until the preview exists and then only adds a conformance statement |
| The name has to change after adoption | Availability and trademark check before the first public commit |

## Relationship to ACME After Extraction

ACME remains the reference implementation and gains one line in `AGENTS.md`
stating which protocol version and profile it implements, plus its conformance
level. Nothing else changes: no submodule, no dependency, no shared tooling
requirement, no obligation to track the public specification. If the public
project later diverges from what ACME needs, ACME keeps its own rules and the
divergence becomes evidence for the specification, not a constraint on the
product.

## Open Decisions

1. Name, after trademark and registry checks.
2. License confirmation for a specification-plus-templates repository, with
   legal review of the template-output clarification.
3. Whether the repository is published under a personal account or an
   organization, and who else has commit rights.
4. Whether filenames are normative or only recommended, which determines
   whether renaming templates breaks conformance.
5. Which specific archived tasks and journal entries may be published as
   fixtures after anonymization.
6. Whether the two external colleagues will participate in the creative
   profile and case study, and on what terms.
7. Whether the evidence report is part of the `v0.1` preview or follows it.
8. Which existing repository is used as the `MIGRATING.md` proof.

## Repository References

- [Docs-first packaging concept](docs-first-open-source-packaging.md)
- [ACME open-source strategy](acme-open-source-strategy.md)
- [Concepts sandbox index](README.md)
- [`AGENTS.md`](../../AGENTS.md)
- [`TASK_WORKFLOW.md`](../TASK_WORKFLOW.md)
- [`template_CURRENT_TASK.md`](../template_CURRENT_TASK.md)
- [`ACME-0075`](../finished/ACME-0075_open-source-concepts.md)

## External References

- [Open Source Definition](https://opensource.org/osd)
- [OSI-approved licenses](https://opensource.org/licenses)
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
