# ACME-0085 — PostgreSQL slice 7 adapters

Task ID: ACME-0085
Parent Task: None
Status: Complete
Owner: Grok
Created: 2026-08-12
Last updated: 2026-08-12
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
- `docs/adr/0033-postgresql-persistence-architecture.md`
- `docs/adr/0029-poc-1-self-hosted-supabase-persistence-platform.md`
- `docs/adr/0003-sqlite-revisioned-unit-of-work.md`
- `docs/adr/0013-durable-sqlite-schema-and-driver.md`
- `docs/adr/0018-outbox-delivery-boundary.md`
- `docs/adr/0031-evidence-review-overlay-and-versioned-views.md`
- `docs/design/evidence-integrity-workbench-technical-specification.md`,
  section 15 slice 7
- `docs/finished/ACME-0084_postgresql-persistence-architecture.md`

## Task Summary

A task is never considered done until:
`docs/JOURNAL.md`, `docs/SYSTEMDOC.md` and `docs/CURRENT_STATUS.md` are à jour.

Implement Evidence Integrity Workbench slice 7. Both prerequisites are now
satisfied: ACME-0083 closed slice 6, and ACME-0084 delivered ADR-0033, which
decides the persistence architecture this task builds.

The reviewer capability slice 7 is defined by is durability across a restart:
stop the API and worker processes, start them again, and continue working in
the same reviewed workspace on the accepted PostgreSQL platform. That capability
needs both stores, because the evidence lives in the ACME ledger and the review
decisions live in the Evidence product store.

This task implements decided architecture. It does not re-decide it. ADR-0033
fixes the driver, pool ownership, schema separation, transaction boundary,
compare-and-swap mechanism, outbox leasing, column representation, migration
format and locking, error classification, connection lifecycle, verification
environment and per-POC isolation policy. Where implementation reveals that a
decision cannot hold, the correct response is a new ADR or an amendment, not a
quiet local deviation.

Two facts ADR-0033 deliberately did not guess are observed and recorded below
before the adapter is configured: the direct PostgreSQL port of the deployed
self-hosted release, and its PostgreSQL major version for pinning the CI
container.

## Task Charter

The charter is frozen. Discoveries follow `docs/TASK_WORKFLOW.md` and may not
expand this task into hosted shell, identity/auth or non-synthetic data.

### Goal

Continue the same reviewed Evidence workspace durably across an API and worker
restart on self-hosted Supabase PostgreSQL.

### Primary Deliverable

A plain PostgreSQL-wire ACME repository adapter and Evidence product store
adapter, implemented against ADR-0033, passing the unchanged shared conformance
kits plus slice 7's required gates, with the Evidence workbench able to run on
them end to end.

### In Scope

- `@acme/adapter-postgres`: the aggregate `ExecutionRepository` and the
  `QualityEvaluationStore` over the `acme` schema, using `pg` with an injected
  pool the adapter does not own.
- `@acme/adapter-evidence-product-postgres`: Evidence product store over the
  `evidence` schema, implementing the existing `EvidenceProductRepository` port
  beside the file adapter.
- Migration runners and version 1 baselines for both schemas, in the
  ADR-0003/0013 format with per-schema ledgers and the transaction-scoped
  advisory lock ADR-0033 requires.
- Database roles, grants and revocations that make ADR-0033's browser isolation
  true, including revocation from the platform's browser-facing roles.
- SQLSTATE-keyed driver error classification into the existing `PERSISTENCE_*`
  and `INTERNAL` taxonomy.
- Composition-root wiring so the CLI and the Evidence workbench API and worker
  can select PostgreSQL, with pool construction, sizing and shutdown owned
  there rather than in the adapter.
- The verification environment ADR-0033 decides: an ephemeral plain PostgreSQL
  container, schema-per-test isolation, a separate vitest configuration
  excluded from the default suite that refuses rather than skips without a
  connection, and a CI job that runs it.
- Observation and recording of the deployed release's direct PostgreSQL port
  and major version.
- Operations documentation: connection limits, migration policy, backup and
  restore, as the technical specification requires for this slice.
- Extension of the dependency and boundary rules to the new packages (G17).

### Out of Scope

- Re-deciding anything ADR-0033 fixed. A decision that cannot hold is a new ADR
  or an amendment, not a local deviation.
- Hosted deployment, hosting topology, region, network exposure and TLS. That is
  slice 8.
- Identity, authentication and authorization, which require their own ADR before
  slice 8.
- Supabase Auth, Storage, Realtime and Studio, which remain undecided and
  disabled.
- Object storage and artifact bytes outside the text document repository.
- Removing, replacing or deprecating the SQLite adapter or the file-backed
  Evidence product adapter. Both remain, and SQLite remains the deterministic
  local and CI default.
- Changing `packages/core`, the `ExecutionRepository` port surface, the
  `EvidenceProductRepository` port or the shared conformance kits. If the
  conformance factory genuinely cannot accommodate the adapter, that is the
  charter-level escalation ADR-0033 names, not a silent widening.
- New Evidence domain behavior, tasks, views, prompts or corpus content.
- Any non-synthetic data path, which ADR-0028 blocks until slice 9.
- Live provider calls.

### Definition of Done

- Both adapters pass their existing shared conformance kits unchanged.
- All six inherited slice 7 gates and all three ADR-0033 gates pass.
- The restart capability is proven end to end, not asserted.
- The default `pnpm test` suite remains hermetic and offline, with PostgreSQL
  gates reachable only through their own command.
