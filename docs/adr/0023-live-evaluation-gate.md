# ADR 0023 — Live evaluation gate for the Domain Test UI

Status: Accepted

Date: 2026-08-02

Decision owners: ACME maintainers

## Context

ADR-0019 gate 5 allows live runs in the Domain Test UI only in a late phase,
behind environment opt-in, confirmation and budget. Until phase 6 the only
supported live path is CLI `execute --gateway openai`.

Phases 1–5 shipped S1–S9 without any live composition. ADR-0022 already
partitions measurement into deterministic (`gateway: mock`) and live series so
a future live run cannot contaminate a deterministic rate. What remains is to
define how a live run may be *started* and how S10 reports it — without
credentials entering the interface surface, without inventing a quality score,
and without turning ScenarioRunner into a live workflow engine.

## Decision

### 1. Live evaluation is single-execute, not multi-step scenario

S10 launches one `ExecutionRequest` through `ExecutionEngine` and an OpenAI
Responses gateway — the same shape as CLI live execute.

`ScenarioRunner` and `acme-scenario/1` stay mock-only. Multi-step live
scenarios would need fixture-free model steps, branching and budget accounting
across a graph; that is a separate charter, not a silent expansion of the
runner.

### 2. Two keys are required: environment opt-in and a confirmation document

```text
ACME_TEST_UI_LIVE ∈ {1, true}   (composition root / local only)
  AND
acme-live-confirmation/1 with optIn: true, confirmer, rationale, budget
```

Either alone is refused. The environment flag cannot be set from a view
contract; the confirmation cannot substitute for process-level opt-in.

### 3. Credentials never enter confirmation, views or run records

`OPENAI_API_KEY` is read only inside `@acme/test-ui/local` when building the
gateway, exactly as the CLI composition root does. The confirmation schema
rejects credential-shaped field names (`apiKey`, `token`, `secret`,
`password`, `authorization`, and `OPENAI_API_KEY`). Views and stored
confirmations never carry secrets.

### 4. Confirmation is budget, not a score

The confirmation states:

- provider (v1: `openai` only)
- model id (non-secret selection string)
- case count (v1: exactly `1`)
- `maxModelCalls` ceiling
- optional `costCeilingMinor` + currency (declared bound; not a quality grade)
- confirmer identity and non-empty rationale

Launch refuses when the request's `maxModelCalls` exceeds the confirmed
ceiling. No composite quality score is computed (ADR-0022 stands).

### 5. S10 is a live-series surface

`acme-view-live-evaluation/1` labels its series `live` and lists only runs
whose recorded gateway is not `mock`. Deterministic history is out of scope
for this view. Cost/usage appears when the live run record retained it;
otherwise the cost section is `unavailable`.

### 6. Live run records stay interface-owned

A successful or failed live launch writes `runs/<runId>.json` with
`composition.gateway` other than `mock` and an optional `live` block holding
provider, model, usage summary and confirmation metadata (never credentials).
S8's existing partition then measures live runs only in the live series.

## Alternatives Considered

### Alternative A — Live multi-step ScenarioRunner

- Benefits: same authoring path as offline plans.
- Costs: runner would need live steps without mock fixtures, budget across
  steps, and new scenario semantics; high risk of mixing live and mock.
- Reason not selected: out of scope for the optional late phase; CLI and S10
  single-execute cover the human live need.

### Alternative B — UI holds API keys in confirmation

- Benefits: no env setup.
- Costs: secrets in workspace files and view JSON; contradicts section 21 and
  ADR-0019.
- Reason not selected.

### Alternative C — Env flag alone, no confirmation document

- Benefits: fewer steps.
- Costs: no named person, no budget, no rationale for an expensive call.
- Reason not selected: gate 5 requires confirmation and budget.

## Consequences

### Positive

- Live runs are impossible by accident.
- Credentials stay in the process environment.
- Live outcomes feed only the live measurement partition.
- Offline tests inject a transport; default gates need no network.

### Negative

- Multi-step live books/scenarios still require the CLI or a future charter.
- Cost ceilings are declared and checked against usage when present; without
  provider usage metadata the ceiling is not numerically enforced after the
  fact beyond model-call count.

### Follow-ups

- Multi-step live scenarios, if ever needed.
- Embedding live composition into `acme-test-plan/1` (explicitly excluded now).
- Browser confirmation UX (unchartered rendering surface).

## Compatibility and Migration

Nothing existing changes. Mock `launchPlan`, S1–S9 contracts and the CLI live
path remain. New exports live on `@acme/test-ui` (pure) and
`@acme/test-ui/local` (I/O). `@acme/test-ui` gains a dependency on
`@acme/adapter-model-openai` used only from the local live path.

## References

- [ADR-0019](0019-domain-test-ui-boundary-and-view-contracts.md) gate 5
- [ADR-0021](0021-interface-workspace-and-launch-boundary.md)
- [ADR-0022](0022-measurement-and-fixture-approval.md)
- [Domain Test UI — Specification](../design/domain-test-ui-specification.md)
- `apps/cli/src/run.ts` — OpenAI gateway composition pattern
