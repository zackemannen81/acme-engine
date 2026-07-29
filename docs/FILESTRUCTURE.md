# File Structure

Last updated: 2026-07-29

```text
acme-engine/
├── .gitattributes
├── .gitignore
├── AGENTS.md
├── README.md
└── docs/
    ├── CONTRIBUTING.md
    ├── CURRENT_STATUS.md
    ├── CURRENT_TASK.md
    ├── FILESTRUCTURE.md
    ├── JOURNAL.md
    ├── PROJECT_BRIEF.md
    ├── SYSTEMDOC.md
    ├── TASK_WORKFLOW.md
    ├── template_CURRENT_TASK.md
    ├── adr/
    │   ├── README.md
    │   └── template.md
    ├── design/
    │   └── README.md
    ├── paused/
    │   └── README.md
    ├── backlog/
    │   └── README.md
    └── finished/
        ├── README.md
        ├── ACME-0001_docs-first-foundation.md
        └── ACME-0002_frozen-task-charter-workflow.md
```

## Root Files

- `AGENTS.md`: Canonical agent and contributor guardrails.
- `README.md`: Project entrypoint.
- `.gitattributes`: Deterministic line-ending and binary-file handling.
- `.gitignore`: Local, generated and secret file exclusions.

## Documentation

- `PROJECT_BRIEF.md`: Approved direction and fixed scope.
- `CURRENT_TASK.md`: Active task source of truth.
- `TASK_WORKFLOW.md`: Frozen charter, task states and scope-change routing.
- `CURRENT_STATUS.md`: Actual implementation state and persistent gaps.
- `SYSTEMDOC.md`: Long-lived architecture and boundaries.
- `JOURNAL.md`: Dated handoff log.
- `CONTRIBUTING.md`: Task and contribution workflow.
- `adr/`: Architecture decision records.
- `design/`: Complete system and package specifications.
- `paused/`: Frozen parent tasks waiting on an explicit resume condition.
- `backlog/`: Non-activated proposals outside the active task charter.
- `finished/`: Archived completed tasks.

The runtime package tree will be added only after the active design
specification defines and approves it.
