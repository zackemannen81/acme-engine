# ADR 0050 — Evidence V2 PDF ingestion boundary

Status: Accepted
Date: 2026-08-18
Decision owners: ACME maintainers

## Context

The product has refused the PDF container by decision, not by omission.
[ADR-0038](0038-bounded-text-ingestion-and-immutable-redaction.md) admits one
bounded strict UTF-8 plain-text class.
[ADR-0040](0040-poc-1-live-product-applicability.md) §3 admits
`stage-a-anonymized-judicial-text/1` and states that operator-prepared text
"may be derived outside ACME from an excluded container; the product imports
only the verified text and records the parent provenance". The V2 domain
specification §7 lists PDF, DOCX, OCR and media as refused.

That boundary has been honoured in practice. The real `source-A` binder was
converted outside the product by `pypdf` 6.10.0, and the V2 artifact record
already carries the resulting provenance — `parentKind`, `parentSha256`,
`parentByteLength`, `pageCount`, `extractionMethod`, `extractedAt`.

The consequence is that the requested process model begins outside the product.
An operator cannot start a case from the document they actually hold; they must
first run a conversion the product neither performs, records the determinism
of, nor can replay. The exactness the whole product rests on stops one step
short of the thing that came in.

Three options were weighed in
[the interface plan §4](../design/evidence-workbench-v2-interface-plan.md):
keep PDF outside and ship an operator tool; accept the PDF server-side; or
extract in the browser. The third was rejected on provenance grounds — the L0
artifact would become the extractor's output rather than the received document.
The first was rejected because it leaves the product unable to describe its own
first step.

## Decision

### 1. One new source class

`stage-a-pdf-extracted-text/1`

An object in that class is a PDF container that satisfies every existing Stage A
condition of ADR-0040 §3 — a real judicial source document, anonymized or
redacted before it crosses the import boundary, operator-authorized for this
bounded POC and for transmission to the configured live provider — and that the
product itself converts to text.

Stage B remains closed. No other container class is authorized. DOCX, images,
audio, video, arbitrary binary input, bulk ingestion and direct collection from
an external system remain refused.

### 2. The received bytes are the L0 artifact

The exact received PDF bytes are the immutable registered artifact version.
They are stored under the [ADR-0037](0037-evidence-secure-artifact-foundation.md)
encrypted artifact boundary, with their own content hash, and are **retained**
rather than discarded after canonicalization.

This is the point of the decision. The L0 rule is "exact received bytes", and
under the outside-conversion path the product never held them. Now it does.

### 3. Canonical text is a named, versioned derivative

Canonical text is derived from the artifact by a **pinned** extractor, and the
derivation is recorded as a representation of the artifact, not as the artifact.

- The extractor and its exact version are named in the artifact record's
  `extractionMethod`, in the form `<method>/<version>` — the field that already
  exists.
- The extraction rule carries its own version, alongside
  `structureRuleVersion` and `chainRuleVersion`. Changing the extractor or its
  version changes every derived identity, and is therefore a new artifact
  version, never an in-place re-cut (§2 of the domain specification).
- Text derivation happens **once**, inside the import transaction, exactly as
  structure derivation and chain proposal do today (R-10).

### 4. Determinism is proven, not assumed

For a given (received bytes, extractor version) pair the canonical text must be
byte-identical across runs, processes and machines.

This is a gate, not an aspiration. The implementing task must prove it by
extracting the same document at least twice in separate processes and comparing
the canonical SHA-256, and must record the measured digest. An extractor that
cannot satisfy this cannot be used, because every part, unit, occurrence and
quote identity in the system is derived from that text.

Any per-run nondeterminism the extractor introduces — timestamps, object order,
temporary paths — must be excluded from the canonical representation rather
than tolerated.

### 5. Fail closed

The import refuses, with a typed reason and nothing persisted, when:

- the file is not a PDF;
- the PDF is encrypted or password-protected;
- extraction yields no text, or text below a stated threshold relative to page
  count — the image-only case. **OCR stays out**, and a scanned document is
  refused rather than silently imported as an empty or near-empty source;
- the file exceeds the stated size bound, or the extracted text exceeds the
  existing ADR-0038 canonical text bound;
- extraction throws, times out, or produces text that is not valid UTF-8 after
  NFC normalization.

A refusal is content-free in logs and audit metadata, consistent with ADR-0040
§3.

### 6. The dependency is declared

Server-side PDF text extraction requires a library. This is the first runtime
dependency added for the V2 application, and it is accepted deliberately:

- it is pinned to an exact version, like every other runtime dependency in this
  workspace;
- it lives behind a port in an adapter package, never inside a module or
  `packages/core`, per the fixed dependency direction;
- the domain and contract layers see canonical text and provenance, never the
  library's types;
- replacing it is a new extractor version under §3, not a refactor.

Selecting the specific library is left to the implementing task, which must
record why it was chosen against the §4 determinism gate and the §5 refusal
list.

### 7. What does not change

- Anonymization before import remains the operator's obligation. The product
  performs none, and importing a PDF is not a claim that it is safe.
- Authorization, case membership, audit, retention and export policy apply
  unchanged.
- The live composition capability of ADR-0040 §5 is unchanged; a source in this
  class carries `sourceOrigin = authorized-external` on the same terms.
- Source content never enters Git, logs or audit metadata.
- Structure, chain and observe rule versions are untouched. This decision adds
  a step before them and changes none of them.

## Consequences

- ACME-0158 can freeze a charter.
- The requested process model starts inside the product for the first time.
- Existing artifacts are unaffected. `stage-a-anonymized-judicial-text/1`
  remains valid and importable; the outside-conversion path is not withdrawn,
  and no migration is implied.
- The product now holds original PDFs, encrypted. That is a larger and more
  sensitive object store than before, and the retention, backup and deletion
  paths of ADR-0037 apply to it without exception.
- A determinism failure is now a product-blocking defect rather than an
  operator inconvenience, which is the correct place for it.

## References

- [ADR-0037](0037-evidence-secure-artifact-foundation.md)
- [ADR-0038](0038-bounded-text-ingestion-and-immutable-redaction.md)
- [ADR-0040](0040-poc-1-live-product-applicability.md)
- [ADR-0047](0047-evidence-application-model-reset.md)
- [V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)
- [Evidence Workbench 2.0 interface plan](../design/evidence-workbench-v2-interface-plan.md)
