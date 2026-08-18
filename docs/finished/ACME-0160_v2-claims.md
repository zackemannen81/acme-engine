# Current Task

Task ID: ACME-0160
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-18
Last updated: 2026-08-18
Charter frozen at: 2026-08-18

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/design/evidence-workbench-v2-domain-specification.md` §2 (`Claim`),
  §2.4, §3, §5 (J5), §6, §8 (P2)
- `docs/design/evidence-integrity-workbench-product-definition.md`
- `docs/adr/0049-evidence-v2-surface-set.md`

## Task Summary
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

ACME-0159 gave occurrences a standing, so there is now an accepted set. What
there is not is any way to say that two occurrences are about the same thing.
The 27 occurrences on the Hussein instance are 27 unrelated rows, and an
occurrence in one instance has no expressible relationship to an occurrence in
another.

That is what a `Claim` is for: a named grouping target over occurrences that
overlap a theme or proposition. It is the first V2 object that reaches across
instances, so it is also the first that can demonstrate P2 — cross-source
reasoning — and the object §2.4 names as the only subject consensus is ever
computed for.

The rule that makes it safe is the one that makes it useful: a claim **never
merges, never absorbs and never owns**. Grouping is a recorded decision, not a
mutation. Two occurrences grouped under one claim remain two immutable
occurrences with their own sources, their own standings and their own
provenance; the claim is a lens, and removing an occurrence from it changes
nothing about the occurrence.

This task delivers `Claim`, its grouping decisions, the J5 projection and the
Claim surface. It builds no relation and no consensus.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Occurrences that concern one proposition can be worked as a group, across
instances and chains, without any of them being merged, absorbed or owned.

### Primary Deliverable

`Claim` as a named grouping target: an append-only grouping decision, the
deterministic J5 projection over it, and the Claim surface that drives them.

### In Scope

- A case-scoped `Claim` record: opaque identity, a human-supplied label and
  statement, creating principal and time.
- An append-only grouping decision — `include` or `exclude`, claim,
  occurrence, superseded predecessor, server-derived principal, rationale and
  time.
- A pure fold from the decision log to effective claim membership, mirroring
  the chain-membership and standing folds.
- The J5 projection for one claim: its contributing occurrences, the standing
  of each, the distinct instances and chains they come from, and the source
  spread that makes cross-source support visible. Deterministic, recomputed on
  read, no model and no spend.
- Persistence: claim and grouping-decision tables, their migration, and the
  port methods.
- The `Claim` surface from §6, added to the navigation set it has always
  belonged to, with bounded lists and every row opening its exact source.
- Adding an occurrence to a claim from the instance surface.
- Claim counts on the case-status surface, replacing the `claims` entry in the
  surface-gap list.
- Offline tests for the fold, the projection, the invariants and the routes.

### Out of Scope

- `Relation`, `ConsensusProjection` and the timeline projection.
- Any merge, absorb, dedupe or "canonical occurrence" concept. Two occurrences
  quoting the same words stay two occurrences.
- Deleting an occurrence, or letting a claim survive as an assertion after its
  occurrences are excluded.
- Any model call, deterministic claim proposal or automatic grouping. Grouping
  is a human decision in V1.
- Scoring, weighting, ranking, confidence or any claim-level truth value.
- Cross-case claims. A claim belongs to one case.
- Reviewer assignment, bulk grouping and multi-reviewer workflow.
- Any change to `evidence-v2-source-structure/1`, `evidence-v2-chain/1`,
  `evidence-v2-observe/1` or `evidence-v2-review/1`, or their rule versions.
- The degenerate chain subject label in
  `docs/backlog/v2-degenerate-chain-subject.md`.
- PDF or any new source class.
- Wiring Supabase Auth.

### Definition of Done

- A claim is created, listed and read behind authorized case-scoped routes.
- Grouping appends and never updates: an exclusion is a further decision, and
  the superseded one is still stored unchanged.
- Effective membership is a pure fold over that log; no claim membership is
  stored as a mutable field, and no occurrence record changes when it is
  grouped or ungrouped.
- The projection resolves every contributing occurrence to its exact source
  locator and quote, and reports each one's standing rather than flattening
  them.
- A claim holding occurrences from two or more instances reports that spread
  explicitly, which is the P2 property in miniature.
- Excluding every occurrence leaves an empty claim that states it is empty, not
  a claim that asserts anything.
- Two occurrences with identical quotes grouped under one claim remain two
  rows, each with its own source. Nothing dedupes them.
- The status surface reports claim counts, and `claims` is gone from the
  not-implemented list.
- A non-member receives 404 on every claim route; a write without CSRF is
  refused; the recorded principal is server-derived.
- Completion and standing behaviour delivered by ACME-0159 is unchanged, and
  the paging rule it established — a projection speaks for its subject, not for
  the rendered page — holds here too.
- `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/FILESTRUCTURE.md` and
  `docs/JOURNAL.md` reflect the delivered state.

### Minimum Verification Gates

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm boundaries`
- [x] `pnpm test` (unit, conformance, integration, scenario)
- [x] `pnpm test:postgres` — `evidence-v2-persistence` passes including the
      claim tables; the two failures attributed in
      `docs/backlog/postgres-gate-test-hygiene.md` remain the only failures,
      and any change in that set is recorded rather than explained away
