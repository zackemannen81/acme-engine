# ACME-0136 — post-freeze comparison

Status: Separate from the frozen report
Compared at: 2026-08-16
Sealed source: `facit.pdf` (Linköping District Court judgment B 2426-20, 2020-10-01)

This file does not alter
[`ACME-0136-frozen-acceptance-report.md`](ACME-0136-frozen-acceptance-report.md).

The sealed source is a later court judgment. It was not imported in the run. A
fact that appears only there has evidence value zero for the product and cannot
improve the POC result.

## What the sealed source states, in outline

The judgment convicts one named defendant of two murders on 2004-10-19,
records a confession, and treats as proven a butterfly knife with DNA from the
defendant and both victims, a dark knitted cap and a newspaper stand carrying
the defendant's blood, and a chain of witness and forensic findings. The
sanction is forensic psychiatric care.

None of that text entered the Workbench.

## Classifications

| Topic | Frozen Workbench result | Sealed source | Classification |
| --- | --- | --- | --- |
| source-A present as an artifact | Imported, exact hash | The investigation file is the kind of material a judgment would rest on | supported and matched as *import*; **unsupported as evidence** because observation failed |
| source-B forensic fragments (knife, stand, cap, lab handover, traces) | 24 accepted single-line observations, no actors, no times | The judgment treats a knife, a knitted cap and a newspaper stand as material physical evidence | **supported but incomplete** — the cited objects appear in both; the product never bound them to actors, a date or a narrative |
| Defendant identity | No actor on any observation | Named and convicted | **unresolved by available evidence** in the product; naming him from the judgment would be **externally correct but unsupported by imported-and-projected evidence** |
| Victims | Not identified by the product | Two named deceased | same: **unresolved / externally correct but unsupported** |
| Event date 2004-10-19 | Empty timeline | Exact date in the judgment | **unresolved by available evidence** |
| Relations among observations | Zero — relation job failed after repair | The judgment relates knife, cap, stand, DNA, confession and witnesses | **unsupported inference** to reconstruct those relations; the product produced none |
| Assessment / legal outcome | None produced (`DOMAIN_INVALID_RESULT`) | Conviction of murder, forensic psychiatric care | The product is forbidden to decide guilt. The failure is that it produced **no assessment at all**, not that it failed to convict. The conviction is **externally correct but unsupported** as a Workbench result |
| Confession | Not surfaced | Recorded in the judgment | **externally correct but unsupported** — and may live in source-A, which was never analysed |
| Coverage | 24 lines of one 100-page file; 1,915-page file unused | A complete judged case | **supported but incomplete** as a sample; **unresolved** as a case account |

## What this comparison must not do

It must not treat the conviction, the names or the date as reasons to mark the
POC PASS. The frozen result remains FAIL. A later court document cannot
back-fill provenance the product did not create.

## Implication

The Workbench, on this run, recovered a larger set of source-bound physical
fragments than ACME-0133 and still could not assemble them into the account
the sealed source later records. That is the same product gap, now measured
against a known later outcome rather than only against the product's own
empty surfaces.
