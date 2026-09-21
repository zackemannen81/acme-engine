# Task ID Register

Floor: ACME-0169

This register allocates task identities. It records that a number is taken and
by whom. It never records whether work is in progress, complete or abandoned:
task state belongs to `docs/CURRENT_TASK.md` and `docs/finished/`, and a second
statement about it here would drift from both and would make the trunk claim
how much work is active across the repository.

Identities below the floor were allocated before this register existed. They
are addressed by `docs/finished/` under the `ACME-NNNN_task-slug.md` naming
convention and are deliberately not backfilled: inventing an owner and a claim
date for 168 historical tasks would be inventing evidence.

## How to claim

1. The next free identity is one above the highest of this register and
   `docs/finished/`.
2. Append one row at the end of the table below. Never insert into the middle,
   never sort, never group by owner. The append point is the safety mechanism:
   two people claiming at the same moment edit the same region and the second
   one gets a merge conflict instead of a silent duplicate.
3. Merge the claim to `main`. The identity is not yours until that lands.
4. Only then move the charter to `Ready`.

If you are about to freeze a charter and are unsure whether the claim landed:

```bash
git ls-remote --heads origin && gh pr list --state open
```

`pnpm docs:check` verifies that this table is strictly ascending, free of
duplicates, carries no status column, and covers every archived task at or
above the floor as well as the active task.

## Claims

| Task ID | Title | Owner | Claimed | Work |
| --- | --- | --- | --- | --- |
| ACME-0169 | optional runnable canonical runtime composition | felixnissen | 2026-08-19 | PR #38 |
| ACME-0170 | addressing and discoverability | Claude | 2026-08-19 | concept/docs-first_opensource |
| ACME-0171 | prose path citations | Claude | 2026-08-19 | concept/docs-first_opensource |
| ACME-0172 | task ID claim register | Claude | 2026-08-19 | concept/docs-first_opensource |
| ACME-0173 | docs-first protocol repository bootstrap | Claude | 2026-08-19 | task/acme-0173-protocol-repo-bootstrap |
| ACME-0174 | deterministic reuse observability | felixnissen | 2026-08-26 | contrib/acme-0174-reuse-observability |
| ACME-0175 | open-source release and commercial boundary | felixnissen | 2026-08-26 | felix/acme-0175-open-source-commercial-readiness |
| ACME-0176 | model-only text/tool streaming execution runtime | Grok (delegated) | 2026-09-15 | prepare ACME as non-cognitive provider-execution substrate for A008 and other clients |
| ACME-0177 | OpenAI multi-turn history and structured error preservation | OpenAI assistant | 2026-09-15 | consumer-driven repair from A008 live ACME test |
| ACME-0178 | contiguous terminal sequence after streamed failure | OpenAI assistant | 2026-09-15 | consumer-driven repair from A008 live ACME test |
| ACME-0179 | Preserve whitespace tool-call argument fragments | OpenAI assistant | 2026-09-15 | consumer-driven repair from A008 live ACME tool streaming |
| ACME-0180 | multi-provider model runtime and generation-control parity | OpenAI assistant | 2026-09-15 | add provider routing and preserve A008 generation controls without changing cognition |
| ACME-0181 | publishable model runtime npm boundary | OpenAI assistant | 2026-09-16 | expose ACME model runtime as installable @acme-engine packages for in-process consumers |
| ACME-0182 | native image parts in Chat Completions model runtime | ChatGPT (operator) | 2026-09-17 | map existing ACME image content parts to provider image_url blocks for A008 native vision parity |
| ACME-0183 | acme-engine public facade package | ChatGPT (operator) | 2026-09-18 | replace legacy CLI-only acme-engine npm package with importable facade over @acme-engine/model-runtime while keeping workspace root private |
| ACME-0184 | repair npm workspace dependency publication | ChatGPT (operator) | 2026-09-18 | republish public ACME closure as 0.1.1 from pnpm-packed tarballs so registry manifests contain concrete versions instead of workspace:* |
| ACME-0185 | honor non-streaming model execution intent | ChatGPT (operator) | 2026-09-18 | make ModelExecutionEngine use generate() when request stream is explicitly false so embedded consumers preserve non-streaming provider semantics |
| ACME-0186 | preserve timeout classification after streamed response start | ChatGPT (operator) | 2026-09-18 | keep transport timeout as TIMEOUT after HTTP 2xx response-start while preserving invalid-response for non-timeout stream truncation |
| ACME-0187 | profile-specific Chat Completions output-token wire field | ChatGPT (operator) | 2026-09-18 | preserve provider/model-specific max output token parameter naming for embedded A008 OpenAI Chat Completions |
| ACME-0188 | native OpenAI Responses image parity | ChatGPT (operator) | 2026-09-18 | preserve ACME image content parts on the native OpenAI Responses route so embedded A008 can restore Responses without losing vision |
| ACME-0189 | docs-first reality sync | ChatGPT (operator) | 2026-09-19 | reconcile README and current governing docs with published/runtime reality |
| ACME-0190 | lossless disjoint `oneOf` schema lowering | ChatGPT (operator) | 2026-09-19 | admit proven-disjoint MCP/JSON Schema unions at the OpenAI strict-output adapter boundary |
