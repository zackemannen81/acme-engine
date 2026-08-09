# ACME-0063 — Plan/scenario model pin (L1)

Status: Complete  
Archived: 2026-08-06  
Branch: `chore/gapfixes`

## Goal

Allow `acme-test-plan/1` / `acme-scenario/1` to pin `ModelSelection` so an
`ExecutionRequest` can be materialized without reading selection from a mock
fixture.

## Delivered

- Optional `model` on plan cases and scenario execute steps
- Prefer plan/case model over mockResponse.selection when materializing
- Optional `mockResponse` when `composition.gateway` is `openai` and model is set
- Plan compile tests for model pin and openai plan materialization

## Paired with

ACME-0064 (live multi-step ScenarioRunner).
