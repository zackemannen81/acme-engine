# ACME

**Adaptive Context Memory Engine**

ACME is a greenfield project for building and evaluating a domain-neutral,
replayable AI execution engine. Narrative is the first reference module, not
the engine itself.

The complete design baseline, repository bootstrap, pure state/memory engines,
deterministic in-memory Unit of Work, exact scripted model mock and bounded
single-task ExecutionEngine are complete. The workspace contains model-output
validation, versioned request and execution identity, static composition
contracts, revisioned preparation, replay verification and reusable
repository/gateway/module conformance suites; no durable persistence adapter,
Research reference module, live model adapter or published package exists
yet. The pure `@acme/module-narrative` package and its offline acceptance
scenario implement the first bounded reference-domain behavior.

## Start here

1. Read [the active task](docs/CURRENT_TASK.md).
2. Read [the task workflow](docs/TASK_WORKFLOW.md).
3. Read [the project brief](docs/PROJECT_BRIEF.md).
4. Read [the design and development specification](docs/design/acme-design-and-development-spec.md).
5. Follow [the contribution workflow](docs/CONTRIBUTING.md).

## Repository map

```text
AGENTS.md                 Agent and contributor guardrails
docs/PROJECT_BRIEF.md     Approved direction and scope
docs/CURRENT_TASK.md      Active task and acceptance criteria
docs/TASK_WORKFLOW.md     Frozen charter and task lifecycle
docs/CURRENT_STATUS.md    Current implementation reality
docs/SYSTEMDOC.md         Long-lived architecture
docs/JOURNAL.md           Dated handoffs
docs/FILESTRUCTURE.md     Repository map
docs/adr/                 Architecture decisions
docs/design/              Design specifications
docs/paused/              Paused parent tasks
docs/backlog/             Non-activated work proposals
docs/finished/            Completed task archive
apps/cli/                 CLI composition-root skeleton
packages/core/            Domain-neutral contracts and deterministic primitives
packages/adapter-memory/  Deterministic copy-on-commit repository
packages/adapter-model-mock/ Exact finite model-call scripts
packages/module-narrative/ Narrative observe-document reference module
packages/testing/         Reusable repository/gateway/module conformance support
tooling/                   Shared configuration and repository checks
```

## Current objective

`docs/CURRENT_TASK.md` is the sole source for active work. NarrativeModule
phases 1–5 and the bounded Milestone 1 single-task ExecutionEngine are
implemented. The next task must be explicitly approved before activation.
