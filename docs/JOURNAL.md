# Journal

Add one dated, signed entry for every meaningful work session or handoff.

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
