# ACME Gap Resolution Plan

Status: Canonical planning artifact (ACME-0056)  
Last updated: 2026-08-09
Authority: Inventories residual work from `docs/CURRENT_STATUS.md`.  
Does **not** replace ADRs, the project brief or the design specification.  
Does **not** authorize implementation; each work package requires an
explicitly activated ACME task with its own frozen charter.

## 1. Purpose

Milestones 1 and 2, the Domain Test UI (S1–S10), and the post-execution
quality-evaluation foundation are delivered. Residual items remain listed
under **Persistent Gaps** in `docs/CURRENT_STATUS.md`, but they are not
ordered, not dependency-mapped and not cut into activatable charters.

This document:

1. Assigns a stable ID to every persistent gap.
2. Groups gaps into work packages with ordered steps and hard boundaries.
3. Records ADR and architecture constraints that forbid naive fixes.
4. Proposes a recommended activation order for future tasks.

**Rule:** implementing a package starts only after a new `ACME-NNNN` task is
approved with Goal, deliverable, scope and Definition of Done of its own.
This plan must not be treated as a blank check to absorb adjacent work.

### Live provider verification policy

Live provider calls are **not** globally out of scope for implementation
tasks. When a package’s purpose is a live path (notably **WP-L**, and
optionally **WP-P** fixture capture or **Q4** live judge), a **bounded live
run through the real OpenAI adapter** is an expected verification gate of
that task—not an optional extra “if the charter allows.”

Still required for every live verification:

- explicit opt-in (same pattern as existing `pnpm test:live` / env gates)
- named model, budget and retention class in the task charter
- credentials only from the environment; never committed
- default CI and default `pnpm test` remain mock-only / offline
- offline proof (injected transport or mock) still lands first so the path is
  deterministic without a network

Packages that are not about a live path (WP-D, WP-O, WP-E, most of WP-Q/T)
keep **no live provider** as the default verification style.

## 2. Gap inventory

Source: `docs/CURRENT_STATUS.md` → Persistent Gaps (as of 2026-08-06).
Duplicate bullets are collapsed; observational bullets are retained with an
explicit disposition.

| ID | Gap (summary) | Theme | Risk if ignored | Disposition |
|----|---------------|-------|-----------------|-------------|
| G01 | ScenarioRunner has no live provider step; multi-step scenario files cannot reach a live model | Live multi-step | Cannot accept multi-step live offline→live parity | **Closed** ACME-0064 |
| G02 | ScenarioRunner remains mock-only; S10 live is single-execute only (same root as G01) | Live multi-step | Duplicate wording of G01 | **Collapse into G01** / closed with G01 |
| G03 | Nothing drains the outbox automatically; no growth alarm (ADR-0018) | Outbox ops | Pending entries accumulate unnoticed | **Partial:** no library auto-drain; **alarm done** ACME-0060; host drain remains external |
| G04 | Outbox residuals: no redrive for `failed`, no real transport beyond report dispatcher, no domain events from reference modules | Outbox ops | Delivery path unproven under real traffic | **Solve** via WP-O (sliced) |
| G05 | Driver errors surface as non-retryable `INTERNAL` (`SQLITE_BUSY` indistinguishable) | Durability / errors | Wrong retry policy under contention | **Closed** ACME-0057 (WP-D / D1) |
| G06 | Stranded executions: no operator list/discharge for terminal resume refusals | Operator tooling | Human process is manual and invisible | **Closed** ACME-0058 (WP-D / D2) |
| G07 | Domain Test UI workbench phases 0–6 / S1–S10 delivered; CI still CLI/`pnpm`, not browser | Test UI status | Observational, not a defect | **Accept** as intentional; optional browser CI later (WP-T residual) |
| G08 | `launchPlan` is synchronous; no queue, worker or cancellation; S3 live-progress stays `unavailable` (ADR-0021) | Test UI async | Long runs block caller | **Closed** ACME-0069 / ADR-0027 (sync `launchPlan` kept; workbench uses `enqueuePlan`) |
| G09 | Plans cannot pin a model; `ExecutionRequest` cannot be materialized from a plan alone (ADR-0020) | Plans / live | Blocks plan-driven live multi-step | **Closed** ACME-0063 |
| G10 | `measurements` not in `acme-test-plan/1`; thresholds only at measurement time | Plans / metrics | Plan cannot carry SLO thresholds | **Solve** via WP-T (separate charter from G09) |
| G11 | Adapter targets are declared, not discovered; undeclared adapters invisible in catalog | Catalog / composition | Catalog incomplete unless composition root lists targets | **Solve** via WP-T or **accept** static declaration as intentional |
| G12 | Trust pipeline: `preparing-commit` failure marks all substages `reached` | Evidence granularity | UI cannot show which substage failed | **Solve** via WP-E (engine evidence, not UI guess) |
| G13 | Model parameter capability residual (explicit `temperature` on models that reject it) | Provider capability | Future contracts may set unsupported params | **Defer / optional** WP-P |
| G14 | Ambiguous call reconciliation against provider history not implemented (ADR-0014: terminal) | Provider recovery | Ambiguous calls stay dead without human/provider lookup | **Defer** until product requires; WP-P if activated |
| G15 | Privacy deletion and full key lifecycle (KMS/rotation) deferred; live gate defaults `hash-only` until encryptor wiring is normal | Privacy / keys | Not production-hardened for deletion/rotation | **Defer** WP-K until operational need |
| G16 | Offline success-path Responses fixtures are simplified samples, not byte-identical live captures | Fixtures | Drift risk vs real provider bodies | **Optional** WP-P hygiene |
| G17 | Package boundary enforcement covers current packages only; future adapters must extend rules | Tooling | New adapters could violate dependency direction unnoticed | **Process:** every new adapter task extends rules (WP-X) |
| G18 | `better-sqlite3` prebuild observed on Windows + `ubuntu-latest` only | Platform | Other platforms unproven | **Accept / observe** (WP-X note); no multi-OS matrix required yet |
| G19 | Quality evaluation is memory-only; no SQLite migration, durable adapter, CLI, Test UI or live AI judge | Evaluation durability | Quality results lost across process restarts | **Closed** ACME-0065–0068 (WP-Q) |

