# Current Task

Task ID: ACME-0152
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- [ADR-0047](../adr/0047-evidence-application-model-reset.md) §4 (frozen set and
  shared infrastructure) and §6 (carried forward unchanged)
- [V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)
  §4 flow, §6 surfaces, §7 V1 boundary, §9 R-08, W-03, §10a package boundary
- [ACME-0150](ACME-0150_v2-source-structure.md) and
  [ACME-0151](ACME-0151_v2-chains-and-instances.md)

## Task Summary

Two derived layers exist and neither can be looked at. `SourcePart` and
`Chain` are pure functions over text, verified only by a script pointed at a
file in a temporary directory. W-03 makes real persistence, real adapters and
real navigation a precondition for any POC claim, so a third offline layer
would move the product no closer to one.

This task makes the two existing layers operable: a case on real PostgreSQL, an
artifact whose bytes live encrypted in a real object store, structure and chain
state derived once at import and stored, and a plain browser surface that
walks Case → Source → Chain → Instance → exact source lines.

It adds no new domain object and spends nothing: no provider call, no model.

## Task Charter

Frozen at Ready.

### Goal

The `SourcePart` and `Chain` layers become operable against real
infrastructure: persisted once at import, navigable in a browser, and durable
across a process restart.

### Primary Deliverable

A running V2 workbench — contracts, a PostgreSQL adapter, an API composition
and a minimal browser shell — in which a real imported artifact's parts and
chains can be navigated and a chain membership can be corrected.

### In Scope

- `packages/evidence-v2-contracts`: records for `Case`, `Artifact`,
  `SourceStructure`, `ChainProposal` and `ChainDecision`, plus one repository
  port over them. No behaviour beyond shapes and the port.
- `packages/adapter-evidence-v2-postgres`: that port over PostgreSQL in its own
  schema, with versioned migrations, using the shared `@acme/adapter-postgres`
  transaction, migration and driver-error helpers.
- `apps/evidence-workbench-v2-api`: composition root and HTTP routes for
  create/list case, import artifact text, list parts, read one part's exact
  source lines, list chains, read one chain with its ordered instances, and
  append one membership decision.
- `apps/evidence-workbench-v2-web`: a plain server-rendered shell for
  Case → Source → Chain → Instance. No client framework, no dashboard, no
  chart, no report.
- Artifact bytes stored through the shared `@acme/evidence-artifacts` envelope
  and object-store port, with the filesystem and S3 adapters, so canonical text
  is encrypted at rest exactly as the frozen application stores it.
- **Derive once, read many.** Structure and chain proposal are computed at
  import and persisted. No read path re-derives them (R-10).
- **Bounded reads.** Parts and chains are paginated with an explicit bound. No
  route and no page returns an unbounded list (R-08).
- A local runner that starts the app against real PostgreSQL and a real object
  store, and a documented way to import a prepared canonical text file.
- Deterministic offline tests for the contracts, the routes and the shell,
  plus a PostgreSQL-backed test under the existing `test:postgres` gate.

### Out of Scope

- `ObservationOccurrence`, extraction, comparison, `Claim`, `Relation`,
  `ConsensusProjection`. No model call and no provider configuration.
- **Authentication and authorization.** The deployment binds to loopback and
  every route names its case explicitly. Wiring the shared `@acme/evidence-auth`
  principal, session and membership model is the next task, and until it lands
  this app is a local single-operator tool. It is stated as a limitation in
  `CURRENT_STATUS.md`, not hidden.
- Search, case overview, export, assessment, redaction, reviewer assignment.
- Editing or re-deriving a stored structure. An artifact is immutable and its
  structure is derived exactly once, at import.
- Changing `evidence-v2-source-structure/1`, `evidence-v2-chain/1` or their
  rule versions, including the index-run boundary condition recorded in
  [the backlog](../backlog/v2-index-run-part-boundary.md).
- Any change to the frozen set in ADR-0047 §4.
- Any migration of frozen-application data.

### Definition of Done

- On a **fresh** database schema and object-store bucket: creating a case and
  importing the real `source-A` canonical text through the API stores an
  artifact whose server-computed canonical SHA-256 equals the prepared text's,
  and yields 650 persisted parts and 351 persisted chains.
- The browser walks case → parts → chains → the `Ammouri, Hussein` chain → its
  13 instances in body-date order → an instance's exact source lines, with
  every page bounded.
- The part titled `Förhör med Ammouri, HUSSEIN; 2007-04-25` is shown under
  `Ammouri, Allia`, because the stored chain state says so.
- Appending a membership decision through the API changes the effective chain
  state and leaves the stored proposal and the stored structure byte-identical.
- Stopping and restarting the process preserves the case, artifact, parts and
  chains, read from PostgreSQL with no re-derivation.
- No read path calls a derivation function. A test asserts it.
- `pnpm boundaries` still forbids any V2 package or app from importing the
  frozen set.
- No file in the frozen set is modified.

