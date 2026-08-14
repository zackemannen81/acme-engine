# Current Task

Task ID: ACME-0101
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-12
Last updated: 2026-08-12
Charter frozen at: 2026-08-12

## Task Summary

Corrective task. The browser shell emitted a JavaScript module the browser
could not parse, so the entire Evidence workbench client was dead — including
sign-in. Repair the emitted module and add a gate that makes this class of
defect impossible to ship again.

## Task Charter

### Goal

The rendered browser module parses, and a regression gate proves it.

### Primary Deliverable

The corrected shell source plus a test that compiles the emitted module rather
than only matching substrings in it.

### In Scope

- Repair the escape that produced an unterminated string literal.
- Add a parse gate over the emitted browser module.
- Confirm no other escape in the shell template has the same defect.

### Out of Scope

- Any product behavior, contract, persistence or data-authority change.
- Redesigning the shell away from a template literal.

### Definition of Done

- The emitted module compiles.
- The gate fails when the defect is reintroduced and passes when it is fixed.
- Canonical verification passes.

### Minimum Verification Gates

- [x] Emitted-module parse test.
- [x] Reintroduce-the-defect check proving the gate is load-bearing.
- [x] Canonical typecheck/lint/tests/build/format/docs/diff gates.

## Checklist

- [x] Reproduce the failure in a real browser and read the console.
- [x] Locate the exact offending construct in the emitted module.
- [x] Repair it in the shell source.
- [x] Scan the shell for other template-consumed escapes.
- [x] Add the parse gate and prove it catches the defect.
- [x] Run canonical verification.
- [x] Synchronize docs and journal.

## Decisions and Notes

- Root cause: `apps/evidence-workbench-web/src/index.ts` renders the whole
  browser client from one TypeScript template literal. `draftRedaction` was
  written as `.join('\n')`. Inside a template literal `\n` is an escape the
  literal consumes, so the rendered HTML contained a real line break inside a
  single-quoted JavaScript string. That is an unterminated string literal, and
  a parse error anywhere in a module kills the whole module — so no handler was
  ever bound, including the sign-in form's.
- The fix is `.join('\\n')`, which emits the two-character escape.
- The defect entered with ACME-0097's Documents/redaction view and shipped
  through ACME-0098, ACME-0099 and ACME-0100 because the shell test only
  asserted `toContain` substrings. Substring assertions pass happily while
  every button in the product is dead; only compiling the emitted module
  detects it.
- The gate compiles with `new vm.Script` and never executes: the module uses
  top-level await, so it is wrapped in an async arrow to keep that legal.
- A scan for other single-backslash escapes in the shell template found none.

## Verification

- [x] Reproduced in the Browser pane before the fix:
      `Uncaught SyntaxError: Invalid or unexpected token`, and the served module
      failed `node --check` at `draftRedaction`.
- [x] After the fix a clean tab logs only the expected `401` from the
      unauthenticated `/api/session` probe, which is what renders the sign-in
      form. No `SyntaxError`.
- [x] Gate proof: reintroducing `.join('\n')` fails the new test; restoring
      `.join('\\n')` passes it.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` — 728
      unit (115 files, up from 727), 78 conformance, 62 integration, 26
      scenario; `pnpm build`; `pnpm docs:check`; `git diff --check` clean.
- [ ] `pnpm test:postgres` — not run; no PostgreSQL environment is configured
      and this change touches no persistence.

## Handoff and Follow-ups

- Current state: complete. The browser client loads and renders sign-in.
- Sign-in itself was not exercised end to end by the assistant, because that
  means entering a password into a form. The credential is the synthetic-only
  development account documented in
  `apps/evidence-workbench-api/README.md`.
- Follow-ups, not defects: the shell is a single unchecked template literal, so
  every browser behavior is verified only through rendered-string assertions
  plus this parse gate. A real browser-driven smoke test of sign-in would be a
  separate charter.
- Blockers: none.

## Finalize When Complete

- [x] Archive this file under `docs/finished/`.
- [x] Add a signed `docs/JOURNAL.md` entry.
- [x] Leave `docs/CURRENT_TASK.md` with no active task.
