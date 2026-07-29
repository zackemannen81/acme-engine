# Current Task

Task ID: ACME-0006
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
- `docs/design/acme-design-and-development-spec.md`
- `docs/adr/0002-static-task-typed-module-composition.md`
- `docs/adr/0003-sqlite-revisioned-unit-of-work.md`
- `docs/finished/ACME-0005_pure-contracts-and-static-registries.md`

## Task Summary

Continue Milestone 1 with a bounded pure StateEngine task. Resolve the
transition-identity and first-snapshot context gaps while the charter is still
editable, then implement deterministic preparation of revisioned state
candidates without persistence or orchestration.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Implement a pure, domain-neutral StateEngine that validates and prepares one
deterministic revisioned state transition without reading or writing stores.

### Primary Deliverable

A tested `StateEngine.prepare()` implementation that handles initial and
existing state, enforces expected revisions and domain validation, produces
versioned snapshots/transitions and derives stable transition identities.

### In Scope

- Correct the StateEngine prepare context to contain `entityId`,
  `executionId`, `operationKey` and `now`.
- Derive `namespace` from the registered domain module.
- Define and document the versioned transition-ID algorithm
  `acme-transition-id-1`.
- Derive `transitionId` as
  `transition_${sha256(canonicalJson({ algorithm, executionId, operationKey, namespace, entityId }))}`.
- Keep revision, delta, timestamps, previous/next hashes and retry order out of
  the transition-ID input so one logical operation retains one identity.
- Do not add a `transition` kind to `IdGenerator`.
- Validate the expected revision before applying a delta.
- Validate current state when present and require revision zero when absent.
- Obtain initial state through `module.initialState({ entityId, now })`.
- Validate delta envelope version and value through the module delta schema.
- Apply the domain reducer without mutating the current snapshot value.
- Validate the reduced state and run domain invariants.
- Produce canonical state hashes, the next complete snapshot and its explicit
  transition candidate.
- Return `null` when no state delta is supplied, without producing a
  transition candidate.
- Map stale revisions and invalid domain results into the existing ACME error
  taxonomy.
- Add ADR-0004 for deterministic transition identity and update the normative
  state contract in the design specification.
- Update documentation to implemented reality.

### Out of Scope

- MemoryEngine behavior or memory policy execution.
- ExecutionEngine orchestration, retries, repair or replay orchestration.
- Repository ports, compare-and-swap persistence or Unit of Work behavior.
- In-memory or SQLite adapters and migrations.
- Narrative or Research modules and acceptance scenarios.
- Model gateway, model mock or live provider behavior.
- Package publication, deployment or remote data mutation.

### Definition of Done

- The public prepare context can create a first snapshot when `current` is
  `null` because `entityId` is explicit.
- Transition identity is specified by `acme-transition-id-1`, implemented
  without consuming `IdGenerator` and recorded in ADR-0004.
- Identical `{ executionId, operationKey, namespace, entityId }` inputs always
  produce the same `transitionId`.
- Changing `executionId`, `operationKey`, `namespace` or `entityId` changes the
  transition ID, while timestamps, revisions, delta content and retry order do
  not.
- Revision zero creates revision one; an existing revision increments exactly
  once; a stale expected revision throws `CONFLICT_STATE_REVISION`.
- Missing delta returns `null`; invalid envelope version, delta, resulting
  state or domain invariants cannot produce a prepared state.
- Reducer execution leaves the supplied current snapshot value unchanged.
- Snapshot and transition hashes use `acme-cjson-1` plus SHA-256 and have
  complete execution provenance.
- Unit tests cover initial state, existing state, no delta, stale revision,
  schema failures, invariant failures, immutability, hashes and transition-ID
  stability/sensitivity.
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

- `docs/design/acme-design-and-development-spec.md`, section 11
- `docs/adr/0002-static-task-typed-module-composition.md`
- `docs/adr/0003-sqlite-revisioned-unit-of-work.md`
- `packages/core/src/hashing.ts`
- `packages/core/src/state.ts`
- `packages/core/src/modules.ts`

## Checklist

- [x] Review and freeze the StateEngine charter.
- [x] Add ADR-0004 and correct the normative prepare-context contract.
- [x] Add the versioned deterministic transition-ID helper.
- [x] Implement pure StateEngine preparation and error mapping.
- [x] Add transition identity, revision, validation and immutability tests.
- [x] Run all minimum verification gates and record evidence.
- [x] Update long-lived documentation and add a signed journal entry.
- [x] Archive the completed task and restore the task template.

## Decisions and Notes

- Transition identity is derived, not allocated. This preserves identity
  across retries and replay without relying on generator state.
- The ID derivation uses operation identity only. Divergent transition content
  under the same operation identity must become a conflict at the repository
  boundary rather than silently acquiring a new ID.
- `entityId` is required in the prepare context because no current snapshot
  exists at revision zero.
- The maintainer approved this charter on 2026-07-29. Its Goal, Primary
  Deliverable, scope, Definition of Done and Minimum Verification Gates are
  frozen.
- ADR-0004 records `acme-transition-id-1`, keeps `IdGenerator` unchanged and
  makes `entityId` explicit in the prepare context.
- Apply `docs/TASK_WORKFLOW.md` to every discovered item.

## Charter Amendment Log

- None.

## Verification

- [x] Verify transition ID golden vectors for `acme-transition-id-1`.
- [x] Verify transition ID stability across time, revision, delta and retry.
- [x] Verify transition ID sensitivity to each identity field.
- [x] Verify first snapshot and existing snapshot revision behavior.
- [x] Verify stale revision fails before reducer execution.
- [x] Verify no delta produces no prepared state.
- [x] Verify delta/state schema and invariant failures.
- [x] Verify reducer input remains unchanged.
- [x] Verify snapshot/transition hashes and complete provenance.
- [x] Verify all repository and documentation gates.
- [x] Document skipped checks and exact reasons.

Final evidence on 2026-07-29:

- `pnpm install --frozen-lockfile` passed with pnpm `10.34.5`.
- Format, lint, strict typecheck, dependency boundaries and build passed.
- Unit tests passed: 5 files and 35 tests, including 16 StateEngine tests.
- StateEngine tests cover the transition-ID golden vector and identity
  stability/sensitivity, revision zero and existing revisions, no delta,
  stale revisions before reduction, schema/invariant failures, reducer-input
  immutability, canonical hashes and complete provenance.
- Conformance, integration and scenario gates passed with no test files;
  persistence, orchestration and reference scenarios remain outside this
  charter.
- Documentation checks and `git diff --check` passed after archival.
- No checks were skipped. Remote GitHub Actions was not run because this branch
  has not been pushed. Local checks used installed Node `24.14.1`; CI remains
  pinned to repository Node `24.18.0`.

## Documentation Updates

- [x] `docs/design/acme-design-and-development-spec.md`
- [x] `docs/adr/0004-deterministic-transition-identity.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`

## Handoff and Follow-ups

- Current state: Complete and archived.
- Next recommended step: Shape and explicitly approve a bounded pure
  MemoryEngine task within Milestone 1.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: None.

## Finalize When Complete

- Archive this file as `docs/finished/ACME-0006_pure-state-engine.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes after `Ready`, supersede this task
  instead of rewriting it.
