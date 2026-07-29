# Current Status

Last updated: 2026-07-29

## Repository

- Git repository initialized on `main`.
- Remote: `https://github.com/zackemannen81/acme-engine.git`.
- Docs-first foundation is present.
- Frozen task charters, parent/child tasks, paused tasks and backlog proposals
  are governed by `docs/TASK_WORKFLOW.md`.
- LF line endings are enforced through `.gitattributes`.

## Project Phase

ACME is in design. There is currently:

- no runtime source tree
- no package manager or workspace configuration
- no TypeScript configuration
- no database schema
- no model provider adapter
- no published package
- no deployment

## Approved Direction

`docs/PROJECT_BRIEF.md` is the active project direction. Core must be
domain-neutral and proven with NarrativeModule and ResearchModule.

## Active Work

The active task is `ACME-0003`: create the complete design and development
specification before bootstrapping implementation packages.

## Persistent Gaps

- Exact TypeScript contracts are not yet locked.
- Persistence schema and transaction boundaries are not yet specified.
- Toolchain and workspace manager are not yet selected.
- Package boundaries and conformance suite are not yet implemented.
- No deterministic or live evaluation harness exists.
