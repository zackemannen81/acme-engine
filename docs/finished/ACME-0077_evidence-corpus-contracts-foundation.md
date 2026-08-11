# Current Task

Task ID: ACME-0077
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-11
Last updated: 2026-08-11
Charter frozen at: 2026-08-11

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/design/evidence-integrity-workbench-technical-specification.md`
- `docs/design/evidence-integrity-workbench-product-definition.md`
- `docs/adr/0030-evidence-v1-identity-and-canonical-placement.md`
- `docs/adr/0031-evidence-review-overlay-and-versioned-views.md`
- ADR-0008, ADR-0009 and ADR-0010

## Task Summary

A task is never considered done until:
`docs/JOURNAL.md`, `docs/SYSTEMDOC.md` and `docs/CURRENT_STATUS.md` are à jour.

Implement slice 0 of the Evidence Integrity Workbench plan: the deterministic
synthetic corpus and public Evidence contract foundation. This task creates no
reviewer UI and makes no product claim. It supplies the exact source/truth data,
identity algorithms, schemas, compact state model, pure reducer/invariants,
catalogue reservations and conformance scaffolding required before the first
visible one-source review slice can be activated.

## Task Charter

The charter is frozen. Later discoveries follow `docs/TASK_WORKFLOW.md` and may
not expand this task into slice 1.

### Goal

Deliver a deterministic, validated Evidence V1 corpus and contract foundation
that later tasks can consume without changing identity, truth or authority
semantics.

### Primary Deliverable

Implemented `@acme/module-evidence` and `@acme/evidence-testing` workspace
packages containing the public V1 schemas/identity/state foundation and the
fully authored `rillford-annex-review-1` corpus with validated manifest,
development truth, sealed evaluation truth and golden identity vectors.

### In Scope

- Author exactly eight canonical UTF-8/LF/NFC source files for the seven
  logical artifacts fixed by ACME-0076, with synthetic non-criminal content,
  disjoint scratch/development/evaluation actors and events, and explicit
  `EVAL-T01` correction lineage.
- Author `evidence-corpus-manifest/1`, scratch/development truth and sealed
  evaluation `evidence-corpus-truth/1` data with exact quotes, line locators,
  ten evaluation observations, eight relations, three open questions, two
  assessment versions, scenarios and coupling groups.
- Implement strict Zod schemas for every public V1 identifier reserved by
  ADR-0030, including source, locator, embedded actor/time values,
  observations, meanings, relations, questions, assessments, state, delta and
  observation-task input/output shapes.
- Implement the ADR-0030 canonicalization and named content-derived identity
  algorithms through public core hashing primitives, including golden vectors.
- Implement `evidence-state/1`, `evidence-delta/1`, initial state, pure reducer
  and invariants without changing `packages/core`.
- Reserve and validate the four task/contract identifiers from the technical
  specification without implementing any model-backed task.
- Implement a corpus loader/validator, deterministic golden builder and a
  dependency guard that keeps sealed evaluation truth out of prompt-building
  dependency paths.
- Add module/state/memory-oriented conformance scaffolding and focused unit
  tests for schema, corpus, identity, reducer and invariant behavior.
- Add both packages to workspace build/boundary configuration and synchronize
  governing documentation.

### Out of Scope

- Implementing `evidence.observe-artifact@1.0.0` as a `TaskDefinition`, prompt,
  mock fixture, model call, interpretation or persistence flow.
- Product work queue, source reviewer, review store, API, web app, worker,
  export or any primary/secondary view implementation.
- Relation, timeline, assessment or reviewer commands from slices 2–6.
- PostgreSQL, Supabase APIs, object storage, authentication, hosting or
  deployment.
- Live provider calls, external search, network acquisition or provider spend.
- PDFs, OCR, audio, video, images, URLs or any non-synthetic/real case data.
- Changes to `packages/core`, existing modules, repository semantics or
  accepted ADR meanings.

### Definition of Done

- The manifest validates exactly seven logical artifacts/eight versions,
  canonical hashes, line counts, predecessor identity and pairwise-disjoint
  partition namespaces.
- Every truth quote resolves exactly once inside its declared locator; every
  truth reference resolves; sealed evaluation cardinalities and expected
  standings match the technical specification exactly.
- All ADR-0030 public schema identifiers and named identity algorithms are
  exported, strictly validated and covered by stable golden vectors.
- Evidence state remains a compact identifier/standing index; reducer and
  invariants reject revision skips, missing references, illegal supersession,
  changed-account supersession, missing relation endpoints, future assessment
  basis, rejected current pointers and source-content leakage.
- The task/contract catalogue exposes only reserved metadata and cannot invoke
  a model or be mistaken for implemented capability.
- The sealed-truth loader is isolated behind an explicit test/evaluation entry
  point and the dependency guard proves prompt paths cannot import it.
- New packages pass workspace boundaries, build and applicable conformance
  tests with no network or live provider call.
- Governing documentation reflects delivered foundation reality, ACME-0077 is
  archived and `docs/CURRENT_TASK.md` returns to the real next state.

### Minimum Verification Gates

- [x] `corepack pnpm install --offline` after workspace manifests are added.
- [x] `corepack pnpm typecheck`.
- [x] `corepack pnpm lint`.
- [x] `corepack pnpm format:check`.
- [x] `corepack pnpm boundaries`.
- [x] `corepack pnpm test` including unit, conformance, integration and
  scenario gates.
- [x] `corepack pnpm docs:check`.
- [x] `corepack pnpm build`.
- [x] Deterministic corpus validation and golden rebuild equality.
- [x] Confirm no live test, provider call or network-backed corpus acquisition.
- [x] `git diff --check`; preserve the pre-existing untracked
  `package-lock.json` and all prior ACME-0076 changes.

## References

- `docs/design/evidence-integrity-workbench-technical-specification.md`, slice 0
- `docs/adr/0030-evidence-v1-identity-and-canonical-placement.md`
- `docs/adr/0031-evidence-review-overlay-and-versioned-views.md`
- `packages/module-narrative/` and `packages/module-research/`
- `packages/testing/` and existing DomainModule conformance tests
- `tooling/boundaries/check-boundaries.mjs`

## Checklist

- [x] Activate and freeze ACME-0077 from the accepted slice 0 plan.
- [x] Inspect current package, identity, schema and conformance patterns.
- [x] Define and document exact package/corpus file layout.
- [x] Author canonical source versions and manifest.
- [x] Author scratch/development/evaluation truth and golden expectations.
- [x] Implement public Evidence schemas, identity algorithms and catalogue.
- [x] Implement state/delta/reducer/invariants and module scaffold.
- [x] Implement corpus loader, validator, golden builder and truth guard.
- [x] Add focused unit and conformance tests.
- [x] Synchronize package/build/boundary configuration and lockfile.
- [x] Synchronize governing documentation and indexes.
- [x] Run all verification gates, journal, archive and restore task state.

## Decisions and Notes

- ACME-0076 and ADR-0030/0031 are the frozen design authority. This task may
  correct clerical ambiguity but must not change corpus counts, identities,
  authority levels, Primary Product Rule or slice order.
- Corpus truth may be detailed here because slice 0 explicitly authors it. It
  remains synthetic, test-only evidence and is never model training data.
- Reserved task identifiers are metadata only. Slice 1 owns the first actual
  `TaskDefinition`, mock response and execution path.
- Package layout checkpoint: `@acme/module-evidence` owns pure schemas,
  identity, state, memory policy and an empty task registry;
  `@acme/evidence-testing` owns `fixtures/rillford-annex-review-1`, the default
  manifest/source/development loaders and a separate `./evaluation` sealed-
  truth entry point. Corpus bytes stay beside the testing package rather than
  becoming runtime module dependencies.
- No new external runtime dependency is expected. Workspace dependencies use
  the existing pinned core and Zod versions.
- A checkpoint after every substantive step is required. Checklist and
  governing documentation remain truthful.

## Charter Amendment Log

- none

## Verification

- [x] Corpus structure, canonical bytes, hash, locator and reference review.
- [x] Schema/identity golden-vector review.
- [x] Reducer/invariant and dependency-boundary review.
- [x] Full repository verification gates.
- [x] Record exact skipped checks and reasons: none skipped.

All gates passed on 2026-08-11. `corepack pnpm test` required a temporary
PATH-local shim because the desktop runtime exposed global pnpm 11.16.0 to
nested package scripts while the repository pins pnpm 10.34.5. The shim called
Corepack's pinned pnpm, the exact aggregate command passed, and the temporary
file was removed. No live test, provider call, corpus network acquisition or
spend occurred.

## Documentation Updates

- [x] `docs/design/evidence-integrity-workbench-technical-specification.md`
  only for non-semantic implementation clarification if required
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] package READMEs where public usage needs explanation
- [x] ADRs only if implementation exposes an unresolved cross-package decision;
  none did, so no new ADR was required

## Handoff and Follow-ups

- Current state: Complete. Slice 0 is implemented and verified; no slice 1
  behavior was added.
- Next recommended step: activate slice 1 as a separate frozen task to deliver
  one-source import, candidate observation review and exact source navigation.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: implementation detail only; any architecture-level ambiguity
  must be classified before code.

## Finalize When Complete

- Archive as `docs/finished/ACME-0077_evidence-corpus-contracts-foundation.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md` unless a
  next task is explicitly approved.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done becomes invalid, supersede this task instead of
  rewriting it.
