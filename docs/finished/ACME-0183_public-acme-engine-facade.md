# ACME-0183 — public acme-engine facade package

Task ID: ACME-0183
Parent Task: None
Status: Complete
Owner: ChatGPT (operator)
Created: 2026-09-18
Last updated: 2026-09-18
Charter frozen at: 2026-09-18; claim revision `08cae96`

## Task Summary

Replace the legacy CLI-only `acme-engine@0.0.1` npm package with an importable public `acme-engine@0.1.0` facade over the accepted in-process model runtime, while keeping the monorepo root private.

## Goal

Make `npm install acme-engine` provide the same supported in-process model-runtime API as `@acme-engine/model-runtime` without duplicating execution code.

## Primary Deliverable

A publish-ready `packages/acme-engine` workspace package at version `0.1.0` that re-exports `@acme-engine/model-runtime`.

## In Scope

- Add ADR 0056 for the public facade decision.
- Add `packages/acme-engine` with public package metadata, TypeScript build and re-export-only source.
- Depend on `@acme-engine/model-runtime@workspace:*`; packed output must rewrite it to `0.1.0`.
- Keep workspace root `private: true`.
- Replace the legacy package role: no compatibility promise for the old bundled sidecar binary in `acme-engine`.
- Pack the facade and the existing public dependency closure.
- Install only packed artifacts in a clean external consumer and prove `import { createAcmeModelRuntime } from "acme-engine"`.
- Verify image-capable runtime symbols are present through the same exported model-runtime API.
- Update owning docs and release guidance.

## Out of Scope

- A008 migration.
- Changing ACME execution semantics, routing semantics, retry policy or cognition.
- Publishing the package before packed-artifact verification is complete.
- Reworking the private CLI/service application.
- Preserving `acme-engine@0.0.1` CLI behavior as part of the library facade.

## Definition of Done

- `acme-engine@0.1.0` packs as an importable ESM library with types.
- Workspace root remains private.
- Packed facade depends on `@acme-engine/model-runtime@0.1.0`, not a workspace/file path.
- A clean external consumer installs the packed public closure and imports `createAcmeModelRuntime` from `acme-engine`.
- Root build/typecheck/unit tests/docs check/diff check pass.
- Publication remains a distinct final external effect after verification.

## Minimum Verification Gates

- [x] Package build/typecheck.
- [x] `pnpm pack` tarball inspection.
- [x] Clean packed-consumer import/runtime construction proof.
- [x] Root `pnpm typecheck`.
- [x] Root `pnpm test:unit`.
- [x] `pnpm docs:check`.
- [x] `git diff --check`.

## Necessity

Owner explicitly selected the simple `acme-engine` package name as the public import surface before embedding ACME in A008. ADR 0055 already established the underlying model-runtime library and public dependency closure; this task adds only the convenience facade.

## Handoff and Follow-ups

After this task is integrated and the verified package is published, A008 can consume `acme-engine` in-process in a separate migration task.

## Verification Results

- `pnpm --filter acme-engine build` and `typecheck`: PASS.
- Seven-package public closure packed successfully; facade tarball is ~4.9 KiB and contains only dist entrypoints, package metadata and README.
- Packed facade manifest rewrites `@acme-engine/model-runtime` from `workspace:*` to exact `0.1.0`.
- Clean external npm consumer installed only packed artifacts and produced `ACME_FACADE_CONSUMER_OK fixture` after importing `createAcmeModelRuntime` from `acme-engine` and constructing a `vision: true` compatible route.
- Root `pnpm build`: PASS.
- Root `pnpm typecheck`: PASS.
- Initial default-concurrency unit run: 1073/1076 passed; three unrelated Evidence Workbench tests hit their exact 5 s timeout under suite load. The same three files then passed 10/10 isolated.
- Full unit rerun with bounded `--maxWorkers=4`: 161/161 files, 1076/1076 tests PASS without changing tests or timeouts.
- `pnpm docs:check`: PASS; 34 pre-existing historical missing-path references were reported as non-gating.
- `git diff --check`: PASS.
- Registry publication was intentionally not performed from the feature branch; it remains the final external effect after canonical merge.
