# Current Task

Task ID: ACME-0006
Parent Task: None
Status: Draft
Owner: Codex
Created: 2026-07-29
Last updated: 2026-07-29
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

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm boundaries`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] Internal documentation links and balanced Markdown fences
- [ ] `git diff --check`

## References

- `docs/design/acme-design-and-development-spec.md`, section 11
- `docs/adr/0002-static-task-typed-module-composition.md`
- `docs/adr/0003-sqlite-revisioned-unit-of-work.md`
- `packages/core/src/hashing.ts`
- `packages/core/src/state.ts`
- `packages/core/src/modules.ts`

## Checklist

- [ ] Review and freeze the StateEngine charter.
- [ ] Add ADR-0004 and correct the normative prepare-context contract.
- [ ] Add the versioned deterministic transition-ID helper.
- [ ] Implement pure StateEngine preparation and error mapping.
- [ ] Add transition identity, revision, validation and immutability tests.
- [ ] Run all minimum verification gates and record evidence.
- [ ] Update long-lived documentation and add a signed journal entry.
- [ ] Archive the completed task and restore the task template.

## Decisions and Notes

- Transition identity is derived, not allocated. This preserves identity
  across retries and replay without relying on generator state.
- The ID derivation uses operation identity only. Divergent transition content
  under the same operation identity must become a conflict at the repository
  boundary rather than silently acquiring a new ID.
- `entityId` is required in the prepare context because no current snapshot
  exists at revision zero.
- The charter remains `Draft` until maintainer review. No StateEngine
  implementation is authorized before it reaches `Ready`.
- Apply `docs/TASK_WORKFLOW.md` to every discovered item.

## Charter Amendment Log

- None. The charter has not been frozen.

## Verification

- [ ] Verify transition ID golden vectors for `acme-transition-id-1`.
- [ ] Verify transition ID stability across time, revision, delta and retry.
- [ ] Verify transition ID sensitivity to each identity field.
- [ ] Verify first snapshot and existing snapshot revision behavior.
- [ ] Verify stale revision fails before reducer execution.
- [ ] Verify no delta produces no prepared state.
- [ ] Verify delta/state schema and invariant failures.
- [ ] Verify reducer input remains unchanged.
- [ ] Verify snapshot/transition hashes and complete provenance.
- [ ] Verify all repository and documentation gates.
- [ ] Document skipped checks and exact reasons.

## Documentation Updates

- [ ] `docs/design/acme-design-and-development-spec.md`
- [ ] `docs/adr/0004-deterministic-transition-identity.md`
- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md`

## Handoff and Follow-ups

- Current state: Draft charter prepared for maintainer review.
- Next recommended step: Review the charter, then set it to `Ready` and record
  the freeze timestamp if approved.
- Blockers: Implementation is blocked until the charter is reviewed and
  frozen.
- Child tasks: None.
- Resume condition: Maintainer approval of the frozen charter.
- Open questions: None.

## Finalize When Complete

- Archive this file as `docs/finished/ACME-0006_pure-state-engine.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes after `Ready`, supersede this task
  instead of rewriting it.
