# ADR 0027 — Async plan launch, job records, progress and cancellation

Status: Accepted

Date: 2026-08-09

Decision owners: ACME maintainers

## Context

ADR-0021 made `launchPlan` synchronous by design: compile, run through
`runScenario`, write one interface-owned run record, return. That honesty left
S3's live-progress section as `unavailable` (`RUN_PROGRESS_UNAVAILABLE`) rather
than a fake queue of depth one.

G08 / gap-plan **T1** still needs long runs not to block the HTTP caller, a real
progress projection, and cancellation that cannot corrupt the ledger. Four
questions were open:

1. Who owns the worker?
2. What is persisted for in-flight work?
3. How is progress projected without inventing verdicts?
4. How does cancel interact with the engine and committed state?

Constraints that remain binding:

- Interface artifacts never share tables with the ACME ledger (ADR-0019/0021).
- Default `@acme/test-ui` entry stays pure — no I/O, no adapters (ADR-0021/0024).
- Libraries do not own background timers or auto-drains (same spirit as
  ADR-0018 for outbox).
- Status is a projection over evidence; the UI never invents a pass/fail
  (ADR-0019).
- Cancellation must not roll back a committed unit of work (domain-test-ui
  specification S3).
- Distributed multi-node queues and browser websockets are out of T1 scope.

The gateway stack already carries `AbortSignal` on `GatewayCallContext`. The
ExecutionEngine currently supplies a fresh, never-aborted signal. ScenarioRunner
has no optional call-level signal between steps. Those are the minimum engine
hooks needed for cooperative cancel.

## Decision

### 1. The local workbench process owns the worker

Background plan work runs **in-process** inside the opt-in
`@acme/test-ui/local` composition (the loopback workbench or an equivalent
local host). Ownership rules:

| Owner | Role |
| --- | --- |
| Workbench / local host | Accepts jobs, runs them on the Node event loop, holds `AbortController`s, updates job records, serves S3 progress |
| `@acme/test-ui` pure entry | Job **types**, parsers and progress **view builders** only — no scheduler |
| `@acme/core` / adapters | Cooperative cancel via `AbortSignal`; no job queue |
| Browser | Polls views; never owns execution |

There is no external worker process, no multi-node queue and no library-owned
interval that drains work while nobody is listening. When the process exits,
in-flight jobs stop. On the next start, non-terminal job files are marked
`interrupted` (interface-only); the ledger is not rewritten.

Default concurrency is **one running job**; further accepted jobs wait as
`queued`. Raising the limit later does not change record shapes.

### 2. Job records are interface-owned; run records stay terminal history

Workspace layout (extends ADR-0021):

```text
<workspace root>/
├── runs/
│   └── <runId>.json          # acme-run-record/1 — written only when terminal
├── jobs/
│   └── <jobId>.json          # acme-job-record/1 — in-flight + terminal job
├── baselines/
└── approvals/
```

For T1, **`jobId === runId`**. One accepted launch produces one job file and,
when the work ends, one run history file under the same identifier. Run ids
remain safe file names (`^[A-Za-z0-9._-]+$`).

**Job record** (`acme-job-record/1`) holds:

- identity: `jobId`, `runId`, plan/scenario names, composition labels
- lifecycle: `status`, `queuedAt`, `startedAt?`, `updatedAt`, `finishedAt?`
- progress snapshot: current step index/kind, optional total steps, short message
- cancel: `cancelRequestedAt?`
- terminal link: whether a run record was written; failure summary when applicable

Job lifecycle:

```text
queued → running → completed | failed | cancelled
              ↘ cancelling → cancelled | completed | failed
non-terminal at process start → interrupted
```

`cancelling` means a cancel was requested while work was still in flight. The
terminal status is whatever the cooperative run actually observed: if the last
step finished before abort was seen, the job may still complete successfully.

**Run record** remains the historical half of S3. It is written **once**,
exclusively, when the job reaches a terminal outcome other than `interrupted`
with no usable report. Status values:

- `passed` / `failed` — unchanged
- `cancelled` — additive outcome when the run stopped because of cancel
  (parser accepts it; measurement treats it as non-pass)

Deleting the workspace still loses interface history and jobs only. Ledger
facts are untouched.

### 3. Synchronous `launchPlan` stays; async is a parallel API

| API | Behaviour | Use |
| --- | --- | --- |
| `launchPlan` | Unchanged: blocks until complete, writes run record, no job file required | Scripts, tests, CLI-like local callers that want a single await |
| `enqueuePlan` (local) | Validates, refuses duplicate id, writes `queued`/`running` job, schedules work, returns immediately | Workbench HTTP launch and any host that needs progress |

The workbench HTTP launch path uses **`enqueuePlan`**. It must not await the
full scenario before responding. Redirect to S3 (or `202` + Location) is
allowed once the job is accepted.

`launchPlan` does **not** become a thin wrapper that always enqueues; callers
that need the old blocking contract keep it without a job runner.

### 4. Progress is a pure projection over job records

`acme-view-runs/1` keeps its two-section shape. When the host supplies job
evidence (including an empty list), the **progress** section is `available`
with a queue projection derived only from job records:

- active and queued jobs
- per-job status, elapsed timestamps, step progress snapshot
- cancel affordance is a host action, not a computed verdict

When the host supplies **no** job evidence (pure history-only callers),
progress remains `unavailable` with `RUN_PROGRESS_UNAVAILABLE` — same honesty
as ADR-0021 for environments without a runner.

