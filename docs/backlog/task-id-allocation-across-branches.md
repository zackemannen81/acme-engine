# Task IDs are allocated from a view that cannot see other branches

Status: Resolved by ACME-0172 (2026-08-19), which implemented option 2, the
trunk register at `docs/TASK_IDS.md`. Kept for discovery context; do not
re-activate as open work.

## Discovery context

On 2026-08-19 two tasks were frozen under the same Task ID by two actors
working in parallel.

Felix opened PR #38 at 13:04 with `ACME-0169: add optional runnable canonical
runtime composition`, carrying the ID in sixteen commit messages, the branch
name `felix/acme-0169-runnable-runtime-composition`, the PR title and CI
history. An hour later, work on `concept/docs-first_opensource` froze a
different `ACME-0169` charter, because the next free ID was derived from
`docs/finished/` and a grep of the local tree — neither of which can see an
unmerged branch belonging to someone else.

The collision was resolved by renumbering the later pair to ACME-0170 and
ACME-0171, since renaming sixteen published commits would have required a
force-push and broken an open review.

## Why this will recur

Nothing about the resolution prevents the next collision. The repository
currently has several open `felix/*` branches, and the allocation rule is
"look at `docs/finished/` and pick the next number". Two actors starting work
on the same day from the same trunk will always compute the same next ID.

A Task ID is an identity in exactly the sense ACME-0170 made normative: it is
cited by journal entries, archived tasks, branch names, commit messages and
pull requests. Two records sharing one identity is the same class of defect as
two records sharing a path.

## Proposed outcome

Make ID allocation observable across branches before a charter is frozen.
Options, cheapest first:

1. Require a remote check before freezing: `git ls-remote --heads origin` plus
   open pull requests, looking for the intended `ACME-NNNN`. Costs one command
   and catches the common case, but relies on discipline.
2. Reserve the ID on the trunk: a small `docs/TASK_IDS.md` register where the
   number is claimed in a one-line change merged to `main` before work starts.
   Deterministic, at the cost of an extra round trip.
3. Derive the ID from an external allocator that is already unique, such as the
   issue or pull-request number. Removes the problem, but breaks the existing
   `ACME-NNNN` sequence and every historical reference pattern.

## Why this is outside the active task

The collision was discovered while closing ACME-0170 and ACME-0171, whose
frozen charters cover addressing of files and citations, not allocation of task
identities. Choosing between a discipline rule, a trunk register and an external
allocator affects the workflow document and every contributor, and needs its own
charter.

## Dependencies

- `docs/TASK_WORKFLOW.md` and `AGENTS.md` state the current allocation rule and
  would carry the new one.
- No product, contract or persistence dependency.

## Suggested verification

- Two branches created from the same trunk cannot both freeze the same ID
  without one of them observing the conflict.
- The chosen mechanism is checkable by `pnpm docs:check` or by a documented
  command, not only by memory.
- Existing `ACME-NNNN` references keep resolving.
