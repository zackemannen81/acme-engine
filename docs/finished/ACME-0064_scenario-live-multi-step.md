# ACME-0064 — ScenarioRunner live multi-step (L2)

Status: Complete  
Archived: 2026-08-06  
Branch: `chore/gapfixes`

## Goal

Run multi-step scenario files against a live OpenAI gateway under opt-in
discipline, without making ScenarioRunner a workflow engine.

## Delivered

- `composition.gateway: openai` on `acme-scenario/1`
- `ScenarioComposition.liveGateway(selection)` injection
- CLI `scenario run` wires OpenAI when document declares openai (requires
  `ACME_LIVE_TEST` + `OPENAI_API_KEY`, or injected transport in tests)
- Offline multi-step: `tests/integration/scenario-live-offline.test.ts`
- Opt-in live multi-step: `tests/live/scenario-multi-step.test.ts`

## Out of scope

- S10 multi-step expansion (stays single-execute)
- Branching / loops / async launch
