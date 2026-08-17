# Current Task

Task ID: ACME-0154
Parent Task: None
Status: In Progress
Owner: Claude
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Read First

- `AGENTS.md`, especially the live-call policy
- `docs/TASK_WORKFLOW.md`
- [ADR-0047](adr/0047-evidence-application-model-reset.md) §6 (the engine is
  carried forward) and §7 (a new-model contract is decided in its own ADR at
  first export)
- [ADR-0044](adr/0044-poc1-live-product-acceptance-phase.md) — bounding an
  execution is a guardrail; capping a campaign is not
- [ADR-0046](adr/0046-source-chronology-and-claim-projection.md) §4 —
  extraction is Pass 1 only
- [V2 domain specification](design/evidence-workbench-v2-domain-specification.md)
  §2.3, §4, §5, §9 (R-04, R-05, R-09), W-01
- [ACME-0150](finished/ACME-0150_v2-source-structure.md),
  [ACME-0151](finished/ACME-0151_v2-chains-and-instances.md),
  [ACME-0152](finished/ACME-0152_v2-persistence-and-surfaces.md),
  [ACME-0153](finished/ACME-0153_v2-authentication-and-authorization.md)

## Task Summary

Four layers exist and none of them is evidence. The product can slice a real
binder, group it into one person's interviews over time, store it and show it
behind a real access boundary — and it still contains nothing a reviewer could
accept or dispute.

This task produces the first evidence: `ObservationOccurrence`, extracted from
one chain instance's own source, bound to an exact locator, immutable and
replayable.

It is also the first V2 layer that spends a provider call, which makes it the
task where two recorded failures come back:

- **R-04.** The frozen pipeline died on `EVIDENCE_COVERAGE_WINDOW_INCOMPLETE`
  because the model had to enumerate 64 segments exactly and missed one, after
  a consumed repair call.
- **R-05.** Jobs committed one and six windows to the engine and projected
  nothing, because projection happened only after the whole job succeeded.

Getting those two right is the point of this task. An extractor that works on a
clean run and loses six windows on a dirty one is the frozen application again.

## Task Charter

Frozen at Ready.

### Goal

One chain instance's source produces durable, source-bound, replayable
occurrences, and a window that fails takes nothing else with it.

### Primary Deliverable

`evidence-v2-observe/1` — a versioned observe contract executed through the
unchanged ACME execution engine — plus per-window projection, persistence, and
an instance surface that shows each occurrence against its exact source lines.

### In Scope

- **ADR-0048**, deciding the V2 observe contract at first export as ADR-0047 §7
  requires: what the model is asked, what it may return, how a candidate
  becomes an occurrence, and what is refused. It decides for the new model only
  and amends no historical ADR.
- The contract itself: a bounded coverage window over one instance's citable
  units, a strict response schema, and semantic validation that refuses
  anything not bound to a supplied unit.
- Execution through `@acme/core`: execution identity, the response pipeline,
  bounded repair, encrypted payload retention and replay, unchanged. The
  extractor composes the engine; it does not call a provider directly.
- **Window planning that states its cost before spending it.** The planner
  derives the call count from the instance's stored parts and units, the
  confirmation reports it, and a separate emergency ceiling guards a runaway.
  No arbitrary per-job cap (R-09, `AGENTS.md`).
- **Window sizing chosen so the required enumeration is achievable** (R-04),
  with the chosen bound stated in ADR-0048 and justified against the observed
  64-segment failure.
- **Per-window projection** (R-05): a window's occurrences are persisted when
  that window commits. A later failure leaves them valid, visible and
  unchanged, and is reported as a failed unit of a partially complete
  extraction.
- **Resumable extraction**: re-running an instance's extraction executes only
  the windows that have not committed, identified deterministically. Nothing
  already committed is re-derived, re-sent or duplicated.
- Occurrence invariants per specification §2.3: immutable; one artifact version
  and one locator; a verbatim quote that binds uniquely; actor and temporal
  fields `null` unless the source supplies them; the producing execution
  identity carried on the record.
- Persistence in the V2 schema, and case-scoped authorization on every new
  route exactly as ACME-0153 established.
- The instance surface lists its occurrences, each opening its exact source
  lines, and shows extraction state per window: committed, outstanding, or
  failed with its reason.
- Deterministic offline tests through the mock gateway, including an injected
  mid-job window failure. A PostgreSQL-gated durability test.
- One recorded live run over a real Hussein Ammouri instance, reporting planned
  versus actual calls, token usage, and cost as recorded — unknown if the
  provider reports none.

### Out of Scope

- **Review and standing.** An occurrence produced here is canonical evidence
  under the authority ladder, not an accepted one. Accept, reject and
  unresolved are the next task, and this one must not invent a shortcut for
  them.
- Pass 2 in every form: comparison between instances, relations, continuity,
  exposure. ADR-0046 §4 keeps extraction blind, and this task keeps it blind.
