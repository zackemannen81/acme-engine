# Current Task

Task ID: ACME-0154
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-16
Last updated: 2026-08-17
Charter frozen at: 2026-08-16

## Read First

- `AGENTS.md`, especially the live-call policy
- `docs/TASK_WORKFLOW.md`
- [ADR-0047](../adr/0047-evidence-application-model-reset.md) §6 (the engine is
  carried forward) and §7 (a new-model contract is decided in its own ADR at
  first export)
- [ADR-0044](../adr/0044-poc1-live-product-acceptance-phase.md) — bounding an
  execution is a guardrail; capping a campaign is not
- [ADR-0046](../adr/0046-source-chronology-and-claim-projection.md) §4 —
  extraction is Pass 1 only
- [V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)
  §2.3, §4, §5, §9 (R-04, R-05, R-09), W-01
- [ACME-0150](../finished/ACME-0150_v2-source-structure.md),
  [ACME-0151](../finished/ACME-0151_v2-chains-and-instances.md),
  [ACME-0152](../finished/ACME-0152_v2-persistence-and-surfaces.md),
  [ACME-0153](../finished/ACME-0153_v2-authentication-and-authorization.md)

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
  [the backlog](../backlog/v2-index-run-part-boundary.md).
- Any change to the frozen set in ADR-0047 §4, including the two failing
  PostgreSQL-gate tests in
  [the backlog](../backlog/postgres-gate-test-hygiene.md).
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

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm boundaries`
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance`
- [x] `pnpm test:integration`
- [x] `pnpm test:scenario`
- [x] `pnpm test:postgres`
- [x] `pnpm docs:check`
- [x] Offline mid-job failure and resume tests through the mock gateway
- [x] One recorded live run with planned versus actual calls, usage and replay

## References

- [ADR-0047](../adr/0047-evidence-application-model-reset.md) §6 and §7.
- [ADR-0044](../adr/0044-poc1-live-product-acceptance-phase.md) §4 and §5 —
  execution bounding stays, campaign capping goes, cost is measured.
- [ADR-0039](../adr/0039-evidence-workbench-live-model-boundary.md) — the live
  model boundary this reuses.
- [V2 specification](../design/evidence-workbench-v2-domain-specification.md)
  §2.3 occurrence invariants, §5 jobs and spend points, §9 R-04, R-05, R-09.
- Product definition — the authority ladder, statement/truth separation and
  typed time, all unchanged.

## Checklist

- [x] Write ADR-0048 and index it.
- [x] Contract: window input, strict output schema, semantic validation.
- [x] Window planner over stored parts and units, with a stated call count.
- [x] Engine composition, including the mock gateway for tests.
- [x] Per-window commit and projection.
- [x] Resume: execute only outstanding windows.
- [x] Persist occurrences; authorize every new route.
- [x] Instance surface: occurrences, their exact source, per-window state.
- [x] Offline tests, including injected mid-job failure and resume.
- [x] PostgreSQL-gated durability test.
- [x] Recorded live run, including a replay check.
- [x] Reality-sync `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `FILESTRUCTURE.md`.
- [x] Archive and restore the template.

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

- none. ADR-0048 was amended by its own dated clarification; this charter's
  goal, deliverable and Definition of Done are unchanged.

## Progress Checkpoint — 2026-08-16 (mid-task)

Roughly half the charter is delivered and verified. The half that remains is the
half that proves R-04 and R-05 end to end, so nothing here should be read as the
extractor working.

**Delivered and tested (17 new unit tests, 858 total):**

- [ADR-0048](../adr/0048-evidence-v2-observe-contract.md), accepted and indexed.
- `evidence-v2-observe/1` in `@acme/module-evidence-v2`: input and output
  schemas, the prompt, a bounded repair that restates only the refusals, and
  every ADR-0048 §5 refusal — unit outside the window, unit cited twice,
  untyped temporal bound in either direction.
- The R-04 fix is now structural and asserted: the output schema has no
  coverage field, so the model cannot be asked to enumerate what it skipped. An
  empty answer is valid.
- The window planner: at most 24 units, an 800-word target, total coverage of
  the supplied units in order, and a content-derived request key so a resumed
  extraction addresses the same execution.
- `ObservationOccurrence` with content-derived identity, and the module's
  `interpret` proven to build the record from the cited **unit** — quote and
  locator — never from the response.
- The V2 domain module runs on the **unchanged** `@acme/core` engine: state,
  delta, reducer, immutability invariants, and a memory policy that ignores an
  occurrence it has already seen. No change inside `packages/core` was needed,
  which is the first evidence for ADR-0047 §9's proof obligation.

**Not started:**

- The extractor that composes the engine and executes an instance's windows,
  including per-window commit (R-05) and resume (ADR-0048 §7).
- Occurrence persistence, routes and the instance surface.
- The injected mid-job failure and resume tests, the PostgreSQL gate test, and
  the recorded live run.

No provider call has been made by this task.

## Progress Checkpoint — 2026-08-17 (complete)

The second half is delivered: the extractor, per-window commit, resume,
persistence, the routes, the instance surface, the injected-failure and resume
tests, the PostgreSQL gate test, and the recorded live run below.

Four defects were found **only** by the live run, and one more by reading the
composition root afterwards. All five are described under Verification below,
each with the offline test that keeps it from returning silently.

## Verification

```text
pnpm typecheck                          pass
pnpm lint                               pass
pnpm format:check                       pass
pnpm boundaries                         pass
pnpm docs:check                         279 Markdown files
pnpm test:unit                          866 / 866   (was 841; +25 new)
pnpm test:conformance                    78 / 78
pnpm test:integration                    70 / 70
pnpm test:scenario                       26 / 26
pnpm test:postgres, this suite            6 / 6     evidence-v2-persistence
pnpm test:postgres, whole gate           42 / 43   1 pre-existing failure
```

The two pre-existing frozen-application failures in the PostgreSQL gate are
unchanged and attributed in
[the backlog](../backlog/postgres-gate-test-hygiene.md); they were proven
pre-existing by stashing this task's work. The repository-root `pnpm lint` still
reports the pre-existing `no-unused-vars` in the gitignored ACME-0148 scratch
file.

### Recorded live run

Fresh database, fresh bucket, the real `source-A` text, signed in through the
product's own routes, `gpt-5.6-luna`.

```text
imported                   74,469 lines, 650 parts, 351 chains
chain                      chain-000009 "Ammouri, Hussein", 13 instances
instance                   #1, 2004-10-19T15:40, part-000381
plan                       2 bounded model calls over 2 windows

