# ADR-0043: Runtime-derived observation quotes

Status: Accepted

Date: 2026-08-15

## Context

ACME-0117 proved that a strict provider output field containing one line and at
most 500 characters still does not establish canonical source membership. The
provider returned eight complete schema-valid candidates. Three quotes were
exact; four compressed content across canonical line boundaries while changing
whitespace and/or punctuation, and one also changed alphanumeric content. Exact
semantic binding refused five candidates and committed nothing.

ADR-0042 correctly moved locator authority into runtime but still let the model
author the text that runtime searched. Prompt compliance and a wire-level
newline prohibition cannot make probabilistic text reproduction canonical.
Historical contracts `@1.0.0` through `@1.4.0` have retained evidence and cannot
be edited.

## Decision

1. Active `evidence.observe-artifact@1.5.0` uses output
   `evidence-observe-artifact-output/4`. A candidate selects a
   `sourceSegmentId`; it contains no provider-authored exact quote or locator.
2. Runtime canonicalizes source text as before, preserves LF line boundaries
   and divides each non-empty line into unchanged chunks of at most 500 Unicode
   code points. A segment never crosses a line. Its identifier encodes the
   one-based line and chunk ordinal deterministically.
3. The provider request contains the runtime-authored segment identifiers and
   their exact text. Runtime accepts only an identifier in that supplied set,
   copies the entire segment as `exactQuote` and derives the single-line
   locator. Actor-label and temporal source-binding validation use that runtime
   quote.
4. Segment selection remains an untrusted candidate decision. Segment text,
   locator and canonical observation identity remain runtime authority. An
   unknown identifier refuses the batch; there is no fuzzy matching, offset
   interpretation or quote repair.
5. Contracts `@1.0.0` through `@1.4.0` and outputs `/1` through `/3` remain
   registered and byte-exact for replay. The task interpreter supports all
   historical forms plus active segment selection.
6. The one-to-eight non-exhaustive batch remains. Segment construction and a
   successful batch do not establish full-source coverage.

## Consequences

- Active provider output can no longer normalize, paraphrase, join or truncate
  canonical quote text.
- Duplicate source text is unambiguous because the selected segment identifier,
  not global quote uniqueness, supplies its canonical line.
- Long canonical lines create multiple stable candidate segments without
  changing their characters; whitespace-only lines yield no candidates.
- The provider request grows by deterministic segment identifiers but replaces
  the prior raw text field rather than duplicating source content.
- A new separately frozen provider acceptance is required after the offline
  implementation is green.

## Rejected alternatives

- **A stronger copy-verbatim prompt:** ACME-0115 and ACME-0117 demonstrate that
  provider text reproduction can normalize or combine source text.
- **Whitespace or punctuation repair:** repair can bind a different passage and
  makes canonical evidence depend on heuristic similarity.
- **Provider-authored character offsets:** ACME-0113 already established that
  probabilistic counting is not canonical locator authority.
- **Use the first global quote occurrence:** duplicate text would remain
  ambiguous and occurrence order would invent provider intent.
