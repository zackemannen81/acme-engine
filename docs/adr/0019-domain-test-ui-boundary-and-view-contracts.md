# ADR 0019 — Domain Test UI boundary and versioned view contracts

Status: Accepted

Date: 2026-08-01

Decision owners: ACME maintainers

## Context

`docs/design/domain-test-ui-specification.md` (rewritten by ACME-0038)
specifies a local Domain Test UI and records **seven proposed gate freezes**.
It states that nothing in it authorizes implementation and that activation
requires an implementation charter accepting those freezes.

Every engine-side prerequisite is satisfied. Milestones 1 and 2 are delivered:
`ExecutionEngine`, ScenarioRunner over `acme-scenario/1`, both reference
modules, in-memory and SQLite repositories, the shared conformance kits, the
CLI composition root, encrypted-payload retention, durable resume, rollback
and compare-and-swap proofs, and the outbox delivery boundary. The gap is not
capability. The gap is that a human judging a run still reads raw JSON.

The specification's ordered build plan therefore starts at a read model rather
than at a plan compiler: view contracts make the Execution Inspector real and
testable before any browser exists, and before another YAML dialect is
invented.

Two constraints shape this decision.

First, the interface must never become a second source of truth. Every value
it shows has to be derivable from committed evidence or a produced report, and
deleting the application must lose no canonical fact.

Second, the interface must never compute a verdict. A deterministic test's
verdict is produced by the runner, the engine or a conformance kit. The
interface may show one, compare two and measure a series. It may not derive
one from partial evidence.

Those two constraints collide with a rendering layer in a specific way: a
missing value and a value of zero look identical once they reach a template.
An inspector that renders "0 model calls" for an execution whose evidence was
never loaded is not a lens, it is a fabrication.

## Decision

### 1. The seven proposed gate freezes are accepted as written

| # | Gate | Accepted freeze |
| --- | --- | --- |
| 1 | Exist in version 1? | Yes, as a local-only developer/test workbench, not a required CI path. |
| 2 | Runtime and shape | Local static SPA plus a thin local composition process wrapping CLI-equivalent entry points. No remote multi-user service in v1. |
| 3 | `acme-test-plan/1` | Adopt a thin compilable plan. A separate ADR is required when the schema is first exported. Scenarios remain the canonical executable artifact. |
| 4 | Interface storage | Files under a workspace root for plans, baselines and approval records; optionally a separate SQLite file for a history index. Never shares ledger tables. |
| 5 | Live runs in the UI | Allowed only in a late phase, behind environment opt-in, confirmation and budget. Until then `acme execute --gateway openai` is the supported live path. |
| 6 | Authorization | Localhost and local process only in v1. Network exposure requires a new ADR. |
| 7 | Relationship to the CLI | `@acme/cli` remains the sole supported CI and automation entry point. |

Gates 3 and 5 bind later phases and are not exercised by the phase-1 read
model. Gates 1, 2, 4, 6 and 7 are satisfied in phase 1 by the read model
performing no I/O at all.

### 2. The app is a leaf

`apps/test-ui` may depend on public package entry points. It may not import a
package internal module, and nothing may import it. Both directions are
enforced by `dependency-cruiser` rules with negative fixtures that must fail.

A leaf can be deleted. That is the executable form of "deleting the app must
lose no canonical fact".

### 3. Phase-1 read model is pure

The read model is a set of pure functions from recorded evidence values to
view contract values. It takes no repository, opens no file, reads no clock
and performs no network call. The composition process that loads evidence
arrives in a later phase.

This is what makes the view contracts assertable as JSON in an ordinary unit
test, with no browser and no fixture server.

### 4. Every surface has a versioned view contract

Phase 1 introduces four:

```text
acme-view-execution/1          S4 execution inspector
acme-view-memory-decisions/1   S5 memory decision inspector
acme-view-state/1              S6 state inspector
acme-view-replay/1             S7 replay and digest comparison
```

Each view carries its version identifier in the payload. The version changes
when the shape changes. Screenshots are not the verification deliverable; the
JSON is.

### 5. Absence is a value, not a default

Every optional section is either

```text
{ availability: 'available', ... }
{ availability: 'unavailable', reason: <code> }
```

and every content payload is one of

```text
{ disclosure: 'revealed', value }
{ disclosure: 'redacted' }
{ disclosure: 'not-retained', retention: 'none' | 'hash-only' }
{ disclosure: 'unavailable', reason }
```

