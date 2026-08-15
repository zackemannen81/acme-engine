# Evidence Integrity Workbench Product Completion Plan

Status: Approved delivery direction

Date: 2026-08-15

Current checkpoint: ACME-0122 corrected the live observation terminal-code
assertion after ACME-0121 produced the first committed Stage A provider
observation batch. Stages 1–8 are
delivered; ADR-0040 accepts
bounded Stage A authority, ACME-0105 delivers its fail-closed composition
capability, ACME-0106 delivers authenticated import/browser activation and
ACME-0107/0108 deliver restart-safe live observation and relation jobs, and
ACME-0110 completes live assessment plus reviewer/reassessment engineering.
ACME-0111 reached the real provider once and proved fail-closed handling of an
incomplete candidate. ADR-0041/ACME-0112 resolve the exposed output dependency
with a replay-compatible one-to-eight candidate batch and 8,192-token active
contract. ACME-0113's one fresh call completed strict JSON with six verbatim
quotes but failed closed because every model-authored line locator was offset.
ADR-0042/ACME-0114 implement deterministic unique-quote locator derivation in
active `@1.3.0` output `/2`. ACME-0115 returned complete JSON but failed schema
on a time-only range; two long multi-line quotes also normalized whitespace.
ACME-0116 now implements active `@1.4.0` output `/3` with single-line/
500-character quote bounds and the full-date temporal `unknown` rule. ACME-0117
returned eight complete strict candidates and no invalid temporal value, but
five one-line strings were not verbatim canonical source substrings; exact
runtime validation committed nothing. An offline additive contract must move
quote authority to deterministic runtime-defined bounded source segments before
another separately frozen acceptance. ADR-0043/ACME-0118 now implement active
`@1.5.0` output `/4`: provider candidates select a segment identifier and
runtime derives its complete exact quote and locator while retaining all
historical contracts. Another separately frozen acceptance remains.
ACME-0119 selected eight valid runtime segments but failed strict schema on one
minute-precision local timestamp without seconds or terminal `Z`; an explicit
canonical-UTC prompt version remains before another acceptance.
ACME-0120 implements active `@1.6.0` with literal seconds/terminal-`Z` grammar
and mandatory `unknown` fallback. ACME-0121 then returned eight valid unique
segment selections and committed eight runtime-derived observations. Its
product job completed, but a stale post-commit reason-code expectation made
Vitest false; ACME-0122 corrects that assertion offline. Relation/assessment
provider acceptance and the primary reviewer journey remain separate.
ACME-0123 now makes that remaining journey executable as one fail-closed
two-source live gate with six individually one-call-bounded jobs, two restarts
and domain-only acceptance assertions. It is verified offline; the paid run
remains separately gated.
ACME-0124's first D1 job committed eight valid observations, but the journey
stopped before review because the harness addressed the source view's
observation version with the wrong field name. Five jobs never started and no
retry occurred. A minimal offline harness correction now precedes a new gate.

## Purpose and Authority

This plan records the agreed sequence from the current synthetic Evidence
Integrity Workbench to a complete product proof and a bounded Stage A live
proof. It supplements but does not supersede ADR-0028, ADR-0040, the
accepted product definition or the normative technical specification.

Stage 2 is implemented by ACME-0091 under ADR-0035. ADR-0036 now decides the
Stage 3 case/workspace management and isolation boundary, and ACME-0093
implements it end to end. ADR-0037/ACME-0095 now implement secure object
storage for the fixed synthetic corpus. ADR-0040 now authorizes only
`stage-a-anonymized-judicial-text/1`; ACME-0106 implements its fail-closed
operator-prepared text import, ACME-0107 opens bounded observation and
ACME-0108 opens bounded relation/open-question analysis over committed current
observations.
Stage B FUP, arbitrary ingestion, confidential, privileged, identifiable and
criminal-offence data remain unauthorized.

## Current Product Reality

Slices 0–8 are delivered. ACME-0082 delivered Slice 5's domain core: the
assessment task, assessment storage, deterministic attention helpers and a
synthetic-only canonical-JSON export helper. ACME-0087 completed the reviewer
capability promised by Slice 5, and corrective child ACME-0089 removed the
pre-late E-A01 forward question references without changing import order.

The implemented Slice 5 increment includes:

