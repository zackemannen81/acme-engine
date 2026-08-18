# Evidence Workbench 2.0 — Interface and Delivery Plan

Status: **Approved sequencing.** Both required decisions are taken:
[ADR-0049](../adr/0049-evidence-v2-surface-set.md) fixes the surface set and
[ADR-0050](../adr/0050-evidence-v2-pdf-ingestion-boundary.md) opens the PDF
ingestion boundary. Implementation is not thereby activated: each step still
needs its own explicitly approved task and frozen charter. ACME-0156 is
complete, as are ACME-0157 and ACME-0159 — the last reordered ahead of
ACME-0158 by the operator on 2026-08-18, recorded in §6. ACME-0160 followed;
ACME-0161 and ACME-0158 are complete.
Created: 2026-08-18
Last updated: 2026-08-18
Authority: [ADR-0047](../adr/0047-evidence-application-model-reset.md) and
[the V2 domain specification](evidence-workbench-v2-domain-specification.md)

This plan sequences the work needed to make the requested Evidence Workbench
2.0 operable: a case-first interface that walks the requested process model
from PDF import to a combined timeline, persisted on the running self-hosted
Supabase instance.

It changes no frozen charter, freezes nothing itself, and grants no authority.
Where the request exceeds the V1 boundary the plan says so and names the
decision required instead of absorbing it quietly.

## 1. The requested process model

The attached model (`Beviskedjeanalys`, owner Rickard Zakrisson, 2026-08-18)
describes this loop:

```text
Skapa case → Importera PDF → Segmentera/slica → Identifiera beviskedjor
  → Välj kedja
      → Analysera kedjans del → Extrahera observationer och claims
      → Hantera observationer som kandidater, lägg till nya
      → Bedöm relation till tidigare claims:
           bestrider | tillför | bekräftar | villkorar
      → Fler delar i kedjan? ↺
  → Markera kedjan klar
  → Fler kedjor? ↺
  → Skapa samlad tidslinje och analysrapport
```

That is, with two exceptions named in §4, the flow already fixed in
[the domain specification §4](evidence-workbench-v2-domain-specification.md).
The four relation verbs map onto the L3 `Relation` vocabulary and the
consensus vocabulary `supported` / `contested` / `qualified` / `unresolved`.
"Välj kedja, analysera del för del" is the `Chain` → `ChainInstance` walk.
"Uppdatera kedjan atomärt" is R-05's per-window commit, already delivered.

## 2. What exists today

Delivered and measured (ACME-0150 through ACME-0155):

| Layer | State |
| --- | --- |
| Structure (J1) | `evidence-v2-source-structure/1`. 74,469 real lines to 650 parts and 29,971 citable units, 0 non-bindable, one 88 ms pass |
| Chain proposal (J2) | `evidence-v2-chain/1`. 650 parts to 351 chains and 467 instances, 5 unassigned, 21 ms, deterministic |
| Persistence | PostgreSQL repository, encrypted canonical text in an object store through the ADR-0037 envelope |
| Auth | Every route and page authenticated; case-scoped authorization; cross-principal 404 on all six case routes |
| Extraction (J3) | `evidence-v2-observe/1` (ADR-0048). Bounded windows, per-window commit, content-derived resume. Recorded: 2 planned, 2 spent, 27 occurrences, 0 non-verbatim quotes |
| Surfaces | Cases, case, parts, part with exact lines, chains, chain, instance. Server-rendered HTML, every list bounded |

Not built at all: `Review`/`Standing`, `Claim`, `Relation`,
`ConsensusProjection`, any timeline surface, any case-status surface, and any
PDF path. An occurrence today is canonical evidence, **not accepted** evidence.

The running Supabase instance at `c:\code\supabase-selfhost` currently holds
**no** ACME schema and **no** storage bucket. Nothing has been provisioned onto
it; the recorded ACME-0154 run used a throwaway database per proof rule 1.

## 3. Feature mapping

