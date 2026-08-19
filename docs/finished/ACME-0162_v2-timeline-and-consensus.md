# Current Task

Task ID: ACME-0162
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-19
Last updated: 2026-08-19
Charter frozen at: 2026-08-19

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/design/evidence-workbench-v2-domain-specification.md` §2.4, §5 (J6),
  §6, §8 (P3)
- `docs/adr/0049-evidence-v2-surface-set.md`
- `docs/design/evidence-workbench-v2-interface-plan.md` (ACME-0162)

## Task Summary
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

Claims group occurrences. Relations type how they stand toward each other.
Nothing yet says what the accepted set adds up to, and nothing yet lays the
same occurrences on a clock. Those two projections are J6 and P3. They store
nothing, they spend nothing, and they are the last unbuilt surfaces in the
ADR-0049 bar.

This task delivers the Timeline surface and the Consensus projection. It
builds no report and no score.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

The same immutable occurrences can be read in time and as what reviewed
evidence currently supports, contests, qualifies or leaves unresolved — without
copying them, scoring them or treating absence as refutation.

### Primary Deliverable

The case-scoped chronological Timeline projection (ADR-0049 §1) and J6
`ConsensusProjection` per claim from accepted material only, with chain and
case levels as count aggregates that carry no vocabulary of their own.

### In Scope

- A pure Timeline projection over occurrences and claims at an explicit
  derived case revision. Typed time is preserved. Items with unknown or
  absent time sort last and are visibly unordered. Every row opens its exact
  source. The list is bounded and paged.
- A content-derived case revision (a digest of the input rows). It is stated
  on both surfaces. It is not an engine revision and is never required to
  equal one (R-06).
- J6 consensus per claim, from accepted occurrences and accepted relations
  only. Vocabulary: `supported`, `contested`, `qualified`, `unresolved`,
  `insufficient-material`. Deterministic, recomputed on read, no model and
  no spend.
- Chain-level and case-level views as counts of claim verdicts only. They
  invent no verdict of their own.
- The Timeline surface replacing the `timeline` gap. A Consensus surface
  added to the navigation set §6 already named, replacing the `consensus`
  gap.
- Consensus counts on the status surface.
- Offline tests for sort order, unknown-time visibility, the five verdicts,
  empty-claim `insufficient-material`, no case-level verdict key, paging,
  authorization and CSRF (reads only).

### Out of Scope

- Reports, exports, scoring, weighting, ranking, confidence.
- Graph visualisation. Actor rosters.
- Any write path, any model call, any new stored table.
- Changing `evidence-v2-observe/1`, `evidence-v2-review/1`,
  `evidence-v2-claim/1`, `evidence-v2-relation/1` or the PDF extractor.
- Treating `adds` as support or contradiction. Additional material is not a
  verdict.
- A case-level or chain-level consensus object.
- The degenerate chain subject label.
- Wiring Supabase Auth.

### Definition of Done

- Timeline and Consensus are authorized case-scoped reads. They store
  nothing.
- A timeline item with a typed bound renders that kind. An item with unknown
  or absent time appears in a visibly unordered group after the dated items,
  never slotted into a date.
- Two occurrences remain two timeline rows even when they quote the same
  words or share a claim.
- Consensus for a claim with no accepted members is `insufficient-material`,
  never a refutation.
- An accepted `contradicts` relation that touches the claim makes it
  `contested`. Otherwise an accepted `qualifies` makes it `qualified`.
  Otherwise an accepted `supports` makes it `supported`. Accepted `adds`
  alone, or accepted members with no stance relation, is `unresolved`.
- The projection object has no `score`, `weight`, `confidence`, `rank` or
  case-level `verdict`.
- Every consensus contributor and every timeline row opens its exact source.
- The status surface no longer lists `timeline` or `consensus` as unbuilt.
- A non-member receives 404; an unauthenticated read is 401.
- `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/FILESTRUCTURE.md` and
  `docs/JOURNAL.md` reflect the delivered state.

### Minimum Verification Gates

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm boundaries`
- [x] `pnpm test` (unit, conformance, integration, scenario)
- [x] `pnpm test:postgres` — `evidence-v2-persistence` still passes; the two
      failures attributed in
      `docs/backlog/postgres-gate-test-hygiene.md` remain the only failures
