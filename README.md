# ACME

**Adaptive Context Memory Engine**

ACME is a greenfield project for building and evaluating a domain-neutral,
replayable AI execution engine. Narrative is the first reference module, not
the engine itself.

The complete design baseline, repository bootstrap, pure state/memory engines,
deterministic in-memory Unit of Work, durable SQLite Unit of Work, exact
scripted model mock and bounded single-task ExecutionEngine are complete. The
workspace contains model-output validation, versioned request and execution
identity, static composition contracts, revisioned preparation, replay
verification and reusable repository/gateway/module conformance suites. The
pure `@acme/module-narrative` and `@acme/module-research` packages implement
two reference domains over that same core, each with its own offline
acceptance scenario, which is the executable evidence that core is
domain-neutral. The OpenAI Responses mapping lowers schemas for strict
structured output, is proven offline and has reached live success through an
opt-in gate. Encrypted-payload retention seals model responses at rest.
`@acme/cli` selects either repository and runs declarative `acme-scenario/1`
files, but still uses only the mock gateway via `--script`. No published
package exists.

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
apps/cli/                 Composition root: execute, replay, inspect
packages/core/            Domain-neutral contracts and deterministic primitives
packages/adapter-memory/  Deterministic copy-on-commit repository
packages/adapter-sqlite/  Durable WAL-mode revisioned repository
packages/adapter-model-mock/ Exact finite model-call scripts
packages/adapter-model-openai/ OpenAI Responses mapping behind a transport port
packages/module-narrative/ Narrative observe-document reference module
packages/module-research/ Research observe-evidence reference module
packages/testing/         Reusable repository/gateway/module conformance support
tooling/                   Shared configuration and repository checks
```

## Current objective

`docs/CURRENT_TASK.md` is the sole source for active work. See
`docs/CURRENT_STATUS.md` for implemented capability and persistent gaps
(CLI live gateway, Domain Test UI decision gates, M2 residuals, optional
temperature capability). The next task must be explicitly approved before
activation.
