# AGENTS.md

ACME is docs-first. Every task begins in `docs/CURRENT_TASK.md`.

## Project Identity

- Project name: ACME
- Expansion: Adaptive Context Memory Engine
- Repository: `acme-engine`
- Purpose: Build and evaluate a domain-neutral, replayable AI execution engine.
- Current phase: Milestones 1 and 2 delivered; experimental live path proven.
  The contract layer, pure StateEngine and MemoryEngine, in-memory and durable
  SQLite repositories, deterministic model mock, shared conformance kits,
  NarrativeModule, ResearchModule, bounded single-task ExecutionEngine,
  ScenarioRunner, post-execution quality evaluation and CLI composition root
  exist. Both reference domains have
  offline acceptance scenarios. The OpenAI Responses mapping lowers schemas
  for strict structured output, has a `fetch` transport and an opt-in live
  gate, and has reached live success for both reference contracts.
  Encrypted-payload retention is implemented behind an injected
  `PayloadEncryptor`. The CLI selects the mock gateway via `--script` or a
  live OpenAI gateway via `--gateway openai` (env credentials).
- Milestone 2 is complete: an interrupted execution resumes from its recorded
  model call without a second provider call (ADR-0017); rollback and
  compare-and-swap are proven by injected fault and contended write rather
  than assumed; and committed events leave the outbox through an explicit
  bounded drain with at-least-once delivery (ADR-0018). Nothing drains on its
  own, and neither reference module emits domain events yet.
- The Domain Test UI is activated (ADR-0019 to ADR-0024, ADR-0027).
  `apps/test-ui` holds phases 1–6 as versioned view contracts (S1–S10) plus the
  pure S11 quality view, and a loopback HTML workbench with S1–S10 rendered. It
  includes `acme-test-plan/1`, protected offline browser preview and launch,
  measurement, fixture review, and gated single-execute live evaluation through
  both the local function and S10 browser form. Browser launch enqueues through
  an in-process JobRunner with progress and cooperative cancel; synchronous
  `launchPlan` remains for scripts and tests. Default entry is pure (no I/O);
  workbench serve is opt-in on `./local`. It is a leaf.
- `@acme/evaluation` adds domain-neutral, immutable post-execution quality
  assessments. Deterministic evaluators and replayed recorded-external
  evaluators produce versioned scores, findings and verdicts without mutating
  execution evidence (ADR-0025). ScenarioRunner v2 runs and asserts them
  offline, results persist in an in-memory or durable SQLite quality store
  (ADR-0026), `acme quality list|inspect|judge` reads and drives them, and a
  live-model judge runs outside the synchronous harness under the usual
  opt-in and environment-only credentials.
