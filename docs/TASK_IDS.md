# Task ID Register

Floor: ACME-0169

This register allocates task identities. It records that a number is taken and
by whom. It never records whether work is in progress, complete or abandoned:
task state belongs to `docs/CURRENT_TASK.md` and `docs/finished/`, and a second
statement about it here would drift from both and would make the trunk claim
how much work is active across the repository.

Identities below the floor were allocated before this register existed. They
are addressed by `docs/finished/` under the `ACME-NNNN_task-slug.md` naming
convention and are deliberately not backfilled: inventing an owner and a claim
date for 168 historical tasks would be inventing evidence.

## How to claim

1. The next free identity is one above the highest of this register and
   `docs/finished/`.
2. Append one row at the end of the table below. Never insert into the middle,
   never sort, never group by owner. The append point is the safety mechanism:
   two people claiming at the same moment edit the same region and the second
   one gets a merge conflict instead of a silent duplicate.
3. Merge the claim to `main`. The identity is not yours until that lands.
4. Only then move the charter to `Ready`.

If you are about to freeze a charter and are unsure whether the claim landed:

```bash
git ls-remote --heads origin && gh pr list --state open
```

`pnpm docs:check` verifies that this table is strictly ascending, free of
duplicates, carries no status column, and covers every archived task at or
above the floor as well as the active task.

## Claims

| Task ID | Title | Owner | Claimed | Work |
| --- | --- | --- | --- | --- |
| ACME-0169 | optional runnable canonical runtime composition | felixnissen | 2026-08-19 | PR #38 |
| ACME-0170 | addressing and discoverability | Claude | 2026-08-19 | concept/docs-first_opensource |
| ACME-0171 | prose path citations | Claude | 2026-08-19 | concept/docs-first_opensource |
| ACME-0172 | task ID claim register | Claude | 2026-08-19 | concept/docs-first_opensource |
| ACME-0173 | docs-first protocol repository bootstrap | Claude | 2026-08-19 | task/acme-0173-protocol-repo-bootstrap |
| ACME-0174 | deterministic reuse observability | felixnissen | 2026-08-26 | contrib/acme-0174-reuse-observability |
| ACME-0175 | open-source release and commercial boundary | felixnissen | 2026-08-26 | felix/acme-0175-open-source-commercial-readiness |