## 3. Constraints that shape solutions

These are not optional preferences; work packages must respect them or open
an explicit ADR amendment task first.

| Constraint | Source | Implication |
|------------|--------|-------------|
| No library-owned background drain | ADR-0018 | G03 must not add a timer inside `@acme/core` or adapters. Host process or CLI loop may call `drainOutbox`. An **alarm** (inspect + threshold diagnostic) is allowed. |
| Outbox is at-least-once, lease/settle | ADR-0018 | Redrive (G04) extends settlement policy; it does not replace the lease model. |
| ScenarioRunner has no branching/retry/loop | ACME-0027 / design | Live multi-step (G01) is still serial steps; not a workflow engine. |
| S10 live is single-execute by decision | ADR-0023 | Multi-step live is ScenarioRunner territory, not an S10 expansion by stealth. |
| `launchPlan` is synchronous by decision | ADR-0021 (amended by ADR-0027) | G08 required an ADR before async/queue work. ADR-0027 supplied it: `enqueuePlan` is a new API beside the unchanged synchronous `launchPlan`. |
| Plans have no model field by design today | ADR-0020 | G09 is a schema/compiler change with golden updates. |
| Ambiguous model calls are terminal | ADR-0014 | G14 is optional product work, not a bug fix of current ADR. |
| Payload encryption exists; full KMS/deletion deferred | ADR-0016 | G15 is lifecycle, not “add encryption again”. |
| Core stays domain-neutral | AGENTS.md / brief | Domain events (G04) are module-emitted; core only transports outbox records. |
| Evaluation never mutates execution evidence | ADR-0025 | WP-Q durable store is a separate persistence surface. |
| Static composition is default | ADR-0002 | G11 discovery is optional; declaration-first remains valid. |

## 4. Work packages

Each package is a **proposal** for one or more future ACME tasks. Steps are
implementation guidance for those future charters, not work under ACME-0056.

### WP-D — Durability operator and error clarity

**Closes:** G05, G06  
**Priority:** High (small surface, improves every SQLite path)  
**Dependencies:** none  
**ADR:** none required for G05 if the backlog proposal holds (generic public
classes, adapter-owned mapping). G06 may need a thin CLI contract only.

#### Package purpose

Make persistence failures classifiable for retry, and make terminal
“stranded” executions visible and dischargeable by an operator.

#### Suggested task slices

1. **D1 — Driver error classification** — **done ACME-0057**
2. **D2 — Stranded execution operator commands** — **done ACME-0058**