- ADR-0028 accepts the Evidence Integrity Workbench as the first real product
  POC. Its normative definition is
  `docs/design/evidence-integrity-workbench-product-definition.md`: V1 uses a
  synthetic text corpus, treats the model as a candidate generator, preserves
  source-bound observations and changed accounts, requires human review and
  excludes credibility, guilt, legal-sufficiency and real-case-data authority.
  Research Synthesis is the intended POC #2. Evidence slices 0–8 now provide
  the fixed synthetic corpus, observation/relation/timeline/assessment tasks,
  append-only review overlay, complete primary reviewer views and Slice 5
  assessment/re-review journey, optional technical audit, file/PostgreSQL
  persistence, deterministic reviewed ZIP and hosted multi-process shell.
  ADR-0035's Supabase Auth/BFF-session, product-principal,
  organization-membership and deny-by-default role architecture is
  implemented. New review decisions use authenticated server-derived
  principals; legacy `unauthenticated-local` records remain immutable.
  Stage A is the sole implemented non-synthetic data path; every other class
  remains unimplemented and gated by later authority.
  ADR-0037's secure artifact foundation is implemented for the fixed synthetic
  corpus: immutable canonical representations are application-encrypted behind
  filesystem/S3-compatible ports, keys stay in versioned mounted secret files,
  reads/exports/admin operations are content-free audited, and staging,
  reconciliation, re-wrap, tombstoned deletion and restore verification are
  executable. This does not authorize arbitrary ingestion.
  ADR-0038 accepts the next synthetic-only boundary: one bounded strict UTF-8
  plain-text import class, exact original plus canonical representations and
  immutable non-newline-spanning redacted derivatives with append-only logs.
  ACME-0097 implements that boundary through case-first authenticated API and
  browser flows, encrypted staged representations, durable import/redaction
  records, deterministic retry identities and file/PostgreSQL persistence.
  PDF/DOCX/OCR/media remain refused. ADR-0040 authorizes one distinct POC #1
  Stage A class, `stage-a-anonymized-judicial-text/1`; ACME-0105 implements its
  fail-closed live capability and ACME-0106 implements case/API/browser import
  of operator-prepared text with exact outside-PDF provenance. ACME-0107 adds
  one restart-safe live observation job with primary browser navigation, and
  ACME-0108 adds the corresponding restart-safe relation/open-question job
  over server-derived current observations. ACME-0110 adds source-complete live
  assessment plus the primary review/late-evidence/reassessment journey. The
  product never ingests the PDF container.
  ADR-0036's case boundary is implemented: opaque public cases own unique
  internal workspaces, explicit case memberships control content access,
  immutable case-object bindings scope repository/worker/API traversal, and
  same-organization adversarial route tests prove cross-case non-disclosure.
  Stage 6 reviewer operations (ACME-0098) and Stage 7 case overview plus the
  deterministic Case Integrity Report (ACME-0099) are delivered. The report is
  a pure projection of one authorized case snapshot: it classifies relations
  from typed canonical evidence rather than model-authored rationale text, and
  every row names the exact source-bound observations behind it. Stage 8
  (ACME-0100) delivers assessment output and export operations: one
  citation-complete `evidence-assessment-output/1` document rendered as
  byte-deterministic JSON, Markdown, DOCX and PDF with no new dependency, a
  per-case export policy, append-only export-audit records for every release
  and refusal, and a product backup manifest with fail-closed restore
  verification. Stages 1–8 are complete. ADR-0040 supplies the explicit Stage
  A Slice 9 authority without authorizing Stage B FUP material, arbitrary
  ingestion or activation by implication. ACME-0105 implements the typed
  fail-closed live composition capability and durable payload-key boundary;
  Stage A case creation, import, live observation and live relation analysis
  require that capability. The Stage A engineering journey is complete through
  reviewed reassessment; an explicitly budgeted real-provider acceptance
  remains external evidence before the POC is fully accepted.
- ADR-0047 is accepted. Real-source acceptance runs invalidated the Evidence
  *application* domain model, so it is replaced by `Case`, `Artifact`,
  `SourcePart`, `Chain`, `ChainInstance`, `ObservationOccurrence`, `Claim`,
  `Relation`, `Review`/`Standing` and `ConsensusProjection`, normatively
  specified in
  `docs/design/evidence-workbench-v2-domain-specification.md` together with the
  V1 boundary, the P1–P3 proof journeys, the defect-classification rules and
  binding regression requirements R-01–R-10 / W-01–W-03. None of it is
  implemented yet. The delivered workbench under `apps/evidence-workbench-*` is
  frozen as a diagnostic reference: only maintenance preserving its diagnostic
  value is permitted there, chartered separately and never bundled with new
  work. Engine, persistence, artifact security, authorization, case isolation
  and the live model boundary carry forward unchanged, and no data authority
  changes.

## Start Here
This repo is docs-first. The active task always starts in `docs/CURRENT_TASK.md`.
Read these files in order before changing the repository:

1. `docs/CURRENT_TASK.md`
2. `docs/TASK_WORKFLOW.md`
3. `docs/PROJECT_BRIEF.md`
4. `docs/CONTRIBUTING.md`
5. `docs/CURRENT_STATUS.md`
6. `docs/SYSTEMDOC.md`
7. `docs/JOURNAL.md`
8. `docs/FILESTRUCTURE.md`

Read relevant ADRs under `docs/adr/` when the task touches a decided
architecture boundary.

## Documentation Ownership

- `docs/CURRENT_TASK.md`: Single source of truth for the active task.
- `docs/TASK_WORKFLOW.md`: Canonical task states, scope freeze and
  parent/child workflow.
