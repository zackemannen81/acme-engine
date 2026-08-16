# Journal

## 2026-08-16 — ACME-0153 V2 authentication and authorization

- Date: 2026-08-16
- Author: Claude
- Task: ACME-0153
- Change: the V2 app now authenticates every route and authorizes every
  case-scoped one. `@acme/adapter-evidence-auth-postgres` persists principals,
  memberships and sessions in their own schema; `createEvidenceSessionService`
  issues the session cookie, CSRF token and encrypted upstream session;
  `authorizeEvidenceCaseAction` decides access. Sign-in, sign-out and session
  read are the only unauthenticated routes besides `/health`. Case creation
  registers the identity case and an owning `case-admin` membership in the same
  operation, and the case list is scoped to membership. No new authorization
  model was written: ADR-0035 and ADR-0036 are applied, not amended.
- Recorded run on a fresh database and bucket with the real `source-A` text,
  signed in throughout: import 988 ms with a matching canonical SHA-256, 650
  parts, 351 chains, restart, the Hussein chain's 13 instances, `part-000387`
  under `Ammouri, Allia`, and one membership decision leaving the stored
  proposal and structure md5-identical. Then, as a second principal with no
  membership: **404 on all six case-scoped routes and on the import write**, and
  an empty case list. Unauthenticated 401, write without CSRF 401, cross-origin
  write 403, sign-out 204 followed by 401.
- Discovered while implementing: two case-scoped routes I believed were guarded
  were not. `GET /api/cases/{caseId}` and `GET /api/artifacts/{id}/parts/{partId}`
  answered 200 to a non-member until the denial matrix — one assertion per
  route, which the charter demanded for exactly this reason — found them. Both
  now authorize and each is covered.
- Verification: typecheck, format, boundaries and docs (276 files) clean; unit
  841/841, up from 836; conformance 78/78; integration 70/70; scenario 26/26.
  `pnpm test:postgres` is 41/42: one pre-existing frozen-app failure, and a
  second that appears when the gate is re-run against the same database. Both
  were reproduced at commit `6c73843` with this task's work stashed, so neither
  is caused by it; they are recorded in
  [the backlog](backlog/postgres-gate-test-hygiene.md).
- Handoff: `docs/CURRENT_TASK.md` restored to the template. Next by dependency
  is `ObservationOccurrence` — extraction over a chain instance, the first V2
  layer that spends a provider call. A real upstream identity provider remains
  deliberately deferred.
- Signature: Claude

## 2026-08-16 — ACME-0152 V2 persistence and first surfaces

- Date: 2026-08-16
- Author: Claude
- Task: ACME-0152
- Change: the two derived V2 layers became operable. Four new units —
  `@acme/evidence-v2-contracts`, `@acme/adapter-evidence-v2-postgres`,
  `apps/evidence-workbench-v2-api` and `apps/evidence-workbench-v2-web` —
  persist a case and an artifact on real PostgreSQL, store canonical text
  encrypted in an object store through the shared ADR-0037 envelope, derive
  structure and chains exactly once inside the import transaction, and serve a
  plain browser surface for Case → Source → Chain → Instance → exact source
  lines. Every list is bounded at 100 rows. No model call, no spend.
- Recorded run on a fresh database and a fresh bucket with the real `source-A`
  text: import 1,205 ms, canonical SHA-256 matching, 74,469 lines, 650 parts
  and 351 chains persisted. The process was then stopped and restarted and
  every read below came from PostgreSQL: bounded pages, the Hussein chain with
  13 instances in body-date order, and `part-000387` — titled
  `Förhör med Ammouri, HUSSEIN; 2007-04-25` — opening under `Ammouri, Allia`
  with its 352 exact source lines. All six HTML pages answered 200.
- One appended membership decision moved `part-000381` to Allia's chain. The
  Hussein chain view went 13 → 12 instances while the stored proposal (645
  rows) and stored structure (650 rows) stayed md5-identical, read straight
  from PostgreSQL. Blast radius measured, not asserted.
- Discovered by the run and fixed: the chain page rendered the proposal rather
  than the effective state, so a moved part still appeared in the chain it had
  been moved off — a correction invisible on the surface where it was made. A
  unit test now covers it. Nothing else discovered was acted on.
- Deferred by decision and stated as a limitation, not hidden: the V2 app has
  no authentication or authorization. It binds to loopback and every route
  names its case explicitly. Wiring the shared `@acme/evidence-auth` model is
  the next task.
- Verification: typecheck, format, boundaries (with the frozen-set rule
  extended to the new adapter and app) and docs (274 files) clean; unit
  836/836, up from 828; conformance 78/78; integration 70/70; scenario 26/26;
  `pnpm test:postgres` gains a 4-test `evidence-v2-persistence` suite that
  passes against real PostgreSQL. Lint clean over `apps packages tests
  tooling`; the pre-existing gitignored ACME-0148 scratch-file error is
  untouched.
- Handoff: `docs/CURRENT_TASK.md` restored to the template. The next task is
  authentication and authorization for the V2 app.
- Signature: Claude

## 2026-08-16 — ACME-0151 V2 chains and chain instances

- Date: 2026-08-16
- Author: Claude
- Task: ACME-0151
- Change: second V2 layer, `evidence-v2-chain/1` in
  `@acme/module-evidence-v2`. Source parts organize into longitudinal chains
  whose subject and instance time are read from the document body's labelled
  fields — `Hörd person`, `Förhörsdatum`, `Förhör påbörjat`, `Diarienr` — each
  with provenance to the exact line. The part title is never consulted.
  Membership decisions are append-only and a pure fold derives the effective
  state. Deterministic, offline, no persistence, no surface, no provider call.
- Measured over the real 650-part `source-A` structure: **351 chains**, 467
  instances, 645 memberships, 5 unassigned parts, 1 instance without a readable
  time, 21 ms, byte-identical on re-derivation, zero index parts placed in a
  chain.
- The result the reset was for: the Hussein Ammouri chain holds 13 instances
  ordered by body date from 2004-10-19 to 2005-09-16, each resolving to its
  source line, with instances #4, #6 and #7 spanning two, five and three parts.
  `part-000387`, titled `Förhör med Ammouri, HUSSEIN; 2007-04-25 14:10`, sits
  in the `Ammouri, Allia` chain because its body reports a different person.
  That is the other half of R-02 paid off: reading the title would have filed
  it under the wrong subject.
- Charter amendment, recorded in the task: my own Definition of Done asserted
  "the five Hussein Ammouri interviews" with five dates, a count taken from the
  superseded 246-part structure. Measurement finds thirteen body-identified
  interviews, of which those five are instances 2, 8, 10, 12 and 13. The goal
  and the substance of the condition are unchanged; a stale factual count was
  corrected rather than quietly satisfied.
- Discovered while implementing: an `assign` decision left the superseded
  proposal in place, giving a part two memberships that V1 must never create —
  a proposal is a candidate and a decision replaces it outright, while a
  decided membership is only ever demoted. Fixed, and specification §2.2 now
  states it.
- Discovered and deliberately **not** fixed: a short document adjacent to a
  large index block classifies as index, because content character is per part
  and no rule reacts to an index-run transition. The charter forbids changing
  the structure layer, so it is recorded as
  [a backlog proposal](backlog/v2-index-run-part-boundary.md). It is reachable
  but not reached by the real binder, whose contents pages are part-sized.
- Verification: typecheck, format, boundaries and docs (273 files) clean; unit
  828/828, up from 813; conformance 78/78; integration 70/70; scenario 26/26;
  lint clean over `apps packages tests tooling`. The pre-existing lint error in
  the gitignored ACME-0148 scratch file is untouched.
- Handoff: `docs/CURRENT_TASK.md` restored to the template. **The next task is
  not a third offline layer.** Two pure layers exist and the product still has
  no case, no storage and no screen; W-03 makes real infrastructure and real
  navigation a precondition for any POC claim.
- Signature: Claude

## 2026-08-16 — ACME-0150 V2 source structure

- Date: 2026-08-16
- Author: Claude
- Task: ACME-0150
- Change: first V2 layer. `@acme/module-evidence-v2` derives
  `Artifact → SourcePart → CitableUnit` as `evidence-v2-source-structure/1`:
  pure, total, offline, zero dependencies, no persistence, no app, no provider
  call. A `pnpm boundaries` rule plus fixture forbids it from importing the
  frozen application.
- The load-bearing design choice: unique quote binding is an emission
  precondition, not a validation. A unit whose text repeats inside its own line
  range absorbs its predecessor until it binds, and failing that widens to its
  whole line range where uniqueness holds by construction. The frozen pipeline
  discovered the same condition through `DOMAIN_INVALID_RESULT` after the call
  was already paid for.
- Measured over the real 74,469-line `source-A` text: 650 parts, 29,971 citable
  units, **0** non-bindable, 0 diagnostics, largest part 400 lines, 88 ms to
  derive in a single pass, 3 ms for 29,971 lookups, byte-identical on
  re-derivation. The frozen rules produced 259 non-bindable units and left 126
  of 246 parts unanalysable. All 944 dot-leader index lines land inside parts
  classified `index-or-front-matter`. L50796 and L50823 — the `"Kamel"` and
  `"Hussein"` lines that aborted two paid jobs — now yield units spanning the
  page marker instead of bare repeated words.
- Discovered while implementing, both fixed inside the charter because part
  derivation is the deliverable, both now carried by regression tests: index
  rows opened parts, because every contents row starts with `Förhör`, which is
  R-01 in a new shape; and reprinted page headers plus `Förhör påbörjat` /
  `Förhör avslutat` metadata labels opened parts, giving 2,819 parts of which
  933 were three lines or shorter and 357 repeated the previous title. An index
  row references a document rather than opening one, a lexicon header must
  carry a date or case reference, and a reprint of the currently open header is
  not a boundary. 2,819 → 650 parts, 933 → 32 short parts, 357 → 0 repeats.
- A test also caught a real bug in the reprint rule: a header on line 1 never
  initialized the open-header state, so the first reprint still split.
- Verification: typecheck, format, boundaries (including the new
  `v2-frozen-model` fixture) and docs (271 files) clean; unit 813/813, up from
  800; conformance 78/78; integration 70/70; scenario 26/26; lint clean over
  `apps packages tests tooling`. The pre-existing lint error in the gitignored
  ACME-0148 scratch file is unchanged and untouched.
- Not done, deliberately: no chain, no instance, no occurrence, no persistence,
  no surface, no instance source time. The frozen set was not modified.
- Handoff: `docs/CURRENT_TASK.md` restored to the template. Next by dependency
  is `SourcePart → Chain → ChainInstance`, where `instanceSourceTime` comes
  from document body metadata — the other half of R-02.
- Signature: Claude

## 2026-08-16 — ADR-0047 freeze boundary clarified, ACME-0150 frozen

- Date: 2026-08-16
- Author: Claude
- Task: ACME-0150 charter only. No implementation.
- Clarification: ADR-0047 §4 froze "supporting evidence packages" without naming
  them, which contradicted §6's carry-forward of the artifact and authorization
  foundations. §4 now names the boundary exactly. Frozen because they carry the
  replaced model: the three workbench apps, `module-evidence`, `evidence-views`,
  `evidence-product-contracts`, both product adapters and `evidence-testing`.
  Shared infrastructure the new application links against directly:
  `evidence-artifacts` and its adapters, `evidence-auth` and its adapters,
  `live-safety`, the provider and database adapters and `core`. The decision is
  unchanged; the ambiguity was mine and was resolved in favour of what §6
  already implied. Recorded in the ADR itself and mirrored as §10a of the
  specification, where the boundary is a `pnpm boundaries` rule rather than a
  convention.
- ACME-0150 frozen at `Ready`: the V2 source-structure layer,
  `packages/module-evidence-v2` exporting
  `evidence-v2-source-structure/1`. Pure, total, offline, no persistence, no
  app, no provider call, no spend. It retires R-01, R-02, R-03 and the
  package-level half of R-10 as design properties: unique binding becomes an
  emission precondition rather than a validation that fires after spend, index
  and front matter are classified deterministically, and the part title is a
  label with provenance on a type that exposes no date and no title-derived
  identity.
- Done is tied to the material that failed: zero non-bindable emitted units over
  the real 74,469-line `source-A` text, the `"Kamel"` and `"Hussein"` shapes
  bindable or named-refused, and the binder's contents region classified as
  index. The text is not committed; the counts are recorded and three synthetic
  fixtures carry the regression.
- Out of scope is explicit and includes every other V2 object, all extraction
  and comparison, all persistence and surfaces, and any change to the frozen set
  or to shared infrastructure.
- Verification: `node tooling/docs/check-docs.mjs` 270 files; prettier clean;
  `git diff --check` clean. No code changed.
- Handoff: implementation has not started. `docs/CURRENT_TASK.md` holds the
  frozen charter and work may begin against it.
- Signature: Claude

## 2026-08-16 — ACME-0149 legacy diagnostic execution-plan confirmation

- Date: 2026-08-16
- Author: Claude
- Task: ACME-0149
- Change: the frozen workbench's analyze confirmation states the planner's own
  bounded call count instead of `Maximum model calls: 1`. New read-only
  `GET /api/cases/{id}/sources/{artifact}/coverage-plan?part=` returns window
  count, planned calls, emergency ceiling and whether the plan fits. A plan
  above the ceiling is refused in the confirmation rather than started. The
  local startup ceiling becomes an emergency ceiling of 20.
- Why now: the 2026-08-16 run measured jobs spending 4 and 8 calls under a
  confirmation asserting 1. ADR-0047 permits legacy work only where it preserves
  diagnostic value, and an instrument that misreports its own execution does not.
  This regularizes a change made during that run outside any charter.
- Scope discipline: no V2 work, and none of R-01…R-08 or R-10 touched. Segment
  binding, window size, per-window projection, the revision model, part titles,
  stream pagination and structure caching are all left as they are.
- Verification: typecheck, format, boundaries, docs (269 files) clean; unit
  800/800, conformance 78/78, integration 70/70, scenario 26/26; lint clean over
  `apps packages tests tooling`. `pnpm lint` at the repository root still reports
  one pre-existing `no-unused-vars` in the untracked, gitignored ACME-0148
  scratch file `tmp/source-ab-prep/exercise-more.mjs`; CI never lints it and this
  task did not edit it. Manual check against the real 246-part artifact: 4
  planned calls for one part, 1,440 planned and refused for the whole artifact,
  404 for an unknown part. No provider call was made.
- Docs: `CURRENT_STATUS.md` and `SYSTEMDOC.md` synchronized. No ADR changed, no
  structural change, so `FILESTRUCTURE.md` is untouched.
- Handoff: `docs/CURRENT_TASK.md` restored to the template. No legacy work is
  chartered beyond this. The next step is the first V2 implementation task under
  the normative specification.
- Signature: Claude

## 2026-08-16 — ADR-0047 accepted: Evidence application-model reset

- Date: 2026-08-16
- Author: Claude
- Task: none. Governance decision, no implementation.
- Decision: [ADR-0047](adr/0047-evidence-application-model-reset.md) accepted.
  The Evidence application domain model is replaced by `Case`, `Artifact`,
  `SourcePart`, `Chain`, `ChainInstance`, `ObservationOccurrence`, `Claim`,
  `Relation`, `Review`/`Standing`, `ConsensusProjection`. The delivered
  workbench is frozen as a diagnostic reference. Engine, persistence, artifact
  security, authorization, case isolation and the live boundary carry forward
  unchanged. No data authority changes.
- The specification
  [`evidence-workbench-v2-domain-specification.md`](design/evidence-workbench-v2-domain-specification.md)
  is normative, with the five activation decisions taken:
  1. `-v2` package and app names, revisited only when legacy is removed.
  2. Cardinality is `SourcePart 0..N ChainMembership` with one `primary` at a
     case revision. V1 workflow exercises the primary membership only; the
     one-to-one shortcut was rejected so lifting the limit needs no migration.
  3. Chain proposal is deterministic first, model only on the residue, always
     as a candidate.
  4. Consensus is computed per claim; chain and case consensus are aggregates of
     claim-level projections and are not separate objects.
  5. The acceptance harness provisions a clean database, bucket and namespace
     per proof run. The product still carries many cases in one substrate.
- Design notes worth keeping: extraction stays blind and comparison is a
  separate chain-scoped Pass 2 over frozen accepted occurrences, preserving
  ADR-0046 §4 while delivering the longitudinal flow; part titles are demoted to
  labels with their own provenance and instance time comes from document body
  metadata or stays unknown; `insufficient-material` makes "absence of evidence
  is not evidence of absence" a data semantic rather than prompt discipline.
- The ten findings of the preceding run are carried into §9 of the
  specification as binding regression requirements R-01…R-10 plus workflow rules
  W-01…W-03. V1 may not be declared complete while any of them regresses.
- Verification: `node tooling/docs/check-docs.mjs` 269 files; `git diff --check`
  clean. No code changed by this decision.
- Handoff: no implementation is activated. The next step is one explicitly
  approved V2 task with a frozen charter — not a "build V2" container.
- Signature: Claude

## 2026-08-16 — Real-source acceptance run and proposed application-model reset

- Date: 2026-08-16
- Author: Claude
- Task: none. No charter was active; `docs/CURRENT_TASK.md` is the template.
- Run: drove the three intended product journeys against the complete
  1,915-page `source-A` binder on the live Stage A substrate
  (`acme_poc1_ab`, bucket `evidence-private-poc1-ab`). Two live observation
  jobs, 10 provider calls, 38,428 input + 42,350 output tokens. Cost is
  **unknown**: `acme.model_calls` records usage but no price field.
- The case under test was already wedged before this session: engine evidence
  revision 7 against product workspace revision 2 at 14:48, before any call
  made here. It is retained as failure evidence and was not repaired.
- Findings, each verified against code plus durable evidence:
  1. The imported `source-A` was a deliberate 280-page excerpt
     (`tmp/source-ab-prep/source-A.metadata.json`) whose text is the binder's
     table of contents. 911 of 1,436 lines are dot-leader index rows. A prior
     run extracted 41 formally valid observations quoting index lines.
  2. Re-imported complete: 74,469 lines, 3,521,477 bytes, all 1,915 pages
     carry a text layer. Slicing produced 246 parts over 101 distinct titled
     units; one interview spans up to ten parts.
  3. Part title and part body name different documents. Verified on five
     consecutive parts; `part-000169` is titled 2004-11-09 and its body reads
     `Förhörsdatum 2004-11-29`. Line-level provenance stays exact.
  4. 259 of 92,141 structured segments (0.28 %) cannot bind uniquely inside
     their own locator range — degenerate one-word segments such as `"Kamel"`
     and `"Hussein"`. Because one aborts the whole job non-retryably, 126 of
     246 parts (51 %) are unanalysable.
  5. Second job died on `EVIDENCE_COVERAGE_WINDOW_INCOMPLETE` at window 7 of 9
     after 8 calls, one of them a repair.
  6. Projection runs only after whole-job success. The two jobs committed one
     and six windows to the engine and projected nothing.
  7. Product `evidenceRevision` counts imports; engine
     `EvidenceState.evidenceRevision` counts canonical-evidence deltas. Five
     views require equality and the projection guard requires engine ≤ product.
     Confirmed on two substrates: `acme0136` at 3/2, this run at 13/3.
  8. The wedged case answers inconsistently: overview reports 40 pending
     observations, the source stream reports 0 for every part, ledger/claims/
     relations return HTTP 409, timeline returns 200 and empty.
  9. Scale: 279 stream cards over 94,073 px; the event loop blocked up to 64 s
     per window; ~4 min per window wall clock.
- Code, at the user's direct request and outside any charter: the browser
  analyze confirmation no longer asserts `Maximum model calls: 1`. A new
  `GET /api/cases/{id}/sources/{artifact}/coverage-plan` returns the planner's
  own window count, the confirmation states the derived bounded call count, and
  the deployment ceiling becomes an emergency ceiling (20). Verified on a second
  instance: 4 planned for one part, 1,440 planned and refused for a whole
  artifact, 404 for an unknown part. Typecheck and `tsc -b` clean. **Uncommitted
  and unchartered** — it needs either a minimal charter or a revert.
- Docs: proposed [ADR-0047](adr/0047-evidence-application-model-reset.md) and
  drafted
  [the V2 domain specification](design/evidence-workbench-v2-domain-specification.md).
  The findings above are carried into that specification as binding regression
  requirements R-01…R-10 and W-01…W-03 rather than as a defect list.
- Verification: `node tooling/docs/check-docs.mjs` — 269 Markdown files;
  `git diff --check` clean. No test suite was run; no code was changed after the
  typecheck reported above.
- Handoff: ADR-0047 is Proposed and decides nothing yet. Nothing was activated,
  no task was frozen, and the wedged case stands. Next step is the user's
  decision on ADR-0047 and on the five activation questions in §10 of the
  specification.
- Signature: Claude

## 2026-08-16 — ACME-0148 document parts

- Date: 2026-08-16
- Author: Grok
- Task: ACME-0148
- Change: a large import is still one artifact, but the stream now
  lists deterministic parts (förhör / analys / ALL-CAPS / numbered
  titles, otherwise ~2,500-word slices). Opening `?part=` returns only
  that part. Live Analyze accepts `sourcePartId`. “Analyze next part”
  starts the first part with no observations. The model does not choose
  the cuts.
- Why now: opening or analyzing D1/D2 as one document still loaded
  every line and every window.
- Verification: unit 800/800; typecheck, lint and docs clean.
- Handoff: restart the workbench. Analyze one part at a time. Do not
  recut the failed whole-document job.
- Signature: Grok

## 2026-08-16 — ACME-0147 three-mode default shell

- Date: 2026-08-16
- Author: Grok
- Task: ACME-0147
- Change: the workbench primary nav is Source stream, Claim, Stance and
  Search. Default signed-in entry is the source stream. Stance groups
  the review queue by source title and keeps integrity, assessment and
  the legacy type views as secondary. Source review seats observations
  under the block that contains their citation. Legacy `?view=` routes
  remain.
- Why now: ADR-0046's first version is three jobs, not twelve buttons.
  0141 deferred the default-entry switch to this child.
- Verification: unit 799/799; typecheck, lint and docs clean. No
  browser tool was available; shell parse plus local blackbox cover the
  HTML contract.
- Handoff: ADR-0046 first version is complete (0139–0147). Restart the
  workbench to pick up rules/3 and the new shell. Knowledge-time sort
  and same-sentence identity collision remain follow-ups.
- Signature: Grok

## 2026-08-16 — ACME-0146 sentence-level source segments

- Date: 2026-08-16
- Author: Grok
- Task: ACME-0146
- Change: `evidence-source-structure-rules/3` emits one citable segment
  per sentence inside paragraph and Q+A-answer blocks. The question
  half of a Q+A pair stays one segment. Structural windows pack toward
  800 words with the existing 64-segment coverage ceiling. Schema
  `/1` and observe `@1.11.0` stay in place. Historical `@1.10.0`
  request hashes remain byte-exact.
- Why now: 0145 sized blocks, but a block was still one quote. Empty-
  roster exhibit-assertions from the same paragraph were byte-identical
  and Analyze refused the window.
- Verification: unit 799/799; conformance 78; integration 70; scenario 26;
  typecheck, lint, format, boundaries and docs clean.
- Handoff: next child ACME-0147 three-mode default shell. Two
  propositions in one sentence with null actor and null time still
  collapse.
- Signature: Grok

## 2026-08-16 — ACME-0145 oversized source-block split

- Date: 2026-08-16
- Author: Grok
- Task: ACME-0145
- Change: `evidence-source-structure-rules/2` splits oversized paragraph
  units at sentence boundaries toward 150–350 words (soft 600) and never
  splits a sentence or Q+A pair. Structural coverage windows default to
  3 extractable segments; the line-segment window stays 64. Schema
  `evidence-source-structure/1` and active observe `@1.11.0` stay in
  place. Historical `@1.10.0` request hashes remain byte-exact.
- Why now: Live Analyze of D1 refused as `MODEL_INVALID_RESPONSE` after
  0142's merge-only planner left a 16k-word judicial extract as nine
  huge segments. Same-segment null-actor exhibit-assertions then
  collapsed to byte-identical candidates.
- Verification: unit 798/798; conformance 78; integration 70; scenario 26;
  typecheck, lint, format, boundaries and docs clean.
- Handoff: new Analyze uses rules/2. Do not recut the failed D1 job.
  Same-segment identity collision when actor and time are both null
  remains a follow-up.
- Signature: Grok

## 2026-08-16 — ACME-0144 continuity and information exposure

- Date: 2026-08-16
- Author: Claude
- Task: ACME-0144
- Change: active `evidence.relate-observations@1.2.0` output `/2` accepts
  continuity and exposure relation kinds. Historical `@1.1.0` stays
  byte-exact. `changes_certainty` + `prompted_by` can represent X#1
  unknown colour → X#2 maybe red Volvo after a question, without
  deleting X#1. Claim groups list those kinds. No auto-`corroborates`.
- Why now: ADR-0046 Pass 2/3 is a later job over frozen occurrences.
- Verification: unit 795/795; conformance 78; integration 70; scenario 26;
  typecheck, lint, format, boundaries and docs clean.
- Handoff: ADR-0046 children 0139–0144 are implemented. Date-only
  temporal bounds and the 409 views remain separate.
- Signature: Claude

## 2026-08-16 — ACME-0143 claim surface

- Date: 2026-08-16
- Author: Claude
- Task: ACME-0143
- Change: added `evidence-claim-surface-view/1` and `GET /api/claims`.
  Current occurrences group by relation scope or actor thread as unmerged
  0140 cards. `?view=claim` opens the surface; sort is source time or
  asserted event time. Compare-accounts is reachable from a person thread
  that has a correction. No stored merge and no auto-`corroborates`.
- Why now: ADR-0046 names Claim as the comparison job over occurrences.
- Verification: unit 794/794; conformance 78; integration 70; scenario 26;
  typecheck, lint, format, boundaries and docs clean.
- Handoff: next child ACME-0144 continuity and information exposure.
- Signature: Claude

## 2026-08-16 — ACME-0142 source blocks and neighbour context

- Date: 2026-08-16
- Author: Claude
- Task: ACME-0142
- Change: added `evidence-source-structure/1` and active observe
  `@1.11.0` input `/3` output `/6`. New analyzes derive Q+A / paragraph
  blocks from canonical text, pin `sourceStructureId`, and may send
  neighbour context. Semantics refuse a context-only citation.
  Historical `@1.10.0` and line-segment contracts stay byte-exact.
  Source review shows block headings.
- Why now: ADR-0046 requires document-native units and context that is
  not extractable, without recutting committed line-segment windows.
- Verification: unit 793/793; conformance 78; integration 70; scenario 26;
  typecheck, lint, format, boundaries and docs clean.
- Handoff: next child ACME-0143 claim surface.
- Signature: Claude

## 2026-08-16 — ACME-0141 source stream as home

- Date: 2026-08-16
- Author: Claude
- Task: ACME-0141
- Change: `/api/text-imports` sorts by `acquiredAt` then `createdAt` then
  `importId`. Documents is titled Source stream, shows ingest time and
  observation/awaiting coverage, and opens on `?view=stream` as well as
  `?view=documents`. Default entry stays overview.
- Why now: ADR-0046 names the case/source stream as the chronology job.
  Reviewers must walk ingest order and see coverage without opening Ledger.
- Verification: unit 790/790; conformance 78; integration 70; scenario 26;
  typecheck, lint, format, boundaries and docs clean.
- Handoff: next child ACME-0142 deterministic source blocks and neighbour
  context.
- Signature: Claude

## 2026-08-16 — ACME-0140 shared observation card

- Date: 2026-08-16
- Author: Claude
- Task: ACME-0140
- Change: added `evidence-observation-card/1` and
  `buildEvidenceObservationCard`. Source review and the ledger embed the
  same card. The browser renders quote, citation and standing from it.
- Why now: ADR-0046 requires one card so three modes can share identity.
- Verification: unit 788/788; conformance 78; integration 70; scenario 26.
- Handoff: next child ACME-0141 source stream as home.
- Signature: Claude

## 2026-08-16 — ACME-0139 empty-roster Pass 1

- Date: 2026-08-16
- Author: Claude
- Task: ACME-0139
- Change: active `evidence.observe-artifact@1.10.0` requires a null
  actor when the roster is empty and refuses invented unresolved
  candidate keys (`EVIDENCE_ACTOR_REQUIRES_ROSTER`). Historical `@1.9.0`
  stays registered and byte-exact. Output remains `/5`.
- Why now: live 1.9.0 jobs died on `EVIDENCE_ACTOR_CANDIDATES_MISMATCH`
  against Stage A's empty roster. Pass 1 must not invent identities.
- Verification: unit 788/788; conformance 78; integration 70; scenario 26;
  typecheck, lint, format, boundaries and docs clean.
- Handoff: next child ACME-0140 shared observation card. Restart the
  workbench before a new live analyze so it loads `@1.10.0`.
- Signature: Claude

## 2026-08-16 — ADR-0046 source chronology and claim surfaces

- Date: 2026-08-16
- Author: Claude
- Task: none (direction record; no implementation child activated)
- Change: accepted ADR-0046 and
  `docs/design/evidence-workbench-source-and-claim-surfaces.md`. An
  occurrence stays source-bound; comparison is a projection. Segmentation
  follows the document. Observe is Pass 1. The UI is three jobs over one
  card. Delivery is ACME-0139–0144, each stoppable and additive.
- Why now: the dual-graph model was decided after 1.9.0 and the live
  empty-roster refusal. The product definition already named the layers;
  the surface and pipeline did not.
- Verification: docs:check pending with this entry; no code change.
- Handoff: charter ACME-0139 from the surfaces spec when implementation
  should start. Do not pull 0140–0144 into that charter.
- Signature: Claude

## 2026-08-16 — ACME-0138 atomic observation coverage

- Date: 2026-08-16
- Author: Claude
- Task: ACME-0138
- Change: split segment coverage from observation cardinality. Active
  `evidence.observe-artifact@1.9.0` output `/5` requires `segmentCoverage`
  (`observations_extracted` | `no_observation`) for every supplied window
  segment. A segment may yield zero or many atomic observations. The
  prompt forbids invented coverage observations, extraction-time dedup
  and promoting reported speech to a world fact. Incomplete or relative
  time stays in `temporalBound.reason` when normalization is `unknown`.
  `@1.8.0` remains registered and byte-exact. The per-call observation
  ceiling for `1.9.0` is 128; the window size stays 64.
- Why now: `1.8.0` said "exactly one observation per segment", which
  forced compression of multi-proposition lines and invented observations
  for headings.
- Verification: unit 787/787; conformance 78; integration 70; scenario 26;
  typecheck, lint, format, boundaries, docs and build clean.
- Live/data handling: none. The running workbench process still serves
  the previous build until restarted.
- Handoff: restart the workbench before a new live analysis. Date-only
  temporal bounds and the 409 views remain separate.
- Signature: Claude

## 2026-08-16 — ACME-0137 full-source observation coverage

- Date: 2026-08-16
- Author: Claude
- Task: ACME-0137
- Change: implemented ADR-0045 §6. `planEvidenceObservationCoverage` splits
  a source into non-overlapping windows of at most 64 segments. Active
  `evidence.observe-artifact@1.8.0` takes input `/2` with a unique
  `coverageWindow`; the provider sees only those segments. Semantics refuse
  a window that omits a supplied segment or names one outside it. Two
  distinct observations of the same supplied segment remain valid. The live
  observation job iterates windows as separate executions under
  `live-observe:{commandKey}:wNNNNN`, reports window *i* of *n*, and records
  unbounded accumulated model calls. Offline seed/import attaches the
  fixture window so scripted hashes stay pinned. Historical `@1.0.0`–
  `@1.7.0` stay registered.
- Why now: ACME-0136 produced 24 observations from source-B because the
  1.7.0 prompt asked for a non-exhaustive 1–64 sample. Coverage is a
  workflow, not a larger array.
- Verification: unit 786/786; conformance 78; integration 70; scenario 26;
  typecheck, lint, format, boundaries, docs and build clean.
- Live/data handling: none. No provider call and no new acceptance run.
- Handoff: date-only temporal bounds, the remaining 409 revision mismatch
  on read views, and a later live acceptance are separate tasks.
- Signature: Claude

## 2026-08-16 — ACME-0136 POC #1 outcome-blind acceptance

- Date: 2026-08-16
- Author: Claude
- Task: ACME-0136
- Change: ran the second outcome-blind acceptance on a fresh case. source-A
  imported (3,521,477 canonical bytes). source-B observation produced 24
  accepted fragments. Relation and assessment each consumed a recorded
  repair call and still failed. source-A observation failed
  `INVALID_REQUEST`. Ledger, relations and open-question views answered
  409. Frozen result: FAIL.
- Mid-run defect: a first probe on the shared volume collided because two
  imports put the product revision ahead of the engine. The worker guard
  now refuses only when the engine is ahead. The acceptance case was
  created on an isolated database after that fix.
- Cost: 6 calls, 5/6 reporting usage, 94,064 input + 13,861 output tokens,
  provider cost unknown.
- Live/data handling: two operator-supplied PDFs were extracted outside
  ACME and imported as text. No source content entered Git. The sealed
  judgment was opened only after freeze.
- Handoff: ADR-0045 §6, date-only temporal bounds, the remaining 409
  revision mismatch on read views, and source-A live analysis.
- Signature: Claude

## 2026-08-16 — ACME-0135 bounded repair call

- Date: 2026-08-16
- Author: Claude
- Task: ACME-0135
- Change: implemented ADR-0045 §5. `resolveExecutionPolicy` admits a
  non-negative `maxRepairCalls` while still requiring one primary call and
  zero revision calls. The execution engine issues each repair as its own
  recorded model call (`purpose: repair`, call key `repair:N`) when the
  pipeline classifies a failure `repairable`, the contract offers
  `buildRepairRequest`, and budget remains. The three live Evidence contracts
  append the pipeline issues to the original request without changing the
  primary request hash. Live observation, relation and assessment jobs now
  set `maxRepairCalls: 1` and the provider gateway ceiling is two. Job and
  audit `actualModelCalls` admit 0–2; the worker records the numeric count
  instead of collapsing it to a boolean.
- Why now: ACME-0133 paid for a relation response that failed semantic
  validation as `repairable: true` and discarded it, which removed the
  assessment and the run's domain result. The policy already declared the
  budget; nothing consumed it.
- Repair never fires on the ADR-0017 resume path. A recorded primary
  response is completed from evidence; the provider is not contacted again.
- Verification: unit 779/779; conformance 78; integration 69; scenario 26;
  typecheck, lint, format, boundaries, docs and build clean. Focused gates
  cover success-within-budget, exhaustion, non-repairable and resume. The
  PostgreSQL journey was skipped: Docker daemon was not running and no
  isolated `ACME_POSTGRES_*` was in the process environment.
- Live/data handling: no provider call was made and no source content entered
  Git.
- Handoff: activate the POC #1 outcome-blind acceptance run on a fresh case.
  Date-only temporal bounds and ADR-0045 §6 remain follow-ups. Re-run
  `pnpm test:postgres` when Docker is available.
- Signature: Claude

## 2026-08-16 — ACME-0134 real-material scale

- Date: 2026-08-16
- Author: Claude
- Task: ACME-0134
- Change: implemented ADR-0045 sections 2, 3 and 4. Active observation contract
  `evidence.observe-artifact@1.7.0` raises the candidate ceiling from the
  fixture-sized eight to a response-derived 64, in both prompt and schema.
  Canonical text bounds rise from 2,097,152 bytes and 20,000 lines to
  16,777,216 bytes and 400,000 lines, with the request body from 2,200,000 to
  25,000,000. The live assessment no longer requires at least one relation.
- Why now: ACME-0133 showed the model returned exactly eight candidates from a
  100-page report because a ninth was forbidden, that a 1,915-page document was
  refused outright, and that one refused relation removed the product's end
  deliverable. None of those were defects; they were the product's own bounds,
  calibrated against a seven-artifact synthetic corpus.
- Replay: `1.0.0` through `1.6.0` keep the eight-candidate ceiling and their own
  schemas, and `1.6.0` is now registered historically as
  `evidenceObserveArtifactContractV7`. The active request hash moved from
  `f86982f1…` to `9d0fa2b9…`, as expected for a new version. Six scripted
  fixture hashes were recomputed against `1.7.0` rather than hand-edited, and
  the integration resume gate now derives its hash from the fixture constant.
- Blast radius: changing the active contract moved every scripted fixture that
  pins its request hash. Seventeen gates failed at first and every one traced to
  that single cause. The charter had assumed a contained constant change.
- Verification: unit 768/768 across 121 files; conformance 78; integration 62;
  scenario 26; typecheck, lint, boundaries, build, format, docs and diff clean;
  `pnpm test:postgres` 37/37 on a disposable `postgres:15` created and removed
  for this task.
- Not delivered: the assessment-without-relations gate. The change is one
  condition, covered by typecheck and the ADR, but the live assessment path has
  no offline seam exercisable without a provider transport. The decoupling is
  verified by inspection only, and that Definition-of-Done item was not met.
- Live/data handling: no provider call was made and no source content entered
  Git.
- Handoff: ADR-0045 §5 repair calls in the execution engine plus non-zero repair
  budgets in the live jobs. Then ADR-0045 §6, the full-source coverage
  workflow, which is what actually turns a bounded batch into document
  coverage.
- Signature: Claude

## 2026-08-16 — ACME-0132 measured cost and optional campaign ceiling

- Date: 2026-08-16
- Author: Claude
- Task: ACME-0132
- Change: implemented ADR-0044's execution policy. The deployment call ceiling
  is no longer a precondition for the live capability: absent now means the
  deployment declines to cap the campaign, and `assertLiveDeploymentBudget`
  validates it on its own. Per-execution bounding is untouched, so a run that
  exceeds its confirmation is still refused and "this job made exactly one
  call" stays auditable.
- Discovery that shaped the task: `acme.model_calls` reserved `model`,
  `provider` and `usage_json` columns and every row had all three `NULL`.
  `applyModelCallRetention` returned only the response hash and, under
  `encrypted-payload`, the sealed envelope, so provider, model and usage were
  dropped in every retention mode. Measurement over that table was impossible,
  and the token counts in earlier entries came from reading responses in
  flight rather than from durable evidence. Removing the cap without landing
  the measurement in the same change is refused by ADR-0044's own risk clause.
- Retention now keeps `callMetadata` — provider, model, finish reason and usage
  — under every mode including `none` and `hash-only`. It is operational
  metadata, never output: gates assert the response text never appears in the
  retained fields, and that `response_payload` stays `NULL` under `hash-only`
  while the three columns become queryable.
- Added `summarizeModelCallUsage`: a pure summary over recorded calls with
  counts, token totals and provider-supplied cost. Absent usage reads as
  `null`, never `0`, `callsReportingUsage` says how much of a set the totals
  cover, and costs in differing currencies are refused rather than converted.
  No pricing table: an estimate must not be reported as evidence.
- Verification tiers are documented in `docs/CONTRIBUTING.md`. Only a POC
  acceptance run may claim POC #1 works; ACME-0131 is the standing example of
  a green offline suite over a product that mutated state in the wrong order.
