# ADR 0033 — PostgreSQL persistence architecture

Status: Accepted

Date: 2026-08-12

Decision owners: ACME maintainers

## Context

[ADR-0029](0029-poc-1-self-hosted-supabase-persistence-platform.md) decided that
POC #1 runs on self-hosted Supabase and that the ACME repository adapter speaks
plain PostgreSQL over the wire protocol rather than any Supabase-specific API.
It deliberately left two items open: "schema separation between product tables
and ACME persistence" and "the migration tooling and rollout order for the
adapter".

The
[technical specification](../design/evidence-integrity-workbench-technical-specification.md)
names slice 7's prerequisites as "slice 6 and a new PostgreSQL
schema/transaction/migration ADR". Slice 6 closed with ACME-0083. This ADR is
the remaining prerequisite.

Three facts shape every decision below.

**ACME's identity system is content-derived.** Execution identity, operation
keys, request fingerprints, transition identity, the operation digest and
replay equality are all SHA-256 over `acme-cjson-1` canonical JSON. The durable
adapter's contract is not "stores the same information" but "reproduces the same
bytes". `@acme/adapter-sqlite` is proven byte-equal to `@acme/adapter-memory`
for the same execution, and the PostgreSQL adapter inherits that obligation.
Several ordinary PostgreSQL choices break it silently, far from where the choice
was made.

**SQLite's single-writer constraint is doing unstated work.** `BEGIN IMMEDIATE`
serializes every writer, so the SQLite adapter can read-then-write without a
race and can lease outbox rows with a select followed by per-row updates.
PostgreSQL under `READ COMMITTED` permits concurrent writers by design. Every
place the SQLite implementation relies on that serialization has to be
re-derived rather than translated.

**The observable contract is already fixed by proofs, not by prose.** The shared
repository conformance kit, the Milestone 2 rollback and compare-and-swap
proofs, ADR-0017 resume and ADR-0018 outbox semantics assert specific error
codes, specific ordering and specific absence of side effects. A PostgreSQL
adapter that is "correct" but reports a different conflict code fails the suite,
and rightly so.

One constraint that turned out not to exist is worth recording: the
`ExecutionRepository` port in `packages/core/src/repository.ts` is already
`Promise`-based on every method. An asynchronous driver therefore requires no
core change, and this entire decision stays inside an adapter.

## Decision

### 1. Driver and pool ownership

`@acme/adapter-postgres` depends on `pg` (node-postgres) 8.x in pure-JavaScript
mode. `pg-native` is not used.

`pg` is the plain-wire client ADR-0029 requires, and being pure JavaScript it
carries none of the native-prebuild exposure that G18 records for
`better-sqlite3`.

The adapter does not own connection lifecycle. It receives an injected pool or
client provider and never constructs a pool, never reads an environment
variable, never sizes a pool and never calls `end()`. The composition root
owns creation, sizing and shutdown. This keeps the adapter free of policy, as
the dependency rules require, and makes every proof below executable against an
injected connection.

**Connection mode is a requirement, not a configuration preference.** The
adapter connects to the direct PostgreSQL port. It must not be routed through a
transaction-mode connection pooler, because transaction pooling invalidates
prepared statements and session-scoped session state. The exact direct port of
the deployed self-hosted release is verified by the slice 7 charter and recorded
in its operations documentation; it is not assumed here.

### 2. Schema ownership and separation

Two schemas, two roles, two migration ledgers:

| Schema | Contents | Owning role | Migration ledger |
| --- | --- | --- | --- |
| `acme` | executions, attempts, model calls, documents, memory candidates and records, state snapshots, transitions, state heads, domain events, outbox, execution commits, quality evaluations | `acme_engine` | `acme.schema_migrations` |
| `evidence` | workspaces, sources, observations, relations, open questions, assessments, jobs, review decisions | `evidence_app` | `evidence.schema_migrations` |

Quality evaluations stay inside `acme`. [ADR-0026](0026-durable-quality-evaluation-store.md)
requires lifecycle independence from the execution ledger, and that is already
structural through the absence of a foreign key. A third schema would add a
third migration ledger and buy nothing.

Two rules make the separation real rather than cosmetic:

