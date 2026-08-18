# Current Task

Task ID: ACME-0161
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
- `docs/design/evidence-workbench-v2-domain-specification.md` §2 (`Relation`),
  §2.4, §4, §5 (J4), §6, §8 (P2)
- `docs/design/evidence-integrity-workbench-product-definition.md`
  (Relations Are Scoped)
- `docs/adr/0048-evidence-v2-observe-contract.md`
- `docs/adr/0049-evidence-v2-surface-set.md`
- `docs/design/evidence-workbench-v2-interface-plan.md` (ACME-0161)

## Task Summary
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

ACME-0160 delivered the claim: occurrences that concern one proposition can
be grouped without being merged. Consensus still cannot be computed, because
§2.4 requires two inputs and only one exists. The missing input is the
typed relation — how one piece of accepted evidence stands toward another.

The requested process model names four verbs for that standing: *bestrider*,
*tillför*, *bekräftar*, *villkorar*. They become reviewable L3 evidence, not
captions on a graph. Extraction stays blind: an instance is still observed
from its own source only. Comparison is a separate bounded job (J4) over
frozen accepted occurrences of earlier instances in the same chain.

This task delivers `Relation`, its review standing, the J4 compare contract
and planner, and the Relations surface. It builds no consensus and no
timeline.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

The four verbs in the requested model become reviewable evidence, and a later
instance can be compared with earlier accepted material without contaminating
extraction.

### Primary Deliverable

`Relation` with typed endpoints, comparable scope, rationale and provenance,
never deleting an endpoint; the J4 bounded chain-scoped comparison over
frozen accepted occurrences of earlier instances; the Relations surface as a
bounded case-scoped list with both endpoints opening their exact sources.

### In Scope

- A case-scoped `Relation` record: opaque identity, two typed endpoints
  (occurrence or claim), one of the four verbs, comparable scope, rationale,
  provenance (`model-proposed` or `reviewer-authored`), creating principal or
  execution, and time.
- The four verbs, stored in English identifiers that name the requested
  model: `contradicts` (*bestrider*), `adds` (*tillför*), `supports`
  (*bekräftar*), `qualifies` (*villkorar*).
- Comparable scope as four independent axes — actor, time, location, entity
  — each `comparable`, `incomparable` or `unknown`. A `contradicts` relation
  is refused unless actor and time are `comparable`.
- An append-only relation-review decision — `accept`, `reject` or `revise` —
  with superseded predecessor, server-derived principal, rationale and time.
  Effective standing is a pure fold over that log. Human authorship is itself
  an acceptance, as it is for reviewer-authored occurrences.
- The J4 contract `evidence-v2-compare/1`: the model cites occurrence ids
  from a supplied current set and a supplied prior set, plus type, scope and
  rationale. It never returns a quote. The product assembles the relation
  from the cited endpoints. An empty response is valid.
- A deterministic compare-window planner over frozen accepted occurrences,
  chain-scoped, with a derived call count known before spend. A re-run
  executes only windows with no committed execution.
- Persistence: relation, relation-review and comparison-window tables, their
  migration, and the port methods.
- The Relations surface from ADR-0049 §3: a bounded list, not a graph. Every
  row shows type, rationale, provenance, standing, and both endpoints
  resolved to their exact sources.
- Human-authored relations from the relations surface and from a claim or
  instance. Compare plan and run from a reviewed instance.
- Relation counts on the case-status surface, replacing the `relations`
  entry in the surface-gap list.
- Offline tests for the fold, the planner, the contract refusals, the
  invariants and the routes.

### Out of Scope

- `ConsensusProjection` and the timeline projection (ACME-0162).
- Graph rendering, actor rosters and person-level identity across chains.
- Cross-case relations. A relation belongs to one case.
- N-ary relations. V1 is binary: one `from` and one `to`.
- Extra relation types from the product definition (`scope-mismatch`,
  `duplicate`, `correction`, `unresolved`). Partial or incomparable material
  uses `qualifies`.
- Any change to `evidence-v2-source-structure/1`, `evidence-v2-chain/1`,
  `evidence-v2-observe/1`, `evidence-v2-review/1` or `evidence-v2-claim/1`,
  or their rule versions. J4 is a separate contract and a separate engine
  namespace so observe state is untouched.
