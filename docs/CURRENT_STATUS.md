# Current Status

## Open: real-source acceptance blocked, application model being replaced

The 2026-08-16 acceptance run against the complete 1,915-page `source-A` binder
did not complete any of the three intended product journeys. The failures are
above the engine boundary and are recorded in the journal entry of the same
date. In summary:

- 126 of 246 source parts (51 %) cannot be analysed, because 259 of 92,141
  structured segments cannot bind uniquely inside their own locator range and a
  single such segment aborts the whole job non-retryably;
- observations project only after whole-job success, so committed coverage
  windows are discarded when a later window fails;
- product workspace `evidenceRevision` counts imports while engine
  `EvidenceState.evidenceRevision` counts canonical-evidence deltas; five
  reviewer views require them to be equal, so any case with more analysed
  windows than imports becomes unreadable and its surfaces disagree;
- part titles systematically name a different document than the part body in
  this material, so displayed interview dates are wrong while line-level
  provenance stays exact.

The acceptance case for that run is retained wedged as failure evidence and must
not be repaired.

[ADR-0047](adr/0047-evidence-application-model-reset.md) is accepted. The
Evidence *application* domain model is replaced and the delivered workbench is
frozen as a diagnostic reference. The replacement model, V1 boundary, proof
journeys and binding regression requirements are normative in
[the V2 domain specification](design/evidence-workbench-v2-domain-specification.md).

The replacement is being built layer by layer below. ACME-0158 is complete.
No task is active.
Nothing below this section is retracted by the decision: the engine,
persistence, artifact security, authorization, case isolation and live model
boundary carry forward unchanged, and no data authority changes. Stage A remains
the only authorized non-synthetic class and Stage B stays closed.

Only maintenance preserving the frozen application's diagnostic value is
permitted there. ACME-0149 is the first and so far only such change: the analyze
confirmation reports the planner's derived bounded call count from a read-only
case-scoped `coverage-plan` route instead of a fixed `Maximum model calls: 1`.

ACME-0150 delivered the first V2 layer: `@acme/module-evidence-v2` derives
source parts and citable units from canonical text, pure, total and offline,
with no dependency on anything. Measured over the real 74,469-line `source-A`
text: 650 parts, 29,971 citable units, **zero** that cannot bind uniquely inside
their own line range, against 259 non-bindable units and 126 of 246 unanalysable
parts under the frozen rules. All 944 dot-leader index lines fall inside parts
classified `index-or-front-matter`. Derivation is a single 88 ms pass and 29,971
lookups take 3 ms, against the frozen application's re-derivation per lookup that
blocked its event loop for up to 64 s per window. R-01, R-02's title half, R-03
and R-10's package half are retired as design properties.

ACME-0151 added the second layer, `evidence-v2-chain/1`: source parts organize
into longitudinal chains whose subject and instance time come from the document
body's labelled fields, never from a part title, with append-only membership
decisions and a pure fold to the effective state. Measured over the same real
binder: 650 parts propose **351 chains** and 467 instances with 5 unassigned
parts, deterministically, in 21 ms. The Hussein Ammouri chain holds 13
instances ordered by body date, each resolving to its exact source line, and
three of them span several parts. The part titled `Förhör med Ammouri,
HUSSEIN; 2007-04-25` sits in the `Ammouri, Allia` chain because its body
reports a different person — which is the other half of R-02 paid off.

ACME-0152 made those two layers operable. `@acme/evidence-v2-contracts`,
`@acme/adapter-evidence-v2-postgres`, `apps/evidence-workbench-v2-api` and
`apps/evidence-workbench-v2-web` persist a case, an artifact whose canonical
text is encrypted in an object store through the shared ADR-0037 envelope, and
the structure and chain proposal derived exactly once at import. A plain
server-rendered surface walks Case → Source → Chain → Instance → exact source
lines, every list bounded at 100 rows.

Recorded on a fresh PostgreSQL database and a fresh MinIO bucket with the real
`source-A` text: import 1,205 ms, canonical SHA-256 matching, 74,469 lines, 650
parts and 351 chains persisted; after a process restart every read comes from
PostgreSQL. The Hussein chain shows its 13 instances in body-date order, the
part titled `Förhör med Ammouri, HUSSEIN; 2007-04-25` opens under
`Ammouri, Allia`, and appending one membership decision moves it while the
stored proposal (645 rows) and structure (650 rows) stay md5-identical.

ACME-0153 closed that gap. The V2 app now authenticates every route and every
page except sign-in and `/health`, using the shared `@acme/evidence-auth`
session service with its cookie, CSRF token and encrypted upstream session, on
a durable PostgreSQL identity schema. Case-scoped access goes through
`authorizeEvidenceCaseAction`, case creation registers the identity case and an
owning membership in the same operation, and the case list is scoped to
membership. Measured in the recorded run: a second principal receives **404 on
all six case-scoped routes and on the import write**, and sees an empty case
list; an unauthenticated request gets 401, a write without CSRF 401, a
cross-origin write 403, and sign-out invalidates the session.

ACME-0154 produced the first V2 evidence. `evidence-v2-observe/1`
([ADR-0048](adr/0048-evidence-v2-observe-contract.md)) sends one bounded window
of at most 24 citable units and at most 800 quoted words; the model returns only
a unit id, a kind and the time span the unit states, and **the occurrence's quote
and locator are taken from the cited unit**, so no model wording can enter the
record. The two failures that killed the frozen extractor are designed out rather
than tuned: there is no coverage field to enumerate (R-04), and each window's
occurrences are persisted in the same step that commits it (R-05). Window
identity is content-derived, so a re-run executes only windows with no committed
execution. `@acme/core` was used unchanged, which is the first live evidence for
ADR-0047 §9's proof obligation.

Recorded on a fresh database and bucket with the real binder, through the
product's own authenticated routes: the smallest Hussein instance planned **2**
bounded calls, spent **2**, committed both windows and produced **27
occurrences** in 11.8 s; **0 of 27** quotes fail to appear verbatim in their own
source lines and **0 of 27** stored temporal bounds are anything but a calendar
value; the ledger holds 2 calls with 2,438 input and 1,255 output tokens, both
responses retained AES-256-GCM encrypted under a ledger key that is separate from
the session key; provider cost was reported as unknown, not zero. Re-running the
same instance planned **0** calls, spent 0, and left the ledger at 2. The
instance page renders all 27.