- **No cross-schema foreign key and no cross-schema transaction.** The Evidence
  product references engine identifiers — execution id, operation digest — as
  opaque strings it does not resolve in SQL. Engine and product commit
  independently. This is what keeps the append-only review overlay of
  [ADR-0031](0031-evidence-review-overlay-and-versioned-views.md) genuinely
  separate from execution evidence, and it is what makes either store
  relocatable without touching the other.
- **Every identifier is schema-qualified in the SQL text.** The adapter does not
  rely on `search_path`. A pooled connection carrying unexpected session state
  must not be able to write into the wrong schema.

### 3. Browser isolation from ACME schemas

ADR-0029 forbids browser-to-database access against a platform whose default
behavior is to expose tables to a browser through PostgREST and an anonymous
key. That requirement is discharged mechanically:

- `acme` and `evidence` are revoked from the platform's browser-facing roles
  (`anon`, `authenticated`) and are absent from the exposed-schema list;
- the product API holds credentials server-side and is the only database
  client; and
- row-level security is not accepted as a substitute, as ADR-0029 already
  states.

**This is a test, not a configuration note.** Slice 7 must include a gate that
connects as the anonymous role and asserts permission denied against both
schemas. A comment in a configuration file does not hold a boundary over time;
a failing test does.

### 4. Transaction boundary, isolation level and compare-and-swap

The Unit of Work is unchanged in shape: one transaction, one dedicated client,
every canonical effect and the terminal execution projection committed
atomically, exactly as [ADR-0003](0003-sqlite-revisioned-unit-of-work.md)
requires.

**Isolation level is `READ COMMITTED`.** Concurrency safety comes from explicit
conditional writes, not from the isolation level.

Compare-and-swap on state heads is a conditional update whose affected row count
is the verdict:

```sql
UPDATE acme.state_heads
   SET revision = $3, snapshot_id = $4, updated_at = $5
 WHERE namespace = $1 AND entity_id = $2 AND revision = $6
```

An affected row count of zero raises `CONFLICT_STATE_REVISION`. The identical
shape over `acme.memory_records.record_version` raises
`CONFLICT_MEMORY_VERSION`. These are the exact codes the existing conformance
suite and the Milestone 2 contended-write proof assert.

**Idempotency checks are `INSERT ... ON CONFLICT DO NOTHING` plus a row-count
test, never select-then-insert.** This is the single most important translation
rule in this ADR. `accept()` and the ledger-evidence guards are safe in SQLite
only because `BEGIN IMMEDIATE` excludes concurrent writers; the same code under
`READ COMMITTED` races. Conflicts are therefore detected by row count rather
than by exception, which also keeps them out of the driver-error mapper
described in section 8.

Every transaction sets a bounded `lock_timeout` and `statement_timeout`. A
stalled commit that holds locks is a worse failure than a fast classified error.

### 5. Outbox leasing

Leasing is one atomic statement using `FOR UPDATE SKIP LOCKED`, replacing
SQLite's select-then-update-each-row loop:

```sql
UPDATE acme.outbox AS o
   SET status = 'claimed',
       attempt_count = o.attempt_count + 1,
       available_at = $2,
       claimed_at = $3
 WHERE o.event_id IN (
   SELECT event_id
     FROM acme.outbox
    WHERE status IN ('pending', 'claimed')
      AND available_at <= $1
    ORDER BY occurred_at, event_id
      FOR UPDATE SKIP LOCKED
    LIMIT $4)
RETURNING event_id
```

Everything [ADR-0018](0018-outbox-delivery-boundary.md) fixes is preserved:
claim order is `occurred_at` then `event_id`, the lease is a visibility timeout
on `available_at`, delivery is at-least-once, retry policy stays with the
caller, `failed` remains terminal until an explicit redrive, and the persisted
status value stays `claimed` because the core vocabulary guard forbids `claim`
in the API surface.

No advisory lock is used here. The row status plus `SKIP LOCKED` is sufficient
and stays inside the one transaction.

`SKIP LOCKED` gives behavior SQLite could not: concurrent drainers receive
disjoint batches instead of serializing on a file lock. That is a deliberate
improvement, and section 10 requires it to be proven rather than assumed.

### 6. Canonical value representation

**Canonical `acme-cjson-1` values are stored as `text`. `jsonb` is refused.**

