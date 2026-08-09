# ACME-0069 — Async launch, progress and cancellation (T1 / G08)

Status: Complete  
Branch: `grok/gapfixes2`  
Date: 2026-08-09

## Delivered

- **ADR-0027** — Worker ownership (workbench in-process), job records, dual API
  (`launchPlan` sync + `enqueuePlan` async), progress projection, cooperative
  cancel, ledger safety.
- `acme-job-record/1` + workspace `jobs/` storage
- `createJobRunner` / `enqueuePlan` on `@acme/test-ui/local`
- S3 live-progress when job evidence supplied; HTML cancel + optional refresh
- `runScenario({ signal, onStep })`; `ExecutionEngine.execute(request, { signal? })`
- Run record status additive `cancelled`
- Process restart → non-terminal jobs `interrupted`
- Tests: job-runner unit, workbench integration wait-for-run

## Out of scope retained

- Multi-node queue, websockets/SSE, multi-job concurrency, plan-job resume
- T2 measurements block, T3 adapter discovery, T4 browser CI

## References

- ADR-0027, ADR-0021 (amended note), gap-plan G08 closed
