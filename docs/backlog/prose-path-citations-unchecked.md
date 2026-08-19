# Repository paths cited as prose are never validated

Status: Resolved by ACME-0171 (2026-08-19). Discovered while scoping ACME-0170.
Kept for discovery context; do not re-activate as open work. The check
validates present-tense surfaces and warns on history, and the mock that
motivated this proposal is now protected by the normative Test UI
specification that cites it.

## Discovery context

`tooling/docs/check-docs.mjs` validates Markdown link targets. It does not see
a path written as backticked prose, and a large share of ACME's documentation
cites files that way.

The clearest case is the Domain Test UI mock. It is referenced five times —
from `docs/design/domain-test-ui-specification.md`, `docs/CURRENT_STATUS.md`,
`docs/FILESTRUCTURE.md`, `docs/backlog/domain-test-ui-implementation.md` and
the archived `docs/finished/ACME-0038_domain-test-ui-specification-rewrite.md`
— and not once as a Markdown link. If the file were renamed or deleted today,
`pnpm docs:check` would stay green and all five references would rot silently.

This is a weaker failure mode than the 2026-08-19 backlog rename, which at
least failed loudly. Here the repository would keep claiming a path that no
longer exists, including from a normative specification.

## Proposed outcome

Validate repository-relative paths that appear as inline code, not only those
that appear as links.

## Why this is outside the active task

ACME-0170 makes the addressing invariant authoritative and enforces collection
indexes and path stability. It deliberately does not change how citations
themselves are written or parsed. Adding prose-path validation would expand a
frozen charter and carries a design question that ACME-0170 does not need to
answer.

## The design question this needs

Enforcement cannot apply everywhere. `docs/JOURNAL.md` and `docs/finished/`
intentionally mention paths that no longer exist, because they record what was
true at the time — the removal of the `hrd` directories and the proposals
closed by ACME-0029 and ACME-0030 are examples. Validating prose paths in
append-only history would fail immediately and could only be satisfied by
rewriting records that must not be rewritten.

A workable scope is therefore surfaces that describe the present:

- validate in `docs/design/`, `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`,
  `docs/FILESTRUCTURE.md`, `docs/acceptance/`, `AGENTS.md` and collection
  indexes;
- do not validate in `docs/JOURNAL.md`, `docs/finished/` or accepted ADRs;
- recognize a citation as a candidate only when it contains a path separator
  and a file extension, so that `packages/core` and prose remain unaffected.

## Dependencies

- ACME-0170, which establishes the addressing invariant this would extend.
- No product, contract or persistence dependency.

## Suggested verification

- `pnpm docs:check` still passes on the current tree once the scope above is
  applied, or every failure it reports is a genuine stale citation.
- A broken fixture in a validated surface fails the check.
- The same broken citation inside `docs/JOURNAL.md` does not fail the check.
- `pnpm format:check` and `pnpm lint` pass.