- `Claim`, `ConsensusProjection`, assessment, export, search.
- Neighbour context segments. The frozen model allowed non-evidential context
  for referent resolution; the V2 contract starts without it and may add it as
  an additive version when a measured failure requires it.
- Actor rosters and entity resolution. An empty roster means null actors.
- Changing `evidence-v2-source-structure/1`, `evidence-v2-chain/1`, their rule
  versions, or the index-run boundary condition in
  [the backlog](backlog/v2-index-run-part-boundary.md).
- Any change to the frozen set in ADR-0047 §4, including the two failing
  PostgreSQL-gate tests in
  [the backlog](backlog/postgres-gate-test-hygiene.md).
- A real upstream identity provider. Still deferred.

### Definition of Done

- Extracting one real Hussein Ammouri chain instance produces occurrences that
  are persisted, listed on the instance surface, and each resolvable to its
  exact source lines with a verbatim quote.
- Every occurrence carries its producing execution identity, and the recorded
  run's executions **replay to the same digest without a second provider
  call**.
- The confirmation's planned call count equals the actual provider calls for a
  clean run, and the run reports token usage with cost recorded as unknown when
  the provider reports none.
- **An injected failure in window N leaves windows 1…N−1 persisted, visible and
  byte-identical**, and the extraction is reported as partially complete with
  the failed window named. A test asserts it offline.
- **Re-running that extraction executes only the outstanding windows.** No
  committed window is re-sent to the provider; a test asserts the call count.
- A window that fails validation fails closed: no occurrence from it is
  persisted, and no other window is affected.
- An occurrence whose quote does not bind to a supplied citable unit is
  refused, not stored.
- A non-member receives 404 from every new route.
- No file in the frozen set is modified. `pnpm boundaries` still passes.

### Minimum Verification Gates

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm format:check`
- [ ] `pnpm boundaries`
- [ ] `pnpm test:unit`
- [ ] `pnpm test:conformance`
- [ ] `pnpm test:integration`
- [ ] `pnpm test:scenario`
- [ ] `pnpm test:postgres`
- [ ] `pnpm docs:check`
- [ ] Offline mid-job failure and resume tests through the mock gateway
- [ ] One recorded live run with planned versus actual calls, usage and replay

## References

- [ADR-0047](adr/0047-evidence-application-model-reset.md) §6 and §7.
- [ADR-0044](adr/0044-poc1-live-product-acceptance-phase.md) §4 and §5 —
  execution bounding stays, campaign capping goes, cost is measured.
- [ADR-0039](adr/0039-evidence-workbench-live-model-boundary.md) — the live
  model boundary this reuses.
- [V2 specification](design/evidence-workbench-v2-domain-specification.md)
  §2.3 occurrence invariants, §5 jobs and spend points, §9 R-04, R-05, R-09.
- Product definition — the authority ladder, statement/truth separation and
  typed time, all unchanged.

## Checklist

- [ ] Write ADR-0048 and index it.
- [ ] Contract: window input, strict output schema, semantic validation.
- [ ] Window planner over stored parts and units, with a stated call count.
- [ ] Engine composition, including the mock gateway for tests.
- [ ] Per-window commit and projection.
- [ ] Resume: execute only outstanding windows.
- [ ] Persist occurrences; authorize every new route.
- [ ] Instance surface: occurrences, their exact source, per-window state.
- [ ] Offline tests, including injected mid-job failure and resume.
- [ ] PostgreSQL-gated durability test.
- [ ] Recorded live run, including a replay check.
- [ ] Reality-sync `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `FILESTRUCTURE.md`.
- [ ] Archive and restore the template.

## Decisions and Notes

- **A failed window stops the job; it does not discard it.** Fail-closed is not
  weakened: the job halts at the first failed window and reports it. What
  changes from the frozen application is that windows already committed stay
  committed, and a re-run resumes rather than restarts. That is the smallest
  design satisfying both the fail-closed rule and R-05.
- The engine is used as-is. If this layer appears to need a change inside
  `packages/core`, stop: that is the ADR-0047 §9 proof obligation failing, and
  it is a finding to record rather than a patch to apply.
- Synthetic fixtures drive the offline tests; the live run is the only claim
  about the product (W-01).
- Expected spend is single-digit provider calls for one instance. The planner
  states the exact number before the run.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- none

## Verification

- [ ] Offline gates as listed above.
- [ ] PostgreSQL gate, with the two known pre-existing failures attributed.
- [ ] Recorded live run: planned versus actual calls, usage, cost, replay.

## Documentation Updates

- [ ] `docs/adr/0048-*.md` and the ADR index
- [ ] `docs/design/evidence-workbench-v2-domain-specification.md` if §2.3 or §5
      needs a clarification this task settles
- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/FILESTRUCTURE.md`
- [ ] `docs/JOURNAL.md`

## Handoff and Follow-ups

- Current state: charter frozen at `Ready`. Implementation has not started.
- Next recommended step: implement against the checklist, ADR first.
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: none. Review and standing are deliberately the next task, not
  an omission from this one.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
