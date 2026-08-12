# Current Task

Task ID: ACME-0085
Parent Task: None
Status: Draft
Owner:
Created: 2026-08-12
Last updated: 2026-08-12
Charter frozen at:

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

Two facts ADR-0033 deliberately did not guess must be observed and recorded
before the adapter is configured: the direct PostgreSQL port of the deployed
self-hosted release, and its PostgreSQL major version for pinning the CI
container.

## Task Charter

The charter is editable while this task is `Draft` and becomes immutable at
`Ready`. The open questions below must be answered before freeze.

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
- A PostgreSQL Evidence product store adapter over the `evidence` schema,
  implementing the existing `EvidenceProductRepository` port beside the file
  adapter.
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

To be completed before freeze. Draft intent:

- Both adapters pass their existing shared conformance kits unchanged.
- All six inherited slice 7 gates and all three ADR-0033 gates pass.
- The restart capability is proven end to end, not asserted.
- The default `pnpm test` suite remains hermetic and offline, with PostgreSQL
  gates reachable only through their own command.
- Governing documents, operations documentation and the journal are
  synchronized, and the task is archived.

### Minimum Verification Gates

To be completed and frozen before work begins. The nine gates below are already
fixed by the technical specification and ADR-0033 and may be strengthened but
not removed.

Inherited from the technical specification, section 15:

- [ ] Parity with the SQLite and in-memory repository conformance kits,
  unchanged.
- [ ] Aggregate transaction rollback: a fault inside `commit()` leaves no
  documents, memory, state, events, outbox entries, commit record or terminal
  result, and the repository stays usable.
- [ ] Contended expected-revision write: two writers against one revision yield
  exactly one commit, and the loser fails with `CONFLICT_STATE_REVISION` and
  writes nothing.
- [ ] Resume and replay: an interrupted execution completes from its recorded
  model call with no provider call, reaching the same operation digest.
- [ ] Append-only review ordering preserved in the product store.
- [ ] Migration and reopen: a committed database reopened in a new connection
  yields identical replay evidence and identical operation digest.

Added by ADR-0033:

- [ ] Two concurrent drains lease disjoint outbox sets, and no event is
  delivered twice within one lease window.
- [ ] A connection as the platform's anonymous browser-facing role is denied
  against both the `acme` and `evidence` schemas.
- [ ] Two processes starting concurrently against an un-migrated schema produce
  exactly one applied migration set.

