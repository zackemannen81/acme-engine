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
  ScenarioRunner and CLI composition root exist. Both reference domains have
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
- The Domain Test UI is activated (ADR-0019 to ADR-0024). `apps/test-ui` holds
  phases 1–6 as versioned view contracts (S1–S10), plus a loopback HTML
  workbench (S1–S5 rendered; other surfaces stubbed). It includes
  `acme-test-plan/1`, protected offline browser preview and launch, measurement,
  fixture review, and gated single-execute live evaluation. Default entry is
  pure (no I/O); workbench serve is opt-in on `./local`. It is a leaf.

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
- `docs/concepts_sandbox/`: Explicitly excluded concept work, ideas and future
  visions. Never decided architecture, roadmap or current scope.
- `docs/finished/`: Archived completed task specifications.
- When a task is complete, archive `docs/CURRENT_TASK.md` into `docs/finished/` with a descriptive dated filename, then restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.

## Task Workflow

### Start

- If `docs/CURRENT_TASK.md` is blank, stale or already complete, create the
  next explicitly approved task from `docs/template_CURRENT_TASK.md`.
- Before implementation, make sure `CURRENT_TASK.md` contains goal, success criteria, scope, checklist, verification plan, and documentation targets.
- Assign a unique `ACME-NNNN` Task ID.
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
