# Current Task

Task ID: ACME-0175
Parent Task: None
Status: Complete
Owner: Felix Nissen / Rickard Zakrisson decision / Codex implementation
Created: 2026-08-26
Last updated: 2026-08-26
Charter frozen at: 2026-08-26T20:30+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/README.md`
- `docs/concepts_sandbox/acme-open-source-strategy.md` as non-authoritative
  discovery input only

## Task Summary

Make ACME's source-distribution boundary explicit and internally consistent:
the repository is open source under Apache License 2.0, while npm packages,
deployments and versioned releases remain unpublished unless separately
authorized. Audit the current working tree, ignored environment files, tracked
files and Git history for likely provider credentials without printing secret
values.

## Task Charter

The charter is frozen. Goal, primary deliverable, scope and Definition of Done
must not expand inside ACME-0175.

### Goal

Make the ACME repository honestly ready to be described as Apache-2.0 open
source without exposing credentials or implying a package/product release.

### Primary Deliverable

One documented Apache-2.0 source-distribution boundary plus a content-free,
evidence-backed secret audit of the repository and its history.

### In Scope

- Add the standard Apache License 2.0 text at the repository root.
- Make the README and live governance/status/system/file-map documents agree
  that repository source is open source under Apache-2.0.
- State that the root npm `private` flag prevents registry publication but does
  not make source private or change its license.
- Record that Apache-2.0 permits commercial use while granting no trademark,
  support, warranty, hosted-service or separate commercial-product promise.
- Audit tracked files, ignored `.env*` files, the current working tree and Git
  history for likely API keys, tokens, credentials and accidentally tracked
  environment files without emitting matched values.
- Strengthen ignore/documentation boundaries if the audit exposes a local
  hygiene gap.
- Record the audit method, content-free outcome and required response to any
  confirmed secret.

### Out of Scope

- Publishing an npm package, deployment, release, tag or announcement.
- Pushing this branch or mutating GitHub settings.
- Rotating or revoking an external credential; a confirmed live credential is
  reported as a blocker requiring owner/provider action.
- Changing runtime, engine, Evidence V2/Workbench or POC #1 behavior.
- Selecting a trademark policy, paid offering, hosted service or support SLA.
- Licensing third-party dependencies beyond their own upstream terms.

### Definition of Done

- Root `LICENSE` contains the standard Apache License 2.0 text.
- Live repository documents consistently describe public/open-source source
  distribution under Apache-2.0 and distinguish it from package publication,
  deployment and a versioned release.
- The npm `private` flag is retained and explained accurately.
- No `.env` or `.env.*` file containing credentials is tracked; allowed example
  files contain placeholders only.
- A redacted scan covers the current tree, ignored environment files and every
  reachable Git revision, and records findings without secret values.
- Any confirmed credential is removed from the current tree and escalated for
  rotation; historical presence is reported honestly because deleting the
  current file cannot revoke or erase history.
- Documentation gates and `git diff --check` pass.
- Task documentation is complete, the task is archived and
  `docs/CURRENT_TASK.md` is restored.

### Minimum Verification Gates

- [x] `pnpm docs:check`
- [x] internal Markdown link and fence review
- [x] `git diff --check`
- [x] tracked/ignored environment-file inventory
- [x] content-redacted current-tree high-confidence secret scan
- [x] content-redacted all-revision high-confidence secret scan
- [x] audit of allowed examples/placeholders
- [x] protected behavior diff review: no runtime/product source change

## References

- Owner direction in the 2026-08-26 session
- `package.json`
- `.gitignore`
- `apps/evidence-workbench-api/test/secret-scan.test.ts`
- `docs/concepts_sandbox/acme-open-source-strategy.md`

## Checklist

- [x] Pull current `origin/main` with fast-forward only.
- [x] Confirm ACME-0175 is claimed on `main` and no remote work branch exists.
- [x] Freeze the bounded licensing and secret-audit charter.
- [x] Inventory current license/publication statements and secret boundaries.
- [x] Run current-tree, ignored-file and full-history redacted secret scans.
- [x] Add Apache-2.0 and synchronize live documentation.
- [x] Record content-free audit evidence and response requirements.
- [x] Run all minimum verification gates.
- [x] Archive the task, restore the template and add the signed journal entry.

## Decisions and Notes

- The repository source license and npm publication state answer different
  questions. Root `private: true` remains as an accidental-publication guard.
- Secret scan output must name only rule, path/revision and line number where
  needed. It must never print a candidate value.
- Historical immutable records may accurately say that an earlier repository
  was private. Live documents own current ACME distribution status.
- Apache-2.0 is a permissive open-source license that allows commercial use; it
  does not itself create a separate commercial edition or service.

## Charter Amendment Log

- none

## Verification

- Audit inventory: 0 tracked `.env*` paths, 0 historical `.env*` paths, one
  ignored and untracked local `.env.local`.
- High-confidence current-tree scan: 0 path hits.
- High-confidence all-revision scan: 0 path hits across 227 reachable
  revisions.
- Generic assignment review: 5 current paths and 27 unique historical blobs;
  runtime references, placeholders and one synthetic local-development
  credential only.
- `pnpm docs:check`: passed 318 Markdown files; 31 historical-path warnings
  were reported without gating.
- Internal Markdown links and fences: passed through `pnpm docs:check`.
- `pnpm format:check`: passed.
- `git diff --check`: passed.
- Final working-repository scan: 0 high-confidence hits across 911 files.
- Normalized root `LICENSE`: exact match to the verified Apache-2.0 reference.
- Protected behavior review: 0 changed paths under `apps/`, `packages/`,
  `tests/` or `tooling/`; no runtime test required for documentation and
  metadata-only changes.

## Documentation Updates

- [x] `README.md`
- [x] `AGENTS.md`
- [x] `docs/PROJECT_BRIEF.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/adr/`
- [x] `docs/acceptance/`
- [x] `docs/JOURNAL.md`

## Handoff and Follow-ups

- Current state: Complete. Apache-2.0 source distribution, synchronized live
  documentation and scoped content-redacted audit are delivered.
- Next recommended step: merge or push only through separately authorized
  repository workflow.
- Blockers: None known.
- Child tasks: None.
- Resume condition: N/A.
- Open questions: None. The local credential-bearing environment file is
  ignored, untracked and absent from reachable history, so no exposure-driven
  rotation is indicated by this audit.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes, supersede rather than rewrite it.
