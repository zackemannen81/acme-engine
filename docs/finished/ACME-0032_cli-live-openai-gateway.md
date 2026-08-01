# Current Task

Task ID: ACME-0032
Parent Task: None
Status: Complete
Owner: Grok
Created: 2026-08-01
Last updated: 2026-08-01
Charter frozen at: 2026-08-01

## Goal

Let the CLI composition root select the OpenAI Responses gateway for a single
execute, with credentials and model from the environment, without removing the
deterministic mock path.

## Primary Deliverable

`acme execute --request <file> --gateway openai` builds createOpenAiResponsesGateway
+ createFetchTransport; `--script` remains the offline path.

## Definition of Done

- [x] execute --script unchanged for existing tests
- [x] execute --gateway openai without OPENAI_API_KEY fails usage, no network
- [x] both --script and --gateway is usage error
- [x] offline suite passes; no credentials committed
- [x] docs updated

## Verification

unit 349; conformance 50; integration 13; scenario 19; typecheck lint format
boundaries build docs:check; git diff --check.
