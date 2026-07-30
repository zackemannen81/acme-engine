# Current Task

Task ID: ACME-0010
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-07-30
Last updated: 2026-07-30
Charter frozen at: 2026-07-30

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/design/acme-design-and-development-spec.md`, sections 8, 10–13,
  16–19 and 23
- `docs/adr/0002-static-task-typed-module-composition.md`
- `docs/adr/0004-deterministic-transition-identity.md`
- `docs/adr/0005-pure-memory-decision-application.md`
- `packages/core/src/contracts.ts`
- `packages/core/src/modules.ts`
- `packages/core/src/memory.ts`
- `packages/core/src/state.ts`

## Task Summary

Create two team-ready implementation and test guides for ACME's reference
domains. Each guide must translate the approved architecture into a
reviewable package/component plan, build sequence, decision gates and
verification matrix without claiming that either module already exists.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Give the team a precise, presentation-ready plan for building and testing
NarrativeModule and ResearchModule as independent reference domains over the
same domain-neutral ACME core.

### Primary Deliverable

Two implementation guides—one for NarrativeModule and one for
ResearchModule—provided as normative Markdown sources and visually verified
DOCX renditions for team presentation.

### In Scope

- Describe each module's purpose, namespace, initial task and acceptance
  scenario.
- Define proposed package structure and the responsibility of every required
  component.
- Map task input, contract input/output, documents, memory candidates, state,
  delta, reducer, invariants, events and diagnostics.
- Explain dependency direction and how the modules compose with core,
  contracts, gateway, repository and future ExecutionEngine.
- Provide an ordered implementation sequence with review gates.
- Provide unit, type-contract, conformance, integration, scenario, replay,
  negative-path and boundary testing plans.
- Separate approved requirements from implementation recommendations and
  unresolved architecture decisions.
- Record non-blocking cross-domain gaps in `docs/backlog/`.
- Create polished DOCX renditions using one consistent business-guide design
  preset and visually inspect every rendered page.
- Update repository documentation, journal and file structure.

### Out of Scope

- Implementing either domain module, prompt contract, evaluator, engine,
  scenario runner or test suite.
- Changing core contracts, state/memory semantics or the approved reference
  vertical slices.
- Resolving the memory-decision-to-state projection boundary inside this
  documentation task.
- Adding live provider behavior, SQLite behavior, deployment or remote
  mutations.
- Package publication, commits, push or release.

### Definition of Done

- Two Markdown guides are complete, internally linked and consistent with the
  approved specification and current TypeScript contracts.
- Each guide contains a component map, proposed file/package map, build
  sequence, responsibility boundaries, decision gates and test matrix.
- Shared core usage is explicit and neither plan introduces domain branches
  in core or concrete adapter dependencies in a module.
- Narrative covers source documents, observations, character/relationship/
  world-rule memory, scene/window/outline state and its acceptance scenario.
- Research covers evidence sources, claims/questions, corroboration/
  contradiction memory, verified/contested/open-question state and its
  acceptance scenario.
- Cross-domain architecture gaps discovered during planning are recorded as
  bounded backlog proposals.
- Two DOCX renditions match the Markdown content, pass structural/preset
  audit and are visually clean on every rendered page.
- Documentation checks and `git diff --check` pass.
- Journal, status, file structure, archival and restored task template reflect
  reality.

### Minimum Verification Gates

- [x] Internal Markdown links and balanced fences
- [x] Mermaid blocks are structurally balanced and readable
- [x] Markdown sources contain required module/component/test sections
- [x] DOCX preset and structural audit
- [x] DOCX render to PNG and visual inspection of every page
- [x] `pnpm docs:check`
- [x] `git diff --check`

## References

- `docs/design/acme-design-and-development-spec.md`
- `docs/PROJECT_BRIEF.md`
- `docs/SYSTEMDOC.md`
- ADR-0002, ADR-0004 and ADR-0005
- Current `@acme/core` module, contract, memory and state types

## Checklist

- [x] Read the repository workflow, approved domain design and current core
  contracts.
- [x] Activate and freeze the explicitly requested ACME-0010 charter.
- [x] Draft the shared framing and NarrativeModule implementation guide.
- [x] Draft the ResearchModule implementation guide.
- [x] Record bounded architecture gaps in the backlog.
- [x] Review both guides for cross-domain symmetry and core neutrality.
- [x] Create DOCX renditions with a consistent resolved design preset.
- [x] Render and visually inspect every DOCX page; correct defects.
- [x] Run documentation and diff verification.
- [x] Update long-lived docs and add a signed journal entry.
- [x] Archive ACME-0010 and restore the task template.

## Decisions and Notes

- The user's explicit request on 2026-07-30 approves this bounded
  documentation task and its two deliverables.
- Markdown is the normative, reviewable source; DOCX files are presentation
  renditions of the same content.
- The `compact_reference_guide` DOCX preset is selected for both documents.
  The consistent form supports component lookups, checklists and test
  matrices.
- Recommendations are labeled and must not silently alter the approved
  specification.
- No ADR is required because this task records implementation guidance and
  unresolved decisions without changing a public contract.
- Apply `docs/TASK_WORKFLOW.md` to every discovered item.

## Charter Amendment Log

- None.

## Verification

- [x] Verify Narrative and Research plans use the same core mechanisms.
- [x] Verify every named component has an owner and test responsibility.
- [x] Verify normative requirements and recommendations are distinguishable.
- [x] Verify decision gates prevent implementation over unresolved contracts.
- [x] Verify DOCX content parity and page-level visual quality.
- [x] Record exact checks and any skipped verification.

Verification evidence:

- `pnpm docs:check` passed for 39 Markdown files; internal links and fences
  are valid.
- Both Markdown guides contain all required component, package, build,
  testing, decision-gate and team-review sections. Each contains one balanced
  Mermaid block and three balanced fenced blocks overall.
- DOCX structural/preset audit passed: both files use the resolved
  `compact_reference_guide` preset, fixed table geometry, real list numbering
  and a valid heading hierarchy with no accessibility findings.
- Microsoft Word opened both DOCX files read-only and reported 12 pages,
  three tables and no missing required sections in either file.
- Every page was exported through Microsoft Word to PDF, rasterized to PNG
  and visually inspected at original resolution. No overlap, clipping,
  overflow or unreadable tables were found.
- `git diff --check` passed.
- The preferred LibreOffice renderer could not run because LibreOffice is not
  installed. Microsoft Word COM was used as the local rendering fallback; no
  visual verification was skipped.

## Documentation Updates

- [x] `docs/design/narrative-module-build-and-test-plan.md`
- [x] `docs/design/research-module-build-and-test-plan.md`
- [x] `docs/presentations/narrative-module-build-and-test-plan.docx`
- [x] `docs/presentations/research-module-build-and-test-plan.docx`
- [x] `docs/backlog/`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`

## Handoff and Follow-ups

- Current state: Both guides and presentation renditions are complete,
  verified and ready for team review; archival remains.
- Next recommended step: Team-review the decision gates, then explicitly
  charter the prerequisites or one bounded reference-module implementation.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: None for this documentation task; future architecture
  decisions will be recorded as backlog proposals.

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0010_reference-module-build-and-test-guides.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes after `Ready`, supersede this task
  instead of rewriting it.
