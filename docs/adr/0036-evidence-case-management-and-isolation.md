# ADR 0036 — Evidence case management and isolation

Status: Accepted

Date: 2026-08-12

Decision owners: ACME maintainers

## Context

ADR-0035 establishes authenticated product principals, organizations and
deny-by-default organization authorization. Its Stage 2 compatibility rule
temporarily lets an organization member reach every synthetic workspace bound
to that organization. That is deliberately not case isolation.

The current product exposes `workspaceId` in browser commands and query
parameters. Workspace ownership of sources and observations is inferred from
change sets, while some lookups begin from a process-wide snapshot. Stage 2
scopes the result before rendering, but this convention is not a sufficient
boundary for multiple cases in one organization. A known job, source,
observation, relation, assessment, locator or export identifier must never let
one case traverse an object owned by another case.

Stage 3 must add useful case management without weakening the fixed
synthetic-only policy. The decision crosses identity, product contracts,
authorization, repository ports, workers, views, persistence and migration, so
it must precede implementation.

## Decision

### 1. Case is the public security boundary; workspace is internal

The product introduces a versioned `EvidenceCase` with:

- opaque, stable `caseId`;
- owning `organizationId`;
- immutable internal `workspaceId`;
- title, optional case reference and bounded metadata;
- `synthetic-only` data policy;
- `provisioning | active | archived` lifecycle status;
- monotonic case revision; and
- created/updated timestamps and the responsible authenticated principal.

`caseId` is the identifier accepted by browser-facing case and evidence
routes. `workspaceId` remains the internal execution and evidence-revision
partition required by existing product contracts, but it is never accepted as
an authority claim from the browser. The case-to-workspace mapping is
one-to-one, immutable and unique in both directions.

Existing synthetic data is migrated into one explicit legacy synthetic case.
Its workspace ID and evidence identities remain unchanged. Compatibility
builders may continue to display a workspace projection internally, but new
HTTP commands and navigation use `caseId`. An unbound workspace, duplicate
mapping or active case without its workspace makes startup/readiness fail
closed.

### 2. Case lifecycle is bounded and optimistic

Stage 3 supports:

- create a synthetic case;
- list and bounded-search visible cases by normalized title, case reference
  and lifecycle status;
- inspect and update bounded case metadata;
- archive and restore a case; and
- add, change, suspend and remove case participants.

Create is an idempotent three-step provisioning flow because identity and
product persistence retain separate ownership under ADR-0035:

1. reserve a `provisioning` case and creator `case-admin` membership using a
   caller command key;
2. create the uniquely bound product workspace; and
3. activate the case.

Retries converge on the same identifiers. Provisioning cases are invisible to
ordinary catalogs and cannot receive evidence commands. A reconciliation gate
reports and refuses orphaned or contradictory mappings rather than granting
access.

Case metadata, membership and lifecycle mutations require the expected case
revision. Archive is reversible and is not deletion. Archiving is refused
while a job is non-terminal; the caller must cancel or allow it to finish.
Archived cases remain readable to authorized participants and retain immutable
history, but evidence, review, assessment and import writes are denied. Restore
requires lifecycle-management authority. Hard deletion and case templates are
later decisions.

### 3. Case membership decides content access

The product adds active/suspended `CaseMembership` with one role:

- `case-viewer`;
- `case-reviewer`; or
- `case-admin`.

Every case member must also have an active membership in the case's owning
organization. A suspended organization membership disables every case
membership. Membership organization, case organization and workspace binding
must agree exactly.

The content-action matrix is deny-by-default:

| Case action | Viewer | Reviewer | Case admin |
| --- | ---: | ---: | ---: |
| Read case evidence, views, history and shareable synthetic exports | allow | allow | allow |
| Record review decisions and propose assessment revisions | deny | allow | allow |
| Run the fixed synthetic fixture and cancel case jobs | deny | allow | allow |
| Update case metadata and lifecycle | deny | deny | allow |
| Manage case participants | deny | deny | allow |
| Read gated technical audit for the case | deny | deny | allow |

