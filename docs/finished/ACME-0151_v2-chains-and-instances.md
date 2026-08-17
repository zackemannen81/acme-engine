# Current Task

Task ID: ACME-0151
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- [ADR-0047](../adr/0047-evidence-application-model-reset.md) §2 (source structure
  versus domain organization) and §4 (frozen set)
- [V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)
  §2.2, §3, §4, §9 (R-01, R-02) and §10 decisions 2 and 3
- [ACME-0150](ACME-0150_v2-source-structure.md) — the layer this one
  stands on

## Task Summary

The second layer of the accepted application model, and the one the reset
exists for.

ACME-0150 established that a real 1,915-page binder derives into 650 source
parts. A reviewer does not work in parts. They work in a subject's account over
time: Hussein Ammouri was interviewed five times between 2004 and 2007, and the
question the product answers is what changed between those five occasions.
Recognising that those parts belong to one longitudinal chain is a semantic
conclusion, not a slicing outcome, so it is proposed and reviewed rather than
derived and trusted.

This layer is also where R-02 is finally paid off. ACME-0150 demoted the part
title to a label because the header line opening a part routinely names a
different document than the part body. The identity and the clock must
therefore come from the body's own metadata, which is what this task extracts.
The material proves the point: one part is titled `Förhör med Ammouri,
HUSSEIN; 2007-04-25` while its body records an interview with a different
person entirely.

Like ACME-0150 this task spends nothing: no provider call, no persistence, no
app.

## Task Charter

Frozen at Ready.

### Goal

Source parts of one artifact organize into reviewable longitudinal chains whose
subject and instance time come from document body metadata, never from a part
title, and whose membership can be corrected by appending a decision rather
than by mutating anything.

### Primary Deliverable

`evidence-v2-chain/1` inside `packages/module-evidence-v2`: a deterministic
chain proposal over an `EvidenceV2SourceStructure`, an append-only membership
decision model, and a pure fold that derives the effective chain state with its
instances ordered.

### In Scope

- **Document identity from the body.** For each part, extract the labelled
  fields the Stage A class states in its header block — subject (`Hörd
  person`), interview date and start time (`Förhörsdatum`, `Förhör påbörjat`)
  and case file reference (`Diarienr`) — each with provenance to the exact line
  it came from. A field that is absent stays absent. Nothing is read from the
  part title.
- **A pinned field lexicon.** The label set is class-specific, not
  case-specific, and is pinned by `evidence-v2-chain-rules/1` exactly as the
  header lexicon is pinned by the structure rule version.
- **Deterministic proposal.** Parts whose body-derived subject matches, under a
  documented normalization, within the same case file reference are proposed as
  one chain. A part with no derivable subject is proposed into no chain and is
  reported as unassigned. Nothing is guessed.
- **Continuation parts.** A part that carries no document identity and directly
  follows one that does is a continuation of that document. Its membership
  shares the opening part's instance ordinal and instance source time.
- **`instanceSourceTime`,** typed `exact` / `range` / `approximate` /
  `unknown`, with provenance `document-metadata`, `reviewer` or `unknown`.
  Date and time yield `exact`; a date alone yields `range` over that calendar
  day; neither yields `unknown`. Values are recorded exactly as the document
  states them with no zone asserted and no conversion performed. Missing
  precision stays missing.
- **Append-only membership decisions** — `assign`, `unassign`, `set-primary` —
  each naming the decision it supersedes, and each carrying a caller-supplied
  principal and time. The package invents neither.
- **A pure fold** from proposals plus decisions to the effective state: chains
  with ordered instances, unassigned parts, and named diagnostics for a
  conflict such as two primary memberships for one part.
- **Ordering.** Instances sort by `instanceSourceTime`; unknown time sorts last
  and is marked unordered rather than silently placed. Ties break on part id so
  the order is total and deterministic.
- **Cardinality as specified:** `SourcePart 0..N ChainMembership` with exactly
  one `primary`. Additional memberships are representable and foldable. They
  are not created by the proposal.
- Committed deterministic fixtures for each behaviour, including the
  title-versus-body mismatch and a reprint-split continuation.
- A recorded local run over the real `source-A` structure, reported in this
  task's Verification section. The text is not committed.

### Out of Scope

- Persistence, repositories, API routes, apps, UI, search, overview. This layer
  is a pure package addition, exactly as ACME-0150 was.
