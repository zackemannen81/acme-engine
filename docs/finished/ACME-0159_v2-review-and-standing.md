# Current Task

Task ID: ACME-0159
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
- `docs/design/evidence-workbench-v2-domain-specification.md` §2, §2.3, §7
- `docs/design/evidence-integrity-workbench-product-definition.md`
- `docs/adr/0048-evidence-v2-observe-contract.md`
- `docs/adr/0049-evidence-v2-surface-set.md`

## Task Summary
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

An occurrence is canonical evidence and **not accepted** evidence. Nothing in
the product can say a reviewer looked at one, agreed with it, disagreed with
it, or wants it looked at again. ACME-0157's status surface reports 467
instances waiting on extraction in a flow where nothing can yet be accepted,
and reports `standing` as a named gap for exactly that reason.

Every layer above this one needs it. Claims group occurrences, relations join
them, and consensus is computed "only from occurrences and relations with an
accepted standing at the stated case revision" (§2.4). Without standing there
is no accepted set, so consensus would have to invent one — which is the
failure mode the whole V2 reset exists to avoid.

This task delivers `Review`/`Standing` over occurrences and the derived
completion state the requested process model calls "markera beviskedjan som
klar". It adds no projection, no claim and no relation.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

An occurrence carries an effective standing derived from an append-only review
history, and a chain reports its own completion from that history rather than
from a flag.

### Primary Deliverable

`Review`/`Standing` over `ObservationOccurrence`: an append-only decision
record, a pure fold to effective standing, reviewer-authored occurrences under
the same L1 invariants, and the reviewer surface that drives them.

### In Scope

- A `Review` decision record — action, occurrence, superseded decision,
  server-derived principal, rationale and time — appended, never updated.
- A pure fold from the decision log to effective standing, in
  `@acme/module-evidence-v2`, mirroring the existing chain-state fold.
- Standing vocabulary: `pending`, `accepted`, `rejected`, `needs-revision`.
- A reviewer-authored occurrence that cites a **citable unit id**, so the
  product assembles quote and locator from the source exactly as ADR-0048 §2
  does for the model. A reviewer may not supply quote text.
- Derived instance and chain completion state. Never stored, never a flag.
- Persistence: an append-only decision table, its migration, and the port
  methods for appending and reading.
- Standing and completion counts on the case-status surface, replacing the
  `standing` entry in the surface-gap list.
- The instance surface: each occurrence's effective standing, its decision
  history, the review action, and the instance's own completion state.
- The chain surface: each instance's completion state and the chain's.
- Offline tests for the fold, the invariants, the routes and authorization.

### Out of Scope

- Reviewer assignment, work queues, bulk review and multi-reviewer workflow
  (domain specification §7).
- `Claim`, `Relation`, `ConsensusProjection` and the timeline projection.
- Any change to `evidence-v2-source-structure/1`, `evidence-v2-chain/1` or
  `evidence-v2-observe/1`, or to their rule versions.
- Any change to the degenerate chain subject label recorded in
  `docs/backlog/v2-degenerate-chain-subject.md`.
- PDF or any new source class.
- Mutating, deleting or rewriting an occurrence. It is immutable, and a review
  decision never edits one.
- Charts, scores, weights, rankings or any credibility indicator.
- Live model spend.
- Wiring Supabase Auth.

### Definition of Done

- A decision appends and never updates: the stored log grows, and no earlier
  decision changes.
- Effective standing is computed by a pure, total fold over that log. No
  standing is stored as a field on an occurrence.
- The latest decision for an occurrence wins, and superseding is explicit in
  the record rather than implied by ordering alone.
- An occurrence with no decision is `pending`, and `pending` is a real state
  rather than a missing one.
- A reviewer-authored occurrence carries the cited unit's exact quote and
  locator, is refused when the unit does not exist or lies outside the
  instance's parts, and is distinguishable in provenance from a model-produced
  one.
- Instance completion is derived: an instance with no committed extraction, one
  with undecided occurrences, and one where every occurrence is decided are
  three distinct named states.
- A chain reports complete only when every one of its instances is decided.
- The status surface reports standing and completion counts, and `standing` is
  gone from the not-implemented list.