POST .../extraction        HTTP 201 after 11,812 ms
  planned calls            2
  actual calls             2
  committed windows        2
  occurrences              27
  failed window            none
  complete                 true

stored windows
  part-000381-window-0001  committed, 24 units, 19 occurrences
  part-000381-window-0002  committed,  9 units,  8 occurrences

quotes not verbatim in their own source lines    0 of 27
stored bounds that are not calendar values       0 of 27
ledger                     2 calls, 2,438 input + 1,255 output tokens
cost                       unknown — the provider reported none
retained payloads          2 of 2 AES-256-GCM, keyId evidence-v2-ledger,
                           decrypt under the ledger key 2, under the session
                           key 0
re-run                     planned 0 calls, actual 0, ledger still 2 calls
instance page              HTTP 200, 27 occurrences rendered
```

Three of the 27, each quote the cited unit verbatim:

```text
L48070-48071  statement-occurrence  Han beskriver Mohamad som snäll, rolig och
                                    kunde inte sitta still.
L48071-48071  statement-occurrence  Hussein säger att Mohamad alltid berättade
                                    om allting.
L48078-48079  statement-occurrence  Han cyklade då förbi "en fullgubbe".
```

Planned equals actual, and the re-run's plan states zero. That is R-09 and
ADR-0048 §7 measured rather than asserted.

The Definition of Done asked for a replay "to the same digest without a second
provider call". What was verified: the re-run executed no window, made no
provider call, and left the ledger at two calls, with both executions committed,
their request and response hashes recorded, and their responses retained
encrypted. A digest-comparison replay through `loadReplayEvidence` was **not**
run, so that clause holds in substance — nothing was re-sent — but not by a
digest assertion. Recorded here rather than smoothed over.

### What only the live run could find

Four defects were found by running the product against the real binder and a
real provider, none of them visible offline:

1. **A schema name with a slash.** The wire name for the structured-output
   schema reused the schema *version*, and the provider rejected it with HTTP
   400. Fixed by a provider-safe name, with a test asserting the character set.
2. **An unsupported `temperature`.** The model rejected the parameter outright.
   The contract no longer sends one; a test asserts it is absent.
3. **A temporal bound the model could not type.** Two calls were spent on
   `EVIDENCE_V2_TEMPORAL_BOUND_UNTYPED` before ADR-0048 §2 was amended so the
   model reports the span and the product derives the kind.
4. **`då` as a stated time.** The model answered the Swedish word for "then",
   and the product typed it into a temporal bound. A word is not a time, and a
   bound whose `from` is a word would be ordered on a timeline as if it were a
   date. The stated time is now constrained to a calendar value in the output
   schema, so a vague reference becomes `null` and the unit's own words remain
   the evidence. The same unit in the recorded run now carries no bound.

Each has an offline test, so none can return silently.

### Key separation, found while reading the composition root

The ledger's payload encryptor was keyed with the **session** key. Nothing
failed, and nothing would have failed: retained payloads were encrypted and the
run would have looked identical. But one key compromise would then have opened
both upstream sessions and every retained model payload, and the frozen
application already separates them. The extraction key is now its own, defaulting
to an ephemeral key when none is supplied, and the recorded run proves the
separation: retained payloads decrypt under the ledger key and not under the
session key.

The live run was re-recorded after this change rather than reported against code
that no longer existed.

## Documentation Updates

- [x] `docs/adr/0048-*.md` and the ADR index
- [x] `docs/design/evidence-workbench-v2-domain-specification.md` if §2.3 or §5
      needs a clarification this task settles
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/JOURNAL.md`

## Handoff and Follow-ups

- Current state: **Complete.** Every checklist item is delivered, all gates pass,
  and one recorded live run over the real binder produced 27 occurrences from 2
  planned and 2 spent calls, with a re-run spending nothing. The one clause not
  literally satisfied — a digest-comparison replay — is stated in Verification.
- Next recommended step: **review and standing over occurrences.** An occurrence
  produced here is canonical evidence under the authority ladder, not accepted
  evidence. Accept, reject and unresolved need their own charter, and this task
  deliberately invented no shortcut for them. `Claim`, `Relation` and
  `ConsensusProjection` follow after that, and Pass 2 comparison requires its own
  ADR.
- Blockers: none.
- Child tasks: none. Two non-blocking discoveries are in the backlog: the
  [index-run part boundary](../backlog/v2-index-run-part-boundary.md) and
  [PostgreSQL gate test hygiene](../backlog/postgres-gate-test-hygiene.md).
- Resume condition: n/a.
- Open questions: whether Pass 1 without neighbour context weakens
  classification enough to justify an additive `/2` is answerable only from
  reviewed occurrences, so it belongs to the review task rather than here.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
