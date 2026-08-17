# Evidence Workbench V2 — Domain Specification

Status: Normative. ADR-0047 is accepted and the §10 decisions are taken.
Last updated: 2026-08-16
Authority: [ADR-0047](../adr/0047-evidence-application-model-reset.md)

This document fixes the application domain model, the supported flow, the V1
boundary and the binding regression requirements for the replacement Evidence
application. It fixes meanings and invariants, not TypeScript schemas.

It changes no data authority. Stage A anonymized judicial text remains the only
authorized non-synthetic class (ADR-0040). Stage B stays closed.

## 1. What this replaces and what it inherits

Replaced: the three-mode surface of
[ADR-0046](../adr/0046-source-chronology-and-claim-projection.md), the
application's object model and its composition.

Inherited unchanged from
[the product definition](evidence-integrity-workbench-product-definition.md):
the product thesis, the L0–L5 authority ladder, the statement/truth separation,
corrections versus changed accounts, typed time, scoped relations, and the
immutable V1 boundaries. Nothing in this specification may weaken those.

Inherited unchanged from ADR-0046: two graphs over one immutable object,
deterministic document-native segmentation, three distinct clocks, and
extraction as Pass 1 only.

## 2. Domain model

Ten objects. Everything else in the application is a view, a job or an
implementation detail.

| Object | Authority | Meaning and invariants |
| --- | --- | --- |
| `Case` | boundary | Access boundary and container. Opaque public identity, one internal workspace, explicit membership. Not an assertion about a legal proceeding. |
| `Artifact` | L0 | An immutable registered artifact version: exact received bytes, canonical text, content hashes, locator scheme and provenance to the outside container. Never mutated, never re-cut. |
| `SourcePart` | L0 derivation | A deterministic, system-owned, contiguous line range of one artifact version, produced by a versioned structure rule. Carries a display title with its own provenance. Not a semantic claim about what the part is. |
| `Chain` | domain organization | A case-scoped grouping asserting that several source parts concern one longitudinal subject — one person's interviews, one exhibit's protocol series. Carries no evidentiary authority and no truth. |
| `ChainInstance` | domain organization | One document's occurrence within a chain: an ordinal, a typed instance source time, and the one or more consecutive source parts the document occupies. A part may hold `0..N` memberships; exactly one is `primary` at a case revision. Append-only. |
| `ObservationOccurrence` | L1 | An immutable source-bound record that a source states or depicts something at an exact locator, with a verbatim quote. Statement occurrence or exhibit assertion. Optional actor reference; optional typed temporal bound. |
| `Claim` | L2 projection | A named grouping target over occurrences that overlap a theme or proposition. Never merges, never absorbs, never owns. Grouping is a recorded decision, not a mutation. |
| `Relation` | L3 | A typed, reviewable statement about two or more occurrences or claims, with endpoints, comparable scope, rationale and provenance. Never deletes an endpoint. |
| `Review` / `Standing` | product | Append-only accept, reject, revise or move decisions with principal, rationale and time. Effective standing is derived from history, never stored as a mutable field. |
| `ConsensusProjection` | L3 derivation | A derived read model at an explicit case revision reporting what reviewed evidence supports, contests, qualifies or leaves unresolved. Never stored as canonical assertion. |

### 2.1 SourcePart invariants

- Total coverage: every line of the artifact version belongs to exactly one
  part.
- Stable identity for the life of (artifact version, structure rule version).
- No model participates in slicing.
- Computable and validatable offline, before any provider spend.
- A part's **title is a label, not an identity and not a clock.** It carries its
  own provenance (which line it came from) and may never be used to date, name
  or order anything. See R-02.
- Every citable unit inside a part must bind uniquely inside its own locator
  range, proven deterministically at structure time. See R-03.

### 2.2 Chain and ChainInstance invariants

- A chain is proposed, then resolved by a human. Proposal is deterministic
  first; a model may be used only for the residue a deterministic rule cannot
  group, and only as a candidate.
