# Acceptance Records

Discoverability: index. Every member of this directory is listed below.
Member state: required. Every member declares a `Status:` line under its
title.

This directory holds acceptance and proof records: what was measured, under
which task, and what the result is allowed to claim. A record here is evidence,
not design authority. Normative behavior stays in `docs/design/`, decisions in
`docs/adr/` and current reality in `docs/CURRENT_STATUS.md`.

Records marked frozen are immutable evaluation output. They are never edited,
re-run in place or corrected; a superseding record is added instead.

These records cite source and test files by path as the evidence behind their
claims. Those paths are bound by the addressing invariant in `AGENTS.md`: a
cited file keeps its path, so that a frozen report never points at nothing.

## Records

| Record | State |
| --- | --- |
| [`ACME-0133-frozen-acceptance-report.md`](ACME-0133-frozen-acceptance-report.md) | Frozen immutable evaluation output, outcome-blind |
| [`ACME-0136-frozen-acceptance-report.md`](ACME-0136-frozen-acceptance-report.md) | Frozen immutable evaluation output, outcome-blind |
| [`ACME-0136-post-freeze-comparison.md`](ACME-0136-post-freeze-comparison.md) | Separate from the frozen report; compared 2026-08-16 |
| [`ACME-0175-open-source-secret-audit.md`](ACME-0175-open-source-secret-audit.md) | Verified scoped credential audit, 2026-08-26 |
| [`poc-1-reusable-execution-proof.md`](poc-1-reusable-execution-proof.md) | Measured and scoped, 2026-08-17, from the ACME-0154 run under ACME-0155 |
