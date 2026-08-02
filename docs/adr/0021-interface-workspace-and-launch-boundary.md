# ADR 0021 — Interface workspace storage and launch boundary

Status: Accepted

Date: 2026-08-02

Decision owners: ACME maintainers

## Context

ADR-0019 gate 4 accepted that interface-owned artifacts live as files under a
configured workspace root, optionally with a separate SQLite file for a run
history index, and that they must never share tables with the ACME canonical
ledger. Phase 4 is the first slice that writes anything, so the shape of that
storage stops being a promise.

Phase 4 also gives the interface a composition for the first time. Until now
`@acme/test-ui` was a pure library: view builders and a compiler, no adapters,
no I/O on the default entry point. Launching a plan means selecting a
repository and a gateway, which is exactly what a composition root does.

Two facts constrain the design.

First, the specification's S3 describes a run console with a queue, progress,
elapsed-versus-deadline and cost-versus-ceiling. That describes a system that
runs work in the background. This one does not: launching is a function call
that returns when the run is over.

Second, the interface must never write to the ledger. The write list ADR-0019
fixed is: launch through existing entry points, persist interface-owned
artifacts separately, and record human approvals. Never `commit`, never
`markTerminal`, never touch a model call.

## Decision

### 1. The workspace is a directory of files the interface owns

```text
<workspace root>/
└── runs/
    └── <runId>.json
```

Run records are the only thing phase 4 writes. Plans are read from wherever
the author keeps them; the interface does not own them.

The workspace root is configured by the caller and is never derived from the
ledger's location. No file the interface writes is ever read by the engine,
and no file the engine writes is ever written by the interface.

### 2. The history index is derived, not maintained

Listing history reads the run directory and parses the records. There is no
separate index file to update.

An index that is written alongside the thing it indexes is a second source of
truth that drifts the first time a write is interrupted. Deriving it costs a
directory read and cannot disagree with what was recorded.

Gate 4 permits a separate SQLite file if file listing becomes insufficient.
Nothing needs one yet, and adding one later changes no record format.

### 3. A run identifier is a file name, and is validated as one

`runId` must match `^[A-Za-z0-9._-]+$` and may be neither `.` nor `..`. A
value that does not is refused before any path is constructed.

This is the whole traversal defence for writes. Reads already resolve
references through the phase-2 path rules; writes need their own, because a
run identifier reaches the filesystem directly.

### 4. Launch is synchronous, and the console says so

`launchPlan` compiles, runs and records, then returns. It starts no worker,
schedules nothing, retries nothing and cancels nothing.

Consequently `acme-view-runs/1` reports its live-progress section as
`unavailable` with reason `RUN_PROGRESS_UNAVAILABLE`. Rendering a queue with
one synchronous entry in it, or a progress bar that is always complete, would
describe a system that does not exist. When a background runner appears, the
section becomes available and the reason code disappears — the contract does
not change shape.

The historical half is available and ordered by `startedAt` then `runId`, so
two runs recorded in the same instant still list deterministically.

### 5. The interface writes no ledger state

Launch reaches the engine only through `runScenario`, the same entry point the
CLI uses. Evidence is read back through the repository port. The interface
records what a run was and where its evidence lives; the evidence itself stays
in whichever repository the composition selected.

Deleting the workspace therefore loses run history and nothing else. Every
canonical fact survives, which is the ADR-0019 property restated for storage.

### 6. Composition lives on a separate entry point

`@acme/test-ui` publishes `.` (pure), `./node-source` (discovery) and
`./local` (workspace, composition, launch). The default entry point still
performs no I/O and still selects no adapter, so the view contracts and the
compiler remain assertable without a disk.

## Alternatives Considered

### Alternative A — Maintain an explicit history index file

- Benefits: one read to list history; room for cached summaries.
- Costs: two writes per run, and a torn write leaves the index disagreeing
  with the records it indexes.
- Reason not selected: the record files are already the truth. At this scale a
  directory read is cheap, and correctness beats a saved read.

### Alternative B — Reuse `@acme/cli`'s composition

- Benefits: no duplicated adapter selection.
- Costs: an app-to-app dependency, and the interface would inherit the CLI's
  argument handling and exit-code semantics, which are not its own.
- Reason not selected: the specification says the interface launches through
  the same *entry points* the CLI uses — ScenarioRunner and the engine — not
  through the CLI. Both are composition roots; each owns its own selection.

### Alternative C — Model the console with a queue now

- Benefits: matches the specification's S3 field list exactly.
- Costs: the fields would be constants dressed as measurements; a queue depth
  of one and a progress value that is always 100 percent.
- Reason not selected: the interface must not display as fact what it cannot
  derive. An unavailable section is honest; a simulated queue is not.

## Consequences

### Positive

- Run history exists without a database, and cannot disagree with itself.
- Traversal is refused at the one place writes can reach the filesystem.
- The default entry point keeps the property that made phases 1–3 cheap to
  verify.
- Deleting the workspace loses no canonical fact.

### Negative

- Listing history reads every record; that is linear in run count.
- No background execution, so a long run blocks its caller.
- S3 ships half-available, and a reader must understand why.

### Follow-ups

- Phase 5: baselines, thresholds and fixture approval records, which are
  further interface-owned artifacts under the same root.
- A background runner, if one is ever wanted, fills in the progress section
  rather than changing the contract.
- A separate SQLite history index if record count ever makes listing slow.

## Compatibility and Migration

Nothing existing changes. Core, the adapters, the modules, `@acme/testing`,
`acme-scenario/1` and the CLI are untouched.

`@acme/test-ui` gains dependencies on the adapters, the reference modules and
`@acme/testing`, which makes it a composition root beside `@acme/cli`. It
remains a leaf: nothing in the workspace imports it, and a dependency-cruiser
fixture proves it.

Run records carry `version: 'acme-run-record/1'`. A breaking change to the
record shape publishes `acme-run-record/2`; unreadable records are reported as
unreadable rather than skipped, so a format change cannot silently shrink
history.

## References

- [ADR-0019 Domain Test UI boundary and view contracts](0019-domain-test-ui-boundary-and-view-contracts.md)
- [ADR-0020 `acme-test-plan/1` schema and compiler](0020-acme-test-plan-schema-and-compiler.md)
- [Domain Test UI — Specification](../design/domain-test-ui-specification.md)
- `apps/cli/src/composition.ts` — the existing composition-root pattern
- `packages/testing/src/scenario.ts` — `runScenario` and its report