- **Cardinality is `SourcePart 0..N ChainMembership`.** A source part may
  legitimately belong to several longitudinal chains — a technical report can
  sit in both an exhibit series and a person's chain — and the model must not
  foreclose that. Exactly one membership is marked `primary` at a case
  revision; the primary membership is what carries the instance ordinal and
  drives instance ordering.
- V1 workflow and surfaces exercise the primary membership only. Additional
  memberships are representable and storable but are not created, reviewed or
  displayed by V1. This is a workflow boundary, not a model invariant, and
  lifting it must not require a data migration.
- Membership is append-only. Moving a part to another chain, or changing which
  membership is primary, appends a new decision and supersedes the previous
  one. It never mutates the part, its occurrences, its relations or any earlier
  decision.
- **An instance may span several source parts.** A part is size-capped, so one
  long interview occupies consecutive parts. Membership stays per part; the
  instance is the group of memberships sharing an ordinal. A part carrying no
  document identity that directly follows one that does continues it. A part
  with neither an identity nor an open document is reported unassigned rather
  than placed, and an index or front-matter part is never placed at all.
- An `assign` decision replaces a *proposed* membership outright rather than
  demoting it, because a proposal is a candidate and V1 must never end up
  holding two memberships from ordinary use. A *decided* membership is only
  ever demoted or superseded, never discarded.
- `instanceSourceTime` is typed (`exact`, `range`, `approximate`, `unknown`)
  with explicit provenance (`document-metadata`, `reviewer`, `unknown`). It is
  derived from the document body's own metadata or left unknown. It is never
  derived from the part title. Date and time give `exact`; a date alone gives
  `range` over that calendar day; neither gives `unknown`. Values are recorded
  as the document states them, with no zone asserted and no conversion
  performed.
- Instance ordinal follows `instanceSourceTime`; instances with unknown time
  sort last and are visibly unordered rather than silently placed.

### 2.3 ObservationOccurrence invariants

- Immutable. Bound to one artifact version and one locator, with a verbatim
  quote that binds uniquely inside that locator range.
- Belongs to a source part by locator containment, and therefore to a chain
  instance **by reference only**. Re-chaining never touches an occurrence.
- Actor and temporal fields stay `null` when the source does not supply them.
  An empty roster means null actors (ADR-0046 §4).
- Carries the producing execution identity so every occurrence replays.

### 2.4 Consensus invariants

- Computed only from occurrences and relations with an accepted standing at the
  stated case revision.
- **The claim is the only consensus subject.** Chain-level and case-level
  consensus are aggregates of claim-level projections and nothing else. They are
  not separate objects, carry no vocabulary of their own, and may never state
  something no claim-level projection states.
- Vocabulary: `supported`, `contested`, `qualified`, `unresolved`,
  `insufficient-material`.
- Not a vote, not a weight, not a score, not a credibility judgement.
- Absence of supporting material yields `insufficient-material` and never
  refutation, per the product definition's immutable boundaries.
- Every consensus row resolves to its exact contributing occurrences and their
  exact sources.
- Deterministically recomputable. It is a projection, not a record.

## 3. Layer separation

```text
SOURCE STRUCTURE            system-owned, deterministic, replayable
  Artifact → SourcePart

DOMAIN ORGANIZATION         proposed, reviewed, correctable
  SourcePart → Chain → ChainInstance

EVIDENCE                    immutable, source-bound
  ChainInstance → ObservationOccurrence

PROJECTION                  derived, never owning
  Occurrences → Claim → Relation → ConsensusProjection
```

The boundary between the first two layers is the central lesson of the
acceptance runs: 246 parts and 101 chains are both correct answers to different
questions. A slicer that tries to answer the second question guesses, and a
domain layer that tries to answer the first one loses replayability.

## 4. Supported flow

```text
CREATE CASE
  → IMPORT SOURCES
  → STRUCTURE / SLICE          deterministic, preflighted
  → DISCOVER CHAINS            proposed, then reviewed
  → SELECT CHAIN
      → INSTANCE #1  extract → review
      → INSTANCE #2  extract → review → compare with previous
      → INSTANCE #3  extract → review → compare
      → CHAIN STATE / TIMELINE
  → NEXT CHAIN
  → CLAIM PROJECTION
  → CONSENSUS PROJECTION
```