- Verification: unit 768/768 across 121 files, up from 759/120; conformance 78,
  integration 62, scenario 26; typecheck, lint, boundaries, build, format, docs
  and diff clean; `pnpm test:postgres` 37/37 on a disposable `postgres:15`
  created and removed for this task. The shared execution-repository
  conformance kit runs against PostgreSQL too, so all three adapters are proven
  by one gate. A composition with no ceiling environment variables resolves and
  reports `liveObservationMaxModelCalls: null`, where it previously refused.
- Live/data handling: no provider call was made and no source content entered
  Git. The seven calls already recorded predate this change and carry no
  metadata; they cannot be measured retroactively.
- Handoff: activate
  [poc1-live-product-acceptance.md](backlog/poc1-live-product-acceptance.md) on
  a fresh case. `summarizeModelCallUsage` has no operator surface yet; a CLI or
  API report over it would make cost readable without a database client.
- Signature: Claude

## 2026-08-16 — ACME-0131 live path projection, scoping and session

- Date: 2026-08-16
- Author: Claude
- Task: ACME-0131
- Change: repaired the five defects the first sustained real browser session
  exposed, all of them invisible to the offline suite. The worker now runs the
  revision guard before any product write, so a refused projection leaves no
  observations behind. The live observation job selects only the executing
  run's records through `selectExecutionObservations`, instead of every ledger
  record matching the artifact. The evidence projection resolves the requested
  workspace instead of the globally latest snapshot. `/api/overview`,
  `/api/integrity-report` and `GET /api/export-policy` resolve the requested
  case instead of the composition default. The development authenticator
  grants an upstream lifetime per sign-in and per refresh instead of one fixed
  expiry for the whole process.
- Isolation: three of the five were case-scoped reads resolving the
  composition default. The revision guard and the `404` were masking them; had
  either passed, one case's content would have rendered under another case's
  heading. ADR-0036 isolation is now enforced by the read path itself.
- Amendment: the overview/integrity-report/export-policy defect was added to
  the frozen charter after discovery, recorded in its Charter Amendment Log as
  in-goal rather than opened as a separate task.
- Gates: every gate is load-bearing. Each fix was reverted individually,
  rebuilt and re-run, and exactly its own gate failed with the original
  symptom before being restored to green.
- Verification: unit 759/759 across 120 files, up from 753/118; conformance 78,
  integration 62, scenario 26; typecheck, lint, boundaries, build, format, docs
  and diff clean; `pnpm test:postgres` 36/36 on a disposable `postgres:15`
  created and removed for this task. On the running instance against real
  PostgreSQL and MinIO, every case view for a real case answers `200`, where
  four answered `409` and three answered `404` before.
- Live/data handling: no provider call was made and no source content entered
  Git. The `POC1-AUTO-UI` case stays wedged: its engine and product revisions
  genuinely diverged, and these fixes stop new divergence rather than
  rewriting recorded history. The acceptance run needs a fresh case.
- Handoff: implement ADR-0044's retirement of the deployment call ceiling and
  cost ceiling plus the three-tier suite separation, then activate
  [poc1-live-product-acceptance.md](backlog/poc1-live-product-acceptance.md).
  `GET /api/assessments` does not exist and the browser requests it; it should
  either exist or stop being requested.
- Signature: Claude

## 2026-08-15 — ACME-0129 superseded; POC #1 enters live product acceptance

- Date: 2026-08-15
- Author: Claude
- Task: ACME-0129 (Superseded) → ACME-0131 (Ready)
- Decision: the premise of ACME-0129 is spent. It was frozen to prove live
  execution could happen safely without uncontrolled spend; ACME-0111 through
  ACME-0122 answered that, and ACME-0121 committed real source-bound
  observations from a real call. What remained — six calls total, one shot,
  never retry, no correction after a consumed call — was phase apparatus, and
  keeping it meant testing an artificially handicapped variant of the product
  rather than the product.
- Phase change: [ADR-0044](adr/0044-poc1-live-product-acceptance-phase.md)
  (Proposed) separates permanent guardrails from retired phase controls.
  Retained: schema validation, fail-closed refusal, revision/integrity guards,
  transactional mutation, idempotency, case isolation, audit trail,
  provider-call logging and cost measurement, plus ADR-0040's invariants and
  its conjunctive live tuple. Retired: the deployment call ceiling and cost
  ceiling as preconditions, campaign-level call caps, and mock/in-memory
  substrate as acceptable basis for a POC claim. Bounding one execution stays;
  capping a campaign goes. Cost is governed by measurement over
  `acme.model_calls`, not by refusal at a threshold.
- Verification tiers: offline deterministic (mock, continuous, gates CI), live
  integration (real PostgreSQL and object store, real provider), and POC
  acceptance (real document through the whole product path). Only the third
  may claim POC #1 works.
- Findings that forced the change: the first sustained real browser session
  wedged the product at evidence revision 2 against engine revision 5, and
  exposed the worker writing observations before the guard that rejects the
  projection, the observation job collecting by artifact rather than by
  execution, and every session expiring fifteen minutes after process start
  rather than after sign-in. Product state at discovery: 35 observations, one
  `LIVE_OBSERVATION_COMPLETED`, two `MODEL_INVALID_RESPONSE`, four
  `EVIDENCE_PRODUCT_COMMAND_COLLISION`.
- Live/data handling: seven provider calls are recorded in `acme.model_calls`,
  all made through the browser outside any charter. No call was made under
  ACME-0129 and none was made by this documentation change. No source content
  entered Git.
- Handoff: ACME-0131 repairs the four defects offline. ADR-0044 needs explicit
  acceptance before its retirement clauses are implemented. The acceptance run
  is proposed in
  [poc1-live-product-acceptance.md](backlog/poc1-live-product-acceptance.md)
  and needs a fresh case; `POC1-AUTO-UI` is wedged and is not valid substrate.
- Signature: Claude

## 2026-08-15 — ACME-0130 case catalog request scoping

- Date: 2026-08-15
- Author: Claude
- Task: ACME-0130
- Change: corrective. `casePath` in the browser shell exempted the case catalog
  by comparing the whole argument, query string included, against
  `/api/cases`. The real call is `/api/cases?organizationId=…`, so the
  exemption missed and the request was rewritten to
  `/api/cases/<caseId>/cases?organizationId=…`. The exemption now matches
  `URL.pathname`. No product behavior, contract, persistence or data authority
  changed.
- Impact: every authenticated session ended at that `404`. The case selector
  stayed empty, the review queue never left `Loading…`, and a Stage A case
  could be created but never opened, because creation posts to the separately
  exempted `/api/organizations/:id/cases`.
- Provenance: the defect entered with `9037ca1` (ACME-0093) and survived
  ACME-0101's parse gate, which compiles the emitted module without exercising
  the URLs it builds. The catalog is the only exempt shell request carrying a
  query string; every other request was already correct.
- Launcher: `startup-full_poc1-autoimport.ps1` now starts Node directly instead
  of through `cmd.exe`/corepack/pnpm, so the recorded PID owns the port, and
  passes `--env-file-if-exists=.env.local`, so the ignored credential file
  reaches only the workbench process and the interactive prompt is a fallback.
  A stale process previously survived a restart and the script's own
  "already answering" guard then exited `0` with the old environment.
- Verification: web and API suites 23/23; typecheck, lint, boundaries, build,
  format, docs and diff checks passed; conformance 78, integration 62 and
  scenario 26 passed; browser-observed `200` for the catalog, a case switch and
  the Stage A Documents view. `pnpm test:unit` reported 752/753: `auth-blackbox`
  exceeds its 5,000 ms bound under full-suite parallelism on a loaded machine
  and passes in 566 ms alone. The identical failure reproduces with this
  change stashed and rebuilt, so it is pre-existing and belongs to its own
  charter.
- Live/data handling: no provider call occurred, no source content entered Git
  and the Stage A import form was left unsubmitted; its attestations are
  operator statements.
- Handoff: ACME-0129 remains the frozen active task, untouched by this work.
  A shell request-path gate remains an open follow-up.
- Signature: Claude

## 2026-08-15 — ACME-0128 sorted assessment provider output

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0128
- Change: identified the assessment contract's analogous schema/prompt gap
  before another paid run, then activated
  `evidence.propose-assessment@1.2.0` with explicit unique lexicographically
  sorted set-like string-ID arrays. Output `/1`, semantics and identities are
  unchanged; runtime coercion remains forbidden.
- Replay identity: historical `@1.0.0` request hash is
  `2532333356e475a2caa405aaa5eda3867e9682049262f9156590891dd6fd49a0`;
  historical `@1.1.0` remains
  `a7504dcf2ff5d33578688e9f73d2b3b76e21a7007d22460e094526d047e51c90`;
  active `@1.2.0` is
  `c4e140c6742d06ab038f87fd323eccc81d96fa52bcde85d5f5bf37a2c342fb48`.
- Verification: focused contract/hash/replay/registry/composition tests 17/17;
  typecheck, lint, boundaries and build passed; full default suites passed 753
  unit, 78 conformance, 62 integration and 26 scenario tests; a fresh
  disposable PostgreSQL 16 passed 36/36 and was removed; format, docs and diff
  checks passed.
- Live/data handling: no credential was loaded and no provider call occurred.
- Handoff: archive ACME-0128, then freeze a separately bounded two-source live
  reviewer/reassessment journey.
- Signature: Codex

## 2026-08-15 — ACME-0127 sorted relation provider output

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0127
- Change: activated `evidence.relate-observations@1.1.0` with explicit unique,
  lexicographically sorted set-like identifier/rationale arrays and distinct
  endpoints sorted by kind then id. Historical `@1.0.0` remains registered
  byte-exact for replay; runtime coercion remains forbidden.
- Identity: active request hash is
  `1f49ca0835d94ab9236ea5a53aa1650f07a53454c94aacf94f16ccbac1b89f4f`;
  historical `@1.0.0` remains
  `9c4f7a883a6363d0a652f5d90e603e610d5969715069079ed1fdd5c3516815b0`.
- Verification: focused contract/catalogue/hash/replay/composition tests 15/15;
  typecheck, lint, boundaries and build passed; full default suites passed 752
  unit, 78 conformance, 62 integration and 26 scenario tests; fresh PostgreSQL
  passed 36/36; format, docs and diff checks passed.
- Live/data handling: no credential was loaded and no provider call occurred.
- Handoff: archive ACME-0127 and inspect the assessment prompt for the same
  schema/prompt ordering dependency before freezing another bounded live run.
- Signature: Codex

## 2026-08-15 — ACME-0126 superseded at relation schema boundary

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0126
- Progress: D1 observation committed eight source-bound observations and the
  authenticated reviewer wrote six accepts, one rejection and one unresolved
  decision. The next real relation call returned complete output `/1` with
  eight propositions, four relations and three open questions.
- Refusal: two `triggeringObservationIds` arrays were unique but not lexical-
  sorted. Strict schema validation emitted two `MODEL_RESPONSE_SCHEMA` issues;
  zero relations/questions/assessments projected. Active relation prompt
  `@1.0.0` does not state the schema's sorted-set wire requirement.
- Usage: observation 66,819 + 708 = 67,527 tokens; relation 2,925 + 2,990 =
  5,915. Two of six calls occurred; four never started and no retry occurred.
- Safety: all containers/network/temp keys and D1/D2 text were removed. Both
  PDFs and ignored `.env.local` are unchanged; no sensitive content entered Git.
- Follow-up: version the relation prompt offline with explicit unique lexical
  sorting for every set-like ID array, preserve historical replay, verify, then
  freeze a separate live journey.
- Signature: Codex

## 2026-08-15 — ACME-0125 typed source-view observation identity

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0125
- Change: removed the live journey's handwritten source-view response type,
  imported `EvidencePrimarySourceReviewView` and changed all observation
  review/history targets to the public `observationVersionId` field. Product
  API/view/runtime behavior is unchanged.
- Verification: focused typecheck, lint, format, static identity search and
  closed live gate; boundaries/build; 751 unit, 78 conformance, 62 integration
  and 26 scenario tests; format, docs and diff.
- Safety/follow-up: no source, credential or provider call occurred. Freeze a
  new bounded Stage A live journey only from this green checkpoint.
- Signature: Codex

## 2026-08-15 — ACME-0124 superseded after source-view mismatch

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0124
- Preflight: D1/D2 parent and LF/NFC extraction hashes reproduced exactly;
  fresh empty PostgreSQL, private MinIO, random mounted keys and signed S3
  create/stat/read/list/delete passed.
- Provider outcome: the first D1 observation job stopped normally at 66,818
  input plus 491 output tokens. Eight output `/4` segment identifiers were
  supplied, valid and unique; runtime derived eight exact quotes/locators and
  committed one execution/document/commit plus eight observations.
- Stop: the first reviewer POST supplied an undefined target because the new
  harness expected `observationId` from a public source view that exposes
  `observationVersionId`. The API refused 400. Zero review decisions, relations
  or assessments wrote; five planned jobs never started.
- Safety: no retry. Exact containers, network, D1/D2 temporary text and four
  key/credential files were removed. Both PDFs and ignored `.env.local` are
  unchanged; no source, secret or provider identifier entered Git.
- Disposition: superseded rather than weakening its one-shot charter. Correct
  the single view-contract field offline, run canonical gates and only then
  freeze another bounded live journey.
- Signature: Codex

## 2026-08-15 — ACME-0123 Stage A live reviewer harness

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0123
- Change: added one opt-in live product gate over two exact external Stage A
  inputs. It drives D1 observation/review/relation/question/assessment, process
  restart, D2 observation/review/relation/reassessment and final restart using
  authenticated case-first APIs, PostgreSQL, private S3 and mounted keys.
- Product assertions: accept/reject/leave-unresolved decisions; exact source
  citations; relations and open questions; citation-complete reviewed first
  assessment; immutable stale predecessor after later evidence; reviewed
  successor; persistent history; primary domain navigation without technical
  audit. Six executions each request one call maximum and a nested minor-SEK
  ceiling.
- Verification: live gate compiles and skips closed; 15 focused safety tests;
  fresh PostgreSQL journey 2/2; typecheck, lint, boundaries, build; 751 unit,
  78 conformance, 62 integration and 26 scenario tests; format, docs and diff.
  Lint caught one local non-null assertion, corrected before canonical gates.
- Safety/follow-up: no source, credential or provider call occurred. Freeze a
  separate bounded paid acceptance before supplying D1/D2 inputs.
- Signature: Codex

## 2026-08-15 — ACME-0121 product success, process charter superseded

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0121
- Outcome: the sole active `evidence.observe-artifact@1.6.0` call stopped
  normally at 66,819 input plus 650 output tokens. All eight output `/4`
  segment selections were supplied, valid and unique. Strict/semantic
  validation passed; runtime derived all eight exact quotes and one-line
  locators and durably wrote one committed execution, document and commit plus
  eight observations.
- Harness disposition: the product returned its established
  `LIVE_OBSERVATION_COMPLETED` result. Vitest alone exited false on an obsolete
  post-commit expected reason; offline child ACME-0122 corrected that assertion
  and passed focused PostgreSQL plus every canonical gate without a provider
  call.
- Status: bounded product observation acceptance is proven. ACME-0121 is
  nevertheless superseded because its frozen primary deliverable required a
  recorded green Vitest invocation and its one allowed call was consumed; the
  charter is not rewritten after the fact.
- Safety: no retry. Exact PostgreSQL/MinIO containers, network, temporary
  source and key files were removed. Original PDF and ignored `.env.local` are
  unchanged; no source content, secret or provider identifier entered Git.
- Follow-up: separately freeze remaining relation/assessment provider
  acceptance and the primary reviewer journey; exhaustive coverage remains a
  distinct workflow problem.
- Signature: Codex

## 2026-08-15 — ACME-0122 terminal-code assertion correction

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0122 (child of ACME-0121)
- Change: replaced the stale live-gate expectation
  `LIVE_OBSERVATION_COMMITTED` with the worker's established
  `LIVE_OBSERVATION_COMPLETED` and pinned the same reason in the existing
  successful offline PostgreSQL Stage A journey. Worker behavior is unchanged.
- Verification: focused fresh PostgreSQL 2/2; typecheck, lint, boundaries,
  build; 751 unit, 78 conformance, 62 integration and 26 scenario tests;
  format, docs and diff. Two unrelated initial blackbox timeouts passed
  isolated 6/6 and on the exact full rerun 751/751.
- Safety: no credential, source or provider/network call was used. The child is
  archived and ACME-0121 restored for honest disposition of its consumed
  process-level gate.
- Signature: Codex

## 2026-08-15 — ACME-0121 paused for terminal-code child

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0121 / ACME-0122
- Evidence: the sole bounded provider call stopped normally with 66,819 input
  and 650 output tokens. All eight output `/4` segment selections were valid,
  supplied and unique; runtime derived eight exact quotes/one-line locators and
  durably wrote one committed execution, document and commit plus eight
  observations.
- Blocker: after the product job returned its established
  `LIVE_OBSERVATION_COMPLETED` reason, the live Vitest gate alone failed because
  it still expected obsolete `LIVE_OBSERVATION_COMMITTED`.
- Disposition: no retry. ACME-0121 is paused with disposable state isolated;
  bounded offline child ACME-0122 will align the assertion, verify it without
  any provider access, then resume the parent for cleanup and completion.
- Signature: Codex

## 2026-08-15 — ACME-0120 canonical UTC observation prompt

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0120
- Summary: Versioned active `evidence.observe-artifact@1.6.0` without changing
  output `/4` or ADR-0043 segment authority. The prompt now requires literal
  `YYYY-MM-DDTHH:MM:SSZ` or three-digit millisecond UTC, forbids local,
  minute-only and numeric-offset normalized values, and requires `unknown`.
- Replay: historical `@1.5.0` request hash remains exact and all seven versions
  resolve. Active development/evaluation hashes were re-pinned; observation
  identities remain unchanged.
- Verification: focused 23; typecheck, lint, boundaries, build; 751 unit, 78
  conformance, 62 integration, 26 scenario; fresh PostgreSQL 36; format, docs
  and diff. One known async teardown and one transient parallel PostgreSQL
  fixture failure passed isolated and on exact clean full reruns.
- Safety/follow-up: no provider call/source/credential access. Freeze a
  separate one-call acceptance under the approved 200 SEK ceiling.
- Signature: Codex

## 2026-08-15 — ACME-0119 superseded after temporal-format refusal

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0119
- Summary: Ran one separately frozen Stage A call against active
  `evidence.observe-artifact@1.5.0` under the approved ACME credential and 200
  SEK prepaid ceiling. Exactly one provider call occurred.
- Preflight reproduced the unchanged parent/extraction hashes and passed clean
  PostgreSQL, private MinIO, random mounted keys and signed S3 operations.
- Provider result: stop, 66,775 input + 1,533 output = 68,308 total tokens;
  eight output `/4` candidates. Every selected segment ID was valid, supplied,
  existing and unique. Seven temporal bounds were `unknown`.
- Refusal: candidate seven emitted `exact.at` as a 16-character local
  date/time containing `T` but no seconds, UTC offset or terminal `Z`. Strict
  schema validation emitted one `MODEL_RESPONSE_SCHEMA` issue. One encrypted
  model call succeeded; zero engine documents, commits and observations wrote.
- Safety: no retry/repair. Containers, network and exact temporary source,
  credential and key state were removed; original PDF and ignored `.env.local`
  are unchanged.
- Disposition: segment quote authority held. This one-shot task is consumed;
  version the prompt offline with literal canonical UTC seconds/`Z` grammar and
  an `unknown` fallback before another acceptance.
- Verification: content-free encrypted-response metadata and persistence
  assertions; `pnpm docs:check`; `git diff --check`.
- Signature: Codex

## 2026-08-15 — ACME-0118 runtime-derived observation quotes

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0118
- Decision: ADR-0043 removes exact-quote authorship from the active provider
  contract. Active `evidence.observe-artifact@1.5.0` output `/4` selects one
  runtime-defined `sourceSegmentId`; runtime derives the entire exact quote and
  its one-line locator.
- Segmentation: canonical LF/NFC text becomes deterministic non-empty segments
  that never cross a line and contain at most 500 Unicode code points. Long
  lines split without normalization. Unknown identifiers refuse; duplicate
  source text remains unambiguous because segment identity carries its line.
- Replay/identity: `@1.0.0` through `@1.4.0` and outputs `/1` through `/3`
  remain registered with unchanged pinned request hashes. Active development
  and evaluation fixtures select segments, while runtime-derived quote,
  locator and resulting synthetic observation identities remain unchanged.
- Verification: focused segment/contract/schema/replay/fixture/engine/live-job
  suite 34 tests; `pnpm typecheck`; `pnpm lint`; `pnpm boundaries`; exact
  `pnpm test` — 751 unit, 78 conformance, 62 integration and 26 scenario;
  `pnpm test:postgres` — 36 tests against a fresh disposable PostgreSQL 16
  container; `pnpm build`; `pnpm format:check`; `pnpm docs:check` — 228
  Markdown files; `git diff --check`.
- Correction during verification: the first full unit run used stale built
  fixture hashes after source hashes were re-pinned. Rebuilding package outputs
  synchronized package consumers; focused failures and the exact full suite
  then passed. No behavior was weakened.
- Safety/follow-up: no provider call, real source or credential was accessed.
  Freeze a separate one-call acceptance against active `@1.5.0` under the
  approved 200 SEK monetary ceiling; a valid batch remains non-exhaustive.
- Signature: Codex

## 2026-08-15 — ACME-0117 superseded after exact-quote refusal

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0117
- Summary: Ran one separately frozen Stage A provider gate against active
  `evidence.observe-artifact@1.4.0` under the user-approved ACME credential and
  200 SEK prepaid monetary ceiling. Exactly one provider call occurred.
- Preflight: the unchanged 106,907-byte, 52-page parent PDF retained SHA-256
  `f271fb518b31f6f6ff0ae80b740c078f383b3d44dbdceea43a5ca216c3920fd4`;
  pypdf 6.10.0 reproduced the 106,072-byte LF/NFC UTF-8 representation SHA-256
  `2a2dccd63566dcd6a96347a486088238ab62cad8d83e7b9e943f636511848bb4`.
  Clean PostgreSQL/MinIO and random mounted keys passed empty-database and
  signed S3 create/stat/read/list/delete checks.
- Provider result: `gpt-5.6-luna` returned stop, 36,920 input + 1,633 output =
  38,553 total tokens and eight complete strict output `/3` candidates. Two
  temporal bounds were `unknown`; no invalid normalized temporal value recurred.
- Refusal: only three quotes occurred exactly once. Four other candidates
  compressed content across canonical line boundaries while changing
  whitespace and/or punctuation, and one also changed alphanumeric content.
  Semantic validation emitted five `EVIDENCE_QUOTE_NOT_FOUND` issues. The
  encrypted model call succeeded, while zero engine documents, execution
  commits and product observations were written.
- Safety: no retry or repair ran. Both containers, their network and the exact
  source/credential/key temp directory were removed; original PDF and ignored
  `.env.local` are unchanged. No source, key, payload or provider identifier
  entered the repository.
- Disposition: this one-call charter is consumed and superseded. A wire-level
  one-line string does not prove canonical line membership. The next offline
  task must decide an additive segment-selection/runtime-derived-quote contract
  or an equivalently strict design while retaining historical replay.
- Verification: content-free PostgreSQL call/error/commit/observation checks;
  encrypted-response metadata audit; `pnpm docs:check`; `git diff --check`.
- Signature: Codex

## 2026-08-15 — ACME-0116 single-line observation candidates

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0116
- Summary: Corrected both bounded provider-shape defects exposed by ACME-0115.
  Active `evidence.observe-artifact@1.4.0` now emits output
  `evidence-observe-artifact-output/3`; each exact quote must be one canonical
  source line and no more than 500 characters.
- Temporal boundary: the active prompt permits exact, range or approximate
  normalized time only when the same exact quote contains a complete calendar
  date and clock. A clock without that date must be `unknown`; the existing
  strict UTC ISO schema remains unchanged for normalized values.
- Replay: historical contracts `@1.0.0` through `@1.3.0` and outputs `/1`
  through `/2` remain registered and byte-exact. Their pinned request hashes
  are unchanged. Active synthetic locators and observation identities also
  remain unchanged because runtime exact-match locator derivation was not
  altered.
- Verification: focused contract/schema/wire/replay/fixture/engine/live-job
  suite 34 tests; `pnpm typecheck`; `pnpm lint`; `pnpm boundaries`; exact
  `pnpm test` — 751 unit, 78 conformance, 62 integration and 26 scenario;
  `pnpm test:postgres` — 36 tests against a fresh disposable PostgreSQL 16
  container; `pnpm build`; `pnpm format:check`; `pnpm docs:check` — 225
  Markdown files; `git diff --check`. The container was removed.
- Safety/follow-up: this task made no provider call and accessed neither the
  real source nor credentials. Freeze a separate one-call acceptance against
  active `@1.4.0` under the already approved 200 SEK monetary ceiling; token
  usage remains a separate measured quantity.
- Signature: Codex

## 2026-08-15 — ACME-0115 superseded after temporal schema refusal

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0115
- Summary: Ran one separately frozen Stage A provider gate against active
  `evidence.observe-artifact@1.3.0` under the user-approved ACME credential and
  200 SEK prepaid monetary ceiling. Exactly one provider call occurred.
- Preflight: the unchanged 106,907-byte, 52-page parent PDF retained SHA-256
  `f271fb518b31f6f6ff0ae80b740c078f383b3d44dbdceea43a5ca216c3920fd4`;
  pypdf 6.10.0 reproduced the 106,072-byte LF/NFC UTF-8 representation SHA-256
  `2a2dccd63566dcd6a96347a486088238ab62cad8d83e7b9e943f636511848bb4`.
  Clean PostgreSQL/MinIO and random mounted keys passed empty-database and
  signed S3 create/stat/read/delete checks.
- Provider result: `gpt-5.6-luna` returned stop, 36,871 input + 2,266 output =
  39,137 total tokens and six complete strict-JSON candidates.
- Refusal: candidate six supplied a range with two eight-character clock
  strings visible in its quote but no complete date, `T` or `Z`; output `/2`
  requires full UTC ISO values. Strict schema validation emitted two
  `MODEL_RESPONSE_SCHEMA` issues before semantic locator validation. Four
  quotes were exact/unique; two long multi-line candidates preserved text only
  after whitespace normalization and were not treated as exact.
- Safety: the execution stored one encrypted succeeded model call but zero
  engine documents and zero product observations. No retry/repair ran. Both
  `--rm` containers, their network and the exact source/key/credential temp
  directory were removed; original PDF and ignored `.env.local` are unchanged.
- Disposition: this one-call charter is consumed and superseded. The next
  offline contract must require short single-line verbatim quotes and require
  temporal `unknown` unless each normalized value's full date and clock occur
  inside that quote. Historical replay must remain exact.
- Verification: content-free PostgreSQL call/commit/issue assertions;
  `pnpm docs:check`; `git diff --check`.
- Signature: Codex

## 2026-08-15 — ACME-0114 runtime-derived observation locators

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0114
- Summary: Implemented ADR-0042 after ACME-0113 proved that a model can select
  verbatim quotes yet still miscount canonical source lines. Active
  `evidence.observe-artifact@1.3.0` now uses output
  `evidence-observe-artifact-output/2` with no locator fields.
- Authority: runtime performs an ordinal search over canonical LF/NFC text,
  accepts only one exact occurrence and derives inclusive start/end lines
  before locator identity, observation identity, invariants or projection.
  Absent and duplicate quotes refuse; no fuzzy repair exists.
- Replay: historical `@1.0.0`, `@1.1.0` and bounded `@1.2.0` request builders,
  hashes and output `/1` remain registered and interpretable. Their hashes are
  respectively `743b53be2522deae2f2507ca9f153e4b0ecdb9f2af1693288713ee1689449004`,
  `29cdf2eebf1f5c51c5dc618aac573a10f6eea8d526e9f40d6a8621a31bd871ae`
  and `50a18aa90d3f50ce82902642262731596bcf9eeb9e4e83ba1de65355be3e3db6`.
- Active fixtures: provider schema retains one-to-eight bounds and 8,192 output
  tokens while omitting `startLine`/`endLine`. Deterministic development and
  evaluation request hashes were re-pinned; derived synthetic locators and
  observation identities remain unchanged.
- Verification: focused suite 33 tests; `pnpm typecheck`; `pnpm lint`;
  `pnpm boundaries`; exact `pnpm test` — 750 unit, 78 conformance, 62
  integration and 26 scenario; `pnpm build`; `pnpm test:postgres` — 36 tests
  against a fresh PostgreSQL 15 container; `pnpm format:check`;
  `pnpm docs:check`; `git diff --check`.
- PostgreSQL correction: the first gate passed 35/36 and identified one stale
  injected active-provider fixture still returning `/1`. After changing only
  that fixture to active `/2`, its file passed 2/2 and the full fresh gate
  passed 36/36. All temporary containers were removed.
- Safety/follow-up: ACME-0114 made no network/provider call and used no source
  or credential. A separately frozen real-provider acceptance remains, and a
  successful batch still cannot imply exhaustive document coverage.
- Signature: Codex

## 2026-08-15 — ACME-0113 superseded after bounded provider call

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0113
- Summary: Ran the separately frozen Stage A gate once against active
  `evidence.observe-artifact@1.2.0` under the user-approved ACME key and 200 SEK
  prepaid monetary ceiling. The first Vitest command used the default config,
  found no live test and made no call; the corrected live config made exactly
  one provider call.
- Preflight: reverified the 106,907-byte, 52-page parent PDF SHA-256
  `f271fb518b31f6f6ff0ae80b740c078f383b3d44dbdceea43a5ca216c3920fd4`.
  pypdf 6.10.0 LF/NFC extraction reproduced a 106,072-byte strict UTF-8
  representation SHA-256
  `2a2dccd63566dcd6a96347a486088238ab62cad8d83e7b9e943f636511848bb4`.
  Clean loopback PostgreSQL/MinIO and random mounted keys passed health, empty
  database and signed S3 create/stat/read/delete/removal checks.
- Provider result: `gpt-5.6-luna` returned `finishReason = stop`, 36,900 input
  plus 2,340 output = 39,240 total tokens. The encrypted response was complete
  strict JSON with six candidates, so ACME-0112 resolved truncation.
- Semantic result: every candidate quote occurred verbatim in the source, but
  every model-authored line range was offset. Five starts were two lines late
  and one was four lines late; end offsets were one to three. The bounded
  pipeline emitted six `EVIDENCE_QUOTE_BINDING_FAILED` issues. One encrypted
  model-call record succeeded, while the execution failed with zero engine
  documents and zero product observations.
- Safety/cleanup: no retry or repair ran. Both `--rm` containers, their Docker
  network and the exact temporary directory containing source, credentials and
  keys were removed. The original PDF and ignored `.env.local` remain
  unchanged; no content, key or provider identifier entered the repo.
- Disposition: this one-call charter is consumed and superseded. The next
  offline task must preserve historical replay while deriving canonical line
  locators from uniquely occurring exact quotes instead of trusting model-
  authored line numbers. A successful batch will still not prove exhaustive
  full-document coverage.
- Verification: live gate reached the expected fail-closed semantic refusal;
  content-free PostgreSQL assertions confirmed one call/zero commits;
  `pnpm docs:check`; `git diff --check`.
- Signature: Codex

## 2026-08-15 — ACME-0112 bounded observation candidate contract

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0112
- Summary: Corrected the exact offline contract defect exposed by ACME-0111.
  Active `evidence.observe-artifact@1.2.0` now requests a deliberately
  non-exhaustive reviewer batch of one to eight observation candidates and
  rejects a ninth candidate at runtime and on the lowered wire schema.
- Replay: historical synthetic `@1.0.0` and source-neutral `@1.1.0` builders
  and request hashes remain unchanged and are registered alongside the active
  contract at every composition root that can resume retained evidence.
- Budget boundary: the active request uses the gateway's existing bounded
  8,192-output-token capability. That per-call output limit remains distinct
  from the externally enforced 200 SEK prepaid monetary ceiling.
- Architecture: ADR-0041 records that a successful batch is not a completeness
  claim. Full-source coverage requires a separately designed deterministic
  segmentation/coverage workflow; no hidden retry, pagination or multi-call
  behavior was introduced.
- Verification: focused contract/lowering/fixture/engine/live-composition suite
  31 tests; `pnpm typecheck`; `pnpm lint`; `pnpm boundaries`; exact
  `pnpm test` — 748 unit, 78 conformance, 62 integration and 26 scenario;
  `pnpm test:postgres` — 36 tests against a fresh PostgreSQL 15 container;
  `pnpm build`; `pnpm format:check`; `pnpm docs:check`; `git diff --check`.
  An initial full-suite teardown rejection was isolated to the existing
  asynchronous workbench cleanup; that file passed 9/9 alone and the exact
  full gate then passed cleanly.
- Safety: ACME-0112 made no provider or network model call and did not access
  credentials or source documents. No live/source artifact entered the repo.
- Follow-up: freeze a separate one-call real-provider acceptance under the
  existing approved monetary pot; a successful bounded batch still will not
  prove exhaustive document coverage.
- Signature: Codex

## 2026-08-15 — ACME-0111 superseded after one fail-closed provider call

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0111
- Summary: Activated the isolated Stage A real-provider gate after the user
  approved reuse of an ACME-specific ignored `OPENAI_API_KEY`. The prepaid pot
  is a 200 SEK monetary ceiling; the configured `20000` value means minor SEK
  units (öre), not tokens. This task additionally limited its exact execution
  to one provider call.
- Preflight: reverified D1's 106,907-byte parent PDF and SHA-256
  `f271fb518b31f6f6ff0ae80b740c078f383b3d44dbdceea43a5ca216c3920fd4`;
  prepared a fresh 106,072-byte LF/NFC UTF-8 representation with SHA-256
  `2a2dccd63566dcd6a96347a486088238ab62cad8d83e7b9e943f636511848bb4`;
  verified 52 non-empty pages and no NUL/replacement character. The fresh
  representation is not claimed byte-identical to ACME-0106's removed temp
  representation.
- Hosted-equivalent gate: clean loopback PostgreSQL and private MinIO were
  composed with random task-local credential, artifact-KEK and durable payload
  key files. The repository's signed S3 adapter passed create/stat/read/delete,
  and PostgreSQL began with zero public tables.
- Provider result: exactly one OpenAI `gpt-5.6-luna` call reached the provider.
  It used 36,874 input and 2,048 output tokens (38,922 total), returned
  `incomplete/max_output_tokens`, and retained an encrypted candidate that
  began as JSON but ended before its closing delimiter. The bounded pipeline
  reported `MODEL_INVALID_RESPONSE` at parse. No repair/retry ran.
- Safety result: one source and one failed product job existed transiently,
  but there were zero engine commits and zero observations. No source content,
  credential, provider payload or provider response id entered Git/docs. Both
  `--rm` containers and the exact temp directory were removed; the original
  PDF and ignored `.env.local` remain untouched.
- Disposition: the one-shot charter cannot rerun after consuming its only
  allowed provider call, so ACME-0111 is superseded. Activate ACME-0112 to
  version a bounded observation count and output budget offline; a later
  frozen one-call acceptance remains within the same external prepaid ceiling.
- Signature: Codex

## 2026-08-15 — ACME-0110 Stage A live assessment and reassessment

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0110
- Summary: Completed the Stage A engineering journey through human-reviewed
  reassessment. Active assessment contract `@1.1.0` accepts source-complete
  typed input `/2`; historical `@1.0.0` and identifier-only `/1` remain
  registered for replay with sealed synthetic outputs unchanged.
- Product path: additive case/internal commands, `evidence-product-job/4` and
  security audit `/4` drive a case-admin-only, one-call assessment job. The API
  derives accepted current observations/relations, open questions, sequence,
  predecessor, workspace and principal server-side. The provider receives exact
  typed source/locator/quote evidence; the browser supplies none.
- Commit/recovery: engine output remains an untrusted candidate. Product
  projection stores the validated assessment and case binding only after engine
  commit and deliberately leaves evidence revision unchanged. A post-engine
  fault stored no product assessment; full composition restart reused encrypted
  response evidence, preserved the assessment identity and made no second call.
- Revision correction: Stage A import already advances product revision for a
  new source. Live observation had advanced it again while the engine counted
  that source once, preventing a current assessment basis. Observation now
  verifies/reuses the import revision; relation then advances engine/product
  together. Later import/observation makes the predecessor due for attention.
- Reviewer proof: the PostgreSQL journey accepts observations and relation,
  proposes/resumes assessment v1, records human acceptance, imports and observes
  another Stage A source, shows v1 attention, proposes v2 with immutable
  predecessor linkage and records a separate human acceptance. Budget,
  credential-shaped payload and foreign-case attempts refuse before transport;
  audit remains content-free.
- Verification: focused module/web/API suite 11 passed; focused Stage A
  PostgreSQL suite 2 passed; `pnpm typecheck`; `pnpm lint`; `pnpm boundaries`;
  `pnpm test` — 745 unit, 78 conformance, 62 integration, 26 scenario;
  `pnpm test:postgres` — 36 tests on a fresh database; `pnpm build`;
  `pnpm format:check`; `pnpm docs:check`; `git diff --check`.
- Follow-up/blocker: engineering is complete, but the explicitly budgeted real
  provider acceptance cannot run without an `OPENAI_API_KEY` and approved spend
  ceiling. Stage B and every broader class remain closed.
- Signature: Codex

## 2026-08-15 — ACME-0109 superseded before implementation

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0109
- Summary: Superseded the newly frozen live-assessment charter before changing
  code. Its Definition of Done incorrectly required assessment projection to
  advance the product `evidenceRevision`.
- Reason: the accepted assessment contract deliberately leaves evidence
  revision unchanged. An assessment records `basisEvidenceRevision`; advancing
  that revision merely because the assessment was proposed would make the new
  assessment stale immediately and break the existing attention/re-review
  semantics.
- Follow-up: activate ACME-0110 with the same bounded outcome but require an
  atomic assessment projection at unchanged product evidence revision. The
  engine transaction still advances its internal state revision normally.
- Signature: Codex

## 2026-08-15 — ACME-0108 Stage A live relation job

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0108
- Summary: Added the second callable Stage A provider operation. Additive
  case/internal command contracts, `evidence-product-job/3` and live security
  audit `/3` bind one authorized case, a sorted set of at least two current
  observations, one model and a literal one-call budget.
- Server authority: the authenticated case-first API derives workspace,
  principal, current observations and activated Stage A source authority from
  one authorized product snapshot. The browser supplies only command identity,
  confirmation and budget; evidence, source text, state and credentials cannot
  be supplied by the caller.
- Product path: the existing strict `relate-observations` task validates model
  output through the durable encrypted-payload engine. After engine commit, one
  atomic repository operation stores typed relations, open questions, scoped
  standing changes, case bindings and exactly one evidence-revision advance.
  The primary browser launches/polls the job and exposes the committed result
  through the existing relation/open-question views; timeline stays a pure
  observation projection.