#### D1 steps (driver errors) — delivered ACME-0057

1. Map recognized `better-sqlite3` / SQLite codes inside `@acme/adapter-sqlite`
   before they leave the adapter:
   - busy/locked → `PERSISTENCE_TRANSIENT`, `retryable: true`
   - corruption / constraint (as decided) → non-retryable persistence class
   - unknown → keep safe fallback (do not invent codes)
2. Ensure public contracts stay free of driver vocabulary.
3. Conformance: no raw driver error escapes any repository adapter.
4. Unit: provoke real `SQLITE_BUSY` (e.g. `busy_timeout = 0`) and assert
   classification.
5. Update ACME-0034-style expectations if they asserted the old `INTERNAL`
   fallback for injected driver faults.
6. Docs: close or archive the backlog proposal; note residual in CURRENT_STATUS.

**Out of D1:** caller-side automatic retry loops; changing commit semantics;
in-memory adapter inventing fake driver codes.

#### D2 steps (stranded executions)

1. Define operator-facing inventory of terminal non-success executions that
   need human decision (e.g. `RESUME_EVIDENCE_UNAVAILABLE`, unobserved
   reservation / `MODEL_UNAVAILABLE`, recorded `ambiguous` / `failed` where
   resume re-raises).
2. Add CLI inspect list (and optional single-id detail) over the durable
   repository only; no silent resume.
3. Add explicit discharge command that records an operator decision without
   inventing model outcomes (audit fields: who, why, when).
4. Refuse discharge that would rewrite committed canonical state or erase
   ledger evidence.
5. Tests: fixture ledger with stranded rows; list and discharge are
   deterministic and redaction-safe.

**Out of D2:** automatic provider reconciliation (that is G14); multi-tenant
authn for operators; Test UI surface (optional later).

#### Verification style

Unit + repository conformance + CLI integration; no live provider.

---

### WP-O — Outbox operationalization

**Closes:** G03 (alarm + host guidance), G04  
**Priority:** High for redrive/transport proof; medium for domain-event emission  
**Dependencies:** WP-D helpful but not hard-required  
**ADR:** stay inside ADR-0018 unless auto-worker is proposed (would need
amendment or a host-only design doc, not core)

#### Package purpose

Make outbox delivery operable under real traffic: redrive dead letters,
dispatch somewhere real, optionally emit reference-domain events, and alarm
when the queue grows—without putting a daemon inside the library.

#### Suggested task slices

1. **O1 — Failed-entry redrive path** — **done ACME-0059**
2. **O2 — Real `OutboxDispatcher` transport (bounded)** — **done ACME-0061**
   (file sink; report remains default)
3. **O3 — Reference module domain-event emission (minimal)** — **done ACME-0062**
   (Narrative only; Research optional later)
4. **O4 — Growth alarm + host drain runbook** — **alarm done ACME-0060**

#### O1 steps (redrive)

1. Specify redrive semantics: which `failed` rows become `pending` again,
   attempt counters, and audit of redrive reason.
2. Repository methods (both adapters) + conformance cases.
3. CLI: `acme outbox redrive` (id or selector), bounded batch.
4. Never redrive `delivered`; never delete evidence.

**Out of O1:** infinite auto-retry; changing at-least-once to exactly-once.

#### O2 steps (transport)

1. Choose one bounded transport behind `OutboxDispatcher` (e.g. file/HTTP
   webhook stub or structured log sink)—not a product bus import.
2. Composition root wiring; keep report dispatcher for tests.
3. Prove lease → deliver → settle with the real dispatcher offline
   (injected transport), then optional opt-in integration.

**Out of O2:** cloud queue product selection; multi-tenant routing.

#### O3 steps (domain events)

1. Emit the smallest useful domain event from **one** reference module on a
   committed path (document which task/transition).
2. Keep core free of domain vocabulary; event types live in the module.
3. Scenario or integration proves outbox row + drain with O2 dispatcher.

**Out of O3:** full event catalogs for both domains; external subscribers.

#### O4 steps (alarm + host drain)

1. `acme outbox inspect` (or extend) reports counts by status and age.
2. Threshold diagnostic / non-zero exit when pending/failed exceed bounds
   (composition-root policy, not core hard-coding).
3. Document recommended host patterns: cron/`systemd`/CI step calling
   `acme outbox drain`—**not** a library timer (ADR-0018).

