# Driver-level errors reach the caller as non-retryable `INTERNAL`

Status: Open proposal. Not activated.

## Discovery context

Found while proving Milestone 2 rollback in ACME-0034. A fault injected inside
the SQLite `BEGIN IMMEDIATE` transaction rolls back correctly, but the failure
that reaches the caller is:

```text
code: INTERNAL
message: Execution failed with an unexpected internal error.
retryable: false
```

`errorData()` in `packages/core/src/execution-engine.ts` maps anything that is
not an `AcmeError` — and not an object already shaped like one — to that
frozen fallback. Neither repository adapter translates driver errors, so every
`better-sqlite3` failure takes this path.

The injected fault is synthetic, but `SQLITE_BUSY` is not. Under WAL a second
writer that exceeds the busy timeout raises exactly this kind of driver error
while the correct ACME classification is a retryable `PERSISTENCE_TRANSIENT`.
The taxonomy already has the right code; nothing populates it.

The proposal is therefore domain-neutral at the public boundary: ACME exposes
generic persistence classes and retryability, while each concrete adapter owns
the mapping from its driver's private codes. It does not bind core statuses to
SQLite or `better-sqlite3`.

## Proposed outcome

The SQLite adapter classifies driver errors it recognizes before they leave
the adapter:

- `SQLITE_BUSY`, `SQLITE_BUSY_SNAPSHOT`, `SQLITE_LOCKED` →
  `PERSISTENCE_TRANSIENT`, retryable
- corruption and constraint codes → `PERSISTENCE_CORRUPTION`, non-retryable
- everything else keeps the current fallback

The conformance suite would then require that an adapter never surfaces a raw
driver error to a caller.

## Why it is outside the active charter

ACME-0034 is a verification task. Its Definition of Done covers rollback and
compare-and-swap outcomes, and its Out of Scope explicitly excludes
reclassifying driver errors. Changing the error taxonomy's population rules is
runtime behavior with its own compatibility surface, and it deserves a
separate decision about how much provider- and driver-specific vocabulary may
live in an adapter.

## Dependencies

- ADR-0003 (`BEGIN IMMEDIATE` unit of work)
- ADR-0013 (durable SQLite schema and driver)
- the retry semantics of `retryable` for callers, which nothing consumes yet

## Suggested verification

- an adapter unit test that provokes a real `SQLITE_BUSY` with
  `busy_timeout = 0` on a second connection and asserts the classified error
- a conformance case asserting no raw driver error escapes any repository
- the existing ACME-0034 rollback test, updated to expect the new code, which
  will show the improvement rather than hide it
