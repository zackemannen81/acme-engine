# Architecture Decision Records

Use ADRs for decisions that constrain multiple packages or future migrations.

## Naming

```text
NNNN-short-kebab-case-title.md
```

Example:

```text
0001-use-typescript-workspaces.md
```

## Statuses

- Proposed
- Accepted
- Superseded
- Deprecated
- Rejected

## Process

1. Copy `docs/adr/template.md`.
2. Describe context and decision drivers.
3. Record considered alternatives.
4. State the decision and consequences.
5. Link implementation tasks and superseded ADRs.

An ADR records why a decision exists. `SYSTEMDOC.md` records the resulting
current architecture.

## Accepted Decisions

- [`0001-typescript-pnpm-workspace.md`](0001-typescript-pnpm-workspace.md)
- [`0002-static-task-typed-module-composition.md`](0002-static-task-typed-module-composition.md)
- [`0003-sqlite-revisioned-unit-of-work.md`](0003-sqlite-revisioned-unit-of-work.md)