- the two normative assessment/history views and completed work queue;
- durable file/PostgreSQL change sets and one batched attention notice;
- bounded API/worker/browser create-review-late-import-re-review flow;
- exact source-locator navigation and deterministic reviewed ZIP; and
- automated plus manual browser-visible acceptance evidence.

ACME-0089 proved that every sealed question has at least one EVAL-E01-dependent
trigger, set E-A01's question set to empty and re-pinned the resulting E-A01
and predecessor-derived E-A02 identities. E-A02 retains E-Q01/E-Q02/E-Q03.
Slice 5 is accepted and archived.

## Delivery Sequence

| Stage | Product outcome | Authority rule |
| --- | --- | --- |
| 1. Complete synthetic Slice 5 | A reviewer creates, reviews, revisits and exports a source-bound assessment entirely through the product application. | Complete (ACME-0087/0089); synthetic-only. |
| 2. Principal and authorization foundation | Verified sessions, organization membership, product roles and server-derived principals replace browser-supplied reviewer identity. | Complete (ACME-0091 / ADR-0035); synthetic-only and not case isolation. |
| 3. Case/workspace management and isolation | Create, list, archive and search cases; manage participants/status; prove that no API, job, citation, search result, export or stored object crosses a case boundary. | Complete (ACME-0093 / ADR-0036); synthetic-only. |
| 4. Secure artifact foundation | Immutable originals, canonical artifact versions, encryption/key lifecycle, retention/deletion, incident controls and product audit exist before sensitive ingestion. | Complete (ACME-0095 / ADR-0037) for the fixed synthetic corpus; no arbitrary ingestion. |
| 5. Bounded ingestion and redaction | Text import becomes a real product workflow; redacted derivatives retain exact transformation history without mutating originals. PDF/DOCX/OCR remain later formats. | Complete (ACME-0097 / ADR-0038); synthetic-only. |
| 6. Reviewer operations and navigation | Assignment, re-assignment, waiting/reviewed status, rationales, comments/history, safe bulk actions and corpus-scale search/filter/navigation. | Complete (ACME-0098); synthetic-only. |
| 7. Case overview and integrity report | A case-first dashboard and deterministic Case Integrity Report expose what needs attention and link every material item to immutable source evidence. | Complete (ACME-0099); pure projection, synthetic-only. |
| 8. Assessment output and operations | Authorized deterministic PDF/DOCX/structured outputs, export audit, backup/restore and operational controls. | Complete (ACME-0100); synthetic-only, no new data authority. |
| 9A. POC #1 Stage A live proof | Import authorized anonymized judicial UTF-8 text, run live evidence tasks and complete the primary reviewer/reassessment journey durably. | Engineering complete through ACME-0110. ACME-0111/0113/0115/0117/0119 exposed bounded contract defects; ADR-0041–0043 and ACME-0112/0114/0116/0118/0120 corrected them. ACME-0121 committed the first real-provider observation batch; ACME-0122 corrected its stale post-commit test reason. ACME-0123 adds the two-source live harness. ACME-0124's first observation passed, then a public-view field mismatch stopped review before the remaining five calls. Offline harness correction and a new gate remain. |
| 9B. Later source classes | Consider FUP or other materially more sensitive sources independently. | New data-class ADR required; never activated by Stage A. |

Stages are ordered security boundaries, not one large implementation task.
Every stage needs one or more separately frozen charters. Discoveries do not
expand ACME-0087.

## Security Ordering

Authentication alone is not the boundary. The product must derive a principal
from a verified server-side session, authorize an explicit action against an
organization and case, and record the effective principal and policy result.
Browser payloads must not choose `reviewerRef` or gain access by supplying a
different `workspaceId`.

ADR-0035 fixes the Stage 2 mechanism and ACME-0091 implements it: self-hosted
Supabase Auth owns hosted credentials, the product API owns an opaque BFF
session, and product-owned organization memberships plus typed roles authorize
actions deny-by-default. It explicitly stops short of case isolation.

ADR-0036 fixes the Stage 3 boundary. Product-facing routes use an opaque
`caseId`; the existing workspace remains a uniquely bound internal execution
partition. Explicit case membership, not organization role alone, grants
evidence access. Every product object receives immutable case ownership and
all repository, worker, citation and export traversal starts from case scope.
ACME-0093 proves same-organization isolation with adversarial known identifiers
before Stage 4 begins. Case-first routes reject browser-supplied workspace
authority, writes validate scoped references before commit, and participant
changes advance the case revision atomically.

