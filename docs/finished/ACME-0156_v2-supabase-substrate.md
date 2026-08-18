# Current Task

Task ID: ACME-0156
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-18
Last updated: 2026-08-18
Charter frozen at: 2026-08-18

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/design/evidence-workbench-v2-domain-specification.md`
- `docs/design/evidence-workbench-v2-interface-plan.md`
- ADR-0029, ADR-0033, ADR-0036, ADR-0037, ADR-0047

## Task Summary
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

The V2 workbench has never been provisioned onto a persistent substrate. Every
recorded V2 run so far used a throwaway PostgreSQL database and a throwaway
bucket, because acceptance proof rule 1 requires a clean substrate per proof
run. The self-hosted Supabase instance at `c:\code\supabase-selfhost` is
running and holds no ACME schema and no storage bucket.

This task provisions the V2 workbench onto that instance and proves it survives
a restart. It is the first step of
[the Evidence Workbench 2.0 interface plan](../design/evidence-workbench-v2-interface-plan.md)
and the prerequisite for every step after it: no surface, review, claim,
relation or timeline work is worth doing against a substrate that has not been
shown to hold a case.

It composes existing packages. It adds no domain object, no surface and no
source class, and it requires no new authority: ADR-0029 already selects
self-hosted Supabase, ADR-0037 already selects the S3-compatible endpoint for
encrypted artifact objects, and ADR-0033 already fixes the PostgreSQL
persistence architecture.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

The V2 Evidence Workbench runs against the installed self-hosted Supabase
instance and, after a full process restart, answers every read from that
instance.

### Primary Deliverable

A documented, repeatable startup path for `apps/evidence-workbench-v2-api`
against the running Supabase stack, together with a recorded run proving import
and post-restart persistence over the real `source-A` text.

### In Scope

- A composition entry point and operator run procedure that reads connection
  details and keys from environment variables or mounted secret files only.
- Schema migration against the Supabase **session** pooler for `evidence_v2`,
  `evidence_v2_identity` and `acme_v2_ledger`.
- Provisioning one named Supabase Storage bucket for V2 artifact objects, and
  wiring `@acme/adapter-evidence-artifact-s3` to the Storage S3 protocol
  endpoint through Kong.
- A recorded run: sign in, create a case, import the real `source-A` canonical
  text, and confirm the persisted part, chain and instance counts.
- A restart proof: stop the process, start it again, and confirm the same case,
  parts, chains and instances read back from PostgreSQL with the canonical
  SHA-256 unchanged.
- A fail-closed check that the transaction pooler on port 6543 is not used.
- Documentation of the run procedure, the required variables and the recorded
  numbers.

### Out of Scope

- PDF, DOCX, OCR or any new source class.
- Any new surface, view, navigation change or visual redesign.
- `Review`, `Standing`, `Claim`, `Relation`, `ConsensusProjection`, timeline
  or case-status work.
- Wiring Supabase Auth. The development authenticator stays for this task.
- Any change to `evidence-v2-source-structure/1`, `evidence-v2-chain/1` or
  `evidence-v2-observe/1`, or to their rule versions.
- Any change to the frozen application under `apps/evidence-workbench-*`
  (non-V2).
- Live model spend. Extraction is out; the deployment may start without the
  live capability and answer 501, which is the required fail-closed behaviour.
- Deployment beyond the operator's own machine, and any remote or public
  exposure.

### Definition of Done

- A single documented command starts the V2 API against the running Supabase
  instance with no secret present in the repository.
- The three schemas exist in the Supabase database and were created by the
  product's own migrations.
- The named storage bucket exists and holds the encrypted canonical text object
  for the imported artifact.
- An imported real `source-A` text yields the expected persisted counts, and
  those counts and the canonical SHA-256 are recorded in the journal.
- After a full process restart, the case, artifact, parts, chains and instances
  read back identically, with no re-derivation on any read path (R-10).
- A connection attempt configured against port 6543 is refused or documented as
  refused, with the reason stated.
- No `ACME` schema is reachable through PostgREST or the anonymous key
  (ADR-0029 browser isolation), verified rather than assumed.
- `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/FILESTRUCTURE.md` and
  `docs/JOURNAL.md` reflect the delivered state.

### Minimum Verification Gates

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm boundaries`
- [x] `pnpm test` (unit, conformance, integration, scenario)
- [x] `pnpm test:postgres` — the `evidence-v2-persistence` gate passes; the two
      pre-existing frozen-app failures recorded in
      `docs/backlog/postgres-gate-test-hygiene.md` remain attributed and
      unchanged
- [x] `pnpm docs:check`
- [x] `pnpm build`
- [x] `git diff --check`
- [x] Recorded manual run: import, counts, restart, identical reads
- [x] Recorded browser-isolation check against PostgREST and the anonymous key

## References

- [Evidence Workbench 2.0 interface plan](../design/evidence-workbench-v2-interface-plan.md)
- [V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)
- [ADR-0029 — self-hosted Supabase persistence platform](../adr/0029-poc-1-self-hosted-supabase-persistence-platform.md)
- [ADR-0033 — PostgreSQL persistence architecture](../adr/0033-postgresql-persistence-architecture.md)
- [ADR-0036 — case management and isolation](../adr/0036-evidence-case-management-and-isolation.md)
- [ADR-0037 — secure artifact foundation](../adr/0037-evidence-secure-artifact-foundation.md)
- [ADR-0047 — application model reset](../adr/0047-evidence-application-model-reset.md)
- `apps/evidence-workbench-v2-api/src/local.ts` — the composition this task
  drives from configuration