`jsonb` does not preserve key order, drops duplicate keys, normalizes whitespace
and rewrites the textual form of numbers. Each of those alone destroys byte
fidelity, and byte fidelity is what the content-derived identities, the
operation digest, `loadReplayEvidence()` and the byte-equality proof against the
in-memory adapter depend on. The failure would not be a rejected write; it would
be a digest that quietly stops matching.

PostgreSQL `json` would preserve the input text, but it invites querying the
column with JSON operators, which is precisely the practice this rule exists to
prevent. `text` states the intent structurally: this is an opaque canonical byte
string, not a queryable document.

The same reasoning fixes three more mappings:

| Value | Type | Reason |
| --- | --- | --- |
| Canonical JSON (`request_json`, `record_json`, `candidate_json`, `value_json`, `selection_json`, …) | `text` | Byte fidelity for content-derived identity |
| Timestamps | `text`, ISO-8601 UTC | `timestamptz` round-trips through session timezone and microsecond precision and rewrites the exact string the contracts carry |
| Content hashes and digests | `text` | Matches SQLite and keeps evidence comparison a string comparison |
| Memory strength | `double precision` | Direct equivalent of SQLite `REAL` |
| Surrogate keys (`attempt_id`, `candidate_id`) | `bigint GENERATED ALWAYS AS IDENTITY` | Adapter-internal; no contract value derives from them |

`CHECK` constraints, `UNIQUE` constraints and the scoped uniqueness of
`state_transitions.operation_key` per `(namespace, entity_id)` fixed by
[ADR-0013](0013-durable-sqlite-schema-and-driver.md) are carried over unchanged.
Sealed payload columns under
[ADR-0016](0016-encrypted-payload-retention.md) remain opaque `text`.

Where operators later want queryability, the escape hatch is a generated
companion column beside the authoritative `text` column. A generated column may
be read by operators and by nothing else; it is never read back into a contract
value.

### 7. Migrations

The [ADR-0003](0003-sqlite-revisioned-unit-of-work.md) and ADR-0013 model is
reused unchanged in form: numbered, ordered, forward-only migrations declared as
`{version, name, statements}`, checksummed as
`sha256(acme-cjson-1({version, name, statements}))`, recorded in a
`schema_migrations` table, with an unknown recorded version or a mismatched
checksum refusing startup as `PERSISTENCE_CORRUPTION`.

No third-party migration tool is adopted for either schema. Flyway,
`node-pg-migrate` and the platform's own migration CLI would each take ownership
of exactly the checksum semantics ADR-0013 deliberately owns.

Four decisions are specific to PostgreSQL:

- **Separate ledgers.** `acme.schema_migrations` and
  `evidence.schema_migrations` advance independently.
- **Own baseline.** The PostgreSQL `acme` schema starts at version 1
  (`initial-revisioned-unit-of-work-pg`) with its own statements and therefore
  its own checksums. The SQLite migration source is not shared and the
  checksums are not comparable. Sharing `migrations.ts` across the two adapters
  is a defect, not an optimization.
- **Concurrent-migration locking.** The migration transaction begins by taking a
  transaction-scoped advisory lock, `pg_advisory_xact_lock`, on a fixed key
  derived from the schema name as the leading 8 bytes of its SHA-256 read as a
  signed 64-bit integer and recorded as a constant in the migration runner.
  Without SQLite's single-writer constraint, an API process and a worker process
  starting together will otherwise migrate concurrently. The lock is
  transaction-scoped so it releases on commit or rollback without a cleanup
  path.
- **Atomicity comes free.** PostgreSQL's transactional DDL applies the whole
  pending migration set atomically, so the explicit wrapper SQLite needed is not
  required to obtain the same guarantee.

**Execution ownership.** An explicit migrate command is authoritative. Process
startup verifies the recorded versions and checksums and refuses to serve
against an un-migrated schema or one ahead of the code it is running. SQLite
migrates on open because it opens a local file; a shared server must not be
migrated as a side effect of a worker booting.

**Rollout is forward-only.** There are no down migrations, matching ADR-0003.
Any later change that a still-running previous version would break must be split
into expand, deploy, contract.

### 8. Driver error classification