- Recovery: an injected interruption after engine commit left no relations,
  questions or product revision. Reopening the complete PostgreSQL composition
  and resubmitting the exact command reused retained provider evidence, wrote
  identical content-derived identities and completed with one cumulative
  transport call.
- Refusal/isolation: excess budget, credential-shaped payload and a sibling
  case with no eligible observations all refused before transport. Refusal,
  start, failure and completion audits remained content-free and did not echo
  source text or credential material.
- Verification: focused web/API/file suite 11 passed; focused PostgreSQL Stage
  A suite 2 passed; `pnpm typecheck`; `pnpm lint`; `pnpm boundaries`;
  `pnpm test` — 745 unit, 78 conformance, 62 integration, 26 scenario;
  `pnpm test:postgres` — 36 tests on a fresh database; `pnpm build`;
  `pnpm format:check`; `pnpm docs:check`; `git diff --check`. Two initial full
  local attempts hit existing Test UI/auth timing-teardown flakes; affected
  tests passed alone and the exact full rerun passed. No paid call ran.
- Follow-up: add the live assessment job and complete primary assessment
  review plus late-evidence reassessment. Explicitly budgeted real-provider
  acceptance still requires a process credential and approved spend ceiling.
  Stage B and every broader data class remain closed.
- Signature: Codex

## 2026-08-15 — ACME-0107 Stage A live observation job

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0107
- Summary: Implemented the first callable Stage A provider operation. Additive
  case/internal command contracts and `evidence-product-job/2` bind one
  activated source, one model and a literal one-call budget. Live security
  audit `/2` records start, completion, failure and refusal without content.
- Compatibility: `evidence.observe-artifact@1.1.0` replaces the synthetic-only
  wording with source-neutral wording while preserving semantics. Historical
  `@1.0.0` remains registered for replay, and deterministic fixture request
  hashes were intentionally re-pinned for the active contract.
- Product path: the authenticated case-first API requires server-derived
  `case-admin` / `live-model.run`, scans credential-shaped payloads and passes
  exact confirmation/source authority into the closed capability. Canonical
  source text is hydrated through the audited artifact service; neither source,
  workspace nor principal may come from the browser. The primary source card
  exposes analysis only when the complete live capability exists.
- Commit boundary and recovery: the worker projects validated observations and
  advances evidence revision only after the durable engine commit. An injected
  interruption after provider success left zero product observations; a full
  PostgreSQL composition restart reused encrypted retained response evidence,
  completed the same job with identical observation identity and made no
  second transport call.
- Refusal/isolation: excess budget, credential-shaped command and a known
  source id under a sibling case all refused before transport; the sibling case
  returned non-disclosing 404. Three refusal audits plus started/failed/
  completed audits contained no source text, quote, provider body or
  credential.
- Live acceptance entry: added an isolated `tests/live` Stage A product gate
  requiring exact live opt-in, hosted PostgreSQL/S3/key configuration,
  operator-supplied source provenance and an explicit one-call cost ceiling.
  It skipped in this checkpoint because no `OPENAI_API_KEY` was present; spend
  was zero.
- Verification: focused observation/module/API/auth/browser tests 24 passed;
  PostgreSQL Stage A tests 2 passed; `pnpm typecheck`; `pnpm lint`;
  `pnpm boundaries`; `pnpm test` — 745 unit, 78 conformance, 62 integration,
  26 scenario; `pnpm test:postgres` — 36 tests against a fresh database;
  `pnpm build`; `pnpm format:check`; `pnpm docs:check`; `git diff --check`.
  An initial full PostgreSQL run reused targeted-test data and was invalidated;
  it exposed and corrected a pre-existing first-workspace ordering assumption
  before the clean run passed.
- Follow-up: implement live relation/timeline/open-question and assessment jobs,
  then execute the primary review and late-evidence reassessment journey. The
  real paid observation acceptance needs a process credential and explicit
  run ceiling. Stage B and all broader data classes remain closed.
- Signature: Codex

## 2026-08-15 — ACME-0106 Stage A judicial text import

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0106
- Summary: Implemented the first real-source product path authorized by
  ADR-0040. `evidence-create-case-command/2` adds an explicit immutable case
  data policy, while `evidence-text-import-metadata/2` and
  `evidence-text-import-record/2` bind only
  `stage-a-anonymized-judicial-text/1` to operator/provider attestations and
  exact external-source provenance. Existing synthetic `/1` commands and
  records remain unchanged.
- Trust boundary: case policy and import class must match. `source.import` is
  case-admin-only. Stage A case creation and import refuse unless the API was
  composed with ACME-0105's complete `evidence-poc1-live/1` capability;
  credentials, client flags and organization roles cannot activate it. The
  default composition remains synthetic/scripted.
- Product path: authenticated API/browser controls create Stage A cases, paste
  operator-prepared strict UTF-8 text and collect parent PDF digest/byte length,
  acquisition reference and pypdf extraction version/page count. Imported
  exact and LF/NFC canonical bytes remain separately encrypted immutable
  representations. The parent PDF is never ingested.
- Persistence/isolation: file reopening preserves the additive Stage A product
  record/provenance; PostgreSQL preserves product plus identity through a full
  composition restart. Adversarial tests refuse both policy/class directions,
  credential-shaped metadata and capability-free activation, while a sibling
  case reveals no imports.
- Real-source acceptance: fully rendered and visually inspected every page of
  the two operator-supplied PDFs (52 + 23 pages), then extracted outside Git
  with `pypdf 6.10.0; default; LF-page-separator/1`. D1 parent SHA-256
  `f271fb518b31f6f6ff0ae80b740c078f383b3d44dbdceea43a5ca216c3920fd4`
  produced extracted SHA-256
  `4771c61b3b7080ae6b82de8e3dab0c74d82b8d22ba387787e9c0658bf698364a`;
  D2 parent SHA-256
  `7a7188fb8ce18d0d952e6d4a342753817b3c57fdb788290c9f142df4dfac3633`
  produced extracted SHA-256
  `9a12bcf574a42cc07d89dc82b8443de52d6f9efbf78fc14d53d41668480607c7`.
  Both imported through the authenticated Stage A API into disposable
  PostgreSQL and reopened with byte-identical records and source hashes.
  Provider calls: zero. The disposable database was removed; temporary
  renders/extracts were sent to the recycle bin; original PDFs remain intact.
- Verification: focused Stage A/auth/browser suite 20 tests; `pnpm typecheck`;
  `pnpm lint`; `pnpm boundaries`; `pnpm test` — 745 unit, 78 conformance, 62
  integration, 26 scenario; `pnpm test:postgres` — 35 tests on a clean
  disposable `postgres:15`; `pnpm build`; `pnpm format:check`;
  `pnpm docs:check`; `git diff --check`. One auth blackbox timed out only while
  the build ran concurrently; it passed alone and the full serial rerun passed.
- Spend: none. No live provider call was made.
- Follow-up: add the bounded case-first live evidence job, confirmation/audit,
  restart-safe provider execution and primary observation→relation→assessment
  reviewer/reassessment journey over these imported Stage A sources. Stage B
  FUP and all other source classes remain independently closed.
- Signature: Codex

## 2026-08-15 — ACME-0105 Evidence live composition boundary

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0105
- Summary: Implemented the first runtime checkpoint after ADR-0040. The
  Evidence hosted composition can now create a closed
  `evidence-poc1-live/1` capability, but only after hosted mode, durable
  PostgreSQL, live provider configuration, deployment ceilings and a mounted
  durable payload key all validate. Default/local execution remains the
  scripted gateway and no product route can invoke live yet.
- Shared boundary: added pure leaf package `@acme/live-safety` for recursive
  credential-field refusal, explicit environment opt-in, environment-only
  credential resolution and nested run/confirmation/deployment budget checks.
  The Domain Test UI now reuses those primitives without changing its
  `acme-live-confirmation/1` public behavior.
- Evidence boundary: added strict `evidence-live-confirmation/1` with exact
  case binding and no actor field. `live-model.run` is denied to organization
  roles, case-viewer and case-reviewer and granted only to case-admin. The
  capability releases an OpenAI gateway only when that server-derived context,
  a matching confirmation and an attested `authorized-external`
  `stage-a-anonymized-judicial-text/1` source are present together.
- Durable retention: live-enabled PostgreSQL composition reads a base64
  32-byte key from `ACME_EVIDENCE_PAYLOAD_KEY_FILE`, uses its stable configured
  id and refuses an absent/invalid/ephemeral key. Credentials alone activate
  nothing, startup makes no provider call and serialized capability metadata
  contains no credential.
- Proof: a fully authorized run reached the existing OpenAI Responses adapter
  through an injected transport; every mixed profile refused before transport,
  and the default composition exposed only the scripted gateway with zero
  invocations.
- Verification: focused suites 39 tests; `pnpm typecheck`; `pnpm lint`;
  `pnpm boundaries`; `pnpm test` — 742 unit, 78 conformance, 62 integration,
  26 scenario; `pnpm build`; `pnpm format:check`; `pnpm docs:check` — 212
  Markdown files; `git diff --check`. The first `pnpm test:postgres` correctly
  refused without configuration; a disposable `postgres:15` was then started
  on an isolated port and all 34 PostgreSQL tests passed from a clean database.
  The container was stopped and removed afterward.
- Spend: none. No live provider call was made.
- Follow-up: version the Stage A data/import provenance contract and add the
  authenticated live job/API/browser path with content-free audit. That path
  must use this capability rather than constructing a gateway directly.
- Signature: Codex

## 2026-08-15 — ACME-0104 POC #1 live product applicability (ADR-0040)

- Date: 2026-08-15
- Author: Codex
- Task: ACME-0104
- Summary: Accepted ADR-0040, the applicability decision that advances the
  Evidence Integrity Workbench from a synthetic-only implementation phase to
  one bounded Stage A live proof without weakening its permanent evidence,
  review, security or case-isolation rules. Documentation-only; the runtime
  still rejects real-source import and composes the scripted gateway.
- Permanent invariants: candidate-not-truth, immutable exact
  source/version/locator provenance, append-only coexistence of versions and
  review decisions, typed relations and temporal uncertainty, persistent
  citation-complete assessments, visible late-evidence attention,
  deny-by-default case isolation and the L5 conclusion prohibition apply to
  every profile.
- Phase-local controls: the seven/eight fixed corpus, sealed hashes,
  `synthetic-only` policy, synthetic authority attestation and deterministic
  scripted gateway continue to govern the existing test profile and offline
  gates. They are no longer misclassified as universal product invariants.
- Stage A authority: exactly `stage-a-anonymized-judicial-text/1` — authorized
  real judicial text already anonymized/redacted before import, constrained by
  the existing strict UTF-8 mechanics and encrypted artifact boundary. Text
  prepared outside ACME from a PDF records parent digest and extraction
  identity; ACME does not gain a PDF import path. Stage B FUP material and all
  broader/sensitive classes remain closed.
- Live invariant: `evidence-poc1-live/1` must machine-check the conjunction of
  durable PostgreSQL, live provider, authorized-external source origin and
  authenticated/configured authorized-live execution. Credentials or a
  deployment label cannot activate it, and any mock/in-memory/fixture mixture
  refuses.
- Real material: the operator supplied two anonymized judicial PDFs outside
  the repository. Read-only inspection found 52 and 23 text-bearing pages,
  101,732 and 39,786 extracted characters, and no empty extraction page. No
  source bytes or extracted content entered Git. They are ready for the later
  operator-prepared-text provenance/import checkpoint.
- Verification: `pnpm docs:check` — 210 Markdown files; `pnpm format:check`;
  `git diff --check` clean; manual link, terminology and applicability review.
  Historical ADRs were not edited. Code/test gates were not run because this
  charter changed only documentation and `AGENTS.md`.
- Spend: none. No provider call was made.
- Follow-up: implement ADR-0039 and ADR-0040 as a typed fail-closed live
  composition, then add the Stage A contract/import path and real primary
  reviewer journey. Stage B is independent and must not block that sequence.
- Signature: Codex

## 2026-08-14 — ACME-0103 PostgreSQL restart test modernized to case-first

- Date: 2026-08-14
- Author: Claude
- Task: ACME-0103
- Summary: CI's PostgreSQL job failed with `expected 404 to be 201`. The
  restart durability test had gone stale against ADR-0036 case-first routing
  and nothing had ever executed it. Fixed and verified against a real server.
- This is the first session in which `pnpm test:postgres` actually ran. Every
  prior journal entry — ACME-0098, ACME-0100, ACME-0101 — recorded it as
  refused for want of a configured server, and said so rather than claiming a
  result. The operator started Docker, so the gap could finally be closed:
  34 tests, 6 files, against `postgres:15` from a freshly created database
  matching the CI service. A disposable container was used; the operator's
  Supabase stack was never touched by test migrations.
- Origin, checked rather than assumed: the guard that 404s `/api/reviews`
  without a case prefix came in `9037ca1`, before ACME-0099 and ACME-0100.
  Commit `756042b` only appended two prefixes to the same list. The test has
  been broken since `9037ca1`, invisibly, because the suite never ran.
- The first plausible cause was not the only one. Removing `/api/reviews` from
  the guard locally still gave 404: the test reviewed an observation under
  `first.workspaceId` while its change set bound that observation to a separate
  `durableWorkspaceId`. Two independent staleness bugs behind one assertion,
  and stopping at the first would have produced a fix that still failed.
- The separate workspace turned out to be deliberate. Startup adopts unbound
  objects of the composition's workspace into its case, so the original test
  parked the golden E-A01 assessment in a workspace the composition did not
  manage. ADR-0036 then closed that door: reconciliation requires every
  workspace to own exactly one case, so a parked workspace fails on restart.
  With both routes blocked, the fix had to change what the assessment cites
  rather than where it lives — it now cites this case's single observation.
- Assertions changed deliberately: `evidence-review-decision/2` to `/3`, and
  `authenticated-session` to `authenticated-case-session`. That is a real
  change in what is proven, and it is the correct one — the legacy `/2` path is
  unreachable and implements the caller-supplied `workspaceId` pattern
  ADR-0036 exists to forbid.
- Reported rather than fixed: `POST /api/reviews` still carries a
  `requestCaseId === null` branch reading `command.workspaceId` from the body.
  The guard makes it unreachable, so it is dead code implementing a forbidden
  pattern. Removing it is a separate charter; leaving it means whoever next
  touches the guard could revive it.
- A second, unrelated flake surfaced and was addressed: the full default suite
  intermittently failed `compares corrected and later accounts…` at 17s against
  the default 5s timeout, while passing at 4.3s on an idle machine. It is
  load-sensitive rather than a regression, but 4.3s against a 5s bound will
  flake in CI, so it now carries an explicit 30s timeout like its sibling.
- Not addressed, and worth naming: an ENOENT race in
  `tests/integration/test-ui-workbench.test.ts` around `workspace/jobs/*.json`
  appeared once under the same load. It is a real latent flake and is recorded
  as a follow-up rather than quietly ignored.
- Verification: `pnpm test:postgres` — 34 tests from a clean database;
  `pnpm test` — 728 unit (115 files), 78 conformance, 62 integration, 26
  scenario; `pnpm typecheck`; `pnpm lint`; `pnpm format:check`; `pnpm build`;
  `pnpm docs:check`; `git diff --check` clean.
- Spend: none.
- Signature: Claude

## 2026-08-14 — ACME-0102 workbench live model boundary (ADR-0039)

- Date: 2026-08-14
- Author: Claude
- Task: ACME-0102
- Summary: Accepted ADR-0039, which decides how the Evidence Integrity
  Workbench may call a live model provider. Documentation-only; the product
  still composes the scripted mock gateway and no live call is possible until
  the implementation task lands.
- Why the decision was needed at all: the workbench composes
  `createScriptedModelGateway` with responses pinned to request hashes of the
  seven fixed artifacts, and Stage 5 ingestion runs no model. Any document
  outside the sealed corpus yields zero observations, so relations, timeline,
  contradictions and assessment are all unreachable for new material. That is
  structural, not a gap in coverage.
- The four pre-freeze answers were carried into the ADR with their reasoning
  rather than as bare rulings, so a later decision can argue against them.
- **A new `evidence-live-confirmation/1` rather than reusing ADR-0023's.** The
  existing document carries a free-text `confirmer`; ADR-0035 exists precisely
  so a browser payload cannot choose the acting identity, and reusing the field
  would have quietly undone that. Its `caseCount` also means "test-plan cases"
  and collides with the product's evidence `caseId`. The new document binds
  `caseId`, so a live authorization cannot leave the ADR-0036 boundary. The
  pure primitives — forbidden-credential scan, budget assertion, typed refusal
  reasons — are shared rather than duplicated.
- **Confirmation is not authorization.** Worth stating separately because it is
  the easiest thing to get wrong: the confirmation is a cost and intent gate,
  access stays with ADR-0035 policy and ADR-0036 membership. A new
  deny-by-default `live-model.run` action, case-admin only, gates the capability
  itself, and an unauthorized principal gets `404` so live cannot be used to
  probe case existence.
- **Two ceilings, not one.** The confirmation declares a run ceiling; a
  deployment ceiling in configuration caps it and no route may raise it. Retry
  and repair calls count as calls. Exhaustion terminates the run, and because
  execution events stay candidates until the state transaction commits, a
  terminated run leaves no canonical evidence and no revision increment.
- **`encrypted-payload` retention.** `hash-only` would degrade `replayVerify`
  to `unavailable` and forfeit ADR-0017 resume — paying a second time on
  interruption and losing a proof the product already asserts. The cost is that
  payloads become durable content records, acceptable under `synthetic-only`
  and explicitly revisited at Slice 9. It also surfaced a concrete consequence:
  the local composition's payload key is ephemeral per process, so a hosted
  deployment must supply a durable key or silently lose replay after restart.
- **All three tasks live.** Restricting to `observe-artifact` buys no safety,
  because the trust pipeline is gateway-independent: the same validation,
  prohibited-authority refusals and source-binding gates run whichever gateway
  produced the candidate. It would only remove everything past extraction. Cost
  is the risk that actually changes, and the budget is what handles it.
- Verification: `pnpm docs:check` — 208 Markdown files; `pnpm format:check`;
  `git diff --check` clean; diff confirmed to contain no `.ts`, schema or
  `package.json` change. Typecheck, lint and the test suites were not re-run
  because nothing outside `docs/` changed.
- Docs: ADR-0039 added and indexed; the technical specification's deferred
  decision marked decided; `SYSTEMDOC` and `CURRENT_STATUS` synchronized;
  ACME-0102 archived.
- Spend: none. No live provider call was made by this task, which is the
  boundary it decides.
- Follow-ups: implement ADR-0039 as a separately frozen task against its
  section 10 gates. Cumulative per-principal budget accounting is deferred.
  Retention is revisited at Slice 9, and the durable payload key folds into
  ADR-0037's open KEK question. Slice 9 itself remains closed.
- Signature: Claude

## 2026-08-12 — Local workbench evidence-projection mismatch (diagnosis, no code change)

- Date: 2026-08-12
- Author: Claude
- Task: none active; discovery recorded in `docs/backlog/`
- Summary: The operator reported several pages showing `Workspace evidence
  revision does not match the supplied Evidence projection.` Diagnosed and
  reproduced; no code change was kept, because the right fix is an
  architecture choice that needs its own charter.
- Cause: the local file composition persists the product store to
  `.local/evidence-workbench/*.json` but builds the ACME ledger with
  `createInMemoryExecutionRepository`. The seed import runs only when the
  product store has no sources or observations, so a restart against an
  existing file skips it and leaves the ledger empty. `evidenceProjection()`
  then returns revision 0 against a file recording revision N, and every
  builder calling `requireProjectionRevision` throws — observation ledger,
  compare accounts, relations, timeline and open questions. Work queue, source
  review, assessment, search, overview and the integrity report do not project
  domain state and keep working, which is why only some pages failed.
- Reproduced deterministically with two starts against one data file:
  development seed `product=1 projection=1 -> ok` then
  `product=1 projection=0 -> throws`; evaluation seed the same at revision 5.
- Attempted and backed out: a startup refusal naming the file and the remedy.
  It broke a supported flow — `local-blackbox.test.ts` deliberately restarts
  against an existing product file to prove import and redaction records
  survive, reading the repository directly without serving a projecting view.
  Bending that test to fit the guard would have been the wrong trade, so the
  guard was reverted in full rather than kept.
- Also relevant: the workbench README already states the ledger is
  "deliberately" in memory and instructs using a fresh product file per
  session. The behaviour is intended; what is missing is any signal when the
  instruction is not followed. That makes this a design gap, not a defect, and
  therefore backlog rather than a corrective task.
- Recorded: `docs/backlog/local-workbench-durable-ledger.md` with three
  options — durable SQLite ledger for the local composition (recommended),
  startup refusal with an explicit opt-out, or rebuilding the projection from
  the product store (rejected on sight: state is reducer-owned).
- Operator action taken: backed up and removed `.local/evidence-workbench` so
  the running instance seeds fresh. The backup is in this session's scratchpad,
  not in the repository.
- Verification: `pnpm typecheck`; `pnpm lint`; `pnpm format:check`;
  `pnpm test` — 728 unit, 78 conformance, 62 integration, 26 scenario;
  `pnpm build`; `pnpm docs:check`; `git diff --check` clean. The working tree
  carries no code change from this diagnosis.
- Signature: Claude

## 2026-08-12 — ACME-0101 browser shell parse failure (corrective)

- Date: 2026-08-12
- Author: Claude
- Task: ACME-0101
- Summary: The operator reported that sign-in did not work and mentioned a
  JavaScript error. The browser client was not partly broken — it was entirely
  dead. The rendered module contained an unterminated string literal, and a
  parse error anywhere in a module means none of it runs, so no handler was
  ever bound, including the sign-in form's.
- Root cause: `apps/evidence-workbench-web/src/index.ts` renders the whole
  client from one TypeScript template literal, and `draftRedaction` was written
  as `.join('\n')`. Inside a template literal `\n` is an escape the literal
  consumes, so the served JavaScript carried a real line break inside a
  single-quoted string. The fix is `.join('\\n')`.
- Reproduced rather than reasoned about: started the local workbench, read
  `Uncaught SyntaxError: Invalid or unexpected token` from the browser console,
  extracted the served module and ran `node --check` on it to get the exact
  offending line. After the fix a clean tab logs only the expected `401` from
  the unauthenticated `/api/session` probe — which is the call that renders the
  sign-in form.
- Not mine, and worth stating plainly: the defect entered with ACME-0097's
  Documents/redaction view and shipped through ACME-0098, ACME-0099 and
  ACME-0100. Every one of those tasks ran a green shell test. The test only
  asserted `toContain` substrings, which pass happily while every button in the
  product is dead. That is the real lesson here: the shell had no gate that
  could observe whether its output was valid JavaScript at all.
- The new gate compiles the emitted module with `new vm.Script` and never runs
  it, wrapping it in an async arrow because the module uses top-level await. It
  was proven load-bearing: reintroducing `.join('\n')` fails it, restoring the
  fix passes it. A scan for other template-consumed escapes in the shell found
  none.
- Verification: `pnpm typecheck`; `pnpm lint`; `pnpm format:check`;
  `pnpm boundaries`; `pnpm test` — 728 unit (115 files, up from 727), 78
  conformance, 62 integration, 26 scenario; `pnpm build`; `pnpm docs:check`;
  `git diff --check` clean.
- Not verified: sign-in end to end. Completing the form means entering a
  password, which I do not do; the operator can, with the synthetic-only
  development credential documented in the workbench API README. Everything up
  to that point — module parses, form renders, no console error — is checked.
- Spend: none.
- Follow-ups: a real browser-driven smoke test of sign-in would be its own
  charter. The shell remains one large unchecked template literal; the parse
  gate now bounds the worst failure mode but not logic errors inside it.
- Signature: Claude

## 2026-08-12 — ACME-0100 assessment output and export operations complete

- Date: 2026-08-12
- Author: Claude
- Task: ACME-0100
- Summary: Delivered Stage 8, the last stage before the gated Stage 9. A
  reviewed assessment now leaves the product as deterministic JSON, Markdown,
  DOCX or PDF under an explicit per-case export policy, every release and
  refusal is audited, and the product store has a backup manifest whose restore
  verification fails closed.
- Charter note: the owner froze ACME-0100 with Goal and In Scope filled in but
  Primary Deliverable, Definition of Done and Minimum Verification Gates still
  template text. Those three were completed from the frozen Goal, the frozen
  In Scope sentence (kept verbatim) and the owner's recorded scope decision,
  and both the freeze metadata fix and the field completion are recorded in the
  Charter Amendment Log. Nothing was widened.
- One document, four renderers. `evidence-assessment-output/1` resolves every
  claim's support, conflict and qualification reference through the
  assessment's own citation list to exactly one observation at that artifact
  version and locator, carrying its exact quote. All four formats render from
  that single document, so they cannot drift apart, and a reference that cannot
  be resolved refuses the whole document instead of producing an uncited claim.
  The golden corpus confirmed the approach is sound: all five E-A01 citations,
  including the two relation citations, resolve to exactly one observation.
- No new dependency, deliberately. The repository already hand-rolls a
  deterministic stored-entry ZIP writer precisely so exports are
  content-addressed; a PDF or DOCX library would have reintroduced the creation
  timestamps and ordering that writer exists to avoid. The ZIP writer was
  extracted so DOCX (OOXML, no docProps part) reuses it, and PDF is a minimal
  PDF 1.4 writer over the base-14 Courier faces: nothing embedded, line
  breaking as exact integer arithmetic, no `/Info`, `/CreationDate` or
  `/ModDate`.
- Load-bearing evidence rather than a shape assertion: the PDF test walks the
  cross-reference table the way a reader does, checking every offset lands on
  its object and that `/Size` matches, and it does so for a forced multi-page
  document as well as the single-page golden one. Asserting `%PDF-1.4` alone
  would have let a broken xref pass.
- Corrected mid-implementation: the export-audit identity was first derived
  from its content, which made two downloads at the same clock instant collapse
  into one record. That is the wrong model for an audit trail — two downloads
  are two release events and both must appear — and the blackbox test caught it
  as 4 records where 8 were expected. Identity is now generated per event via
  `ids.next('export-audit')`, matching how every other audit event in this
  repository is identified. `deriveEvidenceExportAuditId` was removed.
- Export is deny-oriented: bytes are released only when the effective policy
  both enables export for the case and names the exact requested format. A case
  with no stored policy resolves to `EVIDENCE_DEFAULT_EXPORT_POLICY`, an
  explicit named constant rather than an implicit allow, which is also what
  keeps the existing Stage 5 reviewed-ZIP journey green.
- The product backup manifest mirrors ADR-0037's artifact-level pair: content
  digests only, no source text, quote or rationale. Restore verification
  refuses a missing record, an altered record, a record the manifest never
  listed, and a manifest whose own digest does not match — each proven
  separately.
- Persistence: file and PostgreSQL adapters carry `evidence-export-policy/1`
  and `evidence-export-audit-record/1` under migration v7, with shared
  conformance covering policy revisioning, stale-revision refusal and
  append-only idempotent audit records. Both new record kinds joined the
  case-object binding vocabulary and both case-scoping paths, and the two new
  routes joined the same-organization foreign-case isolation list.
- Verification: `pnpm typecheck`; `pnpm lint`; `pnpm format:check`;
  `pnpm boundaries`; `pnpm test` — 727 unit (115 files, up from 713/113), 78
  conformance (up from 77), 62 integration, 26 scenario; `pnpm build`;
  `pnpm docs:check`; `git diff --check` clean. No network call, no wall-clock
  read in any output byte and no live provider call in any gate. The longest
  blackbox journey needed an explicit 30s timeout: it now runs nine mock
  executions, a late import, a reviewed ZIP and eight rendered outputs against
  the file-backed store, and takes about 5.8s.
- Not run: `pnpm test:postgres`. `ACME_POSTGRES_URL` is not configured here and
  the tooling refuses rather than skipping, so no PostgreSQL result is claimed.
  Migration v7 and the two PostgreSQL write paths are therefore typechecked and
  conformance-covered but not executed against a server; that is the one gap in
  this task's evidence and the next PostgreSQL-capable session should run it.
- Docs: `CURRENT_STATUS`, `SYSTEMDOC`, `FILESTRUCTURE`, `PROJECT_BRIEF`,
  `AGENTS.md`, the completion plan, the design README and the workbench API
  README synchronized; ACME-0100 archived.
- Spend: none.
- Follow-ups: Stage 9 non-synthetic readiness is the only remaining stage and
  stays closed — it needs its own ADR and qualified review and cannot activate
  by implication. Stage 7's three recorded absences (per-standing count splits,
  a `scope-mismatch` row kind, a diff between two report bases) remain open and
  were not in this charter either.
- Signature: Claude

## 2026-08-12 — ACME-0099 case overview and Case Integrity Report complete

- Date: 2026-08-12
- Author: Claude
- Task: ACME-0099
- Summary: Finished Stage 7, resuming the partial implementation Codex left in
  the working tree when its session limit stopped work. A case now opens on an
  overview, and reviewed relations, questions and assessment attention become a
  deterministic Case Integrity Report whose every row names the exact
  source-bound observations behind it.
- Resumed state: the contracts, both builders, the two API routes and the
  browser views existed but were unformatted and untested, `digest()` had been
  left mid-refactor with the report using a separate content digest under a
  field named `snapshotDigest`, and no builder test existed.
- Load-bearing correction: `changedAccountPairs` could never be anything but
  zero. Classification tested `/changed-account/iu` against `rationaleCode`, a
  free-text field no generator emits — and one written by the model. Two
  problems in one: a category the frozen charter requires produced no rows, and
  report categories were steerable by prompt output, which the guardrails
  forbid. Classification now reads typed canonical evidence only.
- The three typed rules, all grounded in the specification rather than
  invented: a `correction` relation stays a correction because ADR-0032 pairing
  binds it to one logical-artifact lineage; a relation is a **changed account**
  when its endpoint observations share a *resolved* actor key across
  *different* logical artifacts, which is exactly the spec's "later changed
  account from the same actor" and honors both "zero changed-account pairs are
  classified as corrections" and the prohibition on merging unresolved actors;
  and a `contradicts` relation is a **temporal conflict** when its comparable
  scope's typed bounds cannot both stand — two known bounds do not overlap
  under the existing `evidence-temporal-overlap-1` helper, or a recorded
  `document-time` is set against a `claimed-event-time`. `supports`,
  `duplicate`, `scope-mismatch` and `unresolved` produce no row.
- On the sealed corpus this yields E-R01/E-R02 corrections, E-R03 the changed
  account, E-R04 a qualification, E-R05/E-R06 temporal conflicts and no row for
  E-R07/E-R08 — and therefore zero plain contradictions. Zero is the truthful
  count for this corpus, not a broken branch: every `contradicts` relation in it
  is either the same actor's later account or a clash with the access log.
- Identity was made coherent with its own field name. One order-insensitive
  `snapshotDigest` over the case workspace/evidence revision, evidence and
  review overlay now serves both read models, so the overview and the report
  state the same basis and repository ordering cannot change it. `reportId`
  derives from renderer version, that basis and the ordered rows. Volatile
  job, staging and audit material is excluded; no timestamp or actor enters
  either identity.
- Tests added: `packages/evidence-testing/test/case-insights.test.ts` pins the
  classification of all eight golden relations by name, the full count vector,
  citation resolution to real observations and sources, equality under a
  reversed snapshot, uniqueness and sort order of row ids, and that a later
  evidence revision or one added review decision changes the basis while the
  rows stay put. The local blackbox now asserts the same counts through the
  real API after the full journey and walks every citation back through
  `api/sources/...` to prove the row-to-source path end to end. The web shell
  test pins the citation buttons and the `loadSource` wiring behind them.
- Isolation: `api/overview` and `api/integrity-report` joined the
  same-organization foreign-case route list, which expects `404 Not found.`
  Codex had also moved `api/reviewer-work` and `api/search` into that loop;
  they were previously passed as surplus arguments to a two-argument helper and
  so were never actually exercised.
- Recorded absences rather than approximations, all outside the frozen In Scope
  list: no per-review-standing count split, no `scope-mismatch` row kind and no
  diff against a prior report basis. The stable digest pair is what a later
  diff would be built on. They are written into the completion plan.
- Verification: `pnpm typecheck`; `pnpm lint`; `pnpm format:check`;
  `pnpm boundaries`; `pnpm test` — 713 unit (113 files, up from 708/112), 77
  conformance, 62 integration, 26 scenario; `pnpm build`; `pnpm docs:check`
  201 Markdown files; `git diff --check` clean. No network call, no wall-clock
  read and no live provider call in any gate.
- Not run: `pnpm test:postgres`. `ACME_POSTGRES_URL` is not configured here and
  the tooling refuses rather than skipping, so no PostgreSQL result is claimed.
  Stage 7 adds no persistence, schema or migration, so no PostgreSQL surface
  changed.
- Docs: `CURRENT_STATUS`, `SYSTEMDOC`, `FILESTRUCTURE`, `PROJECT_BRIEF`,
  `AGENTS.md`, the completion plan, the design README and the workbench API
  README synchronized; ACME-0099 archived. `FILESTRUCTURE` also picked up
  package files that had drifted out of date before this task.
- Spend: none.
- Follow-ups: Stage 8 (deterministic assessment output, export audit and
  operational controls) is drafted in `docs/CURRENT_TASK.md` as ACME-0100 and
  is **not** frozen — its charter needs explicit approval before
  implementation. Stage 9 non-synthetic readiness remains closed and cannot
  activate by implication.
- Signature: Claude

## 2026-08-12 — ACME-0098 reviewer operations and case search complete

- Date: 2026-08-12
- Author: Codex
- Task: ACME-0098
- Summary: Added durable assignment/reassignment, comments, append-only
  activity, atomically recorded single/bulk decisions, effective work status,
  deterministic bounded case search and browser My review work/Search views.
- Security: every route is case-first and deny-by-default; same-organization
  foreign-case reads are 404, bulk targets are unique and capped at 50, and
  no non-synthetic authority was added.
- Persistence: file and PostgreSQL adapters include the records and migration
  v6; shared conformance covers search, assignment, comments and atomic batch
  collision behavior.
- Verification: typecheck, lint, boundaries, build, format, docs and full
  offline tests passed: 708 unit, 77 conformance, 62 integration, 26 scenario.
  `pnpm test:postgres` refused because no PostgreSQL test environment was
  configured; no PostgreSQL result is claimed.
- Signature: Codex

## 2026-08-12 — ACME-0098 token-limit handoff

- Date: 2026-08-12
- Author: Codex
- Task: ACME-0098
- Summary: Paused the frozen Stage 6 reviewer-operations/search task at the
  user's requested token-limit boundary. ACME-0097 ingestion/redaction is
  complete and archived; ACME-0098 remains in progress and unverified.
- Implemented, not yet accepted: reviewer assignment/comment/activity and
  bulk-review/search contracts; snapshot/repository extensions; file and
  PostgreSQL persistence with migration v6; and initial case-first API routes.
- Exact resume point: repair the four known TypeScript errors in
  `packages/evidence-product-contracts/src/operations.ts`, run typecheck, then
  complete UI, activity/assignment semantics, conformance, isolation/restart
  tests, full verification and documentation. See `docs/CURRENT_TASK.md` for
  the complete handoff.
- Verification: none claimed for the partial ACME-0098 implementation. The
  latest completed task, ACME-0097, passed its recorded gates before archive.
- Blockers: none known. Work stopped solely because the user requested a pause
  with approximately four percent of the weekly token allowance remaining.
- Signature: Codex

## 2026-08-12 — ACME-0094 Evidence secure artifact foundation ADR

- Owner: Codex
- Task: ACME-0094
- Status: Complete
- Decision: Accepted ADR-0037. Artifact originals, canonical text and future
  derivatives become immutable case-owned representations with explicit
  transformation provenance. Bytes live behind a provider-neutral port; local
  uses a controlled filesystem and hosted uses the self-hosted Supabase
  Storage S3-compatible endpoint with server-only credentials and a private
  bucket.
- Security: every representation is encrypted before storage with a random
  AES-256-GCM DEK and authenticated case/provenance metadata. A versioned
  injected key provider wraps DEKs; hosted POC keys arrive through root-owned
  mounted secret files. Reads verify scope, audit, ciphertext digest, GCM/AAD,
  plaintext length and digest before releasing bytes.
- Consistency/operations: staging, exclusive upload, verification, activation,
  quarantine and case-scoped reconciliation replace impossible cross-system
  transactions. Explicit deletion retains provenance/audit tombstones. A
  complete restore requires PostgreSQL, encrypted objects, digest manifest and
  the separately protected key catalogue.
- Audit: content-free append-only security events cover import, reads,
  authorization failures, key operations, integrity failures, exports,
  reconciliation and deletion. A successful audit write is required before
  plaintext artifact bytes leave the service.
- Authority: no code or deployment changed and every path remains
  `synthetic-only`. Storage readiness is not ingestion or data-use authority.
- Verification: `corepack pnpm docs:check` checked 194 Markdown files;
  `git diff --check` passed.
- Handoff: implement ADR-0037 in bounded ACME-0095 before Stage 5 ingestion or
  redaction work.

## 2026-08-12 — ACME-0093 Evidence case management and isolation implementation

- Owner: Codex
- Task: ACME-0093
- Status: Complete
- Summary: Implemented ADR-0036 end to end. Product-visible opaque cases own
  unique internal workspaces. Authenticated APIs and the browser now create,
  catalog/search, inspect, update, archive/restore and assign participants by
  `caseId`; browser payloads contain no workspace, actor, role or organization
  authority.
- Authorization: explicit active case-viewer/reviewer/admin membership gates
  case content. Organization-admin alone cannot read evidence. New review
  decisions record authenticated `evidence-review-decision/3` case policy
  context, while legacy `/1` and authenticated `/2` history stays immutable.
- Isolation and persistence: immutable case-object bindings cover workspaces,
  sources, observations, relations, questions, assessments, change sets, jobs
  and decisions in file/PostgreSQL adapters. Scope-aware writes validate all
  references before commit; PostgreSQL does so inside the write transaction.
  Participant changes atomically persist membership and the next case revision.
  Startup reconciliation fails closed on orphan, duplicate or contradictory
  case/workspace ownership while allowing resumable provisioning.
- Proof: same-organization black-boxes use known foreign source, observation,
  assessment, job and export identifiers across every current route family and
  receive non-disclosing refusal. Mixed-case relation/assessment writes roll
  back; the same immutable content may be explicitly bound to two cases without
  granting traversal between them. The legacy synthetic corpus reconciles into
  one case without changing evidence or historical review identities.
- Verification: typecheck, lint, boundaries, build and format passed; unit
  105 files / 682 tests, conformance 11 / 70, integration 11 / 57 and scenario
  7 / 26 passed; docs checked 192 Markdown files; `git diff --check` passed.
  `corepack pnpm test:postgres` refused exactly because no
  `ACME_POSTGRES_URL` or discrete PostgreSQL connection environment was
  configured; no gated test was silently skipped.
- Data authority: remains `synthetic-only`. No arbitrary ingestion, object
  storage, encryption/key lifecycle, redaction or non-synthetic path was added.