- `tests/postgres/evidence-v2-persistence.test.ts` — the existing gate

## Checklist

- [x] Confirm the Supabase stack is running and record its versions.
- [x] Decide and document the V2 bucket name and the schema names.
- [x] Generate the artifact KEK, session key and ledger payload key into
      mounted secret files outside the repository; confirm `.gitignore`
      coverage.
- [x] Add the configuration-driven startup entry point and its run procedure.
- [x] Run the migrations against the session pooler; confirm the three schemas.
- [x] Create the storage bucket; confirm the S3 protocol endpoint accepts a
      signed put and get through the existing adapter.
- [x] Sign in, create a case, import the real `source-A` text; record counts,
      canonical SHA-256 and elapsed time.
- [x] Restart the process; re-read every surface; record identical results.
- [x] Verify the transaction-pooler refusal and record the reason.
- [x] Verify browser isolation against PostgREST and the anonymous key.
- [x] Run every verification gate; record results and any skips with reasons.
- [x] Update `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `FILESTRUCTURE.md` and
      `JOURNAL.md`.
- [x] Archive this task and restore the template.

## Decisions and Notes
- A checkpoint after each step or substep is required. Checklist is therefore updated along the work and `CURRENT_STATUS.md` is always updated when changes affect the behavior.
- Record decisions and assumptions within the frozen charter.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

Verified on 2026-08-18 while drafting, and load-bearing for the charter:

- The Supabase stack is running: Kong healthy on 8000/8443, Storage 1.48.26,
  Supavisor mapping 5432 and 6543, PostgreSQL 15.8.
- A session-pooler connection on `127.0.0.1:5432` as `postgres.<tenant>`
  succeeds.
- The database holds no schema matching `evidence%` or `acme%`, and
  `storage.buckets` is empty. This task is the first provisioning.
- `@acme/adapter-evidence-artifact-s3` signs SigV4 path-style requests against
  a configurable endpoint, which is what the Storage S3 protocol endpoint
  expects. No adapter change is anticipated; if one proves necessary, it is a
  discovery to classify, not a silent addition.

Recorded at freeze, unresolved and deliberately not blocking: whether the
operator wants the V2 deployment to share this Supabase instance with future
acceptance runs.
Acceptance proof rule 1 requires a clean database and bucket **per proof run**,
so an acceptance run must not reuse this deployment's database. That is harness
hygiene and does not constrain this task.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

Run 2026-08-18. Nothing skipped.

- typecheck, lint, format:check, boundaries, docs:check (287 files), build and
  `git diff --check`: clean.
- `pnpm test`: unit 866/866, conformance 78, integration 70, scenario 26.
- `pnpm test:postgres` against the Supabase database: 42 of 43 pass;
  `evidence-v2-persistence` 6/6; `anonymous role is denied against acme and
  evidence schemas` passes. The single failure is the stage-A resume test
  attributed in `docs/backlog/postgres-gate-test-hygiene.md`, unchanged by this
  task. That entry's second recorded failure did not occur, because this `acme`
  schema was empty — the "reused database" condition it describes.
- Recorded manual run: import 1,603 ms; 74,469 lines, 650 parts, 351 chains;
  canonical SHA-256 `d9113164…b53f2d`; stored object 3,521,477 bytes of
  ciphertext with 0 plaintext marker hits; after restart every count and the
  digest identical, 261 ms across five surfaces; Hussein chain 13 instances in
  body-date order.
- Isolation: second principal 404 on all three case-scoped routes and an empty
  case list; unauthenticated 401.
- Browser isolation: PostgREST exposes `public,storage,graphql_public`; anon
  **and** service-role keys get `PGRST205` on the V2 tables; anon key cannot
  fetch the artifact object.
- Transaction pooler: a configuration pointing at port 6543 is refused before
  the first migration, with the reason named.

Three pre-existing failures were found by this run and fixed under the frozen
gate, none in product behaviour: the V2 ledger `snapshot()` type, the app
test's incomplete stand-in repository, and a lint error in the gitignored
`tmp/` scratch directory.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs when long-lived decisions change — none anticipated

## Handoff and Follow-ups

- Current state: `Complete`. Every Definition of Done item is satisfied and
  recorded above.
- Next recommended step: ACME-0157, the interface 2.0 shell and case-status
  surface, authorized by ADR-0049.
- Blockers: none. ADR-0049 and ADR-0050 were accepted on 2026-08-18, so
  ACME-0157 and ACME-0158 are unblocked for their own later charters. Neither
  affects this task.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none blocking. The shared-instance question resolved itself
  in practice — an acceptance run must provision its own database and bucket
  under proof rule 1, so it may not reuse this deployment. Recorded in the
  runbook's limitations.
- Left in place deliberately: the deployment holds 2 cases, one being the empty
  case from the first import attempt that failed on the S3 endpoint host. It was
  not repaired.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
