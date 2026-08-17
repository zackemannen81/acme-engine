# Current Task

Task ID: ACME-0150
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- [ADR-0047](../adr/0047-evidence-application-model-reset.md), especially §4
  (frozen set and shared infrastructure) and §6 (carried forward unchanged)
- [V2 domain specification](../design/evidence-workbench-v2-domain-specification.md),
  especially §2.1, §3, §9 and §10a
- `docs/CURRENT_STATUS.md`

## Task Summary

The first implementation step of the accepted application-model reset.

`Artifact → SourcePart` is the bottom of the new model and the layer every
later object stands on. It is also where the 2026-08-16 real-source run failed
hardest: 259 of 92,141 derived citable units could not bind uniquely inside
their own locator range, and because one such unit aborts a whole analysis job,
126 of 246 source parts (51 %) were unanalysable. Two further findings live at
the same layer: 23 phantom "Förhör" parts derived from the binder's table of
contents, and part titles that systematically named a different document than
the part body.

This task builds that layer once, deterministically and offline, so those three
findings are retired as design properties rather than patched later. It spends
nothing: no provider call, no persistence, no app.

## Task Charter

Frozen at Ready.

### Goal

One artifact version's canonical text derives deterministically into source
parts whose every citable unit is provably uniquely bindable, whose
index/front-matter parts are classified as such, and whose titles cannot be used
as identity or as a clock.

### Primary Deliverable

`packages/module-evidence-v2` exporting `evidence-v2-source-structure/1`: a
pure, total, offline derivation from canonical text to ordered source parts and
their citable units, including the deterministic proof that every emitted unit
binds uniquely.

### In Scope

- Create `packages/module-evidence-v2` and wire it into the workspace,
  TypeScript project references and lint/format configuration.
- A boundary rule, enforced by `pnpm boundaries`, that forbids any dependency
  from the new package on the frozen set named in ADR-0047 §4.
- `evidence-v2-source-structure/1`:
  - canonical text → ordered `SourcePart`s with total coverage, so every line
    belongs to exactly one part;
  - each part → ordered citable units;
  - stable identities for the life of (canonical text, rule version).
- **Unique binding is an emission precondition.** A citable unit whose text does
  not occur exactly once inside its own locator range is never emitted: the
  derivation deterministically widens or merges it until it binds, or refuses
  the part with a named diagnostic. There is no path by which a non-bindable
  unit reaches a consumer.
- **Content character per part**, from deterministic signals only, at least
  `index-or-front-matter` and `substantive`. Dot-leader density and trailing
  page-number shape are sufficient signals for the observed material and no
  model may be consulted.
- **Title is a label.** A part's title carries its own provenance (the exact
  line it came from). The `SourcePart` type exposes no date, no subject identity
  and no ordering key derived from the title.
- Single-pass derivation with constant-time unit lookup from a derived index, so
  the R-10 recomputation cost cannot be reintroduced at this layer.
- Committed deterministic fixtures reproducing each observed failure shape: a
  hard-wrapped sentence whose tail word repeats on the same line, a dot-leader
  index page, and a header line that precedes a body belonging to a different
  document.
- A recorded local verification run over the real `source-A` canonical text,
  reported in this task's Verification section. The text itself is not
  committed.

### Out of Scope

- Every other V2 object: `Chain`, `ChainInstance`, `ObservationOccurrence`,
  `Claim`, `Relation`, `Review`/`Standing`, `ConsensusProjection`. This task
  emits no occurrence and resolves no chain.
- Coverage windows, extraction, comparison, any model or provider call, any
  spend.
- Persistence, repositories, API routes, apps, UI, search, overview.
- `evidence-v2-contracts` and `evidence-v2-views`. They are created when
  something needs them.
- Any change to the frozen set in ADR-0047 §4, including bug fixes. R-01 to R-08
  and R-10 are not fixed there by this task.
- Any change to shared infrastructure. If the derivation appears to need one,
  stop and charter it separately.
- Reinterpreting, migrating or re-cutting existing artifacts, structures,
  observations or cases.
- Instance source time. It belongs to `ChainInstance` and is a later task; this
  task only guarantees the title cannot be mistaken for it.

### Definition of Done

- Over the real `source-A` canonical text (74,469 lines): every emitted citable
  unit binds uniquely inside its own locator range — zero exceptions of the
  total emitted — and every line belongs to exactly one part.
- The `"Kamel"` and `"Hussein"` line shapes from that text emit bindable units
  or a named refusal, never a unit that occurs twice in its own range.
- The binder's table-of-contents region classifies as `index-or-front-matter`,
  and no substantive interview region is classified as index in the fixtures.
- `SourcePart` has no date field and no identity derived from its title;
  a test asserts the absence, not just the current behaviour.
- Re-deriving the same canonical text yields byte-identical parts, unit ids and
  classifications.
- `pnpm boundaries` fails if the new package imports a frozen package.
- No file in the frozen set is modified. Historical contracts, stored records
  and request hashes are untouched.

