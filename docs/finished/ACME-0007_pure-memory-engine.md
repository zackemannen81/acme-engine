# Current Task

Task ID: ACME-0007
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-07-29
Last updated: 2026-07-29
Charter frozen at: 2026-07-29

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/design/acme-design-and-development-spec.md`, section 12
- `docs/adr/0002-static-task-typed-module-composition.md`
- `docs/adr/0003-sqlite-revisioned-unit-of-work.md`
- `docs/finished/ACME-0006_pure-state-engine.md`

## Task Summary

Continue Milestone 1 with a bounded pure MemoryEngine task. Correct the
incomplete policy-result contract, then implement deterministic candidate
resolution, retrieval and lifecycle preparation without reading or writing
stores.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Implement a pure, domain-neutral MemoryEngine that executes domain-owned
memory policy while core owns deterministic mechanics, validation, provenance,
timestamps and record-version preparation.

### Primary Deliverable

A tested MemoryEngine with pure `prepare`, `retrieve` and `applyLifecycle`
operations that produce immutable decisions and version-checked record
mutations without persistence.

### In Scope

- Define explicit memory prepare/retrieval/lifecycle contexts and immutable
  prepared decision/mutation result types.
- Correct `MemoryResolution` so domain policy supplies resulting strength for
  create, reinforce and merge actions.
- Make `supersede-existing` carry an explicit replacement value and strength;
  derive its identity through the policy's dedicated `identity()` function.
- Keep identity, equivalence, contradiction, merge value, strength, relevance
  and lifecycle choices domain-owned.
- Keep stable ordering, timestamps, provenance append, record-version
  increments and policy-result application core-owned.
- Use injected `IdGenerator.next('memory')` only when a create or replacement
  record is prepared, in deterministic candidate order.
- Validate candidate keys, JSON values, confidence, provenance and unique
  execution-scoped candidate identity.
- Validate existing record scope, uniqueness, JSON values, finite
  non-negative strength and positive record versions before policy execution.
- Process candidates in stable key order against an immutable evolving working
  set so later candidates observe earlier prepared decisions.
- Validate policy issues, identity keys, candidate-key correlation, target
  existence, target uniqueness, replacement conflicts and all returned JSON
  and numeric values.
- Apply create, reinforce, merge, contest, supersede, reject and ignore
  decisions with explicit deterministic semantics.
- Append candidate provenance and update timestamps only for affected records.
- Produce create/update mutations with expected record versions suitable for a
  future compare-and-swap Unit of Work.
- Execute retrieval against immutable validated records; reject foreign or
  duplicate results; require finite scores; sort by descending score then
  `identityKey` and `memoryId`; enforce the query limit.
- Execute explicit lifecycle hooks in stable record order and prepare retain,
  strength-update and forget decisions without wall-clock background behavior.
- Map malformed context/query inputs to `INVALID_REQUEST`, invalid candidates
  and domain-policy results to `DOMAIN_INVALID_RESULT`, and corrupt loaded
  records to `PERSISTENCE_CORRUPTION`.
- Add ADR-0005 for pure memory decision application and update the normative
  memory contract in the design specification.
- Update documentation to implemented reality.

### Out of Scope

- ExecutionEngine orchestration or evaluator behavior.
- Repository ports, candidate-audit persistence, compare-and-swap writes or
  Unit of Work implementation.
- In-memory or SQLite adapters and migrations.
- Model gateway, model mock or live provider behavior.
- Narrative or Research memory policies, schemas and acceptance scenarios.
- Vector, semantic or full-text retrieval infrastructure.
- Background timers, automatic wall-clock decay or maintenance scheduling.
- StateEngine changes or projecting memory decisions into state deltas.
- Package publication, deployment, push, release or other remote mutation.

### Definition of Done

- The public memory contract represents every policy-owned value required to
  apply create, reinforce, merge, contest, supersede, reject and ignore
  decisions without core inventing domain strength or replacement policy.
- Candidate resolution is stable across caller order and never mutates
  caller-owned candidates or records.
- Create/replacement IDs consume the injected memory ID generator only in
  stable candidate order; non-creating decisions consume no IDs.
- New records start at version one; updates carry the exact prior version and
  increment once; affected timestamps and provenance are correct.
- Invalid candidates, loaded records or policy results cannot produce prepared
  mutations and use the documented ACME error category.
- Retrieval rejects unknown/duplicate records and non-finite scores, then
  deterministically sorts and limits valid results.
- Lifecycle hooks run only when explicitly invoked and produce deterministic
  versioned mutations.
- Unit tests cover all resolution actions, evolving working-set behavior,
  ordering, validation, immutability, provenance, timestamps, versions,
  retrieval ties/limits and lifecycle actions.
- Frozen install, format, lint, typecheck, boundaries, tests and build pass.
- The specification, ADR set, `CURRENT_STATUS`, `SYSTEMDOC`, `FILESTRUCTURE`
  and journal reflect implemented reality.

### Minimum Verification Gates

- [x] `pnpm install --frozen-lockfile`
- [x] `pnpm format:check`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm boundaries`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] Internal documentation links and balanced Markdown fences
- [x] `git diff --check`