- [x] `pnpm docs:check`
- [x] `pnpm build`
- [x] `git diff --check`
- [x] Recorded read against the live Supabase case: timeline names the
      Hussein occurrences and shows unknown time as unordered; consensus
      reports the existing claim from accepted members and accepted
      relations; second principal 404; unauthenticated 401. Ledger
      unchanged. No model call.

## References

- [V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)
  §2.4, §5 J6, §6, §8 P3
- [ADR-0049](../adr/0049-evidence-v2-surface-set.md) §1
- [Interface plan](../design/evidence-workbench-v2-interface-plan.md) ACME-0162
- [ACME-0160](ACME-0160_v2-claims.md)
- [ACME-0161](ACME-0161_v2-relations.md)

## Checklist

- [x] Add the timeline projection and the J6 consensus fold to the module.
- [x] Offline tests: sort, unordered tail, five verdicts, empty claim,
      no case-level verdict, determinism.
- [x] Add the case-projection snapshot to the contracts port.
- [x] Implement the snapshot in the postgres adapter and the test stand-in.
- [x] Wire Timeline and Consensus routes; retire both gaps; add Consensus
      to the surface bar.
- [x] Render both surfaces; status counts for consensus.
- [x] Route tests: authorization, paging, gap retirement.
- [x] Run every verification gate.
- [x] Recorded read on the live case, spending nothing.
- [x] Update long-lived docs; archive this task; restore the template.

## Decisions and Notes
- A checkpoint after each step or substep is required. Checklist is therefore updated along the work and `CURRENT_STATUS.md` is always updated when changes affect the behavior.
- Record decisions and assumptions within the frozen charter.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

Recorded at freeze:

- **J6 spends nothing.** Consensus is a fold over accepted standing and
  accepted relations. The four verbs map as: contradicts → contested;
  else qualifies → qualified; else supports → supported; else material
  without a stance verb → unresolved; no accepted members →
  insufficient-material. `adds` is material, not a stance.
- **Case revision is a digest, not a clock and not the engine revision.**
  It is hashed from the identities of the rows the projection read.
- **All occurrences appear on the timeline**, with their standing shown.
  P3 is about the same immutable occurrences participating, not only the
  accepted set. Consensus remains accepted-only.
- **Consensus joins the surface bar.** §6 already named it. Hiding it was
  the gap; adding it is not a new surface.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

Run 2026-08-19. Nothing skipped.

- typecheck, lint, format:check, boundaries, docs:check, build and
  `git diff --check`: clean.
- `pnpm test`: unit 966/966 (up from 955), conformance 78, integration 70,
  scenario 26. New tests cover sort order, the unordered tail, the five
  verdicts, empty-claim `insufficient-material`, no case-level verdict,
  paging, authorization and gap retirement.
- `pnpm test:postgres`: `evidence-v2-persistence` **10/10**, including
  `readCaseProjectionInputs`. 45 of 47 pass; the two failures are the ones
  attributed in `docs/backlog/postgres-gate-test-hygiene.md`, unchanged.

Recorded read against the live case
`case-771754261be9e403af01c98d18486142`, through the product's own routes:

| Step | Result |
| --- | --- |
| Timeline | 80 rows (79 occurrences + 1 claim); **2 dated** (`range` 2004-10-22), **78 unordered**; 28 Hussein quotes |
| Claim on the timeline | `Hussein om resan` in the unordered tail, not slotted onto a date |
| Consensus | 1 claim, verdict `unresolved`, 2 accepted contributors, no accepted stance relation |
| Status | consensus counts 0/0/0/1/0; `unavailable` empty |
| Authorization | second principal 404, unauthenticated 401 |
| **Ledger** | **21 before, 21 after** — this task spent nothing |

The rejected reviewer `adds` and the three pending model-proposed relations
do not enter J6. Accepted members with no accepted stance verb is
`unresolved`, as specified.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs when long-lived decisions change — none

## Handoff and Follow-ups

- Current state: ACME-0162 complete. Every ADR-0049 surface is served.
- Next recommended step: none activated. ACME-0163 (Supabase Auth) is
  optional. Reports, actor roster and graph visualisation remain deferred.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
