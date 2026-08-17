# Evidence Workbench — Source Chronology and Claim Surfaces

Status: Accepted delivery direction
Date: 2026-08-16
Authority: [ADR-0046](../adr/0046-source-chronology-and-claim-projection.md)

This document is the implementation, migration and UX specification for the
decided direction. It does not authorize a live acceptance run, Stage B FUP
ingestion, or legal-sufficiency features. It does not replace ADR-0028’s
product definition; it says how that definition reaches the surface.

A child task may implement only what its frozen charter names. This plan
orders those children so each increment is complete, idempotent and
stoppable.

## 1. Product invariant

An investigation is an **append-only knowledge process**.

- A new source does not rewrite what an earlier source said.
- A new observation does not merge with an earlier one because the wording
  is similar.
- A later interview does not mutate the first. It adds occurrences that
  change the *projection* of what the case can currently stand behind.

That is the same discipline ExecutionEngine already has (identity, resume,
replay). The workbench must make it the user’s model.

Two graphs, one object:

| Graph | Question | Stored as |
| --- | --- | --- |
| Source chronology | Where did this come from, and when did it enter? | Artifact, block, segment, occurrence |
| Claim projection | What can be set against what? | Relations and views over occurrences |

Never invert them. Do not store “the red Volvo” as the primary object.
Do not cut the source by event time.

## 2. Target information architecture

### 2.1 Source graph

```text
Artifact
  └─ SourceBlock          document-native unit
       └─ SourceSegment   stable, citable, hashed
            └─ Observation 0..N
```

**Source** is any ingested artifact: interview, forensic report, seizure
list, SMS, email, technical memo. Interview is a *kind*, not the type
system.

**Block** follows structure, then size:

- Prefer complete Q+A, paragraph, list item/group, table row/group,
  headed subsection, one message, one seizure post.
- Combine adjacent units toward roughly 150–350 words.
- Soft maximum about 600 words.
- Never split inside a sentence, between a question and its answer,
  inside a table row, or between a heading and the text it governs.

**Segment** is the citable unit the model may name. Runtime still owns
quote and locator. The model still returns `sourceSegmentId` only.

**Coverage window** is a set of segments sent together (enough context
to read, still bounded). Optional **neighbour context** may be supplied
for reference resolution only. Prompt and semantics: never extract an
observation whose sole support is context.

Segment identity is immutable for that artifact version. Resume is
“segment 000004 pending”, not “re-cut the document”.

### 2.2 Occurrence

An observation remains a source-bound occurrence. It may be:

- a spoken or written statement,
- a measured value,
- a reservation, omission or expressed uncertainty,
- a procedural/source occurrence (the question that was asked).

It always answers: which artifact, which segment, which quote, when the
source was made or ingested, and in what epistemic form. It never
answers “therefore this is true” or “therefore this corroborates Y”.

Three clocks stay distinct on or beside the occurrence:

- source time (when said or recorded),
- asserted event time (when it claims something happened; may be
  `unknown` with raw text preserved),
- knowledge time (what was already in the case then).

### 2.3 Claim projection

Grouping, overlap, continuity and exposure are **later passes** over
frozen occurrences.

Pass 1 — observe: what is in this window?  
Pass 2 — continuity: repeats, adds_detail, qualifies, changes_certainty,
retracts, contradicts, omits_previous_detail.  
Pass 3 — information flow: prompted_by, exposed_to_before, asked_after.  
Projections — event timeline, source chronology, case-as-known-on-T.

Pass 1 must not receive prior interviews. Pass 2/3 may.

`corroborates` is not inferred from string overlap. Overlap plus
exposure may be shown together; independence is a human judgement.

### 2.4 Surface: three modes

Replace type-inventory navigation as the *default* with three jobs.
Keep existing routes until the switchover child lands.

**Case / source stream**  
Left: artifacts in `acquiredAt` / ingest order, grouped by kind if
useful (X’s interviews as a thread, not a merge).  
Right: the open source as a document. Blocks visible. Observations sit
in their block. Analyze progress is “window *i* of *n* / segment *k*
covered”.

**Claim**  
A theme (vehicle, place, actor label, time). Occurrences listed, not
folded. Each card shows source time and, when known, “after this
question” / “Y said this earlier”. Click citation → same source view.

