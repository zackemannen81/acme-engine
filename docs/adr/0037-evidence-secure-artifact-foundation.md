# ADR 0037 — Evidence secure artifact foundation

Status: Accepted

Date: 2026-08-12

Decision owners: ACME maintainers

## Context

ADR-0028 permits only a fixed synthetic text corpus. ADR-0035 and ADR-0036 now
provide authenticated principals, deny-by-default roles, explicit cases and
case-first isolation, but artifact text still lives inside the product
repository record. That is sufficient for a synthetic POC fixture and not a
secure ingestion boundary.

The approved completion plan places a secure artifact foundation before any
arbitrary import or redaction. It must preserve four properties at once:

1. original bytes never change;
2. canonical text and later redacted forms are derivatives with exact lineage;
3. one case cannot infer or retrieve another case's objects; and
4. database and object storage cannot commit atomically, so partial failure is
   normal state that needs an explicit recovery protocol.

ADR-0029 selects self-hosted Supabase as the POC platform but deliberately
left Storage undecided. Current self-hosted Supabase Storage exposes a server-
side S3-compatible endpoint and can use a file or S3-compatible backend. It
does not provide S3 object versioning, and server access keys bypass row-level
security. ACME therefore cannot delegate immutability, authorization or
encryption authority to Storage.

This ADR decides storage and security mechanics. It does not authorize a new
data class. Every path remains `synthetic-only` until Slice 9 separately
changes that policy.

## Decision

### 1. Canonical ownership and artifact model

The product application owns artifact storage policy; the Evidence domain owns
source-bound meaning and ACME core remains unchanged.

The durable product model separates:

- `EvidenceArtifact`: case-owned logical document metadata;
- `EvidenceArtifactVersion`: immutable supplied version and provenance;
- `EvidenceArtifactRepresentation`: immutable bytes for `original`,
  `canonical-text` or a later versioned derivative kind;
- `EvidenceArtifactObjectEnvelope`: storage location, authenticated-encryption
  metadata, plaintext/ciphertext digests and lifecycle state;
- append-only lifecycle and security-audit records.

An original representation records the bytes exactly as accepted at the API
boundary. Canonicalization creates a new `canonical-text` representation and
never overwrites the original. Redaction, PDF extraction, OCR and transcription
will be additional derivative kinds under later contracts; this ADR gives them
no implementation authority.

Every representation records its direct predecessor, transformation contract
and version, producing principal, producing command/job and input/output
digests. Provenance must form an acyclic graph that terminates at one original
inside the same case. Evidence locators cite the immutable canonical
representation used to create the current `SourceArtifactVersion`.

Existing Evidence content-derived identities remain authoritative. Object
storage keys are separate opaque random values under a private case prefix;
they never contain a title, person, source label, plaintext hash or public
artifact identifier. Plaintext digests are protected product metadata and are
not used as globally enumerable object names.

### 2. Object-store port and adapters

A provider-neutral `EvidenceArtifactObjectStore` port exposes bounded
server-side operations: exclusive create, stat, bounded stream read, delete and
enumeration for reconciliation. It does not expose public URLs, browser
credentials, bucket policy, listing by arbitrary prefix or provider SDK types.

Two adapters implement the same conformance kit:

- local: a controlled filesystem root, exclusive temporary creation, atomic
  rename and no symlink traversal; and
- hosted: the self-hosted Supabase Storage S3-compatible endpoint, called with
  dedicated server-only access credentials against one private bucket.

Supabase Storage metadata, row-level security and provider object identifiers
are not canonical product state. The bucket is never public. Browser session
tokens, signed object URLs, anonymous keys and direct Storage routes are not
accepted product paths. Provider versioning is neither required nor assumed.

The hosted adapter is S3-protocol-specific but not Supabase-SDK-specific. A
later move to another S3-compatible store changes composition and operations,
not product contracts.

### 3. Application envelope encryption

Every artifact representation is encrypted before bytes leave the API/worker
process. Storage-layer or disk encryption may add defense in depth but never
satisfies this requirement by itself.

