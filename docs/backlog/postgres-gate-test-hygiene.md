# PostgreSQL gate: two non-idempotent frozen-app tests

Status: Proposal. Not activated. Observed during ACME-0153.

## Discovery context

`pnpm test:postgres` does not pass cleanly, and has not for at least as long as
ACME-0153's baseline. Two failures, both in tests belonging to the frozen
application, both independent of the V2 work:

1. `tests/postgres/evidence-stage-a-import.test.ts` — "resumes a live
   observation after provider success without a second call" expects
   `LIVE_PRODUCT_PROJECTION_INTERRUPTED` and receives `MODEL_INVALID_RESPONSE`.
   It fails on a **clean** database.
2. `tests/postgres/evidence-workbench-restart.test.ts` — "retains sources and
   review decisions across process close and reopen" fails with
   `EvidenceProductCommandCollisionError` on a **reused** database, because it
   writes a fixed artifact command key into the shared `acme` schema that an
   earlier run already stored with different content.

## Attribution

Measured, not assumed. With ACME-0153's working tree stashed, at commit
`6c73843`:

```text
clean database   1 failure of 41   (stage-a resume)
same database    2 failures of 41  (stage-a resume + restart collision)
```

and with ACME-0153 applied, on a clean database, 1 failure of 42 — the same
one. The V2 work changes neither test.

## Proposed outcome

- The restart test provisions its own schema, or derives its command keys per
  run, so the gate is idempotent against a reused database.
- The stage-A resume expectation is re-derived from what the job now does, or
  the behaviour is fixed if the expectation is the correct one. Deciding which
  requires reading the job, and that is the work.

## Why it is outside the ACME-0153 charter

ACME-0153 wires authentication into the V2 app. Its Out of Scope forbids any
change to the frozen set, and both tests exercise frozen-application behaviour.
ADR-0047 §4 permits maintenance that preserves the frozen application's
diagnostic value, which is exactly what this would be — chartered separately.

## Suggested verification

- The full gate passes twice in a row against the same database.
- The gate passes on a clean database.
- No frozen-application source changes unless the stage-A expectation turns out
  to be describing a real defect, in which case that becomes its own finding.