Source answers "what came in". Claim answers "what hangs together". Consensus
answers "what can I stand behind now".

Extraction stays blind: an instance is extracted from its own source part only,
with no prior interview in context. Comparison is a separate operation over
frozen, already-accepted occurrences of earlier instances in the same chain.
This preserves ADR-0046 §4 while still delivering the longitudinal flow.

## 5. Jobs and spend points

| Job | Kind | Model | Spend |
| --- | --- | --- | --- |
| J1 Structure | deterministic | no | none |
| J2 Chain proposal | deterministic first, model for ambiguous residue | optional | optional |
| J3 Instance extraction | bounded live, per coverage window | yes | yes |
| J4 Instance comparison | bounded live, chain-scoped over frozen accepted occurrences | yes | yes |
| J5 Claim grouping | deterministic projection | no | none |
| J6 Consensus | pure derivation | no | none |

The base flow therefore has **two mandatory model-spend points**, J3 and J4.

Every live job follows the `AGENTS.md` live-call policy: the planner derives the
bounded call count from immutable input, the confirmation states it, and a
separate emergency ceiling exists only against runaway execution.

J1 must refuse before J3 can spend. A structure that cannot satisfy §2.1 is a
structure defect, and it is detected offline rather than discovered by a
consumed provider call.

## 6. Surfaces

Six surfaces plus two global ones. Deliberately plain: no dashboard, no charts,
no graph visualisation, no report generator in V1.

| Surface | Does |
| --- | --- |
| Case | create, select, overview |
| Source | import artifact, derive parts, inspect exact source |
| Chain | discover/propose, review membership, order instances |
| Instance | extract occurrences, review occurrences, compare with previous, show continuity/timeline |
| Claim | group occurrences, show relations, never merge |
| Consensus | review-backed support/contest/unresolved projection at a case revision |
| Global: Search | case-scoped, bounded, deterministic |
| Global: Case overview | counts and where to resume |

UI rules that may not be broken:

- Every row opens its exact source.
- No surface renders an unbounded list. See R-08.
- A projection gap is shown as an explicit named state, never as an empty list
  and never as four different answers on four surfaces. See R-07.
- Nothing in the interface asserts truth, credibility or legal conclusion.

## 7. V1 boundary

### In

- The ten domain objects of §2.
- The flow of §4 and the six jobs of §5.
- The eight surfaces of §6.
- Real substrate only: PostgreSQL, object store, real adapters, authenticated
  case-first routes, real provider.
- Deterministic offline regression for every R-item in §9.

### Out — named so it cannot creep in

- Assessment documents (L4) and any generated report.
- Export formats, export policy and export audit release.
- The case integrity report.
- Redaction drafts and derivative representations.
- Dashboards, charts, graphs, scoring, weighting, ranking.
- Reviewer assignment, bulk review and multi-reviewer workflow.
- New source classes. PDF, DOCX, OCR and media stay refused.
- Cross-case entity resolution and roster management beyond null-actor Pass 1.
- Packaging, open-source extraction into `POC-Applications`, synthetic demo
  material.

Assessment returns after consensus has proven itself, under its own charter.

## 8. Acceptance

V1 acceptance is the three frozen proof journeys, unchanged by the reset
because they are product journeys rather than implementation:

- **P1 SOURCE → REVIEW.** A real immutable artifact is deterministically
  structured, opens as a bounded human-usable source part, runs bounded live
  observation, produces source-bound atomic occurrences with exact provenance,
  exposes successfully committed occurrences to the product, and allows normal
  human review through the product.
- **P2 CROSS-SOURCE REASONING.** Occurrences from two or more independently
  analysed real source parts stay separate immutable occurrences, are grouped
  and projected without silent merging, participate in reviewed relations,
  demonstrate at least one useful cross-source relationship, and preserve
  provenance to every participating source.
