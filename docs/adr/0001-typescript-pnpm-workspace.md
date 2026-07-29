# ADR 0001 — TypeScript and pnpm workspace

Status: Accepted

Date: 2026-07-29

Decision owners: ACME maintainers

## Context

ACME needs strict compile-time contracts, runtime schema validation, several
independently testable packages and deterministic local development. Core,
modules and adapters must have visible dependency boundaries without adding a
heavy build orchestrator before the repository has scale data.

## Decision

ACME will use:

- Node.js 24 LTS, pinned to an exact patch
- pnpm 10 workspaces, pinned through `packageManager`
- TypeScript 6, strict ESM and shared project configuration
- Zod 4 for runtime schemas
- Vitest 4 for tests
- dependency-cruiser for package boundary enforcement

The first workspace contains `apps/`, `packages/`, `scenarios/` and `tooling/`.
No Turborepo or Nx layer is added initially. The lockfile is committed and CI
uses frozen installation.

## Alternatives Considered

### npm workspaces

- Benefits: bundled with Node and fewer bootstrap assumptions.
- Costs: weaker workspace ergonomics and dependency policy controls for this
  multi-package design.
- Reason not selected: pnpm provides the clearer strict workspace model ACME
  needs.

### Rust workspace

- Benefits: strong types, performance and explicit error handling.
- Costs: slower extraction of the TypeScript reference concepts and greater
  friction for model SDK adapters and expected contributors.
- Reason not selected: ACME's first risk is architecture and semantics, not
  runtime throughput.

### TypeScript with Turborepo

- Benefits: mature task graph and caching.
- Costs: another configuration and cache layer before repository size
  justifies it.
- Reason not selected: plain pnpm scripts are sufficient for initial packages.

## Consequences

### Positive

- Shared language for contracts, modules, adapters and CLI.
- Fast offline tests and direct compatibility with common model SDKs.
- Strict dependency boundaries remain automatable.
- A simple bootstrap can grow without committing to a framework.

### Negative

- Native `better-sqlite3` installation needs supported Node binaries/tooling.
- TypeScript types do not replace runtime validation.
- pnpm and Node versions must be managed explicitly.

### Follow-ups

- ACME-0004 pins exact patch versions and creates the lockfile.
- Reconsider a task orchestrator only after measured CI/build pain.

## Compatibility and Migration

Patch updates occur through dedicated dependency changes. Node or pnpm major
updates require CI evidence and an ADR amendment or superseding ADR. Package
APIs follow the versioning rules in the design specification.

## References

- [ACME specification, sections 5–6](../design/acme-design-and-development-spec.md#5-system-architecture)
- [Node release status](https://nodejs.org/en/about/previous-releases)
- [TypeScript 6 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html)
- [pnpm](https://pnpm.io/)
