# Current Task

Task ID: ACME-0084
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-12
Last updated: 2026-08-12
Archived: 2026-08-12
Charter frozen at: 2026-08-12

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0003-sqlite-revisioned-unit-of-work.md`
- `docs/adr/0013-durable-sqlite-schema-and-driver.md`
- `docs/adr/0018-outbox-delivery-boundary.md`
- `docs/adr/0026-durable-quality-evaluation-store.md`
- `docs/adr/0029-poc-1-self-hosted-supabase-persistence-platform.md`
- `docs/design/evidence-integrity-workbench-technical-specification.md`

## Task Summary

A task is never considered done until:
`docs/JOURNAL.md`, `docs/SYSTEMDOC.md` and `docs/CURRENT_STATUS.md` are à jour.

Decide and record the PostgreSQL persistence architecture before any PostgreSQL
code is written. The Evidence Integrity Workbench technical specification names
slice 7's prerequisites as "slice 6 and a new PostgreSQL schema/transaction/
migration ADR". Slice 6 closed with ACME-0083, so the missing ADR is the only
remaining blocker on the recommended next product task.

ADR-0029 decided the platform (self-hosted Supabase) and the adapter boundary
(plain PostgreSQL wire, never a Supabase-specific API). It deliberately left
open the two items that decide what the adapter actually looks like: "schema
separation between product tables and ACME persistence" and "the migration
tooling and rollout order for the adapter". This task closes those and the
adjacent decisions they imply.

The reason this is a separate task from the implementation is the Task Size Rule
in `docs/TASK_WORKFLOW.md`: design, implementation and deployment that can be
approved separately must be split before `Ready`. The persistence architecture
is approvable on its own, and approving it after 1700 lines of adapter code
exist is not an approval.

The named failure mode this task exists to prevent is a PostgreSQL adapter that
passes the conformance kit while quietly breaking evidence identity. ACME's
entire identity system is SHA-256 over `acme-cjson-1`, and several ordinary
PostgreSQL choices — `jsonb` columns, `timestamptz` columns, `SERIALIZABLE`
isolation, select-then-insert idempotency under `READ COMMITTED` — change
observable behavior in ways that surface far from where the choice was made.
The ADR must decide those explicitly rather than leave them to the first
implementer's habits.

## Task Charter

The charter was frozen at `Ready` on 2026-08-12 and is now immutable. No
implementation or external effect is authorized by this task at any status.

### Goal

Decide and record the PostgreSQL persistence architecture that Evidence
Integrity Workbench slice 7 must implement.

### Primary Deliverable

An accepted `docs/adr/0033-postgresql-persistence-architecture.md` that decides
driver and pool ownership, schema ownership and browser isolation, transaction
boundary and compare-and-swap, outbox leasing, canonical-value representation,
migration format and rollout, driver error classification, connection lifecycle,
the verification environment and the per-POC persistence isolation policy.

### In Scope

- Decide the PostgreSQL driver and who owns pool construction, sizing and
  shutdown, and state the connection-mode constraint the platform imposes.
- Decide schema ownership and separation between ACME engine persistence and
  Evidence product persistence, including database roles, cross-schema
  reference rules and identifier qualification.
- Decide how ADR-0029's browser-isolation requirement is enforced mechanically
  against a platform whose default exposes tables to a browser, and require it
  as a verifiable gate rather than a configuration note.
- Decide the transaction boundary, isolation level and the compare-and-swap
  mechanism for `state_heads` revisions and memory record versions, preserving
  the conflict codes the existing conformance proofs assert.
- Decide the outbox leasing mechanism under concurrent drainers, preserving the
  ADR-0018 lease semantics, claim ordering and persisted status vocabulary.
- Decide how canonical `acme-cjson-1` values, content hashes, timestamps and
  numeric fields are represented, with an explicit rule for any type that does
  not round-trip byte-identically.
- Decide the migration format, checksum algorithm, ledger placement,
  concurrent-migration locking, who executes migrations, and the forward-only
  rollout rule.
- Decide the driver error classification into the existing `PERSISTENCE_*` and
  `INTERNAL` taxonomy, keyed on a stable driver-reported identifier.
- Decide the connection lifecycle, including transaction-scoped client
  checkout, the read-consistency rule for multi-statement read sets, and
  shutdown behavior.
- Decide the verification environment, test isolation strategy and how
  PostgreSQL tests are gated so the default suite stays hermetic and offline.
- Decide the per-POC persistence isolation policy and the trigger that would
  revisit it.
- Record which existing conformance kits and proof obligations slice 7 inherits
  unchanged, and which new PostgreSQL-specific gates it adds.
- Record every point where PostgreSQL behavior necessarily diverges from the
  SQLite adapter, and state whether parity is preserved or deliberately changed.
- Update `docs/adr/README.md`, the technical specification's deferred-decision
  row and the governing documents this decision changes.

### Out of Scope

- Implementing the PostgreSQL ACME adapter, the PostgreSQL Evidence product
  adapter, migrations, SQL, roles or any package. That is slice 7, activated as
  its own charter under this ADR.
- Writing `docker-compose`, CI workflow steps, vitest configuration or
  environment files. This task decides what they must satisfy; it creates none
  of them.
- Concrete table and column design for the Evidence product schema. This task
  decides that schema's ownership, isolation and migration architecture only.
- Operations runbooks for backup, restore, upgrade, patching, monitoring and
  key lifecycle. ADR-0029 names them as follow-ups and the technical
  specification assigns that documentation to slice 7.
- Reopening the ADR-0029 platform decision, or adopting Supabase Auth, Storage,
  Realtime or Studio, all of which ADR-0029 and the technical specification keep
  undecided and disabled.
- Identity provider, authentication and authorization, which require their own
  ADR before slice 8.
- Object-storage vendor and database/object consistency, which require their own
  ADR before artifact bytes leave the text document repository.
- Hosting platform, topology, region, network exposure and TLS termination.
- Changing `packages/core`, the `ExecutionRepository` port surface, the shared
  conformance kits, the in-memory adapter or the SQLite adapter.
- Changing SQLite's status as the deterministic local and CI default, which
  ADR-0029 preserves.
- Any non-synthetic data path, which ADR-0028 blocks until slice 9 authority
  exists.

### Definition of Done

- `docs/adr/0033-postgresql-persistence-architecture.md` exists with status
  `Accepted` and decides every In Scope item by name, with no item left
  implicit or deferred to the implementer.
- Every decision states a mechanism, not only an intent. A decision that names
  a desired property without naming how it is achieved does not satisfy this
  condition.
- ADR-0029's two named open items, schema separation between product tables and
  ACME persistence, and the migration tooling and rollout order for the adapter,
  are both closed explicitly and referenced as closed.
- Every point where PostgreSQL diverges from SQLite behavior is recorded with
  whether observable parity is preserved or deliberately changed, and the
  conformance consequence of each.
- The Alternatives Considered section records, with benefits, costs and reason
  not selected, at least the isolation-level fork, the canonical-value
  representation fork, the migration-tooling fork and the per-POC isolation
  fork.
- Browser isolation from ACME schemas is expressed as a gate a slice 7 test can
  execute, not as a configuration instruction.
- The ADR names which existing conformance kits and proofs slice 7 inherits
  unchanged and which PostgreSQL-specific gates it adds, and the six required
  gates the technical specification already fixes for slice 7 are preserved
  rather than restated in weaker form.
- Any decision that would require changing `packages/core`, the
  `ExecutionRepository` port or a shared conformance kit is recorded explicitly
  as a consequence with its rationale, or the ADR states that none is required.
- The per-POC persistence isolation policy is stated together with the condition
  that would revisit it.
- The technical specification's deferred-decision row for "PostgreSQL schema,
  transaction boundary, migrations and conformance" is updated from "New ADR
  before slice 7" to the accepted ADR.
- `docs/adr/README.md`, `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md` and
  `docs/JOURNAL.md` reflect the accepted decision; a target whose correct
  outcome is "unchanged" is closed by recording that outcome and its reason in
  the journal, not by leaving it unexamined.
- The completed task is archived under `docs/finished/` and
  `docs/CURRENT_TASK.md` reflects the real next state.

### Minimum Verification Gates

Every gate below is satisfied by reviewing the ADR this task produces. None may
be read as a demand for implementation evidence, SQL, containers or benchmarks,
all of which are Out of Scope.

- [x] Verify that every decision traces to ADR-0003, ADR-0013, ADR-0018,
  ADR-0026, ADR-0029, the technical specification, or is explicitly marked as a
  new decision this ADR originates.
- [x] Verify that no decision weakens an immutable V1 restriction in ADR-0028 or
  the normative product definition. A persistence decision cannot widen product
  authority.
- [x] Verify that the decided adapter boundary uses no PostgREST, Supabase
  client library or other Supabase-specific API, as ADR-0029 requires.
- [x] Verify that the decided dependency direction holds: the adapter makes no
  policy decision, reads no environment variable, and owns no pool lifecycle.
- [x] Verify that each In Scope decision area carries a decision, its mechanism,
  and a named rejected alternative wherever a genuine fork existed.
- [x] Verify that the canonical-value representation rule is stated as a
  byte-fidelity requirement tied to `acme-cjson-1` and the content-derived
  identity algorithms, and that every rejected type is named.
- [x] Verify that the compare-and-swap decision preserves the exact conflict
  codes the existing repository conformance and Milestone 2 concurrency proofs
  assert.
- [x] Verify that the outbox decision preserves ADR-0018 lease semantics, the
  fixed `occurred_at` then `event_id` claim order, and the persisted `claimed`
  status value the core vocabulary guard requires.
- [x] Verify that the verification-environment decision keeps the default test
  suite hermetic and offline, consistent with how the live provider gate is
  structurally excluded from `vitest.config.ts`.
- [x] Verify internal Markdown links and balanced fences with `pnpm docs:check`.
- [x] Run `git diff --check` and preserve unrelated worktree changes.
- [x] Record every skipped check together with its exact reason.

## References

- `docs/adr/0003-sqlite-revisioned-unit-of-work.md` for the revisioned Unit of
  Work, ordered checksum-verified migrations and the aggregate repository rule
- `docs/adr/0013-durable-sqlite-schema-and-driver.md` for the migration
  checksum algorithm, the canonical-JSON-beside-projection-columns pattern and
  the scoped uniqueness precedent
- `docs/adr/0018-outbox-delivery-boundary.md` for lease semantics, claim
  ordering and the `claimed` status vocabulary
- `docs/adr/0026-durable-quality-evaluation-store.md` for the append-only
  quality table with no foreign key to executions
- `docs/adr/0029-poc-1-self-hosted-supabase-persistence-platform.md` for the
  platform, the plain-PostgreSQL-wire adapter boundary and browser isolation
- `docs/adr/0012-milestone-1-execution-identity-and-replay.md` for portable
  replay evidence and the read-set consistency expectation
- `docs/adr/0016-encrypted-payload-retention.md` for sealed payload columns
- `docs/adr/0027-async-launch-job-progress-cancellation.md` for the rule that
  cancellation never rolls back a committed ledger write
- `docs/design/evidence-integrity-workbench-technical-specification.md`
  sections 11, 15 (slice 7) and 16
- `packages/core/src/repository.ts` for the `ExecutionRepository` port, which is
  already `Promise`-based and therefore imposes no synchronous-driver constraint
- `packages/adapter-sqlite/src/repository.ts`,
  `packages/adapter-sqlite/src/migrations.ts` and
  `packages/adapter-sqlite/src/driver-errors.ts` as the reference behavior the
  PostgreSQL adapter must match or consciously diverge from
- `packages/testing/src/repository-conformance.ts` for the conformance kit and
  its synchronous `createRepository` factory
- `packages/evidence-product-contracts/src/repository.ts` and
  `packages/adapter-evidence-product-file/` for the product store the ADR must
  place beside the engine store

## Technical Questions and Accepted Answers

All eleven positions were accepted unchanged by the maintainer at freeze on
2026-08-12. They are the inputs ADR-0033 honors; the ADR owns their exact
wording, alternatives and consequences.

1. **Driver and pooling.** `pg` (node-postgres) 8.x in pure-JavaScript mode,
   without `pg-native`. It matches ADR-0029's plain-wire requirement literally
   and removes the native-prebuild exposure that G18 records for
   `better-sqlite3`. The adapter receives an injected pool or client provider
   and never constructs one, sizes one, reads an environment variable or calls
   `end()`; the composition root owns that lifecycle. The platform constraint to
   record: connect to the direct PostgreSQL port, not a transaction-mode pooler,
   because transaction pooling breaks prepared statements and session-scoped
   advisory locks. The exact port for the chosen self-hosted release must be
   verified and written into the ADR rather than assumed.

2. **Schema ownership.** Two schemas, two roles, two migration ledgers: `acme`
   for engine persistence under an `acme_engine` role, and `evidence` for the
   product store under a separate role. Quality evaluations stay inside `acme`,
   because ADR-0026's lifecycle independence is already structural through the
   absence of a foreign key and a third schema would only add a third ledger.
   The rule that makes the separation real is no cross-schema foreign key and no
   cross-schema transaction: the product references engine identifiers as opaque
   strings. Identifiers are fully qualified in SQL text rather than resolved
   through `search_path`, so a pooled connection carrying the wrong session
   state cannot write into the wrong schema.

3. **Browser isolation.** Both schemas are revoked from the platform's
   browser-facing roles and excluded from its exposed-schema list. This is
   stated as a slice 7 test that connects as the anonymous role and asserts
   permission denied, because ADR-0029 requires the boundary against a platform
   whose default is the opposite, and a configuration comment does not hold a
   line over time.

4. **Transaction boundary, isolation and compare-and-swap.** One transaction per
   Unit of Work on one dedicated client, unchanged from SQLite. Isolation is
   `READ COMMITTED` with explicit conditional updates, not `SERIALIZABLE`. The
   revision guard is an `UPDATE ... WHERE revision = $expected` whose affected
   row count of zero raises `CONFLICT_STATE_REVISION`, and the same shape on
   memory record versions raises `CONFLICT_MEMORY_VERSION`. `SERIALIZABLE` is
   rejected because it would make the losing writer fail with a serialization
   error rather than the conflict code the existing proofs assert, breaking
   parity with the in-memory and SQLite adapters and forcing a retry policy into
   the adapter that the contract has no vocabulary for. Idempotency checks
   become `INSERT ... ON CONFLICT DO NOTHING` with a row-count test, because
   select-then-insert is safe under SQLite's immediate lock and races under
   `READ COMMITTED`. A bounded `lock_timeout` and `statement_timeout` apply, so
   a stalled commit fails fast instead of holding locks.

5. **Outbox leasing.** One atomic statement using `FOR UPDATE SKIP LOCKED` over
   the due set, replacing SQLite's select-then-update-each-row loop. Claim order
   stays `occurred_at` then `event_id` as ADR-0018 fixes it, the lease
   visibility timeout, at-least-once delivery, caller-owned retry and terminal
   `failed` semantics are unchanged, and the persisted status value stays
   `claimed`. No advisory locks: the row status plus `SKIP LOCKED` is sufficient
   and stays inside one transaction. The new gate this enables is that two
   concurrent drains lease disjoint sets and no event is delivered twice within
   one lease window.

6. **Canonical value representation.** Canonical `acme-cjson-1` values are
   stored as `text`. `jsonb` is refused: it does not preserve key order, drops
   duplicate keys, normalizes whitespace and rewrites numeric text form, and
   every one of those silently breaks the content-derived identities, the
   operation digest, replay equality and the byte-equality proof against the
   in-memory adapter. PostgreSQL `json` would preserve the bytes but invites
   querying the column, which is the door this rule exists to close. Timestamps
   stay ISO-8601 `text` rather than `timestamptz`, which round-trips through
   session timezone and microsecond precision and rewrites the exact string the
   contracts carry. Content hashes stay `text`. Where operators later want
   queryability, the escape hatch is a generated companion column that is never
   read back into a contract value. Surrogate keys become identity columns and
   `REAL` becomes `double precision`, with the check constraints preserved.

7. **Migrations.** Reuse the ADR-0003 and ADR-0013 model unchanged in form:
   numbered, ordered, forward-only, `{version, name, statements}` hashed as
   `sha256(acme-cjson-1(...))`, recorded in a `schema_migrations` table, with an
   unknown recorded version or a mismatched checksum refusing startup as
   `PERSISTENCE_CORRUPTION`. No third-party migration tool for the ACME schema,
   because it would take over exactly the checksum semantics ADR-0013
   deliberately owns. Each schema keeps its own ledger. The PostgreSQL baseline
   starts at version 1 with its own statements and therefore its own checksums;
   the SQLite migration source is not shared. Two PostgreSQL-specific additions:
   a transaction-scoped advisory lock taken at the start of the migration
   transaction, because without SQLite's single-writer constraint two processes
   will migrate concurrently at startup; and the observation that transactional
   DDL makes the whole migration set atomic without the explicit wrapper SQLite
   needed. Execution ownership: an explicit migrate command is authoritative and
   process startup verifies and refuses against an un-migrated or
   ahead-of-code schema, because a shared server must not be migrated as a side
   effect of a worker booting.

8. **Error classification.** The same shape as the ACME-0057 SQLite
   classification, keyed on SQLSTATE rather than driver name strings. Transient
   and retryable covers serialization failure, deadlock detected, lock not
   available, query canceled by timeout, too many connections and the connection
   exception and admin-shutdown classes. Non-retryable corruption covers
   integrity-constraint violations not already translated into conflict codes,
   the internal-error and data/index-corrupted codes, and undefined table or
   column, because those mean the schema does not match the code, which is
   precisely what checksum verification exists to catch. Everything else becomes
   `INTERNAL`, and no raw driver error escapes the boundary. The divergence to
   name explicitly: unique violations on the idempotency and revision
   constraints must reach the domain conflict outcomes before the generic mapper
   sees them, or a legitimate concurrency result would be reported as
   corruption. The structural defense is detecting conflicts by affected row
   count rather than by exception, keeping the constraint mapping as a backstop.

9. **Connection lifecycle.** One dedicated client per Unit of Work with
   guaranteed release, encapsulated in a single transaction helper, because a
   leaked client against a bounded pool deadlocks the process. Multi-statement
   read sets, specifically the context load and the replay evidence load, run
   inside a read-only repeatable-read transaction: ADR-0012 treats replay
   evidence as an internally consistent read set, and under `READ COMMITTED`
   separate statements observe different snapshots and produce a torn read set
   without any error. Pool sizes are small, explicit and documented against the
   server's connection limit, each process sets a distinguishable application
   name, and the composition root drains the pool on shutdown after in-flight
   work. Cancellation stays cooperative under ADR-0027 and never rolls back a
   committed write.

10. **Verification environment.** Three tiers answering three different
    questions. Continuous integration and default development run against an
    ephemeral plain PostgreSQL container, not Supabase, because passing on
    vanilla PostgreSQL is the stronger proof of ADR-0029's adapter boundary.
    One self-hosted Supabase instance serves as the manually run integration
    environment where browser isolation and operations gates are proven. Test
    isolation is schema per test run: table prefixes pollute every SQL string
    and defeat qualification, database per test is too slow to run inside one
    pool, and a dropped schema is one statement. The container's PostgreSQL
    major version is pinned to the version the chosen self-hosted release
    actually ships, verified rather than assumed. Gating mirrors the live
    provider gate exactly: a separate configuration excluded from
    `vitest.config.ts`, refusing rather than skipping when its connection
    variable is absent, with continuous integration running it as its own job.
    This matters because `test:conformance` runs against the default
    configuration, so a PostgreSQL conformance test placed there would break the
    hermetic offline suite.

11. **Per-POC isolation.** One instance with separate schemas, not one instance
    per POC. A separate instance multiplies exactly the operational burden
    ADR-0029 already records as a negative and that does not yet exist, without
    buying isolation that schemas and roles do not already provide. What makes a
    POC carry itself is that its product store is a separate package behind its
    own port, with its own schema, its own migration ledger and no foreign key
    into `acme`; if that holds, moving a later POC to its own instance is a
    connection-string change. The revisit trigger is a data-classification
    boundary rather than a second POC, and ADR-0028 blocks non-synthetic data
    until slice 9 authority exists, so that trigger does not exist today. The
    policy to record is one instance per data classification.

## Risks to Resolve Inside the ADR

Both items below can force a decision the charter cannot make silently. Each
must be answered in the ADR rather than discovered during slice 7. **Both are
resolved in ADR-0033**: the conformance factory in `Compatibility and
Migration`, the connection mode in `Decision` section 1.

- **Conformance kit factory signature.** ADR-0029 requires the adapter to pass
  the repository conformance kit unchanged, and that kit's `createRepository`
  factory is synchronous and called once per test with the expectation of a
  clean store. The proposed resolution keeps the kit untouched: the factory
  generates its schema name synchronously and performs connection, schema
  creation and migration lazily on first use, while the adapter's own test file
  owns teardown because it owns the test lifecycle. If that proves impossible,
  widening the factory's return type is a charter-level decision against
  ADR-0029's wording, not an implementation detail, and the ADR must say so.
- **Connection mode.** If operations later require all traffic through a
  transaction-mode pooler, prepared statements and session-scoped advisory locks
  become unavailable. The transaction-scoped migration lock is chosen partly to
  survive that, but the direct-connection requirement must be an explicit
  decision in the ADR rather than an assumption living in a connection string.

## Checklist

- [x] Review this Draft's proposed answers with the maintainer and record
  acceptance, replacement or rejection for each of the eleven positions.
- [x] Freeze the charter at `Ready` and record the freeze in the Charter
  Amendment Log.
- [x] Confirm against the repository which existing behavior the PostgreSQL
  adapter must match: conflict codes, claim ordering, migration checksum
  algorithm, retention and payload sealing, and the read sets that must stay
  internally consistent.
- [x] Draft ADR-0033 Context from ADR-0029's two open items and the technical
  specification's slice 7 prerequisite.
- [x] Draft the Decision section covering all eleven areas with mechanisms.
- [x] Draft Alternatives Considered for the isolation-level, representation,
  migration-tooling and per-POC isolation forks.
- [x] Draft Consequences, including every SQLite divergence and its conformance
  effect, and the operations burden the decision creates.
- [x] Draft Compatibility and Migration, including the forward-only rule and the
  expand/contract requirement for later schema change.
- [x] Record the inherited and newly added slice 7 proof obligations.
- [x] Resolve both items under `Risks to Resolve Inside the ADR`.
- [x] Update `docs/adr/README.md` and the technical specification's
  deferred-decision row.
- [x] Synchronize `docs/CURRENT_STATUS.md` and `docs/SYSTEMDOC.md`.
- [x] Run the verification gates and record results, including skipped checks.
- [x] Add a signed `docs/JOURNAL.md` entry.
- [x] Archive this task and populate the next real task state, after maintainer
  review of ADR-0033.

## Decisions and Notes

- A checkpoint after each step or substep is required. The checklist is updated
  along the work, and `docs/CURRENT_STATUS.md` is updated whenever changes
  affect behavior or persistent project reality.
- ADR-0029 is consumed, not reopened. The platform is decided; the components it
  leaves open stay open.
- The `ExecutionRepository` port is already `Promise`-based, so an asynchronous
  driver requires no core change. This was confirmed against
  `packages/core/src/repository.ts` before the charter was drafted, and it is
  the reason the whole decision can stay inside an adapter.
- The implementation is deliberately not in this charter. Slice 7 is activated
  separately under this ADR, and the technical specification already fixes its
  six required gates: conformance parity, aggregate transaction rollback,
  contended expected-revision write, resume and replay, append-only review
  ordering, migration and reopen, and browser isolation from ACME schemas.
- SQLite's behavior is the reference, not the ceiling. Where PostgreSQL permits
  genuinely better behavior, concurrent writers against different entities and
  disjoint concurrent outbox drains being the two clear cases, the ADR records
  it as a deliberate change with a new proof rather than hiding it inside a
  parity claim.
- Classify discoveries using `docs/TASK_WORKFLOW.md`. A discovery that changes
  the goal or Definition of Done supersedes this task rather than expanding it.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- 2026-08-12: Charter frozen at `Ready`; status then advanced to `In Progress`.
  All eleven proposed answers were accepted unchanged, and the section heading
  changed from `Proposed Answers` to `Accepted Answers` to record that. No
  charter semantics changed: Goal, Primary Deliverable, In Scope, Out of Scope,
  Definition of Done and Minimum Verification Gates are unchanged from the
  frozen text.

## Verification

- [x] Draft review completed before transition to `Ready`.
- [x] Authority and traceability review of every decision.
- [x] Architecture and dependency-boundary review.
- [x] Parity review against the SQLite adapter's observable behavior.
- [x] `pnpm docs:check`.
- [x] `git diff --check`.
- [x] Document any skipped check and its exact reason.

Verification results:

- Traceability: ADR-0033 carries an explicit `Traceability` table mapping all
  twenty-six decisions to ADR-0003, ADR-0012, ADR-0013, ADR-0016, ADR-0018,
  ADR-0026, ADR-0027, ADR-0029, the technical specification, the `AGENTS.md`
  dependency rules, or the marker "New, this ADR". Nine decisions originate
  here and are marked as such.
- Product authority: the ADR decides storage mechanics only. It adds no data
  class, no product claim and no output authority, so the ADR-0028 and product
  definition V1 restrictions are untouched.
- Adapter boundary: the decided surface is `pg` over the wire protocol with an
  injected pool. No PostgREST, Supabase client library or Supabase-specific API
  appears in any decision; the platform's managed access paths are recorded as
  a rejected alternative.
- Dependency direction: the adapter is decided to construct no pool, read no
  environment variable, size nothing and call no shutdown, leaving pool
  lifecycle and all policy with the composition root.
- Parity review against `packages/adapter-sqlite/src/repository.ts`,
  `migrations.ts` and `driver-errors.ts`: eight behaviors compared and recorded
  in the ADR's divergence table. Five are preserved, two are deliberately
  changed (concurrent writers on different entities, concurrent outbox drains)
  and one is intentionally not comparable (migration checksums, because the
  statements differ). The conflict codes, the ADR-0018 `occurred_at` then
  `event_id` claim order and the persisted `claimed` status are preserved by
  name.
- Representation: stated as a byte-fidelity requirement tied to `acme-cjson-1`
  and the content-derived identity algorithms. `jsonb` and `timestamptz` are
  both named as refused, with `json` recorded as byte-safe but rejected for
  inviting the queries the rule exists to prevent.
- Verification environment: PostgreSQL gates are decided to live outside
  `vitest.config.ts`. This was checked against the real scripts, where
  `test:conformance` runs `vitest run tests/conformance` against the default
  configuration, so the exclusion is necessary rather than stylistic.
- `corepack pnpm docs:check`: passed, 169 Markdown files checked for internal
  links and balanced fences.
- `git diff --check`: passed.

Skipped checks and reasons:

- Typecheck, lint, unit, conformance, integration and scenario gates were not
  run. ACME-0084 changes documentation and accepted architecture only; it adds
  no code, dependency, schema, migration or runtime behavior, so those gates
  have nothing to exercise. `AGENTS.md` prescribes the documentation-only
  verification baseline for exactly this case, and that baseline was run in
  full.
- No PostgreSQL server, container or connection was used. This task decides the
  verification environment; slice 7 builds and exercises it.
- Automated Mermaid validation was not applicable: ADR-0033 contains no Mermaid
  diagram. The repository also has no Mermaid validator, and
  `tooling/docs/check-docs.mjs` verifies internal links and balanced fences
  only.

## Documentation Updates

Every target below is required. A target whose correct outcome is "unchanged"
is closed by recording that outcome and its reason in `docs/JOURNAL.md`, not by
leaving it unexamined.

- [x] `docs/adr/0033-postgresql-persistence-architecture.md`
- [x] `docs/adr/README.md`
- [x] `docs/design/evidence-integrity-workbench-technical-specification.md`:
      deferred-decision row, slice 7 prerequisites and gates, and the
      section 11 persistence boundary
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`: correctly unchanged. The ADR adds one file to an
      already-mapped directory and creates no package, application or
      directory. Recorded in the journal rather than left unexamined.

## Handoff and Follow-ups

- Current state: Complete. The charter was frozen and the Primary Deliverable
  landed: `docs/adr/0033-postgresql-persistence-architecture.md` is accepted,
  all eleven decision areas carry mechanisms, both risks are resolved, and every
  documentation target is synchronized. The documentation-only verification
  baseline passed. Maintainer review completed on 2026-08-12. No code was added
  and none is authorized by this ADR.
- Next recommended step: ACME-0085, Evidence Integrity Workbench slice 7, the
  self-hosted Supabase PostgreSQL adapter implemented against ADR-0033.
  Activated as a Draft on 2026-08-12.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none inside ACME-0084. Two facts are deliberately deferred to
  the slice 7 charter to verify rather than assume, and the ADR says so: the
  direct PostgreSQL port of the deployed self-hosted release, and its
  PostgreSQL major version for pinning the CI container. Both are environment
  observations, not architecture decisions, which is why this ADR does not
  guess at them.

## Finalize When Complete

- Archive this file under `docs/finished/ACME-0084_<task-slug>.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`, or
  populate it with the next explicitly approved task, which is expected to be
  slice 7 as ACME-0085.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done becomes invalid after freeze, supersede this
  task instead of rewriting it.
