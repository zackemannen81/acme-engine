# Current Task

Task ID: ACME-0150
Parent Task: None
Status: Ready
Owner: unassigned
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- [ADR-0047](adr/0047-evidence-application-model-reset.md), especially §4
  (frozen set and shared infrastructure) and §6 (carried forward unchanged)
- [V2 domain specification](design/evidence-workbench-v2-domain-specification.md),
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

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm format:check`
- [ ] `pnpm boundaries`, including the new frozen-set rule
- [ ] `pnpm test:unit`
- [ ] `pnpm test:conformance`
- [ ] `pnpm test:integration`
- [ ] `pnpm test:scenario`
- [ ] `pnpm docs:check`
- [ ] Recorded local run over the real `source-A` canonical text with counts

## References

- [ADR-0047](adr/0047-evidence-application-model-reset.md) — accepted reset,
  frozen set, shared infrastructure.
- [V2 domain specification](design/evidence-workbench-v2-domain-specification.md)
  §2.1 SourcePart invariants, §3 layer separation, §9 R-01, R-02, R-03, R-10,
  §10a package boundary.
- [ADR-0046](adr/0046-source-chronology-and-claim-projection.md) — segmentation
  follows the document and no model chooses the cuts. Carried forward.
- 2026-08-16 journal entry — the measured findings this task retires.

## Checklist

- [ ] Create the package and wire the workspace.
- [ ] Add and prove the frozen-set boundary rule.
- [ ] Implement part derivation with total coverage and stable ids.
- [ ] Implement citable units with unique binding as an emission precondition.
- [ ] Implement deterministic content-character classification.
- [ ] Implement title-as-label with provenance and no derived identity or clock.
- [ ] Add the three failure-shape fixtures.
- [ ] Run the recorded real-material verification and record the counts.
- [ ] Run the offline gates.
- [ ] Reality-sync `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `FILESTRUCTURE.md`.
- [ ] Archive and restore the template.

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

- [ ] Offline gates as listed above.
- [ ] Real-material run: emitted units, non-bindable units, parts, lines,
      classification counts.
- [ ] Determinism: two derivations of the same text compared byte for byte.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` — new package
- [ ] ADRs — none expected; a new structure-rule contract version is decided
      here only if it is exported beyond this package

## Handoff and Follow-ups

- Current state: charter frozen at `Ready`. Implementation has not started.
- Next recommended step: implement against the checklist above.
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