- Every review write requires an authenticated principal, a case membership
  permitting `review.decide`, and a CSRF token; a non-member receives 404.
- The recorded principal is server-derived. A principal supplied in a request
  body is ignored.
- `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/FILESTRUCTURE.md` and
  `docs/JOURNAL.md` reflect the delivered state.

### Minimum Verification Gates

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm boundaries`
- [x] `pnpm test` (unit, conformance, integration, scenario)
- [x] `pnpm test:postgres` — `evidence-v2-persistence` passes including the new
      decision log; the two failures attributed in
      `docs/backlog/postgres-gate-test-hygiene.md` remain the only failures,
      and any change in that set is recorded rather than explained away
- [x] `pnpm docs:check`
- [x] `pnpm build`
- [x] `git diff --check`
- [x] Recorded run against the live Supabase case: extract one instance, review
      its occurrences through the product's own routes, watch standing and
      completion change, append a superseding decision, and confirm the earlier
      decision is still stored unchanged

## References

- [V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)
  §2 (`Review`/`Standing`), §2.3 (occurrence invariants), §2.4 (consensus needs
  an accepted set), §7 (what stays out)
- [Product definition](../design/evidence-integrity-workbench-product-definition.md)
  — human review is required and the model is a candidate generator
- [ADR-0048](../adr/0048-evidence-v2-observe-contract.md) §2 — the authority
  boundary a reviewer-authored occurrence must also respect
- [ADR-0049](../adr/0049-evidence-v2-surface-set.md)
- [Interface plan](../design/evidence-workbench-v2-interface-plan.md)
- [ACME-0157](../finished/ACME-0157_v2-shell-and-case-status.md) — the surface-gap
  machinery this task is the first to retire an entry from
- `packages/module-evidence-v2/src/chain.ts` — the append-only fold to copy

## Checklist

- [x] Decide and record the standing vocabulary and what `move` means here.
- [x] Add the decision record and the pure fold to the module.
- [x] Add instance and chain completion derivation to the module.
- [x] Extend the contracts port and the case-overview projection.
- [x] Add the decision table, its migration and the adapter methods.
- [x] Add the reviewer-authored occurrence path with its refusals.
- [x] Wire the routes, with authorization and CSRF.
- [x] Render standing, history, the review action and completion state.
- [x] Retire the `standing` surface gap.
- [x] Offline tests: fold, invariants, refusals, routes, authorization.
- [x] Run every verification gate; record results and any skips with reasons.
- [x] Recorded run against the live Supabase case, including the bounded
      extraction. The operator authorized the 2 planned calls on 2026-08-18,
      which resolved the charter's contradiction in favour of the gate.
- [x] Update `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `FILESTRUCTURE.md` and
      `JOURNAL.md`.
- [x] Archive this task and restore the template.

## Decisions and Notes
- A checkpoint after each step or substep is required. Checklist is therefore updated along the work and `CURRENT_STATUS.md` is always updated when changes affect the behavior.
- Record decisions and assumptions within the frozen charter.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

Recorded at freeze:

- **`move` is not an occurrence decision.** The specification's vocabulary is
  "accept, reject, revise or move", but §2.3 states that an occurrence belongs
  to a chain instance by reference only and that re-chaining never touches it.
  Moving is therefore already exercised, correctly, by the chain membership
  decisions delivered in ACME-0152. An occurrence decision is `accept`,
  `reject` or `revise`. Inventing an occurrence move would create a second way
  to re-chain that could disagree with the first.
- **`revise` does not edit anything.** An occurrence is immutable. `revise`
  records that a reviewer wants it looked at again; it never rewrites a quote,
  a locator or a bound.
- **A reviewer cites a unit, not a quote.** The same boundary ADR-0048 §2
  applies to the model applies to a person: the product assembles the record
  from the source. This makes "a quote that is not in the source" structurally
  unrepresentable rather than something a validator has to catch.
- Completion is derived on read. A stored flag would be a second source of
  truth that the decision log could contradict.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

Run 2026-08-18.

- typecheck, lint, format:check, boundaries, docs:check (290 files), build and
  `git diff --check`: clean.
