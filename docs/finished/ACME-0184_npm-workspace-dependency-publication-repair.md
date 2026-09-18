# ACME-0184 — npm workspace dependency publication repair

Task ID: ACME-0184
Parent Task: None
Status: Complete
Owner: ChatGPT (operator)
Created: 2026-09-18
Last updated: 2026-09-18
Charter frozen at: 2026-09-18; claim revision `7d2fb38`

## Task Summary

Repair the broken 0.1.0 npm publication whose registry manifests preserved `workspace:*` dependencies by releasing the unchanged public ACME closure as 0.1.1 from verified pnpm-packed tarballs.

## Goal

Make `npm install acme-engine` install successfully from npm with concrete 0.1.1 dependency versions and no workspace protocol references.

## In Scope

- Bump the seven public packages from 0.1.0 to 0.1.1.
- Keep source workspace dependencies as `workspace:*`.
- Pack with pnpm and verify every packed manifest has concrete 0.1.1 internal dependency versions.
- Install packed artifacts in a clean external consumer before publication.
- Publish the verified tarballs, never the workspace directories, in dependency order.
- Verify npm registry manifests contain no `workspace:*` and latest resolves to 0.1.1.
- Verify a clean registry-only consumer can install and import `acme-engine`.
- Record 0.1.0 as broken/withdrawn-for-use in release documentation without attempting mutation of immutable versions.

## Out of Scope

- Runtime/execution semantic changes.
- A008 integration/migration.
- Rewriting or unpublishing 0.1.0.
- Changing package topology or public API.

## Definition of Done

- All seven public packages are published at 0.1.1 from pnpm-created tarballs.
- Registry manifests contain only concrete npm-compatible internal versions.
- `npm install acme-engine` succeeds in a clean registry-only consumer.
- `createAcmeModelRuntime` imports from `acme-engine` and constructs a vision-capable route.
- Source remains workspace-native and product/runtime code is unchanged.
- Docs, diff and package verification gates pass.

## Verification Gates

- [x] Version/lockfile consistency.
- [x] Build/typecheck for public closure.
- [x] Tarball manifest inspection for every package.
- [x] Clean tarball consumer proof.
- [x] Publish tarballs in dependency order.
- [x] Registry manifest inspection for every 0.1.1 package.
- [x] Clean registry consumer install/import proof.
- [x] `pnpm docs:check` and `git diff --check`.

## Verification Results

- All seven public package manifests are version `0.1.1`; source-internal package edges remain `workspace:*`.
- Public closure build/typecheck: PASS.
- `pnpm pack` produced seven 0.1.1 tarballs. Manifest validation proved every internal `@acme-engine/*` dependency is exact `0.1.1` and no packed `workspace:*` remains (`PACK_MANIFESTS_OK`).
- Clean tarball-only consumer installed all packed artifacts and returned `ACME_0184_TARBALL_CONSUMER_OK fixture` with a vision-capable route.
- Registry publication used only those verified tarballs, in dependency order.
- npm registry inspection confirms all seven `0.1.1` manifests contain concrete internal versions; no `workspace:*` remains.
- Clean registry-only consumer ran `npm install acme-engine`, imported `createAcmeModelRuntime`, constructed a `vision: true` route and returned `ACME_0184_REGISTRY_CONSUMER_OK fixture`.
- Registry tree verified `acme-engine@0.1.1 -> @acme-engine/model-runtime@0.1.1 -> @acme-engine/core@0.1.1`.
- `0.1.0` remains immutable broken registry history and is documented as unsupported for use.
- `pnpm docs:check` and `git diff --check`: PASS.