**Out of O4:** in-process interval loop inside packages; distributed locking
cluster.

#### Verification style

Unit, conformance, CLI integration; optional opt-in external webhook only if
charter allows.

---

### WP-L — Live multi-step scenarios and plan model binding

**Closes:** G01, G02 (alias), G09  
**Priority:** High for product completeness of “scenario = truth”  
**Dependencies:** existing live gateway (`--gateway openai`), ADR-0014/0023  
**ADR:** G09 needs ADR-0020 amendment or additive plan version; G01 may need
ScenarioRunner charter notes (still no branching)

#### Package purpose

Let a multi-step scenario (and eventually a compiled plan) drive the real
engine with a live model under explicit opt-in, budget and retention rules—
without turning ScenarioRunner into a workflow language.

#### Suggested task slices

1. **L1 — Plan/model selection binding** (G09) — **done ACME-0063**
2. **L2 — ScenarioRunner live gateway step / composition** (G01) — **done ACME-0064**

#### L1 steps (model pin)

1. Decide representation: field on `acme-test-plan/1` vs new plan version vs
   scenario-level selection override that does not require mock fixtures.
2. Validator + compiler produce enough data to materialize `ExecutionRequest`
   model selection without a mock-response fixture.
3. Golden canonical JSON updates; refuse ambiguous selection.
4. Offline path: plan still runs against mock when scripted selection is
   present; live path uses pinned selection.

**Out of L1:** embedding full `measurements` (G10); async launch (G08). Live
calls are not required for L1 alone if L2 carries the live proof, but L1 must
not block live materialization of `ExecutionRequest`.

#### L2 steps (live multi-step)

1. Extend ScenarioRunner (or composition around it) so a scenario document
   can select a live gateway under the same opt-in discipline as CLI/test-ui
   (`ACME_*` gates, credentials in env, budget).
2. Keep step kinds serial: `execute` / `assert` / `replay` / digests /
   evaluation; no loops.
3. Default and CI remain mock-only; live is opt-in and excluded from default
   vitest like existing `test:live`.
4. Prove one multi-step scenario offline with injected transport (required).
5. Prove one bounded multi-step live success path for a reference domain
   through the real OpenAI adapter (required for L2 DoD—not optional). Name
   model, max calls/budget and retention in the activated task charter.
6. Document that S10 remains single-execute (ADR-0023); multi-step live is
   this path, not S10 expansion.

**Out of L2:** background workers; cancellation framework (G08); automatic
retry of ambiguous calls (G14); unbounded or CI-default live spend; shipping
credentials or live traffic in default gates.

#### Verification style

- Offline: scenario gates with mock / injected transport (always).
- Live: separate opt-in gate exercising the real adapter for at least one
  multi-step reference scenario (required for L2).
- No credentials in fixtures or repository files.

---

### WP-Q — Durable quality evaluation

**Closes:** G19 (durable store + surfaces; live judge separate)  
**Priority:** Medium–high if quality results must survive process restart  
**Dependencies:** ADR-0025 contracts; repository patterns from ADR-0013  
**ADR:** likely new ADR for durable quality store schema and retention

#### Package purpose

Persist `acme-quality-evaluation/1` results durably with the same append-only
idempotent semantics as the in-memory adapter, then expose read paths.

#### Suggested task slices

1. **Q1 — SQLite migration + durable adapter + conformance** — **done ACME-0065**
2. **Q2 — CLI inspect/list (and optional scenario wiring over durable store)**
   — **done ACME-0066**
3. **Q3 — Test UI read surface (optional)** — **done ACME-0067** (pure S11 view)
4. **Q4 — Live / general AI judge** — **done ACME-0068** (`live-model` outside
   harness; offline injected transport + opt-in live)

#### Q1 steps

1. Migration for quality evaluations; foreign keys only where ADR allows
   (must not couple to rewriting execution evidence).
2. Durable adapter implements the same port as in-memory; pass conformance.
3. Composition root can select memory vs SQLite quality store.

#### Q2–Q3 steps

1. CLI commands for list/inspect by evaluation id / execution id.
2. Optional Test UI view over durable rows (redaction rules from ADR-0019).

#### Q4 steps (only if explicitly approved)