- Handoff: Stage 3 is complete. Activate the Stage 4 secure artifact foundation
  decision task before implementing object storage or sensitive ingestion.

## 2026-08-12 — ACME-0092 Evidence case management and isolation ADR

- Owner: Codex
- Task: ACME-0092
- Status: Complete
- Summary: Accepted ADR-0036 as the Stage 3 case/workspace boundary. Product
  routes use an opaque `caseId` over one immutable internal workspace mapping;
  explicit case membership supplies case-viewer, case-reviewer or case-admin
  authority, while organization-admin alone cannot read evidence. Every
  product object receives append-only case ownership, and repository, worker,
  citation, job and export traversal must start from case scope.
- Security decision: global-ID lookup followed by response filtering is not an
  accepted boundary. The implementation must prove same-organization
  cross-case non-disclosure across all current route families, known
  adversarial identifiers and mixed-case reference attempts. Existing
  synthetic data migrates into one explicit legacy case; contradictory or
  orphaned ownership fails closed.
- Scope: no code, arbitrary ingestion, encryption, redaction or non-synthetic
  authority was added. All cases remain permanently `synthetic-only` in Stage
  3.
- Verification: `corepack pnpm docs:check` checked 191 Markdown files for links
  and fences; `git diff --check` passed.
- Handoff: Activate ACME-0093 to implement ADR-0036, including case lifecycle,
  participants, case-first routes, durable ownership and executable isolation
  proofs.

## 2026-08-12 — ACME-0091 authenticated principal and authorization implementation

- Date: 2026-08-12
- Author: Codex
- Task: ACME-0091
- Branch: `dev/legal-evidence`
- Summary: Implemented ADR-0035 end to end. `@acme/evidence-auth` owns stable
  issuer/subject principals, organizations/memberships/workspace bindings,
  protected opaque sessions and the pure viewer/reviewer/organization-admin
  policy. Deterministic memory, durable PostgreSQL and verified Supabase Auth/
  JWKS adapters sit behind ports.
- Product boundary: All product API route families now require the opaque BFF
  session and a typed action. Unsafe operations enforce exact origin and CSRF;
  login is bounded, cookies are host-only HttpOnly/Secure/SameSite Strict in
  hosted mode, refresh stays server-side and logout revocation is monotonic.
  Workspace projections fail closed from durable change-set ownership so a
  populated foreign organization's sources, observations, history, jobs,
  assessments and exports are not traversable through another workspace.
- Compatibility: New browser writes use strict actor-free
  `evidence-review-command/2`; the server writes authenticated `/2` decisions
  with exact authorization context. Historical `/1` decisions remain
  immutable, readable and honestly `unauthenticated-local` after file reopen.
- Verification: typecheck, lint, format, boundary, docs, build and diff checks
  passed. Canonical suites passed 673 unit, 70 conformance, 57 integration and
  26 scenario tests. A focused auth/product/browser run passed 23 tests.
  Browser automation proved data-free login, authenticated exact-source review,
  queue update and logout back to a data-free shell.
- Gated environment evidence: `test:postgres` refused without an
  `ACME_POSTGRES_URL`; Docker Desktop was not running and no local PostgreSQL
  service existed. The suite now contains identity migration/restart/
  concurrency and authenticated product restart proofs. `test:supabase-auth`
  refused without explicit opt-in and dedicated test credentials; generated
  ES256/JWKS offline proofs passed. Neither refusal widens hosted or real-data
  authority.
- Handoff: Stage 2 is complete. Freeze the Stage 3 case/workspace management
  and isolation architecture task next. Every non-synthetic data path remains
  prohibited.
- Signature: Codex

## 2026-08-12 — ACME-0090 authenticated principal/authorization ADR

- Date: 2026-08-12
- Author: Codex
- Task: ACME-0090
- Branch: `dev/legal-evidence`
- Summary: Accepted ADR-0035 as the Stage 2 identity and authorization
  architecture. Self-hosted Supabase Auth owns hosted credentials and upstream
  sessions; the product API remains the only browser-facing service and issues
  an opaque HttpOnly BFF session so upstream tokens never enter browser
  JavaScript or local storage.
- Product authority: Stable principals derive from verified issuer/subject
  claims. Product-owned organizations, memberships and workspace bindings feed
  a deny-by-default viewer/reviewer/organization-admin role/action matrix.
  Browser commands may not supply reviewer/principal/role identity; the API
  creates the authorization context after session and membership checks.
- Compatibility: Existing `evidence-review-decision/1` records remain
  immutable and honestly `unauthenticated-local`. Implementation must add new
  actor-free commands and server-derived authenticated decision versions,
  fail-closed bootstrap/migrations and deterministic auth adapters. ADR-0035
  supersedes only ADR-0034's temporary identity choice, not its topology.
- Scope boundary: Documentation and decision only. No code, dependency,
  migration, deployment runtime, case management, object storage, ingestion,
  data class or Slice 9 authority changed. A separately reviewable
  implementation proposal is recorded in `docs/backlog/`.
- Verification: `corepack pnpm docs:check` passed for 185 Markdown files;
  `git diff --check` passed; traceability and changed-file scans passed.
- Handoff: No task is active. The recommended next task is the bounded
  ADR-0035 implementation; case isolation remains Stage 3 and all
  non-synthetic data remains prohibited.
- Signature: Codex

## 2026-08-12 — ACME-0087 Slice 5 product journey complete

- Date: 2026-08-12
- Author: Codex
- Task: ACME-0087
- Branch: `dev/legal-evidence`
- Summary: Completed and accepted the synthetic Evidence Integrity Workbench
  Slice 5 product journey. The product now supports assessment and immutable
  review history views, durable late-evidence attention, bounded assessment/
  re-review commands through worker and API, browser review and exact source-
  locator navigation, and deterministic reviewed-assessment ZIP export.
- Acceptance: The automated black-box proves E-A01 review, EVAL-E01 late
  import, exactly one attention notice, reaffirm and E-A02 branches, immutable
  prior assessment bytes, byte-deterministic/offline-resolvable export and
  synthetic-only refusal with technical audit disabled. The manual browser
  journey exercised the same reviewer path. File close/reopen and PostgreSQL
  conformance/restart persistence passed; PostgreSQL completed 27/27 tests.
- Fixture correction: ACME-0088 was superseded before implementation when its
  retained-question assumption failed. ACME-0089 then re-sealed pre-late E-A01
  with no question references and preserved all three post-import questions on
  E-A02, under the existing ADR-0030/0031 boundaries.
- Verification: `corepack pnpm typecheck`, `lint`, `format:check`, `boundaries`,
  `build` and `docs:check` passed. Direct canonical suites passed 657 unit, 70
  conformance, 57 integration and 26 scenario tests; focused correction tests
  passed 10/10; `git diff --check` passed. Root `corepack pnpm test` could not
  enter nested scripts because global pnpm 10.33.4 did not satisfy the repo's
  10.34.5 requirement; all four wrapped suites passed directly via Corepack.
- Handoff: Slice 5 is complete and no task is active. Authentication/case
  isolation/security stages and Slice 9 remain separately activatable; no
  non-synthetic path is authorized.
- Signature: Codex

## 2026-08-12 — ACME-0089 source-bound E-A01 fixture correction

- Date: 2026-08-12
- Author: Codex
- Task: ACME-0089 (child of ACME-0087)
- Summary: Added a regression that resolves every E-A01 question trigger to
  its observation or relation endpoints and requires them to exist before
  EVAL-E01. The test first proved E-Q02 and E-Q03 depended on late evidence;
  together with the already identified E-Q01 dependency, no sealed question
  was valid for pre-late E-A01.
- Change: Set E-A01 `openQuestionTruthIds` to `[]`. Its new content hash is
  `976d87be755d0d5cce677078f26959fe36d29dcfe8573a00d4b582f386bed25b`
  and version ID is
  `evidence_assessment_1e71cb81d7bc51f4f1bfc321fddeeb2fdb11bb3ffc6ee556a5dc4a6188f610d3`.
  E-A02 keeps its semantic content and E-Q01/E-Q02/E-Q03; only the derived
  predecessor reference changed, yielding content hash
  `8c0a4750d401b89ae921eb81e860eaefa9199d34f8ff2fd89f44015049c643a1`
  and version ID
  `evidence_assessment_dd20c80adcbf410b591003b553d10ac338b28317ef9f810c108b5cba2e8f8606`.
- Verification: Focused corpus/identity/assessment/view/API tests passed 10/10;
  the full static, build, docs and direct canonical-suite results are recorded
  in ACME-0089 and the parent completion entry above.
- Handoff: Child archived; parent resume condition satisfied.
- Signature: Codex

## 2026-08-12 — ACME-0087 implementation checkpoint and fixture blocker

- Date: 2026-08-12
- Author: Codex
- Task: ACME-0087 (`In Progress`; acceptance withheld)
- Branch: `dev/legal-evidence`
- Summary: Implemented the two missing Slice 5 primary views, assessment work-
  queue/attention behavior, durable product change sets in file/PostgreSQL,
  bounded assessment execution and re-review API/worker commands, browser
  assessment/history/source-locator controls and the normative deterministic
  reviewed-assessment ZIP. The product black-box covers E-A01, EVAL-E01,
  reaffirm, E-A02, immutable prior assessment bytes, offline citations,
  synthetic-only refusal and file close/reopen.
- Browser findings: A manual in-app-browser journey accepted eight observations
  and five relations, created/accepted E-A01, navigated EVAL-T03 v1 exactly to
  line 6, downloaded the ZIP, imported EVAL-E01, observed exactly one notice,
  reaffirmed and inspected append-only history. It exposed and led to fixes for
  a Windows file-repository read/write rename race and a competing-render race
  that could hide Review history after re-review; both now have regression
  coverage.
- PostgreSQL: the gated suite initially exposed an omitted method in its lazy
  conformance wrapper. After correction, `ACME_POSTGRES_URL=postgresql://acme:acme@127.0.0.1:55432/acme corepack pnpm test:postgres`
  passed 27/27, including
  assessment/change-set/review restart retention. The pre-existing local test
  container was used and left unchanged.
- Verification checkpoint: root typecheck, lint, format check, boundaries and
  build passed. Direct Corepack runs passed 655 unit/hermetic, 70 conformance,
  57 integration and 26 scenario tests. The `pnpm test` wrapper itself stopped
  before tests because its nested command resolved global pnpm 10.33.4 while
  the repository requires 10.34.5; the same four canonical suites passed when
  invoked directly through Corepack. Focused tests pass after the browser fixes
  and normative newer-evidence manifest correction.
- Acceptance blocker: final source-binding audit found that sealed E-A01
  requires `BOUNDED_EXACT_TIME_DIFFERENCE`
  (`evidence_question_7cea928bd8c09d26a584f8563488aaed86e32c312c311d260ddcf855bc6dd3a1`),
  whose trigger set includes an EVAL-E01 observation. The frozen journey creates
  and accepts E-A01 before EVAL-E01 import. Keeping it creates a forward/dangling
  product reference; removing it changes E-A01 content hash and version ID;
  moving import order changes the frozen goal. No option is authorized inside
  ACME-0087.
- Handoff: Do not archive ACME-0087 or call Slice 5 complete. Recommended next
  authority is a bounded child task that corrects and re-seals E-A01 using only
  pre-EVAL-E01 open questions, then restores and completes this parent. The
  alternative is to supersede the journey/order explicitly. No real-data or
  Slice 9 work is authorized.
- Signature: Codex

## 2026-08-12 — ACME-0087 Draft and product completion sequence

- Date: 2026-08-12
- Author: Codex
- Task: ACME-0087 (Draft activation; no implementation)
- Branch: `dev/legal-evidence`
- Summary: Recorded the approved Evidence Integrity Workbench product-
  completion sequence in
  `docs/design/evidence-integrity-workbench-product-completion-plan.md` and
  activated ACME-0087 as a complete Draft charter. Repository inspection
  confirmed that ACME-0082 delivered assessment domain core, attention helpers,
  product assessment storage and a deterministic canonical-JSON helper, while
  the normative assessment/review-history views, full API/worker/browser re-
  review journey and `evidence-reviewed-assessment-export/1` ZIP remain absent.
- Scope: ACME-0087 closes only the existing synthetic Slice 5 capability:
  E-A01 review, EVAL-E01 late-evidence attention, reaffirm/E-A02, exact source
  navigation, review history and deterministic reviewed-assessment export.
  Authentication, case management, secure ingestion, Case Integrity Report,
  Slice 9 and every non-synthetic path remain outside the Draft charter.
- Documentation: Synchronized PROJECT_BRIEF, CURRENT_STATUS, SYSTEMDOC,
  FILESTRUCTURE, the design index and the normative technical specification
  with the active Draft and actual Slice 5 completion state.
- Verification: `corepack pnpm docs:check` passed over 179 Markdown files;
  `git diff --check` passed. Code gates were not run because this change creates
  planning/task documentation and changes no runtime behavior.
- Handoff: Review the ACME-0087 charter. If accepted without semantic changes,
  set status to `Ready`, record the freeze timestamp and begin its ordered
  checklist. No blocker or open charter question is recorded.
- Signature: Codex

## 2026-08-12 — ACME-0086 Hosted shell

- Date: 2026-08-12
- Author: Grok
- Task: ACME-0086
- Branch: `dev/legal-evidence`
- Summary: Delivered Evidence Integrity Workbench slice 8. Accepted ADR-0034
  (single-user hosted identity, no Supabase Auth). Added `/health`, deploy
  compose under `deploy/evidence-workbench/`, hosted ops notes, and a gated
  PostgreSQL restart black-box proving review decisions survive process
  close/reopen on the product store.
- Verification: hermetic suite green; `pnpm test:postgres` including restart
  proof (when ACME_POSTGRES_URL is set).
- Handoff: slice 9 readiness is governance-only and is not activated.
- Signature: Grok

## 2026-08-12 — ACME-0085 PostgreSQL slice 7 adapters

- Date: 2026-08-12
- Author: Grok
- Task: ACME-0085
- Branch: `dev/legal-evidence`
- Summary: Implemented Evidence Integrity Workbench slice 7 against ADR-0033.
  Delivered `@acme/adapter-postgres` (schema `acme`: ExecutionRepository +
  QualityEvaluationStore, injected `pg` pool, advisory-locked migrations,
  SQLSTATE driver mapping, READ COMMITTED UoW with CAS, atomic SKIP LOCKED
  outbox lease, REPEATABLE READ multi-statement reads) and
  `@acme/adapter-evidence-product-postgres` (schema `evidence`, file-snapshot
  translation). Roles/revocation SQL, schema-per-test gated suite
  (`pnpm test:postgres`, refuses without connection), CI postgres job, CLI
  `--adapter postgres`, workbench `ACME_PERSISTENCE=postgres`, and
  `docs/ops/postgresql-operations.md`. Environment facts: PG 15, direct 5432,
  never transaction pooler 6543. Shared conformance kits unchanged.
- Verification: `pnpm test:postgres` 25/25 on ephemeral `postgres:15`
  (`ACME_POSTGRES_URL=postgresql://acme:acme@127.0.0.1:55432/acme`). Typecheck
  green. Hermetic suite and remaining docs gates recorded with the same
  handoff. No live provider calls. No commit/push (parent owns that).
- Documentation: CURRENT_STATUS, SYSTEMDOC, FILESTRUCTURE, technical-spec
  slice 7 status, package READMEs, ops doc; task archived as
  `docs/finished/ACME-0085_postgresql-slice-7.md`; CURRENT_TASK restored from
  template.
- Handoff: next product slice is hosted shell (slice 8) after
  identity/authorization ADR; SQLite remains hermetic default.
- Signature: Grok

## 2026-08-12 — ACME-0084 PostgreSQL persistence architecture

- Date: 2026-08-12
- Author: Claude
- Task: ACME-0084
- Branch: `dev/legal-evidence`
- Summary: Froze the ACME-0084 charter and delivered ADR-0033, the PostgreSQL
  persistence architecture, which was slice 7's remaining prerequisite after
  ACME-0083 closed slice 6. The ADR decides eleven areas with mechanisms rather
  than intents: `pg` with an injected pool the adapter never owns and a direct
  connection port; separate `acme` and `evidence` schemas under separate roles
  with no cross-schema foreign key or transaction and separate migration
  ledgers; browser isolation as an executable anonymous-role denial gate; one
  `READ COMMITTED` transaction per Unit of Work with compare-and-swap by
  conditional update and affected row count; outbox leasing by
  `FOR UPDATE SKIP LOCKED` under unchanged ADR-0018 semantics; canonical JSON,
  timestamps and hashes as `text` because content-derived identity requires
  byte fidelity; the ADR-0003/0013 migration format with a transaction-scoped
  advisory lock and an authoritative explicit migrate command; SQLSTATE-keyed
  error classification; transaction-scoped client checkout with repeatable-read
  multi-statement read sets; an ephemeral plain-PostgreSQL CI environment with
  schema-per-test isolation; and one instance per data classification rather
  than per POC. ADR-0029's two open items are closed.
- Decisions worth naming: `jsonb` and `timestamptz` are refused because they
  re-canonicalize and would silently break the content-derived identities, the
  operation digest and replay equality. `SERIALIZABLE` is refused because the
  losing writer would fail with a serialization error instead of the
  `CONFLICT_STATE_REVISION` the existing proofs assert. Idempotency moves from
  select-then-insert to `ON CONFLICT DO NOTHING` plus row count, because the
  SQLite form is safe only under `BEGIN IMMEDIATE` and races under
  `READ COMMITTED`.
- Confirmed against the repository rather than assumed: the
  `ExecutionRepository` port is already `Promise`-based, so an asynchronous
  driver needs no core change; `test:conformance` runs against the default
  vitest configuration, so PostgreSQL gates must be excluded from it to keep
  the default suite hermetic; and the ADR-0018 claim order is `occurred_at`
  then `event_id`.
- Verification: documentation-only baseline per `AGENTS.md`.
  `corepack pnpm docs:check` passed over 169 files; `git diff --check` passed.
  Code gates were not run because the task adds no code, dependency, schema,
  migration or runtime behavior. No PostgreSQL server or container was used;
  this task decides the verification environment, slice 7 builds it. Mermaid
  validation was not applicable: the ADR contains no diagram.
- Documentation: ADR-0033 created; `docs/adr/README.md`,
  `docs/design/evidence-integrity-workbench-technical-specification.md`
  (deferred-decision row, slice 7 prerequisites and gates, section 11),
  `docs/CURRENT_STATUS.md` and `docs/SYSTEMDOC.md` synchronized.
  `docs/FILESTRUCTURE.md` is correctly unchanged: the ADR adds one file to an
  already-mapped directory and creates no package, application or directory.
- Safety: no code, no provider call, no external effect, no data path. A
  persistence decision cannot widen product authority, and the ADR-0028 and
  product definition V1 restrictions are untouched.
- Handoff: maintainer review completed the same day. ACME-0084 is archived as
  `docs/finished/ACME-0084_postgresql-persistence-architecture.md`, and slice 7
  is activated as ACME-0085 in `docs/CURRENT_TASK.md`, deliberately left as a
  `Draft` with six open questions rather than frozen. Two environment facts are
  deferred to that charter to observe rather than assume: the direct PostgreSQL
  port and the PostgreSQL major version of the deployed self-hosted release,
  neither of which can be answered from the repository.
- Signature: Claude

## 2026-08-12 — ACME-0095 secure artifact foundation

- Date: 2026-08-12
- Author: Codex
- Task: ACME-0095
- Summary: Implemented ADR-0037 end to end for the fixed synthetic corpus.
  Canonical source text is now an immutable representation encrypted with a
  per-object AES-256-GCM DEK; product persistence retains only a placeholder,
  immutable hashes/envelopes/lifecycle and content-free security audit.
- Contracts and policy: added versioned representation, envelope, staging,
  lifecycle, audit and backup-manifest schemas; provider-neutral object/key
  ports; exact crash retry; fail-closed read; KEK re-wrap; reconciliation;
  revisioned deletion; and restore verification.
- Adapters and persistence: added controlled filesystem and SigV4
  S3-compatible ciphertext stores under one conformance contract, plus atomic
  file/PostgreSQL artifact metadata and audit with migration v4. Same command
  concurrency converges on one staged object and activation.
- Product path: local startup migrates existing synthetic sources without
  changing Evidence identities or locators. Authenticated API reads audit the
  server-derived principal before plaintext release; exports and denied reads
  are audited. Case admins have content-free audit/artifact views, DEK re-wrap
  and revisioned tombstoned deletion. Hosted startup refuses without mounted
  KEK/S3 secret files and private S3 configuration.
- Operations: added the artifact runbook for staging, rotation, deletion and
  coordinated database/object/key backup and isolated restore. Compose now
  mounts credentials and keys as secrets.
- Verification: typecheck, lint, boundaries, build, format, docs and diff
  checks pass. Unit passes 111 files/695 tests (one first-run 5.033s timeout
  under full load passed unchanged at 4.447s on immediate rerun), conformance
  12/74, integration 12/62 and scenario 7/26. Focused crypto/object/artifact/
  API and secret-scan gates pass. PostgreSQL gate refused exactly because no
  configured environment exists; S3 conformance used the hermetic signed
  transport.
- Data authority: unchanged. There is no arbitrary byte input and no
  non-synthetic path.
- Follow-up: freeze the bounded text ingestion and redaction architecture as
  the next sequential task.
- Signature: Codex

## 2026-08-12 — ACME-0096 bounded text ingestion and redaction ADR

- Date: 2026-08-12
- Author: Codex
- Task: ACME-0096
- Summary: Accepted ADR-0038 as the Stage 5 architecture. It permits only one
  bounded synthetic strict-UTF-8 plain-text input class and explicitly refuses
  active/binary/document/media formats and every non-synthetic path.
- Decision: accepted imports preserve separately encrypted exact-original and
  LF/NFC canonical representations and activate them atomically. Evidence
  identity and `line-range-1` locators remain bound to the exact canonical
  version. Redaction creates a new immutable source/representation from sorted,
  non-overlapping, non-newline-spanning UTF-8 byte ranges and appends a log of
  operations and removed-byte hashes without removed content. Existing
  evidence never retargets.
- Security: pinned role/action boundaries, synthetic attestation, request/
  content/count/rate limits, two-object staging/recovery, audit, explicit
  export semantics and same-organization cross-case non-disclosure proofs.
- Verification: ADR/data-class/identity/redaction/threat matrices reviewed;
  `corepack pnpm docs:check` and `git diff --check` pass.
- Data authority: unchanged; this task adds no input route or behavior.
- Follow-up: implement ADR-0038 as a separately frozen synthetic-only task.
- Signature: Codex

## 2026-08-12 — ACME-0097 bounded text ingestion and immutable redaction

- Date: 2026-08-12
- Author: Codex
- Task: ACME-0097
- Summary: Implemented ADR-0038 end to end for the single
  `synthetic-utf8-plain-text/1` class. Case-first authenticated browser/API
  import validates bounded strict UTF-8, media/signature/control/line limits,
  derives server identities and stores exact-original plus LF/NFC canonical
  bytes as distinct encrypted objects.
- Durability and isolation: deterministic logical/import identities, staged
  envelopes, command digests and durable records make exact resubmission
  idempotent and changed resubmission collide. File serialization and
  PostgreSQL migration v5 persist import/draft/log state; competing artifact
  ordinals are rejected. Cancellation is pre-activation only and expired
  staging reconciles to quarantine. Every projection uses immutable case
  bindings.
- Redaction: reviewers save exact UTF-8 byte-range drafts; case admins apply a
  frozen revision. Scalar splits, overlaps, LF spans and removed-byte digest
  mismatches refuse. Apply creates a new encrypted `redacted-text` source
  version and append-only log without removed text; old locators and evidence
  remain on their original version.
- Product proof: the Documents UI imports, navigates, drafts and applies. The
  case-first black box verifies two independent input representations,
  redacted source navigation, content-free log and file restart. Shared
  file/PostgreSQL repository conformance covers the new records.
- Verification: typecheck, lint, boundaries, build, format and format-check
  pass; unit 112 files/704 tests, conformance 12/75, integration 12/62 and
  scenario 7/26 pass; docs check 199 Markdown files and diff-check pass.
  PostgreSQL refused exactly because no connection environment exists; S3 is
  covered by its hermetic signed-transport conformance.
- Data authority: unchanged. PDF/DOCX/OCR/media, non-synthetic and every other
  class remain refused pending Slice 9.
- Follow-up: Stage 6 reviewer operations and corpus-scale navigation.
- Signature: Codex

## 2026-08-11 — ACME-0083 Secondary technical audit

- Date: 2026-08-11
- Author: Grok
- Task: ACME-0083
- Branch: `grok/poc_3-8`
- Summary: Added technical provenance and replay view contracts/builders and
  API routes under `/api/technical/*` that return 404 when
  `technicalAudit.enabled` is false (default). Primary journey unchanged.
- Handoff: slice 7 PostgreSQL adapter next (ADR-0029 platform).
- Signature: Grok

## 2026-08-11 — ACME-0082 Assessment and re-review core

- Date: 2026-08-11
- Author: Grok
- Task: ACME-0082
- Branch: `grok/poc_3-8`
- Summary: Delivered Evidence Integrity slice 5 domain core. Registered
  `evidence.propose-assessment@1.0.0` with citation validation and
  non-incrementing assessment document commits; attention-tier A/B and
  change-set helpers; deterministic synthetic-only assessment export;
  product assessment storage; sealed E-A01/E-A02 evaluation fixtures pinned
  to golden identities.
- Verification: typecheck, lint, format:check and full test suite passed
  (647 unit / 69 conformance / 57 integration / 26 scenario).
- Handoff: slice 6 technical audit next; complete browser assessment
  re-review black-box and hosted export UX can deepen later if needed.
- Signature: Grok

## 2026-08-11 — ACME-0081 Timeline and open questions

- Date: 2026-08-11
- Author: Grok
- Task: ACME-0081
- Branch: `grok/poc_3-8`
- Summary: Completed Evidence Integrity Workbench slice 4. Added pure
  `evidence-temporal-overlap-1` and `buildEvidenceTimelineEntries`, registered
  deterministic `evidence.build-timeline@1.0.0`, and pure primary timeline and
  open-question views with API/web navigation. Timeline ordering is
  permutation-stable; unknown never overlaps; overlapping non-exact bounds
  form ambiguity bands without inventing precision.
- Verification: typecheck, lint, format:check, full test (644 unit / 69
  conformance / 57 integration / 26 scenario), docs:check and build passed.
- Safety: no live provider or non-synthetic path.
- Handoff: activate slice 5 assessment and re-review next.
- Signature: Grok

## 2026-08-11 — ACME-0080 Evidence relations and uncertainty

- Date: 2026-08-11
- Author: Grok
- Task: ACME-0080
- Branch: `grok/poc_3-8`
- Summary: Completed Evidence Integrity Workbench slice 3. Implemented
  `evidence.relate-observations@1.0.0` with input/output schemas, prompt
  contract, interpretation, contest projection and module registration.
  Evaluation fixtures derive eight golden relations and three open questions
  from the sealed golden builder; the offline scenario commits those exact
  identities, leaves the ambiguous actor unresolved, contests three changed-
  account observations and keeps two correction predecessors superseded.
- Product boundary: product snapshot stores relations and open questions;
  pure primary relation-review view and work-queue relation items; API
  `/api/relations` and browser Relations navigation; evaluation seed runs
  observe then relate with the deterministic mock. Technical audit remains
  disabled.
- Contest rule: only `contradicts` contests current statement endpoints;
  exhibit assertions and correction successors that conflict with a later
  different logical artifact stay current; scope-mismatch/qualifies do not
  contest.
- Verification: offline install, `typecheck`, `lint`, `format:check`,
  `boundaries`, `docs:check`, `build`, aggregate `test` and `git diff --check`
  passed after Prettier fix. Unit suite 641/641 in 92 files, conformance
  69/69 in 11, integration 57/57 in 11, scenario 26/26 in 7. No check skipped.
- Safety: no live provider call, network-backed corpus, credential, deployment
  or non-synthetic data path was used.
- Handoff: activate slice 4 as a separate charter for timeline and open-
  question primary views (`evidence.build-timeline@1.0.0`). Assessment,
  technical audit, PostgreSQL and hosted shell remain later slices.
- Signature: Grok

## 2026-08-11 — ACME-0079 Compare evidence accounts

- Date: 2026-08-11
- Author: Codex
- Task: ACME-0079
- Branch: `main`
- Summary: Completed Evidence Integrity Workbench slice 2. Five deterministic
  offline evaluation executions now produce all ten sealed expected
  observations before the harness opens truth; the immutable ledger retains
  eight current and two superseded occurrences.
- Correction boundary: ADR-0032 defines one shared, fail-closed V1 pairing
  rule over explicit adjacent `transcription-correction` lineage. Exact kind,
  line range and source actor/time roles pair the two `EVAL-T01` predecessors
  with their corrected successors. Missing, ambiguous, incomplete,
  cross-artifact and later changed-account pairings are refused, and the model
  cannot request supersession.
- Product boundary: added pure primary observation-ledger and account-
  comparison views, product API routes, browser navigation to all three
  relevant source versions, and a bounded evaluation seed mode. The corrected
  transcript and later `EVAL-T02` account stay visibly distinct; technical
  audit remains disabled and sealed truth identifiers do not enter browser
  payloads.
- Idempotency and proof: exact duplicate import/execution produces no sixth
  gateway invocation, new observation, standing change or Evidence revision.
  The sealed scenario proves all ten observation identities, the two
  `E-R01`/`E-R02` mechanical pairs and the final 8/2 standing projection.
- Verification: offline install, `typecheck`, `lint`, `format:check`,
  `boundaries`, `build`, aggregate `test`, `docs:check` and `git diff --check`
  passed. Tests were 639/639 in 90 main-suite files, 69/69 conformance in 11,
  57/57 integration in 11 and 25/25 scenario tests in 6. A temporary
  PATH-local Corepack pnpm 10.34.5 shim was used for nested test scripts and
  removed afterward. No check was skipped.
- Browser smoke: started the loopback workbench on port 8790 with a separate
  evaluation product file, confirmed the 10 total / 8 current / 2 superseded
  ledger, rendered both correction pairs and the later changed account, and
  opened the exact original `EVAL-T01` source lines. Existing slice-1 local
  review data was preserved.
- Safety: no live provider call, network-backed corpus, provider spend,
  credential, deployment, publication or non-synthetic data path was used.
- Handoff: activate slice 3 as a separate charter for general observation
  relations. Contradiction, qualification, scope mismatch and unresolved-
  relation review intentionally remain absent from slice 2.
- Signature: Codex

## 2026-08-11 — ACME-0078 Evidence review of one source

- Date: 2026-08-11
- Author: Codex
- Task: ACME-0078
- Branch: `main`
- Summary: Completed Evidence Integrity Workbench slice 1. The new offline
  reviewer journey imports immutable `DEV-T01` v1, runs the deterministic
  `evidence.observe-artifact@1.0.0` task through the unchanged ACME engine,
  presents exact numbered source lines and source-bound proposed observations,
  and records append-only version-bound review decisions.
- Domain boundary: implemented strict quote, kind, actor-roster, ambiguity,
  clock-source and prohibited-conclusion validation before canonical commit.
  Stable documents, observation memories, Evidence state projection,
  diagnostics and a bounded event are derived only after validation.
- Product boundary: added separate product contracts, an atomic file-backed
  source/job/review repository, pure work-queue and source-review views, and a
  minimal loopback API/web/worker composition. Technical-audit routes remain
  absent by default and the local composition seeds only synthetic development
  data.
- Replay and resilience: repeated import is idempotent; divergent command-key
  reuse is rejected; replay reports `match`; and an injected interruption after
  the provider record resumes with one total gateway invocation.
- Development metrics: 2/2 exact quote binds, 2/2 actor resolutions and 2/2
  temporal normalizations on the finite `DEV-T01` fixture. These are labelled
  development-corpus results, not a model comparison or production claim.
- Verification: `typecheck`, `lint`, `format:check`, `boundaries`, `docs:check`,
  `build` and `git diff --check` passed. The offline aggregate test passed with
  634/634 tests in 87 main-suite files, 69/69 conformance, 57/57 integration
  and 24/24 scenario tests. A temporary PATH-local Corepack pnpm 10.34.5 shim
  was used because nested scripts otherwise resolved desktop pnpm 11.16.0; it
  was removed afterward. A browser smoke test also opened an exact citation,
  recorded an accepted review and verified that the second proposal remained
  queued; a regression test prevents blocking prompt-based review. No checks
  were skipped.
- Safety: no live provider call, network-backed corpus, provider spend,
  deployment, publication, credential or non-synthetic data path was used.
- Documentation: synchronized the task charter, project/status/system/structure
  docs, Evidence technical specification, package/app readmes and this handoff.
  ADR-0030 and ADR-0031 remained sufficient; no new architecture decision was
  needed.
- Handoff: activate a separate slice-2 charter to compare corrected and changed
  accounts over the sealed evaluation harness. Hosted framework migration,
  cross-process recovery and later Evidence views remain outside this slice.
- Signature: Codex

Add one dated, signed entry for every meaningful work session or handoff.

## 2026-08-11 — ACME-0077 Evidence corpus and contracts foundation

- Date: 2026-08-11
- Author: Codex
- Task: ACME-0077
- Branch: `main`
- Summary: Completed and archived Evidence Integrity Workbench slice 0. Added
  the pure `@acme/module-evidence` domain foundation and the
  `@acme/evidence-testing` corpus/golden package without adding an executable
  Evidence task, reviewer surface, provider call, database or product claim.
- Corpus: authored the exact `rillford-annex-review-1` inventory — seven
  logical synthetic, non-criminal text artifacts in eight immutable versions.
  The manifest pins canonical UTF-8/LF/NFC bytes, content hashes, line counts,
  partition namespaces and the explicit `EVAL-T01` v1→v2 transcription-
  correction lineage. Scratch, development and evaluation actors/events are
  disjoint.
- Truth and golden proof: authored scratch and open development truth plus the
  separately loaded sealed evaluation truth. The evaluation set validates ten
  source-bound observations, eight scoped relations, three open questions,
  two immutable assessment versions, exact actor/time counts, scenarios and
  coupling groups. Every quote resolves exactly once in its declared line
  range and every truth/citation/correction/actor/relation reference resolves.
  Committed `evidence-golden-run/1` outputs rebuild by value and the identity
  vectors cover source, locator, actor, observation, proposition, event,
  relation, question and assessment algorithms.
- Domain foundation: exported every ADR-0030 V1 schema identifier, named
  canonical-JSON/SHA-256 identities, source/observation invariants, compact
  identifier-only `evidence-state/1` and `evidence-delta/1`, pure reducer,
  revision/standing/correction/relation/assessment invariants and a
  deterministic memory policy. Correction deltas name and create the current
  successor in the same operation. The four future task identities are frozen
  catalogue metadata with `implemented: false`; `evidenceModule.tasks` is
  empty by design.
- Sealed boundary: the normal testing entry exposes manifest, source bytes and
  scratch/development truth only. Evaluation truth requires
  `@acme/evidence-testing/evaluation`. A prompt dependency guard, dependency-
  cruiser rule and negative fixture prove prompt-capable module/app source
  cannot import it.
- Tests: added 18 focused corpus, golden, identity, schema, state, invariant,
  memory, module and prompt-guard tests plus Evidence module conformance.
  Repository totals observed after the change are 621 tests across 80 files in
  the main Vitest configuration, 66 conformance tests, 56 integration tests
  and 24 scenario tests.
- Verification: `corepack pnpm install --offline`, `typecheck`, `lint`,
  `format:check`, `boundaries`, exact aggregate `test`, `docs:check` (159
  Markdown files), `build` and `git diff --check` passed. Deterministic open
  and sealed corpus validation returned no issues and all committed golden
  runs matched their rebuild. The desktop PATH initially exposed global pnpm
  11.16.0 to nested scripts; a temporary PATH-local shim invoked the
  repository-pinned Corepack pnpm 10.34.5 for the exact aggregate test and was
  removed immediately afterward. No verification was skipped.
- Safety: no live gate, model/provider call, external corpus acquisition,
  network dependency fetch, deployment, remote mutation, publication or spend
  occurred. The pre-existing untracked `package-lock.json` and all ACME-0076
  work were preserved.
- Documentation: synchronized the technical specification implementation
  status, `PROJECT_BRIEF`, `CURRENT_STATUS`, `SYSTEMDOC`, `FILESTRUCTURE`,
  package READMEs and this journal. No new architecture decision surfaced, so
  ADR-0030/0031 remain sufficient.
- Handoff: slice 0 is complete. The next recommended product task is a
  separately frozen slice 1 charter for one-source import, proposed observation
  review and exact source navigation. Product review storage/views, relation,
  timeline, assessment, PostgreSQL, hosting and non-synthetic data remain out
  of scope and absent.
- Signature: Codex

## 2026-08-11 — ACME-0076 Evidence Integrity technical specification

- Date: 2026-08-11
- Author: Codex
- Task: ACME-0076
- Branch: `main`
- Summary: Completed and archived the implementation-ready technical plan for
  the Evidence Integrity Workbench without adding product code. The normative
  `docs/design/evidence-integrity-workbench-technical-specification.md` now
  fixes the synthetic corpus contract, annotation/golden-output protocol,
  Evidence-domain contracts and placement, primary and secondary views,
  reviewer overlay, deterministic assessment export, proof matrix and ordered
  slices 0–9.
- Corpus freeze: one fictional non-criminal administrative matter, exactly
  seven logical text artifacts in eight immutable versions. Prompt scratch is
  separate from the open development transcript/exhibit pair and the sealed
  evaluation core. The sealed truth requires ten L1 observations with exact
  final standings, eight L3 relations, three open questions, two assessment
  versions, ten temporal expectations and an explicit duplicate/replay/resume
  scenario order. Canonical text is UTF-8/LF/NFC and citations use one-based
  inclusive line ranges with unique exact-substring validation.
- ADR-0030: accepted Evidence V1 identity and canonical placement. It freezes
  named canonical-JSON/SHA-256 identities, correction lineage versus changed
  accounts, product-side immutable source documents, domain memory for
  observations/relations/questions, ACME immutable assessment documents and a
  compact revisioned state index. `evidence.observe-artifact@1.0.0` is the
  first model-backed task; relation, timeline and assessment work stay in later
  task boundaries.
- ADR-0031: accepted the append-only, application-owned review overlay and
  versioned view boundary. Nine primary-domain views form the reviewer path;
  two secondary views expose technical provenance/replay only when enabled.
  Every decision targets an exact immutable version and V1 records
  `unauthenticated-local` principal assurance. Shareability and new-evidence
  attention are derived without mutating evidence or model-scored relevance.
- Product proof: froze the Primary Product Rule, a full domain black-box test
  with `technicalAudit.enabled = false`, and a schema/string
  forbidden-vocabulary scan. The main result must be reviewer work, never
  execution status, test results, a quality score or internal state. The ACME
  contribution table separately maps exact source tracing, coexistence,
  uncertainty, scoped contradiction, immutable revisions, resume and replay to
  their engine properties.
