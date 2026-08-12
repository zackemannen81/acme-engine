# ADR 0038 — Bounded text ingestion and immutable redaction

Status: Accepted

Date: 2026-08-12

Decision owners: ACME maintainers

## Context

ADR-0037 provides immutable encrypted representations, case isolation,
content-free product audit and cross-store recovery for the fixed synthetic
corpus. The workbench still has no product import for a user-supplied document
and no product-domain redaction model. Stage 5 must prove those workflows
without treating “upload” as permission for real, confidential, privileged,
identifiable or criminal-offence data.

The Evidence domain already requires UTF-8/LF/NFC canonical text and
`line-range-1` locators. A received document may use CRLF or decomposed Unicode,
so exact received bytes and Evidence canonical text cannot be the same
representation. Redaction adds a second problem: editing canonical text would
invalidate provenance, while silently retaining old locators against changed
text would make citations misleading.

This ADR decides a narrow synthetic plain-text workflow. It does not open the
Slice 9 data gate.

## Decision

### 1. Accepted and refused data classes

The only accepted class is `synthetic-utf8-plain-text/1`:

| Property | Required limit |
| --- | --- |
| Declared media type | exactly `text/plain`; optional charset must be `utf-8` |
| Encoding | strict UTF-8, no replacement decoding and no BOM |
| Original size | 1–2,097,152 bytes |
| Canonical line count | 1–20,000 |
| Canonical line length | at most 16,384 Unicode scalar values |
| Controls | TAB, LF and CR only; NUL and other C0/C1 controls refused |
| Documents | at most 200 active logical artifacts per case |
| Versions | at most 20 per logical artifact and 1,000 per case |
| Request | one document, no multipart archive or batch |
| Rate | 20 accepted import commands per organization per rolling hour |
| Data policy | target case is `synthetic-only` and caller attests synthetic authority |

The server treats filename, media type, title, attestation and browser-provided
hashes as untrusted. It sniffs the bounded bytes itself, decodes with a fatal
UTF-8 decoder and computes every digest. A failed validation stores no active
representation and returns a stable reason code without echoing content.

PDF, DOCX, RTF, HTML, XML, Markdown-as-active-content, images, audio, video,
OCR output, archives, compressed input, directories, URLs, clipboard HTML,
encrypted files and any non-synthetic material are refused. Plain text that
contains a binary signature is refused even if labelled `text/plain`.
Antivirus/content-disarm is not claimed for this class; the strict decoder,
control policy, no-render-as-markup rule and isolated text-only processing are
the bounded substitute. Supporting another class requires a new decision and
threat model.

### 2. Import command and authorization

The browser sends one bounded body to the product API, never to object storage.
The command contains a client command key, case id from the route, logical
artifact intent (`create` or `new-version`), title, artifact kind from the
existing closed Evidence enum, correction reason/predecessor when applicable,
and an exact synthetic-data attestation version. It cannot supply workspace,
organization, principal, object key, representation id, content hash,
version ordinal or lifecycle state.

`case-reviewer` may create a new synthetic logical artifact and version;
`case-admin` may additionally create a corrected version of an existing
artifact. Archived cases and cases whose data policy is not exactly
`synthetic-only` refuse all imports. Authorization and attestation are recorded
with the server-derived principal and policy versions. Attestation is a
governance record, not proof that arbitrary content is safe; Slice 9 remains
the only authority for a later data class.

### 3. Immutable received and canonical representations

An accepted command creates one logical `EvidenceArtifact`, one immutable
`EvidenceArtifactVersion`, and two representations through ADR-0037's staged
protocol:

1. `original` stores the exact received bytes after validation but before any
   transformation;
2. `canonical-text` decodes strict UTF-8, maps CRLF and CR to LF, applies NFC
   and otherwise preserves text exactly using
   `evidence-text-canonicalization-1`.

