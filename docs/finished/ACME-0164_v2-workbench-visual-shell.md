# Current Task

Task ID: ACME-0164
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-19
Last updated: 2026-08-19
Charter frozen at: 2026-08-19

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0049-evidence-v2-surface-set.md`
- Operator mock at `C:\code\acme-poc1-ui` (visual source, not a composition)

## Task Summary
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

The operator produced a visual mock of the 2.0 workbench. The product still
renders as a monospaced single-column page. This task applies that visual
language to the existing server-rendered V2 surfaces, and places every
current function the mock omitted into that same shell.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

A reviewer working a case sees the mock's shell — navy header, dark sidebar,
card tables — while every existing V2 function remains reachable and
behaves as it does today.

### Primary Deliverable

A restyle of `apps/evidence-workbench-v2-web` (and only the HTML it
emits) so every current route renders in the mock's visual language, with
functions the mock omitted placed in the same style.

### In Scope

- Translate the mock's layout, colour, typography and card language into
  the existing server-rendered HTML. No client framework, no Tailwind, no
  new runtime dependency.
- Sidebar + header chrome on every case-scoped page, still built from
  `EVIDENCE_V2_SURFACES` so navigation and status cannot disagree (R-07).
- Restyle sign-in, the case list, import, parts, chains, instance review,
  comparison, claims, relations, timeline, consensus and status.
- Place Consensus in the sidebar: the mock omitted it; the product has it.
- Keep every existing write form and every exact-source link.
- Bounded lists and stated page bounds stay (R-08).

### Out of Scope

- React, Vite, Tailwind, lucide, or any other mock dependency.
- A new ledger / audit-trail surface. That is not an ADR-0049 surface.
- Changing routes, contracts, persistence, authorization or model calls.
- Inventing case fields the product does not store (crime scene, lead
  investigator, SKL unit, ISO 17025 claim).
- Claiming the product is SKL / NFC. The mock's visual language is used;
  the product remains the Evidence Workbench.
- Changing `evidence-v2-observe/1` or any domain fold.
- Wiring Supabase Auth (ACME-0163).

### Definition of Done

- Every existing V2 HTML route renders inside the new shell.
- The surface bar remains one list; Consensus is in it.
- Sign-in, case create, PDF/text import, review, compare, claim grouping
  and relation authoring still work.
- A non-member is still 404; unauthenticated is still 401.
- Status still reports counts, never a chart, gauge or score.
- Offline route tests still pass, with assertions updated only where they
  encoded the old chrome rather than behaviour.

### Minimum Verification Gates

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm boundaries`
- [x] `pnpm test` (unit, conformance, integration, scenario)
- [x] `pnpm docs:check`
- [x] `pnpm build`
- [x] `git diff --check`
- [x] Exercise the restyled surfaces against the running V2 API in the
      browser (or the closest substitute if browser tools are unavailable).

## References

- Operator mock: `C:\code\acme-poc1-ui`
- [ADR-0049](../adr/0049-evidence-v2-surface-set.md)
- [ACME-0157](ACME-0157_v2-shell-and-case-status.md)
- [ACME-0162](ACME-0162_v2-timeline-and-consensus.md)

## Checklist

- [x] Charter frozen.
- [x] Restyle the shared shell (header, sidebar, cards, forms).
- [x] Restyle every existing surface and detail page.
- [x] Place Consensus and other omitted current functions in that shell.
- [x] Keep test-asserted headings, links and page bounds.
- [x] Run verification gates.
- [x] Browser-check the running workbench.
- [x] Update long-lived docs; archive; restore the template.

## Decisions and Notes
- A checkpoint after each step or substep is required. Checklist is therefore updated along the work and `CURRENT_STATUS.md` is always updated when changes affect the behavior.
- Record decisions and assumptions within the frozen charter.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

Recorded at freeze:

- **Visual language, not a new composition.** The mock is React + Tailwind.
  The product stays plain HTML. CSS translates the mock.
- **No new surface.** Revision-ledger in the mock is a new ADR-0049
  entry and is out. Consensus, which the mock omitted, stays in the bar.
- **No invented authority.** Brand as Evidence Workbench 2.0. Do not
  render SKL / NFC / ISO 17025 as product identity.
- **English headings stay.** Tests and the current product language are
  English. The sidebar may use the mock's numbered bilingual labels.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

Run 2026-08-19. Nothing skipped except an interactive browser click-through:
no browser automation is wired in this environment. The restyle was
verified by fetching the live HTML routes after rebuild.

- typecheck, lint, format:check, boundaries, docs:check, build and
  `git diff --check`: clean.
- `pnpm test`: unit 966/966, conformance 78, integration 70, scenario 26.
- Live HTML on `http://127.0.0.1:8795` for the Hussein case: every
  case-scoped page has `header.shell`, `aside.rail`, `nav.surfaces`,
  `EVIDENCE WORKBENCH 2.0`, and `7. Consensus`. No SKL claim. No `<svg>`
  on Status. Sign-in and the case list stay outside the case rail.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs when long-lived decisions change — none

## Handoff and Follow-ups

- Current state: ACME-0164 complete. The V2 UI uses the mock's visual
  language. Functions are unchanged.
- Next recommended step: none activated. ACME-0163 (Supabase Auth) is
  optional. A revision-ledger surface would need its own ADR.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
