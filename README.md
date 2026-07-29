# ACME

**Adaptive Context Memory Engine**

ACME is a greenfield project for building and evaluating a domain-neutral,
replayable AI execution engine. Narrative is the first reference module, not
the engine itself.

The complete design baseline, repository bootstrap, pure state/memory engines,
deterministic in-memory Unit of Work and exact scripted model mock are
complete. The workspace contains model-output validation, versioned request
hashing, static composition contracts, revisioned preparation and reusable
repository/gateway conformance suites; no orchestration engine, durable
persistence adapter, live model adapter or published package exists yet.

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
packages/testing/         Reusable repository/gateway conformance support
tooling/                   Shared configuration and repository checks
```

## Current objective

No implementation task is active. A maintainer must explicitly approve the
next bounded charter before work begins.