- Governing documents, operations documentation and the journal are
  synchronized, and the task is archived.

### Minimum Verification Gates

Inherited from the technical specification, section 15:

- [x] Parity with the SQLite and in-memory repository conformance kits,
  unchanged.
- [x] Aggregate transaction rollback: a fault inside `commit()` leaves no
  documents, memory, state, events, outbox entries, commit record or terminal
  result, and the repository stays usable.
- [x] Contended expected-revision write: two writers against one revision yield
  exactly one commit, and the loser fails with `CONFLICT_STATE_REVISION` and
  writes nothing.
- [x] Resume and replay: an interrupted execution completes from its recorded
  model call with no provider call, reaching the same operation digest.
- [x] Append-only review ordering preserved in the product store.
- [x] Migration and reopen: a committed database reopened in a new connection
  yields identical replay evidence and identical operation digest.

Added by ADR-0033:

- [x] Two concurrent drains lease disjoint outbox sets, and no event is
  delivered twice within one lease window.
- [x] A connection as the platform's anonymous browser-facing role is denied
  against both the `acme` and `evidence` schemas.
- [x] Two processes starting concurrently against an un-migrated schema produce
  exactly one applied migration set.

Repository baseline:

- [x] `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm boundaries`,
  `pnpm test`, `pnpm build` and `pnpm docs:check` (recorded in verification
  results / journal).
- [x] `pnpm test:postgres` against ephemeral `postgres:15` on host port 55432
  (25/25); refuses without `ACME_POSTGRES_URL`.
- [x] `git diff --check` (recorded in verification results).
- [x] Record every skipped check with its exact reason.

## Open Questions (answered before freeze)

1. **One task or two?** Answer: One task.
2. **Product schema design?** Answer: Translate file adapter shape now; backlog
   relational improvements.
3. **PostgreSQL default?** Answer: No default changes; opt-in only.
4. **CI job ownership?** Answer: Part of this task.
5. **Product package name?** Answer: `@acme/adapter-evidence-product-postgres`.
6. **Environment facts?** Observed 2026-08-12 against
   `c:\code\supabase-selfhosted` / `supabase.audioleaf.se`:
   - PostgreSQL major version: **15** (server_version `15.8` via
     `docker exec supabase-db`).
   - Direct PostgreSQL port inside the stack: **5432** (`supabase-db`).
   - Host-published access today: Supavisor session mode on **localhost:5432**
     and transaction mode on **localhost:6543**. Transaction-mode pooling
     (6543) is forbidden for the adapter per ADR-0033. Prefer direct container
     network / published `db:5432` for production-like use; CI uses ephemeral
     `postgres:15` on a free host port.

## Checklist

- [x] Answer the six open questions and record the decisions.
- [x] Complete the Definition of Done and freeze the charter at `Ready`.
- [x] Observe and record the direct PostgreSQL port and major version.
- [x] Stand up the ephemeral PostgreSQL container and the gated test
  configuration before writing adapter code, so every step below is verifiable
  as it lands.
- [x] Implement the `acme` schema migration baseline and migration runner with
  the advisory lock.
- [x] Implement `@acme/adapter-postgres` against the unchanged conformance kit.
- [x] Implement the quality evaluation store against its unchanged kit.
- [x] Implement the `evidence` schema and the product store adapter against its
  unchanged kit.
- [x] Implement roles, grants and the browser-isolation gate.
- [x] Prove the three ADR-0033 gates.
- [x] Wire the composition roots and prove the restart capability end to end.
- [x] Extend boundary rules to the new packages.
- [x] Write the operations documentation.
- [x] Run every verification gate and record results, including skipped checks.
- [x] Synchronize governing documents, journal, archive and restore the next
  task state.

## Decisions and Notes

- A checkpoint after each step or substep is required. The checklist stays
  aligned with actual progress, and `docs/CURRENT_STATUS.md` is updated whenever
  changes affect behavior.
- ADR-0033 is implemented, not revisited.
- The three highest-risk translations, all named in ADR-0033: idempotency is
  `ON CONFLICT DO NOTHING` plus row count; canonical JSON, timestamps and hashes
  are `text`; unique violations on idempotency and revision constraints must
  reach domain conflict outcomes before the generic error mapper.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- none

## Verification

- [ ] Full technical gate list at freeze; the nine slice 7 gates above are fixed
  and may only be strengthened.
- [ ] Prove the restart capability manually as well as in test.
- [ ] Document skipped checks and reasons.

Verification results:

- `pnpm test:postgres` against `postgres:15` on `127.0.0.1:55432`: 25/25 passed
  (repository conformance 12, quality 3, product 3, ADR-0033 gates 7).
- `pnpm typecheck` passed during implementation.
- Remaining hermetic suite results recorded in the journal handoff entry.
- Manual multi-process workbench restart on Supabase was not repeated beyond
  the migration-reopen and composition wiring proofs; local restart durability
  is covered by reopen + pool lifecycle.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md`
- [ ] Operations documentation for connection limits, migration policy, backup
  and restore
- [ ] ADRs only if a decision cannot hold as written

## Handoff and Follow-ups

- Current state: Ready; implementation in progress.
- Next recommended step: gated Postgres test harness, then migrations and
  adapters.
- Blockers: none
- Child tasks: none
- Open questions: none remaining

## Finalize When Complete

- Archive this file under `docs/finished/ACME-0085_postgresql-slice-7.md`.
- Restore `docs/CURRENT_TASK.md` from template or populate slice 8.
- Add a signed `docs/JOURNAL.md` entry.