The [ACME-0057](../finished/ACME-0057_driver-error-classification.md)
classification shape is preserved, keyed on SQLSTATE rather than driver name
strings. No raw driver error escapes the repository boundary.

| Class | SQLSTATE | Retryable |
| --- | --- | --- |
| `PERSISTENCE_TRANSIENT` | `40001` serialization failure, `40P01` deadlock detected, `55P03` lock not available, `57014` query canceled, `53200` out of memory, `53300` too many connections, class `08` connection exceptions, `57P01`–`57P03` shutdown and cannot-connect-now | yes |
| `PERSISTENCE_CORRUPTION` | class `23` integrity-constraint violations not already resolved as domain conflicts, `42601` syntax error, `42P01` undefined table, `42703` undefined column, `42P07` duplicate table, `XX000` internal error, `XX001` data corrupted, `XX002` index corrupted | no |
| `INTERNAL` | everything else | no |

Two classifications need their reasoning recorded, because neither is obvious.

**Undefined table and undefined column are corruption, not internal errors.**
They mean the live schema does not match the code addressing it, which is
exactly the condition checksum verification exists to detect. Reporting them as
generic internal errors would hide a schema-drift incident behind a stack trace.

**`08007` transaction resolution unknown is classified retryable, and that is
safe only because of an existing property.** The repository proves identical
commit replay without new writes and without new ID allocation. Retrying a
commit whose outcome is unknown therefore converges rather than duplicating. If
that property were ever weakened, this classification would have to change with
it.

**The divergence that must not be missed:** unique violations on the idempotency
and revision constraints must reach the domain conflict outcomes —
`CONFLICT_STATE_REVISION`, `CONFLICT_MEMORY_VERSION`, or the `accept()` conflict
result — before the generic mapper sees them. In SQLite these rarely surface as
constraint errors because the immediate lock prevents the race; in PostgreSQL
they will. Left unhandled, an ordinary concurrency outcome would be reported as
`PERSISTENCE_CORRUPTION` and an operator would be paged for a healthy system.
The structural defense is section 4's row-count detection; the constraint
mapping remains only as a backstop.

### 9. Connection lifecycle

- **One dedicated client per Unit of Work**, checked out for the whole
  transaction and released in a `finally`, encapsulated in a single transaction
  helper so no repository method can bypass it. A leaked client against a
  bounded pool deadlocks the process, and this is the most common operational
  failure of `pg` adapters.
- **Multi-statement read sets run inside a read-only repeatable-read
  transaction.** `loadContext()` and `loadReplayEvidence()` build read sets that
  [ADR-0012](0012-milestone-1-execution-identity-and-replay.md) treats as
  internally consistent. Under `READ COMMITTED`, separate statements observe
  different snapshots and would produce a torn read set with no error raised.
  Single-statement reads may use the pool directly.
- **Pool sizes are small, explicit and documented** against the server's
  connection limit, with the platform's own internal consumers accounted for.
  Each process sets a distinguishable application name so server-side activity
  is attributable.
- **Shutdown drains the pool** after in-flight work. Cancellation remains
  cooperative under
  [ADR-0027](0027-async-launch-job-progress-cancellation.md) and never rolls
  back a committed ledger write.

### 10. Verification environment and test isolation

Three tiers, answering three different questions.

**Continuous integration and default development run against an ephemeral plain
PostgreSQL container, not Supabase.** Passing on vanilla PostgreSQL is the
stronger proof of ADR-0029's adapter boundary: if the suite is green there, no
Supabase-specific dependency has crept in. The container's major version is
pinned to the version the deployed self-hosted release actually ships, verified
by the slice 7 charter rather than assumed here.

**One self-hosted Supabase instance is the manually run integration
environment**, where browser isolation, PostgREST exposure, role permissions and
operations procedures are proven. It is not a per-commit gate.

**Test isolation is schema per test run.** A schema named for the run is created
and migrated, and dropped with a single cascading statement afterwards. Table
name prefixes are rejected: they pollute every SQL string and defeat schema
qualification. Database per test is rejected: each would need its own migration
run and its own pool, which is too slow to sit inside the conformance kit.

**Gating mirrors the live provider gate exactly.** PostgreSQL tests live under
their own vitest configuration, excluded from `vitest.config.ts`, and refuse
rather than skip when the connection variable is absent. This is required, not
stylistic: `pnpm test:conformance` runs against the default configuration, so a
PostgreSQL conformance test placed in `tests/conformance` would break the
hermetic offline default suite that the repository depends on.

