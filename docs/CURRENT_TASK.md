# Current Task

Task ID: ACME-0191
Parent Task: None
Status: Draft
Owner: ChatGPT (operator)
Created: 2026-09-19
Last updated: 2026-09-19
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
- `docs/adr/0055-public-npm-model-runtime-library.md`
- `docs/adr/0056-public-acme-engine-facade.md`

## Task Summary

Release the merged ACME-0190 lossless `oneOf` schema lowering so A008 can consume
it through the public `acme-engine` Node package. The public dependency closure
must remain registry-safe: source manifests may retain `workspace:*`, but packed
and published artifacts must contain concrete dependency versions.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Make ACME-0190's proven-disjoint `oneOf` lowering available to A008 through a
new installable `acme-engine` patch release.

### Primary Deliverable

Published npm packages `@acme-engine/adapter-model-openai@0.1.6`,
`@acme-engine/model-runtime@0.1.6`, and `acme-engine@0.1.6`, with a clean
registry-only consumer proof of the public facade path.

### In Scope

- Bump the affected public package versions from `0.1.5` to `0.1.6`.
- Build and pack the affected public dependency closure with pnpm.
- Inspect packed manifests for concrete internal dependency versions and no
  `workspace:` protocol leakage.
- Publish the three packages in dependency order after offline verification.
- Prove a clean external consumer installs `acme-engine@0.1.6` from npm and
  exercises the public facade's OpenAI strict-schema path for `boolean | string`.
- Record the release truth in the governed documentation and task handoff.

### Out of Scope

- Any change to ACME runtime behavior, public API, schema-lowering semantics or
  provider routing beyond the already merged ACME-0190 implementation.
- Publishing unrelated packages, tags, GitHub releases, deployments or live
  model-provider calls.
- Changes in A008 itself.

### Definition of Done

- The three named npm packages are available at exactly `0.1.6` with a concrete,
  installable dependency chain.
- A clean consumer using only registry artifacts imports `acme-engine` and
  demonstrates lossless lowering of a `boolean | string` `oneOf` through the
  OpenAI path without network provider dispatch.
- Required offline verification passes and the release is documented.
- No unscoped external mutation occurs beyond the three named npm publications.

### Minimum Verification Gates

- [ ] `pnpm typecheck`
- [ ] Focused OpenAI adapter and model-runtime tests
- [ ] `pnpm test:unit`
- [ ] `pnpm test:conformance`
- [ ] `pnpm boundaries`
- [ ] `pnpm format:check`
- [ ] `pnpm docs:check`
- [ ] Packed-manifest inspection and clean registry-only consumer proof
- [ ] `git diff --check`

## References

- `docs/finished/ACME-0190_lossless-oneof-schema-lowering.md`
- `docs/adr/0055-public-npm-model-runtime-library.md`
- `docs/adr/0056-public-acme-engine-facade.md`
- `packages/adapter-model-openai/package.json`
- `packages/model-runtime/package.json`
- `packages/acme-engine/package.json`

## Checklist

- [ ] Merge the ACME-0191 ID claim to `main`.
- [ ] Freeze this charter at `Ready` after the ID claim is on `main`.
- [ ] Bump the three public package versions and release documentation.
- [ ] Build, run required offline verification, pack and inspect artifacts.
- [ ] Publish the three verified package tarballs in dependency order.
- [ ] Run and record the clean registry-only consumer proof.
- [ ] Update `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md` and `docs/JOURNAL.md`.
- [ ] Complete, archive and restore `docs/CURRENT_TASK.md`.

## Decisions and Notes

- Release scope is exactly the public path affected by ACME-0190:
  `@acme-engine/adapter-model-openai -> @acme-engine/model-runtime -> acme-engine`.
- The npm publication is explicitly authorized by this task only after all
  minimum verification gates and packed-artifact inspection pass.
- `pnpm pack`, not direct workspace-directory publication, is the publication
  artifact baseline established by ACME-0184.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

- [ ] Run every minimum verification gate.
- [ ] Confirm npm reports the three exact `0.1.6` versions after publication.
- [ ] Use an external temporary consumer directory with no workspace links for
  the registry-only proof.
- [ ] Record any skipped check and its reason.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `packages/acme-engine/README.md`
- [ ] `docs/FILESTRUCTURE.md` not required; no structure change is expected.
- [ ] ADRs not required; ADR-0055/0056 already decide the release boundary.

## Handoff and Follow-ups

- Current state: Draft; local ID claim prepared.
- Next recommended step: merge the ID claim to `main`, then freeze the charter.
- Blockers: the ID claim must land on `main` before `Ready`; publication waits
  for all frozen verification gates.
- Child tasks: None.
- Resume condition: `ACME-0191` claim visible on `origin/main`.
- Open questions: None.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