An organization admin may create a case and inspect the organization's minimal
administrative case catalog. Creation grants that principal `case-admin` in
the new case. Organization-admin does not by itself grant evidence, source,
review-history or export access to any existing case. Organization-admin may
recover case administration by adding an active case-admin, but that
administrative mutation must not return case content. Break-glass evidence
access is not defined.

Unknown cases, foreign-organization cases and cases where the principal lacks
an active case membership all return the same `404` shape. A role denial in a
case the principal may see returns `403`; authentication failure remains
`401`.

### 4. Every product object has immutable case ownership

The product repository adds an immutable case-object ownership record for
every case-bound version or operational record. At minimum it covers:

- workspace and evidence revision;
- source and artifact version;
- observation and observation version;
- relation and relation version;
- open question;
- assessment and assessment version;
- review decision;
- import/assessment command, change set and job; and
- export input/result identity.

The ownership key is `(caseId, objectKind, objectId)`. Content-derived Evidence
identities may legitimately repeat in two cases, so `objectId` alone is never
a product lookup key and never proves ownership. A binding is append-only and
cannot be moved between cases. Creation of a product object and its binding is
one repository transaction. Existing workspace inference is migration input,
not continuing authority.

All object references are checked within one case before commit. This includes
relation endpoints, question triggers, assessment citations, predecessor
assessments, review targets, change-set objects and job results. A mixed-case
reference is rejected as an integrity error even if the principal belongs to
both cases.

The fixed synthetic migration derives bindings from the sealed import/change-
set graph and verifies that every referenced object has exactly one applicable
legacy-case binding. Ambiguous or unbound legacy objects fail migration or
startup; they are never silently attached to a case.

### 5. Repository and traversal APIs require case scope first

Browser-facing routes are case-first, for example:

```text
GET  /api/cases
POST /api/cases
GET  /api/cases/:caseId
GET  /api/cases/:caseId/work-queue
GET  /api/cases/:caseId/sources/:artifactVersionId
POST /api/cases/:caseId/reviews
GET  /api/cases/:caseId/jobs/:jobId/events
GET  /api/cases/:caseId/assessments/:assessmentVersionId/export
```

The server resolves `caseId` to the internal workspace only after case
authorization. Protected legacy routes that accept `workspaceId` are removed
from browser use; supplying `workspaceId`, organization, role or actor fields
to new strict commands is rejected.

Product repository ports expose case-scoped reads and commands. A complete
snapshot remains an adapter-administration/test seam and cannot be passed to a
view, export renderer or ordinary route. In-memory filtering after a global
identifier lookup is not an accepted security boundary.

Worker envelopes contain the server-resolved case and workspace scope plus
the authorization context. Job lookup, progress, events, cancellation and
result commit all query by `(caseId, jobId)`. A worker revalidates case status
and the immutable object bindings at commit; it does not trust the browser or
an enqueue payload to choose a workspace.

Citation navigation carries case scope separately from the stable Evidence
citation fields. A locator resolves only after its artifact version is loaded
through the same case. Search/projection/cache keys begin with organization and
case. Case catalog search is bounded, normalized and filtered by visibility
before result construction. General evidence search remains Stage 6.

Exports are assembled only from one case-scoped repository read at one
evidence revision and review-overlay digest. Export filenames, headers or
errors must not disclose another case. Logs and metrics may carry case and
operation identifiers but not source bytes, exact quotes, case titles or
credentials. Product audit is a later stage; absence of the later audit trail
does not relax isolation.

### 6. Persistence enforces the same boundary

File and PostgreSQL adapters implement the same case repository conformance
kit. PostgreSQL adds unique case/workspace mappings, case memberships and
case-object bindings with foreign keys inside their owning schemas. There is no
foreign key to Supabase's managed `auth` schema and no new browser database
access.

The case catalog and case memberships live with product identity policy;
workspaces and object bindings live with Evidence product persistence. The
provisioning protocol and reconciliation gate handle the deliberate
cross-schema transaction boundary. Backups and restores must preserve both
sides and run reconciliation before service. A restore with missing or
additional ownership records remains unavailable rather than partially
serving cases.

