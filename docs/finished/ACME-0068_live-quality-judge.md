# ACME-0068 — Live-model quality judge (Q4)

Status: Complete  
Branch: `grok/gapfixes2`

## Delivered

- Evaluator kind `live-model` for stored provenance
- `runLiveModelQualityJudge` (async, outside harness)
- CLI `quality judge <execution-id> --run-id --artifact`
- Offline proof with injected transport; live requires ACME_LIVE_TEST + key

## Harness boundary

Synchronous harness still refuses Promise evaluators and cannot register
`live-model` evaluators. Live work stays on the dedicated path.