- Evaluation: every correct-at-100% requirement is a hard gate. Small semantic
  denominators use absolute counts, abstention is a false negative where truth
  exists, correct unresolved output is positive for the ambiguous case and
  eligible configurations compare precision, recall, cost and latency without
  a composite score. Ten negative-fixture categories cover prohibited legal,
  credibility, sensitive-inference, actor-merge, time and quote outputs.
- Delivery boundary: SQLite remains the local/CI default. Slice 7 requires a
  new PostgreSQL schema/transaction/migration ADR and targets self-hosted
  Supabase through plain PostgreSQL wire only. Identity/authorization,
  object-store consistency and every non-synthetic path retain separate later
  ADR gates. No Supabase component beyond the decided PostgreSQL platform was
  adopted.
- Documentation: synchronized `PROJECT_BRIEF`, `CURRENT_STATUS`, `SYSTEMDOC`,
  `FILESTRUCTURE`, the design/ADR indexes and this journal. ACME-0076 is
  archived under `docs/finished/`; `docs/CURRENT_TASK.md` is restored from the
  repository template with no next task activated.
- Verification: deterministic structure review confirmed 7 corpus inventory
  rows, 10 evaluation observation rows, 8 evaluation relation rows, 9 primary
  views, 2 secondary views, 10 slices and one Mermaid block. Authority,
  product separation, attention derivation and dependency directions were
  reviewed against the traceability matrix. `corepack pnpm docs:check` checked
  157 Markdown files with links and fences clean; Prettier accepted every
  changed Markdown file; `git diff --check` passed. The specification's one
  Mermaid diagram was reviewed by hand. Automated Mermaid validation was
  deliberately skipped for this exact reason: the repository has no Mermaid
  validator, and `tooling/docs/check-docs.mjs` verifies internal links and
  balanced fences only. Code gates were not run because the task changes only
  documentation and accepted architecture. The pre-existing untracked
  `package-lock.json` was preserved and untouched. No network or provider call,
  deployment, package publication or spend occurred.
- Handoff: no blocker remains in the planning task. The recommended next
  product task is a separately approved slice 0 charter: author the corpus and
  golden truth, implement the Evidence schema/identity/state foundation and
  prove its deterministic conformance. No implementation is active yet.
- Signature: Codex

## 2026-08-11 — ADR-0029 persistence platform and ACME-0076 Draft revision

- Date: 2026-08-11
- Author: Claude
- Task: no task created; a maintainer decision was recorded and the ACME-0076
  `Draft` charter was revised while still editable.
- Branch: `plan/legal-evidence`
- Decision recorded: the POC #1 persistence platform is self-hosted Supabase.
  The decision is the maintainer's and predates this session, but it existed
  only in commit `f570dba`'s message and in no governing document, while
  ADR-0028 and the product definition still said no vendor was selected. It is
  now normative as ADR-0029 instead of being carried implicitly by a task.
- ADR-0029 scope: it selects the platform, requires the ACME repository adapter
  to speak the PostgreSQL wire protocol rather than PostgREST or the Supabase
  client libraries, and forbids exposing ACME schemas to a browser through
  PostgREST or an anonymous key. Supabase Auth, Storage, Realtime and Studio
  adoption, the object store, hosting environment, backup/restore, upgrade and
  key lifecycle remain open. No V1 restriction is weakened; no implementation
  is authorized.
- Supersession handled explicitly: ADR-0028 keeps its original text and gains a
  dated partial-supersession note; the product definition gains pointers in its
  persistence baseline, deferred-decisions list and sources. Neither document
  was rewritten.
- ACME-0076 review findings fixed while `Draft`: (1) two minimum verification
  gates demanded fixtures and implementation proof that the same charter puts
  Out of Scope, and are now stated as reviews of the specification; (2) the
  charter did not say whether this task authors the synthetic corpus or only
  specifies it — it now specifies, and authoring moves to the first
  implementation slice; (3) one Definition-of-Done item was conditional
  ("if model comparison is in scope") and another was unmeasurable
  ("complete enough"), and both are now unconditional and countable against the
  product definition's concept table and L0–L5 authority ladder. The charter
  also now references ADR-0029 rather than implying a platform choice.
- Second revision round, directed by the maintainer in the same session, closed
  the three items the first round had left open. Mermaid validation is now a
  required gate rather than an open question: diagrams are reviewed by hand and
  the absent automated validation is recorded as a deliberately skipped check,
  because the repository has no Mermaid validator and `check-docs.mjs` verifies
  internal links and balanced fences only. Documentation Updates is no longer
  conditional: every target is required, a target whose correct outcome is
  "unchanged" is closed by recording that outcome and its reason in this
  journal, and the template's standing "JOURNAL, SYSTEMDOC, CURRENT_STATUS à
  jour" line is restored to the task summary. `Finalize When Complete` now
  follows the repository standard and restores `docs/CURRENT_TASK.md` from
  `docs/template_CURRENT_TASK.md` instead of an unnamed "inactive task
  template", with the archive filename in the `ACME-NNNN_task-slug.md` form
  that `docs/TASK_WORKFLOW.md` recommends and every existing file in
  `docs/finished/` uses.
- Third revision round closed the nine technical questions the Draft had left
  open and added the product separation the maintainer's review identified as
  the real risk. The named failure mode is an application whose visible result
  is execution status, quality scores or internal state, which would be a second
  Domain Test UI rather than proof that ACME supports a real application. The
  charter now carries a normative Primary Product Rule, the domain-provenance
  versus engine-provenance distinction, two product acceptance tests
  (domain black-box and ACME contribution), a required primary/secondary
  classification of every view, an accepted derived-staleness model with its
  reviewer-facing behavior, and a slice order restated as reviewer capabilities
  where only the foundation slice may end without a visible capability.
- Five corrections were made to the proposed freeze points rather than adopting
  them unchanged: the corpus split drops the word "train" and becomes
  development plus sealed evaluation, with thresholds expressed as absolute
  counts wherever the denominator is small and every threshold written with its
  denominator; canonicalization and line-range locator semantics are frozen so
  the exact-quote gate is mechanically decidable; `EventOccurrence` is removed
  from the first execution task; any measure whose correct value is 100% moves
  from the comparison table into the hard gates; and every V1 review decision
  records that its principal is unauthenticated so the hosted slice can tell V1
  approvals apart without rewriting history.
- Both product acceptance tests were specified as mechanical checks rather than
  review opinions: a disable-technical-audit configuration the primary journey
  is exercised behind, and a forbidden-vocabulary check over primary view
  contract field names and user-facing strings. The two-tier staleness ranking
  is deterministic set intersection over citation identity, and the charter
  records that it must never become a model-scored relevance ranking, because
  ADR-0028 forbids the model from acting as relevance authority.
- `AGENTS.md` corrected to match reality: its archiving rule asked for a
  "descriptive dated filename", while `docs/TASK_WORKFLOW.md` and all 75
  archived files use `ACME-NNNN_task-slug.md` with no date in the name. The
  rule now names that form. This is a documentation correction, not a
  convention change; no archived file was renamed and no other document made
  the dated claim.
- Verification: `pnpm docs:check` checked 153 Markdown files with internal
  links and fences clean; `git diff --check` passed. No code, schema or stored
  data changed, so no code gates were applicable.
- Handoff: ACME-0076 remains `Draft` and unfrozen, but nothing blocks freezing
  it. The nine technical questions are answered in the charter, the product
  separation is accepted, and the next step is a `Ready` transition followed by
  writing the specification against the accepted answers. The two ADRs the
  charter names — Evidence V1 identity and canonical placement, and Evidence
  reviewer, review overlay and versioned view boundary — are identified but not
  written; the second must carry the Primary Product Rule.
- Signature: Claude

## 2026-08-10 — ACME-0075 open-source concepts

- Date: 2026-08-10
- Author: Codex
- Task: ACME-0075
- Branch: `plan/legal-evidence`
- Summary: Added two explicitly non-authoritative strategy documents under
  `docs/concepts_sandbox/`. `docs-first-open-source-packaging.md` extracts the
  latest ACME docs-first iteration into a candidate agent-neutral continuity
  protocol with the technician test, semantic document ownership, frozen task
  lifecycle, progressive context loading, profiles, conformance levels,
  evidence framing and staged extraction. `acme-open-source-strategy.md`
  proposes a complete uncrippled community core, Compatible/Certified/Fork
  identities, license decision matrix, commercial value layers, contribution
  and supply-chain prerequisites, two-consumer-application gate and staged
  public release.
- Evidence boundary: recorded a bounded snapshot of at least 654 author-tagged
  journal entries across four top-level private repositories, explicitly not
  unique tasks or independent experiments. Additional repositories and two
  external creative-production users are retained as transferability signals,
  not quantified productivity proof. Private journals are not approved for
  publication.
- Licensing boundary: checked terminology against official OSI, GNU, Apache,
  MariaDB and Elastic sources. Apache-2.0 and AGPL-3.0 remain decision
  candidates; BSL 1.1 and ELv2 are described as source-available alternatives,
  not immediate open-source releases. No license, CLA, DCO, trademark policy,
  package publication or public release was selected or performed.
- Verification: `pnpm docs:check` checked 151 Markdown files with internal
  links and fences clean; `git diff --check` passed. The existing HRD journal
  entry and `docs/backlog/hrd-documentation-update.md` were preserved; two
  trailing spaces in that journal entry were removed without changing its
  content. Code and runtime tests were not run because ACME-0075 changes only
  non-authoritative concept documentation and repository indexes.
- Handoff: ACME-0075 is archived. ACME-0076 is the next active `Draft` and
  should specify the Evidence Integrity Workbench's synthetic golden corpus,
  minimal Evidence contracts, versioned views, proof matrix and staged
  implementation slices before any product code is authorized.
- Signature: Codex

## 2026-08-10 — hrd documents removal
- Date: 2026-08-10
- Author: Rickard Zakrisson
- Task: no task created
- Branch: `plan/legal-evidence`
- Summary: Removed the hrd documents details and to not interrupt or
  pollute current task the documentation update was left as a
  backlog / followup in: docs/backlog/hrd-documentation-update.md
- Signature: mrWhite / Rickard Zakrisson

## 2026-08-09 — ACME-0074 Evidence Integrity Workbench locked as POC #1

- Date: 2026-08-09
- Author: Codex
- Task: ACME-0074
- Branch: `main`
- Summary: Accepted the Evidence Integrity Workbench as ACME's first real
  product POC. Added the normative
  `docs/design/evidence-integrity-workbench-product-definition.md` and accepted
  ADR-0028. The product turns a fixed synthetic text corpus into immutable
  source-bound observations, scoped evidence relations, a deterministic
  timeline, explicit uncertainty, open questions and versioned assessments
  requiring human review. Research Synthesis is retained as the intended POC
  #2.
- Product boundary: canonical means durably accepted with provenance, never
  proven true in the world. Source observations, expressed propositions,
  evidence relations, assessments and legal conclusions have separate
  authority levels. V1 prohibits credibility, guilt, liability, legal-
  sufficiency, admissibility, privilege, tailored legal advice, criminal-risk
  profiling and automated high-impact decisions. It also prohibits real
  confidential, privileged or criminal-offence personal data.
- Sandbox promotion: reviewed every file under
  `docs/concepts_sandbox/legal-evidence-on-acme/`. Situated assertions,
  `TimeBound`, quote binding, contest/coexist, correction-only supersession,
  pure timeline, versioned assessments, stale-on-new-evidence and human accept
  were promoted as accepted meanings or invariants. Package/task sketches,
  artifact sensitivity classification, interrogation assist, jurisdiction and
  custody policy, media ingestion and real-case bundles remain deferred,
  excluded or blocked. The sandbox itself remains non-authoritative.
- Architecture: accepted the existing TypeScript/Node/pnpm/Zod foundation with
  React/Vite, Fastify, a separate worker, the OpenAI Responses adapter,
  S3-compatible object storage and managed PostgreSQL as the hosted POC target.
  SQLite remains the only delivered durable adapter. PostgreSQL requires a new
  conformant adapter; managed providers, hosting and implementation remain
  unselected and unauthorized.
- Risk evidence: reviewed current OpenAI Usage Policies, Regulation (EU)
  2024/1689, Regulation (EU) 2016/679 Article 10 and NIST AI 600-1. They support
  synthetic data, source-grounded verification, explicit human authority and
  conservative exclusions. No legal classification or legal advice is made.
- Verification: traced accepted POC invariants to existing ACME authority or
  ADR-0028, reviewed the normative reading path and sandbox disposition table,
  and checked the governing-document synchronization. `pnpm docs:check`
  checked 149 Markdown files with internal links and fences clean;
  `git diff --check` was clean. Code, integration, scenario and live tests were
  not run because ACME-0074 changes product and architecture documentation only.
- Handoff: the next product task should specify the synthetic golden corpus,
  minimal Evidence domain contracts, versioned views and staged implementation
  slices. Real data, provider selection and deployment remain separately gated.
- Signature: Codex

## 2026-08-09 — ACME-0073 first real POC discovery

- Date: 2026-08-09
- Author: Codex
- Task: ACME-0073
- Branch: `main`
- Summary: Produced the decision-ready first-POC discovery report and
  `docs/design/first-poc-application-discovery.md`. The recommendation is a
  bounded evidence-to-decision workbench for product, strategy or research
  teams: controlled sources become a versioned, source-linked brief with
  supported, contested and unresolved claims and an explicit human approval
  step. The proposed baseline keeps ACME's TypeScript/Node contracts, adds a
  React/Vite client, Fastify API and separate worker, and recommends managed
  PostgreSQL plus object storage for a hosted multi-user pilot. SQLite remains
  the delivered local/offline adapter; a conformant PostgreSQL adapter is a
  future prerequisite, not an implementation made by this task.
- Decisions and boundaries: the comparison matrix is an analyst heuristic,
  not observed market data. No concept, managed provider, production database
  or architecture change was approved. The report defines browser/API/SSE and
  outbox communication, responsibility ownership, scaling triggers, business
  hypotheses, pilot metrics, data-handling caveats and the explicit product
  decisions required before a build charter.
- Evidence: current claims were checked against official Node.js, SQLite,
  PostgreSQL, OpenAI, Supabase, Neon, Vite, Fastify, Docker and MDN
  documentation. Repository claims were derived from `PROJECT_BRIEF`,
  `CURRENT_STATUS`, `SYSTEMDOC`, the gap-resolution plan and accepted ADRs;
  concept-sandbox material was used only as non-authoritative comparison
  input.
- Verification: the Data Analytics report artifact validated with four
  bounded datasets, five canonical sources, one native comparison chart and
  four decision tables, then received one final render. The stakeholder
  reading path was reviewed from executive answer through next decisions.
  `pnpm docs:check` checked 146 Markdown files with internal links and fences
  clean; `git diff --check` was clean. Code, integration, scenario and live
  tests were not run because this task changes only discovery and governing
  documentation.
- Handoff: confirm the evidence-to-decision wedge, the first consumer group
  and internal single-organization versus external multi-tenant pilot before
  activating product design or implementation. Provider selection remains
  conditional on identity, object-storage and operating requirements.
- Signature: Codex

## 2026-08-09 — ACME-0072 OpenAI/FDE presentation Markdown counterpart

- Date: 2026-08-09
- Author: Codex
- Task: ACME-0072
- Branch: `main`
- Summary: Added
  `hrd/ACME-OpenAI-FDE-project-presentation.md` as a plain-text counterpart to
  the final 15-slide PowerPoint and PDF. It retains the problem framing,
  candidate-not-truth thesis, dependency and trust-stage diagrams, workspace
  structure, two-domain proof, durability, quality distinctions, chronology,
  delivered surface, test evidence, maturity boundary, bounded remaining work
  and field-deployment takeaway. Repository-relative links provide a source
  map to governing documents and accepted ADRs. The PowerPoint and PDF were
  not changed.
- Verification: extracted and compared the final PowerPoint slide text and
  speaker-note sources; confirmed the cover and all 14 narrative sections are
  present in Markdown; `pnpm docs:check` checked 144 Markdown files with links
  and fences clean; `git diff --check` was clean. Code, integration, scenario
  and live tests were not run because the task adds only a derived Markdown
  artifact and documentation records.
- Handoff: the Markdown file is an explanatory artifact; governing Markdown
  and accepted ADRs remain authoritative. No implementation task is active.
- Signature: Codex

## 2026-08-09 — ACME-0071 OpenAI/FDE project presentation

- Date: 2026-08-09
- Author: Codex
- Task: ACME-0071
- Branch: `main`
- Summary: Created a 15-slide English project presentation and matching PDF
  under `hrd/` for an OpenAI Forward Deployed Engineer application. The deck
  explains ACME's problem framing, candidate-not-truth design thesis,
  dependency architecture, execution trust stages, repository structure,
  two-domain proof, durability and replay behavior, quality boundaries,
  development history, delivered interfaces, verification evidence, current
  status, bounded gaps and field-deployment relevance. The earlier Swedish
  ACME-0055 artifacts were preserved. Each slide includes a repository-backed
  `[Sources]` block in its speaker notes; the Markdown documentation and
  accepted ADRs remain normative.
- Verification: rendered and visually inspected all 15 slides; presentation
  overflow test passed with no detected overflow; verified 15/15 speaker-note
  source blocks; exported a 15-page tagged PDF and visually inspected all 15
  pages; the final metadata-only export produced zero visual pixel differences
  from the inspected PDF render. `pnpm docs:check` checked 142 Markdown files
  with links and fences clean. `git diff --check` was clean. Code, integration,
  scenario and live tests were not run because ACME-0071 changes only derived
  presentation artifacts and documentation.
- Handoff: no implementation task is active. The deck and PDF are external
  explanatory artifacts, not new architecture authority. Next recommended
  work remains E1 trust-stage evidence (G12) or another explicitly approved
  bounded charter.
- Signature: Codex

## 2026-08-09 — BASE release tag (operator)

- Date: 2026-08-09
- Author: Rickard Zakrisson (operator)
- Task: none (release action after ACME-0070)
- Branch: `main`
- Summary: Trailing whitespace cleared in
  `docs/design/gap-resolution-plan.md:4`, so `git diff --check` is silent with
  no recorded exception. Commit `e6720e8` tagged and released as `BASE` from
  `main`, with source archives as the only assets and no published package.
- Correction: the ACME-0070 entry and its archived charter record that
  whitespace line as deliberately kept. That was true at archive time and is
  now superseded by `e6720e8`; the archived task is left unmodified as
  historical context.
- Signature: Rickard Zakrisson

## 2026-08-09 — ACME-0070 documentation reality sync (ACME-0057–0069)

- Date: 2026-08-09
- Author: Claude
- Task: ACME-0070
- Branch: `main`
- Summary: Documentation-only resync after ACME-0057 through ACME-0069.
  `docs/CURRENT_STATUS.md`: date, ADR-0026/0027 added to the list, durable
  quality store / quality CLI / S11 view / live judge / async launch recorded
  as implemented, CLI command list completed, view contracts corrected from
  five to eleven, S3 progress wording corrected, active work and recent-work
  summary updated, measured test counts replaced.
  `docs/SYSTEMDOC.md`: date and status line, quality section no longer claims
  durable storage / CLI / live judges are unimplemented, `quality` commands
  added to the composition root, outbox section no longer claims `failed`
  entries lack a redrive path, ten view contracts corrected to eleven, and two
  sentences garbled by earlier merges repaired.
  `docs/FILESTRUCTURE.md`: added `apps/cli/src/outbox-file-dispatcher.ts` and
  its test, `read-model/quality-evaluation.ts`, `evaluation/src/live-judge.ts`
  and its test, `tests/conformance/quality-evaluation-sqlite.test.ts`,
  `tests/integration/scenario-live-offline.test.ts`,
  `tests/live/scenario-multi-step.test.ts`, the evaluation boundary fixture,
  `.grok/`, both `.npmrc` workspace files, the concepts_sandbox subdirectories,
  `docs/hrd/` and the ACME-0069/0070 archives.
  `AGENTS.md`, `README.md`, `docs/PROJECT_BRIEF.md`,
  `docs/design/gap-resolution-plan.md`, `docs/design/README.md`,
  `docs/design/domain-test-ui-specification.md` and `docs/backlog/README.md`:
  closed gaps no longer described as open.
- Verification: `pnpm test:unit` (603 tests / 73 files), `pnpm test`
  (conformance 64/9, integration 56/10, scenario 24/5) — all green and the
  source of the recorded counts; `pnpm docs:check` (141 files, links and
  fences clean); `git diff --check` reports only
  `docs/design/gap-resolution-plan.md:4`, whose trailing whitespace is that
  document's pre-existing Markdown hard-break convention and was kept.
  No code, test or configuration file was modified.
  `pnpm test:live` was not run: this task changes no code and live runs stay
  operator-initiated.
- Handoff: no implementation task is active. Next recommended is E1
  trust-stage evidence (G12), then the WP-T residuals T2/T3/T4. Both need an
  explicitly approved charter.
- Signature: Claude

## 2026-08-09 — ACME-0069 async launch, progress and cancellation (T1 / G08)

- Date: 2026-08-09
- Author: Grok
- Task: ACME-0069
- Branch: `grok/gapfixes2`
- Summary: Closed G08 behind ADR-0027. Workbench process owns an in-process
  JobRunner (single-flight). Interface workspace gains `jobs/<id>.json`
  (`acme-job-record/1`). Parallel API `enqueuePlan` returns immediately;
  synchronous `launchPlan` unchanged. S3 progress available when job evidence
  is supplied; pure history-only callers still see `RUN_PROGRESS_UNAVAILABLE`.
  Cooperative cancel via AbortSignal on `runScenario` and optional
  `ExecutionEngine.execute` second argument. Cancel does not roll back ledger
  commits. Run records accept status `cancelled`. Workbench HTTP launch uses
  enqueue; POST `/s3/<id>/cancel` with CSRF. Process restart marks non-terminal
  jobs `interrupted`.
- Verification: typecheck core/testing/test-ui; unit tests including job-runner;
  integration test-ui-workbench + test-ui-launch.
- Signature: Grok

## 2026-08-06 — ACME-0066/0067/0068 quality CLI, S11 view, live judge (Q2–Q4)

- Date: 2026-08-06
- Author: Grok
- Task: ACME-0066, ACME-0067, ACME-0068
- Branch: `grok/gapfixes2`
- Summary: Closed WP-Q remainder. CLI composition exposes `qualityStore`
  (memory or same SQLite file). Commands: `quality list`, `quality inspect`,
  `quality judge`. Pure Test UI view `acme-view-quality-evaluation/1` (list +
  detail). Live-model judge `runLiveModelQualityJudge` runs outside the
  synchronous harness (which still refuses Promise returns); stores
  `kind: live-model`. Offline CLI judge proven with injected OpenAI transport.
- Signature: Grok

## 2026-08-06 — ACME-0065 durable quality evaluation store (Q1)

- Date: 2026-08-06
- Author: Grok
- Task: ACME-0065
- Branch: `chore/gapfixes`
- Summary: SQLite migration v2 adds append-only `quality_evaluations` without
  FK to executions (ADR-0026). `createSqliteQualityEvaluationStore` implements
  the same `QualityEvaluationStore` port as memory; shared conformance kit
  passes; close/reopen preserves records. Package may depend on
  `@acme/evaluation`; boundary rules updated.
- Out of scope retained: CLI inspect (Q2), Test UI (Q3), live AI judge (Q4).
- Signature: Grok

## 2026-08-06 — Live multi-step ScenarioRunner success (operator)

- Date: 2026-08-06
- Author: Rickard Zakrisson (operator run); documented by Grok
- Task: ACME-0064 verification
- Branch: `chore/gapfixes` (not merged to main)
- Summary: Operator ran `pnpm test:live` successfully. Both live gates
  passed: `tests/live/openai-responses.test.ts` (single research execute,
  HTTP 200, `status: committed`, model `gpt-5.6-luna`) and
  `tests/live/scenario-multi-step.test.ts` (two serial narrative executes
  under ScenarioRunner `composition.gateway: openai`, ~6.7s).
- Evidence: local `live_test.log` (gitignored `*.log`; not committed — raw
  provider bodies may include non-public fields). Duration of full live
  suite ~7.7s; 2 files / 2 tests green.
- Documentation note: ACME-0064 DoD for a bounded real multi-step live path
  is now operator-proven, not only offline-injected.
- Signature: Grok

## 2026-08-06 — ACME-0063/0064 plan model pin + ScenarioRunner live multi-step

- Date: 2026-08-06
- Author: Grok
- Task: ACME-0063, ACME-0064
- Branch: `chore/gapfixes`
- Summary: WP-L delivered. Plans and scenarios may pin `model` selection;
  `acme-test-plan/1` materializes `ExecutionRequest` from case.model without
  requiring mock selection. ScenarioRunner accepts `composition.gateway:
  openai` with composition `liveGateway`; CLI wires OpenAI (fetch or injected
  transport). Offline multi-step proof:
  `tests/integration/scenario-live-offline.test.ts`. Opt-in live multi-step:
  `tests/live/scenario-multi-step.test.ts` (ACME_LIVE_TEST + OPENAI_API_KEY).
  S10 remains single-execute. ADR-0020 residual “no model field” is discharged
  by additive optional fields (no version bump).
- Verification: typecheck; unit/conformance/integration including offline live
  multi-step; docs:check. Live multi-step later proven by operator
  (`pnpm test:live`; see following journal entry).
- Signature: Grok

## 2026-08-06 — ACME-0062 narrative domain event emission (O3)

- Date: 2026-08-06
- Author: Grok
- Task: ACME-0062
- Branch: `chore/gapfixes`
- Summary: `narrative.observe-document` now emits one module-owned domain
  event `narrative.document-observed` per commit, producing real outbox rows.
  Narrative Phase 5 operation digest repinned to
  `c0fcec15fbc93dd53074ef4c3edcccd05552e741db9b3b5b78485b76500e40a4`; quality
  evaluation recording regenerated. Research still emits no events.
- Signature: Grok

## 2026-08-06 — ACME-0061 file outbox transport (O2)

- Date: 2026-08-06
- Author: Grok
- Task: ACME-0061
- Branch: `chore/gapfixes`
- Summary: Bounded file `OutboxDispatcher` in the CLI composition root
  (`createFileOutboxDispatcher`, `acme-outbox-file-delivery/1`). Drain default
  remains report-only; `--transport file --outbox-dir` writes one JSON
  envelope per event and still includes events in the stdout report. Offline
  unit + CLI SQLite proof; no network product bus.
- Follow-ups: O3 minimal domain-event emission from a reference module.
- Signature: Grok

## 2026-08-06 — ACME-0060 outbox growth alarm (O4)

- Date: 2026-08-06
- Author: Grok
- Task: ACME-0060
- Branch: `chore/gapfixes`
- Summary: `outbox inspect` now always includes a status-count summary and
  optional `--max-pending` / `--max-failed` thresholds (non-negative). Exceeding
  a threshold exits with outcome code 1. Host drain remains cron/systemd/CI
  calling `acme outbox drain` (ADR-0018; no library timer).
- Signature: Grok

## 2026-08-06 — ACME-0059 outbox redrive (O1)

- Date: 2026-08-06
- Author: Grok
- Task: ACME-0059
- Branch: `chore/gapfixes`
- Summary: Closed outbox redrive residual of G04 / plan O1. Added
  `ExecutionRepository.redriveOutbox` on memory and SQLite adapters, pure
  `redriveOutbox` coordinator (`acme-outbox-redrive-report/1`), and CLI
  `outbox redrive <event-id>` / `outbox redrive --all-failed`. Only `failed`
  entries return to `pending`; `delivered` is refused; `lastError` and
  attempt count are retained. Extends ADR-0018's deferred redrive residual.
- Verification: `pnpm typecheck`; `test:unit` 576/576; `test:conformance`
  61/61; `test:integration` 55/55; `docs:check`.
- Follow-ups: O2 real dispatcher transport; O4 growth alarm.
- Signature: Grok

## 2026-08-06 — ACME-0058 stranded execution operator tooling (D2)

- Date: 2026-08-06
- Author: Grok
- Task: ACME-0058
- Branch: `chore/gapfixes`
- Summary: Closed gap G06 / plan slice WP-D D2. Pure core
  `listStrandedExecutions` and `prepareOperatorDischarge` classify open
  non-terminal stranded primary model calls (reserved/in-flight, unreadable
  response, failed, ambiguous) and terminal resume-refusal failures. CLI
  `execution stranded` and `execution discharge --by --rationale` list and
  markTerminal with operator audit in error details; no model outcome
  invented and no state/memory/document write.
- Note: discharge must not appendAttempt with stage `failed` first — both
  adapters promote attempt.stage into execution.status and would pre-terminal
  the row.
- Verification: `pnpm typecheck`; `test:unit` 574/574; `test:conformance`
  61/61; `test:integration` 55/55; `docs:check` (126 Markdown).
- Follow-ups: WP-O O1 outbox redrive.
- Signature: Grok

## 2026-08-06 — ACME-0057 driver error classification (D1)

- Date: 2026-08-06
- Author: Grok
- Task: ACME-0057
- Branch: `chore/gapfixes`
- Summary: Closed gap G05 / plan slice WP-D D1. `@acme/adapter-sqlite` now
  maps recognized better-sqlite3 result codes at every repository DB seam
  (`driver-errors.ts` + wrapped `#statement`/`#one`/`#all`/`#run`/`#immediate`).
- Classification: busy/locked → `PERSISTENCE_TRANSIENT` retryable; corruption
  and constraint codes → `PERSISTENCE_CORRUPTION` non-retryable; unknown →
  `INTERNAL` AcmeError (never a raw driver throw). Public codes stay free of
  SQLite vocabulary.
- Tests: unit mapping + real `SQLITE_BUSY` with dual connections and
  `busy_timeout = 0`; durability fault fixture is SQLITE_BUSY-shaped so the
  engine records `PERSISTENCE_TRANSIENT` after rollback proof.
- Docs: backlog proposal marked resolved; CURRENT_STATUS G05 closed; SYSTEMDOC,
  gap plan, PROJECT_BRIEF, FILESTRUCTURE updated.
- Verification: `pnpm typecheck`; `test:unit` 565/565; `test:conformance`
  61/61; `test:integration` 55/55; `docs:check` (125 Markdown); `git diff
  --check`.
- Out of scope retained: automatic retry consumers; D2 stranded ops.
- Follow-ups: activate ACME-0058 (or next id) for D2 stranded executions.
- Signature: Grok

## 2026-08-06 — Gap plan: live adapter verification in scope

- Date: 2026-08-06
- Author: Grok
- Task: ACME-0056 (plan correction; no new task)
- Summary: Product feedback: live provider calls must not be treated as
  globally out of scope for live-purpose packages. Updated
  `docs/design/gap-resolution-plan.md` with an explicit live verification
  policy: WP-L L2 (and Q4 / P3 when activated) require a bounded real-adapter
  success path in DoD; default CI stays mock-only; budget/opt-in stay
  mandatory. Blanket “no live calls” belongs only on offline packages (e.g.
  WP-D). ACME-0056’s own historical Out of Scope (planning-only, no runtime)
  is unchanged in the archive.
- Verification: documentation wording only; no live call in this correction.
- Signature: Grok

## 2026-08-06 — ACME-0056 gap resolution plan

- Date: 2026-08-06
- Author: Grok
- Task: ACME-0056
- Summary: Activated a planning-only task and published
  `docs/design/gap-resolution-plan.md`. Every Persistent Gaps bullet from
  `docs/CURRENT_STATUS.md` now has a stable ID (G01–G19), a disposition
  (solve / collapse / accept / defer) and a work package with ordered steps.
- Packages: WP-D (driver errors + stranded ops), WP-O (outbox redrive,
  transport, events, growth alarm without library auto-drain), WP-L (plan
  model pin + ScenarioRunner live multi-step), WP-Q (durable quality store),
  WP-T (Test UI async/measurements/discovery), WP-E (trust-stage evidence),
  WP-P/WP-K/WP-X (optional provider, privacy, hygiene).
- Constraints preserved: ADR-0018 forbids in-library auto-drain; ADR-0021
  keeps synchronous launch until amended; ADR-0014 keeps ambiguous calls
  terminal; static composition remains default for adapter discovery.
- Recommended first implementation slice: D1 driver-error classification
  from `docs/backlog/driver-error-classification.md`.
- Documentation: CURRENT_STATUS Active Work and gap IDs, PROJECT_BRIEF Next
  Deliverable pointer, FILESTRUCTURE, design README, JOURNAL.
- Verification: documentation gates (`pnpm docs:check`, `git diff --check`).
  No code, live provider, deployment or publication.
- Follow-ups: activate the next implementation task explicitly from the plan
  (prefer D1); do not treat the plan as a multi-gap blank check.
- Signature: Grok

## 2026-08-06 — Changed gpt-model

- Date: 2026-08-06
- Author: Rickard Zakrisson
- Task: None created
- Summary: Changed default model from gpt-4.1-mini to gpt-5.6-luna
- Signature: Zakrisson

## 2026-08-06 — ACME-0055 human-readable ACME documents

- Date: 2026-08-06
- Author: Codex
- Task: ACME-0055
- Summary: Audited the governing documentation against the implemented
  ACME-0054 baseline and produced three Swedish, repository-derived artifacts
  under `hrd/`: an editable presentation, a narrative whitepaper and detailed
  technical system documentation. The artifacts explicitly separate
  assertions, population metrics, pre-commit evaluation and post-execution
  quality evaluation.
- Documentation reality: `CURRENT_STATUS.md` now records no active
  implementation task, `FILESTRUCTURE.md` includes the three deliverables and
  the ACME-0054/0055 archives, and the derived files identify Markdown sources
  and accepted ADRs as authoritative. The open driver-error proposal is stated
  consistently: generic public persistence classes with adapter-owned mapping
  from concrete SQLite/driver codes.
- Artifact verification: the 9-slide PPTX rendered successfully and passed the
  presentation overflow test. Microsoft Word rendered all 7 whitepaper pages
  and all 12 system-document pages to PDF/PNG for full visual inspection.
  Both DOCX files passed exact table-geometry and accessibility audits; all
  three files passed placeholder and terminology review.
- Repository verification: `pnpm docs:check` passed for 123 Markdown files and
  `git diff --check` passed. No live provider call, deployment or publication
  occurred.
- Spend: none.
- Follow-ups: choose the next operational/product surface explicitly. Durable
  quality-result persistence, driver error mapping, outbox redrive/transport,
  stranded-run operator tooling and multi-step live scenarios remain separate
  proposals rather than implied core work.
- Signature: Codex

## 2026-08-06 — ACME-0054 General evaluation and quality-scoring harness

- Date: 2026-08-06
- Author: Codex
- Task: ACME-0054
- Summary: Delivered the domain-neutral post-execution quality foundation in
  `@acme/evaluation` and accepted ADR-0025. Assessments bind exact run,
  execution, artifact, contract and evaluator versions while remaining
  separate from immutable execution evidence.
- Contracts: `acme-quality-subject/1`, `acme-quality-evaluation/1` and
  `acme-recorded-quality-evaluation/1`; finite ranged scores, structured
  findings, `pass | fail | inconclusive` verdicts and deterministic
  content-derived identities. Assertions, population metrics and quality
  judgments remain distinct concepts.
- Evaluators: pure deterministic evaluators run rules, thresholds, schema
  properties and consistency checks. Recorded-external evaluators replay an
  exact prior assessment offline and refuse any evaluator, subject or result
  mismatch. A live/general AI judge is not present.
- Persistence and scenarios: an append-only in-memory store is idempotent for
  identical content, refuses collisions and returns detached data through a
  reusable conformance kit. `acme-scenario/2` adds `evaluate` and
  `assertEvaluation` without breaking v1; a failing quality verdict is a valid
  assessment and only an explicit assertion fails the run.
- Documentation: synchronized `AGENTS.md`, `README.md`, project brief, current
  status, system documentation, file map, design specification, ADR index and
  the driver-error backlog. The backlog is confirmed generic at the public
  boundary: adapters translate private driver codes into generic ACME
  persistence classes.
- Verification: `pnpm docs:check` (121 Markdown files), `format:check`, `lint`,
  `typecheck`, `boundaries`, `test:unit` (560/560 in 64 files),
  `test:conformance` (61/61 in 8), `test:integration` (55/55 in 9),
  `test:scenario` (24/24 in 5) and `build` all pass. No live provider call was
  run.
- Corrections found by the gates: removed an invalid committed `OPT_IN=1`
  assignment that both broke TypeScript and bypassed explicit live-test
  opt-in; narrowed ScenarioRunner's harness dependency to the structural
  `run`/`runWith` surface to avoid a source/dist nominal-type leak.
- Spend: none.
- Follow-ups: durable SQLite quality-result storage, CLI/Test UI surfaces and
  any live judge require separate approval. Driver-error classification
  remains an independent adapter-hardening proposal.
- Signature: Codex

## 2026-08-05 — ACME-0053 browser live evaluation archived

- Date: 2026-08-05
- Author: Codex
- Task: ACME-0053
- Summary: Completed the Domain Test UI's final S10 browser surface. Local
  developers can inspect live-only history and submit one explicitly
  confirmed, budgeted `ExecutionRequest` through the already-decided live
  launch boundary.
- Delivered: pure `renderLiveEvaluationViewHtml`; `/s10` and
  `/api/live-evaluation`; protected `/s10/launch`; health registration;
  duplicate, concurrent and append-only run-id protection; and test-only
  transport/key injection at the local composition boundary.
- Honesty/safety: process opt-in and per-launch confirmation remain separate
  mandatory gates. The browser accepts no credentials, mock history is
  excluded, unavailable confirmation/cost remains explicit, and the route
  delegates to `launchLiveExecution` rather than calling a provider or ledger
  directly.
- Verification: `pnpm typecheck`; `pnpm lint`; `pnpm format:check`;
  `pnpm boundaries`; `pnpm test:unit` — 546 tests / 61 files;
  `pnpm test:conformance` — 58 / 7; `pnpm test:integration` — 55 / 9;
  `pnpm test:scenario` — 21 / 4; `pnpm docs:check` — 120 Markdown files after
  archive; `pnpm build`; `git diff --check`.
- Browser: launched one S10 run through an injected offline transport and
  verified the recorded pass plus its execution link. Desktop at 1200 px and
  narrow at 390 px had no horizontal overflow; the page exposed no credential
  value and emitted no browser console warning/error.
- External effects: no live provider call, paid request, deployment, package
  publication, push or release. Browser verification used only a disposable
  ignored local workspace and an offline transport.
- Follow-up: S1–S10 are complete for the bounded workbench. Multi-step live
  scenarios and remote hosting remain separate optional charters.
- Signature: Codex

## 2026-08-05 — ACME-0052 browser fixture review archived

- Date: 2026-08-05
- Author: Codex
- Task: ACME-0052
- Summary: Rendered `acme-view-fixture-review/1` as S9 in the loopback
  workbench. A complete request-local proposal can now be tied to recorded
  run/execution provenance, reviewed as pending and explicitly approved or
  rejected by a named reviewer with a rationale.