Repository baseline:

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm boundaries`,
  `pnpm test`, `pnpm build` and `pnpm docs:check`.
- [ ] `git diff --check`.
- [ ] Record every skipped check with its exact reason.

## Open Questions to Answer Before Freeze

These change what the task is, so they belong to the maintainer and must be
settled while the charter is still editable.

1. **Should slice 7 be one task or two?** The technical specification defines it
   as one slice delivering both adapters, and the reviewer capability needs
   both: evidence lives in the ACME ledger, review decisions live in the product
   store, so neither half alone proves a durable restart. That argues for one
   task with one coherent verification story. The counter-argument is the Task
   Size Rule: the ACME PostgreSQL adapter is independently valuable beyond this
   POC, while the product store is not, which is the shape of two deliverables.
   **Recommendation: one task.** Split into an engine adapter task and a product
   store plus restart proof task only if the change set proves unreviewable.
   Answer: One task.

2. **Does the Evidence product PostgreSQL schema translate the file adapter's
   shape, or get a designed relational schema?** ADR-0033 deliberately left
   concrete table and column design out. A direct translation is faster and
   keeps the two adapters obviously equivalent; a designed schema is better
   long-term but invites scope. 
   Answer: Translate now, and record any relational improvement as a backlog proposal.

3. **Does PostgreSQL become selectable or default anywhere?** SQLite stays the
   CI and offline default under ADR-0029, so the proposal is opt-in everywhere:
   a new CLI `--adapter postgres` beside `memory|sqlite`, and a workbench
   configuration option. 
   Answer: No default changes.

4. **Is the CI PostgreSQL job part of this task or separate?** ADR-0033 decides
   the environment; someone must wire it. 
   Answer: It's part of this task because a gate nobody runs is not a gate.

5. **Package name for the product store adapter.** ADR-0033 names
   `@acme/adapter-postgres` for the engine. The product store needs a name;
   `@acme/adapter-evidence-product-postgres` follows the existing
   `@acme/adapter-evidence-product-file`.
   Answer: Follow naming convention.

6. **Who observes the two deferred environment facts**, the direct PostgreSQL
   port and the PostgreSQL major version, and against which deployed release?
   This needs an actual running instance and cannot be answered from the
   repository.
   Answer: Instance is running at supabase.audioleaf.se (localhost:8000) postgresSQL / supabase-selfhosted root at c:\code\supabase-selfhost

## Checklist

To be expanded into concrete ordered steps before freeze.

- [x] Answer the six open questions and record the decisions.
- [ ] Complete the Definition of Done and freeze the charter at `Ready`.
- [ ] Observe and record the direct PostgreSQL port and major version.
- [ ] Stand up the ephemeral PostgreSQL container and the gated test
  configuration before writing adapter code, so every step below is verifiable
  as it lands.
- [ ] Implement the `acme` schema migration baseline and migration runner with
  the advisory lock.
- [ ] Implement `@acme/adapter-postgres` against the unchanged conformance kit.
- [ ] Implement the quality evaluation store against its unchanged kit.
- [ ] Implement the `evidence` schema and the product store adapter against its
  unchanged kit.
- [ ] Implement roles, grants and the browser-isolation gate.
- [ ] Prove the three ADR-0033 gates.
- [ ] Wire the composition roots and prove the restart capability end to end.
- [ ] Extend boundary rules to the new packages.
- [ ] Write the operations documentation.
- [ ] Run every verification gate and record results, including skipped checks.
- [ ] Synchronize governing documents, journal, archive and restore the next
  task state.

## Decisions and Notes

- A checkpoint after each step or substep is required. The checklist stays
  aligned with actual progress, and `docs/CURRENT_STATUS.md` is updated whenever
  changes affect behavior.
- ADR-0033 is implemented, not revisited. Its `Traceability` table identifies
  which decisions it originates and which it inherits, which is the fastest way
  to see what a proposed deviation would actually be changing.
- The three highest-risk translations, all named in ADR-0033, are worth
  re-reading before the code they govern: idempotency must be
  `ON CONFLICT DO NOTHING` plus row count rather than select-then-insert;
  canonical JSON, timestamps and hashes must be `text`; and unique violations on
  idempotency and revision constraints must reach the domain conflict outcomes
  before the generic error mapper sees them.
- Standing the test environment up before the adapter is deliberate. The
  conformance kit is the specification of correct behavior, and it is cheaper to
  run it from the first method than to write an adapter and discover the
  factory-lifecycle problem at the end.
- Classify discoveries using `docs/TASK_WORKFLOW.md`. Non-blocking improvements
  go to `docs/backlog/`; a blocking prerequisite pauses this task and activates
  a bounded child.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- none

## Verification

- [ ] Define the full technical gate list at freeze; the nine slice 7 gates
  above are already fixed and may only be strengthened.
- [ ] Prove the restart capability manually as well as in test.
- [ ] Document skipped checks and reasons.

Verification results:

- Pending.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md`, which will change: this task adds packages
- [ ] Operations documentation for connection limits, migration policy, backup
  and restore
- [ ] ADRs only if a decision cannot hold as written

## Handoff and Follow-ups

- Current state: Draft. Both prerequisites are satisfied and ADR-0033 decides
  the architecture. The charter needs the six open questions answered and its
  Definition of Done completed before freeze. No code exists.
- Next recommended step: answer the open questions, complete the Definition of
  Done, then freeze at `Ready`.
- Blockers: none in the repository. Question 6 needs a running self-hosted
  instance to observe two environment facts.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: the six above.

## Finalize When Complete

- Archive this file under `docs/finished/ACME-0085_<task-slug>.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`, or
  populate it with the next explicitly approved task, expected to be slice 8,
  the hosted shell, which additionally requires its own identity and
  authorization ADR.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done becomes invalid after freeze, supersede this
  task instead of rewriting it.