| Requested feature | V1 boundary | Today | Lands in |
| --- | --- | --- | --- |
| Skapa nytt / öppna befintligt case | In (`Case` surface) | Delivered | — |
| Importera / ladda upp `.pdf` | **Out.** §7 refuses PDF; ADR-0040 §3 admits only operator-prepared text with outside-PDF provenance | Text import only | ADR-0050, then ACME-0158 |
| Segmentera och slica dokumentet | In (J1) | Delivered | — |
| Identifiera separata beviskedjor | In (J2) | Delivered | — |
| Välj kedja, analysera steg för steg, uppdatera atomärt | In (J3) | Delivered | — |
| Extrahera observationer | In (L1) | Delivered | — |
| Extrahera *claims* | In (L2 projection) | Not built | ACME-0160 |
| Hantera observationer som kandidater, lägg till nya | In (`Review`/`Standing`, L1) | Not built | ACME-0159 |
| Bedöm relation: bestrider/tillför/bekräftar/villkorar | In (L3 `Relation`, J4) | Not built | ACME-0161 |
| Markera beviskedjan som klar | In (derived standing, not a stored flag) | Not built | ACME-0159 |
| Global Timeline-vy, kronologisk | In as P3; not named as a surface in §6 | Not built | ADR-0049, then ACME-0162 |
| Case status / stats-vy | In as "Global: case overview — counts and where to resume". Charts and dashboards are **out** | Not built | ACME-0157 |
| Dokumentvy | In (`Source` surface) | Delivered | polished in ACME-0157 |
| Kedjevy | In (`Chain` surface) | Delivered | polished in ACME-0157 |
| Relations-vy | Relations are in; **graph visualisation is out** (§6); **persons need an actor roster, which is out** (§7) | Not built | ADR-0049, then ACME-0161 |
| Samlad analysrapport | **Out.** §7 excludes assessment documents and any generated report | Not built | Deferred — [backlog](../backlog/v2-interface-deferred-features.md) |

Two things the request does not mention but the flow cannot work without, and
which the plan therefore includes: **review and standing** (without it,
"kandidater" and "klar" have no meaning and consensus has no input) and the
**consensus projection** (the thing a combined timeline and any later report
would be built from).

## 4. Decisions required

Neither could be taken inside a task charter. Both constrain public contracts,
persistence and the product boundary, so `AGENTS.md` required an ADR.

**Both were approved on 2026-08-18 as recommended below.**
[ADR-0049](../adr/0049-evidence-v2-surface-set.md) and
[ADR-0050](../adr/0050-evidence-v2-pdf-ingestion-boundary.md) are Accepted and
are the authority; the recommendations kept here are the reasoning that led to
them.

### D1 — ADR-0049: V2 surface set for the 2.0 interface — **Accepted**

Domain specification §6 fixes six surfaces plus two global ones and forbids
dashboards, charts, graph visualisation and report generation in V1. The
request adds a global timeline surface, a case-status surface and a relations
surface.

Proposed decision:

- **Add** `Global: Timeline` as a named surface. It is a bounded projection
  over occurrences and claims at an explicit case revision, typed time
  preserved, unknown time visibly unordered rather than silently placed, every
  row opening its exact source. This is the surface P3 already requires; §6
  simply never named it.
- **Confirm** the case-status surface is the §6 case overview: counts,
  outstanding work and where to resume. No chart, no score, no ranking.
- **Constrain** the relations surface to a bounded scoped list or table of
  typed relations with both endpoints resolving to exact sources. Graph
  rendering stays out.
- **Confirm** persons are represented by the chain subject label, which is
  already derived from document body fields. No actor roster, no cross-case
  entity resolution, and no change to null-actor Pass 1 (ADR-0046 §4 stands).

Taken as [ADR-0049](../adr/0049-evidence-v2-surface-set.md), which adds two
constraints the recommendation left implicit: the timeline states the case
revision it was computed at and never requires engine/product revision equality
(R-06), and the case-status surface may not render a progress indicator that
implies completeness of evidence rather than of work.

### D2 — ADR-0050: PDF ingestion boundary — **Accepted (option B)**