- Delivered: pure `renderFixtureReviewViewHtml`; `/s9` and
  `/api/fixture-review`; protected `/s9/decision`; decided history rebuilt
  from complete approval records; health registration and removal of the S9
  stub.
- Honesty/safety: the route does not infer digests from failure text, compute a
  fixture diff or read/write the fixture. Decisions are built by
  `decideFixtureChange`, stored only as `acme-fixture-approval/1`, remain
  visibly `applied: false`, and cannot overwrite existing, conflicting,
  unreadable or concurrent proposal ids. CSRF, same-server proof, bounded body,
  reviewer and rationale are mandatory.
- Verification: `pnpm typecheck`; `pnpm lint`; `pnpm format:check`;
  `pnpm boundaries`; `pnpm test:unit` — 543 tests / 60 files;
  `pnpm test:conformance` — 58 / 7; `pnpm test:integration` — 53 / 8;
  `pnpm test:scenario` — 21 / 4; `pnpm docs:check` — 119 Markdown files after
  archive; `pnpm build`;
  `git diff --check`.
- Browser: staged the recorded digest mismatch from `demo-narrative-002`,
  observed pending state and both explicit controls, then recorded a local
  test rejection. Redirected history showed the named reviewer, rationale,
  `rejected`, zero pending decisions and `Not applied`; no rewrite form
  remained. At 622 px there was no horizontal overflow or error overlay.
- Fixture proof: `tests/scenario/files/digests/narrative-phase-5.json` retained
  SHA-256 `A31E00FFDFF103D3582F582A7B54D60C3B494A493CDBD0A0525255223E6BBC86`
  before and after the browser decision.
- External effects: no live provider call, paid request, deployment, package
  publication, push or release. One disposable rejected approval was stored
  only under the ignored local demo workspace for browser verification.
- Follow-up: S10 live-evaluation rendering is the remaining bounded browser
  surface; multi-step live scenarios remain a separate optional charter.
- Signature: Codex

## 2026-08-05 — ACME-0051 browser measurement archived

- Date: 2026-08-05
- Author: Codex
- Task: ACME-0051
- Summary: Rendered `acme-view-measurement/1` as S8 in the loopback workbench.
  Recorded mock and non-mock runs now appear as separate deterministic/live
  measurement cards with observed counts, sample sizes, rates, configured
  threshold outcomes and explicit baseline comparisons.
- Delivered: pure `renderMeasurementViewHtml`; `/s8` and
  `/api/measurement`; request-local finite `0..1` min/max bounds for the three
  existing measures; safe lookup of one deliberately stored baseline; health
  contract registration; removal of the S8 stub.
- Honesty/safety: empty samples remain `MEASUREMENT_SAMPLE_EMPTY`; no threshold
  means no outcome and no baseline means no comparison. Invalid bounds,
  unsafe/missing baselines and any unreadable run record are refused so a
  sample cannot silently shrink. The route writes nothing, promotes no
  baseline, invents no score and calls no provider.
- Verification: `pnpm typecheck`; `pnpm lint`; `pnpm format:check`;
  `pnpm boundaries`; `pnpm test:unit` — 540 tests / 60 files;
  `pnpm test:conformance` — 58 / 7; `pnpm test:integration` — 52 / 8;
  `pnpm test:scenario` — 21 / 4; `pnpm docs:check` — 118 Markdown files after
  archive; `pnpm build`;
  `git diff --check`.
- Browser: the seven-record demo workspace rendered 5 deterministic and 2
  live runs without mixing them. Request-local thresholds produced the
  expected `met` / `not-met` outcomes and the selected stored baseline stayed
  `unchanged`; live baseline comparison remained unavailable. A separate
  empty workspace rendered six `MEASUREMENT_SAMPLE_EMPTY` states and no false
  zero or perfect rate. The checked viewport had no horizontal overflow or
  error overlay.
- External effects: no live provider call, paid request, deployment, package
  publication, push or release. A disposable `s8-browser` baseline was stored
  only under the ignored local demo workspace for browser verification.
- Follow-up: S9 fixture-review rendering is the nearest bounded UI
  continuation; S10 browser rendering, live browser controls and multi-step
  live scenarios remain separate optional charters.
- Signature: Codex

## 2026-08-05 — ACME-0050 browser replay inspector archived

- Date: 2026-08-05
- Author: Codex
- Task: ACME-0050
- Summary: Rendered `acme-view-replay/1` as S7 in the loopback workbench. A
  durable S4 execution now links to read-only replay verification with the
  engine's exact verdict, operation-digest comparison and diagnostic evidence.
- Delivered: pure `renderReplayViewHtml`; `/s7?executionId=...` and
  `/api/replay?executionId=...`; S4→S7 correlation; fail-closed gateway
  composition; optional injected payload encryption for retained replay;
  default-redacted diagnostics; honest missing-id, missing-ledger and
  unknown-execution states.
- Safety: replay uses existing `ExecutionEngine.replayVerify`, persists no
  report, makes no canonical write and fails if it attempts a provider call.
  The existing S2 origin hotfix was formatted and its duplicated cross-site
  branch removed without changing its accepted same-origin behavior.
- Verification: `pnpm typecheck`; `pnpm lint`; `pnpm format:check`;
  `pnpm boundaries`; `pnpm test:unit` — 537 tests / 60 files;
  `pnpm test:conformance` — 58 / 7; `pnpm test:integration` — 51 / 8;
  `pnpm test:scenario` — 21 / 4; `pnpm docs:check`; `pnpm build`;
  `git diff --check`.
- Browser: followed S3→S4→S7 for a hash-only durable execution and observed
  engine `unavailable`, preserved recorded digest and a redacted
  `REPLAY_MODEL_RESPONSE_UNAVAILABLE` diagnostic. A separate retained,
  encrypted-payload run produced `match`, three identical digests, `equal`
  comparison and zero differences. Exact execution ids were preserved and no
  error overlay appeared.
- External effects: no live provider call, paid request, deployment, package
  publication, push or release.
- Follow-up: S8 measurement rendering is the nearest bounded UI continuation;
  S9, S10 browser rendering and multi-step live scenarios remain separate
  optional charters.
- Signature: Codex

## 2026-08-05 — Changed test ui origin policy
- Date: 2026-08-05
- Author: Rickard Zakrisson
- Task: Hotfix referer / origin mismatch.
- Summary: Test ui S2 Surface rendered a 403 Invalid form origin refused. on (post) running / verifying the plan
- Delivered: Added an exeption origin === 'null' && fetchSite === 'same-origin'
- Verified: pnpm typecheck and started the webserver with node apps/test-ui/dist/local/workbench-main.js `
>>   --workspace tmp/test-ui-demo/workspace `
>>   --scenario-root tests/scenario/files `
>>   --ledger tmp/test-ui-demo/ledger.sqlite `
>>   --port 8787
- Browser: Added a plan verified the plan and launched offline run - success.
- Follow-ups: Closing the server resultet in an error: "(node:20180) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 close listeners added to [Server]. MaxListeners is 10. Use emitter.setMaxListeners() to increase limit
(Use `node --trace-warnings ...` to show where the warning was created)" caused by repeatedly pressing ctrl-c :)

## 2026-08-05 — ACME-0049 browser state inspector archived

- Date: 2026-08-05
- Author: Codex
- Task: ACME-0049
- Summary: Rendered `acme-view-state/1` as S6 in the loopback workbench. A
  durable S4 execution now links to canonical state revision and accepted
  transition evidence without exposing payloads or changing state.
- Delivered:
  - pure `renderStateViewHtml` with recorded head/revision counts, hashes,
    schema, creation/execution provenance and continuity
  - accepted transition identity, operation/from/to revision, hash linkage and
    delta schema, with missing transitions explicit
  - read-only `/s6?namespace=...&entityId=...` and
    `/api/state?namespace=...&entityId=...` over repository snapshot evidence
  - exact S4→S6 scope navigation; honest missing-scope, missing-ledger, empty
    lineage, broken/unknown continuity and unavailable-evidence states
  - state and delta payloads redacted by default with no browser disclosure or
    mutation path
- Verification: `pnpm typecheck`; `pnpm lint`; `pnpm format:check`;
  `pnpm boundaries`; `pnpm test:unit` (535 tests / 60 files); `pnpm
  test:conformance` (58 / 7); `pnpm test:integration` (51 / 8); `pnpm
  test:scenario` (21 / 4); `pnpm docs:check` (116 Markdown files after
  archive); `pnpm build`; `git diff --check`.
- Browser: followed one durable S4 scope to S6, where one linked revision and
  its accepted transition appeared, two payload presentations were redacted
  and no reveal controls existed. Missing-scope guidance and empty lineage
  were explicit, console errors were empty, and both 998 px and 390 px layouts
  had no document overflow.
- Spend/network: no live-provider call; existing local mock/SQLite evidence
  only.
- Follow-ups: S7–S10 HTML remain stubs. S7 replay/digest comparison is the
  nearest bounded renderer continuation; live browser controls and multi-step
  live scenarios still require separate approved charters.
- Signature: Codex
- Date: 2026-08-05
- Author: Codex
- Task: ACME-0049
- Summary: Rendered `acme-view-state/1` as S6 in the loopback workbench. A
  durable S4 execution now links to canonical state revision and accepted
  transition evidence without exposing payloads or changing state.
- Delivered:

## 2026-08-04 — ACME-0048 browser memory decisions archived

- Date: 2026-08-04
- Author: Codex
- Task: ACME-0048
- Summary: Rendered `acme-view-memory-decisions/1` as S5 in the loopback
  workbench. A durable S4 execution now links to ordered candidate → decision
  → mutation evidence without exposing payloads or changing memory.
- Delivered:
  - pure `renderMemoryDecisionsViewHtml` with recorded counts, provenance,
    domain action/disposition/reason, applied state and correlated mutations
  - explicit missing candidate, unavailable prepared commit, empty mutation
    and unattributed mutation presentation
  - read-only `/s5?executionId=...` and
    `/api/memory-decisions?executionId=...` over repository replay evidence
  - exact S4→S5 execution-id navigation; honest missing-id, missing-ledger and
    unknown-execution states
  - payloads redacted by default with no browser disclosure or mutation path
- Verification: `pnpm typecheck`; `pnpm lint`; `pnpm format:check`;
  `pnpm boundaries`; `pnpm test:unit` (533 tests / 60 files); `pnpm
  test:conformance` (58 / 7); `pnpm test:integration` (51 / 8); `pnpm
  test:scenario` (21 / 4); `pnpm docs:check` (115 Markdown files after archive); `pnpm
  build`; `git diff --check`.
- Browser: followed one durable S4 execution to S5, where three decisions and
  three mutations appeared in order, six payload presentations were redacted
  and no reveal controls existed. Guidance/not-found pages were explicit,
  console errors were empty, and both 998 px and 390 px layouts had no
  document overflow after long execution identifiers were made wrappable.
- Spend/network: no live-provider call; existing local mock/SQLite evidence
  only.
- Follow-ups: S6–S10 HTML remain stubs. S6 state inspection is the nearest
  bounded renderer continuation; live browser controls and multi-step live
  scenarios still require separate approved charters.
- Signature: Codex

## 2026-08-04 — ACME-0047 browser catalog renderer archived

- Date: 2026-08-04
- Author: Codex
- Task: ACME-0047
- Summary: Rendered the existing `acme-view-catalog/1` contract as S1 in the
  loopback workbench. The page now makes the static Narrative and Research
  registries, full prompt-contract fingerprints, bounded scenario discovery
  and fixture-reference classifications navigable without raw JSON.
- Delivered:
  - pure `renderCatalogViewHtml` with section navigation, responsive tables
    and explicit invalid, missing, refused, orphan and unavailable states
  - shared `createInterfaceRegistries`, so S1 and execution use one static
    registry declaration
  - read-only `/s1` and `/api/catalog` routes using `parseScenario` and bounded
    `discoverCatalogSources` under the process-configured scenario root
  - no browser path input, file-content display, mutation or adapter launch
  - focused renderer and HTTP integration coverage, including missing
    discovery configuration and HTML escaping
- Verification: `pnpm typecheck`; `pnpm lint`; `pnpm format:check`;
  `pnpm boundaries`; `pnpm test:unit` (531 tests / 60 files); `pnpm
  test:conformance` (58 / 7); `pnpm test:integration` (51 / 8); `pnpm
  test:scenario` (21 / 4); `pnpm docs:check` (114 Markdown files); `pnpm
  build`; `git diff --check`.
- Browser: S1 showed two modules, two contracts, one valid scenario and three
  referenced fixtures; full fingerprints remained 64 characters. S2
  navigation worked, no console/overlay errors appeared, and both 998 px and
  390 px viewport checks had no document overflow after the CSS min-width fix.
- Spend/network: no live-provider call; local mock evidence and discovery only.
- Follow-ups: S5–S10 HTML remain stubs; S5 memory decisions is the nearest
  bounded renderer continuation. Live browser controls and multi-step live
  scenarios still require separate approved charters.
- Signature: Codex

## 2026-08-04 — ACME-0046 browser offline plan launch archived

- Date: 2026-08-04
- Author: Codex
- Task: ACME-0046
- Summary: Connected the delivered S2 plan contract and synchronous
  `launchPlan` boundary to the local loopback workbench. A developer can now
  paste bounded YAML/JSON, preview the compiled canonical scenario, launch one
  mock-backed offline plan and follow its recorded result from S3 to durable
  S4 evidence when SQLite is configured.
- Delivered:
  - pure `renderPlanViewHtml` plus accessible in-package form styling
  - `/s2/preview` and `/s2/launch`, fixed 256 KiB body bound, per-process CSRF
    token, same-server checks and safe/duplicate run-id refusal
  - explicit process-side scenario-root configuration; no browser-supplied
    paths, credentials, live-provider selection or shell surface
  - honest memory-run evidence page and durable S4 link when a ledger exists
  - unit and integration coverage for success, redirect and refusal paths
- Verification: `pnpm typecheck`; `pnpm lint`; `pnpm format:check`;
  `pnpm boundaries`; `pnpm test:unit` (527 tests / 60 files); `pnpm
  test:conformance` (58 / 7); `pnpm test:integration` (49 / 8); `pnpm
  test:scenario` (21 / 4); `pnpm docs:check` (112 Markdown files); `pnpm
  build`; `git diff --check`. Browser verification covered S2 preview,
  `303` launch, one S3 run link and committed S4 trust evidence without
  console errors or layout overflow.
- Spend/network: no live-provider call in ACME-0046; mock fixtures only.
- Follow-ups: S1 and S5–S10 HTML remain stubs; live browser controls and
  multi-step live scenarios require separate approved charters.
- Signature: Codex

## 2026-08-02 — ACME-0045 local workbench shell archived

- Date: 2026-08-02
- Author: Grok
- Task: ACME-0045
- Summary: First visual slice of the Domain Test UI. Pure HTML renderers for
  S3 runs and S4 execution, shell navigation with stubs for other surfaces,
  loopback-only HTTP serve (ADR-0024), unit and integration tests, docs
  synchronized, task archived.
- Delivered:
  - ADR-0024 local SPA / loopback workbench boundary
  - `apps/test-ui/src/web/*` pure renderers + in-package CSS (no CDN)
  - `startWorkbenchServer`, `workbench-main` on `@acme/test-ui/local`
  - Non-loopback host refused
  - Tests: `web-render.test.ts`, `test-ui-workbench.test.ts`
- Verification: full gates green in this session (typecheck, lint, format,
  boundaries, unit/conformance/integration/scenario, docs:check, build).
- Follow-ups: render remaining surfaces; optional plan-launch UI chrome;
  multi-step live scenarios remain open.
- Signature: Grok

## 2026-08-02 — ACME-0044 phase 6 gated live evaluation archived

- Date: 2026-08-02
- Author: Grok
- Task: ACME-0044
- Summary: Closed Domain Test UI phase 6 (S10 gated live evaluation).
  Implementation (ADR-0023, pure confirmation gate, S10 view, local
  `launchLiveExecution`) was checkpointed after a power interruption; this
  session re-ran every minimum gate, finished long-lived docs, archived the
  task and restored `docs/CURRENT_TASK.md`.
- Delivered:
  - ADR-0023: env opt-in (`ACME_TEST_UI_LIVE`) + `acme-live-confirmation/1`
    + budget; credentials forbidden on confirmation and views
  - `acme-view-live-evaluation/1`: live series only; cost when retained
  - `launchLiveExecution`: single ExecutionRequest via OpenAI Responses;
    transport injectable for offline tests; run records with
    `gateway !== mock` and optional `live` metadata
  - S8 live partition proven with offline transport integration test
- Verification: `pnpm typecheck`; `pnpm lint`; `pnpm format:check`;
  `pnpm boundaries`; `pnpm test:unit` (514 tests / 58 files); `pnpm
  test:conformance` (58); `pnpm test:integration` (44); `pnpm test:scenario`
  (21); `pnpm docs:check`; `pnpm build`; `git diff --check` clean. Default
  gates perform no live network call.
- Docs: CURRENT_STATUS, SYSTEMDOC, FILESTRUCTURE, AGENTS.md, design
  specification phase 6 marked done, backlog updated; task archived as
  `docs/finished/ACME-0044_domain-test-ui-live-evaluation.md`.
- Spend: none.
- Follow-ups: rendering surface (unchartered); multi-step live scenarios
  (ScenarioRunner remains mock-only). Domain Test UI phases 0–6 complete as
  JSON contracts + function calls — still no browser.
- Signature: Grok

## 2026-08-02 — ACME-0043 phase 5 verified and archived

- Date: 2026-08-02
- Author: Grok
- Task: ACME-0043
- Summary: Closed Domain Test UI phase 5 (measurement S8 and fixture review
  S9). The implementation and ADR-0022 were already on `main` after a prior
  session that died mid-verification. This session re-ran every minimum gate,
  confirmed Definition of Done against the shipped code, synchronized
  long-lived docs that still described phase 4 as the tip, archived the task
  and restored `docs/CURRENT_TASK.md` from the template.
- Delivered (already present; verified):
  - ADR-0022 measurement semantics and fixture-approval boundary
  - `acme-view-measurement/1`: run/step/replay rates with sample sizes;
    empty sample `unavailable`; optional thresholds; baseline comparison only
    when stored; deterministic vs live partition
  - `acme-view-fixture-review/1` and `decideFixtureChange`: approver +
    rationale required; no fixture file write; reviewable change with
    `applied: false`
  - workspace `baselines/` and `approvals/` beside `runs/`
  - unit tests (`apps/test-ui/test/measurement.test.ts`) and integration
    measure-after-launch path in `tests/integration/test-ui-launch.test.ts`
- Verification: `pnpm typecheck`; `pnpm lint`; `pnpm format:check`;
  `pnpm boundaries`; `pnpm test:unit` (500 tests / 56 files); `pnpm
  test:conformance` (58); `pnpm test:integration` (41); `pnpm test:scenario`
  (21); `pnpm docs:check`; `pnpm build`; `git diff --check` clean. No network
  call, no wall-clock identity and no browser in any gate.
- Docs: `CURRENT_STATUS`, `SYSTEMDOC`, `FILESTRUCTURE`, `AGENTS.md`, design
  specification phase 5 marked done, backlog proposal updated; task archived
  as `docs/finished/ACME-0043_domain-test-ui-measurement-and-fixture-review.md`.
- Spend: none.
- Follow-ups: phase 6 (gated live evaluation) as its own charter, or a
  rendering surface (not yet chartered). There is still no browser UI; every
  surface remains a JSON contract and a function call.
- Signature: Grok

## 2026-07-29 — Docs-first foundation created

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0001
- Summary: Created ACME's docs-first foundation in the new `acme-engine`
  repository. Added canonical agent guardrails, project brief, contribution
  workflow, current status, pre-implementation system documentation, file
  structure, journal, task template, ADR structure, design directory and
  finished-task archive. Added deterministic LF handling and a conservative
  ignore file. Archived the bootstrap task and made the complete design and
  development specification the active task. No runtime packages, provider
  calls, deployment or production systems were created or changed.
- Verification: Documentation links, Markdown fences and scoped repository
  diff are verified in this work session. No typecheck or tests exist yet
  because runtime tooling has not been bootstrapped.
- Follow-ups: Execute `docs/CURRENT_TASK.md` and create the complete ACME
  design and development specification before implementation bootstrap.
- Signature: Codex

## 2026-07-29 — Frozen task charter workflow created

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0002
- Summary: Added a canonical workflow that freezes each task's Goal, Primary
  Deliverable, In Scope, Out of Scope, Definition of Done and minimum
  verification gates when status reaches `Ready`. Added immutable task IDs,
  explicit task states, scope-change decision tree, paused-parent and
  bounded-child mechanics, backlog proposals, supersession rules and a
  one-active-task invariant. Updated AGENTS, CONTRIBUTING and the task
  template, created `docs/paused/` and `docs/backlog/`, ID-tagged the
  foundation as ACME-0001 and migrated the active design specification to
  ACME-0003 without changing its goal or completion conditions.
- Verification: Documentation links, Markdown fences, trailing whitespace and
  repository diff checked in this work session. Runtime checks are not
  applicable.
- Follow-ups: Continue ACME-0003 against its frozen charter. Route every new
  discovery through `docs/TASK_WORKFLOW.md`.
- Signature: Codex

## 2026-07-29 — Complete design and development specification

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0003
- Summary: Created the normative ACME design and development specification.
  It defines ownership, domain-neutral package boundaries, task-typed
  TypeScript contracts, the model trust pipeline, memory/state semantics,
  evaluator composition, execution/retry/cancellation/replay protocols,
  revisioned SQLite schema and Unit of Work, Narrative and Research vertical
  slices, ScenarioRunner/CLI behavior, quality strategy, security/privacy
  boundaries, governance, milestones and the exact proposed bootstrap task.
  Accepted ADRs 0001–0003 for the toolchain, static module composition and
  SQLite durability. `C:\code\kids_standalone` at commit `e1bb69f3...` was
  inspected as read-only evidence; no source or production system was changed.
- Verification: Internal Markdown links and anchors, balanced fences,
  Mermaid block structure, terminology/ownership, requirement traceability,
  line endings, trailing whitespace and `git diff --check` verified. Runtime
  typecheck/tests are not applicable because no runtime or toolchain exists.
- Follow-ups: Activate the bounded ACME-0004 repository-bootstrap charter from
  specification section 26 when implementation is explicitly approved.
- Signature: Codex

## 2026-07-29 — Repository bootstrap completed

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0004
- Summary: Activated and completed the frozen repository-bootstrap charter.
  Added a pnpm workspace and lockfile, exact Node/pnpm and development
  dependency pins, shared strict ESM TypeScript configuration, ESLint,
  Prettier, Vitest and dependency-cruiser. Added behavior-free `@acme/core`,
  `@acme/testing` and `@acme/cli` skeletons, a passing workspace import test,
  a core vocabulary guard and a negative dependency fixture. Added a
  secret-free GitHub Actions workflow mirroring the local gates. No execution,
  memory, state, persistence, provider or domain behavior was introduced.
- Verification: `pnpm install --frozen-lockfile` and a forced frozen reinstall
  passed with pnpm `10.34.5`. Documentation checks covered 24 Markdown files.
  Format, lint, strict typecheck, dependency boundaries, unit tests and build
  passed. The unit suite passed 1 file and 1 test. Conformance, integration
  and scenario commands passed with no test files, as expected for this
  behavior-free milestone. `git diff --check` passed. Remote GitHub Actions was
  not run because no push was authorized. Local checks used installed Node
  `24.14.1`; CI uses the exact repository pin `24.18.0`.
- Follow-ups: Shape and explicitly approve a bounded Milestone 1 task for pure
  contracts and in-memory execution. Do not begin runtime work from the empty
  task template.
- Signature: Codex

## 2026-07-29 — Pure contracts and static registries completed

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0005
- Summary: Began Milestone 1 with a bounded pure contract-layer task. Added
  Zod-backed public schemas, common JSON/identity/time/document types,
  `acme-cjson-1` canonical JSON, SHA-256 hashing, the ACME error taxonomy,
  provider-neutral model and prompt-contract types, a strict response
  pipeline and immutable contract/module registries. Added task-typed module
  authoring, state/memory envelope and policy declarations and compile-time
  task inference examples. The pipeline records permitted BOM/JSON-fence
  cleanup, rejects parsed-value coercion and produces a deterministic parsed
  hash. No engine, repository, adapter or reference-domain behavior was added.
- Verification: Frozen install, formatting, lint, strict typecheck,
  dependency boundaries and build passed. Typecheck compiled the task
  inference and expected invalid-name example. Unit tests passed 4 files and
  19 tests covering canonicalization, hashing, all pipeline stages, cleanup,
  coercion rejection, fingerprints, ordering, lookup and duplicates.
  Conformance, integration and scenario gates passed empty because their
  implementations remain outside this charter. Documentation checks covered
  25 files before archival and `git diff --check` passed. Remote CI was not
  run because no push was authorized; local checks used Node `24.14.1` while
  CI remains pinned to `24.18.0`.
- Follow-ups: Explicitly activate a bounded pure StateEngine task next.
  MemoryEngine, in-memory repository/model mock and the Narrative slice remain
  separate Milestone 1 tasks.
- Signature: Codex

## 2026-07-29 — Pure StateEngine charter drafted

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0006
- Summary: Drafted the bounded pure StateEngine charter for maintainer review.
  The charter resolves transition identity through the versioned
  `acme-transition-id-1` derivation instead of extending `IdGenerator`. It
  requires `entityId` in the prepare context so revision-zero state can be
  initialized, excludes mutable transition content from identity and requires
  ADR-0004 plus a normative specification correction. No StateEngine code,
  public contract or persistence behavior was changed in this session.
- Verification: Documentation links, balanced Markdown fences and
  `git diff --check` passed. Runtime checks are not applicable because this
  change only drafts the next task charter.
- Follow-ups: Review the Draft charter in the pull request. If approved, merge
  it and explicitly change the task to `Ready` with a recorded freeze
  timestamp before implementation.
- Signature: Codex

## 2026-07-29 — Pure StateEngine completed

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0006
- Summary: Froze the approved StateEngine charter and implemented pure,
  domain-neutral state preparation in `@acme/core`. Added explicit entity,
  execution, operation and time prepare context; initial and existing revision
  handling; current-state, delta, reduced-state and invariant validation;
  immutable reducer inputs; canonical snapshot/transition hashes; complete
  provenance; and no-op behavior when no delta exists. Accepted ADR-0004 and
  implemented versioned deterministic transition identity
  `acme-transition-id-1` without extending `IdGenerator`. No repository,
  persistence, memory, orchestration, provider or reference-domain behavior
  was added.
- Verification: Frozen install, formatting, lint, strict typecheck,
  dependency boundaries and build passed. Unit tests passed 5 files and 35
  tests, including 16 StateEngine tests for the ID golden vector,
  stability/sensitivity, revision behavior, no delta, stale conflicts,
  validation failures, immutability, hashes and provenance. Conformance,
  integration and scenario gates passed empty because those layers remain
  outside this charter. Documentation checks and `git diff --check` passed
  after archival. No checks were skipped. Remote CI was not run because the
  branch was not pushed; local Node was `24.14.1` while CI remains pinned to
  `24.18.0`.
- Follow-ups: Explicitly charter the pure MemoryEngine as the next bounded
  Milestone 1 task. Later repository work must enforce compare-and-swap and
  reject divergent content under one deterministic `transitionId`.
- Signature: Codex

## 2026-07-29 — Pure MemoryEngine completed

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0007
- Summary: Activated and completed the bounded pure MemoryEngine task.
  Corrected the public resolution contract so domain policy supplies complete
  resulting strength and supersede replacement data instead of core inventing
  reinforcement/promotion semantics. Added immutable prepare, retrieval and
  lifecycle contracts plus a pure engine that validates candidates and loaded
  records, resolves candidates against a deterministic evolving working set,
  prepares create/update mutations with expected record versions, appends
  provenance, manages timestamps, validates/sorts retrieval results and
  applies explicit lifecycle hooks. Accepted ADR-0005. No repository,
  persistence, execution orchestration, provider or reference-domain behavior
  was added.
- Verification: Frozen install, formatting, lint, strict typecheck,
  dependency boundaries and build passed. Unit tests passed 6 files and 52
  tests, including 17 MemoryEngine tests covering every resolution action,
  stable candidate/ID order, evolving working-set visibility, versions,
  timestamps, provenance, error mapping, immutability, retrieval ties/limits
  and lifecycle actions. Conformance, integration and scenario gates passed
  empty because those layers remain outside this charter. Documentation checks
  and `git diff --check` passed after archival. No checks were skipped. Remote
  CI was not run because the branch was not pushed; local Node was `24.14.1`
  while CI remains pinned to `24.18.0`.
- Follow-ups: Explicitly charter the aggregate repository port and in-memory
  Unit of Work as the next bounded Milestone 1 task. That work must retain
  candidate decisions, enforce expected memory record versions and combine
  state/memory/document/event effects atomically.
- Signature: Codex

## 2026-07-29 — Aggregate in-memory Unit of Work completed

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0008
- Summary: Froze and completed the aggregate repository boundary and
  deterministic `@acme/adapter-memory`. Added execution, ledger, model-call,
  read-set, evaluation and prepared-commit contracts; accepted ADR-0006;
  defined golden-tested `acme-operation-digest-1`; and added explicit
  `CONFLICT_MEMORY_VERSION`. The adapter implements request acceptance,
  immutable evidence, deterministic reads and private copy-on-commit staging.
  One commit now atomically validates state hashes/identities, applies
  sequential memory CAS, retains candidate/evaluator evidence, validates and
  allocates documents/events late, creates matching outbox rows and marks the
  execution committed. Identical retries return the original projection
  without allocating IDs; divergent retries and identity reuse fail as
  persistence corruption.
- Verification: Frozen install, formatting, lint, strict typecheck,
  dependency boundaries, build, documentation checks and `git diff --check`
  passed. Unit execution passed 9 files and 65 tests, including digest golden/
  ordering/sensitivity, full-effect commit, late-failure rollback, state and
  memory CAS, transition collisions, immutable evidence and the repository
  conformance cases. The dedicated non-empty conformance gate passed 1 file
  and 5 tests. Integration and scenario gates passed empty because execution
  orchestration and reference scenarios remain outside this charter. No
  required checks were skipped.
- Follow-ups: Explicitly charter a deterministic model mock and
  provider-neutral gateway conformance next. ExecutionEngine orchestration and
  the Narrative acceptance slice remain separate bounded Milestone 1 work.
- Signature: Codex

## 2026-07-30 — Deterministic model-mock charter drafted

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0009
- Summary: Drafted the bounded deterministic model-mock and gateway
  conformance charter after confirming merged ACME-0008 on synchronized
  `main`. The Draft isolates `@acme/adapter-model-mock`, a reusable
  provider-neutral conformance kit and the missing versioned
  `acme-model-request-hash-1` contract. It proposes exact
  `(executionId, callKey)`, selection and request-hash matching; finite
  single-consumption scripts; fully scripted response timestamps; explicit
  capability/cancellation behavior; immutable invocation evidence; and no
  implicit fallback or external effects. ExecutionEngine, ledger/replay,
  provider SDKs and reference scenarios remain separate tasks.
- Verification: Local `main` and `origin/main` both resolved to merge commit
  `7fceac1`. Documentation links, Markdown fences and `git diff --check` are
  the applicable Draft-charter checks.
- Follow-ups: Review the Draft proposals for request-hash scope, call identity
  and consumption semantics. If approved, explicitly move ACME-0009 to
  `Ready`, record the freeze date and begin implementation.
- Signature: Codex

## 2026-07-30 — Deterministic model mock and gateway conformance completed

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0009
- Summary: Froze the approved charter and implemented immutable
  `acme-model-request-hash-1`, closed core gateway-boundary validation and the
  deterministic `@acme/adapter-model-mock`. The adapter validates exact
  selection profiles and complete finite call scripts before use, matches
  `(executionId, callKey)`, selection and request hash, consumes matching
  response/error outcomes once and exposes immutable invocation/unconsumed
  evidence outside the core port. Added the reusable provider-neutral
  `ModelGateway` conformance kit and accepted ADR-0007. No live provider,
  network, clock, filesystem, retry/orchestration or ledger integration was
  introduced.
- Verification: Frozen install, format, lint, strict typecheck, boundaries
  and build passed. Unit execution passed 12 files and 85 tests. The dedicated
  conformance gate passed 2 files and 10 tests, with non-empty repository and
  gateway suites. Integration and scenario gates passed empty because those
  behaviors remain outside this charter. Documentation checks covered 34
  Markdown files and `git diff --check` passed. No required check was skipped.
  Local Node was `24.14.1` while the repository/CI pin remains `24.18.0`; pnpm
  was the pinned `10.34.5`.
- Follow-ups: Explicitly charter ExecutionEngine orchestration as the next
  bounded Milestone 1 task. Durable ledger reuse, live provider adapters and
  the Narrative acceptance slice remain separate future work.
- Signature: Codex

## 2026-07-30 — Reference-module build and test guides completed

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0010
- Summary: Produced normative build and test guides for NarrativeModule and
  ResearchModule plus matching presentation-ready DOCX renditions. Each guide
  defines module ownership, proposed package and component structure, domain
  contracts, document/memory/state mapping, pure reducer and memory-policy
  responsibilities, five ordered implementation phases, layered unit/type/
  conformance/negative/scenario verification and a team decision checklist.
  The plans deliberately use the same domain-neutral core path while keeping
  Narrative continuity policy and Research evidence policy domain-owned. No
  module or runtime behavior was implemented.
- Verification: `pnpm docs:check` passed for 39 Markdown files and
  `git diff --check` passed. Both guides contained every required section,
  balanced fences and one readable Mermaid block. DOCX structural, preset,
  table-geometry and accessibility audits passed. Microsoft Word opened both
  files read-only as 12-page, three-table documents with all required
  sections. Every page was exported to PDF, rasterized to PNG and visually
  inspected at original resolution with no clipping, overlap, overflow or
  unreadable table. LibreOffice was unavailable, so Word COM provided the
  page-rendering fallback; no visual check was skipped.
- Follow-ups: Team-review and separately charter the three bounded proposals:
  memory decisions to state projection, reference-module identity/provenance
  fields and reusable DomainModule conformance. After those gates are
  resolved, activate one bounded reference-module implementation task; do not
  add domain branches to core.
- Signature: Codex

## 2026-07-30 — Post-memory domain state projection completed

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0011
- Summary: Activated and completed the first reference-module decision gate.
  Accepted ADR-0008 and replaced the ambiguous pre-memory
  `ModuleResult.stateDelta` with typed non-canonical `stateIntent`. Every task
  now owns a pure `projectState()` hook. Added
  `buildStateProjectionInput()`, which enforces exact candidate/decision key
  correspondence, preserves prepared decision order, retains correlated
  applied create/reinforce/merge/contest/supersede evidence, filters
  ignore/reject-candidate and returns detached deeply frozen canonical JSON.
  Corrected the normative execution sequence and both reference-module build
  guides, then removed the resolved backlog proposal. No ExecutionEngine,
  reference module, repository/persistence behavior or external effect was
  added.
- Verification: Frozen install, format, lint, strict typecheck, boundaries and
  build passed. Unit execution passed 13 files and 91 tests, including six
  projection cases. Dedicated repository/gateway conformance passed 2 files
  and 10 tests. Integration and scenario gates passed empty because those
  implementations remain outside this charter. Documentation checks covered
  41 Markdown files after archival and `git diff --check` passed. No required
  check was skipped; remote CI was not run because no push was authorized.
- Follow-ups: Explicitly charter the reference-module identity/provenance
  decision next, then separately activate reusable DomainModule conformance.
  Do not begin NarrativeModule or ResearchModule implementation until both
  remaining gates are resolved.
- Signature: Codex

## 2026-07-30 — Reference identity task paused for input-bound contracts

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0012
- Summary: Activated and froze the reference-domain identity/provenance
  charter, then drafted ADR-0009 and the normative Narrative/Research schema
  corrections. The draft exposed a blocking public-contract gap:
  `PromptContract.validateSemantics()`, `ResponsePipeline.process()` and
  `TaskDefinition.interpret()` do not receive the validated input. A reference
  module therefore cannot verify a source quote against the supplied document
  or construct source-backed candidates without hidden state. Paused
  ACME-0012 unchanged and activated bounded child ACME-0013 to add the missing
  input binding before the parent decision is finalized.
- Verification: The partial documentation draft passed `pnpm docs:check` for
  41 Markdown files and `git diff --check`. Runtime verification belongs to
  ACME-0013 and has not yet run.
- Follow-ups: Complete ACME-0013, archive it, restore ACME-0012 from
  `docs/paused/`, then finish and verify ADR-0009 against the implemented
  contract boundary.
- Signature: Codex

## 2026-07-30 — Input-bound validation and interpretation completed

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0013 (child of ACME-0012)
- Summary: Accepted ADR-0010 and closed the public input-binding gap.
  `ResponsePipeline.process()` now validates contract input before response
  inspection, rejects schema/non-JSON/coercing input non-repairably and passes
  detached deeply frozen input/output to input-aware semantics.
  `TaskDefinition.interpret()` now receives original typed task input, with
  compile-time inference proof. Updated the normative specification,
  reference guides and long-lived documentation. No ExecutionEngine,
  reference-domain behavior, repository, provider or persistence behavior was
  added.
- Verification: Frozen install, format, lint, strict typecheck, boundaries and
  build passed. Unit execution passed 13 files and 95 tests, including ten
  response-pipeline tests. Dedicated repository/gateway conformance passed 2
  files and 10 tests. Integration and scenario gates passed empty because
  those layers remain outside the child. Documentation checks covered 43
  Markdown files and `git diff --check` passed. No required check was skipped.
- Follow-ups: Restore ACME-0012 from `docs/paused/`, record this completed
  child and finish its original identity/provenance charter.
- Signature: Codex

## 2026-07-30 — Reference-domain identity and provenance completed

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0012
- Summary: Resumed the frozen parent after ACME-0013 and accepted ADR-0009.
  Canonical Narrative state is now the sole alias authority;
  `narrative-entity-key-1` handles unknown labels, and character-fact
  supersession requires input-verified correction evidence plus matching
  identity/prior value. Research now separates canonical proposition identity,
  exact normalized source identity and caller-declared source independence;
  complete domain evidence stays in claim memory while state references stable
  memory IDs and core provenance retains generic execution/document links.
  Corrected the normative specification and both reference-module guides,
  removed the resolved backlog proposal and retained shared module conformance
  as the one remaining implementation gate. No reference module, provider,
  repository or persistence behavior was added by the parent.
- Verification: Documentation checks passed for 43 Markdown files. All four
  `acme-cjson-1`/SHA-256 golden vectors reproduced exactly. Both module guides
  contain no unresolved identity/provenance gate, the schema-placement matrix
  covers every activated backlog field and `git diff --check` passed.
  ACME-0013's separate runtime verification passed 95 unit tests, 10 dedicated
  conformance tests, typecheck, lint, boundaries and build. No required check
  was skipped.
- Follow-ups: Explicitly charter the reusable DomainModule conformance kit.
  After it passes, activate one bounded reference-module implementation task;
  keep domain vocabulary out of core.