**Stance**  
Review queue, integrity findings, assessment. Queue items name the
*source block* (“X #2, Q+A about the car — 3 awaiting”), not only
`L1207`. Every row opens the shared card.

Timeline is a sort switch inside Case or Claim:

- event time,
- source time,
- knowledge time.

Search stays global and case-scoped. It returns the same card.

### 2.5 Shared observation card

One view contract, every surface:

- one-line rendering of the occurrence (quote or derived short label),
- source title and source time,
- citation (opens source, marked),
- review standing,
- asserted event time or `unknown` plus raw expression,
- count of relations (opens Claim focused on this card).

No surface may invent a second visual language for the same object.

### 2.6 UX rules that may not be broken

1. Always a path back to the exact segment.
2. Always visible when the case knew it (`sourceTime` / ingest).
3. Never silently merge occurrences. Group, do not replace.
4. Rejected occurrences stay in the knowledge state.
5. Analyze never implies “document complete”. Show coverage.
6. No AI case summary as the first thing on the screen.
7. Do not add navigation buttons. Three modes plus search.

## 3. What already exists

Do not rebuild these; project them.

| Asset | Role after this plan |
| --- | --- |
| Canonical artifact + line locator + runtime segment id | Origin identity; line locators remain until an additive scheme |
| Observe `@1.9.0` / output `/5` | Pass 1 cardinality and window ledger |
| Live windowed observation job | Campaign over windows; request-key resume |
| Review overlay | Standing on the card |
| Relations + open questions | Seed of Pass 2; extend codes later |
| Compare accounts | Becomes a thread inside Claim |
| Timeline view | Becomes a sort, not a home |
| Integrity report + assessment | Stance |
| Documents import | Becomes the source stream |

Current default UI (twelve buttons, queue + detail, full source as a
line list) was the **legacy shell**. ACME-0147 switches the default
entry to Source stream and makes Claim and Stance primary jobs.

## 4. Delivery principles

### Idempotent increments

- Each child ships working product. No “half a graph”.
- Additive schemas and contracts. Historical versions stay registered
  and byte-exact.
- Existing occurrences, reviews, relations and assessments are not
  rewritten.
- New views are pure projections of authorized snapshots.
- Default navigation changes only in a named child, after the new
  surface is behind a `?view=` or equivalent.
- Stopping after any completed child leaves a coherent workbench.

### Efficiency

- Unblock live Pass 1 first (empty roster). Otherwise every analyze
  dies and later UX cannot be exercised on real sources.
- Share the observation card before restyling individual pages.
- Structural segmentation is the first *large* domain change; do not
  mix it with continuity ontology in the same charter.
- Claim mode depends on the card and a usable source view; it does not
  depend on Pass 3.
- Continuity / exposure last. They need frozen occurrences and a place
  to show them.

### What each child must not do

A child must not expand into the next child’s deliverable because the
current one “almost needs it”. Use the decision tree in
`docs/TASK_WORKFLOW.md`.

## 5. Child sequence

Activate one child at a time from `docs/template_CURRENT_TASK.md`.
IDs below are the reserved order. Do not skip forward because a later
step is more interesting.

### ACME-0139 — Pass 1 empty roster

**Goal.** Observe with an empty actor roster can complete. The model
must not invent candidate keys.

**In.** Prompt and semantics: empty roster ⇒ actor / sourceActor
reference `null`. Unresolved remains legal only when the roster yields
candidates. Fixture and live path unchanged otherwise.

**Out.** Structural segments, UI, new relation types.

**Done.** A Stage A window with people named in the text can commit
without `EVIDENCE_ACTOR_CANDIDATES_MISMATCH`. Historical `@1.9.0`
request hash is either unchanged or `@1.10.0` is additive and `@1.9.0`
replays.

**Why first.** Live extraction is currently fail-closed on this. Every
later surface needs real occurrences.

### ACME-0140 — Shared observation card

**Goal.** One versioned view contract rendered by source, ledger,
integrity, relations endpoints and assessment citations.

**In.** Pure view builder in `@acme/evidence-views`. Wire existing
HTML to it. No new persistence.

**Out.** New navigation, structural blocks, claim grouping.

**Done.** Changing the card once changes every listed surface. Offline
view tests pin the contract.

**Why now.** Stops N visual languages before more pages are added.

### ACME-0141 — Source stream as home

**Goal.** Documents is the case’s source chronology. Opening a source
is the document + observations at their lines. Analyze progress reports
window *i* of *n*. Default `?view=` may remain overview until 0141
explicitly switches it, or 0141 adds `?view=stream` and leaves default
for a later polish child.

**In.** Sort imports by acquired/ingest time. Thread label for repeated
logical artifacts (same person / same kind) without merging. Coverage
counts on the source card (extracted / no_observation / awaiting /
accepted) from existing standing + `@1.9.0` ledger if present.

**Out.** Block-level layout (that is 0142). Claim mode. New extractors.

**Done.** A reviewer can walk ACME-0136 as “B then A entered; here is
B; here are its observations beside the lines” without opening Ledger.

### ACME-0142 — Deterministic source blocks and neighbour context

**Goal.** Model-free `SourceBlock` / `SourceSegment` derivation from
canonical text (and layout hints when present). Coverage windows are
sets of those segments plus optional context-only neighbours.

**In.** New module-owned planner. Persist block/segment graph as an
immutable derivation of one artifact version (hash of rule version +
text). Observe input continues to name `sourceSegmentId`. Prompt:
context is not extractable. Line locators still derived for each
segment so existing citation views work.

**Out.** Changing quote binding to a new locator scheme. Pass 2/3.
UI rewrite beyond showing block headings in the source view.

**Done.** A synthetic interview fixture yields Q+A blocks, not one
line per segment, and historical line-segment contracts still replay.
A neighbour-context window refuses an observation that only cites a
context id.

**Migration.** Existing line-segment observations remain. New analyzes
on a source may use the new planner under a new observe contract
version. Do not re-cut committed windows.

ACME-0145 later implemented the missing split half as
`evidence-source-structure-rules/2` without a new observe contract:
oversized paragraphs split at sentence bounds, and structural windows
default to 3 extractable segments. ACME-0146 then versions rules to
`/3`: the citable unit inside a paragraph or Q+A answer is a sentence,
and windows pack toward 800 words (cap 64). ACME-0148 adds
`evidence-source-part-rules/1`: named or word-budget parts appear as
stream cards and are opened or analyzed one at a time.

### ACME-0143 — Claim surface

**Goal.** A projection that groups current occurrences by a stable
aspect key (actor label, place string, vehicle string, or an existing
relation scope) and lists them as cards. Overlap is visible.
`corroborates` is not auto-assigned. Compare-accounts content is
reachable as a person thread here.

**In.** Read-only view + route. Reuse the 0140 card. Optional sort:
source time vs asserted event time.

**Out.** Information-exposure types. Knowledge-time replay slider.
Assessment rewrite.

**Done.** Three “red Volvo” occurrences from two sources appear as
three cards in one group, each opening its source. No stored merge.

### ACME-0144 — Continuity and information exposure

**Goal.** Additive relation families for statement evolution and
information flow. A Pass 2/3 job over frozen occurrences only. UI
shows those relations on the claim group and on the card.

**In.** New relation codes; new optional live/offline job; reviewable
like today’s relations. Interview question may be modelled as a
procedural occurrence if the observe contract already emits it;
otherwise a minimal additive occurrence kind.

**Out.** Psychological or credibility scoring. Automatic
`corroborates` from exposure. Legal conclusions.

**Done.** The X#1 “unknown colour” → X#2 “maybe red Volvo” after a
question that named the colour can be represented as
`changes_certainty` + `prompted_by` without deleting X#1.

## 6. Migration map

```text
now
  line segments + 1.9.0 windows + type-inventory UI
    │
    ├─ 0139  extract works with empty roster
    ├─ 0140  one card everywhere          (parallel with 0139 if two hands)
    ├─ 0141  source stream home
    ├─ 0142  blocks + context windows     (first large domain change)
    ├─ 0143  claim groups
    └─ 0144  continuity / exposure
```

Rollback of a child is “leave the new view unused; keep prior default
route”. Do not delete historical contracts.

Data: no backfill required through 0143. 0142 new analyzes only.
0144 adds relations; it does not rewrite observations.

## 7. UX specification (normative for later children)

### Case / source stream

- List: ingest order, title, kind, coverage badge, awaiting count.
- Detail: document title, source time, version, block outline,
  scrollable text, observations anchored to their segment.
- Analyze: confirm live as today; progress is coverage, not a spinner
  that becomes “done” after one window.
- Empty: “No sources yet” + import. Never a blank ledger.

### Claim

- Entry: from a card’s “overlap” control, from search, or from a
  theme list derived from existing labels/relations.
- Body: group header (the theme string, not a verdict) + cards.
- Each card: 2.5. Exposure, if present, is a second line, not a
  colour that means “tainted”.
- Empty: “No overlapping occurrences” — not “no facts”.

### Stance

- Queue grouped by source block when possible.
- Integrity rows already cite observations; they must use the card
  and open the source.
- Assessment claims already cite locators; they must use the same
  open-source gesture.

### Copy

Prefer:

- “said in”, “recorded in”, “measured in”
- “overlaps”, “added after”, “asked after”
- “awaiting review”, “accepted”, “rejected”

Avoid:

- “fact”, “proven”, “corroborated” as automatic labels
- “the witness’s account” as a single object
- “analysis complete” for a non-exhaustive window

## 8. Guardrails carried forward

- `packages/core` stays domain-neutral.
- Model output remains untrusted until schema + semantic validation.
- Human review remains required for standing.
- No credibility, guilt, admissibility or legal-sufficiency authority.
- Synthetic-only except the authorized Stage A class.
- Live provider calls stay opt-in, budgeted and audited.

## 9. Activation

This document is direction, not an active task. To start work:

1. Copy `docs/template_CURRENT_TASK.md` to `docs/CURRENT_TASK.md`.
2. Charter **ACME-0139** from section 5. Freeze when Ready.
3. Do not pull 0140–0144 into that charter.

## References

- [ADR-0046](../adr/0046-source-chronology-and-claim-projection.md)
- [ADR-0028](../adr/0028-first-poc-evidence-integrity-workbench.md)
- [Product definition](evidence-integrity-workbench-product-definition.md)
- [Technical specification](evidence-integrity-workbench-technical-specification.md)
- ACME-0137 full-source windows
- ACME-0138 atomic observations and `segmentCoverage`