1. Live judge behind the same untrusted-candidate discipline as model calls.
2. Recorded-external path remains the offline default.
3. Strict budget, opt-in gate, no default CI live judge.
4. When Q4 is activated, a bounded live judge success (and at least one
   refused/failed classification path offline) is in scope for DoD—not a
   follow-up.

**Out of WP-Q:** mutating ledger evidence; collapsing assertions/metrics into
quality scores. Q1–Q3 remain offline-only.

#### Verification style

Conformance + unit for Q1–Q3. Q4: offline recorded-external plus required
opt-in live adapter gate with named budget.

---

### WP-T — Domain Test UI residual product gaps

**Closes:** G08, G10, optionally G11; notes G07  
**Priority:** Medium (product ergonomics; larger design surface for G08)  
**Dependencies:** L1 if plan-embedded live progress needs model pin  
**ADR:** G08 requires ADR-0021 amendment or a parallel API; G10 amends
ADR-0020 / ADR-0022 relationship

#### Package purpose

Close plan/workbench product residuals that are still intentional limits,
without rewriting the leaf boundary of `apps/test-ui`.

#### Suggested task slices

1. **T1 — Async launch / progress / cancellation design then implement** —
   **done ACME-0069 / ADR-0027** (synchronous `launchPlan` kept; workbench uses
   `enqueuePlan` + JobRunner)
2. **T2 — Optional `measurements` block in plan format** — open
3. **T3 — Adapter catalog discovery vs declaration policy** — open
4. **T4 — (Optional) browser CI smoke** — only if G07 is reclassified as desired

#### T1 steps

1. ADR draft: job record, progress events, cancellation token, who owns the
   worker (workbench process vs external). Preserve pure default entry.
2. Implement behind the accepted ADR; keep synchronous `launchPlan` or
   deprecate with compatibility note.
3. S3 live-progress section becomes available when a job is running.
4. Tests: cancel mid-run does not corrupt ledger; history remains complete.

**Out of T1:** distributed multi-node queue; browser websockets productization
beyond loopback needs.

#### T2 steps

1. Schema: optional `measurements` on plan with thresholds/baselines refs.
2. Compiler validation; S8 can read plan-supplied thresholds when present.
3. Plans without the block keep current behavior.

**Out of T2:** changing measurement math from ADR-0022.

#### T3 steps

1. Decide: remain declaration-only (document as permanent) **or** add a
   bounded discovery of known kit names from composition metadata.
2. If discovery: still no dynamic `import()` plugin loading unless a future
   ADR overturns static composition default.
3. Catalog labels undeclared-but-present vs declared targets honestly.

#### T4 steps (optional)

1. Minimal Playwright (or similar) smoke against loopback workbench in CI
   without live credentials.
2. Keep CLI/`pnpm` as authority for engine correctness.

#### Verification style

Package unit tests + workbench integration; no live in default CI.

---

### WP-E — Engine evidence granularity

**Closes:** G12  
**Priority:** Medium (improves diagnosis; not a correctness bug of commit)  
**Dependencies:** ExecutionEngine commit pipeline knowledge  
**ADR:** optional small amendment if stage vocabulary is public contract

#### Package purpose

Record which `preparing-commit` substage failed so trust views report truth
instead of `reached` for all three.

#### Steps

1. Identify substages (memory apply, projection, state prepare/commit prep).
2. On failure, attach a stable stage code to the recorded error / attempt
   evidence without domain vocabulary.
3. Trust pipeline builders map the code; UI does not infer.
4. Fixtures and tests for each substage failure path.

**Out of WP-E:** changing reducer/invariant semantics; UI-side guessing.

#### Verification style

Unit + read-model tests; scenario optional.

---

### WP-P — Provider residual hardening (optional)

**Closes:** G13, G14, G16  
**Priority:** Low–medium; activate only when a concrete pain appears  
**Dependencies:** ADR-0014, ADR-0015  
**ADR:** G14 reconciliation would need a careful ADR (status transitions)

#### P1 — Capability gating (G13)

1. Optional model profile/capability flags (e.g. `supportsTemperature`).
2. Refuse or strip unsupported params **before** dispatch when a contract
   explicitly sets them for a model that rejects them.
3. Keep “omit by default” behavior from ACME-0037.

#### P2 — Ambiguous reconciliation (G14)

1. Design only after product need: lookup by provider request identity,
   classification of found/not-found, and whether any status may leave
   `ambiguous`.
2. Default remains terminal and non-retried until ADR changes.