Progress snapshots are updated by the local runner as scenario steps start
(and optionally complete). The view builder copies fields; it does not infer
pass rates from partial steps.

Polling (HTTP GET on S3) is sufficient for T1. Websockets and SSE are out of
scope.

### 5. Cancellation is cooperative and ledger-safe

1. `cancelJob(jobId)` sets `cancelRequestedAt`, moves `running` → `cancelling`
   (or drops `queued` → `cancelled` without starting work), and aborts the
   job's `AbortController`.
2. `runScenario` accepts optional `signal: AbortSignal` and checks it **before
   each step**. Optional `onStep` reports progress to the job runner only.
3. `ExecutionEngine.execute` accepts an optional call option
   `{ signal?: AbortSignal }` and passes that signal into
   `GatewayCallContext` (instead of always creating a never-aborted signal).
4. Model transports already honour abort; cancelled pre-dispatch and in-flight
   paths keep existing semantics (`CANCELLED` / non-ambiguous where already
   defined).
5. **Already committed** executions in earlier scenario steps stay committed.
   Cancel never rolls back ledger commits and never invents model outcomes for
   open attempts. Open/stranded rows remain the existing operator story
   (ACME-0058), not a silent repair by the UI.
6. On cancel terminalisation, the interface writes a run record with status
   `cancelled` (or `failed` only when the scenario failed for a non-cancel
   reason) listing completed steps honestly and skipping the rest.

### 6. Composition and purity boundaries

```text
apps/test-ui (pure)
  job-record parse/types
  buildRunsView(progress from optional jobs)

apps/test-ui/local
  workspace jobs/* I/O
  JobRunner (enqueue, cancel, single-flight queue)
  enqueuePlan
  HTTP routes

packages/testing
  runScenario({ signal?, onStep? })

packages/core
  execute(request, { signal? }?)  // optional second arg; default unchanged
```

No new dependency from core to test-ui. No job tables in SQLite ledger
migrations.

## Alternatives Considered

### Alternative A — Make `launchPlan` itself non-blocking

- Benefits: one API.
- Costs: breaks every caller that awaits a finished run record; blurs
  sync-script vs workbench semantics.
- Reason not selected: keep the ADR-0021 contract; add a parallel enqueue API.

### Alternative B — External worker process / OS queue

- Benefits: survives workbench HTTP restarts mid-run more cleanly.
- Costs: second process, IPC, deployment surface; out of T1; still must not
  write the ledger from a second writer without a unit-of-work story.
- Reason not selected: local workbench ownership is enough; document
  interruption on process death.

### Alternative C — Simulate progress without a job store

- Benefits: no new files.
- Costs: reintroduces the ADR-0021 rejected fake queue; progress would be
  invented.
- Reason not selected: unavailable-or-real remains the rule.

### Alternative D — Cancel by killing the process / abandoning without records

- Benefits: trivial.
- Costs: no history, unclear ledger linkage, S3 lies.
- Reason not selected: terminal job + run records are required for honest
  console history.

### Alternative E — Put jobs in the SQLite ledger

- Benefits: one database file.
- Costs: violates interface/ledger separation; couples UI lifecycle to
  canonical schema migrations.
- Reason not selected: jobs are interface-owned files under the workspace.

## Consequences

### Positive

- HTTP launch can return while work continues; S3 live progress becomes real.
- Cancel is cooperative and reuses existing AbortSignal plumbing.
- Pure default entry and sync `launchPlan` remain testable without a runner.
- Ledger commits stay authoritative; UI cannot un-commit.

### Negative

- Process death leaves `interrupted` jobs; no automatic resume of a plan job
  (engine resume of a single execution remains ADR-0017 and is separate).
- Dual APIs (`launchPlan` vs `enqueuePlan`) must be documented.
- Run-record status gains `cancelled`; consumers that assumed a binary
  passed/failed pair must treat the third outcome.

### Follow-ups

- Optional higher concurrency and fair multi-job scheduling.
- Optional append-only `jobs/<id>.events.jsonl` if snapshot progress is too
  coarse.
- Optional SSE/websocket push for the workbench (productisation).
- Engine-level cancel checks between more internal stages if model calls stay
  long after abort (transport abort remains primary).

## Compatibility and Migration

- `launchPlan` behaviour and signature stay.
- `acme-run-record/1` accepts additive status `cancelled` (same version;
  unknown statuses still fail parse).
- `acme-job-record/1` is new; unreadable job files surface like unreadable runs.
- `acme-view-runs/1` progress payload type expands when available; unavailable
  reason code unchanged for hosts without job evidence.
- `ExecutionEngine.execute` second argument is optional; all existing call
  sites remain valid.
- `runScenario` options gain optional fields only.

Nothing in core ledger schema migrates for T1.

## References

- [ADR-0018 Outbox delivery boundary](0018-outbox-delivery-boundary.md)
- [ADR-0019 Domain Test UI boundary and view contracts](0019-domain-test-ui-boundary-and-view-contracts.md)
- [ADR-0021 Interface workspace and launch boundary](0021-interface-workspace-and-launch-boundary.md)
- [ADR-0024 Local SPA loopback workbench](0024-local-spa-loopback-workbench.md)
- [Gap resolution plan — T1](../design/gap-resolution-plan.md)
- Domain Test UI specification — S3 cancellation rules