- `pnpm test`: unit 893/893 (up from 871), conformance 78, integration 70,
  scenario 26. 22 new tests: 13 over the fold, 9 over the routes including the
  paging regression above.
- `pnpm test:postgres`: `evidence-v2-persistence` **8/8**, including the
  append-only decision log. 43 of 45 pass; the two failures are the ones
  attributed in `docs/backlog/postgres-gate-test-hygiene.md`, unchanged.
- Migration 3 applied to the live Supabase database: `review_decisions` exists
  and `occurrences.authored_by` defaults to `model`, so every record written
  before reviewer authoring existed still says what it meant.

Recorded run against the live case, through the product's own routes:

| Step | Result |
| --- | --- |
| Reviewer authors an occurrence citing unit L48071 | 201; quote taken from the unit; the `exactQuote` planted in the request body was ignored |
| Standing after authoring | `accepted` — authoring is itself an acceptance |
| Reject, then reverse | both 201, each superseding the previous by id |
| Effective standing | `accepted`, `decisionCount` 3 |
| Stored log | `accept, reject, accept` — **rejection removed nothing** |
| Principal | server-derived; the `principal: an-impostor` in the body was ignored |
| Refusals | no rationale 400, `move` 400, unknown occurrence 404, unit outside the instance 404 |
| Authorization | second principal 404, unauthenticated 401, missing CSRF 401 |
| Status surface | `standing` gone from the unbuilt list; `timeline, relations, claims, consensus` remain |
| Re-running the whole journey | the same occurrence, not a duplicate — it is content-identified — with three further decisions appended |

### The bounded extraction, authorized 2026-08-18

The charter's gate required an extraction and its Out of Scope forbade live
spend. Both could not hold; the operator resolved it by authorizing the two
planned calls. The contradiction was mine and is left in the record.

| Measurement | Value |
| --- | --- |
| Planned model calls | 2 |
| Spent | **2** |
| Elapsed | 70.2 s |
| Windows | both committed, 19 and 7 occurrences |
| Occurrences | 26 model-produced, plus the 1 reviewer-authored = 27 |
| Quotes absent from their own source lines | **0 of 27** |
| Stated times that are not a calendar value | **0** |
| Ledger | 2 calls, 2,438 input and 4,802 output tokens, `gpt-5-2025-08-07` |
| Retained payloads | AES-256-GCM under key id `evidence-v2-ledger`, separate from the session key |
| Provider cost | reported as **unknown**, not zero |
| Re-running the plan | **0** calls, both windows already committed |

Then the review journey over model-produced evidence: 25 accepted, 1 rejected,
1 marked needing revision, 0 undecided. The instance moved
`not-extracted` → `pending-review` → `reviewed`; the chain reports 1 of 13
instances reviewed, 0 pending review, 12 not extracted, and therefore
**not complete** — which is correct, and is the point of deriving it.

### One defect, found by this run and fixed

The instance surface reported `reviewed` while the chain and the case reported
the same instance pending. Instance completion was folded over the **rendered
page** rather than the instance: 27 occurrences, a page of 25, and the two
beyond the page were invisible to the fold. That is R-07 in miniature, in code
written by the task whose Task Summary names R-07 as the regression it is most
able to reintroduce.

Completion now folds over every occurrence of the instance while the rendered
list stays bounded, because completion is a property of the instance and the
page bound is a property of the display. The chain fold had the same latent
bound and was fixed with it. A regression test builds an instance with more
units than one page and asserts that a page of one and the whole instance
report identical completion.

After the fix, all three surfaces agree: instance `reviewed` with 0 pending,
chain 0 pending review, case `instancesPendingReview` 0.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` when structure changes
- [ ] ADRs when long-lived decisions change — none anticipated; the domain
      specification already decides the Review/Standing semantics

## Handoff and Follow-ups

- Current state: `Complete`. Every Definition of Done item and every frozen
  verification gate is satisfied and recorded above.
- Next recommended step: ACME-0160 (claims) or ACME-0158 (PDF import). The
  evidence spine now has an accepted set, which is what claims and consensus
  are defined over.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.
- Recorded, not fixed: the degenerate chain subject label
  (`docs/backlog/v2-degenerate-chain-subject.md`) is untouched, as this
  charter's Out of Scope requires.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
