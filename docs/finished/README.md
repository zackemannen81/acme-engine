# Finished Tasks

Discoverability: naming convention `ACME-NNNN_task-slug.md`. This archive is
not indexed file by file. Every member is addressable by its immutable Task
ID, and an archived task is never renamed or moved.
Member state: required. Every member declares a `Status:` line under its
title.

Completed `docs/CURRENT_TASK.md` files are archived here with their immutable
Task ID and a descriptive slug:

```text
ACME-NNNN_task-slug.md
```

An archived task is immutable historical context. Current behavior and active
work remain in `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md` and
`docs/CURRENT_TASK.md`.

Cancelled and superseded tasks are also archived here with their final status
and replacement link when applicable.
