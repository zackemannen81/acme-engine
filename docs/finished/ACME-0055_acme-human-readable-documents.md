# Current Task

Task ID: ACME-0055
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-06
Last updated: 2026-08-06
Charter frozen at: 2026-08-06
Archived: 2026-08-06

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/design/acme-design-and-development-spec.md`
- `docs/adr/0025-post-execution-quality-evaluation.md`

## Task Summary

The user approved a governing-document reality review followed by three
human-facing Swedish artifacts in the repository-root `hrd/` directory: an
ACME presentation, a whitepaper and a technical system document. The artifacts
must be derived from the synchronized repository authority, not chat history,
and visually verified before delivery.

## Task Charter

### Goal

Provide an accurate, coherent and professionally rendered explanation of ACME
for executive/technical readers after completing a repository-documentation
reality audit.

### Primary Deliverable

Three final files under `hrd/`: one `.pptx` presentation and two `.docx`
documents (whitepaper and technical system documentation), all in Swedish.

### In Scope

- Audit governing Markdown documentation for current implementation reality.
- Repair stale or contradictory long-lived documentation discovered by the
  audit without changing product behavior.
- Create a concise presentation explaining the problem, architecture,
  evidence model, current capabilities, quality evaluation and remaining gaps.
- Create a narrative whitepaper for technical decision-makers.
- Create a detailed technical system document for maintainers and integrators.
- Use repository facts only; mark boundaries and unimplemented capabilities
  explicitly.
- Render and visually inspect every PPTX slide and every DOCX page.

### Out of Scope

- New engine behavior, persistence migrations or UI features.
- Live provider calls, external research, deployment or publication.
- Marketing claims, benchmark results or production-readiness claims not
  supported by repository evidence.
- PDF or native Google Docs/Slides delivery.

### Definition of Done

- Governing docs agree on ACME-0054, ADR-0025, ScenarioRunner v1/v2, test
  counts and persistent gaps.
- `hrd/ACME-presentation.pptx` is complete, editable and visually clean.
- `hrd/ACME-whitepaper.docx` is complete and visually clean.
- `hrd/ACME-teknisk-systemdokumentation.docx` is complete and visually clean.
- Artifacts distinguish assertions, metrics, pre-commit evaluation and
  post-execution quality evaluation.
- Documentation checks, artifact structural checks and render QA pass.

### Minimum Verification Gates

- [x] `pnpm docs:check`
- [x] `git diff --check`
- [x] Render every slide; inspect full-size slides and run overflow checks.
- [x] Render every DOCX page; inspect all page images.
- [x] Audit final artifacts for placeholders, unsupported claims and broken
      internal terminology.

## References

- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/design/acme-design-and-development-spec.md`
- `docs/adr/README.md`
- `docs/adr/0025-post-execution-quality-evaluation.md`
- `docs/finished/ACME-0054_quality-evaluation-harness.md`

## Checklist

- [x] Complete and archive ACME-0054; restore the task template.
- [x] Activate and freeze ACME-0055 from the user's explicit approval.
- [x] Finish the governing-document reality audit and consistency checks.
- [x] Draft and build the Swedish ACME presentation.
- [x] Draft and build the Swedish whitepaper.
- [x] Draft and build the Swedish technical system documentation.
- [x] Render, inspect and iterate all three artifacts.
- [x] Update file map, current status and journal; run final gates.
- [x] Archive ACME-0055 and restore the task template.

## Decisions and Notes

- Artifact language is Swedish, matching the user's request context; public
  contract names and code identifiers remain in their exact English forms.
- The presentation uses the restrained Codex Grid visual system. The
  whitepaper uses the `narrative_proposal` document preset with an
  `editorial_cover`; the system document uses `compact_reference_guide` with a
  `memo_masthead`.
- Artifact facts come from repository authority as synchronized on 2026-08-06.
- `driver-error-classification` is described accurately: generic public ACME
  persistence classes, adapter-owned mapping from concrete driver codes.
- A checkpoint after each step or substep is required. Checklist and current
  status remain truthful throughout the task.

## Charter Amendment Log

- none

## Verification

- [x] Markdown links/fences and whitespace checks pass.
- [x] PPTX export, per-slide render and overflow checks pass.
- [x] Both DOCX files render to page PNGs with no clipping, overlap, broken
      tables, glyph loss or inconsistent page furniture.
- [x] Final content review finds no contradiction with governing docs.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md` if the audit finds remaining stale facts
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `README.md`/`AGENTS.md` only if the audit requires further correction

## Handoff and Follow-ups

- Current state: ACME-0055 complete; all three artifacts verified and ready.
- Next recommended step: explicitly choose which remaining operational or
  product surface should be activated next.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none; reasonable format and language defaults are frozen.

## Finalize When Complete

- Archive as `docs/finished/ACME-0055_acme-human-readable-documents.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes, supersede rather than rewrite.