Today the product refuses the PDF container by decision, not by omission.
ADR-0038 admits one strict UTF-8 plain-text class; ADR-0040 §3 admits Stage A
text that may be derived outside ACME from an excluded container, recording the
container digest and the named extraction method. The V2 artifact record
already carries exactly that provenance shape (`parentKind`, `parentSha256`,
`parentByteLength`, `pageCount`, `extractionMethod`, `extractedAt`).

Three options:

| Option | What happens | Cost |
| --- | --- | --- |
| **A. Keep PDF outside** | An operator tool converts the PDF and posts text plus the container digest. No ADR needed. | The interface never accepts a PDF, so the requested first step does not exist in the product. |
| **B. Server-side extraction (recommended)** | The product accepts the PDF, stores the **exact received bytes** as the L0 artifact under the ADR-0037 envelope, and derives canonical text as a named versioned derivative. A new source class, for example `stage-a-pdf-extracted-text/1`. | New ADR; one new dependency; extraction determinism must be proven and version-pinned. |
| **C. Browser-side extraction** | The browser extracts text; the PDF never reaches the server. | Weakest provenance — the L0 artifact becomes the extractor's output rather than the received document — plus a client-side dependency. Not recommended. |

Recommendation is **B**, because the exactness rule the whole product rests on
is better served when the received bytes are what is stored, and because A
leaves the requested flow starting outside the product.

B must decide, in the ADR: the extractor and its pinned version; whether
extraction is required to be byte-deterministic for a given (bytes, extractor
version) pair and how that is proven; what happens to a scanned or image-only
PDF (recommendation: refuse, fail closed — OCR stays out); the size bound; and
whether the encrypted original is retained or discarded after canonicalization
(recommendation: retained, since it is the L0 object).

There is no PDF reader dependency in the workspace today. The frozen
application's PDF *writer* is a minimal base-14 emitter and cannot read.

Taken as [ADR-0050](../adr/0050-evidence-v2-pdf-ingestion-boundary.md), which
answers each open point: the class is `stage-a-pdf-extracted-text/1`, the
received bytes are the L0 artifact and are retained, canonical text is a
versioned derivative derived once inside the import transaction, determinism is
a measured gate across separate processes rather than an assumption, image-only
and encrypted PDFs are refused fail-closed with OCR still out, and the
extraction library is pinned behind an adapter port with its selection left to
ACME-0158.

## 5. Substrate

The Supabase stack at `c:\code\supabase-selfhost` is running and was verified
reachable on 2026-08-18. ADR-0029 and ADR-0037 already authorize this
substrate; no decision is required, only wiring.

| Concern | Path | Verified |
| --- | --- | --- |
| PostgreSQL | Supavisor **session** pooler on `127.0.0.1:5432`, user `postgres.<POOLER_TENANT_ID>`, database `postgres` | Connected, PostgreSQL 15.8 |
| Transaction pooler | `127.0.0.1:6543` | **Not** to be used. ACME commits at an expected revision with compare-and-swap, and transaction pooling breaks session-scoped guarantees |
| Object store | Supabase Storage S3 protocol endpoint through Kong at `http://127.0.0.1:8000/storage/v1/s3`, SigV4, path-style — which is what `@acme/adapter-evidence-artifact-s3` already speaks | Kong healthy, storage 1.48.26 |
| Bucket | None exists yet; one must be created for V2 | Confirmed empty |
| Schemas | `evidence_v2`, `evidence_v2_identity`, `acme_v2_ledger`; none exist yet | Confirmed absent |
| Browser isolation | ADR-0029 stands: ACME schemas are never exposed through PostgREST or the anon key, and the browser talks only to the product API | Unchanged |
| Credentials | Environment and mounted secret files only. Never committed | Unchanged |

Identity is a separate question from persistence. The V2 composition currently
uses `createDeterministicEvidenceAuthenticator` — development credentials in
the composition root. `@acme/adapter-evidence-auth-supabase` exists and is
unwired. Wiring the running Supabase Auth (GoTrue) is a real improvement but is
**not** required by any requested feature, so it is planned as an optional step
(ACME-0163) rather than folded into the substrate task.

## 6. Delivery sequence

One active task at a time, each with its own frozen charter. The domain
specification's child-task rule stands: no broad "build the workbench" task.