For each representation:

1. generate a cryptographically random 256-bit data-encryption key (DEK) and a
   unique 96-bit nonce;
2. encrypt with AES-256-GCM;
3. authenticate canonical associated data containing schema version, case id,
   artifact/version/representation ids, representation kind, media type,
   plaintext byte length and plaintext SHA-256;
4. compute a ciphertext SHA-256 over the exact stored envelope bytes;
5. wrap the DEK with the active key-encryption key (KEK) through an injected
   `EvidenceArtifactKeyProvider`; and
6. persist algorithm, nonce, authentication tag, wrapped DEK, KEK id/version
   and both digests in product metadata, never in the object name.

Decryption verifies the case scope, authorization, audit precondition,
ciphertext digest, GCM tag, associated data, plaintext length and plaintext
digest before releasing bytes to a caller. Any mismatch is a security failure,
not a missing document or best-effort warning.

The key provider has versioned `wrap`, `unwrap` and availability operations.
Tests use an injected deterministic provider. Hosted POC keys are supplied as
root-owned mounted secret files, not command-line flags, repository files,
browser configuration or ordinary application logs. The active KEK id is
configuration; KEK material is not stored in PostgreSQL or object storage.
Object-store, database, Supabase Auth, model-provider and KEK credentials are
distinct least-privilege secrets.

KEK rotation re-wraps DEKs without decrypting or re-uploading artifact bytes.
Old KEKs remain available until every envelope and every retained backup has
been re-wrapped and verified. A missing, revoked or ambiguous key makes the
affected representation unavailable and emits a security-audit failure; the
system must never try another key heuristically or return ciphertext.

No non-synthetic readiness decision may rely only on mounted-file KEKs. Slice
9 must either verify the accepted operational key provider and independent key
backup/restore controls or explicitly remain synthetic-only.

### 4. Database/object consistency and quarantine

PostgreSQL metadata is the catalogue of authority, but an artifact becomes
readable only after the following bounded protocol:

1. authorize the case action and validate metadata/size/media policy;
2. create an immutable `staging` metadata record and audit intent in one
   PostgreSQL transaction;
3. encrypt and exclusively upload to a new opaque staging object key;
4. stat/read-verify stored length and ciphertext digest;
5. atomically append the active envelope and success audit record in
   PostgreSQL using the command key and expected case/artifact revision; and
6. expose the representation only from active metadata.

Command reuse is idempotent only when case, metadata, plaintext digest and
transformation input are identical. Divergent reuse is a collision.

A database failure after upload leaves an unreferenced encrypted object. A
database success followed by loss or tampering leaves active metadata with an
unusable object. Neither condition is repaired by guessing:

- a bounded reconciler compares case-scoped metadata with object stat data;
- recent staging objects are left for retry;
- expired unreferenced objects move to quarantine and are deleted only after a
  configured grace period and audit record;
- active missing, size-mismatched or digest-mismatched objects make the case
  artifact unavailable, raise an operator incident and are never recreated
  from a derivative; and
- reconciliation accepts no object whose database case binding is absent or
  contradictory.

The worker never receives a global object key from a command. It receives a
server-resolved case scope plus representation id and resolves the object from
case-scoped metadata.

### 5. Retention, deletion and immutability

Immutability means a representation's bytes and provenance cannot be changed;
it does not mean the system may retain bytes forever.

Deletion is a case-admin security operation with an expected revision,
non-empty reason, retention-policy result and no active legal/operational hold.
The bounded sequence is append `deletion-requested` and deny new reads, delete
the object, verify absence, then append an irreversible tombstone. Failure
leaves `deletion-pending`, remains unreadable and is retried. Metadata,
provenance, digests, audit and tombstone remain; content and wrapped DEK do not.

No API hard-deletes an artifact row, rewrites an original, reuses a deleted
object key or treats deletion as redaction. Retention durations and legal-hold
policy are deployment/data-class decisions outside this ADR; until supplied,
automatic deletion is disabled and only synthetic test cases may exercise the
mechanism.

### 6. Product security audit

