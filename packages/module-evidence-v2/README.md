# @acme/module-evidence-v2

The replacement Evidence application domain module, accepted in
[ADR-0047](../../docs/adr/0047-evidence-application-model-reset.md) and
specified in
[the V2 domain specification](../../docs/design/evidence-workbench-v2-domain-specification.md).

It currently contains one layer: **source structure**.

```text
Artifact → SourcePart → CitableUnit
```

`deriveEvidenceV2SourceStructure` is pure and total. It reads no repository, no
artifact store and no clock, consults no model, and depends only on canonical
text plus `EVIDENCE_V2_SOURCE_STRUCTURE_RULE_VERSION`.

Three guarantees exist because the 2026-08-16 real-source acceptance run failed
without them:

- **Unique binding is an emission precondition.** A citable unit whose text does
  not occur exactly once inside its own line range is never emitted. It absorbs
  the previous unit until it binds, and failing that widens to its whole line
  range where uniqueness holds by construction. No consumer can spend a provider
  call on a unit that cannot be located.
- **A title is a label.** `EvidenceV2SourcePart.title` carries the exact line it
  came from and nothing else. The type exposes no date and no subject identity,
  because in real material the header line opening a part routinely belongs to
  the preceding document. Instance time belongs to `ChainInstance`.
- **Content character is deterministic.** A part is `index-or-front-matter` or
  `substantive`, decided by dot-leader density with no model involved, so a
  binder's table of contents is distinguishable from its substance before
  anything is analysed.

`verifyEvidenceV2SourceStructure` proves total coverage, containment and unique
binding against the original text, independently of the derivation.

`createEvidenceV2SourceIndex` gives constant-time part and unit lookup so the
structure is derived once and never recomputed per lookup.

This package must not depend on the frozen application listed in ADR-0047 §4.
`pnpm boundaries` enforces that.