### Minimum Verification Gates

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm boundaries`, including the new frozen-set rule
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance`
- [x] `pnpm test:integration`
- [x] `pnpm test:scenario`
- [x] `pnpm docs:check`
- [x] Recorded local run over the real `source-A` canonical text with counts

## References

- [ADR-0047](../adr/0047-evidence-application-model-reset.md) — accepted reset,
  frozen set, shared infrastructure.
- [V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)
  §2.1 SourcePart invariants, §3 layer separation, §9 R-01, R-02, R-03, R-10,
  §10a package boundary.
- [ADR-0046](../adr/0046-source-chronology-and-claim-projection.md) — segmentation
  follows the document and no model chooses the cuts. Carried forward.
- 2026-08-16 journal entry — the measured findings this task retires.

## Checklist

- [x] Create the package and wire the workspace.
- [x] Add and prove the frozen-set boundary rule.
- [x] Implement part derivation with total coverage and stable ids.
- [x] Implement citable units with unique binding as an emission precondition.
- [x] Implement deterministic content-character classification.
- [x] Implement title-as-label with provenance and no derived identity or clock.
- [x] Add the three failure-shape fixtures.
- [x] Run the recorded real-material verification and record the counts.
- [x] Run the offline gates.
- [x] Reality-sync `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `FILESTRUCTURE.md`.
- [x] Archive and restore the template.

## Decisions and Notes

- The derivation is a pure function of canonical text plus rule version. It
  reads no repository, no artifact store and no clock.
- Refusal is a legitimate outcome. A part that cannot be derived safely is
  reported with a named diagnostic rather than emitted in a degraded form.
- The real `source-A` text is not committed. It contains anonymized judicial
  material, and `AGENTS.md` forbids committing source documents. The recorded
  counts are the evidence; the fixtures are the regression.
- Do not generalise this package into the whole V2 domain module while it is
  the only thing in it. Later objects arrive under their own charters.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- none

## Verification

```text
pnpm typecheck                          pass
pnpm lint (apps packages tests tooling) pass
pnpm format:check                       pass
pnpm boundaries                         pass, incl. v2-frozen-model fixture
pnpm docs:check                         271 Markdown files
pnpm test:unit                          813/813 (was 800; +13 new)
pnpm test:conformance                   78/78
pnpm test:integration                   70/70
pnpm test:scenario                      26/26
```

`pnpm lint` at the repository root still reports the pre-existing
`no-unused-vars` in the untracked, gitignored ACME-0148 scratch file
`tmp/source-ab-prep/exercise-more.mjs`, recorded under ACME-0149 and untouched
here.

Recorded run over the real `source-A` canonical text. The text is not
committed; these counts are the evidence:

```text
lines                     74,469
parts                     650      (median 97, mean 115 lines)
citable units             29,971
non-bindable units        0
diagnostics               0
parts <= 3 lines          32
parts repeating the previous part title   0
dot-leader lines inside index parts       944 of 944 (100.0%)
largest part              400 lines
derive                    88 ms, single pass
verify                    21 ms
29,971 unit lookups       3 ms
byte-identical re-derive  yes
```

The two lines that aborted the frozen pipeline now bind:

```text
L50796  2 units, quotes "Hussein minns \ninte vad Kamel Kawtharanis mamma …"
              and "Kamel \nHEMLIG\noch hans bröder tillhörde Baz-partiet i Tofata."
L50823  2 units, quotes "Hussein tillfrågas om det har inträffat flera mord …"
              and "Hussein \nsvarar \"nej, det finns inget mera\"."
```

A sentence broken across a page marker is now one unit spanning both lines
rather than a bare repeated word, which is why it binds.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` — new package
- [x] ADRs — none changed. The rule version stays inside this package.

## Discovered While Implementing

Two boundary defects that only real material exposes, both fixed inside the
frozen charter because part derivation is the deliverable, and both now carried
by their own regression tests:

1. **Index rows opened parts.** Every contents row starts with `Förhör`, so the
   header lexicon produced one phantom part per row — R-01 in a new shape. An
   index row references a document; it does not open one.
2. **Reprinted page headers and metadata labels opened parts.** A long
   interview reprints its header on every page, and `Förhör påbörjat` /
   `Förhör avslutat` are field labels. Together they produced 2,819 parts, 933
   of them three lines or shorter, 357 repeating the previous title. Requiring
   a date or case reference on a lexicon header, and ignoring a reprint of the
   currently open header, brings it to 650 parts with 32 short ones and no
   repeats.

Neither was in the charter's problem statement; both are part derivation, so
neither expanded it. Nothing else discovered was acted on.

## Handoff and Follow-ups

- Current state: complete.
- Next recommended step: the next V2 layer under its own charter. By dependency
  it is `SourcePart → Chain → ChainInstance`, where `instanceSourceTime` is
  derived from document body metadata — the other half of R-02.
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: none. Instance source time, chain resolution and extraction
  are deliberately later tasks, not open questions in this one.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