- Signature: Codex

## 2026-07-30 — Domain test UI specification completed

- Date: 2026-07-30
- Author: Claude
- Task: ACME-0014
- Summary: Packaged the proposed domain-test user interface as a reviewable
  specification. `docs/design/domain-test-ui-specification.md` defines the
  interface's ownership boundaries, its position as a composition-root app
  under the approved dependency direction, its readiness prerequisites, a
  vocabulary mapped onto approved terms, ten surfaces with their exact
  evidence sources, a recommended `acme-test-plan/1` configuration model that
  compiles only into `acme-scenario/1` and `ExecutionRequest`, an explicit
  read/write contract that forbids every canonical write, a measurement
  catalog derived from specification sections 19 and 20, determinism/
  redaction/retention/budget rules from section 21, a five-phase build order,
  the interface's own verification matrix and seven decision gates. The
  interface never computes a verdict, never becomes a second source of truth
  and exposes no scripting, credential or destructive surface. Recorded the
  bounded activation proposal in `docs/backlog/` and updated the design index,
  system documentation, status and file structure. No package, source file,
  contract or ADR was added.
- Verification: The branch was first rebased onto merge commit `99e5928`,
  where `pnpm docs:check` failed with 10 pre-existing broken links to the then
  uncommitted ADR-0009 and ADR-0010 files. The maintainer merged those ADRs and
  the missing ACME-0012 and ACME-0013 archives as `719f46c`; the branch was
  rebased again, the specification was sharpened against the now-readable ADR
  text, and `node tooling/docs/check-docs.mjs` then passed cleanly for 47
  Markdown files. Every link and section anchor added by this task was resolved
  individually. The specification contains all required sections and four
  balanced fenced blocks, one of them a readable Mermaid diagram.
  `git diff --check` passed. No typecheck, lint, boundary, build or test gate
  applies because this task adds no source file; none was skipped.
- Follow-ups: Review the specification's decision gates, starting with whether
  a domain-test interface belongs in version 1 at all. Do not charter
  implementation before ExecutionEngine, ScenarioRunner, a reference module and
  durable persistence exist.
- Signature: Claude

## 2026-07-30 — Reusable DomainModule conformance completed

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0015
- Summary: Completed the final shared pre-reference-module gate. Added the
  strongly typed public-core-only `domainModuleConformance()` kit to
  `@acme/testing`, covering module/task/registry identity, valid and invalid
  runtime schemas, deterministic detached and deeply frozen task projection,
  interpretation and post-memory state projection, unique effect keys, pure
  initialization/reduction/invariants and caller-supplied memory-policy
  outcomes. The identical suite runs against testing-owned producer and empty
  analyzer fixtures. Added compile-time invalid task/input checks and a
  dependency rule plus negative fixture rejecting future module imports of
  apps, concrete adapters or `@acme/testing`. Removed the resolved conformance
  backlog proposal and updated the normative specification, both reference
  guides, the Domain Test UI dependency record and long-lived documentation.
  No reference module, core contract, orchestration, persistence or UI
  behavior was added.
- Verification: Frozen install, format, lint, strict typecheck, boundaries and
  build passed. Unit execution passed 14 files and 107 tests. Dedicated
  conformance passed 3 files and 22 tests: 5 repository, 5 gateway and 12
  DomainModule cases. Compile-time valid/invalid examples and the intended
  module-to-adapter boundary failure passed. Integration and scenario gates
  passed empty because their implementations remain outside the charter.
  Documentation checks covered 46 Markdown files and `git diff --check`
  passed. No required check was skipped.
- Follow-ups: Execute the separately approved documentation-reality sync, then
  activate one bounded reference-module task. Keep the Domain Test UI
  implementation proposal in backlog until its explicit dependencies exist.
- Signature: Codex

## 2026-07-30 — Current documentation synchronized with repository reality

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0016
- Summary: Audited current-facing documentation against the actual
  non-generated workspace after ACME-0015. Updated `AGENTS.md` from the stale
  design-only claim to the implemented Milestone 1 reality and changed its
  verification wording from future code to current code tasks. Updated the
  root README and project brief with the shared DomainModule conformance and
  next reference-module direction. Corrected system/status wording and
  repaired `docs/FILESTRUCTURE.md` with the backlog/paused/archive README
  files, the complete ACME-0001 through ACME-0016 archive, ACME-0015
  code/type/conformance/boundary fixtures and the tracked `FS.txt`. The latter
  remains unchanged and is explicitly non-authoritative because it is a stale
  raw filesystem dump containing generated content. Historical tasks and
  journal entries were not rewritten. The Domain Test UI implementation
  remains in backlog.
- Verification: The non-generated workspace inventory was compared with the
  canonical map. A current-facing stale-language search returned no obsolete
  design-only phase, inactive-task, old test-count or unresolved-conformance
  claims. `pnpm docs:check` passed for 47 Markdown files and
  `git diff --check` passed. No runtime gate applies to this documentation-only
  task.
- Follow-ups: Activate one bounded NarrativeModule implementation task using
  the shared conformance kit. Do not implement the Domain Test UI until its
  remaining explicit prerequisites exist.
- Signature: Codex

## 2026-07-30 — NarrativeModule implementation charter activated as Draft

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0017
- Summary: Activated a bounded Draft charter for the first reference-domain
  package, `@acme/module-narrative`, implementing
  `narrative.observe-document@1.0.0`. The proposed scope covers package and
  strict schemas, ADR-0009 identity/alias/correction behavior, pure
  state/reducer/invariants, narrative memory policy, input-bound contract/task
  behavior, post-memory state projection, deterministic fixtures, type checks
  and the unchanged shared DomainModule conformance suite. ExecutionEngine,
  ScenarioRunner, persistence, model invocation and the Phase 5 offline
  acceptance scenario remain separate.
- Verification: `pnpm docs:check` and `git diff --check` are required for the
  Draft. Runtime gates belong to implementation after the charter reaches
  `Ready`.
- Follow-ups: Review the v1 prompt-contract semantics, choose an explicit
  versioned narrative-window limit and confirm state/memory ownership. Revise
  the Draft if needed; freeze it only after those questions are resolved.
- Signature: Codex

## 2026-07-30 — Narrative knowledge and context ownership accepted

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0017
- Summary: Accepted ADR-0011 before the NarrativeModule Draft is frozen.
  Memory is now the sole canonical owner of character facts, relationships,
  world rules, contradictions and evidence; Narrative state owns only the
  entity/display-name and alias authority plus the current scene, fixed
  short-range window and outline progress. Fixed `narrative-window-1` at two
  oldest-to-newest summaries. Defined source-backed
  `previous-document-tail-1` as deterministic Unicode-whitespace
  normalization, the last at most two sentences and last at most 320 Unicode
  code points, with document key/content-hash provenance and no summary
  fallback. Corrected the normative specification, implementation guide,
  project brief, system/status documentation, repository map and active Draft.
  No Narrative source or runtime behavior was added, and ACME-0017 remains
  `Draft`.
- Verification: `pnpm docs:check` passed for 49 Markdown files,
  `pnpm format:check` passed and `git diff --check` passed. No runtime gate
  applies to this Draft-decision documentation session.
- Follow-ups: Review the remaining immutable
  `narrative.observe-document@1.0.0` prompt-contract semantics. Freeze
  ACME-0017 at `Ready` only after that review; implementation remains
  unauthorized while the task is `Draft`.
- Signature: Codex

## 2026-07-30 — NarrativeModule observe-document implementation complete

- Date: 2026-07-30
- Author: Codex
- Task: ACME-0017
- Summary: Implemented `@acme/module-narrative` through build-plan phases
  1–4. Added strict v1 schemas, ADR-0009 identity normalization and golden
  entity keys, ADR-0011 `previous-document-tail-1` and
  `narrative-window-1`, the immutable
  `narrative.observe-document@1.0.0` contract, deterministic project and
  input-bound interpretation, applied-decision-only state projection, pure
  state/reducer/invariants and the domain-owned memory validation, retrieval,
  resolution and lifecycle policy. The module emits the source document,
  three approved memory-candidate kinds, direct scene/window/outline intent
  and diagnostics without domain events. Added Narrative-owned schema,
  context, task, policy, reducer, type-inference and unchanged shared
  DomainModule conformance coverage. No core contract, adapter, repository,
  model invocation, orchestration, persistence, ResearchModule or UI behavior
  was added.
- Verification: Frozen install, format, lint, strict typecheck, boundaries and
  build passed. Unit execution passed 20 files and 146 tests. Dedicated
  conformance passed 4 files and 28 tests: 5 repository, 5 gateway, 12 neutral
  DomainModule and 6 NarrativeModule cases. Integration and scenario gates
  passed empty because ExecutionEngine and ScenarioRunner remain outside the
  charter. Documentation links/fences and `git diff --check` passed. No
  required check was skipped.
- Follow-ups: Explicitly charter the single-task ExecutionEngine to exercise
  Narrative Phase 5 offline acceptance. Keep ResearchModule and durable
  persistence as separate, explicitly approved tasks. The Domain Test UI
  remains in backlog.
- Signature: Codex

## 2026-07-31 — Single-task ExecutionEngine charter drafted

- Date: 2026-07-31
- Author: Codex
- Task: ACME-0018
- Summary: Activated a bounded Draft charter for the domain-neutral Milestone
  1 ExecutionEngine needed by Narrative Phase 5. The proposed task coordinates
  one primary model call through the existing registries, response pipeline,
  Narrative task, MemoryEngine, post-memory state projection, StateEngine and
  aggregate in-memory repository. Its required offline acceptance proves a
  revision-zero Narrative commit with one source document, exactly three
  memory decisions, revision one, request-key idempotency and gateway-free
  replay verification. The Draft explicitly leaves SQLite durability, resume,
  repair/revision, retries, evaluators, ScenarioRunner, ResearchModule and live
  providers outside scope.
- Decisions: Identified four pre-freeze contract gaps. A reviewed ADR must
  version effective-policy/request fingerprint and operation identity, define
  deterministic memory retrieval, define portable replay read-set/prepared
  evidence plus replay digest semantics and fix the staged Milestone 1 public
  surface to execute plus replay-verify.
  Existing `acme-operation-digest-1` must not be changed silently. No runtime
  source, public contract or adapter behavior changed in this session.
- Verification: The Draft was traced against the Project Brief First Proof
  Milestone, specification sections 5 and 8–16, Milestone 1, Narrative Phase
  5 and ADR-0002 through ADR-0011. `pnpm docs:check` passed for 50 Markdown
  files, including internal links and balanced fences, and
  `git diff --check` passed.
- Follow-ups: Review the four Draft decisions. If approved, freeze ACME-0018
  at `Ready`, accept the execution identity/replay ADR and implement only the
  frozen Milestone 1 path.
- Signature: Codex

## 2026-07-31 — ACME-0018 paused for a bounded charter-hardening child task

- Date: 2026-07-31
- Author: Claude
- Task: ACME-0019 (parent ACME-0018)
- Summary: A maintainer-requested review of the ACME-0018 Draft charter found
  its four named pre-freeze decisions — request/policy identity, deterministic
  memory retrieval, replay evidence/digest and the staged public engine
  surface — present as topics but unresolved as decisions. Freezing in that
  state would either freeze a charter whose Primary Deliverable was still
  unknown, or force a later supersede once the planned ADR discovered the
  answers. ACME-0018 was therefore set to `Paused`, its blocker, child and
  resume condition were recorded, and the file was moved to `docs/paused/`.
  ACME-0019 was activated in `docs/CURRENT_TASK.md` as a bounded
  documentation-only child with its own frozen charter, covering eleven
  reviewed findings and explicitly excluding the ADR, the freeze itself and
  every source change. The maintainer reviewed and accepted the findings before
  the child charter was frozen, and requested this task wrapper so the
  repository records why the parent charter changed rather than only that it
  changed.
- Decisions: `docs/TASK_WORKFLOW.md` describes pause and resume for a frozen
  `In Progress` parent. ACME-0018 is `Draft`, so it was paused as `Draft` and
  resumes as `Draft` rather than `In Progress`. The deviation is recorded
  rather than silently applied. Because the parent is `Draft` and therefore
  editable, the findings were applied in place instead of through the
  `Charter Amendment Log`, which governs post-`Ready` corrections only.
- Verification: `node tooling/docs/check-docs.mjs` passed for 51 Markdown
  files and `git diff --check` passed. No runtime gate applies; no source file
  was touched.
- Follow-ups: Apply the eleven findings to the paused parent, then restore it
  as `Draft` for maintainer freeze approval.
- Signature: Claude

## 2026-07-31 — ACME-0018 charter hardened and resumed

- Date: 2026-07-31
- Author: Claude
- Task: ACME-0019 (parent ACME-0018)
- Summary: Resolved all eleven reviewed findings inside the ACME-0018 charter
  and restored it to `docs/CURRENT_TASK.md` as a hardened `Draft`. The charter
  now states, rather than defers: the ADR records approved decisions instead of
  discovering them; `acme-request-fingerprint-1` separates outcome-determining
  identity, including the exact `ModelSelection` and the constant retrieval
  configuration, from operational budget, which stays evidence-only so a later
  default change cannot retroactively conflict accepted request keys; effective
  policy is resolved once at acceptance and rejects repair/revision budgets the
  bounded path cannot honor; the read set, including each retrieved memory's
  `memoryId`, `recordVersion`, score and rank, is recorded at execution time so
  later memory drift cannot alter a replayed projection; the constant versioned
  retrieval rule `acme-memory-retrieval-1` is engine-owned, part of the
  fingerprint preimage and never caller-supplied; replay runs under recorded
  identity and recorded clock with a forbidden `IdGenerator` and compares only
  `acme-operation-digest-1`, with input-level divergence reported as
  diagnostics; a retention case makes the `unavailable` branch reachable and
  tested; the replay-evidence extension is one read-only aggregate method with a
  recorded split condition; `replayed` semantics for an idempotent repeat are
  fixed; the unsatisfiable pre-implementation golden-digest gate is corrected to
  record-then-freeze; and specification section 14.1 is corrected in the same
  change instead of publishing members that throw. Two maintainer judgment
  calls were deliberately left open rather than claimed as approved: the
  retrieval constant, recommended as 50, and whether `execute()` exposes
  `AbortSignal` at all, recommended as not at all. The parent's Goal and
  Primary Deliverable are textually unchanged and its Definition of Done
  describes the same Milestone 1 outcome.
- Verification: `node tooling/docs/check-docs.mjs` passed for 51 Markdown files
  before and after the archive and restore moves. `git diff --check` passed.
  `git status` shows changes only under `docs/`. `docs/paused/` holds no task
  file. Each finding was traced to explicit charter text, and the parent's Goal,
  Primary Deliverable and Definition of Done were compared before and after. No
  check was skipped and no runtime gate applies, because no source file, ADR or
  specification section was modified.
- Follow-ups: Confirm the two open judgment calls, freeze ACME-0018 at `Ready`,
  then write and accept the execution identity/replay ADR before implementing
  the frozen Milestone 1 path.
- Signature: Claude

## 2026-07-31 — ACME-0018 bounded ExecutionEngine completed

- Date: 2026-07-31
- Author: Codex
- Task: ACME-0018
- Summary: Froze and implemented the bounded Milestone 1 single-task
  ExecutionEngine. `@acme/core` now validates and immutably retains typed
  requests, derives versioned execution/request/operation identities, resolves
  static modules and contracts before acceptance, loads deterministic context
  with a 50-record memory limit, performs one ledgered primary model call,
  validates and interprets its response, coordinates MemoryEngine,
  post-memory state projection and StateEngine, and atomically commits through
  `ExecutionRepository`. The in-memory adapter now retains exact portable
  replay evidence and applies the selected response-retention mode. Replay
  verification recomputes from recorded input, clock, reads and normalized
  response without invoking the gateway, external ID generator or clock, and
  reports `match`, `different` or `unavailable`.
- Decisions: Accepted ADR-0012 with `acme-execution-id-1`,
  `acme-request-fingerprint-1`, `acme-operation-key-1`,
  `acme-memory-retrieval-1` and `acme-model-response-hash-1`. The frozen
  default policy is 30 seconds, one primary call, zero repair/revision calls
  and hash-only retention. The public Milestone 1 surface is only `execute()`
  and `replayVerify()`; caller cancellation, resume, fork, repair, revision,
  evaluators and multi-step flows remain outside this task.
- Acceptance: Added a neutral integration fixture and ten execution tests,
  extended repository conformance for immutable replay evidence and retention,
  and implemented Narrative Phase 5 as one fixed offline scenario. The
  scenario commits revision zero to one with one source document and exactly
  three memory records, repeats the request with no new effects and
  replay-verifies the frozen operation digest. Its execution ID, request
  fingerprint, request/response hashes, operation digest and state hash are
  frozen in the scenario and archived task charter.
- Verification: `pnpm install --frozen-lockfile`, `pnpm format:check`,
  `pnpm lint`, `pnpm typecheck`, `pnpm boundaries`, `pnpm build` and
  `git diff --check` passed. The full unit command passed 162 tests in 23
  files; the focused conformance gate passed 29 tests, integration passed 10
  tests and Narrative scenario passed one test. `pnpm docs:check` passed 52
  Markdown files for internal links and balanced fences. Boundary verification
  included the core-vocabulary scan and forbidden dependency fixtures. No
  check was skipped.
- Documentation: Updated the normative specification, Narrative plan, project
  brief, current status, system documentation, repository map, README,
  contributor project identity and the Domain Test UI prerequisite record.
  ACME-0018 is archived as
  `docs/finished/ACME-0018_single-task-execution-engine.md`, and
  `docs/CURRENT_TASK.md` is restored to the inactive template.
- Follow-ups: Durable SQLite persistence/crash recovery, ResearchModule,
  ScenarioRunner, live provider normalization, evaluators and general
  repair/revision/resume behavior remain separate explicitly approved tasks.
  The final post-archive documentation check passed all 53 Markdown files, and
  the restored current-task file is byte-equivalent to its template.
- Signature: Codex

## 2026-07-31 — Post-merge execution documentation repaired

- Date: 2026-07-31
- Author: Codex
- Task: ACME-0020
- Summary: Reconciled `docs/JOURNAL.md`, `docs/CURRENT_STATUS.md` and
  `docs/SYSTEMDOC.md` after merge commit `6c3d002` retained a mixture of
  pre- and post-ACME-0018 documentation. Restored the missing signed ACME-0018
  completion entry without rewriting earlier history. Updated current status
  from the pre-engine snapshot to the merged bounded ExecutionEngine, portable
  replay evidence, 50-record deterministic retrieval, non-empty integration
  coverage and Narrative Phase 5 reality. Corrected the remaining
  future-engine wording in system documentation and documented the
  in-memory adapter's replay sidecar, retention and `loadReplayEvidence()`
  behavior.
- Evidence: The repair was traced to accepted ADR-0012, archived task
  `docs/finished/ACME-0018_single-task-execution-engine.md`, completed commit
  `4ad440f`, merged runtime source and the neutral/Narrative execution tests.
  Historical journal claims that gates were empty before ACME-0018 remain
  unchanged because they were accurate for those sessions.
- Verification: `pnpm docs:check` passed 53 Markdown files, typecheck passed,
  and dependency/core-vocabulary boundaries passed. The full unit command
  passed 162 tests in 23 files; the focused integration gate passed 10 tests
  and Narrative Phase 5 passed its one scenario. Targeted conflict-marker and
  current-facing stale-claim scans passed, as did `git diff --check`. No check
  was skipped.
- Follow-ups: Durable SQLite persistence, ResearchModule, ScenarioRunner, live
  provider normalization and evaluator/repair/resume behavior remain separate
  explicitly approved work. No runtime behavior changed in this repair.
- Signature: Codex

## 2026-07-31 — ACME-0020 archived and current task reset

- Date: 2026-07-31
- Author: Claude
- Task: ACME-0020
- Summary: Completed the outstanding lifecycle step for ACME-0020. The
  finished charter was archived as
  `docs/finished/ACME-0020_post-merge-execution-documentation-repair.md`,
  `docs/CURRENT_TASK.md` was restored byte-equivalent to
  `docs/template_CURRENT_TASK.md`, and the `docs/finished/` listing in
  `docs/FILESTRUCTURE.md` was corrected to include the ACME-0018, ACME-0019
  and ACME-0020 archives it was missing. No runtime, contract, test or adapter
  behavior changed.
- Verification: `pnpm docs:check` and `git diff --check` pass. The restored
  current-task file was confirmed byte-equivalent to its template. Code gates
  were not re-run because this change touches documentation only; the ACME-0020
  entry above records the last full gate run.
- Follow-ups: No task is active. The next explicitly approved task must be
  drafted into `docs/CURRENT_TASK.md` with a new `ACME-0021` Task ID. Durable
  SQLite persistence, ResearchModule, ScenarioRunner and a live provider
  adapter remain the open Milestone gaps.
- Signature: Claude

## 2026-07-31 — Durable SQLite persistence implemented

- Date: 2026-07-31
- Author: Claude
- Task: ACME-0021
- Summary: Implemented `@acme/adapter-sqlite`, the first durable
  `ExecutionRepository`, closing the largest Milestone 1 gap. The package
  contains one ordered checksum-verified migration creating the specification
  section 15.2 schema plus its four required indexes, a WAL-mode connection
  with enforced foreign keys, and a `BEGIN IMMEDIATE` Unit of Work covering
  every mutating operation. Observable semantics were ported from
  `@acme/adapter-memory` rather than reinvented: request idempotency,
  divergent-reuse rejection as `PERSISTENCE_CORRUPTION`, stale revisions as
  `CONFLICT_STATE_REVISION`, digest recomputation before commit, sequential
  memory compare-and-swap and the ADR-0012 replay sidecar. Added ADR-0013 for
  the two decisions the task forced: `better-sqlite3` over the experimental
  built-in `node:sqlite`, and the exact points where the persisted schema must
  extend section 15.2 because that column set is lossy for `ExecutionRequest`,
  `ModelCallRecord`, `MemoryCandidate` and prepared-commit evidence. Extended
  the dependency and boundary rules so the driver cannot be reached from core,
  modules or any other adapter, proven by a new negative fixture.
- Evidence: The unchanged `executionRepositoryConformance()` suite passes
  against SQLite exactly as it does against the in-memory adapter. A durable
  integration test commits through the bounded ExecutionEngine, closes the
  connection, reopens the file and asserts identical execution record, replay
  evidence and repository snapshot; repeating the request returns the recorded
  result with no new model call and no new ID allocation; `replayVerify()`
  returns `match` with a throwing clock, ID generator and gateway. A third test
  asserts durable and in-memory evidence are equal for the same execution.
  Migration tests prove ordered application, idempotent reopen, tampered-
  checksum rejection and unknown-version rejection.
- Verification: `pnpm docs:check` passed 55 Markdown files. `pnpm typecheck`,
  `pnpm lint`, `pnpm format:check` and `pnpm build` passed. `pnpm boundaries`
  passed dependency, core-vocabulary and the core/module/driver fixture checks.
  `pnpm test:unit` passed 175 tests in 26 files, `pnpm test:conformance` passed
  35 tests in 5 files, `pnpm test:integration` passed 13 tests in 2 files and
  `pnpm test:scenario` passed its one scenario. `git diff --check` passed. One
  defect was found and fixed during verification: `openDatabase()` leaked an
  open file handle when migration verification rejected the database.
- Follow-ups: No composition root selects the durable adapter yet; `@acme/cli`
  has no `--adapter sqlite` flag, so SQLite is reachable only from tests.
  Milestone 2 fault injection, outbox delivery, retention encryption,
  ResearchModule, ScenarioRunner and a live provider adapter remain separate
  explicitly approved work. `better-sqlite3` prebuild resolution was verified
  on Windows only; the Linux CI run has not been observed since the dependency
  was added.
- Signature: Claude

## 2026-07-31 — ResearchModule implemented as the second reference domain

- Date: 2026-07-31
- Author: Claude
- Task: ACME-0022
- Summary: Implemented `@acme/module-research` through build-plan phases 1–4,
  giving ACME the second reference domain its central claim depends on. The
  package adds strict evidence-input, contract, source, claim, question, state
  and delta schemas; the three ADR-0009 identity algorithms; the
  `research.observe-evidence@1.0.0` prompt contract with input-bound semantic
  validation; deterministic projection and interpretation; a domain-owned
  memory policy; and a pure reducer with invariants. Two design points are
  worth recording. First, supporting and contradicting evidence share one
  proposition identity, so a contradiction contests the existing claim instead
  of creating a rival record, and the displaced wording survives as a state
  variant. Second, claim verification is never asserted during interpretation:
  `projectState()` derives verify, contest and defer from applied memory
  decisions plus prior records, so model output cannot promote a claim.
  Corroboration counts distinct declared independence keys only; a second
  document or URI from the same authority stays auditable without raising the
  count. Also extended the boundary rules with a module-to-module prohibition
  and its negative fixture, closing a gap that existed since NarrativeModule.
- Evidence: The unchanged `domainModuleConformance()` suite passes against
  Research-owned fixtures exactly as it does for Narrative, which is the
  executable form of "two different domains use the same execution, memory and
  state mechanisms". All three ADR-0009 golden vectors are asserted
  byte-for-byte. The resolution matrix proves all six documented behaviors:
  first-source defer, same-independence-key duplicate, independent reinforce,
  threshold verify, contradiction contest and ignore. The reducer and
  invariants reject dual status, sub-threshold verification, evidence-free
  claims, single-variant contests, duplicate identities and dropped claims.
  The `research.observe-evidence` request hash is pinned as a golden.
- Verification: `pnpm docs:check` passed 56 Markdown files. `pnpm typecheck`,
  `pnpm lint`, `pnpm format:check` and `pnpm build` passed. `pnpm boundaries`
  passed dependency, core-vocabulary and the core/module/cross-module/driver
  fixture checks. `pnpm test:unit` passed 239 tests in 32 files,
  `pnpm test:conformance` passed 41 tests in 6 files, `pnpm test:integration`
  passed 13 tests in 2 files and `pnpm test:scenario` passed its one scenario.
  `git diff --check` passed. No check was skipped.
- Follow-ups: The Research offline acceptance scenario (build-plan phase 5)
  through the ExecutionEngine is deliberately out of this task and is the
  natural next step; until it exists, only Narrative has an executable
  acceptance scenario. Fixtures live in `packages/module-research/test/` rather
  than the plan's proposed `fixtures/` directory, matching the ACME-0017
  precedent and the existing vitest and tsconfig wiring. ScenarioRunner, a live
  provider adapter and CLI composition remain separate approved work.
- Signature: Claude

## 2026-07-31 — Research offline acceptance scenario completed

- Date: 2026-07-31
- Author: Claude
- Task: ACME-0023
- Summary: Built the approved Research phase 5 acceptance scenario in
  `tests/scenario/research-phase-5.test.ts`. Three hand-written offline
  sources run through the same bounded ExecutionEngine, in-memory repository
  and replay path Narrative uses. The scenario proves the standing sequence
  the domain exists to produce: source A retains a deferred claim and cannot
  verify it despite 0.9 model confidence; independent source B promotes it to
  verified with an independent-source count of two; contradicting source C
  contests it, preserves both variants and leaves the earlier record
  `contested` rather than overwritten. A stale expected revision performs no
  model call, allocates no ID and writes nothing. Every committed execution
  replay-verifies offline with an unchanged operation digest. No
  `packages/core` or `@acme/module-research` source file changed, which is the
  point: the scenario is acceptance evidence, not an accommodation.
- Evidence: The scenario needed a harness that reproduces the engine read path
  — `loadContext`, then `MemoryEngine.retrieve` against the domain policy —
  because each step's contract input, and therefore its request hash, depends
  on everything the earlier steps committed. That harness is the honest way to
  keep the model mock's exact-request-hash matching rather than weakening it.
  Deterministic execution identity, request fingerprint, model request and
  response hashes, operation digest and state hash are pinned as goldens for
  source A.
- Verification: `pnpm docs:check` passed 57 Markdown files. `pnpm typecheck`,
  `pnpm lint`, `pnpm format:check` and `pnpm build` passed. `pnpm boundaries`
  passed dependency, core-vocabulary and the core/module/cross-module/driver
  fixture checks. `pnpm test:unit` passed 243 tests in 33 files,
  `pnpm test:conformance` passed 41 tests in 6 files, `pnpm test:integration`
  passed 13 tests in 2 files and `pnpm test:scenario` passed 5 tests in 2
  files. `git diff --check` passed. No check was skipped.
- Follow-ups: Both reference domains now have end-to-end acceptance evidence,
  so the First Proof Milestone's domain-neutrality claim is executable rather
  than argued. The scenario stays test-owned exactly as Narrative's does;
  ScenarioRunner and a general evaluation harness remain unimplemented, and
  neither scenario runs against the durable SQLite adapter — durability is
  proven separately by the ACME-0021 reopen test. A live provider adapter and
  a CLI composition root remain separate approved work.
- Signature: Claude

## 2026-07-31 — Governing documents synchronized after ACME-0023

- Date: 2026-07-31
- Author: Claude
- Task: ACME-0024
- Summary: Corrected every current-facing governing document that still
  described a repository without durable persistence or ResearchModule. A
  sweep found six stale locations, two more than the three the user had
  identified: `AGENTS.md` still said durable persistence and ResearchModule do
  not exist, `README.md` said no durable persistence adapter or Research
  reference module exists and omitted both packages from its repository map,
  `docs/PROJECT_BRIEF.md` still listed them as separate future deliverables,
  and the Domain Test UI prerequisites were described as unimplemented in
  `docs/CURRENT_STATUS.md`, `docs/FILESTRUCTURE.md` and the backlog proposal.
  `AGENTS.md` mattered most because it is the first file a new contributor
  reads and it was two tasks behind. The backlog prerequisite list is now split
  into satisfied and still-missing, so having prerequisites is not confused
  with having resolved the specification's own decision gates.
- Evidence: One verified gap was recorded rather than fixed.
  `retention: 'encrypted-payload'` performs no encryption; both adapters store
  the complete `NormalizedModelResponse` as supplied, and `protectedResponse`
  is a caller-supplied field nothing populates. Nothing delivered is wrong,
  because every retained payload so far is a test fixture. It matters now
  because `retention: 'hash-only'` is not a workaround: without a retained
  response `replayVerify()` reports `unavailable`, so confidentiality and
  replay are not simultaneously available. The gap is recorded in
  `docs/CURRENT_STATUS.md` and proposed for closure in
  `docs/backlog/encrypted-payload-retention.md`, so the live-provider ADR must
  confront it rather than discover it.
- Verification: The discovery sweep was repeated and returns only true
  statements about the live provider adapter, ScenarioRunner and the CLI.
  `pnpm docs:check` passed 60 Markdown files after archival. `pnpm format:check`,
  `pnpm lint`, `pnpm typecheck` and `pnpm build` passed. `pnpm boundaries`
  passed. `pnpm test:unit` passed 243 tests in 33 files,
  `pnpm test:conformance` passed 41 tests in 6 files, `pnpm test:integration`
  passed 13 tests in 2 files and `pnpm test:scenario` passed 5 tests in 2
  files. `git diff --check` passed. No file outside documentation changed. No
  check was skipped.
- Follow-ups: The agreed remaining Milestone 1 order is now recorded in
  `docs/PROJECT_BRIEF.md`: a live provider adapter with its own ADR, a thin
  CLI composition root, ScenarioRunner over the named `acme-scenario/1`
  format, then a budgeted live test. The provider ADR must decide the
  retention question above, and must define what produces the `ambiguous`
  model-call status that core and both adapters already handle but nothing
  currently emits.
- Signature: Claude

## 2026-07-31 — Live provider boundary and OpenAI Responses mapping

- Date: 2026-07-31
- Author: Claude
- Task: ACME-0025
- Summary: Added ADR-0014 and `@acme/adapter-model-openai`, the first
  implementation of `ModelGateway` against a real provider's wire format. The
  adapter targets the OpenAI Responses API only; Chat Completions is excluded
  outright rather than kept as a fallback, because choosing it for portability
  would mean testing ACME against the less expressive boundary. Portability is
  the port's job to prove. The adapter depends on a transport port that
  carries only an opaque request and result, so request mapping, response
  normalization and failure classification are all exercised offline against
  hand-written fixtures. No network transport ships in this task, which is why
  CI stays secret-free and why the later live task is small rather than a
  rewrite.
- Evidence: The unchanged `modelGatewayConformance()` suite now passes for both
  the scripted mock and a real provider mapping, so one contract covers both.
  The adapter is the first thing in the workspace to produce the `ambiguous`
  model-call status that core and both repository adapters have implemented
  since ACME-0018 but nothing exercised. Classification asks one question
  first: did a status line arrive. If it did, the outcome maps through a fixed
  table and is never ambiguous. If it did not, the call is ambiguous unless the
  transport can prove the request never left, because a call that ran and was
  billed must never be recorded as though it never happened. Content the
  adapter cannot honor is rejected rather than silently dropped: stop sequences
  and non-text parts both fail as `INVALID_REQUEST`.
- Verification: `pnpm docs:check` passed 62 Markdown files after archival.
  `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm build` passed.
  `pnpm boundaries` passed dependency, core-vocabulary and the
  core/module/cross-module/provider/driver fixture checks; the vocabulary guard
  now rejects provider names in `packages/core/src` and a new negative fixture
  proves provider wire shapes are unreachable from core. `pnpm test:unit`
  passed 281 tests in 35 files, `pnpm test:conformance` passed 46 tests in 7
  files, `pnpm test:integration` passed 13 tests in 2 files and
  `pnpm test:scenario` passed 5 tests in 2 files. `git diff --check` passed. No
  check was skipped. One defect was found by the shared suite and fixed in the
  adapter rather than in the suite: `AcmeError` freezes its data shallowly, so
  nested error details must arrive already deeply frozen.
- Follow-ups: The fixtures are hand-written from our understanding of the
  Responses wire format, not captured from a live call. They prove the adapter
  is internally consistent; they cannot prove the understanding is correct.
  Confirming or correcting them is part of the live-transport task's purpose,
  not an incidental risk. ADR-0014 also fixes that live executions use
  `hash-only` until encrypted retention exists, so those executions return
  `unavailable` on replay rather than `failed`, and that an ambiguous call is
  terminal and never automatically retried. Reconciling ambiguous calls
  against provider history needs its own decision.
- Signature: Claude

## 2026-07-31 — CLI composition root

- Date: 2026-07-31
- Author: Claude
- Task: ACME-0026
- Summary: Turned `@acme/cli` from a behavior-free skeleton into the
  composition root. It is now the only place in the workspace that selects a
  concrete repository adapter, and it exposes `execute`, `execution replay`,
  `execution inspect`, `state inspect` and `memory inspect` over both the
  in-memory and durable SQLite repositories. Versioned JSON goes to stdout,
  diagnostics to stderr, payloads are redacted unless `--show-payloads` is
  supplied, and exit codes separate success, a terminal outcome that did not
  commit or verify, and a usage error. This closes the gap
  `docs/CURRENT_STATUS.md` had recorded in its own words: nothing outside the
  test suite could select the durable adapter.
- Evidence: The load-bearing test executes a request against a SQLite file and
  then replays and inspects that same file through the CLI, each run opening
  and closing its own connection. Redaction is asserted as the default for the
  recorded request input, document values, state values and memory values, and
  `--show-payloads` is asserted to reveal them. Ten argument shapes are
  asserted to fail as usage errors rather than stack traces, including unknown
  commands, unknown flags, missing positionals and contradictory adapter
  flags. No file under `packages/` changed, which the unchanged package test
  counts confirm.
- Verification: `pnpm docs:check` passed 63 Markdown files after archival.
  `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm build` passed.
  `pnpm boundaries` passed. `pnpm test:unit` passed 299 tests in 36 files,
  `pnpm test:conformance` passed 46 tests in 7 files, `pnpm test:integration`
  passed 13 tests in 2 files and `pnpm test:scenario` passed 5 tests in 2
  files. `git diff --check` passed. No check was skipped. `vitest.config.ts`
  and `tsconfig.tests.json` were extended to include `apps/**/test`, which had
  never been needed before because no app had tests.
- Follow-ups: Commands that cannot work are absent rather than present and
  failing. There is no `scenario run` without a ScenarioRunner, no
  `execution resume` without resume behavior, and no provider gateway without
  a network transport, so `execute` drives the deterministic mock from a
  script file. The mock requires an exact `expectedRequestHash`, which a
  human cannot compute by hand; that is the mock's contract working as
  intended, and it is why the CLI passes the script file through unchanged
  and surfaces the mismatch on stderr.
- Signature: Claude

## 2026-07-31 — ScenarioRunner over acme-scenario/1

- Date: 2026-07-31
- Author: Claude
- Task: ACME-0027
- Summary: Implemented the ScenarioRunner the `AGENTS.md` guardrail has always
  named, over the `acme-scenario/1` format the specification already defined.
  It sequences `execute`, `assert`, `replay` and `assertDigest` steps against
  the existing bounded ExecutionEngine, resolves aliases, halts at the first
  failed assertion and emits a versioned `acme-scenario-report/1`. A scenario
  is data, not a program: there is no branching, retry, loop, include or way
  to run arbitrary code. `acme scenario run` exposes it from the CLI.
- Evidence: The Narrative Phase 5 acceptance scenario now exists in two
  independent expressions, hand-written TypeScript and a declarative file, and
  both reach operation digest
  `15f143ba7991e04065ad1ed6bc9f2df6942e05372d18f5d4469b2eba4ae5c94f` through
  the same engine. Both remain in the suite, because the agreement is only
  evidence while both exist. Fixture-path escape is rejected for `..`, nested
  traversal and absolute paths. A malformed document, an unknown step kind, a
  step naming two kinds and an unresolved alias each produce a structured
  failure rather than a stack trace.
- Verification: `pnpm docs:check` passed 66 Markdown files after archival.
  `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm build` passed.
  `pnpm boundaries` passed, and `@acme/testing` still depends on `@acme/core`
  alone. `pnpm test:unit` passed 313 tests in 37 files,
  `pnpm test:conformance` passed 46 tests in 7 files, `pnpm test:integration`
  passed 13 tests in 2 files and `pnpm test:scenario` passed 19 tests in 3
  files. `git diff --check` passed. No file under `packages/core`, the
  adapters or the modules changed. No check was skipped.
- Follow-ups: Two design points are worth carrying forward. First, memory
  record IDs are part of the operation-digest preimage, so a scenario that
  pins a digest must also pin its ID scheme; specification 18.1 names
  `ids: sequential` without defining what it emits, so the shape is defined in
  the runner and `idPrefix` and `idPadding` make it expressible. Second, the
  deterministic mock requires an exact `expectedRequestHash` while the
  specification's step shape carries none, so a scenario may pin the hash and
  otherwise the report records the observed hash and marks the call unpinned.
  The runner never computes a hash and then asserts it against itself.
- Signature: Claude

## 2026-08-01 — First live provider calls: a successful falsification