- Model-assisted chain proposal for the residue the deterministic rule cannot
  group. Specification §10 decision 3 allows it later, always as a candidate.
  This task is deterministic and offline only.
- `ObservationOccurrence`, extraction, comparison, `Claim`, `Relation`,
  `ConsensusProjection`.
- Any workflow that exercises a second, non-primary membership. It must be
  representable and foldable, and it is not created or displayed here.
- Cross-case or cross-artifact identity resolution. A chain belongs to one case
  and, in this task, one artifact.
- Changing `evidence-v2-source-structure/1` or its rule version. If the chain
  layer appears to need a structure change, stop and charter it separately.
- Any change to the frozen set in ADR-0047 §4, or to shared infrastructure.
- Actor rosters, personal-identity matching beyond the documented string
  normalization, and any inference about who a person is.

### Definition of Done

- Over the real `source-A` structure: the five Hussein Ammouri interviews form
  exactly one chain, ordered by their body dates `2004-10-22`, `2004-11-09`,
  `2004-11-29`, `2005-04-11`, `2005-09-16`, and the part whose **title** reads
  `Förhör med Ammouri, HUSSEIN; 2007-04-25` is **not** in that chain, because
  its body records an interview with a different subject.
- No chain is proposed from a part classified `index-or-front-matter`.
- Every membership and every instance time resolves to the exact line of the
  body field it came from.
- Moving a part to another chain appends a decision and leaves the earlier
  decision, the source part and the structure byte-identical. A test asserts
  the immutability, not merely the new result.
- Two primary memberships for one part fold to a named diagnostic, not to a
  silently chosen winner.
- A part with no derivable subject is reported unassigned rather than placed.
- Re-running the proposal over the same structure yields byte-identical chains,
  memberships and ordering.
- `pnpm boundaries` still forbids any dependency on the frozen set.
- No file in the frozen set is modified.

### Minimum Verification Gates

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm boundaries`
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance`
- [x] `pnpm test:integration`
- [x] `pnpm test:scenario`
- [x] `pnpm docs:check`
- [x] Recorded local run over the real `source-A` structure with counts

## References

- [V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)
  §2.2 chain invariants, §4 supported flow, §9 R-01 and R-02, §10 decisions 2
  and 3.
- [ADR-0047](../adr/0047-evidence-application-model-reset.md) §2 — slicing answers
  where a document begins; chain resolution answers which parts are the same
  subject over time.
- [ADR-0046](../adr/0046-source-chronology-and-claim-projection.md) §3 — three
  clocks stay distinct. `instanceSourceTime` is source time and nothing else.
- Product definition, "Time Is Typed, Not Guessed" and the prohibition on
  silent entity merges.

## Checklist

- [x] Extract body-derived document identity with per-field provenance.
- [x] Implement the deterministic proposal and the unassigned report.
- [x] Implement continuation attachment.
- [x] Implement typed `instanceSourceTime`.
- [x] Implement append-only membership decisions and the effective-state fold.
- [x] Implement instance ordering including the unordered-unknown rule.
- [x] Add fixtures, including title-versus-body mismatch and a continuation.
- [x] Run the recorded real-material verification and record the counts.
- [x] Run the offline gates.
- [x] Reality-sync the specification §2.2, `CURRENT_STATUS.md`, `SYSTEMDOC.md`
      and `FILESTRUCTURE.md`.
- [x] Archive and restore the template.

## Decisions and Notes

- **A chain instance may span several source parts.** ACME-0150 caps a part at
  400 lines, so one long interview can occupy consecutive parts. Membership
  stays per part as specified; the instance is the group of memberships sharing
  an ordinal. Specification §2.2 is refined to say so in this task, which is a
  clarification of the approved `0..N` model rather than a change to it.
- The proposal is a candidate. Nothing in this layer makes a chain true, and a
  wrong grouping is corrected by one appended decision because occurrences are
  bound to parts and locators, never to chains.
- The fold is pure: no clock, no principal, no repository. The caller supplies
  decision metadata, as it supplies canonical text to the structure layer.