- Feeding prior instances into extraction. J3 stays Pass 1.
- Scoring, weighting, ranking, confidence or any relation-level truth value.
- Reviewer assignment, bulk review and multi-reviewer workflow.
- The degenerate chain subject label in
  `docs/backlog/v2-degenerate-chain-subject.md`.
- PDF or any new source class (ACME-0158).
- Wiring Supabase Auth.

### Definition of Done

- A relation is created, listed and read behind authorized case-scoped
  routes.
- Both endpoints resolve to their exact source (occurrence quote and locator,
  or claim label and its contributors' sources). A missing endpoint is
  refused rather than invented.
- Creating, accepting or rejecting a relation leaves both endpoints and
  their standings untouched. Nothing is deleted.
- Two relations between the same pair with different types remain two rows.
  Nothing merges them.
- Review appends and never updates: a reversal is a further decision, and
  the superseded one is still stored unchanged.
- Effective standing is a pure fold; no standing is stored as a mutable
  field. A reviewer-authored relation starts accepted. A model-proposed
  relation starts pending.
- A `contradicts` relation whose actor or time scope is not `comparable` is
  refused with a named code.
- J4 is planned only over accepted occurrences of a reviewed current
  instance and frozen accepted occurrences of earlier instances in the same
  chain. The derived call count is stated before spend. A re-run of a
  committed window spends nothing.
- J3 on the same instance is unchanged: compare input is not visible to
  extraction.
- The status surface reports relation counts, and `relations` is gone from
  the not-implemented list. Timeline and consensus remain named gaps.
- A non-member receives 404 on every relation and compare route; a write
  without CSRF is refused; the recorded principal is server-derived.
- The paging rule from ACME-0159 holds: a projection speaks for its subject,
  not for the rendered page.
- `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/FILESTRUCTURE.md` and
  `docs/JOURNAL.md` reflect the delivered state.

### Minimum Verification Gates

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm boundaries`
- [x] `pnpm test` (unit, conformance, integration, scenario)
- [x] `pnpm test:postgres` — `evidence-v2-persistence` passes including the
      relation tables; the two failures attributed in
      `docs/backlog/postgres-gate-test-hygiene.md` remain the only failures,
      and any change in that set is recorded rather than explained away
- [x] `pnpm docs:check`
- [x] `pnpm build`
- [x] `git diff --check`
- [x] Recorded run against the live Supabase case, through the product's own
      routes: create a human-authored relation between endpoints from two
      instances, confirm both sources resolve and neither endpoint changed,
      reject it and confirm the log still holds both decisions
- [x] J4 offline with the mock gateway: plan, run, resume spends nothing,
      refusals are named
- [x] Live J4 only after the planner states a derived bound, and only if a
      second reviewed instance exists or is produced under that same stated
      bound. Ledger counts are recorded before and after. Missing cost stays
      unknown, never zero

## References

- [V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)
  §2 (`Relation`: never deletes an endpoint), §2.4 (accepted relations are
  the other consensus input), §4 (extract stays blind; compare is separate),
  §5 (J4), §6 (Claim surface shows relations), ADR-0049 §3 (list, not graph)
- [Product definition](../design/evidence-integrity-workbench-product-definition.md)
  — Relations Are Scoped
- [ADR-0048](../adr/0048-evidence-v2-observe-contract.md) — the observe pattern
  J4 mirrors without sharing a contract
- [ADR-0049](../adr/0049-evidence-v2-surface-set.md) §3
- [Interface plan](../design/evidence-workbench-v2-interface-plan.md) ACME-0161
- [ACME-0160](ACME-0160_v2-claims.md) — the claim endpoints a
  relation may cite
- [ACME-0159](ACME-0159_v2-review-and-standing.md) — the standing
  fold and the paging lesson
- `packages/module-evidence-v2/src/observe-contract.ts` — the contract
  shape to mirror
- `packages/module-evidence-v2/src/claim.ts` — the fold and projection
  shape to mirror

## Checklist

- [x] Add the relation record, comparable-scope rule, review decision and
      pure standing fold to the module.
- [x] Add the J4 contract, window planner and a separate compare module
      namespace so observe state is untouched.
- [x] Offline tests: fold, no-delete, comparable-scope refusal, planner
      bounds, contract refusals, empty response, determinism.
- [x] Extend the contracts port and the case-overview counts. Retire the
      `relations` surface gap.
- [x] Add the relation tables, their migration and the adapter methods.
- [x] Wire the routes, with authorization and CSRF. Human create + review;
      compare plan and run on a reviewed instance.
- [x] Render the relations list, one relation, and the compare confirmation
      on the instance surface.
- [x] Offline route and persistence tests.
- [x] Run every verification gate; record results and any skips with reasons.
- [x] Recorded run against the live Supabase case. Live J4 only under a
      stated derived bound.
- [x] Update `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `FILESTRUCTURE.md` and
      `JOURNAL.md`.
- [x] Archive this task and restore the template. ACME-0158 is next.

## Decisions and Notes
- A checkpoint after each step or substep is required. Checklist is therefore updated along the work and `CURRENT_STATUS.md` is always updated when changes affect the behavior.
- Record decisions and assumptions within the frozen charter.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

Recorded at freeze:

- **Four verbs, not the product definition's seven.** The requested model is
  *bestrider / tillför / bekräftar / villkorar*. `adds` is distinct from
  `supports`: additional material is not a confirmation. Partial or
  incomparable material uses `qualifies` rather than introducing
  `scope-mismatch` or `unresolved` in this task.
- **J4 compares occurrences, not claims.** §5 says "over frozen accepted
  occurrences of earlier instances". Humans may relate claims. The model
  cites occurrence ids only; the product never lets it author a quote.
- **`contradicts` requires comparable actor and time.** That is the product
  definition's scoped-relation rule, enforced as a named refusal rather than
  as prose in the prompt.
- **J4 is a separate engine namespace.** Observe state (`evidence-v2-state/1`)
  is not extended. A second module keeps J3's bookkeeping and J4's
  bookkeeping from being able to disagree.
- **J4 spends only after a stated bound.** This charter does not forbid
  spend — J4 is a mandatory spend point — and it does not spend on a guess.
  Human-authored relations prove the record without a call. Live J4 is a
  separate gate with a derived count.
- **The paging rule from ACME-0159 applies.** A relation's projection speaks
  for the relation, not for the page of endpoint contributors being rendered.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

Run 2026-08-18. Nothing skipped.

- typecheck, lint, format:check, boundaries, docs:check (292 files), build and
  `git diff --check`: clean.
- `pnpm test`: unit 945/945 (up from 911), conformance 78, integration 70,
  scenario 26. New tests cover the fold, comparable-scope refusal, planner
  bounds, contract refusals, compare resume, and the relation routes.
- `pnpm test:postgres`: `evidence-v2-persistence` **10/10**, including the
  append-only relation-review log. 45 of 47 pass; the two failures are the
  ones attributed in `docs/backlog/postgres-gate-test-hygiene.md`, unchanged.
- Migration 5 applied to the live Supabase database on process start.

Recorded run against the live case, through the product's own routes:

| Step | Result |
| --- | --- |
| Reviewer-authored `adds` (occurrence → existing claim) | 201, standing accepted, both sources resolved |
| Reject that relation | standing rejected; log holds accept then reject; exclusion names the accept |
| The from occurrence | still in its instance, which still totals 27 and is still `reviewed` |
| Status surface | 1 relation then later 4; `relations` gone from the unbuilt list, leaving timeline and consensus |
| Authorization | second principal 404, unauthenticated 401, missing CSRF 401 |
| J3 on Hussein ordinal 2 (`instance-part-000400`) | **3** planned, **3** spent, 52 occurrences, then reviewed |
| J4 plan | **15** windows over frozen accepted material of ordinal 1 |
| J4 run | all 15 committed (client header timeout mid-run; server finished; resume stated 0 outstanding) |
| Model-proposed relations | 3 pending (`adds`, `supports`, `adds`); every endpoint opens its exact source |
| **Ledger** | **2 → 21** (3 extract + 16 compare including repair) |

The first POST of J4 hit the fetch header timeout after nine windows; the
server continued and committed the rest. A subsequent plan reported 0
outstanding. That is resume working, and a client-timeout finding to carry:
a 15-window compare outlives the default undici header timeout.

Window count is the product of current and prior batches (52/12 × ~25/12 =
15). Empty windows are valid, so 15 calls produced 3 relations. Measured,
not a charter defect.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs when long-lived decisions change — none; J4 decisions are
      implementations of the already-accepted domain specification and
      ADR-0049

## Handoff and Follow-ups

- Current state: `Complete`. Every Definition of Done item and every frozen
  verification gate is satisfied and recorded above.
- Next recommended step: ACME-0158 (PDF import under ADR-0050).
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