ACME provenance and product security audit are separate. The product appends a
strict `EvidenceSecurityAuditEvent` for:

- artifact create/import intent, activation, failed validation and quarantine;
- original/canonical byte read and attempted cross-case read;
- metadata change, lifecycle/hold/deletion action and reconciliation result;
- key activation, re-wrap, unavailable-key and integrity failure;
- export creation/download and sensitive administrative operations; and
- authentication/authorization outcome references needed to identify who did
  what under which policy.

Events contain organization/case/principal, action, outcome/reason code,
resource kind and opaque id, request/command id, timestamp, authorization/key
policy versions and before/after digests where meaningful. They contain no
document content, exact quotes, credentials, DEKs, KEKs or upstream tokens.
They are append-only and case-scoped, with an organization-security view that
still requires explicit administrative authority.

For artifact bytes, a successful audit write is a precondition to releasing
plaintext. If audit persistence is unavailable, the read/export fails closed.
Canonical metadata mutations append their audit record in the same PostgreSQL
transaction. Failed/denied attempts use a bounded independent audit append and
must be visible operationally if that append itself fails.

### 7. Backup, restore and operational readiness

A usable backup set consists of PostgreSQL schemas, encrypted objects, a
manifest of object ciphertext digests and the separately protected key
catalogue. Database-only or object-only backup is incomplete.

Restore occurs into an isolated environment. Before traffic:

- migrations and case reconciliation pass;
- every active object exists with the expected length/ciphertext digest;
- every referenced KEK version is available;
- sampled and fixture-pinned objects decrypt and match plaintext digests;
- deleted tombstones do not regain objects; and
- security-audit continuity checks pass.

Key backups are encrypted, access-controlled and stored separately from data
backups. A restore that lacks a key is reported as incomplete and cannot serve
the affected case. Disaster recovery must never silently drop unreadable
artifacts from a case catalogue.

### 8. Threat and failure matrix

| Threat/failure | Required behavior |
| --- | --- |
| Known object key or representation id from another case | Resolve only through authorized case metadata; non-disclosing refusal and audit. |
| Browser tries Storage/S3 directly | No credential, URL or public bucket exists; product API is the only path. |
| Object bytes or encryption metadata are modified | Ciphertext digest/AAD/GCM/plaintext verification fails closed and raises an incident. |
| KEK is missing, wrong or revoked | No fallback key search; artifact unavailable and audited. |
| Upload succeeds and database commit fails | Encrypted orphan remains staging, then quarantine/grace-period deletion. |
| Database activates and object is later absent | Artifact unavailable; reconcile/incident, never derivative reconstruction. |
| Backup contains database but not objects/keys | Restore is incomplete and cannot serve affected cases. |
| Delete crashes midway | `deletion-pending` denies reads and resumes idempotently; no resurrection. |
| Object store lists another case prefix | Adapter enumeration is reconciliation-only; results require database binding and are never a product response. |
| Audit persistence fails before byte read | Plaintext is not released. |

## Alternatives Considered

### Keep artifact bytes in canonical PostgreSQL JSON/text

- Benefits: one transaction and existing adapters.
- Costs: large-byte lifecycle, streaming, key rotation and independent object
  reconciliation become database concerns; originals and projections remain
  coupled.
- Reason not selected: it cannot provide the intended artifact boundary.

### Supabase Storage REST/client SDK with browser JWT and RLS

- Benefits: platform-native upload/download and less API code.
- Costs: violates browser-to-product-API isolation, delegates case policy to a
  second authorization system and makes credentials/direct URLs browser state.
- Reason not selected: ADR-0029, ADR-0035 and ADR-0036 require one server-side
  authorization boundary.

### Storage/disk encryption only

- Benefits: simpler and often transparent to applications.
- Costs: database, bucket or backup compromise may expose plaintext; provider
  behavior and key ownership are not portable or sufficiently testable.
- Reason not selected: application-verifiable envelope encryption is required.

### Deterministic encryption or content-addressed plaintext object keys