- `docs/PROJECT_BRIEF.md`: Approved project direction and fixed scope.
- `docs/CURRENT_STATUS.md`: Current implementation reality and persistent gaps.
- `docs/SYSTEMDOC.md`: Long-lived architecture, contracts and system behavior.
- `docs/JOURNAL.md`: Dated session summaries, verification and handoff.
- `docs/FILESTRUCTURE.md`: Current repository map.
- `docs/adr/`: Architecture decisions and their consequences.
- `docs/paused/`: Frozen parent tasks waiting on a resume condition.
- `docs/backlog/`: Non-activated proposals outside the active charter.
- `docs/TASK_IDS.md`: Task identity claims. Allocation only, never status.
- `docs/concepts_sandbox/`: Explicitly excluded concept work, ideas and future
  visions. Never decided architecture, roadmap or current scope.
- `docs/finished/`: Archived completed task specifications.
- When a task is complete, archive `docs/CURRENT_TASK.md` into `docs/finished/` as `ACME-NNNN_task-slug.md`, then restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.

### One Active Task, Per Branch

- At most one task is active per branch, held in that branch's
  `docs/CURRENT_TASK.md`. Git already provides exactly one copy per branch, so
  this states the rule where it is already enforced rather than weakening it.
- The trunk never states how many tasks are active anywhere. `docs/TASK_IDS.md`
  records that an identity is taken, which says nothing about activity.
- One person holding several branches really does have divided scope. Holding
  one task at a time is the intent, but only the per-branch rule is checkable,
  so the rest is practice rather than a gate.
- A branch merges when its task is complete, so `main` normally carries the
  restored template. A merged in-progress charter is an explicit exception.

### Addressing and Discoverability

- A record's path is its identity. Status is declared in the record's content
  and in its collection index, never in a filename or a location.
- A file cited by append-only or archived documentation keeps its path. This
  binds every file type, not only Markdown: source files, fixtures and mocks
  cited by a journal entry, an archived task, an accepted ADR or an acceptance
  record are frozen at that path from the moment they are cited.
- Renaming such a file is not repairable. Fixing the citations would require
  editing records that must not be edited, so the only permitted outcome is
  restoring the original path.
- Do not cite disposable material from an immutable record. Give it a stable
  path first, or describe it instead of linking it.
- Every collection under `docs/` declares one discoverability mode in its
  `README.md`: `index`, meaning every member is listed there, or a naming
  convention that makes every member addressable without a list. Collections
  whose members carry lifecycle state also declare `Member state: required`.
- `pnpm docs:check` enforces the declarations, index completeness and path
  stability.
- A repository path written as inline code is a citation, not decoration.
  Documents that describe the present must name paths that exist:
  `AGENTS.md`, `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`,
  `docs/FILESTRUCTURE.md`, `docs/design/`, `docs/ops/`, `docs/acceptance/`
  and collection `README.md` files. A stale citation there fails the check.
- `docs/JOURNAL.md`, `docs/finished/`, `docs/adr/` and `docs/CURRENT_TASK.md`
  are exempt. The first three record what was true when written and
  legitimately name files that have since been removed; the active charter
  names its deliverables before they exist, which is the same situation
  pointing the other way. A stale citation there is reported as a warning and never gates the
  build, because repairing it would mean editing records that may not be
  edited. Their collection indexes inherit the exemption.
- Only paths that start at a real top-level entry and end in a file extension
  are checked. Package-relative fragments such as `src/extract.ts` name no
  single file and are left alone; write them from the repository root when the
  exact file matters.

## Task Workflow

### Start

- If `docs/CURRENT_TASK.md` is blank, stale or already complete, create the
  next explicitly approved task from `docs/template_CURRENT_TASK.md`.
- Before implementation, make sure `CURRENT_TASK.md` contains goal, success criteria, scope, checklist, verification plan, and documentation targets.
- Claim the Task ID in `docs/TASK_IDS.md` and merge that claim to `main`
  before moving the charter to `Ready`. The next free ID is one above the
  highest of the register and `docs/finished/`. An unmerged claim is not
  yours: a local count cannot see somebody else's branch.
- Freeze the Task Charter when status changes from `Draft` to `Ready`.
- Work from the checklist and keep it current while the task is in progress.
- Documentation is part of the task, not a follow-up chore.
- All meaningful pauses or handoffs must leave explicit follow-ups in `docs/CURRENT_TASK.md` and a dated entry in `docs/JOURNAL.md`.

### During Work