#### P3 — Byte-identical fixtures (G16)

1. Capture live success bodies under opt-in through the real adapter; store
   redacted fixtures (live capture is in scope for this slice).
2. Tighten schemas only where unknown-field tolerance hides real breakage.
3. Keep CI offline; fixtures must run without network after capture.

**Out of WP-P:** new provider SDKs; multi-provider abstraction expansion.

---

### WP-K — Privacy deletion and key lifecycle (deferred)

**Closes:** G15  
**Priority:** Deferred until operational deployment needs it  
**Dependencies:** ADR-0016 encryptor already in place  
**ADR:** required for deletion semantics and key rotation

#### Steps (when activated)

1. Define deletion vs crypto-shredding vs retain-hash policies per retention
   class.
2. Key hierarchy, rotation, dual-key decrypt window.
3. Composition-root normal path: live gate may default toward
   `encrypted-payload` only when key supply is routine and tested.
4. Audit CLI for delete/shred with explicit confirmation.

**Out of WP-K:** pretending encryption-at-rest alone is a full privacy program.

---

### WP-X — Platform and boundary hygiene (process)

**Closes:** G17, G18 (observational)  
**Priority:** Continuous process, not a single feature task  
**Dependencies:** none

#### Rules

1. **Every new adapter package task** must extend
   `tooling/boundaries` rules and add negative fixtures before merge.
2. **New OS support** for `better-sqlite3` is proven by running the full
   suite on that OS, not by claim. Document observed platforms in
   CURRENT_STATUS only after observation.
3. No standalone “fix all platforms” task without a named OS and CI runner.

## 5. Dependency graph (simplified)

```text
WP-D (errors + stranded ops)
  └─► helpful before heavy SQLite ops in WP-O / WP-Q

WP-O (outbox redrive → transport → events → alarm)
  └─► independent of live scenarios

WP-L: L1 (plan model) ──► L2 (live multi-step)
  └─► independent of WP-O

WP-Q (durable quality)
  └─► independent; optional after D1 if sharing SQLite practices

WP-E (evidence stages)
  └─► independent; pairs well with Test UI trust views

WP-T: T1 needs ADR-0021 work first
      T2 independent schema
      T3 policy choice
  └─► T1 benefits from L1/L2 if progress is live multi-step

WP-P, WP-K, WP-X
  └─► on demand / continuous
```

## 6. Recommended activation order

Activate **one** implementation task at a time unless a parent/child split is
required by `docs/TASK_WORKFLOW.md`.

| Order | Slice | Closes | Why this order |
|------:|-------|--------|----------------|
| 1 | D1 Driver error classification | G05 | **Done ACME-0057** |
| 2 | D2 Stranded execution ops | G06 | **Done ACME-0058** |
| 3 | O1 Outbox redrive | G04 (part) | **Done ACME-0059** |
| 4 | O4 Growth alarm + host runbook | G03 | **Alarm done ACME-0060** |
| 5 | O2 Real dispatcher transport | G04 (part) | **Done ACME-0061** (file sink) |
| 6 | O3 Minimal domain-event emission | G04 (part) | **Done ACME-0062** (Narrative) |
| 7 | L1 Plan model pin | G09 | **Done ACME-0063** |
| 8 | L2 ScenarioRunner live multi-step | G01/G02 | **Done ACME-0064** |
| 9 | Q1 Durable quality store | G19 (core) | **Done ACME-0065** |
| 10 | Q2 CLI quality inspect | G19 (part) | **Done ACME-0066** |
| 11 | E1 Trust stage evidence | G12 | **Next recommended**; better diagnosis, independent |
| 12 | T2 Plan measurements block | G10 | Schema-only product residual |
| 13 | T1 Async launch (after ADR) | G08 | **Done ACME-0069 / ADR-0027** |
| 14 | T3 Adapter declaration policy | G11 | May end as permanent “declare only” |
| 15 | Q3/Q4, P*, K*, T4 | remaining | **Q3 done ACME-0067, Q4 done ACME-0068**; P\*, K\*, T4 need explicit approval each |

**Do not** start T1, P2, K, or Q4 without a dedicated charter that names
ADR work and live/budget rules.

For **L2** (and any other live-purpose slice), the activated charter must
include live adapter verification in Minimum Verification Gates—not list
“live provider calls” under Out of Scope. Constraints belong under budget,
opt-in and “not default CI,” not under a blanket live ban.