- Benefits: deduplication and simple idempotency.
- Costs: reveals equality across cases and makes repeated plaintext linkable;
  nonce misuse risks catastrophic GCM failure.
- Reason not selected: opaque case-local keys and random per-object encryption
  are the safer POC boundary. Deduplication is not a product requirement.

### Provider object versioning as immutability

- Benefits: familiar retention and rollback mechanism.
- Costs: self-hosted Supabase Storage's S3 compatibility does not supply object
  versioning, and provider versions do not express product provenance.
- Reason not selected: immutability is enforced by exclusive object keys plus
  append-only product metadata, independent of provider capability.

### Two-phase commit across PostgreSQL and object storage

- Benefits: apparent atomicity.
- Costs: S3-compatible storage is not an XA participant; emulation adds locks
  and still cannot remove all partial failure.
- Reason not selected: explicit staging, verification and reconciliation make
  partial state finite and testable.

## Consequences

### Positive

- Originals, canonical text and later derivatives have one explicit immutable
  provenance model.
- Encryption is portable, authenticated and independently verifiable.
- Object storage remains behind case-first API/worker authorization.
- Partial failure, deletion, restore and missing keys have fail-closed states
  rather than undocumented operator guesses.
- Security audit becomes a product invariant before sensitive ingestion.

### Negative

- Every artifact write spans two durable systems and needs reconciliation.
- Key backup/rotation and audit availability become operational dependencies.
- Application encryption prevents Storage-side preview, indexing and content
  transforms; plaintext processing must occur in an authorized worker.
- Supabase Storage adds another patched service and server credential to the
  self-hosted footprint.
- No non-synthetic path opens merely because this architecture is implemented.

## Compatibility and Migration

Existing synthetic `SourceArtifactVersion` identities, line locators,
observations, reviews and exports remain unchanged. The implementation task
adds new versioned artifact/envelope/audit contracts and numbered product
migrations. It must import existing fixed fixture bytes through an explicit
synthetic migration, verify that the resulting canonical bytes reproduce every
existing artifact id and locator, then stop embedding new bytes in product
snapshot records.

Old file snapshots remain readable long enough for one idempotent migration.
An existing artifact is not considered migrated until its encrypted object,
active envelope and case binding all verify. Startup fails closed on mixed old/
new state that cannot be reconciled.

Rollback is a new ADR and a data migration. Removing the object store without
restoring verified plaintext representations would make active artifacts
unavailable; copying ciphertext alone without metadata and keys is not a
rollback.

## Follow-ups

- Implement this ADR as ACME-0095 with contracts, filesystem and hosted S3
  adapters, encryption/key providers, audit store, reconciliation and
  migration proofs.
- Keep arbitrary text ingestion and redaction in the later Stage 5 task after
  ACME-0095 passes.
- Before Slice 9, perform a restore drill and decide whether the mounted-secret
  KEK provider is sufficient for the proposed data class or must be replaced
  by an external KMS/HSM adapter.
- Define deployment-specific retention periods, incident ownership and backup
  schedules before any non-synthetic authorization.

## References

- [ADR-0028 — First POC is the Evidence Integrity Workbench](0028-first-poc-evidence-integrity-workbench.md)
- [ADR-0029 — POC #1 persistence platform](0029-poc-1-self-hosted-supabase-persistence-platform.md)
- [ADR-0033 — PostgreSQL persistence architecture](0033-postgresql-persistence-architecture.md)
- [ADR-0035 — Evidence authenticated principal and authorization](0035-evidence-authenticated-principal-and-authorization.md)
- [ADR-0036 — Evidence case management and isolation](0036-evidence-case-management-and-isolation.md)
- [Evidence Integrity Workbench completion plan](../design/evidence-integrity-workbench-product-completion-plan.md)
- [Supabase self-hosted S3 configuration](https://supabase.com/docs/guides/self-hosting/self-hosted-s3)
- [Supabase Storage S3 compatibility](https://supabase.com/docs/guides/storage/s3/compatibility)
- [Supabase S3 authentication](https://supabase.com/docs/guides/storage/s3/authentication)