Every task inherits the same standing gates: `pnpm typecheck`, `pnpm lint`,
`pnpm format:check`, `pnpm boundaries`, `pnpm test`, `pnpm docs:check`,
`pnpm build` and `git diff --check`, plus `pnpm test:postgres` where
persistence changes. New V2 packages must not depend on any frozen package.

### ACME-0156 — V2 on the running self-hosted Supabase

**Status: complete 2026-08-18.** Archived as
[`ACME-0156`](../finished/ACME-0156_v2-supabase-substrate.md); the run procedure
and recorded numbers are in [the runbook](../ops/evidence-v2-supabase.md).

- **Goal.** The V2 workbench runs against the installed Supabase instance and
  survives a restart with every read coming from PostgreSQL.
- **Deliverable.** A composition and startup path that migrates `evidence_v2`,
  `evidence_v2_identity` and `acme_v2_ledger` against the session pooler,
  stores canonical text in a named Supabase Storage bucket through the existing
  S3 adapter, reads every key from environment or mounted files, and a recorded
  run: create case, import the real `source-A` text, 650 parts and 351 chains
  persisted, restart, identical reads.
- **Out of scope.** PDF. Any new surface. Any new domain object. Supabase Auth.
- **No new authority required.**

### ACME-0157 — Interface 2.0 shell and case status

**Status: complete 2026-08-18.** Archived as
[`ACME-0157`](../finished/ACME-0157_v2-shell-and-case-status.md).

- **Goal.** A workbench frame a person can actually work a case in, plus the
  case-status surface.
- **Deliverable.** Persistent case-scoped navigation across Case, Documents,
  Chains, Instance, Timeline, Relations and Status; breadcrumbs that never lose
  the case; bounded lists everywhere (R-08); a projection gap shown as one
  explicit named state (R-07); the case-status surface reporting counts,
  outstanding work and where to resume.
- **Out of scope.** Charts, scores, rankings. Any new domain object. Any client
  framework beyond progressive enhancement.
- **Requires D1** — satisfied by [ADR-0049](../adr/0049-evidence-v2-surface-set.md).

### ACME-0158 — PDF import

**Status: complete 2026-08-19.** Archived as
[`ACME-0158`](../finished/ACME-0158_v2-pdf-import.md). Reordered
behind ACME-0159 through ACME-0161 by the operator; those are complete.

**Reordered 2026-08-18: ACME-0159 runs first.** The operator's call, and the
defensible one. The status surface reports instances waiting on extraction in a
flow where nothing can yet be accepted, and every layer above — claims,
relations, consensus — is defined over occurrences with an *accepted* standing
(§2.4). Widening ingestion before the review loop closes would add material
nobody can act on. Nothing about ADR-0050 changes; only its position.

- **Goal.** A case owner uploads a PDF in the browser and reaches a structured,
  chained source without leaving the product.
- **Deliverable.** The class decided in D2: exact received bytes stored as the
  L0 artifact under the ADR-0037 envelope, canonical text derived by a named
  pinned extractor, provenance recorded, structure and chain proposal derived
  once inside the import transaction as they are today, and a fail-closed
  refusal for image-only PDFs and over-bound files.
- **Out of scope.** OCR. DOCX. Media. Bulk ingestion. Stage B material.
- **Requires D2** — satisfied by [ADR-0050](../adr/0050-evidence-v2-pdf-ingestion-boundary.md).

### ACME-0159 — Review, standing and human-authored occurrences

**Status: complete 2026-08-18.** Moved ahead of ACME-0158. Archived as
[`ACME-0159`](../finished/ACME-0159_v2-review-and-standing.md).

- **Goal.** An occurrence stops being a bare candidate.
- **Deliverable.** Append-only accept, reject, revise and move decisions with a
  server-derived principal, rationale and time; effective standing derived from
  history and never stored as a mutable field; a human-authored occurrence that
  obeys the same L1 invariants (bound to one artifact version and one locator,
  with a verbatim quote that binds uniquely inside that range); chain-complete
  as a derived state over its instances rather than a flag.