### Minimum Verification Gates

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm boundaries`
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance`
- [x] `pnpm test:integration`
- [x] `pnpm test:scenario`
- [x] `pnpm test:postgres`
- [x] `pnpm docs:check`
- [x] Recorded local run: fresh substrate, real import, navigated surface,
      restart, and a membership decision

## References

- [V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)
  §6 surfaces and their unbreakable UX rules, §9 R-08 and R-10, W-03.
- [ADR-0047](../adr/0047-evidence-application-model-reset.md) §4 — shared
  infrastructure the new application links against directly.
- ADR-0033 PostgreSQL persistence architecture, ADR-0037 secure artifact
  foundation. Both are carried forward and are used, not re-decided.

## Checklist

- [x] Contracts package: records and repository port.
- [x] PostgreSQL adapter: schema, migrations, repository.
- [x] Composition: pool, object store, keyring, repository.
- [x] Import route: store artifact, derive structure and chains once, persist.
- [x] Read routes: bounded parts, part source, bounded chains, one chain.
- [x] Decision route: append one membership decision.
- [x] Browser shell: Case → Source → Chain → Instance.
- [x] Local runner and import documentation.
- [x] Offline tests plus the PostgreSQL gate.
- [x] Recorded real run on a fresh substrate, including a restart.
- [x] Reality-sync `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `FILESTRUCTURE.md`.
- [x] Archive and restore the template.

## Decisions and Notes

- **On task size.** This is persistence, an API and a surface in one charter.
  They are not independently valuable: persistence with nothing to look at is
  the very outcome the previous handoff forbade, and a surface over nothing is
  a mock. One primary outcome — the existing layers become operable — with one
  verification story.
- The surface is deliberately plain. Its job is to prove navigation and
  provenance, not to look finished.
- Derivation stays in `@acme/module-evidence-v2`. The adapter stores its
  output; it does not reimplement it.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- none

## Verification

```text
pnpm typecheck                          pass
pnpm lint (apps packages tests tooling) pass
pnpm format:check                       pass
pnpm boundaries                         pass, incl. v2-frozen-model fixture
pnpm docs:check                         274 Markdown files
pnpm test:unit                          836/836 (was 828; +8 new)
pnpm test:conformance                   78/78
pnpm test:integration                   70/70
pnpm test:scenario                      26/26
pnpm test:postgres (this suite)         4/4 evidence-v2-persistence
```

`pnpm lint` at the repository root still reports the pre-existing
`no-unused-vars` in the gitignored ACME-0148 scratch file, recorded under
ACME-0149 and untouched.

Recorded run: fresh PostgreSQL database `acme_v2`, fresh MinIO bucket
`evidence-v2-poc`, the real `source-A` canonical text. The text is not
committed.

```text
migrations                 applied to an empty database
case                       case-3210da3dbf753ea2a1f4f62e2d61db86
import                     1,205 ms
canonical sha256           matches the prepared text
lines                      74,469
parts persisted            650
chains persisted           351
--- process stopped and restarted; everything below read from PostgreSQL ---
parts page                 100 of 650 (limit 100)
chains page                100 of 351 (limit 100)
Hussein chain              chain-000009 "Ammouri, Hussein", 13 instances
                           2004-10-19T15:40 … 2005-09-16T11:35, each with its
                           provenance line, three spanning several parts
mis-titled part            part-000387, title "… Ammouri, HUSSEIN; 2007-04-25 …"
                           its chain: Ammouri, Allia
                           exact source lines served: 352
HTML pages                 200 /, /cases/:id, /parts, /parts/:id, /chains,
                           /chains/:id  (1.6 kB – 32 kB)
decision appended          decision-0152-1
  part-000381 chain now    Ammouri, Allia
  Hussein chain view       13 -> 12 instances
  stored proposal          645 rows, md5 unchanged
  stored structure         650 rows, md5 unchanged
  decision log             1 entry
```

The proposal and structure fingerprints are read straight from PostgreSQL, so
"the decision changed nothing else" is measured rather than asserted.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/JOURNAL.md`
- [x] ADRs — none expected. Persistence and artifact decisions are reused.

## Discovered While Implementing

**The chain page showed the proposal, not the reviewer's correction.** The
recorded run moved a part to another chain: the part page immediately showed
the new chain, but the old chain still listed it, so a correction was invisible
on the surface where it was made. `readChain` now filters each instance's parts
by effective membership and drops emptied instances. Caught by the real run,
not by a unit test, and now covered by one.

Nothing else discovered was acted on.

## Handoff and Follow-ups

- Current state: complete. The product is operable: a case, a real import, 650
  parts and 351 chains navigable in a browser, durable across restart.
- Next recommended step: authentication and authorization, wiring the shared
  `@acme/evidence-auth` principal, session and membership model. It is the one
  thing this task deliberately deferred, and it is what stops the app being a
  single-operator loopback tool.
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: none. Authentication is deferred by decision, not by
  oversight, and is the named next task.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