That run is the first measured proof that an application can compose ACME
and receive bounded execution, persist, resume, retention and cost control
without inventing them. The scoped claim, the tests, and the account of
where `packages/core` was and was not adapted are in
[the POC #1 reusable-execution proof](acceptance/poc-1-reusable-execution-proof.md).
It is not V1 acceptance of the V2 application and not the close of
ADR-0047 §9.

Four defects were found only by that run: a structured-output schema name
containing `/`, an unsupported `temperature`, a model-typed temporal bound the
model could not fill, and — the one that reached the record — the Swedish word
`då` ("then") returned as a stated time and typed into a temporal bound. A stated
time is now constrained to a calendar value in the output schema, so a vague
reference becomes `null` while the unit's own words stay verbatim. A fifth was
found by reading the composition root: the ledger's retained payloads were keyed
with the session key, and now have a key of their own. Each has an offline test.

ACME-0156 put that application on a persistent substrate for the first time.
Every earlier V2 run used a throwaway database and bucket, because acceptance
proof rule 1 requires a clean substrate per proof run. The workbench now starts
from environment and mounted secret files against the installed self-hosted
Supabase instance: `startFromEnvironment` migrates `evidence_v2`,
`evidence_v2_identity` and `acme_v2_ledger` through the Supavisor **session**
pooler, refusing the transaction pooler on port 6543 before the first migration
because compare-and-swap needs a session-scoped connection, and stores encrypted
canonical text in a private Supabase Storage bucket through the existing
ADR-0037 S3 port.

Recorded on that instance with the real binder: import in 1,603 ms; 74,469
lines, 650 parts and 351 chains persisted; the stored object is 3,521,477 bytes
of ciphertext in which the source's own first-line marker appears zero times.
After a full process restart every read comes from PostgreSQL — canonical
SHA-256, line, part and chain counts identical — in 261 ms across five surfaces,
and the Hussein chain still shows its 13 instances in body-date order with two
of them spanning several parts. A second principal receives 404 on all three
case-scoped routes and an empty case list; an unauthenticated request gets 401.
Browser isolation is measured rather than assumed: PostgREST exposes
`public,storage,graphql_public` only, and both the anonymous and the
service-role key receive `PGRST205` on the V2 tables, so the schema is not
exposed at all rather than merely protected by a policy.

One finding is worth carrying forward because it costs an hour to rediscover:
Supabase Storage rebuilds the canonical `Host` header from `STORAGE_PUBLIC_URL`
rather than from the header it received, so an S3 request signed against
`127.0.0.1:8000` fails `SignatureDoesNotMatch` while the identical request
signed against `localhost:8000` succeeds. It is a configuration rule, not an
adapter defect; `@acme/adapter-evidence-artifact-s3` was used unchanged. The
run procedure, the required variables and every recorded number are in
[the V2 Supabase runbook](ops/evidence-v2-supabase.md).

Two pre-existing gate failures were found by that run and fixed, both in
ACME-0154's own test surface and neither in product behaviour: the V2 ledger
type required `snapshot()` to return a promise, which the in-memory repository
does not, and the app test's stand-in repository never gained the four
extraction methods the port added. `pnpm lint` also failed on a file in the
gitignored `tmp/` scratch directory, so `tmp/`, `.tmp/` and `.local/` are now
ignored by ESLint and the lint gate no longer depends on operator scratch.

ACME-0157 gave that substrate a frame. Every V2 page now renders inside one
shell that names the case it belongs to and carries the whole
[ADR-0049](adr/0049-evidence-v2-surface-set.md) surface bar — Case, Documents,
Chains, Timeline, Relations, Status — with the current surface marked. Chains
and documents gained case-scoped entries: a case holding exactly one source
goes straight to its chains, and a case holding several is asked which one
rather than having two artifacts' chains merged into a list belonging to
neither.

The `Status` surface is the §6 case overview. It is a pure projection over
stored rows — two aggregate statements, nothing stored, no structure
re-derived (R-10) — reporting sources, lines, parts, citable units, chains,
instances, occurrences, committed and failed windows, membership decisions, how
many instances have no committed extraction, and a resume pointer naming a
concrete next instance. Measured on the ACME-0156 Supabase case: **650 parts,
29,971 citable units, 351 chains, 467 instances** in **132 ms**, agreeing
exactly with what the list routes report.

The rule that surface carries is that an unbuilt surface reports its own
condition and never a number. Timeline, Relations, Claims, Consensus and
Standing each answer with a named `not-implemented` state and the task that
delivers them, from one shared list that navigation and the status page both
read — so the two cannot disagree. Reporting `0 claims` would be a false
statement about the case where the true statement is about the product, and a
navigation entry rendering an empty list for an absent surface is R-07 rebuilt
deliberately. Every list page now also states its own bound rather than
implying it (R-08).

One finding was recorded rather than fixed: 1 of the 351 chains carries a
subject label of leftover punctuation and sorts first, so the resume pointer
names the least useful chain in the case. The pointer is correct and the label
is the defect; it belongs to the chain layer and is
[in the backlog](backlog/v2-degenerate-chain-subject.md).

ACME-0159 made an occurrence reviewable. `evidence-v2-review/1` is an
append-only decision — action, occurrence, superseded predecessor,
server-derived principal, time and rationale — and effective standing is a pure
fold over that log, never a stored field. Three actions, not four: §2.3 says an
occurrence belongs to a chain instance by reference only and that re-chaining
never touches it, so moving is already exercised by the chain membership
decisions and a second way to re-chain could disagree with the first. `revise`
edits nothing either.

A reviewer can add an occurrence the model missed, and does it by citing a
citable unit id — the product assembles the quote and locator from that unit,
exactly as ADR-0048 §2 makes it do for the model. A reviewer cannot type words
the source does not contain, structurally rather than by validation. Instance
and chain completion are derived on read: `not-extracted`, `pending-review` and
`reviewed` are three distinct states, and a chain is complete only when every
instance is reviewed. Nothing stores a completion flag, because a flag would be
a second source of truth the log could contradict.

Recorded on the live Supabase case through the product's own routes: a
reviewer-authored occurrence took its quote from unit L48071 and ignored an
`exactQuote` planted in the request body; accept → reject → accept left the
effective standing `accepted` with **all three decisions still in the log**;
the recorded principal was server-derived and a `principal` named in the body
was ignored; refusals answered 400/400/404/404; a second principal got 404, an
unauthenticated write 401 and a write without CSRF 401. The status surface now
folds standing counts, and `standing` is gone from its unbuilt list — the first
entry ACME-0157's named-gap machinery has retired, and the compiler found every
place that had to change.

The operator authorized the bounded extraction that closed it. On
`instance-part-000381`: **2** planned calls, **2** spent, 70.2 s, both windows
committed with 19 and 7 occurrences, and **0 of 27** quotes absent from their
own source lines, **0** non-calendar stated times. The ledger holds 2 calls,
2,438 input and 4,802 output tokens under `gpt-5-2025-08-07`, both responses
retained AES-256-GCM under a ledger key separate from the session key, provider
cost reported as unknown rather than zero. Re-running the plan afterwards
states **0** calls. Reviewing what it produced took the instance
`not-extracted` → `pending-review` → `reviewed` at 25 accepted, 1 rejected, 1
needing revision; the chain reports 1 of 13 reviewed and is therefore correctly
**not** complete.

That run found one defect, in this task's own code. The instance surface
reported `reviewed` while the chain and the case reported the same instance
pending, because instance completion was folded over the **rendered page** — 27
occurrences, a page of 25 — rather than over the instance. R-07, reintroduced
by the task whose charter names R-07 as the regression it is most able to
reintroduce. Completion now folds over every occurrence while the rendered list
stays bounded, the chain fold's identical latent bound went with it, and a
regression test asserts that a page of one and the whole instance report the
same completion. All three surfaces then agree.

ACME-0160 added the first object that reaches across instances.
`evidence-v2-claim/1` is a named grouping target and
`evidence-v2-claim-grouping/1` is the append-only decision behind it; effective
membership is folded on read, and the J5 projection over it is deterministic,
recomputed per read and spends nothing.

The invariant that makes a claim safe is the one that makes it useful: it
**never merges, never absorbs and never owns**. Two occurrences quoting the
same words stay two contributors with their own locators — a test pins exactly
that — and excluding one removes it from the claim and from nowhere else. The
occurrence, its standing and its source are untouched, and the superseded
inclusion stays in the log. An emptied claim states that it is empty rather
than reading as an assertion with nothing behind it. A claim carries no score,
weight, confidence or verdict; what grouped evidence adds up to is the
consensus projection's question.

Recorded on the live case, spending nothing: a claim grouping 3 model-produced
occurrences and 1 reviewer-authored one from a second instance reports **4
contributors across 2 instances**, `crossInstance: true`, with 2 accepted, 1
rejected and 1 needing revision — each standing reported rather than flattened,
and the rejected contributor left visible. Excluding one left 3 contributors,
all 5 grouping decisions in the log, and the occurrence still in its instance
of 27. The ledger held **2 calls before and 2 after**. Cross-case grouping is
refused with 404, which is disclosure control rather than validation.

`claims` is gone from the status surface's unbuilt list, leaving timeline,
relations and consensus. That is the second gap the ACME-0157 machinery has
retired.

ACME-0161 added the typed relation and J4. `evidence-v2-relation/1` is a
statement about two endpoints with one of four verbs — `contradicts`, `adds`,
`supports`, `qualifies` — plus comparable scope, rationale and provenance.
A relation never deletes an endpoint. Standing is folded from
`evidence-v2-relation-review/1`; reviewer authorship is itself an acceptance.
A `contradicts` relation whose actor or time is not comparable is refused.

J4 is `evidence-v2-compare/1` in a separate engine namespace, so observe state
is untouched and extraction stays blind. The planner derives the call count
from frozen accepted occurrences of a reviewed current instance and earlier
instances in the same chain. The model cites occurrence ids only. An empty
response is valid. A re-run executes only windows with no committed execution.

The Relations surface is a bounded list, not a graph. `relations` is gone from
the status surface's unbuilt list, leaving timeline and consensus.

Recorded on the live case: a reviewer-authored `adds` from an accepted
occurrence to an existing claim resolved both sources; rejecting it left the
occurrence in its instance of 27 and both decisions in the log. J4 on Hussein
ordinal 2 (`instance-part-000400`) was planned at **15** windows after that
instance was extracted (**3** J3 calls, **52** occurrences, then reviewed) and
compared against ordinal 1's frozen accepted set. All 15 windows committed;
re-planning states **0**. Three model-proposed relations (`adds`, `supports`,
`adds`) are pending, each endpoint opening its exact source. The ledger moved
**2 → 21** (3 extract + 16 compare, including repair). A second principal
receives 404; missing CSRF 401.

A measured finding, not a defect: J4 window count is the product of current
and prior batches (52 accepted / 12 × 25 accepted / 12 = 15). Silence in a
window is valid, so 15 windows produced 3 relations.

ACME-0158 added the PDF ingestion path ADR-0050 accepted. A case owner can
upload a PDF; the product stores the received bytes encrypted as the L0
object and derives canonical text with `pdfjs-dist/6.2.108` plus assembly
rule `pdfjs-text/1`. Image-only and encrypted PDFs are refused with a named
code and nothing persisted. Text import remains.

Recorded through the product's own routes: import 201, class
`stage-a-pdf-extracted-text/1`, received SHA-256
`109be03f6b9f637beac250bc884cf13f9c072eb787ee394655c81a554411ea7e`
(matches the client hash of the PDF bytes), canonical SHA-256
`1cf3dc7f2bacd8099c083559dfcbbcc52876b5c883af513db5abfa4c14c7a780`
(distinct). One part, one line. Second principal 404, missing CSRF 401,
non-PDF refused 400 `EVIDENCE_V2_PDF_NOT_PDF`. Two-process extractor
determinism is pinned by test.

Remaining limitations: consensus projection and the timeline surface still
report their own condition. Extraction is Pass 1 with no neighbour context
and no actor roster. Credentials still come from a development authenticator, so
a real upstream identity provider is unwired. `pnpm test:postgres` has two
pre-existing frozen-app failures unrelated to the V2 work, recorded in
[the backlog](backlog/postgres-gate-test-hygiene.md).

## Delivered

Stage 8 assessment output and export operations are implemented: a reviewed
assessment renders as deterministic JSON, Markdown, DOCX and PDF from one
citation-complete document, every reference resolving to an exact artifact
version, locator and quote. A per-case export policy governs release
deny-by-default, every release and refusal appends an export-audit record, and a
product backup manifest verifies restores fail-closed. No new dependency was
added: DOCX reuses the deterministic ZIP writer and PDF is a minimal base-14
writer with no embedded font and no timestamp. Non-synthetic data remains
denied.

Stage 7 case overview and the Case Integrity Report are implemented: one
authorized case snapshot produces `evidence-case-overview/1` entry counts and
recent product activity, plus a deterministic `evidence-case-integrity-report/1`
whose rows name the exact source-bound observations behind every changed
account, correction, contradiction, temporal conflict, qualification,
unresolved question and assessment needing re-review. Both are pure
projections behind case-first authorized routes; they write nothing and add no
persistence. Non-synthetic data remains denied.

Stage 6 reviewer operations are implemented: case administrators can assign
and reassign bounded work, reviewers can comment and make single or bounded
bulk decisions, effective completed state is derived from append-only review
history, and deterministic bounded search covers case-scoped evidence and
review metadata. File and PostgreSQL adapters persist the new records; the
browser exposes My review work and Search.

Last updated: 2026-08-16

## Repository

- Git repository initialized on `main`.
- Remote: `https://github.com/zackemannen81/acme-engine.git`.
- Docs-first foundation is present.
- A pnpm workspace and lockfile now provide the implementation substrate.
- Node `24.18.0` and pnpm `10.34.5` are pinned; all root development
  dependencies use exact versions.
- Strict ESM TypeScript, ESLint, Prettier, Vitest and dependency-cruiser are
  configured.
- `@acme/core` uses exact Zod `4.4.3` for public runtime schemas.
- Secret-free GitHub Actions CI mirrors documentation, formatting, lint,
  typecheck, boundary, test and build commands.
- Frozen task charters, parent/child tasks, paused tasks and backlog proposals
  are governed by `docs/TASK_WORKFLOW.md`.
- LF line endings are enforced through `.gitattributes`.

## Project Phase

The complete design and development specification is approved as the
implementation baseline:

- `docs/design/acme-design-and-development-spec.md`
- ADR-0001: TypeScript and pnpm workspace
- ADR-0002: Static task-typed module composition
- ADR-0003: SQLite revisioned Unit of Work
- ADR-0004: Deterministic transition identity
- ADR-0005: Pure memory decision application
- ADR-0006: Aggregate in-memory Unit of Work
- ADR-0007: Deterministic model mock and gateway conformance
- ADR-0008: Post-memory domain state projection
- ADR-0009: Reference-domain identity and provenance
- ADR-0010: Input-bound validation and interpretation
- ADR-0011: Narrative knowledge and context ownership
- ADR-0012: Milestone 1 execution identity and replay
- ADR-0013: Durable SQLite schema and driver
- ADR-0014: Live provider boundary and transport port
- ADR-0015: Strict structured-output schema lowering
- ADR-0016: Encrypted payload retention
- ADR-0017: Durable execution resume
- ADR-0018: Outbox delivery boundary
- ADR-0019: Domain Test UI boundary and versioned view contracts
- ADR-0020: `acme-test-plan/1` schema and compiler
- ADR-0021: Interface workspace storage and launch boundary
- ADR-0022: Measurement semantics and fixture-approval boundary
- ADR-0023: Live evaluation gate for the Domain Test UI
- ADR-0024: Local SPA shell and loopback workbench serve
- ADR-0025: Post-execution quality evaluation
- ADR-0026: Durable quality evaluation store
- ADR-0027: Async launch job progress and cancellation
- ADR-0028: First POC is the Evidence Integrity Workbench
- ADR-0029: POC #1 persistence platform is self-hosted Supabase
- ADR-0030: Evidence V1 identity and canonical placement
- ADR-0031: Evidence reviewer overlay and versioned views
- ADR-0032: Evidence V1 correction-occurrence pairing
- ADR-0033: PostgreSQL persistence architecture
- ADR-0034: POC #1 hosted shell identity and topology
- ADR-0035: Evidence authenticated principal and authorization foundation
- ADR-0036: Evidence case management and isolation
- ADR-0037: Evidence secure artifact foundation
- ADR-0038: Bounded text ingestion and immutable redaction

Milestones 1 and 2 are delivered. All five Milestone 2 acceptance conditions
are proven: the shared conformance suite passes unchanged for SQLite, a
post-call crash resumes with zero gateway calls (ACME-0033), close and reopen
preserve the replay digest, an interrupted transaction leaves no partial state,
two writers against one revision yield exactly one commit (ACME-0034), and the
outbox work package landed with ACME-0035.

ACME has a build substrate, pure contract layer, pure StateEngine, pure
MemoryEngine, post-memory state projection, a deterministic in-memory Unit of
Work, a bounded single-task ExecutionEngine and a durable SQLite adapter.
There is currently:

- common JSON, identity, time, document and diagnostic contracts
- deterministic `acme-cjson-1` canonical JSON and SHA-256 hashing
- versioned `acme-model-request-hash-1` over the complete validated
  provider-neutral model request
- versioned deterministic execution ID, operation key, request fingerprint
  and model-response hash algorithms
- the structured ACME error taxonomy
- provider-neutral model, prompt-contract and gateway port types
- closed gateway-boundary validation for selections, requests, capabilities,
  required-capability matching, call contexts and normalized responses
- a strict response pipeline for empty/parse/schema/semantic validation
- input-bound response semantics with non-repairable input validation and
  detached deeply frozen contract input/output
- immutable contract and module registries with deterministic ordering and
  contract fingerprints
- task-typed module authoring plus state/memory envelope and policy types
- typed task-owned post-memory state projection with exact
  candidate/decision correlation, applied-decision filtering and immutable
  replay-stable projection input
- frozen reference-domain v1 identity/evidence contracts: canonical-state
  Narrative alias authority and correction checks plus explicit Research
  proposition, source, independence and retained-evidence keys
- a pure StateEngine that validates current state and typed deltas, enforces
  expected revisions, invokes module initialization/reduction/invariants and
  prepares immutable snapshot/transition candidates without persistence
- versioned deterministic transition identity `acme-transition-id-1`, derived
  from execution/operation/module/entity identity without consuming
  `IdGenerator`
- a pure MemoryEngine that validates candidates and loaded records, executes
  domain-owned resolution against a deterministic evolving working set and
  prepares immutable create/update mutations with expected record versions
- deterministic memory retrieval with validated policy results, stable
  score/identity/ID ordering and enforced limits
- explicit lifecycle preparation for retain, strength-update and forget
  decisions without background wall-clock behavior
- one aggregate `ExecutionRepository` contract with execution, attempt,
  model-call, context, prepared commit and terminal evidence types
- portable replay evidence containing the exact validated task input,
  immutable recorded read set and prepared commit
- versioned `acme-operation-digest-1` with canonical ordering rules
- a deterministic `@acme/adapter-memory` that implements request idempotency,
  ledger/model-call evidence, state/memory/document reads and immutable
  copy-on-commit transactions
- atomic promotion of candidate/evaluator evidence, documents, memory
  mutations, optional state, events/outbox and terminal execution results
- state-head and memory-record compare-and-swap with explicit conflict codes
- identical commit replay without new writes or IDs, with divergent identity
  reuse rejected as persistence corruption
- a reusable non-empty repository conformance suite in `@acme/testing` that the
  in-memory and SQLite adapters both pass unchanged
- a durable `@acme/adapter-sqlite` in WAL mode with enforced foreign keys,
  ordered checksum-verified migrations that refuse a tampered or unknown
  recorded version, and the ADR-0003 `BEGIN IMMEDIATE` Unit of Work
- durable crash recovery proven by reopening a committed database in a new
  connection with identical replay evidence, identical operation digest, no
  new model call and no new ID allocation
- durable and in-memory repository evidence proven equal for the same neutral
  execution
- observed rollback: a fault inside `commit()` leaves no documents, memory,
  state, events, outbox entries, commit record or terminal result on either
  adapter, and the repository stays usable with the retried commit reaching
  the recorded operation digest
- observed compare-and-swap: two writers on one SQLite file that read the same
  revision produce exactly one commit; the loser fails its commit with
  `CONFLICT_STATE_REVISION` and writes nothing
- an outbox delivery boundary (ADR-0018): `leaseOutbox`,
  `markOutboxDelivered`, `markOutboxFailed` and `listOutbox` on both adapters,
  a domain-neutral `drainOutbox` coordinator over an injected
  `OutboxDispatcher`, and `acme outbox inspect` / `acme outbox drain` in the
  composition root
- at-least-once delivery with a lease visibility timeout, caller-owned retry
  policy, terminal `failed` entries and a versioned
  `acme-outbox-drain-report/1`; nothing drains on its own. The API says lease
  because `claim` is Research vocabulary the core guard forbids; the persisted
  status value stays `claimed`
- a deterministic `@acme/adapter-model-mock` with immutable exact-selection
  profiles, finite exact-call scripts and no provider, network, environment,
  filesystem, clock or random dependency
- exact `(executionId, callKey)`, selection and request-hash matching with
  single consumption, scripted response/error outcomes and immutable
  invocation/unconsumed-call evidence
- a reusable non-empty provider-neutral `ModelGateway` conformance suite in
  `@acme/testing` that the scripted mock and the OpenAI adapter both pass
  unchanged
- an `@acme/adapter-model-openai` targeting the OpenAI Responses API behind an
  injected transport port, with request mapping, response normalization,
  deterministic strict structured-output schema lowering (ADR-0015) and the
  ADR-0014 failure classification
- the first producer of the `ambiguous` model-call status: any transport
  outcome without a status line is ambiguous unless the transport can prove
  the request never left
- a `fetch` transport on a separate entry point, whose delivery
  classification is proven offline against an injected `fetch`. It reports
  `unknown` for every post-dispatch failure, because `fetch` cannot prove
  non-delivery, and claims `not-sent` only for cancellation before dispatch
- an opt-in `pnpm test:live` gate that is structurally excluded from
  `vitest.config.ts`, so no default run and no CI step can reach it, and that
  refuses rather than skips when the opt-in or credential is absent
- live success path confirmed: research and narrative reference contracts both
  reached HTTP `200` and committed under the lowered schema; nested `anyOf`
  is accepted; `OpenAiResponseSchema` matched a real completed body
- real-provider confirmation of the ADR-0014 failure classification and of the
  provider error-body schema (ACME-0028 rejections) plus success-path fixtures
  tolerance (ACME-0029)
- a core `PayloadEncryptor` port and AES-256-GCM reference helper
  (ADR-0016 / ACME-0030); both repository adapters seal `encrypted-payload`
  at rest and decrypt on `loadReplayEvidence` when the key is available
- a reusable non-empty public-core-only `DomainModule` conformance suite in
  `@acme/testing`, proven unchanged against testing-owned producer and empty
  analyzer fixtures
- `@acme/module-research` with strict v1 schemas, deterministic
  `research.observe-evidence@1.0.0`, ADR-0009 proposition/source/independence
  identity, corroboration and contradiction policy, a pure reducer with
  invariants and post-memory verification derived only from applied decisions
- Research-owned execution of the unchanged shared DomainModule conformance
  suite, proving core stays domain-neutral across two reference domains
- `@acme/module-narrative` with strict v1 schemas, deterministic
  `narrative.observe-document@1.0.0`, pure state/reducer/invariants and a
  domain-owned memory policy
- `@acme/module-evidence` slices 0–3 foundation, observation and relation path
  with strict source, locator, embedded actor/time, observation, proposition,
  event, relation, question, assessment, state, delta, observe-contract and
  relate-contract schemas; named ADR-0030 content-derived identities;
  source-binding validation; compact pure state; reducer/invariants; domain
  memory policy; active bounded `evidence.observe-artifact@1.3.0` with runtime-
  derived locators, historical replay-compatible `@1.0.0`–`@1.2.0`, and active
  deterministic `evidence.relate-observations@1.1.0` with byte-exact historical
  `@1.0.0` replay; ADR-0032 correction-occurrence pairing;
  and contest projection for scoped `contradicts` relations
- `@acme/evidence-testing` with the exact seven-artifact/eight-version
  `rillford-annex-review-1` synthetic corpus, manifest, scratch/development
  truth, sealed evaluation truth, deterministic golden outputs, identity
  vectors, fixed evaluation observe candidates and evaluation relate
  candidates. Sealed truth is available only from `./evaluation`; candidate
  fixtures import no truth, and both a prompt dependency guard and a negative
  dependency-boundary fixture enforce that separation
- pure primary work-queue, source-review, observation-ledger,
  account-comparison and relation-review views, plus a loopback Evidence
  Workbench API/web/worker composition with development and evaluation seed
  modes. The evaluation seed contains ten immutable observations (five current,
  three contested, two superseded after relate), eight relations and three open
  questions
- ADR-0011-compliant `narrative-window-1` and source-backed
  `previous-document-tail-1`, including golden request, entity and context
  fixtures
- Narrative-owned execution of the unchanged shared DomainModule conformance
  suite plus compile-time task inference checks
- a domain-neutral `ExecutionEngine` that resolves static registrations,
  accepts one request idempotently, performs one primary call, coordinates
  response validation, memory, post-memory state projection and state
  preparation, and commits atomically
- deterministic memory retrieval capped at 50 records and a replay verifier
  that uses only recorded evidence and reports `match`, `different` or
  `unavailable`
- durable execution resume (ADR-0017): re-submitting the request of an
  accepted but non-terminal execution completes it from the recorded model
  call with no provider call, no reservation and no model-call ID, reaching
  the same operation digest as an uninterrupted run on both repository
  adapters and across a real SQLite close/reopen
- resume refusals that never call the provider: unretained or unreadable
  responses are terminal `RESUME_EVIDENCE_UNAVAILABLE`, unobserved
  reservations are terminal `MODEL_UNAVAILABLE`, and recorded `failed` or
  `ambiguous` calls re-raise their recorded error; a crash before any
  reservation runs from the beginning
- a non-empty neutral integration suite plus the fixed Narrative and Research
  Phase 5 offline scenarios, including repeat-without-effects and
  replay-without-clock, gateway or ID allocation
- a ScenarioRunner in `@acme/testing` that validates an `acme-scenario/1`
  document, resolves aliases, executes `execute`, `assert`, `replay` and
  `assertDigest` steps serially and emits a versioned
  `acme-scenario-report/1`, with no branching, retry, loop or arbitrary code
- proof that the runner drives the real engine: the Narrative Phase 5
  acceptance scenario expressed as a scenario file reaches the same operation
  digest as the hand-written test, and both remain in the suite
- an `@acme/cli` composition root that selects the in-memory or durable
  SQLite repository and exposes `scenario run`, `execute`, `execution replay`,
  `execution inspect`, `execution stranded`, `execution discharge`,
  `state inspect`, `memory inspect`, `outbox inspect|drain|redrive` and
  `quality list|inspect|judge`, with versioned JSON on stdout, diagnostics on
  stderr, payload redaction by default and exit codes separating success, a
  non-committed outcome and a usage error
- an `@acme/test-ui` Domain Test UI package (ADR-0019) holding eleven versioned
  view contracts (`acme-view-execution/1`, `acme-view-memory-decisions/1`,
  `acme-view-state/1`, `acme-view-replay/1`, `acme-view-catalog/1`,
  `acme-view-plan/1`, `acme-view-runs/1`, `acme-view-measurement/1`,
  `acme-view-fixture-review/1`, `acme-view-live-evaluation/1` and
  `acme-view-quality-evaluation/1`) and pure builders over recorded evidence,
  with no clock, network or browser, and no I/O on the default entry point
- a catalog (S1) over the static registries plus discovered scenarios and
  fixtures, preserving registry and task declaration order, rendering full
  contract fingerprints, cross-linking contracts to tasks, and marking broken
  things rather than hiding them: invalid scenarios keep the runner
  validator's own message, references that escape the configured root are
  refused, missing references and orphan fixtures are labelled, and an
  unrecognized conformance kit is `unknown`
- a catalog that owns no schema and invents no registry: scenario validity
  comes from the injected `parseScenario`, and the evaluator section is
  `unavailable` because core enumerates no evaluators
- bounded Node discovery on the separate `@acme/test-ui/node-source` entry
  point: no symlink following, deterministic ordering, and depth and file
  bounds reported as diagnostics instead of silent truncation
- `acme-test-plan/1` and a pure compiler (ADR-0020): a case expands into
  `acme-scenario/1` steps, identical plans compile to byte-identical canonical
  JSON pinned by a golden, and the compiler touches no filesystem, network or
  clock. Policies are validated by the engine's own `resolveExecutionPolicy`,
  so the interface owns no second policy schema
- proof that a compiled plan is a runnable artifact: a plan equivalent to the
  Narrative Phase 5 scenario runs through the existing CLI path and reaches
  the same operation digest the hand-written acceptance test pins
- a plan designer (S2) that previews the compiled scenario and reports an
  invalid plan instead of throwing, and a run console (S3) whose history is
  available and whose live-progress half is `available` when the host supplies
  job evidence (ADR-0027) and `unavailable` for pure history-only callers
- an interface-owned file workspace (`runs/<runId>.json`, `jobs/<jobId>.json`,
  `baselines/<name>.json`, `approvals/<proposalId>.json`) that shares no
  table, file or directory with the ledger, with the history index derived by
  reading the records and run identifiers validated as safe file names
- an app composition beside `@acme/cli` selecting the in-memory or SQLite
  repository, and a `launchPlan` that compiles, runs through the existing
  ScenarioRunner and records the outcome, writing nothing to the ledger
- a proven end-to-end loop: configure, launch, find in history and inspect the
  recorded execution through the S4 read model, offline and without the CLI
- explicit absence in every view: an unread section is `unavailable` with a
  reason code rather than an empty array; content is redacted unless a build
  reveals it; a model payload absent under `none` or `hash-only` retention
  reports `not-retained` instead of looking empty by defect
- trust pipeline outcomes derived only from recorded evidence, reporting
  `reached` instead of guessing when the failing execution stage owns several
  substages, and replay rendered in the engine's exact
  `match | different | unavailable` vocabulary
- a durable SQLite quality-evaluation store (ADR-0026): migration v2 adds an
  append-only `quality_evaluations` table with no foreign key to executions, so
  evaluation lifecycle stays independent of the ledger, and
  `createSqliteQualityEvaluationStore` passes the same conformance kit as the
  in-memory store
- `acme quality list`, `acme quality inspect` and `acme quality judge` over the
  composition-selected quality store, plus a live-model judge
  (`runLiveModelQualityJudge`, `kind: live-model`) that runs outside the
  synchronous evaluator harness and is proven offline with an injected
  OpenAI transport
- a pure `acme-view-quality-evaluation/1` list/detail view (S11) in
  `apps/test-ui`, with no HTML surface and no I/O on the default entry point
- async plan launch (ADR-0027): an in-process single-flight JobRunner,
  interface-owned `jobs/<jobId>.json` (`acme-job-record/1`), `enqueuePlan`
  beside the unchanged synchronous `launchPlan`, S3 live progress when job
  evidence is supplied, cooperative cancel through an `AbortSignal` and
  non-terminal jobs marked `interrupted` after a process restart. Cancel never
  rolls back a committed ledger write
- automated dependency rules, a core vocabulary guard and negative core,
  module, cross-module, evaluation-adapter, SQLite-driver and Domain-Test-UI
  boundary fixtures (both "the app imports no package internal" and "nothing
  imports the app")
- 644 passing unit-suite tests across packages (93 files) exercised by
  `pnpm test:unit`, with separate conformance (69 tests, 11 files), integration
  (57 tests, 11 files) and scenario (26 tests, 7 files) gates. Counts observed
  2026-08-11
- compile-time task-name/input/output, state-projection and conformance-subject
  inference checks
- non-empty passing repository, gateway and module conformance, integration
  and scenario gates
- no published package
- no deployment

## Approved Direction

`docs/PROJECT_BRIEF.md` is the active project direction. Core must be
domain-neutral and proven with NarrativeModule and ResearchModule. ADR-0028
accepts the Evidence Integrity Workbench as the first real product POC. Its
normative boundary is
[`evidence-integrity-workbench-product-definition.md`](design/evidence-integrity-workbench-product-definition.md).
ADR-0029 selects self-hosted Supabase as POC #1's persistence platform and
requires the ACME repository adapter to target plain PostgreSQL over the wire
protocol rather than any Supabase-specific API. ADR-0030 fixes Evidence V1
identity, correction semantics and document/memory/state placement; ADR-0031
fixes the append-only review overlay, versioned primary/technical views and
Primary Product Rule; ADR-0032 fixes the conservative correction-occurrence
pairing used by state projection and account comparison. The normative
technical plan is
[`evidence-integrity-workbench-technical-specification.md`](design/evidence-integrity-workbench-technical-specification.md).
The direction, platform and implementation plan are accepted. Slices 0–5
exist for domain and product foundations: observe/relate/timeline/assessment
tasks, durable change-set attention evidence, primary views through assessment
and review history, product assessment storage and gated technical-audit views
(disabled by default). ACME-0087 completed the synthetic Slice 5 assessment/
re-review browser journey and deterministic reviewed-assessment ZIP, including
file/PostgreSQL restart proof and manual browser execution. ACME-0089 corrected
the sealed pre-late E-A01 fixture to carry no forward question references;
post-import E-A02 retains all three sealed questions.
ADR-0033 decides the PostgreSQL persistence architecture. ACME-0085 delivered
slice 7 adapters. ACME-0086 / ADR-0034 delivered the hosted shell: multi-process
composition on PostgreSQL with single-user identity, `/health`, deploy compose
and restart durability proof. SQLite and the file product store remain hermetic
defaults. ACME-0090 / ADR-0035 selected self-hosted Supabase Auth behind an
opaque product-API BFF session, product-owned organization membership and a
deny-by-default viewer/reviewer/organization-admin policy. That architecture
is implemented by ACME-0091 across the BFF, browser, identity stores and
versioned review contracts. New decisions use authenticated server-derived
principals while temporary `unauthenticated-local` history remains immutable.
The approved completion and later-product sequence is recorded in
[`evidence-integrity-workbench-product-completion-plan.md`](design/evidence-integrity-workbench-product-completion-plan.md).
Only ADR-0040's bounded Stage A judicial-text path is implemented; all other
non-synthetic classes remain unauthorized.

## Active Work

ACME-0133 ran the first outcome-blind acceptance against two real investigation
documents and returned FAIL. The integrity machinery held throughout — exact
canonical hashes, exact source binding, atomic projection, idempotent review,
fail-closed refusals, measured cost — but the product produced no usable domain
result, and none of the reasons were defects. A 1,915-page document was refused
at ingest, one call returned exactly eight candidates because eight was the
schema maximum, one refused relation removed the assessment entirely, and no
observation carried a temporal bound. Every one of those numbers was calibrated
against the synthetic corpus. The frozen report is
`docs/acceptance/ACME-0133-frozen-acceptance-report.md`.

ADR-0045 accepts the consequence: bounds are sized for the material, not for
the fixture. ACME-0134 implements its sections 2 to 4 — active observation
contract `1.7.0` with a response-derived ceiling of 64, canonical text bounds
of 16 MiB and 400,000 lines, and an assessment that proceeds from accepted
observations without requiring a relation. Historical contract versions keep
their own ceilings and replay byte-exact. ACME-0135 implements section 5: the
execution engine consumes `maxRepairCalls`, each live Evidence contract owns
its repair request, and the observation, relation and assessment jobs budget
one repair. A recoverably invalid response is corrected within budget instead
of being paid for and discarded. ACME-0137 implements section 6: observation
coverage is a windowed workflow. The planner splits a source into
non-overlapping windows of at most 64 segments. Active
`evidence.observe-artifact@1.8.0` input `/2` requires a `coverageWindow`; the
provider sees only those segments and semantics refuse a window that omits a
supplied segment or names one outside it. ACME-0138 versions the active
contract to `1.9.0` output `/5`: coverage is a `segmentCoverage` ledger
(`observations_extracted` | `no_observation`) and a segment may yield
zero or many atomic observations. The prompt forbids invented coverage
observations, extraction-time dedup and promoting reported speech to a
world fact. Raw non-normalizable time stays in `temporalBound.reason`.
Historical `@1.8.0` stays byte-exact. The live observation job iterates
windows as separate bounded executions with per-window request keys so a
committed window is not paid for again. A single window still cannot claim
document coverage. Date-only temporal bounds and the 409
ledger/relation/question views remain follow-ups.

ADR-0046 accepts the surface and pipeline direction: source chronology
and claim projection are two graphs over the same immutable occurrence.
Segmentation follows the document, not the event timeline. Observe is
Pass 1 only. The reviewer surface is three jobs (case/source stream,
claim, stance), not a type inventory. The specification and child
sequence ACME-0139–0144 are
`docs/design/evidence-workbench-source-and-claim-surfaces.md`. Nothing
in that sequence is implemented until a child is chartered. ACME-0139 implements Pass 1 empty-roster: active observe `@1.10.0` requires
a null actor when the roster is empty and refuses invented unresolved
keys. Historical `@1.9.0` stays byte-exact. ACME-0140 adds `evidence-observation-card/1`. Source review and the
ledger embed the same card; the browser renders quote, citation and
standing from it. ACME-0141 sorts `/api/text-imports` by acquired/ingest
time and titles Documents as Source stream with coverage badges;
`?view=stream` aliases that surface. ACME-0147 makes Source stream,
Claim, Stance and Search the primary nav; default signed-in entry is
the source stream. Stance groups the review queue by source title.
Source review seats observations under their block. Legacy `?view=`
routes remain. ACME-0142 adds
`evidence-source-structure/1` under `evidence-source-structure-rules/3`
and active observe `@1.11.0` input `/3`
output `/6`: new analyzes use document-native blocks plus optional
neighbour context, and context-only citations are refused. Oversized
paragraphs split at sentence boundaries toward 150–350 words (soft
600); Q+A is not split. Paragraph and answer blocks emit one segment
per sentence. Structural windows pack toward 800 words, cap 64.
Historical `@1.10.0` stays byte-exact. ACME-0143 adds the read-only claim surface:
`evidence-claim-surface-view/1` groups current occurrences by relation
scope or actor thread as unmerged 0140 cards; `?view=claim` opens it.
ACME-0144 adds relate `@1.2.0` continuity and exposure kinds
(`changes_certainty`, `prompted_by`, and siblings). Historical `@1.1.0`
stays byte-exact. The X#1 → X#2 colour example can be represented
without deleting X#1. ADR-0046 children 0139–0144 are implemented.
ACME-0145 versions source-structure rules to `/2` so a long exhibit is
not one window of giant paragraphs. ACME-0146 versions them to `/3` so
a paragraph yields one citable sentence per segment and 0..N
observations can carry distinct runtime quotes. ACME-0148 projects
heading-titled and word-budget source parts onto the stream so a
judicial extract can be opened and analyzed one part at a time.

ACME-0136 ran the second outcome-blind acceptance. source-A now imports.
Observation of source-B produced 24 accepted fragments. Repair ran on
relation and assessment and both still failed. Observation of source-A
failed as `INVALID_REQUEST`. The observation ledger, relations and
open-question views answer 409 when the product workspace revision is
ahead of the engine projection. The frozen report is
`docs/acceptance/ACME-0136-frozen-acceptance-report.md`. Result: FAIL.

POC #1 has entered its live product acceptance phase. ACME-0129 is superseded
before its acceptance run: it was frozen to prove live execution could happen
safely without uncontrolled spend, and that question is answered. ADR-0044
(Proposed) records the change. It keeps schema validation, fail-closed refusal,
revision and integrity guards, transactional mutation, idempotency, case
isolation, audit trail, provider-call logging and cost measurement, and retires
the deployment call ceiling and cost ceiling as preconditions, campaign-level
call caps, and mock or in-memory substrate as a basis for a POC claim. Bounding
one execution remains; capping a campaign does not. Cost is governed by
measurement over `acme.model_calls`. Verification separates into an offline
deterministic suite, a live integration suite and a POC acceptance run, and
only the last may claim POC #1 works.

ACME-0131 repaired the five defects that first sustained real browser session
exposed, none of which the offline suite could reach. The worker now runs the
revision guard before any product write; the live observation job selects only
the executing run's records; the evidence projection, case overview, integrity
report and export policy all resolve the requested case instead of the
composition default; and the development authenticator grants an upstream
lifetime per sign-in rather than one fixed expiry per process. Three of the
five were case-scoped reads resolving the default workspace, so ADR-0036
isolation is now enforced by the read path itself rather than by the guards
that were masking it. Every gate was proven load-bearing by reverting each fix
individually. On the running instance every case view for a real case answers
`200`, where four answered `409` and three answered `404` before.

ACME-0132 then implemented that policy. The deployment call ceiling is no
longer a precondition: absent means the deployment declines to cap the
campaign, while per-execution bounding is untouched, so a run exceeding its
confirmation is still refused. Cost became measurable in the same change,
because it had not been: `acme.model_calls` reserved `model`, `provider` and
`usage_json` columns and every row had all three `NULL`, since retention
dropped that metadata in every mode. Completed calls now retain content-free
`callMetadata` under `none`, `hash-only` and `encrypted-payload` alike, proven
on all three adapters by the shared conformance kit, with gates asserting that
no response text joins it. `summarizeModelCallUsage` summarizes recorded calls
without inventing anything: absent usage reads as `null` rather than `0`, the
summary says how much of a set its totals cover, and costs in differing
currencies are refused rather than converted. The verification tiers are
documented in `docs/CONTRIBUTING.md`, and only a POC acceptance run may claim
POC #1 works.

The `POC1-AUTO-UI` case remains wedged at product evidence revision 2 against
engine revision 5. That divergence is recorded history; the fixes prevent new
divergence rather than rewriting it, so the acceptance run needs a fresh case.
Next is ADR-0044's retirement of the deployment call ceiling and cost ceiling
plus the three-tier suite separation, then the acceptance run proposed in
`docs/backlog/poc1-live-product-acceptance.md`.

Stages 1–8 of the product completion plan are delivered. ACME-0102 accepted
ADR-0039, the workbench live model boundary. ADR-0040 now accepts one bounded
Stage A class, `stage-a-anonymized-judicial-text/1`, and the fail-closed
`evidence-poc1-live/1` profile. ACME-0105 implements the shared live-safety
primitives, Evidence confirmation parser, case-admin-only `live-model.run` and
the closed hosted capability. It requires durable PostgreSQL, hosted mode, a
live provider, a mounted durable payload key and deployment ceilings before it
exists; it releases a gateway only after case-bound authorization and Stage A
source authority. ACME-0106 adds `evidence-create-case-command/2`,
`evidence-text-import-metadata/2` and `evidence-text-import-record/2`, with
case-admin-only `source.import`, exact parent-PDF/extraction provenance and
encrypted authenticated API/browser import. Stage A case creation/import is
visible only when that capability exists. ACME-0107 adds the first callable
live operation: a case-first `observe-artifact` job hydrates the selected
canonical representation server-side, enforces exact case/source/budget
confirmation and projects validated source-bound observations only after the
durable execution commits. ACME-0108 adds a second case-first live job that
derives current observations entirely from the authorized product snapshot,
executes `relate-observations` once and atomically projects typed relations,
open questions, standing changes and one evidence-revision advance. The
ACME-0110 assessment job selects accepted current typed evidence server-side,
uses source-complete assessment input `/2`, preserves historical `/1` replay
and projects a validated assessment without changing evidence revision. The
primary product path now covers human review, later-evidence attention and an
immutable reviewed successor assessment. The default engine remains the
scripted mock and exposes none of the live routes or browser controls.

Stage A import activation proves the complete ADR-0040 composition tuple:
durable PostgreSQL, configured live provider, authorized-external source origin
and authorized-live execution. ACME-0106 proved two operator-supplied documents
through encrypted PostgreSQL import and full restart with zero provider calls.
ACME-0107 proves the observation path with an injected Responses transport: a
fault after provider success leaves no product observations, and a full
PostgreSQL composition restart completes from encrypted retained provider
evidence without a second call. ACME-0108 proves the same boundary for relation
analysis: refusal paths make zero calls, a fault after engine commit leaves no
partial product projection, and a full composition restart completes from the
retained response with the same relation/question identities and one cumulative
call. ACME-0110 proves the assessment boundary plus review/reassessment across
another imported and observed Stage A source. It also corrects Stage A revision
alignment: import owns the source evidence revision, observation verifies and
reuses it, and relation supplies the next shared engine/product revision.
ACME-0111 reached OpenAI once under a one-call run and deployment gate plus the
user's 200 SEK prepaid monetary ceiling. The 52-page source produced an
incomplete candidate at the active contract's 2,048-output-token limit; strict
JSON parsing failed, and the fail-closed path left zero engine commits and zero
product observations. ADR-0041/ACME-0112 now add active
`evidence.observe-artifact@1.2.0`: one to eight explicitly non-exhaustive
reviewer candidates, provider-wire `minItems`/`maxItems` and an 8,192-output-
token request. Both earlier contracts remain exact replay registrations.
ACME-0113 then made the separately frozen fresh call: OpenAI completed strict
JSON with six candidates and did not hit the new output bound. Every exact
quote occurred verbatim in the source, but all six model-authored line ranges
were offset, so semantic quote/locator binding correctly refused the batch and
left zero engine documents and zero product observations. The next dependency
was ADR-0042/ACME-0114. Active `evidence.observe-artifact@1.3.0` output `/2`
removes line fields from the provider schema, validates that each exact quote
occurs exactly once in the canonical artifact and derives inclusive line
locators in runtime before identity or projection. Historical `@1.0.0`–
`@1.2.0` output `/1` remains exact for replay. ACME-0115's fresh `@1.3.0` call
then returned complete strict JSON with six candidates, but schema validation
refused one time-only range (two eight-character clock values rather than full
UTC ISO timestamps). Four quotes were exact/unique; two long multi-line quotes
matched source only after whitespace normalization and remained correctly
unbound. Zero engine documents and product observations committed. The next
offline dependency was ACME-0116. Active `evidence.observe-artifact@1.4.0`
output `/3` limits exact quotes to one canonical source line and 500 characters
and explicitly instructs `unknown` unless complete dates and clocks are visible
in that quote. Historical `@1.0.0`–`@1.3.0` remain exact for replay. ACME-0117
then made one fresh `@1.4.0` call: output `/3` was complete strict JSON with
eight candidates and no invalid temporal normalization, but only three quotes
occurred exactly once. Four of the remaining candidates compressed text across
canonical line boundaries while changing whitespace and/or punctuation; one
also changed alphanumeric content. Semantic validation reported five
`EVIDENCE_QUOTE_NOT_FOUND` issues and committed zero engine documents and zero
product observations. A provider-wire one-line string does not prove canonical
line membership. ADR-0043/ACME-0118 resolve that dependency additively. Active
`evidence.observe-artifact@1.5.0` output `/4` contains `sourceSegmentId` rather
than quote text. Runtime presents deterministic non-empty, single-line source
segments of at most 500 Unicode code points, accepts only a supplied identifier
and derives the entire exact quote plus locator from that immutable segment.
Historical `@1.0.0`–`@1.4.0` and outputs `/1`–`/3` remain exact for replay.
Full-source coverage still needs a separate segmentation/coverage workflow.
ACME-0119's sole fresh `@1.5.0` call returned eight output `/4` candidates;
all selected segment IDs existed and were unique, so ADR-0043's quote boundary
held. Strict schema validation refused candidate seven because `exact.at` was a
16-character local date/time with `T` but no seconds, offset or terminal `Z`.
The other seven temporal bounds were `unknown`. One encrypted call succeeded;
zero engine documents, commits and product observations were written. The next
offline dependency is a prompt version that states the exact canonical UTC
seconds/`Z` grammar and requires `unknown` when it cannot be emitted.
ACME-0120 implements that dependency as active
`evidence.observe-artifact@1.6.0`, still output `/4`. The prompt literally
requires `YYYY-MM-DDTHH:MM:SSZ` or three-digit millisecond UTC, forbids local,
minute-only and numeric-offset normalized values, and requires `unknown`
instead. Historical `@1.5.0` remains byte-exact and registered.
ACME-0121 then made one fresh `@1.6.0` call. It stopped normally after 66,819
input and 650 output tokens with eight valid, supplied and unique output `/4`
segment selections. Strict and semantic validation passed; runtime derived all
eight exact quotes and one-line locators and durably wrote one committed
execution, document and commit plus eight product observations. The product
job returned `LIVE_OBSERVATION_COMPLETED`; the Vitest process alone exited
false because its post-commit assertion still expected the obsolete
`LIVE_OBSERVATION_COMMITTED`. ACME-0122 aligns that assertion and pins the
successful reason in an offline PostgreSQL journey. The active observation
contract therefore has real-provider product evidence, but the consumed
ACME-0121 process-level charter is superseded rather than rewritten.
ACME-0123 adds the remaining opt-in two-source Stage A reviewer acceptance
harness without adding another mock proof. It drives six separately one-call-
bounded observation/relation/assessment jobs across D1, restart, D2 and final
restart; exercises accept/reject/unresolved review; requires relations, open
questions, citation-complete assessments, stale predecessor history and a
reviewed successor; and asserts that the primary domain shell works while
technical audit stays unavailable. The harness is fully green offline and no
provider call has run through it yet.
ACME-0124 consumed the harness's first job only. D1 again produced one
committed `@1.6.0` batch with eight valid unique segment selections and eight
runtime-derived observations. The first reviewer request then failed closed
before any later provider job because ACME-0123 read `observationId` from the
primary source view instead of its public `observationVersionId` field. Zero
review decisions, relations or assessments wrote. The one-shot task was not
retried and all disposable state was removed; a bounded offline harness
correction is the next dependency.
ACME-0125 completes that dependency: the harness now consumes the exported
`EvidencePrimarySourceReviewView` type and uses its
`observationVersionId` for review/history routes. The handwritten response
shape is gone, so this mismatch is compile-time visible. All canonical offline
gates pass; no provider call occurred. A new separately frozen live journey is
the next dependency.
ACME-0126 then passed D1 observation plus all eight reviewer decisions (six
accepted, one rejected, one unresolved) and reached the real relation model.
That call returned eight propositions, four relation candidates and three open
questions, but two otherwise valid unique triggering-observation ID arrays
were not lexicographically sorted. Strict output `/1` requires sorted unique
sets; the active `@1.0.0` prompt never states that wire rule. Schema validation
failed closed, zero relations/questions/assessments wrote and four later calls
never started. A replay-compatible relation prompt version is the next offline
dependency.
ACME-0127 completes that dependency without changing output `/1` or runtime
semantics. Active `evidence.relate-observations@1.1.0` explicitly requires
unique lexicographically sorted set-like string arrays and distinct relation
endpoints sorted by kind then id. Historical `@1.0.0` remains byte-exact and
registered for replay; both request hashes are pinned and all canonical gates
pass without a provider call. A separately frozen live journey remains.
ACME-0128 closes the adjacent assessment risk before spending. Active
`evidence.propose-assessment@1.2.0` explicitly requires unique,
lexicographically sorted set-like string-ID arrays. Historical `@1.0.0` and
`@1.1.0` remain byte-exact and registered for replay; all three request hashes
are pinned and canonical gates, including fresh PostgreSQL 36/36, pass without
a provider call. A separately frozen live journey remains.
Stage B FUP material, arbitrary ingestion and excluded formats stay closed.
The remaining readiness evidence and later-class prerequisites are gathered in
[`docs/backlog/slice-9-prerequisite-checklist.md`](backlog/slice-9-prerequisite-checklist.md).

ACME-0130 corrected a second defect that made the browser client unusable past
sign-in. The shell's `casePath` exempted the case catalog by comparing the whole
argument, query string included, against `/api/cases`, so the real
`/api/cases?organizationId=…` call was rewritten into a case-scoped path and
answered `404`. The case selector stayed empty and no case could be opened,
although case creation kept working through its separately exempted route. The
exemption now matches `URL.pathname`. The defect entered with ACME-0093 and
passed through ACME-0101's parse gate, which compiles the emitted module without
exercising the URLs it builds. No product behavior, contract, persistence or
data authority changed.

ACME-0101 corrected a defect that made the browser client unusable: the shell
rendered an unterminated string literal, so the whole module failed to parse
and no handler was bound, including sign-in. It entered with ACME-0097 and
shipped undetected through ACME-0098 to ACME-0100 because the shell test only
matched substrings in the rendered HTML. The shell test now compiles the
emitted browser module.

ACME-0100 implements Stage 8. `buildEvidenceAssessmentOutputDocument` resolves
one reviewed assessment into a citation-complete document and refuses anything
it cannot bind to an exact source-bound observation. Four renderers read that
single document, so JSON, Markdown, DOCX and PDF cannot drift apart, and each
repeats byte-identically. `evidence-export-policy/1` governs release per case
with an enable flag and format allowlist; `evidence-export-audit-record/1`
records every release and refusal with a generated per-event identity;
`evidence-product-backup-manifest/1` plus its restore verification mirror the
artifact-level pair from ADR-0037. File and PostgreSQL adapters persist both
record kinds under migration v7.

ACME-0099 implements Stage 7 as pure read models over one authorized case
snapshot. `buildEvidenceCaseOverview` counts sources, pending observations and
relations, open questions and assessments needing re-review, and lists at most
twenty most-recent product activity records. `buildEvidenceCaseIntegrityReport`
classifies reviewed relations from typed canonical evidence — never from
model-authored rationale text — and every row carries at least one citation
naming the observation, artifact version, locator and exact quote behind it.
`/api/overview` and `/api/integrity-report` are case-first and deny-by-default;
the browser opens on the overview and each report citation opens its exact
source lines.

ACME-0097 implements ADR-0038 after ACME-0096 accepted it. An authenticated
case reviewer can import one strictly bounded, attested synthetic UTF-8
`text/plain` document through the case-first browser/API. The exact received
bytes and canonical LF/NFC text become separately encrypted immutable objects;
durable command/staging records support exact resubmission and cooperative
pre-activation cancellation. Reviewers can save exact byte-range redaction
drafts and case admins can apply them as new immutable source versions with
append-only content-free logs. File restart and PostgreSQL migration v5 retain
the records. PDF/DOCX/OCR/media and non-synthetic content remain prohibited.

ACME-0095 implements Stage 4's secure artifact architecture after ACME-0094
accepted ADR-0037. Existing synthetic source bytes now pass through immutable
canonical representations, AES-256-GCM envelopes, controlled filesystem or
server-side S3-compatible storage, versioned KEK wrapping, atomic metadata,
case-scoped reconciliation, revisioned deletion tombstones and content-free
product audit. Any non-synthetic path still requires bounded ingestion,
redaction and Slice 9 readiness.

### Recent completed work (summary)

- **ACME-0112 through ACME-0118:** Versioned the observation contract as a
  bounded one-to-eight non-exhaustive batch with 8,192 output tokens while
  retaining historical replay. The subsequent sole real call returned
  complete strict JSON with six verbatim source quotes, proving truncation was
  removed, but every model-authored line range was offset. Runtime semantic
  validation refused all six and committed nothing. ADR-0042/ACME-0114 now
  remove locator fields from active output `/2`, require one exact source
  occurrence and derive canonical line ranges in runtime while retaining all
  historical request/output contracts for replay. ACME-0115's subsequent sole
  call exposed time-only normalized ranges and two whitespace-normalized long
  multi-line quotes; strict schema/exact binding again committed nothing.
  ACME-0116 adds active `@1.4.0` output `/3` with provider-wire single-line/
  500-character quote constraints and an explicit full-date temporal rule.
  ACME-0117 returned complete strict output with eight candidates and avoided
  the temporal schema defect, but five one-line strings were not verbatim
  canonical source substrings. Exact runtime binding again refused the whole
  batch and committed nothing. ADR-0043/ACME-0118 now remove quote text from
  active output `/4`: the provider selects a runtime-defined bounded segment
  and runtime derives quote, line locator and identity while preserving all
  five historical contracts.
- **ACME-0110:** Completed the Stage A engineering journey through reviewed
  reassessment. Additive source-complete assessment input, command/job/audit
  contracts and browser/API/worker execution preserve historical synthetic
  replay, one-call encrypted resume and product evidence revision. PostgreSQL
  proof covers refusal, post-engine interruption, process restart, human review,
  later evidence attention and an immutable reviewed successor. ACME-0109 was
  superseded before code because its charter incorrectly required assessment
  proposal to advance evidence revision.
- **ACME-0108:** Added the bounded Stage A live relation job. The authenticated
  case-first API derives all current observations and source authority on the
  server, executes the existing strict relation task once, and atomically
  projects relations, open questions, standing changes and one revision. The
  primary browser can launch and poll the job; PostgreSQL restart proof covers
  post-engine interruption, retained-response resume and stable identities
  without a second provider call. Real paid acceptance remains external.
- **ACME-0107:** Added the bounded Stage A live observation job. Additive
  command/job/audit contracts, authenticated case-first API, source-analysis
  browser control and durable worker enforce one call, content-free control
  records and server-side source/identity resolution. Injected-transport and
  PostgreSQL restart proofs cover refusal, budget, case isolation, post-commit
  interruption and zero-call resume. Live assessment and the real paid
  acceptance remain subsequent dependencies.
- **ACME-0106:** Implemented bounded Stage A judicial-text import. Added
  additive case/import/provenance contracts, case-policy matching,
  case-admin-only source import, capability-gated API/browser controls and
  file/PostgreSQL restart/isolation proofs. A disposable PostgreSQL acceptance
  imported two fully inspected operator-supplied PDFs as prepared UTF-8 text,
  retained their parent and extracted hashes, reopened identical records and
  sources, and made zero provider calls. PDF bytes and extracted text never
  entered Git.
- **ACME-0105:** Implemented the fail-closed POC #1 live composition boundary.
  `@acme/live-safety` now supplies credential, opt-in and nested-budget
  primitives shared with the Domain Test UI. The Evidence API adds strict
  `evidence-live-confirmation/1`, the four-part live resolver, durable hosted
  payload-key configuration and an OpenAI gateway factory released only after
  case-admin/source authority. The callable job/browser path remains next.
- **ACME-0104:** Accepted ADR-0040. It distinguishes permanent
  evidence/security/review invariants from synthetic-phase controls, authorizes
  only anonymized real judicial UTF-8 text for Stage A, separates later Stage B
  FUP material and requires a typed four-part live composition that fails
  closed. This documentation checkpoint does not implement or activate the
  live path.
- **ACME-0103:** Corrective. Modernized the PostgreSQL restart durability test
  to ADR-0036 case-first routing after CI surfaced it as broken. The breakage
  dated from `9037ca1` and had been invisible because no session had ever run
  `pnpm test:postgres`; this task ran it against a real `postgres:15` for the
  first time — 34 tests from a clean database, covering migration v7 and the
  export-policy and export-audit write paths. Also bounded a load-sensitive
  timeout flake in the local blackbox suite. No product behavior changed.
- **ACME-0102:** Accepted ADR-0039, the workbench live model boundary. It fixes
  a case-bound `evidence-live-confirmation/1` with no actor field,
  environment-only credentials, a run ceiling capped by a deployment ceiling,
  `encrypted-payload` retention, content-free live audit, failure semantics and
  the refusal matrix the implementation must prove. All three evidence tasks
  are permitted live because the trust pipeline is gateway-independent. It is
  documentation-only, grants no data authority and leaves Slice 9 closed.
- **ACME-0101:** Corrective. Repaired the browser shell's unterminated string
  literal, which had made the entire client fail to parse, and added a gate
  that compiles the emitted module instead of only matching substrings in it.
  No product behavior, contract or data authority changed.
- **ACME-0100:** Implemented Stage 8. Added the `evidence-assessment-output/1`
  document and four deterministic renderers (JSON, Markdown, DOCX, PDF) with no
  new dependency, a per-case export policy with a format allowlist,
  append-only export-audit records for every release and refusal, a product
  backup manifest with fail-closed restore verification, file/PostgreSQL
  persistence with migration v7 and shared conformance, case-first API routes
  and browser download surfaces. It adds no data authority.
- **ACME-0099:** Implemented Stage 7. Added `evidence-case-overview/1` and
  `evidence-case-integrity-report/1` contracts and pure builders, case-first
  `/api/overview` and `/api/integrity-report` routes, browser overview and
  integrity views whose citations open exact source lines, and builder tests
  pinning classification, counts, citation resolution, input-order-independent
  identities and basis sensitivity. It writes nothing, adds no persistence and
  changes no data authority.
- **ACME-0098:** Implemented Stage 6 reviewer operations and case search:
  durable assignment/reassignment, comments, append-only activity, atomic
  single and bounded bulk decisions, effective work status, deterministic
  bounded search, file/PostgreSQL persistence with migration v6 and the
  My review work/Search browser views.
- **ACME-0097:** Implemented bounded synthetic text ingestion and immutable
  redaction. Added strict validators and pinned transforms, additive imported
  logical-artifact identity, two independently encrypted representations,
  durable idempotent import/redaction records, file/PostgreSQL conformance,
  case-first API/browser flows, cancellation, restart and source-navigation
  proofs. The Slice 9 gate is unchanged.
- **ACME-0096:** Accepted ADR-0038. It pins the only Stage 5 input class and
  limits, exact original/canonical activation, version/locator identity,
  reviewer/admin authorization, durable jobs, exact UTF-8 byte-range redaction,
  append-only logs, export semantics and failure/isolation proof matrix. It is
  documentation-only and changes no data authority.
- **ACME-0095:** Implemented ADR-0037 for the fixed synthetic corpus. Added
  strict artifact/envelope/staging/lifecycle/audit/backup contracts, envelope
  encryption and exact staged retry, filesystem and SigV4 S3-compatible object
  adapters with shared conformance, file/PostgreSQL metadata, authenticated
  read/export/admin audit, startup reconciliation, KEK re-wrap, revisioned
  tombstoned deletion and isolated restore verification. Hosted startup now
  requires mounted keys and private S3 configuration; arbitrary input remains
  absent.
- **ACME-0094:** Accepted ADR-0037. Original, canonical and later derivative
  bytes are immutable case-owned representations behind a provider-neutral
  object-store port. Hosted storage uses server-only Supabase S3 compatibility;
  every object is application-encrypted with a per-object DEK and versioned
  KEK, partial writes reconcile through staging/quarantine, and plaintext reads
  require a successful content-free security-audit append. No data authority
  changed.
- **ACME-0093:** Implemented ADR-0036. Authenticated case creation/catalog,
  metadata, archive/restore and participant APIs use optimistic revisions;
  case-viewer/reviewer/admin membership controls evidence access. Immutable
  case-object bindings scope file/PostgreSQL repositories, worker jobs,
  citations and exports. Known-ID and mixed-reference black-boxes prove
  same-organization cross-case non-disclosure. The legacy corpus is reconciled
  into one explicit synthetic case.
- **ACME-0092:** Accepted ADR-0036. Product cases become the public security
  boundary over uniquely bound internal workspaces; explicit case membership,
  immutable case-object ownership and case-first repository/worker traversal
  are mandatory. Same-organization adversarial isolation remains an executable
  implementation obligation and the synthetic-only barrier stays closed.
- **ACME-0091:** Implemented ADR-0035. Hosted credentials use self-hosted
  Supabase Auth behind opaque protected product sessions. All current product
  routes enforce typed organization authorization, browser actor fields are
  rejected and authenticated `/2` review decisions retain exact policy
  context. Hermetic proofs pass; live Supabase and PostgreSQL proofs remain
  explicit environment-gated checks.

- **ACME-0090:** Accepted ADR-0035. Hosted credentials use self-hosted
  Supabase Auth, while the product API owns an opaque HttpOnly BFF session and
  derives stable principals from verified issuer/subject claims. Product-owned
  organizations, workspace bindings and viewer/reviewer/organization-admin
  roles authorize typed actions deny-by-default. Existing unauthenticated
  review history remains immutable; ACME-0091 implements the decision.

- **ACME-0086:** Delivered Evidence Integrity slice 8 hosted shell. ADR-0034
  fixes single-user hosted identity (no Supabase Auth). Deploy compose under
  `deploy/evidence-workbench/`, ops notes, health endpoint, and gated PostgreSQL
  restart black-box proving product review decisions survive process reopen.

- **ACME-0085:** Delivered Evidence Integrity slice 7. `@acme/adapter-postgres`
  implements the aggregate `ExecutionRepository` and `QualityEvaluationStore`
  over schema `acme` with injected `pg.Pool`, advisory-locked migrations,
  SQLSTATE driver mapping, `READ COMMITTED` Unit of Work, CAS state/memory
  writes, atomic `FOR UPDATE SKIP LOCKED` outbox leasing and repeatable-read
  multi-statement reads. `@acme/adapter-evidence-product-postgres` implements
  the product store over schema `evidence`. Roles/revocation SQL, schema-per-test
  gated suite (`pnpm test:postgres`), CI postgres job, CLI `--adapter postgres`
  and workbench `ACME_PERSISTENCE=postgres` composition, and
  `docs/ops/postgresql-operations.md` are included. Environment facts: PG 15,
  direct port 5432, never transaction pooler 6543.

- **ACME-0084:** Delivered ADR-0033, the PostgreSQL persistence architecture,
  closing ADR-0029's two open items and slice 7's remaining prerequisite. It
  decides driver and pool ownership, `acme`/`evidence` schema separation with no
  cross-schema foreign key or transaction, `READ COMMITTED` with
  conditional-update compare-and-swap, `FOR UPDATE SKIP LOCKED` outbox leasing,
  canonical values as `text` for byte fidelity, per-schema migration ledgers
  with an advisory lock, SQLSTATE error classification, connection lifecycle,
  an ephemeral plain-PostgreSQL verification environment with schema-per-test
  isolation, and one instance per data classification rather than per POC. It
  adds three gates to slice 7 and refuses `jsonb`, `timestamptz` and
  `SERIALIZABLE` with recorded reasons. No code was added.

- **ACME-0083:** Delivered Evidence Integrity slice 6: technical provenance and
  replay view contracts/builders and API routes gated by
  `technicalAudit.enabled` (default off). Primary black-box remains unchanged
  when audit is disabled.

- **ACME-0087/0089:** Completed Evidence Integrity slice 5's product journey:
  assessment/review-history views, durable late-evidence attention, bounded
  API/worker/browser assessment and re-review, exact locator navigation,
  deterministic reviewed ZIP, file/PostgreSQL durability and the corrected
  source-bound E-A01/E-A02 fixture sequence.

- **ACME-0082:** Delivered Evidence Integrity slice 5 domain core:
  `evidence.propose-assessment@1.0.0`, attention-tier and change-set helpers,
  deterministic synthetic-only assessment export, product assessment storage
  and sealed E-A01/E-A02 fixtures. ACME-0087/0089 subsequently completed and
  corrected the full late-import product journey; technical audit stays
  disabled by default.

- **ACME-0081:** Delivered Evidence Integrity slice 4: pure
  `evidence.build-timeline@1.0.0` / temporal-overlap helper, primary timeline
  and open-question views, API/web navigation. No assessment or live path.

- **ACME-0080:** Delivered Evidence Integrity slice 3: model-backed
  `evidence.relate-observations@1.0.0`, sealed eight-relation and three open-
  question golden gate, contest standings for changed accounts, product
  relation/open-question storage, primary relation-review view and evaluation
  seed with technical audit still disabled. No timeline, assessment or live
  provider path was added.

- **ACME-0079:** Delivered Evidence Integrity slice 2: an offline sealed
  evaluation harness, exact correction supersession with eight current and two
  superseded immutable observations, primary observation-ledger and
  account-comparison views, and a browser-visible evaluation seed. No general
  relation analysis, live provider or non-synthetic path was added.

- **ACME-0078:** Delivered Evidence Integrity slice 1: one offline source-first
  reviewer path over `DEV-T01`, exact source/actor/time validation, stable
  observations, durable product review decisions, pure primary views and
  replay/resume proof with one deterministic mock call. No live provider or
  later Evidence slice was added.

- **ACME-0077:** Delivered Evidence Integrity slice 0: deterministic corpus,
  contract/identity/state foundation, test-support package, sealed-truth guard
  and offline golden/conformance proof. No model-backed task or product UI was
  added.

- **ACME-0017–0023:** Narrative and Research reference modules, offline Phase 5
  scenarios, ExecutionEngine (ADR-0012), SQLite durability (ADR-0013).
- **ACME-0025–0027:** OpenAI Responses adapter behind a transport port, CLI
  composition root (mock gateway only), ScenarioRunner over `acme-scenario/1`.
- **ACME-0028–0029:** `fetch` transport, opt-in live gate, schema lowering
  (ADR-0015), live success for both reference contracts under strict structured
  output.
- **ACME-0030:** Encrypted-payload retention (ADR-0016) with injected
  `PayloadEncryptor`, ciphertext at rest, decrypt-on-replay when the key works.
- **ACME-0031–0032:** Documentation reality sync after the live work, then the
  CLI live OpenAI gateway (`acme execute --gateway openai`).
- **ACME-0033:** Durable execution resume (ADR-0017): an interrupted execution
  completes from its recorded model call without a second provider call, with
  classified terminal refusals where the evidence is insufficient.
- **ACME-0034:** Milestone 2 durability and concurrency proofs: a fault inside
  `commit()` leaves no partial state on either adapter, a driver-level fault
  rolls back across a real reopen, and two writers against one revision yield
  exactly one commit.
- **ACME-0035:** Outbox delivery boundary (ADR-0018): claim, deliver and
  settle through an explicit bounded drain, with at-least-once semantics and
  an `acme outbox` command.
- **ACME-0039:** Domain Test UI activation (ADR-0019): gate freezes accepted,
  `apps/test-ui` boundary enforced in both directions, and phase-1 view
  contracts for S4–S7 proven over handcrafted fixtures and over evidence a
  real offline engine run recorded.
- **ACME-0040:** Domain Test UI phase 2: the `acme-view-catalog/1` surface over
  registries, discovered scenarios and fixtures and declared adapter kit
  targets, with bounded traversal-refusing Node discovery on a separate entry
  point and the repository's own scenario tree discovered under test.
- **ACME-0041:** Domain Test UI phase 3 (ADR-0020): `acme-test-plan/1`, a
  strict validator that refuses before emitting, and a pure deterministic
  compiler whose output reaches the pinned Narrative Phase 5 digest through
  the existing runner.
- **ACME-0042:** Domain Test UI phase 4 (ADR-0021): the S2 designer, the S3
  console and history, an interface-owned workspace whose index is derived
  from its records, an app composition and a synchronous `launchPlan`, proven
  by an end-to-end configure-launch-find-inspect test.
- **ACME-0043–0045:** measurement and fixture review (ADR-0022), gated live
  single-execute evaluation (ADR-0023), and the loopback S3/S4 HTML workbench
  (ADR-0024).
- **ACME-0046:** protected browser-side offline plan preview and launch: S2
  renders the compiled canonical scenario, launch reuses `launchPlan`, and the
  recorded result links through S3 to durable S4 evidence when configured.
- **ACME-0047:** S1 browser catalog over the existing static registries,
  runner validator and bounded scenario/fixture discovery, with full contract
  fingerprints, broken references and unavailable sections kept visible.
- **ACME-0048:** S5 browser memory-decision inspector over durable replay
  evidence, linked from S4 with ordered candidate → decision → mutation cards,
  explicit absence/correlation states and payloads redacted by default.
- **ACME-0049:** S6 browser state inspector over repository snapshot evidence,
  linked from S4 with ordered revision lineage, explicit continuity and
  transition absence, and state/delta payloads redacted by default.
- **ACME-0050:** S7 browser replay inspector over the existing replay engine,
  linked from S4 with exact engine verdicts, digest comparison and redacted
  diagnostic differences; replay is guarded against provider calls and makes
  no canonical write.
- **ACME-0051:** S8 browser measurement over workspace run records, with
  separate deterministic/live rate cards, request-local thresholds, explicit
  stored-baseline selection and refusal when unreadable records would silently
  shrink the evidence set.
- **ACME-0052:** S9 browser fixture review with request-local proposals tied to
  recorded run/execution provenance, CSRF-protected named decisions,
  append-once approval history and an explicit never-applied repository-edit
  instruction.
- **ACME-0053:** S10 browser live evaluation with live-only history, explicit
  process and per-run confirmation gates, protected single-execute launch and
  no credential field or value in browser/workspace artifacts.
- **ACME-0054:** `@acme/evaluation`, deterministic and recorded-external
  evaluators, immutable content-derived identities, append-only in-memory
  storage and ScenarioRunner v2 quality evaluation/assertion steps (ADR-0025).
- **ACME-0055:** Governing-document reality audit plus a repository-derived
  Swedish presentation, whitepaper and technical system document under
  `hrd/`. These are editable explanatory artifacts; Markdown sources and ADRs
  remain authoritative.
- **ACME-0056:** Gap-resolution plan (`docs/design/gap-resolution-plan.md`)
  with G01–G19 and work packages WP-D through WP-X.
- **ACME-0057:** SQLite driver-error classification (G05 / D1): busy/locked →
  `PERSISTENCE_TRANSIENT`; corruption/constraint → `PERSISTENCE_CORRUPTION`;
  unknown → `INTERNAL` AcmeError.
- **ACME-0058:** Stranded execution list/discharge (G06 / D2): pure core
  classifier and CLI operator commands over ledger evidence.
- **ACME-0059:** Outbox redrive for terminal `failed` entries (G04 / O1):
  repository port, both adapters, `redriveOutbox` coordinator and CLI.
- **ACME-0060:** Outbox inspect growth summary and `--max-pending` /
  `--max-failed` alarms (G03 / O4).
- **ACME-0061:** File `OutboxDispatcher` transport for CLI drain
  (`acme-outbox-file-delivery/1`, `--transport file --outbox-dir`).
- **ACME-0062:** Narrative observe-document emits
  `narrative.document-observed` (updates Phase 5 operation digest pin).
- **ACME-0063:** Plan/scenario model pin (`execute.model`, plan `model`).
- **ACME-0064:** ScenarioRunner live multi-step (`gateway: openai`,
  offline injected transport + opt-in live gate).
- **ACME-0065:** Durable SQLite quality evaluation store (Q1, ADR-0026).
- **ACME-0066:** CLI quality list/inspect over composition quality store (Q2).
- **ACME-0067:** Pure Test UI quality evaluation list/detail view S11 (Q3).
- **ACME-0068:** Live-model quality judge + `quality judge` CLI (Q4).
- **ACME-0069:** Async launch, progress and cancellation (T1 / G08, ADR-0027):
  in-process JobRunner, `acme-job-record/1`, `enqueuePlan` beside synchronous
  `launchPlan`, S3 progress, `POST /s3/<runId>/cancel`.
- **ACME-0070:** Documentation reality sync after ACME-0057–0069.
- **ACME-0071:** English OpenAI/FDE project presentation and matching PDF,
  derived from the governing Markdown documents and accepted ADRs, with
  repository-backed slide notes and complete visual verification.
- **ACME-0072:** Markdown counterpart to the OpenAI/FDE presentation, retaining
  its narrative, evidence, maturity caveats, diagrams and repository source
  map in a plain-text format.
- **ACME-0073:** First-POC product and technology discovery report. It compares
  three candidate wedges, recommends an evidence-to-decision workbench as the
  leading hypothesis, separates SQLite's current adapter compatibility from
  PostgreSQL's hosted-product fit, and defines communication, ownership,
  scaling, metrics and decision gates without activating implementation.
- **ACME-0074:** Accepted Evidence Integrity Workbench as POC #1 in ADR-0028
  and a normative product definition. V1 uses a synthetic corpus, distinguishes
  source observations from propositions and legal conclusions, preserves
  changed accounts, requires source locators and human review, prohibits
  credibility/guilt/legal-sufficiency decisions, and keeps Research Synthesis
  as the intended POC #2. No code or real-data authorization was added.
- **ACME-0076:** Delivered the Evidence Integrity Workbench technical
  specification plus ADR-0030 and ADR-0031. It freezes the bounded synthetic
  corpus contract, Evidence identity and placement, product/reviewer view
  boundary, proof matrix and local-first implementation slices without adding
  code, provider calls or real-data authority.

### Domain Test UI (phases 0–6 and S1–S10 browser flow delivered)

[`Domain Test UI — Specification`](design/domain-test-ui-specification.md) is
activated. ACME-0039 accepted the seven proposed gate freezes in
[ADR-0019](adr/0019-domain-test-ui-boundary-and-view-contracts.md) and
delivered phase 0 (package boundary) and phase 1 (read model over recorded
evidence). One deviation is recorded rather than hidden: S7 uses the engine's
exact `match | different | unavailable` vocabulary and adds no `forked`
outcome, because the engine cannot produce one.

Delivered by ACME-0039: `apps/test-ui`, four versioned view contracts for
S4–S7, pure builders, redaction and retention presentation rules, and boundary
fixtures in both directions.

Delivered by ACME-0040 (phase 2): `acme-view-catalog/1` for S1 over the static
registries, discovered scenarios and fixtures, and caller-declared adapter kit
targets, plus bounded Node discovery on a separate entry point.

Delivered by ACME-0041 (phase 3): `acme-test-plan/1` and `compileTestPlan`
under ADR-0020, which discharges the gate-3 ADR requirement.

Delivered by ACME-0042 (phase 4, ADR-0021): the S2 designer, the S3 console
and history, an interface-owned file workspace, an app composition and
`launchPlan`. A plan can now be previewed, launched and inspected offline
without the CLI.

Delivered by ACME-0043 (phase 5, ADR-0022): `acme-view-measurement/1` (S8)
over recorded run records with sample sizes, optional thresholds and optional
baselines, and `acme-view-fixture-review/1` (S9) with mandatory approver and
rationale, producing a described reviewable change rather than a fixture
write. Workspace stores `baselines/` and `approvals/` beside `runs/`.
Deterministic and live series are partitioned.

Delivered by ACME-0044 (phase 6, ADR-0023): `acme-view-live-evaluation/1`
(S10), pure `acme-live-confirmation/1` gate, and `launchLiveExecution` on the
local entry point. Live requires `ACME_TEST_UI_LIVE` plus confirmation
(confirmer, rationale, budget); credentials stay in the environment. Single
ExecutionRequest path (not multi-step ScenarioRunner). Offline transport tests
prove the path without network.

Delivered by ACME-0045 (ADR-0024): localhost workbench shell with pure HTML
renderers for S3 and S4, stub navigation for other surfaces, loopback-only
HTTP serve (`startWorkbenchServer` / `workbench-main`). Not full SPA polish.

Delivered by ACME-0046: the pure S2 renderer and a bounded YAML/JSON form flow
with CSRF and same-server checks, a fixed body limit, safe run identifiers and
an explicitly configured scenario root. Offline launch reuses synchronous
`launchPlan`, refuses duplicate run ids, redirects to S3, reaches S4 for a
configured SQLite ledger and describes memory-run evidence honestly as
non-durable.

Delivered by ACME-0047: the pure S1 catalog renderer plus `/s1` and
`/api/catalog`. The loopback process composes the existing Narrative and
Research registries, `parseScenario` and bounded `discoverCatalogSources`
under the process-configured scenario root. Full fingerprints, invalid
scenarios, missing/refused references, orphan fixtures, diagnostics and
unavailable sections remain explicit; no browser path input exists.

Delivered by ACME-0048: the pure S5 memory-decision renderer plus
`/s5?executionId=...` and `/api/memory-decisions?executionId=...`. S4 carries
the exact execution id into the new view; the route reads the repository's
durable replay evidence, preserves recorded counts and decision order, keeps
ignored/missing/unattributed evidence visible, and never enables payload
disclosure or memory mutation.

Delivered by ACME-0049: the pure S6 state renderer plus
`/s6?namespace=...&entityId=...` and
`/api/state?namespace=...&entityId=...`. S4 carries the exact namespace/entity
scope into the new view; the route reads repository snapshot evidence,
preserves builder-owned revision ordering/counts/continuity, distinguishes an
empty lineage from unavailable evidence, and never enables payload disclosure
or state mutation.

Delivered by ACME-0050: the pure S7 replay renderer plus
`/s7?executionId=...` and `/api/replay?executionId=...`. S4 carries the exact
execution id into read-only `replayVerify`; a fail-closed gateway proves the
path cannot contact a provider. The renderer copies the engine's exact
`match | different | unavailable` verdict, delegates digest comparison to
  `buildReplayView`, keeps diagnostic values redacted and persists no report or
  canonical effect. Programmatic server composition may receive an injected
  payload encryptor; the command-line workbench acquires no key itself.

Delivered by ACME-0051: the pure S8 measurement renderer plus `/s8` and
`/api/measurement`. Both aggregate every readable workspace run through
`buildMeasurementView`, keep deterministic and live records separate, accept
only request-local finite `0..1` min/max thresholds and optionally load one
existing safe-named baseline. An absent baseline makes no comparison; a named
missing/unreadable baseline is refused. Any unreadable run record refuses the
whole measurement so the denominator cannot shrink silently. The route writes
nothing and performs no provider call.

Delivered by ACME-0052: the pure S9 fixture-review renderer plus `/s9`,
`/api/fixture-review` and protected `/s9/decision`. A complete proposal is
request-local and must point to an existing workspace run/execution; no
proposal file is invented. Approval/rejection reuses `decideFixtureChange`
and stores only `acme-fixture-approval/1`. Existing, conflicting, unreadable
or concurrent proposal ids cannot be overwritten. Decided history is rebuilt
from approval records, remains `applied: false` and never reads or writes the
fixture.

Delivered by ACME-0053: the pure S10 live-evaluation renderer plus `/s10`,
`/api/live-evaluation` and protected `/s10/launch`. The page shows only
non-mock run records, explicit confirmation/cost absence and every unreadable
run filename. Launch accepts exactly one `ExecutionRequest`, reuses the
ADR-0023 process + named confirmation + budget gate, reads credentials only
inside the local process and refuses unsafe, existing, unreadable or active
run ids before provider dispatch. Test-only injection proves the complete HTTP
path offline; the command-line workbench still uses the real env/fetch path.

Delivered by ACME-0069 (ADR-0027): async launch. The workbench process owns an
in-process single-flight JobRunner, the interface workspace gains
`jobs/<jobId>.json` (`acme-job-record/1`), and browser launch enqueues through
`enqueuePlan` so the HTTP response returns before the scenario finishes.
Synchronous `launchPlan` is unchanged for scripts and tests. S3 renders live
progress when the host supplies job evidence and still reports
`RUN_PROGRESS_UNAVAILABLE` for pure history-only callers. Cancel is
`POST /s3/<runId>/cancel` under the same CSRF and same-server proof and is
cooperative: it does not roll back a committed ledger write. A process restart
marks non-terminal jobs `interrupted`.

Not delivered: remote hosting; browser CI (T4); a plan `measurements` block
(T2); adapter discovery beyond declaration (T3). Multi-step live scenarios run
through ScenarioRunner `composition.gateway: openai` (ACME-0064); S10 remains
single-execute by decision (ADR-0023). Proposal:
`docs/backlog/domain-test-ui-implementation.md`. A non-authority visual mock
lives under `docs/concepts_sandbox/temp/`.

### Post-execution quality evaluation

Delivered by ACME-0054 (ADR-0025): `@acme/evaluation` accepts an immutable
`acme-quality-subject/1` bound to an exact run, execution, artifact and
contract. A static registry runs named deterministic evaluators or replays an
exact `acme-recorded-quality-evaluation/1`; both produce structured scores,
findings and a `pass | fail | inconclusive` verdict. Content-derived subject,
result and evaluation identities include evaluator id/version and refuse
collisions or mismatched recordings.

The result is stored separately as `acme-quality-evaluation/1`. The in-memory
adapter is append-only, idempotent for byte-identical content, returns detached
records and has a reusable conformance kit. Execution evidence remains
unchanged. `acme-scenario/2` adds `evaluate` and `assertEvaluation` while the
v1 parser and behavior remain compatible. A failed quality verdict is a
successful evaluation step; only an explicit assertion fails the scenario.
All evaluation paths reachable from the synchronous harness are deterministic
offline, and no evaluator may perform a live external call through that
contract.

Delivered by ACME-0065 (ADR-0026): the durable SQLite store. Migration v2 adds
an append-only `quality_evaluations` table with no foreign key to executions,
`createSqliteQualityEvaluationStore` implements the same
`QualityEvaluationStore` port as the in-memory adapter, the shared conformance
kit passes unchanged, and close/reopen preserves records.

Delivered by ACME-0066–0068: `acme quality list`, `acme quality inspect` and
`acme quality judge` over the composition-selected store (memory or the same
SQLite file); the pure `acme-view-quality-evaluation/1` list/detail view (S11)
in `apps/test-ui`; and `runLiveModelQualityJudge`, a live-model judge that runs
outside the synchronous harness — which still refuses Promise-returning
evaluators — stores `kind: live-model`, requires `ACME_LIVE_TEST` plus
credentials, and is proven offline through an injected OpenAI transport.

## Persistent Gaps

Ordering, dependencies and activatable slices live in
[`docs/design/gap-resolution-plan.md`](design/gap-resolution-plan.md)
(ACME-0056). IDs below match that plan (G01–G19).

- **G01/G02 — ScenarioRunner live multi-step:** **Closed by ACME-0064.**
  `composition.gateway: openai` plus execute `model` (and optional
  `liveGateway` injection) run serial multi-step scenarios live; offline
  injected-transport proof and opt-in `tests/live/scenario-multi-step.test.ts`.
  Operator live success 2026-08-06: both `openai-responses` and
  `scenario-multi-step` green under `pnpm test:live` (model `gpt-5.6-luna`;
  evidence in local gitignored `live_test.log`). S10 remains single-execute
  (ADR-0023).
- **G03 — Nothing drains the outbox automatically.** A composition root must
  call the drain (ADR-0018; library auto-drain rejected). **Growth alarm closed
  by ACME-0060:** `outbox inspect` reports status counts and optional
  `--max-pending` / `--max-failed` thresholds. Host drain remains external.
- **G04 — Outbox residuals:** **Closed for WP-O core path.** Redrive
  (ACME-0059), file transport (ACME-0061), and Narrative
  `narrative.document-observed` emission (ACME-0062) make real outbox traffic
  end-to-end. Research still emits no domain events (optional later).
- **G05 — Driver error classification:** **Closed by ACME-0057.** The SQLite
  adapter maps busy/locked codes to retryable `PERSISTENCE_TRANSIENT` and
  corruption/constraint codes to non-retryable `PERSISTENCE_CORRUPTION`;
  unknown failures become `INTERNAL` AcmeErrors (never raw driver throws).
  See `docs/backlog/driver-error-classification.md` (resolved).
- **G06 — Stranded executions:** **Closed by ACME-0058.** Core
  `listStrandedExecutions` / `prepareOperatorDischarge` plus CLI
  `execution stranded` and `execution discharge --by --rationale` inventory
  open and terminal stranded rows and discharge open ones via `markTerminal`
  with operator audit in error details (no invented model outcomes).
- **G07 — Domain Test UI workbench (ACME-0045–0053) delivered.** Phases 0–6
  delivered S1–S10 as JSON contracts. Loopback HTML covers S1–S10 (catalog,
  offline plan preview/launch, durable memory/state inspection, replay,
  measurement, fixture review, gated single-execute live). CI still uses
  CLI/`pnpm` gates, not the browser. **Accepted** as intentional; optional
  browser CI is T4 only. → accept / WP-T optional
- **G08 — Launching blocks its caller:** **Closed by ACME-0069 / ADR-0027.**
  Synchronous `launchPlan` remains for blocking callers. Workbench HTTP launch
  uses in-process `enqueuePlan` / JobRunner with interface-owned
  `acme-job-record/1` files, S3 live-progress when job evidence is supplied,
  and cooperative cancel via AbortSignal (no ledger rollback of commits).
- **G09 — Plans cannot pin a model:** **Closed by ACME-0063.** Case-level
  `model` on `acme-test-plan/1` compiles to `execute.model`; materialization
  prefers plan model over mockResponse selection. Live plans may use
  `composition.gateway: openai` with model and without mockResponse.
- **G10 — `measurements` is not in `acme-test-plan/1`.** S8 (ACME-0043)
  measures recorded runs with thresholds supplied at measurement time; the
  plan format still rejects a `measurements` block (ADR-0020). Embedding
  thresholds in the plan would be a separate charter. → WP-T
- **G11 — Adapter targets are declared, not discovered.** Nothing in the
  workspace registers adapter implementations; the CLI composition root
  hard-codes them. The catalog therefore renders targets a caller declares and
  only validates the kit name, so a workspace adapter nobody declares is
  invisible to it. → WP-T (or accept declaration-only)
- **G12 — Trust pipeline granularity.** `preparing-commit` owns the memory,
  projection and state substages, and a failure there reports `reached` for
  all three because the recorded error does not name one. Finer resolution
  requires the engine to record finer evidence, not the interface to guess.
  → WP-E
- **G13 — Model parameter capability:** some models (e.g. `gpt-5.6-terra`)
  reject `temperature` after accepting the schema. Reference contracts no
  longer emit a default `temperature` (ACME-0037); core and the OpenAI adapter
  already treat it as optional and only forward when present. Residual:
  optional profile / capability gating if a future contract *explicitly* sets
  temperature for a model that rejects it (ADR-0015). → WP-P (defer until pain)
- **G14 — Ambiguous call reconciliation** against provider-side history is not
  implemented. ADR-0014 keeps such calls terminal and non-retried. → WP-P defer
- **G15 — Privacy deletion and full key lifecycle (KMS/rotation)** remain
  deferred. Payload encryption at rest is implemented (ADR-0016); live runs may
  use `encrypted-payload` when the composition root supplies an encryptor. The
  opt-in live gate still defaults to `hash-only` until that wiring is normal.
  → WP-K defer
- **G16 — Offline success-path Responses fixtures** remain simplified samples
  (unknown fields tolerated); they are not byte-identical live captures. → WP-P
  optional
- **G17 — Package boundary enforcement** covers current packages; future
  adapters must extend its rule set. → WP-X process
- **G18 — `better-sqlite3` prebuild** is exercised on Windows locally and on
  `ubuntu-latest` in CI, where the full suite including the SQLite adapter
  passes. No other platform is observed. → WP-X observe-only
- **G19 — Quality evaluation:** **Closed WP-Q (ACME-0065–0068).** Durable
  SQLite store (Q1), CLI `quality list|inspect|judge` (Q2), pure
  `acme-view-quality-evaluation/1` (Q3), and live-model judge outside the
  sync harness with offline injected-transport proof (Q4).
- **Local workbench is single-session.** The local file composition persists the
  product store but keeps its ACME execution ledger in memory, so restarting
  against an existing product file leaves the evidence projection at revision 0
  while the file records revision N. Every state-projecting view — observation
  ledger, compare accounts, relations, timeline, open questions — then fails
  with `Workspace evidence revision does not match the supplied Evidence
  projection.` Work queue, source review, assessment, search, case overview and
  the Case Integrity Report are unaffected. Workaround: delete
  `.local/evidence-workbench` before a new session. Proposal and options:
  [`docs/backlog/local-workbench-durable-ledger.md`](backlog/local-workbench-durable-ledger.md).
  The hosted PostgreSQL composition has a durable ledger and does not exhibit
  this.