`not-retained` exists because ADR-0016 makes a model response legitimately
absent under `retention: 'none'` and `hash-only`. Rendering that as an empty
value would look like a bug in the engine. Rendering it as `redacted` would
imply a reveal control could show it. Neither is true.

Redaction is the default. Reveal is explicit, per request, and mirrors local
development only.

### 6. Trust pipeline outcomes are derived only from recorded evidence

The trust pipeline panel reports one of `passed`, `failed`, `reached` or
`not-reached` per substage, derived from recorded attempt stages, the
execution's current stage, its terminal status and `AcmeErrorData`.

`AcmeErrorData.details.pipelineStage` identifies which response-pipeline
substage failed (`input`, `empty`, `parse`, `schema`, `semantic`), so contract
input failures stay distinct from response validation failures, as ADR-0010
requires.

Where a recorded failure lands in an execution stage that owns several
substages — `preparing-commit` owns memory, projection and state — and the
error does not identify which one failed, every substage of that stage reports
`reached`. `reached` means "the execution entered this stage and the evidence
does not say more". It is deliberately weaker than `passed`.

### 7. Replay keeps the engine's exact vocabulary

`ReplayReport.status` is `match | different | unavailable`. The view contract
uses exactly those three and adds no fourth.

The specification's S7 section lists a `forked` outcome with the qualifier
"or the engine's exact vocabulary". The engine cannot produce `forked`, so
displaying it would be the interface computing a verdict. When no replay has
been run at all, the section is `availability: 'unavailable'` with reason
`REPLAY_NOT_RUN`, which is distinct from the engine's own `unavailable`
verdict meaning it ran and the evidence was insufficient.

## Alternatives Considered

### Alternative A — Build the plan compiler first

- Benefits: produces a launcher sooner; matches the 2026-07-30 draft order.
- Costs: invents a second YAML dialect before anything can inspect what a run
  did; the compiler's value depends on evidence rendering that does not exist.
- Reason not selected: the CLI and ScenarioRunner already run offline domain
  tests. The missing capability is human inspection, not execution.

### Alternative B — Render directly from repository reads inside view code

- Benefits: fewer types; no explicit evidence input shape.
- Costs: couples every view to a live repository, forces I/O into unit tests,
  and makes "missing evidence" indistinguishable from "empty result".
- Reason not selected: it destroys the property that makes phase 1 cheap to
  verify and makes the absence rule unenforceable.

### Alternative C — Let the interface compute verdicts from evidence

- Benefits: the UI could show a result even when a report is absent.
- Costs: two sources of truth for pass and fail, diverging silently.
- Reason not selected: explicitly forbidden by the specification's boundary.

## Consequences

### Positive

- The Execution Inspector is testable before any browser exists.
- Missing evidence is impossible to confuse with zero.
- Retention modes stay honest; `hash-only` runs do not look broken.
- The app remains deletable, which keeps the "lens, not a source of truth"
  claim checkable rather than aspirational.
- Later phases inherit a stable contract surface to render against.

### Negative

- The view contracts are versioned, so shape changes need a version bump
  rather than a quiet edit.
- `reached` is less satisfying than a definite verdict, and some inspector
  panels will show it until the engine records finer-grained evidence.
- Four view contracts exist before any user-visible interface does.

### Follow-ups

- Phase 2: S1 catalog over the registries, scenario discovery and adapter kit
  targets.
- Phase 3: `acme-test-plan/1` and its own ADR at first export (gate 3).
- Phase 4: the composition process that loads evidence into these views.
- If finer trust-stage evidence is wanted, the engine — not the interface —
  must record it.

## Compatibility and Migration

Nothing existing changes. No `@acme/core` contract, adapter, module, CLI
command or test gate is modified. `@acme/test-ui` is a new leaf package that
no other package references, so it can be removed without migration.

View contract versions are additive: a breaking shape change publishes
`acme-view-<surface>/2` rather than redefining `/1`.

## References

- [Domain Test UI — Specification](../design/domain-test-ui-specification.md)
- [Backlog — Domain Test UI implementation](../backlog/domain-test-ui-implementation.md)
- [ADR-0010 Input-bound validation and interpretation](0010-input-bound-validation-and-interpretation.md)
- [ADR-0012 Milestone 1 execution identity and replay](0012-milestone-1-execution-identity-and-replay.md)
- [ADR-0016 Encrypted payload retention](0016-encrypted-payload-retention.md)
- [ADR-0017 Durable execution resume](0017-durable-execution-resume.md)
- [ADR-0018 Outbox delivery boundary](0018-outbox-delivery-boundary.md)