- Work from the active checklist and keep it truthful.
- Do not expand or redefine a frozen Goal, Primary Deliverable, scope or
  Definition of Done.
- Apply the decision tree in `docs/TASK_WORKFLOW.md` to every discovered work
  item.
- Add checklist steps only when required by the existing frozen charter.
- Update long-lived documentation in the same change as the behavior or
  contract it describes.
- Use an ADR for decisions that constrain multiple packages, public
  contracts, persistence, compatibility, security or future migrations.

Live-call policy:
- Execution budget must follow the planned bounded operation, not impose an arbitrary per-job call count.
- When the system can deterministically derive the number of model calls from immutable input, coverage windows and the selected execution plan, that derived count is the normal execution bound.
- The user-facing confirmation should report the planned execution, including the expected number of model calls and measurable usage/cost information where available.
- A separate emergency hard ceiling may exist only as protection against unexpected loops, planner defects or runaway execution. It must not prevent a valid bounded plan merely because the plan requires more than one model call.
- Missing usage or cost data must remain unknown; it must not be interpreted as zero.
- Cost control must not become a substitute for correctness testing during an explicitly authorized POC acceptance run.
- Do not spend more execution/reasoning effort deciding whether to perform a known bounded model operation than the operation itself reasonably costs.

### Pause or Handoff

- Leave explicit next steps, blockers and open questions in
  `docs/CURRENT_TASK.md`.
- If an internal prerequisite blocks progress, move the frozen parent task to
  `docs/paused/` and activate a bounded child task with a new Task ID.
- Put non-blocking discoveries in `docs/backlog/`; do not expand the active
  task.
- Add a dated, signed entry to `docs/JOURNAL.md`.
- A new contributor must be able to resume without relying on chat history.
- Put only persistent repo-level caveats or gaps in `docs/CURRENT_STATUS.md`.
- If work stops incomplete, the next person should be able to resume by reading `docs/CURRENT_TASK.md` first and then the latest `docs/JOURNAL.md` entry.

### Finish

- Verify the task in proportion to its risk.
- Update all affected documentation.
- Archive the completed task under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`, or fill
  it with the next explicitly approved task.
- If the task's Goal or Definition of Done became invalid, mark and archive it
  as `Superseded`; never rewrite it into a different task.

## Fixed Architecture Guardrails

- `packages/core` must remain domain-neutral.
- Domain vocabulary belongs to domain modules, not core.
- Provider SDKs, databases, CLIs and transports belong behind ports/adapters.
- Prompt outputs are untrusted candidates until runtime and semantic
  validation pass.
- Model output must never become canonical state directly.
- State changes require an explicit delta, domain reducer, invariants and an
  expected revision.
- Memory mechanics are generic; meaning, comparison and promotion policy are
  domain-owned.
- Execution events are candidates until the state transaction commits.
- The ExecutionEngine runs one task. Multi-step flows belong to a separate
  ScenarioRunner or future workflow layer.
- Static compile-time registries are the default until dynamic discovery is
  proven necessary.
- Narrative is a reference module, not the engine.

## Dependency Direction

```text
apps / composition root
  → adapters
  → modules
  → core
```

Forbidden:

```text
core → modules
core → provider SDK
core → database SDK
module → concrete adapter
adapter → domain policy decisions
```

## Safety and External Effects

- Never commit credentials or personal data.
- Use model mocks and recorded fixtures by default.
- Live provider calls require explicit task scope, a bounded budget and
  documented data handling.
- Deployments, package publication, remote mutations and destructive data
  actions require explicit user approval.
- Do not push or create releases unless the active task explicitly requests it.

## Verification Baseline

For documentation-only tasks:

- verify internal links
- verify balanced Markdown fences
- validate Mermaid when tooling exists
- run `git diff --check`

For code tasks, `docs/CURRENT_TASK.md` must define the required:

- typecheck
- unit tests
- conformance tests
- integration tests
- scenario/evaluation gates

If a required verification cannot run, record exactly what was skipped and why.

## Definition of Done

- Requested artifacts or code are complete.
- Acceptance criteria pass.
- Relevant docs reflect reality.
- `docs/JOURNAL.md` has a signed handoff entry.
- The completed task is archived.
- `docs/CURRENT_TASK.md` reflects the real next state.