- [x] `pnpm docs:check`
- [x] `pnpm build`
- [x] `git diff --check`
- [x] Recorded run against the live Supabase case: create a claim, group
      occurrences from **two different instances** into it, confirm the
      projection names both sources and both standings, exclude one and confirm
      the occurrence and the superseded decision are both intact
- [x] No model call is made by this task. Verified against the ledger count,
      which must be unchanged at 2

## References

- [V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)
  §2 (`Claim`: never merges, never absorbs, never owns), §2.4 (the claim is the
  only consensus subject), §3 (projection never owns), §5 (J5 is deterministic
  and spends nothing), §6 (the Claim surface), §8 (P2)
- [Product definition](../design/evidence-integrity-workbench-product-definition.md)
  — source-bound observations and changed accounts are preserved, never merged
- [ADR-0049](../adr/0049-evidence-v2-surface-set.md) §5 — the six core surfaces
  are unchanged, and `Claim` is one of them
- [ACME-0159](../finished/ACME-0159_v2-review-and-standing.md) — the standing this
  projection reports, and the paging lesson it paid for
- `packages/module-evidence-v2/src/review.ts` — the append-only fold to mirror

## Checklist

- [x] Add the claim record, grouping decision and pure fold to the module.
- [x] Add the J5 projection: contributors, standings, instance and chain
      spread.
- [x] Extend the contracts port and the case-overview counts.
- [x] Add the claim tables, their migration and the adapter methods.
- [x] Wire the routes, with authorization and CSRF.
- [x] Add `claims` to the navigation surface set and retire its gap.
- [x] Render the claims list, one claim, and the add-to-claim action.
- [x] Offline tests: fold, projection, no-merge, empty claim, routes,
      authorization, paging.
- [x] Run every verification gate; record results and any skips with reasons.
- [x] Recorded run against the live Supabase case, spending nothing.
- [x] Update `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `FILESTRUCTURE.md` and
      `JOURNAL.md`.
- [x] Archive this task and restore the template.

## Decisions and Notes
- A checkpoint after each step or substep is required. Checklist is therefore updated along the work and `CURRENT_STATUS.md` is always updated when changes affect the behavior.
- Record decisions and assumptions within the frozen charter.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

Recorded at freeze:

- **J5 is deterministic because grouping is decided, not inferred.** §5 lists
  J5 as a deterministic projection with no model and no spend. That is
  consistent with §2's "grouping is a recorded decision": a human records the
  decisions and the projection over them is a pure function. No claim proposal,
  deterministic or otherwise, is built here.
- **A claim has no truth value.** It carries a label and a statement of what it
  groups, and nothing that reads as support, confidence or weight. Consensus is
  ACME-0162's subject and has its own vocabulary; a claim that scored itself
  would pre-empt it.
- **`Claim` was always a §6 surface.** ADR-0049 §5 leaves the six core surfaces
  unchanged, so adding it to the navigation set implements that decision rather
  than amending it.
- The paging rule from ACME-0159 applies: a claim's projection speaks for the
  claim, not for the page of contributors being rendered.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

Run 2026-08-18. Nothing skipped.

- typecheck, lint, format:check, boundaries, docs:check (291 files), build and
  `git diff --check`: clean.
- `pnpm test`: unit 911/911 (up from 893), conformance 78, integration 70,
  scenario 26. 18 new tests: 12 over the fold and the projection, 6 over the
  routes.
- `pnpm test:postgres`: `evidence-v2-persistence` **9/9**, including the
  append-only grouping log. 44 of 46 pass; the two failures are the ones
  attributed in `docs/backlog/postgres-gate-test-hygiene.md`, unchanged.
- Migration 4 applied to the live Supabase database.

Recorded run against the live case, through the product's own routes:

| Step | Result |
| --- | --- |
| Claim `Hussein om resan` created | 201 |
| Grouped 3 model-produced occurrences plus 1 reviewer-authored from a second instance | 4 contributors, **2 distinct instances**, `crossInstance: true` |
| Standings inside the claim | 2 accepted, 1 rejected, 1 needing revision, 0 undecided — each reported, none flattened |
| Sources | every contributor resolves to its own instance and line range |
| Excluded one | 3 contributors; the grouping log still holds all 5 decisions; the exclusion names what it superseded |
| The excluded occurrence | still in its instance, which still totals 27 |
| Status surface | 1 claim, 5 grouping decisions, 3 grouped occurrences, 1 cross-instance claim; `claims` gone from the unbuilt list, leaving timeline, relations and consensus |
| Authorization | second principal 404 on list and read, unauthenticated 401, missing CSRF 401 |
| **Ledger** | **2 calls before, 2 after** — this task spent nothing, as J5 requires |

A rejected contributor stays visible in the claim. Hiding it would make the
group look cleaner than the evidence is.

### Three assertions corrected, none of them the code

Two older tests asserted that `claims` appears in the unbuilt-surface list.
Retiring that gap is what this task does, so they were updated to use
`timeline` — the same mechanism that caught the `standing` retirement in
ACME-0159, working again. The third was mine: I asserted that an exclusion
records `supersedes: null`, when an exclusion should name the inclusion it
replaces. The code was right.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs when long-lived decisions change — none anticipated

## Handoff and Follow-ups

- Current state: `Complete`. Every Definition of Done item and every frozen
  verification gate is satisfied and recorded above.
- Next recommended step: ACME-0161 (relations and instance comparison) or
  ACME-0158 (PDF import). Relations is the last piece before consensus has
  both of the inputs §2.4 names.
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