- **Out of scope.** Reviewer assignment, bulk review and multi-reviewer
  workflow (§7). Claims. Relations.

### ACME-0160 — Claims

**Status: complete 2026-08-18.** Archived as
[`ACME-0160`](../finished/ACME-0160_v2-claims.md).

- **Goal.** Occurrences that concern one proposition can be worked as a group
  without ever being merged.
- **Deliverable.** `Claim` as a named grouping target; grouping as an
  append-only recorded decision; the Claim surface, every row resolving to its
  exact contributing occurrences and their exact sources; J5 as a deterministic
  projection with no model spend.
- **Out of scope.** Merging, absorbing, owning, or any claim that outlives its
  occurrences.

### ACME-0161 — Relations and instance comparison

**Status: complete 2026-08-18.** Archived as
[`ACME-0161`](../finished/ACME-0161_v2-relations.md).

- **Goal.** The four verbs in the requested model become reviewable evidence.
- **Deliverable.** `Relation` with typed endpoints, comparable scope, rationale
  and provenance, never deleting an endpoint; the J4 bounded chain-scoped
  comparison over **frozen accepted** occurrences of earlier instances, which
  preserves blind extraction; the relations surface as a bounded scoped list
  with both endpoints opening their exact sources.
- **Out of scope.** Graph rendering. Actor rosters. Cross-case resolution.
- **Requires D1** — satisfied by [ADR-0049](../adr/0049-evidence-v2-surface-set.md).

### ACME-0162 — Global timeline and consensus

- **Goal.** P3, and the input any later report would need.
- **Deliverable.** The case-scoped chronological projection over occurrences
  and claims at an explicit case revision, typed time preserved and unknown
  time visibly unordered; `ConsensusProjection` computed per claim from
  accepted material only, with chain and case levels as aggregates carrying no
  vocabulary of their own; absence of material yielding
  `insufficient-material` and never refutation.
- **Out of scope.** Reports, exports, scoring, weighting.
- **Requires D1** — satisfied by [ADR-0049](../adr/0049-evidence-v2-surface-set.md).

### ACME-0163 — Supabase Auth (optional)

- **Goal.** Replace the development authenticator with the running GoTrue.
- **Deliverable.** `@acme/adapter-evidence-auth-supabase` wired into the V2
  composition, sessions still server-side and encrypted, browser isolation
  unchanged.
- **Not required by any requested feature.** Sequence it when the deployment
  stops being single-operator.

## 7. Explicitly deferred

Recorded in [the backlog](../backlog/v2-interface-deferred-features.md) so
nothing from the request is silently dropped: the combined analysis report, the
actor roster and person-level relations, and graph visualisation of relations.

## 8. Risks

- **D2 is the only step that adds a runtime dependency.** Everything else
  composes existing packages. Extraction determinism is the property to prove
  before it is trusted, not after.
- **Scope pressure.** Six of the eight tasks touch surfaces, and surfaces are
  where "one more view" arrives. The §6 rules and each charter's Out of Scope
  are the defence.
- **The acceptance run is not this plan.** P1 to P3 remain the product's
  acceptance; this plan makes them reachable through a usable interface. A
  defect found later is classified by the §8 rules and does not reopen these
  charters.

## References

- [V2 domain specification](evidence-workbench-v2-domain-specification.md)
- [ADR-0047](../adr/0047-evidence-application-model-reset.md)
- [ADR-0048](../adr/0048-evidence-v2-observe-contract.md)
- [ADR-0049](../adr/0049-evidence-v2-surface-set.md)
- [ADR-0050](../adr/0050-evidence-v2-pdf-ingestion-boundary.md)
- [ADR-0040](../adr/0040-poc-1-live-product-applicability.md)
- [ADR-0038](../adr/0038-bounded-text-ingestion-and-immutable-redaction.md)
- [ADR-0037](../adr/0037-evidence-secure-artifact-foundation.md)
- [ADR-0029](../adr/0029-poc-1-self-hosted-supabase-persistence-platform.md)
- [Product definition](evidence-integrity-workbench-product-definition.md)
- [POC #1 reusable-execution proof](../acceptance/poc-1-reusable-execution-proof.md)