Slice 7 inherits these proof obligations unchanged: the shared repository
conformance kit, the quality evaluation store conformance kit, the Evidence
product repository conformance kit, aggregate transaction rollback, contended
expected-revision write, ADR-0017 resume and replay, append-only review ordering
and migration plus reopen.

It adds three PostgreSQL-specific gates:

1. Two concurrent drains lease disjoint outbox sets, and no event is delivered
   twice within one lease window.
2. A connection as the anonymous browser-facing role is denied against both
   schemas.
3. Two processes starting concurrently against an un-migrated schema produce
   exactly one applied migration set.

### 11. Per-POC persistence isolation

**One instance, separate schemas. Not one instance per POC.**

A separate instance per POC multiplies exactly the operational burden ADR-0029
already records as a negative — backups, restores, upgrades, patching,
monitoring, key lifecycle — none of which exists yet, and buys no isolation that
schemas and roles do not already provide.

What actually makes a POC carry itself is not the instance boundary: it is that
the product store is a separate package behind its own port, with its own
schema, its own migration ledger and no foreign key into `acme`. Where that
holds, moving a later POC onto its own instance is a connection-string change.

**The revisit trigger is a data classification boundary, not a second POC.** The
recorded policy is one instance per data classification. ADR-0028 blocks any
non-synthetic data path until slice 9 authority exists, so that trigger does not
exist today.

### Traceability

Every decision above either inherits an existing authority or originates here.
Nothing is left implicit.

| Decision | Authority |
| --- | --- |
| Plain-wire adapter, no Supabase API | ADR-0029 |
| `pg` driver selection, pure JavaScript | New, this ADR |
| Injected pool, adapter owns no lifecycle | Dependency rules in `AGENTS.md`; mechanism new here |
| Direct connection port, no transaction-mode pooler | New, this ADR |
| Schema separation `acme` / `evidence` | ADR-0029 open item, closed here |
| Quality evaluations inside `acme`, no foreign key | ADR-0026 |
| No cross-schema foreign key or transaction | New, this ADR |
| Browser isolation from ACME schemas | ADR-0029; executable gate new here |
| One aggregate transaction per Unit of Work | ADR-0003 |
| `READ COMMITTED` plus conditional-update CAS | New, this ADR |
| `CONFLICT_STATE_REVISION` / `CONFLICT_MEMORY_VERSION` | ADR-0003 and the existing conformance proofs |
| Outbox lease semantics, claim order, `claimed` status | ADR-0018 |
| `FOR UPDATE SKIP LOCKED` leasing mechanism | New, this ADR |
| Canonical JSON as `text`, `jsonb` refused | ADR-0013 canonical-JSON pattern; PostgreSQL type rule new here |
| Timestamps as ISO-8601 `text` | New, this ADR |
| Sealed payload columns remain opaque | ADR-0016 |
| Migration format and checksum algorithm | ADR-0003 and ADR-0013 |
| Per-schema ledgers, own baseline, advisory lock, explicit migrate command | ADR-0029 open item, closed here |
| Forward-only rollout | ADR-0003 |
| SQLSTATE error classification into the existing taxonomy | ACME-0057 shape; SQLSTATE mapping new here |
| Read-only repeatable-read multi-statement read sets | ADR-0012 consistency expectation; mechanism new here |
| Cancellation never rolls back a commit | ADR-0027 |
| Verification environment and test isolation | New, this ADR |
| PostgreSQL test gating excluded from the default suite | Existing live-gate pattern; applied here |
| Per-POC isolation policy | New, this ADR |
| Slice 7's six inherited gates | Technical specification, section 15 |

## Alternatives Considered

### `SERIALIZABLE` isolation instead of conditional writes

- Benefits: the database detects write skew and lost updates without the adapter
  expressing each guard explicitly; fewer chances to forget a predicate.
- Costs: the losing writer fails with a serialization failure rather than
  `CONFLICT_STATE_REVISION`, which the shared conformance kit and the Milestone
  2 contended-write proof both assert. Recovering the expected code would mean
  translating a generic serialization failure into a specific domain conflict it
  does not actually identify. `SERIALIZABLE` also requires a retry policy, and
  the repository contract has no vocabulary for one.