## 7. Explicit accept / defer list

| ID | Disposition | Rationale |
|----|-------------|-----------|
| G02 | Collapsed into G01 | Same gap, two CURRENT_STATUS bullets |
| G03 auto-drain-in-library | **Rejected** as a solution | ADR-0018; use host drain + O4 alarm |
| G07 CI-not-browser | **Accept** default | Engine authority is CLI/`pnpm`; T4 optional |
| G11 pure dynamic plugins | **Reject** unless ADR overturns static composition | Discovery of declared kits is the max for now |
| G13 | **Defer** until a contract sets temperature for a rejecting model | ACME-0037 already removed defaults |
| G14 | **Defer** | ADR-0014 terminal ambiguity is intentional |
| G15 | **Defer** | Encryption exists; lifecycle is operational product work |
| G16 | **Optional hygiene** | Tolerance is deliberate; tighten only with captures |
| G18 | **Accept observe-only** | Proven on Windows + ubuntu-latest |

## 8. How to turn a slice into a task

For each activation:

1. Copy `docs/template_CURRENT_TASK.md` into `docs/CURRENT_TASK.md`.
2. Assign the next `ACME-NNNN`.
3. Set Goal = single slice outcome (e.g. “Classify SQLite driver errors…”).
4. Primary deliverable = concrete code/docs artifact.
5. In scope = only that slice’s steps.
6. Out of scope = neighboring slices in this plan (name them). Do **not** put
   “live provider calls” in Out of Scope when the slice is a live path (L2,
   Q4, P3 capture); put budget, model, opt-in and “not default CI” in gates
   and constraints instead.
7. Definition of Done + minimum gates (typecheck, tests, boundaries, docs;
   plus live adapter gate when the package purpose requires it).
8. Freeze at `Ready` before implementation.
9. On completion: archive, update Persistent Gaps (remove or reword), JOURNAL.

If a slice discovers blocking prerequisite work, pause the parent and open a
child task; do not expand the frozen charter (`docs/TASK_WORKFLOW.md`).

## 9. Mapping back to CURRENT_STATUS wording

| CURRENT_STATUS topic | Gap ID(s) | Package |
|----------------------|-----------|---------|
| ScenarioRunner no live provider step | G01 | WP-L |
| Nothing drains automatically / no alarm | G03 | WP-O (O4; no library auto-drain) |
| Outbox residuals (failed, transport, events) | G04 | WP-O |
| Driver error classification | G05 | WP-D |
| Stranded executions | G06 | WP-D |
| Test UI workbench delivered; CI not browser | G07 | Accept / optional T4 |
| ScenarioRunner mock-only / S10 single-execute | G02→G01 | WP-L |
| Launching blocks caller | G08 | WP-T |
| Plans cannot pin a model | G09 | WP-L |
| `measurements` not in plan | G10 | WP-T |
| Adapter targets declared not discovered | G11 | WP-T |
| Trust pipeline granularity | G12 | WP-E |
| Model parameter capability residual | G13 | WP-P |
| Ambiguous call reconciliation | G14 | WP-P (defer) |
| Privacy deletion / key lifecycle | G15 | WP-K (defer) |
| Offline fixtures simplified | G16 | WP-P optional |
| Package boundary future adapters | G17 | WP-X |
| better-sqlite3 platforms observed | G18 | WP-X |
| Quality evaluation memory-only | G19 | WP-Q |

## 10. Non-goals of this plan

- Ranking business value beyond engineering risk and dependency order.
- Estimating calendar time or headcount.
- Replacing `docs/design/acme-design-and-development-spec.md`.
- Authorizing **unbounded** live spend, production hosting or default-CI live
  traffic. Bounded, charter-named live adapter verification for live-purpose
  packages is in scope for those future tasks (see §1 policy).

## 11. Maintenance

When a gap is closed, update:

1. This document (mark gap **Closed** with task id and date).
2. `docs/CURRENT_STATUS.md` Persistent Gaps (remove or reword).
3. `docs/JOURNAL.md` handoff of the implementing task.

When a new residual is discovered, either:

- add a gap ID here via a docs task, or
- place a backlog proposal under `docs/backlog/` until activated.

Do not let CURRENT_STATUS accumulate unplanned bullets without an ID in this
plan or an explicit backlog file.
