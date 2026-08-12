# Evidence Integrity Workbench Product Completion Plan

Status: Approved delivery direction

Date: 2026-08-12

Current task: ACME-0097 implements Stage 5 under ADR-0038

## Purpose and Authority

This plan records the agreed sequence from the current synthetic Evidence
Integrity Workbench to a complete product proof and, later, a security-gated
non-synthetic pilot. It supplements but does not supersede ADR-0028, the
accepted product definition or the normative technical specification.

Stage 2 is implemented by ACME-0091 under ADR-0035. ADR-0036 now decides the
Stage 3 case/workspace management and isolation boundary, and ACME-0093
implements it end to end. ADR-0037/ACME-0095 now implement secure object
storage for the fixed synthetic corpus. Arbitrary ingestion and Slice 9 still
require their own frozen tasks and decisions. No real,
confidential, privileged, identifiable or criminal-offence data is authorized.

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
| 6. Reviewer operations and navigation | Assignment, re-assignment, waiting/reviewed status, rationales, comments/history, safe bulk actions and corpus-scale search/filter/navigation. | Product tasks after case isolation. |
| 7. Case overview and integrity report | A case-first dashboard and deterministic Case Integrity Report expose what needs attention and link every material item to immutable source evidence. | New versioned view/export contracts. |
| 8. Assessment output and operations | Authorized deterministic PDF/DOCX/structured outputs, export audit, backup/restore and operational controls. | Export policy and audit gates required. |
| 9. Non-synthetic readiness | A qualified review may authorize one bounded new data class after every prerequisite is proven. | Slice 9 ADR; never automatic activation. |

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

## Slice 9 Data-class Direction

The Slice 9 ADR should define a deny-by-default classification ladder rather
than authorize "real case data" as one category. A candidate progression for
qualified review is:

1. synthetic material;
2. public or explicitly licensed non-confidential text with no personal,
   special-category, privileged or criminal-offence data;
3. de-identified private pilot material with documented re-identification
   controls; and
4. identifiable or otherwise sensitive material only under later, stricter
   authority.

The first Slice 9 decision should authorize at most one bounded class, purpose,
organization, region, provider path and retention period. It must document
lawful basis and data rights, processor/geography terms, access control,
retention/deletion, incident response, provider handling, redaction/export
policy and the DPIA determination. Criminal-offence and privileged data remain
blocked until specifically reviewed and authorized.

## Activation and Completion Rules

- ACME-0087 must complete and archive before a Slice 9 task is activated.
- Product-security prerequisites may be designed after ACME-0087, but no
  non-synthetic path opens until their executable gates pass.
- The Primary Product Rule, source-binding invariants and prohibited authority
  remain unchanged.
- Case Integrity Report work is a later product task and is explicitly outside
  ACME-0087.
