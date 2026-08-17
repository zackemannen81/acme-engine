# ACME-0139 — Pass 1 empty roster

Task ID: ACME-0139
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Goal

A Stage A window that names people in the text can commit without
`EVIDENCE_ACTOR_CANDIDATES_MISMATCH` when no roster was supplied.

## Primary Deliverable

Active observe contract `1.10.0` whose prompt and semantics require
`null` actor fields on an empty roster. Historical `@1.9.0` stays
byte-exact.

## Verification

```text
pnpm typecheck                         pass
pnpm lint                              pass
pnpm format                            pass
pnpm boundaries                        pass
pnpm docs:check                        257 Markdown files
pnpm test:unit                         788/788
pnpm test:conformance                  78/78
pnpm test:integration                  70/70
pnpm test:scenario                     26/26
```

## Notes

Output schema stays `/5`. Exhibit `sourceActorReference` is already
nullable. Statement occurrences still require an actor in the schema;
Stage A judicial text is `structured-exhibit-text`.
