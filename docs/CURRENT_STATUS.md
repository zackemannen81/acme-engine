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

The complete design and development specification is approved as the
implementation baseline:

- `docs/design/acme-design-and-development-spec.md`
- ADR-0001: TypeScript and pnpm workspace
- ADR-0002: Static task-typed module composition
- ADR-0003: SQLite revisioned Unit of Work

ACME remains pre-implementation. There is currently:

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

No implementation task is active. `ACME-0003` completed the design baseline.
The specification proposes a bounded `ACME-0004` repository-bootstrap charter,
but it has not been activated.

## Persistent Gaps

- The proposed contracts and persistence schema are not implemented.
- Exact dependency patch versions and the lockfile are not yet created.
- Package boundaries and conformance suite are not yet implemented.
- No deterministic or live evaluation harness exists.
- Live provider call reconciliation, encrypted retention and privacy deletion
  intentionally require future ADRs before implementation.