- Do not let this layer read the part title for anything. That is the whole
  point of R-02, and the title is present on the type only as a label.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- 2026-08-16 — Definition of Done, first bullet. "The five Hussein Ammouri
  interviews … ordered by their body dates 2004-10-22, 2004-11-09, 2004-11-29,
  2005-04-11, 2005-09-16" is corrected to: the interviews whose **body** subject
  normalizes to `AMMOURI, HUSSEIN` form exactly one chain ordered by body date,
  with those five dates present in that relative order. Reason: the count of
  five was taken from the superseded 246-part structure that the frozen
  application produced. Measurement over the current 650-part structure finds
  **thirteen** body-identified Hussein interviews, of which the five named are
  instances 2, 8, 10, 12 and 13. The goal, the primary deliverable and the
  substance of the condition — one chain, derived from the body, correctly
  ordered, with the mis-titled part excluded — are unchanged. Only a factual
  count I asserted from stale measurement is corrected.

## Verification

```text
pnpm typecheck                          pass
pnpm lint (apps packages tests tooling) pass
pnpm format:check                       pass
pnpm boundaries                         pass, incl. v2-frozen-model fixture
pnpm docs:check                         273 Markdown files
pnpm test:unit                          828/828 (was 813; +15 new)
pnpm test:conformance                   78/78
pnpm test:integration                   70/70
pnpm test:scenario                      26/26
```

`pnpm lint` at the repository root still reports the pre-existing
`no-unused-vars` in the gitignored ACME-0148 scratch file, recorded under
ACME-0149 and untouched.

Recorded run over the real `source-A` structure. The text is not committed:

```text
source parts               650
chains proposed            351
chain instances            467
memberships                645
unassigned parts           5
instances without a time   1
propose                    21 ms
deterministic              yes
fold with no decisions == proposal   yes
index parts inside a chain 0
largest chains             13, 13, 12, 5, 5, 5, 4, 4
single-instance chains     291
```

The Hussein Ammouri chain, `chain-000009`, subject label `Ammouri, Hussein`,
case file `0500-K39890-04`, thirteen instances ordered by body date with each
time resolving to its exact source line:

```text
 #1  2004-10-19T15:40  line 48055  part-000381
 #2  2004-10-22T07:55  line 50049  part-000400
 #3  2004-10-25T10:15  line 50187  part-000401
 #4  2004-10-26T20:20  line 50617  part-000408, part-000409
 #5  2004-10-29T14:45  line 50274  part-000402
 #6  2004-11-01T10:10  line 50340  part-000403 … part-000407
 #7  2004-11-03T13:45  line 48236  part-000383 … part-000385
 #8  2004-11-09T10:55  line 50692  part-000410
 #9  2004-11-09T11:14  line 47907  part-000380
 #10 2004-11-29T12:15  line 50757  part-000411
 #11 2005-03-23T14:55  line 48458  part-000386
 #12 2005-04-11T11:15  line 50909  part-000412
 #13 2005-09-16T11:35  line 51137  part-000413
```

The decisive result: `part-000387`, whose **title** reads
`Förhör med Ammouri, HUSSEIN; 2007-04-25 14:10`, is in `chain-000006`, subject
`Ammouri, Allia`. Its body reports a different person, and the body is what
this layer reads. Reading the title would have put it in Hussein's chain.

Instances #4, #6 and #7 span two, five and three parts, so continuation
attachment holds on real material.

## Documentation Updates

- [x] `docs/design/evidence-workbench-v2-domain-specification.md` §2.2
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] ADRs — none expected. `evidence-v2-chain/1` stays inside this package.

## Discovered While Implementing

1. **An `assign` decision left the superseded proposal in place**, giving the
   part two memberships — something the model represents but V1 must never
   create. A proposal is a candidate and a decision replaces it outright; a
   decided membership is only ever demoted. Fixed, and specification §2.2 now
   states it.
2. **A short document adjacent to a large index block classifies as index.**
   Content character is per part, and neither a header nor the 400-line cap
   reacts to an index-run transition, so a 12-line interview followed by 388
   contents rows lands in one part at 0.97 dot-leader density. The charter
   forbids changing the structure layer, so this was **not** fixed here. It is
   recorded as [a backlog proposal](../backlog/v2-index-run-part-boundary.md) and
   is not reached by the real binder, whose contents pages are part-sized.
3. My own Definition of Done contained a factual error, corrected in the
   amendment log above.

## Handoff and Follow-ups

- Current state: complete.
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: none.
- **Next recommended step, and the charter's standing instruction: not a fourth
  pure layer.** Two offline layers now exist and the product still has no case,
  no storage and no screen. The next task is persistence and the first surfaces
  over `Case`, `Artifact`, `SourcePart` and `Chain`, because W-03 makes real
  infrastructure and real navigation a precondition for any POC claim.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