- **P3 TEMPORAL PROJECTION.** The same immutable occurrences participate in the
  temporal projection, remain the same occurrences rather than copies, preserve
  source and event-time uncertainty, and resolve every material timeline item to
  its exact source.

### Permanent proof rules

1. Every acceptance attempt uses a fresh case unless an existing case is
   deliberately inspected as failure evidence. The acceptance harness — not the
   product — provisions a clean database, bucket and namespace per proof run, so
   contamination between runs is structurally impossible. This is harness
   hygiene and must never become the product's substrate model: the product is
   required to carry many cases in one real substrate under ADR-0036 isolation,
   and an acceptance run may not depend on being alone in its database.
2. No manual database repair may be used to obtain a PASS.
3. No case-specific implementation or special fixture accommodation.
4. A failed later coverage window must not make already valid committed evidence
   semantically disappear.
5. Exact source provenance must survive every tested projection.
6. Model and provider failure must remain fail-closed.
7. Acceptance is about the product journey, not green unit tests.
8. Missing usage or cost information remains unknown, never zero.
9. Once P1, P2 and P3 satisfy these conditions, POC1 is proven. Stop adding
   acceptance requirements.

### Defect classification

Every issue discovered during an acceptance run is classified into exactly one
bucket:

- **POC BLOCKER** — prevents P1, P2 or P3 from completing correctly, or could
  make one of them produce a materially false result. Only these interrupt the
  run.
- **PRODUCT DEBT** — a real deficiency that does not prevent or falsify P1–P3.
  Record it under `docs/backlog/`. Do not fix it because it was discovered.
- **POST-POC PRODUCT WORK** — polish, UX, performance, further source classes,
  further projections, packaging. Record and continue.

> A discovered defect may expand POC work only if it prevents or falsifies one
> of the frozen proof journeys. Otherwise record it and return to the
> acceptance run.

### Child-task rule

No broad "finish the workbench" task. A POC blocker gets one minimal frozen
child charter per [`../TASK_WORKFLOW.md`](../TASK_WORKFLOW.md) containing: the
proof journey it blocks, the exact reproduced defect, the smallest
implementation boundary that removes it, explicit out-of-scope items preventing
adjacent cleanup, deterministic offline regression gates, preservation of
historical contracts and replay, a Done condition tied to the previously failing
case, and a final instruction to return to the acceptance run.

The default action after a child completes is to restore the task template and
resume acceptance — not to start the next interesting related task. Let the
acceptance run reveal the next blocker.

## 9. Binding regression knowledge

These are not legacy bugs to forget. They are the conditions under which this
model was designed, and V1 may not be declared complete while any of them
regresses. Each is verified deterministically and offline where possible.

| Id | What happened | What the new model must guarantee |
| --- | --- | --- |
| R-01 | 280 pages of table of contents produced 23 phantom "Förhör" parts, and a run extracted 41 formally valid observations quoting index lines | Structure classifies a part's content character; index and front matter are visibly distinguished from substance before analysis, and chain proposal never creates a chain from an index entry |
| R-02 | Part titles named a different interview than the part body on five consecutive verified parts | Title is a label with its own provenance; instance time comes from body metadata or stays unknown; nothing is dated, named or ordered from a title |
| R-03 | 259 of 92,141 segments were unbindable (`"Kamel"`, `"Hussein"`), making 126 of 246 parts unanalysable | Every citable unit binds uniquely inside its own locator range, proven at structure time, before spend |
| R-04 | A 64-segment window failed `EVIDENCE_COVERAGE_WINDOW_INCOMPLETE` after a consumed repair call | Window size is bounded so the required enumeration is achievable; a window that fails validation fails only that window |
| R-05 | Jobs committed one and six windows to the engine and projected nothing | Each committed window projects on commit; a later failure cannot unmake earlier valid evidence |
| R-06 | Engine and product revisions count different things and are compared as one (engine 3 / product 2, engine 13 / product 3) | The two revisions are distinct named concepts; no view requires equality between them |
| R-07 | One case reported 40 pending observations, 0 observations, HTTP 409 and an empty timeline simultaneously | All surfaces answer consistently; a projection gap is one explicit named state |
| R-08 | The source stream rendered 279 cards over 94,073 px; opening one artifact loaded 74,469 lines | No unbounded list; bounded pagination; a source view loads one part |
| R-09 | The confirmation stated "Maximum model calls: 1" while jobs spent 4 and 8 | Planner-derived bounded execution reported in the confirmation, with a separate emergency ceiling only |
| R-10 | Structure was re-derived per segment lookup and the whole snapshot cloned per request, blocking the event loop up to 64 s | Structure derived once per artifact version and reused; no whole-snapshot clone per request; stated complexity budget |