## References

- `docs/design/acme-design-and-development-spec.md`, section 12
- `docs/adr/0002-static-task-typed-module-composition.md`
- `docs/adr/0003-sqlite-revisioned-unit-of-work.md`
- `packages/core/src/memory.ts`
- `packages/core/src/common.ts`
- `packages/core/src/errors.ts`

## Checklist

- [x] Review and freeze the MemoryEngine charter.
- [x] Add ADR-0005 and correct the normative memory-resolution contract.
- [x] Add prepared decision/mutation and operation-context contracts.
- [x] Implement candidate preparation and all resolution actions.
- [x] Implement deterministic retrieval and explicit lifecycle preparation.
- [x] Add validation, ordering, immutability and action unit tests.
- [x] Run all minimum verification gates and record evidence.
- [x] Update long-lived documentation and add a signed journal entry.
- [x] Archive the completed task and restore the task template.

## Decisions and Notes

- The maintainer explicitly approved starting the pure MemoryEngine task on
  2026-07-29.
- The reviewed charter was frozen on 2026-07-29 before implementation began.
- `DomainMemoryPolicy.identity()` remains the single source of identity keys;
  resolution results must not introduce a competing identity mechanism.
- Domain policy supplies resulting strength because reinforcement, decay and
  promotion are domain-owned by the approved architecture.
- The engine prepares mutations but never makes them canonical.
- ADR-0005 records the corrected policy-owned strength/replacement contract,
  stable evolving working set and explicit mutation semantics.
- Candidate audit retention belongs to the future Unit of Work; this task
  preserves decisions needed by that boundary without adding a store.
- Apply `docs/TASK_WORKFLOW.md` to every discovered item.

## Charter Amendment Log

- None.

## Verification

- [x] Verify every resolution action and target validation.
- [x] Verify stable candidate processing and memory-ID allocation order.
- [x] Verify sequential decisions observe the evolving working set.
- [x] Verify provenance, timestamps and record-version behavior.
- [x] Verify caller inputs and policy inputs remain immutable.
- [x] Verify candidate, existing-record and policy-result error mapping.
- [x] Verify retrieval validation, stable ties and limits.
- [x] Verify retain, strength-update and forget lifecycle behavior.
- [x] Verify all repository and documentation gates.
- [x] Document skipped checks and exact reasons.

Final evidence on 2026-07-29:

- `pnpm install --frozen-lockfile` passed with pnpm `10.34.5`.
- Format, lint, strict typecheck, dependency boundaries and build passed.
- Unit tests passed: 6 files and 52 tests, including 17 MemoryEngine tests.
- Memory tests cover all resolution actions, stable candidate/ID ordering,
  evolving working-set visibility, record versions, timestamps, provenance,
  validation/error boundaries, input immutability, retrieval ties/limits and
  all lifecycle actions.
- Conformance, integration and scenario gates passed with no test files;
  persistence, orchestration and reference scenarios remain outside this
  charter.
- Documentation checks and `git diff --check` passed after archival.
- No checks were skipped. Remote GitHub Actions was not run because this branch
  has not been pushed. Local checks used installed Node `24.14.1`; CI remains
  pinned to repository Node `24.18.0`.

## Documentation Updates

- [x] `docs/design/acme-design-and-development-spec.md`
- [x] `docs/adr/0005-pure-memory-decision-application.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`

## Handoff and Follow-ups

- Current state: Complete and archived on 2026-07-29.
- Next recommended step: Shape and explicitly approve a bounded aggregate
  repository-port and in-memory Unit of Work task within Milestone 1.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: None.

## Finalize When Complete

- Archive this file as `docs/finished/ACME-0007_pure-memory-engine.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes after `Ready`, supersede this task
  instead of rewriting it.
