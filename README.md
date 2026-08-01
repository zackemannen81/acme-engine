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
`@acme/cli` selects either repository, runs declarative `acme-scenario/1`
files, and can execute with the mock gateway (`--script`) or live OpenAI
(`--gateway openai`). No published package exists.

Milestone 2 is complete. An execution interrupted after a successful model
call resumes from the recorded response without paying for a second one, or
terminates with a classified error where the evidence is insufficient. That an
interrupted transaction leaves no partial state, and that two writers against
one revision produce exactly one commit, are proven by injected fault and
contended write rather than assumed. Committed domain events leave the outbox
through an explicit bounded drain with at-least-once delivery: nothing drains
on its own, because scheduling belongs to whatever process operates ACME.

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
(Domain Test UI decision gates, outbox redrive and real transports, ambiguous
call reconciliation, key lifecycle, optional parameter-capability gating). The
next task must be explicitly approved before activation.