Workflow rules with the same standing:

| Id | Rule |
| --- | --- |
| W-01 | Synthetic material may support deterministic regression. It may never define success, progress or a passed journey. |
| W-02 | Define what an operation needs, rather than capping what it may use. |
| W-03 | A POC claim requires real persistence, real adapters, real CLI/tooling and real UI navigation through the flow. |

## 10. Decisions required before activation

1. **Package and app naming.** `packages/module-evidence-v2`,
   `packages/evidence-v2-contracts`, `packages/evidence-v2-views`,
   `apps/evidence-workbench-v2-api`, `apps/evidence-workbench-v2-web`. Version
   suffixes are unlovely but unambiguous, and they make the frozen boundary
   greppable. Revisited when the frozen application is removed, not before.
2. **Chain membership cardinality.** The model is `SourcePart 0..N
   ChainMembership` with exactly one `primary` membership at a case revision.
   V1 workflow exercises the primary membership only. The one-to-one shortcut
   was rejected: a technical report can legitimately belong to several
   longitudinal chains later, and a workflow limitation must not be frozen into
   the model as an invariant that a migration would have to undo. See §2.2.
3. **Chain proposal method.** Deterministic first — normalized subject name plus
   case-file reference groups the real material without a model — with a model
   only for the residue, and always as a candidate.
4. **Consensus scope.** Computed per claim at an explicit case revision. Chain
   and case consensus are aggregates of claim-level projections and are not
   separate objects. See §2.4.
5. **Substrate.** The acceptance harness provisions a clean database, bucket and
   namespace per proof run. The product's own substrate model is unchanged: many
   cases share one real substrate under ADR-0036 isolation. See §8, proof rule 1.

## 10a. Package boundary

[ADR-0047 §4](../adr/0047-evidence-application-model-reset.md) names the frozen
set exactly. In short: the model-bearing packages and the three workbench apps
are frozen; `evidence-artifacts`, `evidence-auth`, `live-safety`, the provider
and database adapters and `core` are shared infrastructure that the new
application links against directly.

The new packages must not depend on any frozen package. That is a boundary rule,
enforced by `pnpm boundaries`, not a convention.

## 11. Activation gate

ADR-0047 is accepted and §10 is decided, so this specification is normative.

Implementation is not thereby activated. It follows the normal workflow: one
explicitly approved task at a time, a frozen charter, and no broad "build V2"
container task.

The frozen application is not touched by any of that work. The only permitted
work there is maintenance that preserves its diagnostic value, chartered
separately and never bundled with V2 work.

## References

- [ADR-0047](../adr/0047-evidence-application-model-reset.md)
- [ADR-0028](../adr/0028-first-poc-evidence-integrity-workbench.md)
- [ADR-0040](../adr/0040-poc-1-live-product-applicability.md)
- [ADR-0044](../adr/0044-poc1-live-product-acceptance-phase.md)
- [ADR-0046](../adr/0046-source-chronology-and-claim-projection.md)
- [Product definition](evidence-integrity-workbench-product-definition.md)
- [Source and claim surfaces (replaced surface)](evidence-workbench-source-and-claim-surfaces.md)
- [ACME-0133 frozen acceptance report](../acceptance/ACME-0133-frozen-acceptance-report.md)
- [ACME-0136 frozen acceptance report](../acceptance/ACME-0136-frozen-acceptance-report.md)
