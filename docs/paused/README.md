# Paused Tasks

Discoverability: index. Every member of this directory is listed below,
and members are never renamed or moved to express a change of state.
Member state: required. Every member declares a `Status:` line under its
title.

This directory contains frozen parent tasks that are temporarily paused for a
named prerequisite, child task or external condition.

Paused tasks retain their original Task ID, Goal and Definition of Done.
Restore the exact task to `docs/CURRENT_TASK.md` when its resume condition is
met.

Do not use this directory as a general backlog.

- [ACME-0191 — publish oneOf schema lowering](ACME-0191_publish-oneof-schema-lowering.md) — Paused; npm authentication and registry proof pending.