Both representations are encrypted independently with distinct opaque object
keys and DEKs. The canonical representation points directly to the original
and records input/output hashes plus transformation contract/version. Neither
is active to Evidence until both objects verify and one product transaction
activates artifact/version/representations, source metadata, audit and case
evidence revision. Failure leaves staging for exact retry or quarantine; a
half-import is never queryable.

The server allocates the next version ordinal under an expected artifact
revision. `SourceArtifactVersion` identity continues to use ADR-0030's existing
algorithm over corpus/case catalogue id, logical id, ordinal, kind, canonical
content hash, locator scheme and predecessor. `line-range-1` addresses only the
immutable canonical representation. Duplicate plaintext in one or several
cases is not deduplicated and receives distinct encrypted objects.

Command reuse is idempotent only when case, logical intent, metadata,
attestation and server-computed original/canonical hashes are identical.
Changing any field is a command collision.

### 4. Immutable redaction model

Redaction is a product-domain transformation, never deletion or in-place edit.
A redaction command targets one active `canonical-text` or prior
`redacted-text` representation in the same case, supplies its expected
representation revision, a non-empty policy/rationale reference and a sorted
list of exact operations.

`EvidenceRedactionOperation/1` contains:

- operation id and ordinal;
- UTF-8 byte interval `[startByte, endByte)` in the exact predecessor bytes;
- SHA-256 of the removed bytes;
- closed reason code (`personal-data`, `sensitive-data`, `privileged`,
  `security`, `other`) plus required rationale for `other`; and
- replacement token version.

Intervals must be non-empty, sorted, non-overlapping, inside the predecessor,
aligned to Unicode scalar boundaries and must not contain LF. The no-LF rule
preserves line count and makes review mapping mechanical. The transformation
applies operations from the end toward the start and replaces each span with
the literal ASCII token `[REDACTED:<reason-code>]`. The output must remain
UTF-8/LF/NFC and pass the same line/size bounds.

The append-only `EvidenceRedactionLog/1` records case, predecessor and derived
representation ids, command/principal/policy, ordered operations, predecessor
and result hashes, transformation version and timestamp. It contains removed-
byte hashes but never the removed plaintext. The derived encrypted
`redacted-text` representation points to its exact predecessor. Acyclic
same-case lineage must terminate at the original.

A redacted derivative becomes a new immutable `SourceArtifactVersion` with its
own content hash and artifact-version id. Its `line-range-1` locators address
only its own bytes. Existing observations, reviews, relations, assessments and
citations remain bound to their old version and are never copied, retargeted or
made safe by redaction. New analysis requires a separate explicit import/
observe command over the derivative. Original/canonical read and redacted read
remain separately authorized and audited.

### 5. Workflow, review and export

Import is a durable job with validate, stage-original, stage-canonical,
activate and optional observe phases. Progress contains counts/reason codes,
not source text. Cancel before activation quarantines staged objects; cancel
after activation does not roll back immutable evidence.

Redaction has draft and applied states. A case-reviewer may create/edit a
non-canonical draft operation list; only a case-admin can apply it. Applying
uses the frozen operation list and expected predecessor revision. Drafts are
not representations, cannot be cited/exported and expire without affecting
source state. The UI must show original/canonical and redacted versions as
different sources, identify the derivation and warn that prior observations
remain attached to unredacted evidence.

Exports choose an explicit representation policy. A “redacted export” may
include only the chosen redacted version and citations created against it; it
must not silently rewrite citations from an original. Export audit records the
representation set and deterministic export digest without content.

### 6. Persistence, audit and recovery

File and PostgreSQL product repositories add strict artifact/version/import,
redaction-draft/log and command records with immutable case bindings.
PostgreSQL uses numbered migrations and transactions for metadata activation;
bytes continue through ADR-0037's object protocol.

Audit actions cover import requested/refused/activated/cancelled, original and
canonical reads, redaction draft/applied/refused, each representation read,
observe enqueue, export and administrative lifecycle actions. Events never
contain input text, removed text, filenames when sensitive, or byte excerpts.