- Reason not selected: it breaks observable parity with the in-memory and SQLite
  adapters, and it moves a retry decision into an adapter that is not permitted
  to make policy decisions.

### `jsonb` for canonical JSON columns

- Benefits: indexable, queryable with native operators, inspectable with
  ordinary tooling, and the idiomatic PostgreSQL choice.
- Costs: it does not preserve key order, drops duplicate keys, normalizes
  whitespace and rewrites numeric text form. Every content-derived identity, the
  operation digest, replay equality and the in-memory byte-equality proof depend
  on the exact bytes. The resulting failure is silent and appears far from the
  column definition.
- Reason not selected: `acme-cjson-1` is a canonicalization contract, and a
  storage type that re-canonicalizes on its own terms cannot hold it. The
  generated-companion-column escape hatch preserves the benefits without the
  authority.

### A third-party migration tool

- Benefits: no bespoke migration runner; established rollout tooling, dry runs
  and operator familiarity.
- Costs: the tool owns versioning and checksum semantics. ADR-0003 and ADR-0013
  place those in ACME deliberately, including the specific behavior that a
  tampered migration or an unknown recorded version refuses startup as
  `PERSISTENCE_CORRUPTION`.
- Reason not selected: adopting a tool would either duplicate that guarantee or
  quietly replace it with a weaker one. The existing runner already implements
  the required semantics and needs only the advisory lock added.

### One PostgreSQL instance per POC

- Benefits: unambiguous blast-radius isolation; per-POC backup, restore and
  upgrade schedules; no shared connection budget.
- Costs: every operational procedure ADR-0029 lists as a new responsibility is
  multiplied before any of them exists once. Cross-POC schema separation already
  provides the isolation the POC phase needs.
- Reason not selected: premature. The property that makes later separation cheap
  is package and schema separation, which this ADR requires, not instance
  separation. Recorded as the policy to revisit at a data classification
  boundary.

### Supabase-managed access paths (PostgREST, client libraries) for the product

- Benefits: less server-side code; the platform's intended usage.
- Costs: ADR-0029 already forbids it for ACME schemas, and the aggregate
  transaction and compare-and-swap semantics cannot be expressed through a
  per-request REST interface.
- Reason not selected: settled by ADR-0029. Recorded here only because the
  platform's defaults make it the path of least resistance.

## Consequences

### Positive

- Slice 7 has a decision to implement rather than a design to invent, and every
  decision states a mechanism.
- ADR-0029's two open items are closed.
- The adapter's PostgreSQL boundary is verified by running the conformance suite
  against vanilla PostgreSQL, which proves vendor independence by construction.
- Concurrent writers against different entities become safe, which is the actual
  reason for leaving SQLite.
- Concurrent outbox drainers receive disjoint batches instead of serializing.
- The pure-JavaScript driver removes the native-prebuild exposure that G18
  records for `better-sqlite3` on this path.
- Migration atomicity improves: transactional DDL applies the whole pending set
  or none of it.
- The core, the `ExecutionRepository` port and every shared conformance kit
  remain unchanged.

### Negative

- Two durable repository adapters now exist and must stay behaviorally
  identical. Every future repository change is two implementations and two
  migration baselines.
- Storing canonical JSON as `text` forfeits native JSON querying inside the
  database. Operators inspect through the application or through generated
  companion columns.
- ISO-8601 text timestamps forfeit native time-range queries and interval
  arithmetic on the authoritative columns.
- `READ COMMITTED` plus explicit conditional writes puts correctness in the
  adapter's predicates. A forgotten revision predicate is a lost update the
  database will not catch, which makes the contended-write gates load-bearing
  rather than confirmatory.
- Connection lifecycle becomes a real failure mode. A leaked client deadlocks a
  bounded pool, which SQLite could not do.
- Testing now requires a running PostgreSQL server, so the PostgreSQL gates
  cannot run in the hermetic offline default suite.
- Backups, restores, upgrades, patching, monitoring and key lifecycle remain
  unbuilt, as ADR-0029 already recorded.

### Behavioral divergence from SQLite

Recorded explicitly so no future reader mistakes a deliberate change for a
defect.