Case isolation precedes real ingestion. It must cover:

- product queries and commands;
- API and worker jobs, cancellation and progress;
- source, observation, relation, assessment and locator traversal;
- search indexes, caches and projections;
- object-storage keys and encryption context;
- exports, shared links and activity history; and
- logs, metrics, backup and restore procedures.

Encryption, key management, retention and product audit also precede real
ingestion. ACME execution provenance explains how canonical computation
happened; product audit separately records who accessed, imported, reviewed,
redacted, exported, shared or administratively changed sensitive material.

## Immutable Ingestion and Redaction Direction

A future ingestion path must preserve the received original as immutable bytes
and create a versioned canonical artifact that owns the locator scheme used by
observations and citations. Parser/OCR/tool identity and transformation hashes
belong in derivation provenance. New formats cannot silently reuse text-line
locators when their source geometry differs.

Redaction creates a derived immutable artifact version. It never edits or
replaces the original. The derivation records exact affected ranges, the
redaction reason/policy reference, actor, time and source/derived hashes. Access
to the original and access to the redacted derivative are separately
authorized and audited.

## Case Integrity Report Product Anchor

The intended central product result is a versioned pure read model such as
`evidence-case-integrity-report/1`. At an exact case evidence revision and
review-overlay digest it reports, without making credibility or legal claims:

- source-bound observation counts by evidence and review standing;
- corrected-occurrence and changed-account pairs;
- reviewed scoped contradictions, qualifications and scope mismatches;
- temporal conflicts and ambiguity;
- unresolved questions;
- assessments due for attention after newly imported evidence; and
- changes since a prior report basis.

Counts must keep proposed, accepted, rejected and unresolved material distinct.
Every row follows this path:

```text
Case Integrity Report
  -> relation, question or assessment
  -> source-bound observation
  -> immutable artifact version
  -> exact locator and source content
```

Report content identity should derive from case id, evidence revision, review
overlay digest and renderer version. Export/access events remain separate audit
records so timestamps and actors do not break deterministic report bytes.

### Delivered by ACME-0099, and what it deliberately does not claim

`evidence-case-overview/1` and `evidence-case-integrity-report/1` implement the
anchor above for the fixed synthetic corpus. Identity follows the rule: one
order-insensitive `snapshotDigest` over the case workspace/evidence-revision,
evidence and review overlay, and a `reportId` over renderer version, that basis
and the ordered rows. No timestamp or actor enters either identity.

Three parts of this section are intentionally absent rather than approximated,
because the frozen ACME-0099 charter did not list them:

- **Counts by review standing.** The report counts total source-bound
  observations and rows by kind. Splitting proposed, accepted, rejected and
  unresolved material per row kind is a Stage 8 or later charter.
- **Scope mismatches.** `scope-mismatch` relations produce no row. The frozen
  In Scope list names changed accounts, contradictions, qualifications,
  corrections, temporal conflicts and unresolved questions; adding a row kind
  would change the frozen contract enum.
- **Changes since a prior report basis.** Nothing diffs two report bases yet.
  The stable `snapshotDigest`/`reportId` pair is what a later diff would be
  built on.

## Slice 9 Data-class Direction

ADR-0040 establishes a deny-by-default classification ladder rather than
authorizing "real case data" as one category. The progression is:

1. synthetic material;
2. public or explicitly licensed non-confidential text with no personal,
   special-category, privileged or criminal-offence data;
3. de-identified private pilot material with documented re-identification
   controls; and
4. identifiable or otherwise sensitive material only under later, stricter
   authority.

The first Slice 9 decision authorizes only anonymized real judicial UTF-8 text
already under operator control for this POC. ADR-0040 fixes the live provider,
durable PostgreSQL, external-source provenance, authorized execution and
encrypted-payload boundary. Remaining deployment/operational evidence must be
made executable during implementation. Criminal-offence, privileged, Stage B
FUP and broader data remain blocked until separately reviewed and authorized.

## Activation and Completion Rules

- ACME-0087 is complete and archived; ADR-0040 supplies Stage A authority.
- Stage A case/import paths open only when the typed live composition and its
  executable gates pass; bounded observation, relation and assessment jobs are
  callable through the primary review/reassessment journey.
- The Primary Product Rule, source-binding invariants and prohibited authority
  remain unchanged.
- Case Integrity Report work is a later product task and is explicitly outside
  ACME-0087.