- Date: 2026-08-01
- Author: Claude
- Task: ACME-0028
- Summary: Built the `fetch` transport, the opt-in live gate, and made ACME's
  first two real provider calls. Neither reached a success response, and that
  is the useful outcome. Both were rejected at schema validation before token
  generation, so both were effectively free, and together they falsified an
  assumption the entire offline stack was built on.
- Evidence: Confirmed against real provider data. The transport completes a
  real HTTP round trip. ADR-0014's classification table held twice: HTTP 400
  mapped to `INVALID_REQUEST`, non-retryable, at stage `calling-model`, and
  neither call was ambiguous because a status line arrived, which is exactly
  the first question the ADR tells the adapter to ask. The engine terminated
  cleanly with a classified error both times. `OpenAiErrorBodySchema` extracted
  `providerMessage` correctly from a real error body. The request shape reached
  provider-side validation of `text.format.schema`, so model, instructions,
  input and the structured-output envelope were structurally accepted.
- Finding: No ACME prompt contract satisfies OpenAI's strict structured-output
  subset. Two independent rules are broken. `oneOf` is not permitted, which
  `narrative.observe-document` violates because `z.toJSONSchema` compiles a
  discriminated union to `oneOf`. Every key in `properties` must appear in
  `required`, which forbids optional fields and which both contracts violate,
  measured at four places in Narrative and one in Research. The root cause is
  narrower than either symptom: `buildResponsesBody` passes the canonical JSON
  Schema to the provider verbatim while translating every other request field.
  The adapter does not translate the one thing that most needs translating.
  Recorded in `docs/backlog/strict-structured-output-schema-subset.md`.
- Not established: the success path. `OpenAiResponseSchema`, the `hash-only`
  retention behavior and the `unavailable` replay verdict have never run
  against real provider data, because no call reached a `200`. Two Definition
  of Done conditions are therefore unmet and are stated as unmet rather than
  quietly checked off. They transfer to the schema-lowering task, which needs a
  live success response as its own acceptance criterion and will use the gate
  this task built.
- Verification: `pnpm docs:check` passed 68 Markdown files after archival.
  `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm build` passed.
  `pnpm boundaries` passed. `pnpm test:unit` passed 320 tests in 38 files,
  `pnpm test:conformance` passed 46 tests in 7 files, `pnpm test:integration`
  passed 13 tests in 2 files and `pnpm test:scenario` passed 19 tests in 3
  files. The default suite cannot reach `tests/live`, which is excluded in
  `vitest.config.ts` rather than merely uncalled, and the live gate refuses
  with a clear message when the opt-in is absent instead of skipping quietly.
  `git diff --check` passed. No credential appears in any committed file.
- Spend: two calls, both rejected before token generation, against a 30 SEK
  ceiling. Actual spend is effectively zero. Note that a currency ceiling is
  not machine-enforceable today, because the adapter never populates
  `estimatedCostMinor`; what bounded these calls was the Milestone 1 limit of
  one model call per execution and the account's own hard stop.
- Follow-ups: The charter was amended once, from `narrative.observe-document`
  to `research.observe-evidence`, on the assumption that avoiding `oneOf` would
  reach a success response. The second call disproved that assumption, which is
  worth recording: avoiding one rule of a subset does not mean satisfying the
  subset. The next task must prove nested `anyOf` support against the provider
  rather than assume it, for the same reason.
- Signature: Claude

## 2026-08-01 — Schema lowering and preflight (offline)

- Date: 2026-08-01
- Author: Grok
- Task: ACME-0029
- Summary: Activated ACME-0029 to `In Progress` and implemented deterministic
  schema lowering in `@acme/adapter-model-openai`. Canonical contracts stay
  domain truth; the adapter lowers into the provider strict subset and refuses
  locally when it cannot. `providerWireSchemaHash` is recorded on response
  metadata. No live call in this session.
- Implementation: Added `schema-lower.ts` with `lowerStrictStructuredOutputSchema`
  and `computeProviderWireSchemaHash`. `buildResponsesBody` returns
  `{ body, providerWireSchemaHash }` and always sends the lowered schema under
  `text.format.schema` with `strict: true`. Gateway metadata includes the hash.
  Discriminated `oneOf` (distinct const discriminators) becomes `anyOf`; plain
  unions and `$ref` raise `UNSUPPORTED_CAPABILITY` before transport.
- Verification (offline): `pnpm docs:check` (68 Markdown files),
  `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm boundaries`,
  `pnpm build` passed. Adapter unit suite 49 tests, openai conformance 5,
  `pnpm test:integration` 13, `pnpm test:scenario` 19. Determinism and
  no-network refusal proven by unit tests. Both reference-domain output schemas
  lower without refusal in a local probe (not committed). `git diff --check`
  not re-run after the last doc edit in this note — run before commit.
- Spend: none. Live probe deferred to an explicit checkpoint.
- Follow-ups: Prove nested `anyOf` (and the research-only required-nullable
  form) against the provider, then `pnpm test:live` for a success response,
  hash-only retention and `unavailable` replay. Update ADR-0014 limitation
  section once fixtures are confirmed or corrected. Archive ACME-0029 when Done.
- Signature: Grok

## 2026-08-01 — ACME-0029 complete: live success under schema lowering

- Date: 2026-08-01
- Author: Grok
- Task: ACME-0029
- Summary: Finished strict structured-output schema lowering. Canonical
  contracts stay domain truth; the OpenAI adapter lowers into the provider
  subset, refuses unlowerable constructs locally, and records
  `providerWireSchemaHash`. Live success reached for both reference domains.
- Live evidence:
  - `gpt-5.6-terra`: 400 on unsupported `temperature` after schema accepted
    (proves lowering passed provider schema validation).
  - `gpt-4.1-mini` + `research.observe-evidence` via `pnpm test:live`: 200,
    committed, `OpenAiResponseSchema` matched, hash-only, replay
    `unavailable`. ~538 total tokens.
  - `gpt-4.1-mini` + `narrative.observe-document` (nested anyOf on wire): 200,
    committed. ~674 total tokens. Wire had anyOf, no oneOf.
- Docs: ADR-0015 accepted; ADR-0014 limitations updated; SYSTEMDOC,
  CURRENT_STATUS, FILESTRUCTURE, backlog proposal marked resolved; task
  archived to `docs/finished/ACME-0029_strict-structured-output-schema-lowering.md`.
- Verification: `pnpm docs:check` 69 Markdown files; format, lint, typecheck,
  boundaries, build passed. Unit 331 tests / 39 files; conformance 46 / 7;
  integration 13 / 2; scenario 19 / 3. `git diff --check` passed. No credential
  in any committed file.
- Spend: two successful billed calls (~1212 total tokens reported) plus one
  free temperature rejection. No currency meter in-adapter.
- Follow-ups: empty `CURRENT_TASK` template awaits the next approved charter.
  Optional: profile capability for models that reject `temperature`.
- Signature: Grok

## 2026-08-01 — ACME-0030 draft: encrypted-payload retention decisions

- Date: 2026-08-01
- Author: Grok
- Task: ACME-0030 (Draft)
- Summary: Captured the four retention decisions as accepted ADR-0016 and a
  Draft task charter. No runtime code changed.
- Decisions: (1) inject PayloadEncryptor into repository adapters; core owns
  the port only; composition owns keys. (2) protectedResponse holds the
  envelope; cleartext response is not stored. (3) replayVerify works when the
  key is available, else unavailable. (4) build encryption now; do not rename
  the mode. First implementer may be a SymmetricKeyEncryptor with caller-supplied
  key material.
- Verification: documentation only; docs:check not re-run in this note if
  later edits follow — run before freeze.
- Follow-ups: Review and freeze ACME-0030 to Ready when approved, then
  implement. Open: package home for SymmetricKeyEncryptor; missing-key
  diagnostic code; whether encryptor is required at repository construction.
- Signature: Grok

## 2026-08-01 — ACME-0030 complete: encrypted-payload retention

- Date: 2026-08-01
- Author: Grok
- Task: ACME-0030
- Summary: Implemented ADR-0016. Core defines PayloadEncryptor and
  createAes256GcmPayloadEncryptor (key material injected, no env in core).
  Both repository adapters seal on write and reveal on loadReplayEvidence.
  Cleartext response is not stored under encrypted-payload.
- Open questions closed: pure AES helper in core; missing key uses details on
  REPLAY_MODEL_RESPONSE_UNAVAILABLE only; encryptor optional until policy needs
  it. CLI accepts override or ACME_PAYLOAD_KEY / ACME_PAYLOAD_KEY_ID.
- Verification: docs:check, format, lint, typecheck, boundaries, build.
  Unit 345 tests / 42 files; conformance 50 / 7; integration 13 / 2;
  scenario 19 / 3. Raw SQLite row asserts null response_payload and no cleartext
  marker; reopen without key leaves response absent.
- Note: session resumed after power loss mid-task; temperature:0 restored in
  contracts (user terra probe); live default remains gpt-4.1-mini for models
  that accept temperature.
- Signature: Grok

## 2026-08-01 — ACME-0031 documentation reality sync

- Date: 2026-08-01
- Author: Grok
- Task: ACME-0031
- Summary: Documentation-only hygiene after ACME-0029/0030 merges. Corrected
  current-facing claims that still denied the live adapter, live success path,
  schema lowering, encrypted retention, ScenarioRunner/CLI as Domain Test UI
  prerequisites, and stale unit-test counts. CLI usage strings now say the
  composition root has no live gateway yet, not that no transport exists.
- Files: CURRENT_STATUS, SYSTEMDOC, AGENTS, README, PROJECT_BRIEF phase line,
  FILESTRUCTURE planned section, domain-test-ui backlog + specification
  readiness table, backlog README status table, apps/cli args usage text.
- Verification: `pnpm docs:check` (72 Markdown files), `pnpm format:check`,
  `pnpm lint`, CLI unit suite 18 tests, `git diff --check`.
- Follow-ups: empty CURRENT_TASK; next product charter is an explicit choice
  (CLI live gateway, Domain Test UI phase 1 after gates, M2 residual, or
  temperature capability).
- Signature: Grok

## 2026-08-01 — ACME-0032 CLI live OpenAI gateway

- Date: 2026-08-01
- Author: Grok
- Task: ACME-0032
- Summary: Wired the OpenAI Responses gateway into `@acme/cli`. `execute`
  accepts either `--script` (mock) or `--gateway openai` (live fetch transport).
  Credentials from OPENAI_API_KEY only in the composition root; model from
  ACME_OPENAI_MODEL / ACME_LIVE_MODEL (default gpt-4.1-mini).
- Verification: unit 349 / 42 files; conformance 50; integration 13; scenario
  19; typecheck, lint, format, boundaries, build, docs:check. Offline CLI
  tests cover mutual exclusion, missing key, and openai path with injected
  transport (no network in default suite).
- Follow-ups: remaining gaps Domain Test UI decision gates, M2 outbox/fault
  injection, optional temperature capability. ScenarioRunner has no live step.
- Signature: Grok

## 2026-08-01 — ACME-0033 durable execution resume

- Date: 2026-08-01
- Author: Claude
- Task: ACME-0033
- Summary: Closed the Milestone 2 gap that made a crash after a successful
  model call unrecoverable. An accepted but non-terminal execution is now
  resumed by re-submitting the same request; it completes from the recorded
  model call without contacting the provider, or terminates with a classified
  error. ADR-0017 fixes the semantics.
- Context: the previous session ended at commit `75d63c3`
  (`checkpoint : m2 - verified 1/2`), an empty checkpoint commit with no
  journal entry. Reading the code showed what the half was: the engine
  answered a non-terminal existing execution with `PERSISTENCE_TRANSIENT` and
  the literal message that durable resume is not implemented.
- Decisions (ADR-0017, all settled at freeze): resume never calls the provider
  and either completes from evidence or terminates; a missing reservation is
  the one case that runs from the beginning, because reservation precedes
  dispatch and therefore proves nothing was sent; `reserved`/`in-flight` is
  terminal for the same reason ADR-0014 gives for `ambiguous`; resume re-reads
  the context so a moved revision conflicts instead of committing against a
  stale world; a resumed run records its own attempt number; the capability is
  a new `loadResumeState` rather than a widened `loadReplayEvidence`.
- Implementation: `ExecutionRepository.loadResumeState()` in core plus both
  adapters, revealing sealed payloads exactly as replay does; the resume plan
  and recorded-response path in `ExecutionEngine`; `RESUME_EVIDENCE_UNAVAILABLE`
  added to the error taxonomy; stage attempts now carry an attempt number.
- Verification: `pnpm docs:check` 76 Markdown files after archival; `format:check`, `lint`,
  `typecheck`, `boundaries` and `build` passed. `pnpm test:unit` 361 tests in
  42 files, `pnpm test:conformance` 54 in 7, `pnpm test:integration` 21 in 2,
  `pnpm test:scenario` 19 in 3. `git diff --check` passed. Both adapters run
  the extended conformance suite unchanged. The SQLite proof closes every
  connection, reopens the file, resumes, and reaches the same operation digest
  as an uninterrupted run of the same request, with one gateway invocation in
  total and no `call` ID allocated by the resumed engine.
- Not established: no live provider call was made, by charter. The `ambiguous`
  path is proven by forcing `ambiguous: true` at the repository boundary,
  because the engine still records `ambiguous: false` on every failure — no
  code in the workspace produces the status the adapters implement. That
  wiring is a separate concern and was left alone.
- Spend: none. Offline only.
- Follow-ups: fault injection at transaction boundaries and a concurrent
  two-writer CAS race remain the open Milestone 2 residuals, together with
  outbox draining. Executions stranded by an unobserved reservation or an
  unretained response are terminal and have no operator command to list or
  discharge them.
- Signature: Claude

## 2026-08-01 — ACME-0034 Milestone 2 durability and concurrency proofs

- Date: 2026-08-01
- Author: Claude
- Task: ACME-0034
- Summary: Closed the last two Milestone 2 acceptance conditions by
  observation. "A transaction crash leaves no partial state" and "two-writer
  CAS yields one commit" were previously assumptions; both are now tests. No
  runtime behavior changed.
- Fault seams: the shared conformance case injects an `IdGenerator` that fails
  once on the first event ID, after the document ID of the same commit has
  been handed out, so the fault lands with work already staged. The SQLite
  case wraps the driver in a proxy `Database` that fails one chosen statement
  once. Neither seam exists in shipped code; a durability claim proven through
  a production backdoor proves the backdoor.
- Evidence: the fault targets `INSERT INTO execution_commits`, which the
  adapter writes after documents, memory candidates, the state snapshot, the
  transition and the state-head upsert. After the fault, every connection is
  closed and the file reopened: no documents, memory records or candidates, no
  snapshot, transition, event, outbox entry or commit record survive, and
  `loadReplayEvidence` returns null. The recorded model call does survive,
  correctly, because it is written outside the commit. The reopened database
  then commits a different execution successfully.
- Two writers: the loser loads its context at revision 0, the winner commits
  revision 1 while the loser is mid-execution, and the loser's commit loses
  the compare-and-swap with `CONFLICT_STATE_REVISION`. The store holds one
  snapshot, one transition and one document. The race is created by
  interleaving inside the loser's gateway call, so it is deterministic rather
  than timing-dependent.
- Finding: a driver-level failure reaches the caller as non-retryable
  `INTERNAL`, because `errorData()` maps anything that is not an `AcmeError`
  to that fallback and neither adapter translates driver errors. The injected
  fault is synthetic, but `SQLITE_BUSY` is not, and the taxonomy already has
  `PERSISTENCE_TRANSIENT` for it. Out of this charter by its Out of Scope
  section; recorded in `docs/backlog/driver-error-classification.md` and
  pinned by an assertion so the current behavior is visible rather than
  implied.
- Verification: `pnpm docs:check` 78 Markdown files after archival; `format:check`, `lint`,
  `typecheck`, `boundaries` and `build` passed. `pnpm test:unit` 365 tests in
  43 files, `pnpm test:conformance` 56 in 7, `pnpm test:integration` 23 in 3,
  `pnpm test:scenario` 19 in 3. `git diff --check` passed. No live provider
  call; `tests/live` was not run.
- Spend: none. Offline only.
- Follow-ups: Milestone 2's only remaining work is the outbox, which is
  written atomically and never drained. Driver error classification is a
  backlog proposal.
- Signature: Claude

## 2026-08-01 — ACME-0035 outbox delivery boundary

- Date: 2026-08-01
- Author: Claude
- Task: ACME-0035
- Summary: Gave committed domain events a way out of the outbox and closed the
  last Milestone 2 work package. Events are leased, delivered through an
  injected dispatcher and settled as delivered, retryable or failed. ADR-0018
  fixes the contract.
- Decision that sized the task: v1 owns no background worker. A drain is a
  function a composition root calls, because a library that drains on its own
  has timing-dependent tests and failures nobody receives. Delivery is
  at-least-once, stated rather than implied: a crash between delivery and
  settlement re-delivers once the lease expires, and consumers deduplicate on
  `eventId`.
- Implementation: `leaseOutbox`, `markOutboxDelivered`, `markOutboxFailed` and
  `listOutbox` on the core port and both adapters; a domain-neutral
  `drainOutbox` coordinator over an `OutboxDispatcher` port returning a
  versioned `acme-outbox-drain-report/1`; `acme outbox inspect` and
  `acme outbox drain` in the composition root.
- Naming seam: the core vocabulary guard rejected the obvious word. `claim` is
  Research-domain vocabulary, so the API says lease — `leaseOutbox`,
  `OutboxLease`, `leaseExpiresAt` — while the persisted status value stays
  `claimed` from the original schema. Renaming stored data to satisfy a naming
  rule would have been the worse trade, so the seam is documented in ADR-0018
  instead of hidden. The guard was right to fire: a reader of `claimOutbox` in
  core cannot tell which kind of claim is meant.
- Verification: `pnpm docs:check` 80 Markdown files after archival; `format:check`, `lint`, `typecheck`,
  `boundaries` and `build` passed. `pnpm test:unit` 384 tests in 45 files,
  `pnpm test:conformance` 58 in 7, `pnpm test:integration` 29 in 4,
  `pnpm test:scenario` 19 in 3. `git diff --check` passed. No live provider
  call; `tests/live` was not run.
- Honest limits: neither reference module emits domain events yet, so the
  outbox is exercised by committed fixtures rather than by production traffic.
  The CLI dispatcher hands events to the operator through the report; no real
  transport exists. `failed` entries have no redrive path, and nothing alarms
  on a growing outbox.
- Spend: none. Offline only.
- Follow-ups: a redrive decision for `failed` entries, real transports as
  composition roots, whether a drain belongs in ScenarioRunner steps, and
  outbox-depth metrics. Milestone 2 is complete.
- Signature: Claude

## 2026-08-01 — ACME-0036 documentation reality sync after Milestone 2

- Date: 2026-08-01
- Author: Claude
- Task: ACME-0036
- Summary: Documentation-only sync after ACME-0033 through ACME-0035 merged.
  Those tasks each kept their own documents current, but the entry documents
  they did not touch still described a project one milestone behind.
- Corrected: the current-phase paragraphs in `AGENTS.md`, `README.md` and
  `docs/PROJECT_BRIEF.md` said Milestone 2 durability was partial; the brief's
  `Next Deliverable` still named the live half of Milestone 1 as outstanding,
  which shipped in ACME-0025 through ACME-0029; `docs/SYSTEMDOC.md` told a
  reader there is no resume behavior and listed a composition root without its
  `outbox inspect` and `outbox drain` commands; the Domain Test UI readiness
  table lacked the durability and outbox prerequisites.
- Found while auditing, and fixed: `docs/CURRENT_STATUS.md` still named
  `claimOutbox` and a "claim visibility timeout" from before ACME-0035's rename
  to lease vocabulary. The task that renamed the API missed its own status
  entry, which is exactly the drift this sync exists to catch.
- Also corrected: `better-sqlite3` was recorded as verified on Windows only,
  with the Linux CI matrix unobserved. CI runs the full suite including the
  SQLite adapter on `ubuntu-latest` and has passed on `main`, so the gap is
  now an observation rather than an unknown. The persistent-gaps list also had
  two entries that were status statements rather than gaps; those moved to the
  phase section, leaving the list to describe only what is missing.
- Deliberately unchanged: `docs/design/acme-design-and-development-spec.md`.
  It records the approved plan, and rewriting its milestone sections as they
  complete would erase the difference between what was planned and what
  happened. Archived tasks under `docs/finished/` are immutable history and
  were not touched either.
- Verification: `pnpm docs:check` 81 Markdown files after archival; `format:check`, `lint`,
  `typecheck` and `build` clean; `pnpm test` passed 384 unit, 58 conformance,
  29 integration and 19 scenario tests. `git diff --check` passed and the diff
  contains Markdown only. No live provider call.
- Spend: none.
- Follow-ups: none from this task. The open choices remain the Domain Test UI
  decision gates, outbox redrive and real transports, driver-error
  classification, and an evaluation harness.
- Signature: Claude

## 2026-08-01 — Remove resolved encrypted-payload backlog proposal

- Date: 2026-08-01
- Author: Grok
- Task: none (docs hygiene after ACME-0030)
- Summary: Deleted `docs/backlog/encrypted-payload-retention.md` after
  verifying the proposal was fully delivered by ACME-0030 / ADR-0016.
  Updated backlog README, FILESTRUCTURE, and ADR-0014 / ADR-0016 references
  so they point at the finished task and ADR instead of the removed file.
  Archived task prose that still names the old path was left as history
  (backtick paths, not links).
- Verification: `pnpm docs:check`.
- Follow-ups: residual KMS / live default to encrypted-payload remains in
  CURRENT_STATUS only.
- Signature: Grok

## 2026-08-01 — Remove resolved strict-structured-output backlog proposal

- Date: 2026-08-01
- Author: Grok
- Task: none (docs hygiene after ACME-0029; pairs with Domain Test UI rewrite)
- Summary: Deleted `docs/backlog/strict-structured-output-schema-subset.md`
  after verifying resolution by ACME-0029 / ADR-0015. Updated backlog README
  and FILESTRUCTURE. Domain Test UI backlog rewrite remains open.
- Verification: `pnpm docs:check`.
- Signature: Grok

## 2026-08-01 — ACME-0038 Domain Test UI specification and backlog rewrite

- Date: 2026-08-01
- Author: Grok
- Task: ACME-0038
- Summary: Docs-only rewrite of the Domain Test UI design specification and
  implementation backlog after Milestone 2. No application package and no
  runtime code. Also records completed removal of resolved backlog proposals
  for encrypted-payload (ACME-0030) and strict structured-output (ACME-0029).
- Design (`domain-test-ui-specification.md`): post-M2 readiness; module vs
  adapter workbenches; composition-first; surfaces S1–S10 retained with view
  contracts first; proposed freezes for all seven gates (local SPA + process,
  thin `acme-test-plan/1` with ADR at export, file/separate-SQLite interface
  storage, CLI stays CI entry, live UI late and gated, localhost only);
  build order reordered so phase 1 is read-model over fixtures, not plan
  compiler; concepts_sandbox HTML mock mapped as non-authority visual
  hypothesis.
- Backlog (`domain-test-ui-implementation.md`): activation slices matching the
  new phases; first code charter = accept gates + skeleton + view contracts.
- Status sync: CURRENT_STATUS, SYSTEMDOC, FILESTRUCTURE, design README,
  concepts_sandbox README, backlog README.
- Verification: `pnpm docs:check`; `git diff --check`. Runtime suites skipped
  (docs-only).
- Follow-ups: maintainer acceptance of proposed gate freezes; then a bounded
  implementation charter (phase 0/1 only). Do not start `apps/test-ui` from
  chat without that charter.
- Signature: Grok

## 2026-08-01 — ACME-0037 omit default temperature from reference contracts

- Date: 2026-08-01
- Author: Grok
- Task: ACME-0037
- Summary: Reference contracts no longer default-send `temperature`. Core and
  the OpenAI adapter already treated the field as optional; the blocker for
  models such as `gpt-5.6-terra` was Narrative and Research always emitting
  `temperature: 0`.
- Code: Removed `temperature: 0` from
  `narrative.observe-document` and `research.observe-evidence` `buildRequest`
  paths. Explicit temperature in adapter/mock/neutral fixtures remains to prove
  optional-field handling.
- Goldens re-pinned (request-hash only; contract refs/versions unchanged):
  unit request hashes for both modules; phase-5 scenario `modelRequestHash`
  pins for Narrative and Research. Other digests/fingerprints/state hashes
  were unchanged.
- Docs: CURRENT_STATUS residual updated; ADR-0014 / ADR-0015 residual wording
  corrected; live-test comments and README gap list adjusted. SYSTEMDOC had no
  stale claim.
- Verification: `pnpm typecheck`; `pnpm test` 384 unit, 58 conformance, 29
  integration, 19 scenario; `pnpm docs:check` 81 Markdown files; `format:check`,
  `lint`, `git diff --check` clean. Live provider call skipped by charter.
- Spend: none.
- Follow-ups: optional profile/capability gating only if a future contract
  *explicitly* sets temperature for a model that rejects it. Open product
  choices unchanged (Domain Test UI gates, outbox redrive, driver errors, eval
  harness).
- Signature: Grok

## 2026-08-01 — ACME-0039 Domain Test UI activation and phase-1 read model

- Date: 2026-08-01
- Author: Claude
- Task: ACME-0039
- Summary: Activated the Domain Test UI and delivered the first charter slice
  the design specification names: phase 0 (gate freeze and package boundary)
  and phase 1 (read model over recorded evidence). No workbench chrome, no
  plan compiler, no launcher, no catalog.
- Decision (ADR-0019): accepted all seven ACME-0038 gate freezes unchanged;
  fixed the app as a leaf; made phase-1 builders pure; introduced four
  versioned view contracts; made absence an explicit value; derived trust
  pipeline outcomes only from recorded evidence; kept replay in the engine's
  exact vocabulary.
- Deviation, stated rather than hidden: the specification's S7 lists a
  `forked` outcome "(or the engine's exact vocabulary)". `ReplayReport`
  produces `match | different | unavailable` only, so the view adds no fourth
  outcome. "No replay was run" is a missing section (`REPLAY_NOT_RUN`),
  distinct from the engine's own `unavailable` verdict.
- Code: new `apps/test-ui` (`@acme/test-ui`) with `view.ts`, `redaction.ts`
  and `read-model/{execution,memory,state,replay,shared}.ts`. Exports
  `acme-view-execution/1`, `acme-view-memory-decisions/1`,
  `acme-view-state/1` and `acme-view-replay/1`. Depends on `@acme/core` for
  types only; it has no runtime import of any package.
- Honesty rules encoded, not documented: every optional section is
  `available` or `unavailable` with a reason code, so unread evidence can
  never render as zero; a model payload absent under `retention: 'none'` or
  `'hash-only'` renders `not-retained` rather than empty (ADR-0016); content
  is redacted unless a build explicitly reveals it; `preparing-commit`
  failures report `reached` for memory, projection and state because the
  recorded error does not name which one failed.
- Boundaries: two new dependency-cruiser rules with one negative fixture each
  — `test-ui-imports-only-public-package-entry-points` and
  `nothing-imports-the-test-ui-app`. Both were confirmed to fail for exactly
  their own rule, not incidentally.
- Verification: `pnpm typecheck`; `pnpm lint`; `pnpm format:check`;
  `pnpm boundaries`; `pnpm test` — 421 unit (49 files, up from 384/45), 58
  conformance, 35 integration (up from 29), 19 scenario; `pnpm docs:check` 83
  Markdown files; `pnpm build`; `git diff --check` clean. No network call, no
  wall-clock read and no browser in any gate. Live provider gate untouched.
- Evidence beyond fixtures: `tests/integration/test-ui-read-model.test.ts`
  drives the real `ExecutionEngine` over the in-memory repository and the
  scripted mock gateway, then feeds the recorded evidence through all four
  views. It also proves the `hash-only` case end to end: the engine reports
  replay `unavailable` because no response was retained, which the view shows
  as the engine's verdict rather than as a missing section.
- Docs: ADR-0019 added and indexed; design specification restatused with
  phases 0–1 marked done and the S7 deviation resolved inline; backlog
  proposal restatused to partially resolved with the remaining phase table;
  `CURRENT_STATUS`, `SYSTEMDOC`, `FILESTRUCTURE`, `AGENTS.md`, root `README`
  and the design/backlog READMEs synchronized.
- Spend: none.
- Follow-ups: phase 2 (S1 catalog over registries, scenario discovery and
  adapter kit targets) as its own charter. Gate 3 still requires its own ADR
  when `acme-test-plan/1` is first exported. Nothing loads evidence into the
  read model yet; that composition process is phase 4. Finer trust-stage
  resolution requires the engine to record finer evidence, not the interface
  to infer it.
- Signature: Claude

## 2026-08-02 — ACME-0040 Domain Test UI catalog (phase 2)

- Date: 2026-08-02
- Author: Claude
- Task: ACME-0040
- Summary: Delivered phase 2 of the Domain Test UI build order: the S1
  catalog. It answers "what exists?" from the static registries plus a
  discovered scenario tree, and it enumerates without deciding.
- Code: `acme-view-catalog/1` and `buildCatalogView` in
  `apps/test-ui/src/read-model/catalog.ts`; pure reference-path rules in
  `src/catalog/paths.ts`; bounded Node discovery in `src/node-source.ts`,
  published on the separate `@acme/test-ui/node-source` entry point so the
  default surface keeps the ADR-0019 no-I/O property.
- Rendered: modules and contracts in registry order with task declaration
  order preserved, full contract fingerprints, contract-to-task cross-links,
  discovered scenarios and fixtures, and caller-declared adapter kit targets.
- Broken things stay visible and labelled rather than dropped: an invalid
  scenario keeps the validator's own message, a reference that escapes the
  configured root is refused, a reference with no file is missing, an
  unreferenced fixture is an orphan, an unrecognized kit is unknown, and a
  step naming an unregistered namespace or task is marked.
- The catalog owns no schema. Scenario validity comes from `parseScenario`,
  injected by the caller, because `@acme/testing` imports vitest at module
  scope from the same barrel and an application package should not pull a
  test framework. Without a validator the section is `unavailable`, which
  makes a competing schema structurally impossible rather than merely
  discouraged.
- Two absences recorded instead of faked. Core registers no evaluators, so the
  evaluator section is `unavailable` rather than an empty list that would read
  as "this system has no evaluators". Nothing registers adapter
  implementations either — the CLI composition root hard-codes them — so
  targets are declared by the caller and only the kit name is validated,
  against the kits `@acme/testing` actually exports (asserted by test).
- Discovery is bounded and refuses to follow symbolic links, which is what
  keeps the walk both cycle-free and inside the root. Depth and file bounds
  are reported as diagnostics; nothing truncates silently. A file that is not
  decodable YAML is a discovery diagnostic, not a scenario the validator
  judged.
- Not built: the optional unit/type health strip. It ingests an external
  report that nothing in this repository produces, so building it would have
  meant inventing the report. Recorded in the specification, not skipped
  quietly.
- Verification: `pnpm typecheck`; `pnpm lint`; `pnpm format:check`;
  `pnpm boundaries`; `pnpm test` — 446 unit (51 files, up from 421/49), 58
  conformance, 35 integration, 19 scenario; `pnpm docs:check` 83 Markdown
  files; `pnpm build`; `git diff --check` clean. No network call, no
  wall-clock read and no browser in any gate.
- Evidence beyond fixtures: `apps/test-ui/test/node-source.test.ts` discovers
  the repository's own `tests/scenario/files` tree and renders it as a
  catalog. Every reference in `narrative-phase-5.yaml` resolves and no fixture
  is an orphan, so the reference rules are proven against a real scenario
  rather than only against a constructed one.
- Docs: design specification restatused with phase 2 marked done and the two
  recorded absences added to the S1 section; backlog proposal, `CURRENT_STATUS`,
  `SYSTEMDOC`, `FILESTRUCTURE`, `AGENTS.md`, root `README` and the
  design/backlog READMEs synchronized.
- Spend: none.
- Follow-ups: phase 3 (`acme-test-plan/1` schema and compiler) as its own
  charter, with the gate-3 ADR required at first export. The catalog still
  has no composition root wiring it to a live workspace, and adapter targets
  stay caller-declared until something registers implementations.
- Signature: Claude

## 2026-08-02 — ACME-0041 `acme-test-plan/1` and its compiler (phase 3)

- Date: 2026-08-02
- Author: Claude
- Task: ACME-0041
- Summary: Delivered phase 3 of the Domain Test UI. ADR-0019 gate 3 required
  an ADR when the plan schema is first exported; ADR-0020 is it, and this task
  ships the schema and a pure compiler behind it.
- Decision (ADR-0020): the plan is authoring convenience and the compiled
  scenario is the reviewable unit; compilation is pure, total and
  byte-deterministic; there is exactly one policy validator and it is the
  engine's `resolveExecutionPolicy`; the compiler reads nothing; invalid plans
  cannot compile.
- Code: `apps/test-ui/src/plan/schema.ts` (`parseTestPlan`) and
  `apps/test-ui/src/plan/compile.ts` (`compileTestPlan`). A case expands into
  `execute → assert → replay → assertDigest`, aliases are the case id so
  cross-references cannot drift, and `requestKey` defaults to
  `<plan name>-<case id>`.
- Refusals, all before anything is emitted: unknown field, missing or
  malformed seed, a policy the engine rejects, empty case list, duplicate case
  id, duplicate request key, an invalid request hash, and any fixture
  reference that is absolute or escapes the scenario root. Path rules are the
  phase-2 ones, so the compiler and the catalog agree on "below the root".
- Two deviations from the specification sketch, recorded rather than hidden.
  A plan carries no `measurements` block: nothing enforces a threshold until
  S8 exists in phase 5, and a plan stating one would promise more than the
  system does. A plan names no model, because `acme-scenario/1` reads the
  `ModelSelection` from the mock-response fixture — which also means an
  `ExecutionRequest` cannot be materialized from a plan alone, so requests are
  emitted only when the caller supplies loaded fixtures.
- Two things the tests found rather than the design. `parseScenario` requires
  `expectedRequestHash` to be a lowercase SHA-256 digest, so the plan
  validator now enforces the same rule and the refusal names the plan field
  instead of surfacing at run time. And the default policy is
  `maxRepairCalls: 0` / `maxRevisionCalls: 0`, not `1` — the golden caught the
  wrong guess on its first run, which is the whole reason to pin bytes.
- Verification: `pnpm typecheck`; `pnpm lint`; `pnpm format:check`;
  `pnpm boundaries`; `pnpm test` — 466 unit (53 files, up from 446/51), 58
  conformance, 35 integration, 21 scenario (up from 19); `pnpm docs:check` 88
  Markdown files; `pnpm build`; `git diff --check` clean. No network call, no
  wall-clock read and no browser in any gate.
- Load-bearing evidence: `tests/scenario/test-ui-plan-compile.test.ts`
  compiles a plan equivalent to the Narrative Phase 5 scenario, writes the
  compiler's own bytes to a temporary workspace and runs them through the
  existing `acme scenario run` path. It reaches
  `15f143ba7991e04065ad1ed6bc9f2df6942e05372d18f5d4469b2eba4ae5c94f`, the
  operation digest the hand-written acceptance test pins. That is what makes
  "compiles into approved artifacts" a checked claim rather than an intention.
- Docs: ADR-0020 added and indexed; design specification restatused with phase
  3 marked done and the plan-configuration section rewritten from proposed
  intent to shipped schema; backlog proposal, `CURRENT_STATUS`, `SYSTEMDOC`,
  `FILESTRUCTURE`, `AGENTS.md`, root `README` and the design/backlog READMEs
  synchronized.
- Spend: none.
- Follow-ups: phase 4 (offline authoring, launch and history) as its own
  charter. Nothing wires the compiler up yet — a compiled plan runs today only
  because a test writes it to disk and calls the CLI. `measurements` returns
  as an optional field when S8 can enforce it, with no version bump needed.
- Signature: Claude

## 2026-08-02 — ACME-0042 Domain Test UI launch and history (phase 4)

- Date: 2026-08-02
- Author: Claude
- Task: ACME-0042
- Summary: Delivered phase 4. The Domain Test UI stops being a library and
  becomes something that can be used: a plan is previewed, launched through
  the existing ScenarioRunner, recorded, found again and inspected — offline,
  without a browser and without the CLI.
- Decision (ADR-0021): the workspace is a directory of files the interface
  owns; the history index is derived from the records rather than maintained
  beside them; a run identifier is validated as a file name before any path is
  built; launch is synchronous and the console says so; the interface writes
  no ledger state; composition lives on a separate entry point.
- Code: `acme-view-plan/1` (S2) and `acme-view-runs/1` (S3) in the pure
  surface; `run-record.ts` with `acme-run-record/1`; and, behind the new
  `@acme/test-ui/local` entry point, a file workspace, the app's own
  composition and `launchPlan`.
- Two honest absences rather than filled-in fields. S3's live-progress section
  is `unavailable`: launch is a function call, nothing runs in the background,
  and a queue of depth one with progress pinned at complete would describe a
  system that does not exist. And the S2 designer reports an invalid plan
  instead of throwing, because a designer that crashes on a typo cannot show
  the author where the typo is.
- The workspace shares nothing with the ledger. A test asserts the root
  contains exactly `runs/` and one record file; evidence stays in whichever
  repository the composition selected. Deleting the workspace loses run
  history and no canonical fact.
- Found while building: `runScenario` builds the scripted gateway itself from
  each step's mock fixture and hands it to `composition.engine()`. The launch
  path therefore needs no gateway at all, and `@acme/adapter-model-mock` was
  removed from the package before it was ever used.
- `launchPlan` returns the composition it built rather than hiding it, so the
  caller can read evidence back through the repository port and close it.
  Hiding it would have forced either a second composition for inspection or an
  evidence copy the interface does not own.
- Verification: `pnpm typecheck`; `pnpm lint`; `pnpm format:check`;
  `pnpm boundaries`; `pnpm test` — 481 unit (55 files, up from 466/53), 58
  conformance, 39 integration (up from 35), 21 scenario; `pnpm docs:check`;
  `pnpm build`; `git diff --check` clean. No network call, no wall-clock read
  and no browser in any gate; the run record's timestamps come from an
  injected clock.
- Phase exit, executed: `tests/integration/test-ui-launch.test.ts` previews a
  plan through S2, launches it, reads it back through S3 history, follows the
  recorded execution id into the S4 inspector and finds a committed execution
  with every trust stage passed. It also proves a failed run is recorded
  rather than discarded, and that an unsafe run identifier is refused.
- Docs: ADR-0021 added and indexed; design specification restatused with phase
  4 marked done and both deviations named; backlog proposal, `CURRENT_STATUS`,
  `SYSTEMDOC`, `FILESTRUCTURE`, `AGENTS.md`, root `README` and the
  design/backlog READMEs synchronized.
- Spend: none.
- Follow-ups: phase 5 (measurement and fixture review) as its own charter.
  Worth stating plainly: there is still no user interface. Every surface is a
  JSON contract and a function call, so a person uses this today only by
  writing TypeScript. A rendering surface is not chartered, and the
  specification's gate 2 (local SPA) remains unbuilt.
- Signature: Claude