| Behavior | SQLite | PostgreSQL | Parity |
| --- | --- | --- | --- |
| Concurrent writers, different entities | Serialized by `BEGIN IMMEDIATE` | Concurrent | Deliberately changed |
| Concurrent writers, same entity | Exactly one commit, loser gets `CONFLICT_STATE_REVISION` | Identical | Preserved |
| Concurrent outbox drains | Serialized; one drainer waits | Disjoint batches via `SKIP LOCKED` | Deliberately changed |
| Idempotency detection | Safe select-then-insert | `ON CONFLICT DO NOTHING` plus row count | Preserved observably |
| Multi-statement read consistency | Implicit from single-writer locking | Explicit repeatable-read read-only transaction | Preserved |
| Migration concurrency | Impossible | Advisory lock required | Preserved |
| Canonical JSON, timestamps, hashes | `TEXT` | `text` | Preserved byte-for-byte |
| Migration checksums | SQLite statements | Different statements, different checksums | Intentionally not comparable |

### Follow-ups

- Activate slice 7 as its own charter under this ADR, including the three new
  gates in section 10.
- Verify and record the direct PostgreSQL port and the PostgreSQL major version
  of the deployed self-hosted release.
- Produce slice 7's operations documentation: backups, restore, connection
  limits and migration policy, as the technical specification requires.
- Define backup, restore, upgrade and key-lifecycle procedures before any
  environment holds data that matters, as ADR-0029 already requires.
- Extend `tooling/boundaries` rules to cover the new adapter packages, per G17.
- Revisit per-POC instance isolation at a data classification boundary, not at a
  second POC.

## Compatibility and Migration

No existing code, contract, schema or stored data changes. No PostgreSQL adapter
exists yet, so there is nothing to migrate. SQLite remains the only delivered
durable adapter and the deterministic local and CI default, exactly as ADR-0029
preserves it.

`packages/core`, the `ExecutionRepository` port and the shared conformance kits
are unchanged by this decision. The port is already `Promise`-based, and the
adapter's conformance factory stays synchronous by generating its schema name
eagerly and performing connection, schema creation and migration lazily on first
use. Should that prove impossible during slice 7, widening the kit's factory
signature is a charter-level decision against ADR-0029's requirement that the
adapter pass the kit unchanged, and it must be raised as such rather than
absorbed as an implementation detail.

Migration `1` of each PostgreSQL schema is its own baseline; no database
predates it. Later persisted-structure changes require a new numbered migration
and an ADR. Editing an applied migration in place is a breaking change that
existing databases reject by checksum, which is the intended behavior.

Rollback of this ADR is a new ADR. Because the adapter targets plain PostgreSQL,
moving to a managed provider changes connection configuration and operations,
not the adapter contract or its conformance proofs.

## References

- [ADR-0003 — SQLite revisioned Unit of Work](0003-sqlite-revisioned-unit-of-work.md)
- [ADR-0012 — Milestone 1 execution identity and replay](0012-milestone-1-execution-identity-and-replay.md)
- [ADR-0013 — Durable SQLite schema and driver](0013-durable-sqlite-schema-and-driver.md)
- [ADR-0016 — Encrypted payload retention](0016-encrypted-payload-retention.md)
- [ADR-0017 — Durable execution resume](0017-durable-execution-resume.md)
- [ADR-0018 — Outbox delivery boundary](0018-outbox-delivery-boundary.md)
- [ADR-0026 — Durable quality evaluation store](0026-durable-quality-evaluation-store.md)
- [ADR-0027 — Async launch job progress and cancellation](0027-async-launch-job-progress-cancellation.md)
- [ADR-0028 — First POC is the Evidence Integrity Workbench](0028-first-poc-evidence-integrity-workbench.md)
- [ADR-0029 — POC #1 persistence platform is self-hosted Supabase](0029-poc-1-self-hosted-supabase-persistence-platform.md)
- [ADR-0031 — Evidence reviewer overlay and versioned views](0031-evidence-review-overlay-and-versioned-views.md)
- [Evidence Integrity Workbench technical specification](../design/evidence-integrity-workbench-technical-specification.md), sections 11, 15 and 16
- [Gap resolution plan](../design/gap-resolution-plan.md) for G17 and G18