Reconciliation understands the two-object import set. It may resume exact
staging or quarantine unactivated objects, but cannot activate only one
representation, infer metadata from an object, recreate an original from
canonical text or recreate canonical text from a redaction. A changed command,
predecessor revision or hash refuses retry. Same-organization known ids,
logical ids, command keys, object keys and redaction logs from another case
return non-disclosing refusals and content-free audit.

### 7. Required implementation proofs

The implementation task must prove:

- strict UTF-8/media/signature/control/size/line/rate/count refusal at exact
  boundaries and bounded request streaming;
- pinned canonicalization and artifact/version identity vectors;
- exact original-byte preservation and independent encrypted objects;
- crash/retry/cancel at every import phase with no half-visible import;
- concurrent version ordinal/revision and command-key collision behavior;
- redaction byte-boundary, overlap, newline, hash, replacement and lineage
  invariants with pinned vectors;
- old locators remain unchanged and new locators never cross versions;
- viewer/reviewer/admin, archived-case and same-organization cross-case
  adversarial black boxes across API, worker, search and export;
- file restart and configured PostgreSQL/S3 gates or exact refusal;
- content-free audit/secret scan and full existing reviewer regression; and
- no route, schema or fixture accepts a non-synthetic policy or excluded type.

## Alternatives Considered

### Store only canonical text

Rejected because exact received-byte provenance and canonicalization audit
would be unverifiable.

### Edit the canonical representation during redaction

Rejected because it destroys provenance and silently invalidates existing
locators, observations and citations.

### Preserve locator ids across redaction

Rejected because a locator is meaningful only inside one exact immutable
artifact version. Equal line numbers do not make changed bytes identical.

### Permit PDF/DOCX and extract text opportunistically

Rejected because parser exploits, embedded content, layout locators and
transformation quality require separate schemas and security gates.

### Treat a user checkbox as non-synthetic readiness

Rejected because attestation is an auditable constraint, not legal/security
authorization. Slice 9 remains mandatory.

## Consequences

### Positive

- The POC gains a real bounded import and redaction workflow without weakening
  source binding or case isolation.
- Exact received bytes, canonical Evidence text and redacted output remain
  independently verifiable immutable representations.
- Redaction effects and locator consequences are deterministic and reviewable.
- Excluded formats and data authority remain conspicuous and testable.

### Negative

- Each import stores two encrypted objects and requires coordinated activation.
- Newline-spanning redaction is deliberately unavailable in this first model.
- Existing evidence does not automatically become safe when a derivative is
  redacted; re-analysis and review are explicit work.
- Synthetic attestation cannot technically classify content, so operational
  controls and Slice 9 governance remain essential.

## Compatibility and Migration

The fixed corpus remains valid. Its current `canonical-text` representations
do not acquire fabricated originals; they retain their recorded synthetic
migration provenance. New imports use the two-representation contract. Existing
artifact, observation, locator, review and assessment identities do not change.

Rollback may disable new commands but must keep representation/log schemas
readable. Deleting new originals, redacted derivatives or logs is not rollback
and must follow ADR-0037 deletion policy.

## Follow-ups

- Implement this ADR in a separately frozen Stage 5 task.
- Keep PDF/DOCX/OCR/media and non-synthetic input closed.
- Carry the accepted limits and attestation into Slice 9's data-class review;
  Slice 9 may further narrow them and cannot activate by implication.

## References

- [ADR-0028 — First POC](0028-first-poc-evidence-integrity-workbench.md)
- [ADR-0030 — Evidence identity and placement](0030-evidence-v1-identity-and-canonical-placement.md)
- [ADR-0035 — Authenticated principal and authorization](0035-evidence-authenticated-principal-and-authorization.md)
- [ADR-0036 — Case management and isolation](0036-evidence-case-management-and-isolation.md)
- [ADR-0037 — Secure artifact foundation](0037-evidence-secure-artifact-foundation.md)
- [Evidence Integrity Workbench completion plan](../design/evidence-integrity-workbench-product-completion-plan.md)