In-memory and file adapters must model the same uniqueness, revision and
cross-reference refusals as PostgreSQL. File paths and future object-storage
keys begin with an encoded opaque `caseId`; path normalization must not permit
case escape. Encryption context and storage buckets are Stage 4, but their
future key hierarchy must include case identity.

### 7. The synthetic-only barrier remains closed

Every created case has `dataPolicy: synthetic-only`. There is no command,
configuration flag or organization role that can change it in Stage 3.
Arbitrary text import, object storage, redaction and every non-synthetic data
class remain unimplemented. Case isolation is necessary for Slice 9 readiness
but does not itself authorize Slice 9.

## Required Implementation Proofs

The implementation task must include at least:

1. table-driven case-role/action policy tests, including organization-admin
   without case membership and every deny-by-default action;
2. case create/list/search/update/archive/restore and participant lifecycle
   tests with expected-revision conflicts and idempotent retry;
3. repository conformance for case/workspace uniqueness, append-only object
   binding and same-case reference validation;
4. migration/reconciliation proof for the current fixed synthetic workspace,
   plus refusal for orphan, duplicate and ambiguous ownership;
5. same-organization black-box cases where principals have disjoint case
   memberships and every current route family returns no foreign content;
6. adversarial known-ID probes for source, observation, relation, question,
   assessment, review history, export, job read/events/cancel and technical
   audit;
7. mixed-case relation, citation, predecessor, review-target, change-set and
   worker-result commit refusals;
8. same object/content identifiers present in two cases without cross-case
   lookup or result collision;
9. archive behavior proving reads remain scoped while all writes and active-job
   archive attempts fail;
10. case-scoped browser navigation with no `workspaceId` or actor authority in
    browser commands;
11. file and PostgreSQL restart/isolation coverage, with PostgreSQL remaining
    an explicit environment gate; and
12. the canonical typecheck, lint, boundary, unit, conformance, integration,
    scenario, build, documentation and diff checks.

The black-box suite must assert both status and response bodies. A `404` alone
is insufficient if a body, redirect, header, event stream, timing-independent
catalog count or export digest discloses the foreign object.

## Consequences

### Positive

- Case identity becomes a stable product concept instead of an alias for a
  client-selected workspace string.
- Organization administration and evidence access are separated by least
  privilege.
- Every traversal has a durable case-scoped lookup key and executable proof.
- Existing synthetic evidence identities and workspace revisions can migrate
  without pretending inferred ownership remains sufficient.
- Later storage, search, audit and Slice 9 work receive an explicit case key.

### Costs

- Current routes and browser navigation require a case-first versioned change.
- The repository needs ownership records and stricter reference validation.
- Provisioning and reconciliation are necessary because identity and Evidence
  schemas deliberately do not share one transaction.
- Same-organization isolation materially expands black-box and persistence
  test fixtures.

### Rejected alternatives

- **Treat organization membership as case access.** Rejected because one
  organization may contain mutually restricted cases.
- **Rename `workspaceId` to `caseId` without migration.** Rejected because it
  conflates a product security boundary with an internal execution partition
  and leaves object ownership inferred.
- **Authorize a global lookup, then filter the response.** Rejected because
  lookup side effects, errors, caches, exports and nested references can leak.
- **Let organization-admin read every case.** Rejected because administration
  is not evidence-access consent and a later audited break-glass flow deserves
  an explicit decision.
- **Use globally unique object IDs as isolation.** Rejected because IDs can be
  known, guessed or intentionally identical across cases.
- **Make archive delete or rewrite history.** Rejected because immutable
  provenance and deterministic exports must remain reproducible.

## Follow-up

- Implement this ADR in the next frozen Stage 3 task.
- Follow with the separately decided Stage 4 artifact security foundation.
- Do not activate arbitrary ingestion or a non-synthetic data class as part of
  case implementation.
