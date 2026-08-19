# Current Task

Task ID: FELIX-ACME-0001
Parent Task: None
Status: In Progress
Owner: Felix and ChatGPT
Created: 2026-08-18
Last updated: 2026-08-18
Charter frozen at: 2026-08-18

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- Relevant ADRs under `docs/adr/`

## Task Summary

Turn the already compatibility-verified Fetch-compatible AAL v3 runtime host into a real runnable Node HTTP service composition so an external client can reach `/v1/compatibility` and `/v1/execute` over a bound TCP listener. The task closes only the listener/composition gap. It does not claim cloud deployment, TLS termination, public DNS, provider credentials or application-domain writeback.

## Task Charter

The charter is frozen at `Ready`. Goal, scope and Definition of Done may not be weakened; discoveries that require broader behavior must become follow-up tasks.

### Goal

Provide a deterministic, fail-closed, start/stop-capable Node HTTP listener around the verified AAL v3 Fetch host without changing `packages/core` or changing the frozen runtime wire contract.

### Primary Deliverable

A CLI-owned runtime-listener composition that can bind an explicitly configured host/port, convert Node HTTP requests to the existing Fetch `Request` boundary, return the Fetch `Response` faithfully, authorize with a server-owned bearer secret and shut down cleanly, with integration tests proving real loopback HTTP round trips.

### In Scope

- Add a small Node built-in `node:http` listener adapter in the CLI/application composition layer; do not add a web framework dependency merely to bridge Node HTTP to the verified Fetch host.
- Preserve the existing `aal-acme-runtime/1`, `aal-acme-adapter/3` and reviewed engine pin carried by `ACME_RUNTIME_DESCRIPTOR`.
- Read listener configuration from explicit server environment variables with fail-closed validation.
- Require a non-empty server-owned bearer token; never emit it in logs, errors, descriptors or responses.
- Bind only to an explicitly configured host and port. Support port `0` for hermetic integration tests, but production/service startup must not silently invent a public binding.
- Translate request method, URL, headers, abort/cancellation and bounded request body to the existing Fetch-compatible `createAcmeRuntimeFetchHandler` boundary.
- Translate status, headers and body from Fetch `Response` back to Node HTTP without reclassifying engine/application results.
- Provide deterministic lifecycle primitives for start/listen and graceful close so tests and service managers can own process lifecycle.
- Add a runnable CLI/service entry point or package script that starts the listener only when all required runtime service configuration is valid.
- Keep model/provider and persistence composition explicit. If a real `/v1/execute` service composition needs credentials or durable storage not present in CI, expose dependency injection/factory seams and test with deterministic injected engine dependencies rather than silently falling back to a model or persistence backend.
- Document listener configuration, security boundary and what remains undeployed.

### Out of Scope

- No cloud deployment resource, Netlify/Vercel/Cloudflare project creation, container platform choice, DNS, TLS certificate or public URL.
- No secret creation/rotation service and no credential committed to Git.
- No OAuth, Google, Microsoft, Fortnox or other provider integration.
- No scheduler/cron creation.
- No application-side runtime URL/token configuration.
- No ReviewItem materialization or customer/job/quote/invoice mutation.
- No changes to `packages/core` semantics or Rickard/upstream.
- No repinning of the reviewed AAL v3 engine boundary merely because upstream contains newer Evidence-only work.
- No hidden default provider/model selection and no automatic in-memory production fallback.

### Definition of Done

- A Node HTTP listener can start on loopback with port `0`, expose the verified compatibility endpoint and close without leaked handles.
- Real HTTP `GET /v1/compatibility` round-trip returns the same verified runtime descriptor as the Fetch host.
- Real HTTP `POST /v1/execute` round-trip reaches an injected deterministic `ExecutionEngine` and preserves a terminal engine result.
- Missing/invalid bearer authorization is refused before engine invocation.
- Missing/invalid required listener configuration fails before binding a socket.
- Request cancellation/disconnect is propagated to the Fetch boundary/engine cancellation signal where technically observable.
- Request body limits remain bounded and cannot be bypassed by the Node bridge.
- Response status, repeated/set-cookie-safe headers where applicable and body bytes are forwarded without application reinterpretation.
- Service startup does not log or return the bearer secret.
- The runnable service path has an explicit composition contract for model/provider and durable repository requirements; CI tests do not depend on a live external model.
- `packages/core` source remains unchanged.
- `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/JOURNAL.md` and `docs/FILESTRUCTURE.md` if topology changes accurately describe the runnable-but-not-deployed state.
- Canonical engine CI passes `docs:check`, formatting, lint, typecheck, boundaries, unit, conformance, integration, deterministic scenarios, build and PostgreSQL before merge.
- The merged `main` tree is verified again by canonical CI.

### Minimum Verification Gates

- [x] Focused Node listener unit/integration tests.
- [x] Loopback HTTP compatibility round-trip.
- [x] Loopback HTTP execute round-trip with deterministic injected engine dependencies.
- [x] Unauthorized request proves zero engine invocations.
- [x] Invalid configuration proves no socket bind.
- [x] Body bound and abort/cancellation regression tests.
- [x] `pnpm docs:check`.
- [x] `pnpm format:check`.
- [x] `pnpm lint`.
- [x] `pnpm typecheck`.
- [x] `pnpm boundaries`.
- [x] `pnpm test:unit`.
- [x] `pnpm test:conformance`.
- [x] `pnpm test:integration`.
- [x] `pnpm test:scenario`.
- [x] `pnpm build`.
- [x] `pnpm test:postgres` in the canonical PostgreSQL job.
- [ ] Final PR canonical CI and post-merge `main` canonical CI.

## References

- Verified runtime Fetch host: `apps/cli/src/aal-runtime-host.ts`.
- Frozen runtime wire/descriptor: `apps/cli/src/aal-runtime-wire.ts`.
- CLI composition root: `apps/cli/src/composition.ts`.
- Existing CLI entry point: `apps/cli/src/main.ts` and `apps/cli/src/run.ts`.
- ACME-0149 completion: `docs/finished/ACME-0149_felix-aal-v3-runtime-host.md`.
- Canonical verified-descriptor run: `32074066197`.
- ACME-0149 merge: `7c550433cdab3a760814571fe558fc9ca1ae5d76`.
- Post-merge engine main run: `32075087880`.
- Rickard upstream remains at `15f58536b7beb15d9bfdb67f6117eea7adfa0dc6` at task freeze, already contained in the Felix verified base.

## Checklist

- [x] Detect the upstream `ACME-0152` identity collision before merge and move this Felix-local work to `FELIX-ACME-0001` without changing scope or implementation.
- [x] Freeze listener/composition charter before behavior changes.
- [x] Design listener API and fail-closed environment schema around existing Fetch host.
- [x] Implement Node HTTP bridge and lifecycle.
- [x] Implement explicit runnable service composition/entry point without hidden provider or storage fallbacks.
- [x] Add focused and loopback HTTP tests.
- [x] Run focused checks and repair only evidenced failures. Canonical run `32078164500` passed after repairing the real oversized-body transport hang.
- [x] Synchronize status/system/journal/filestructure; no new ADR is required because the Node listener is the transport adapter already frozen by this task, not a new engine/core authority.
- [ ] Run full canonical CI on clean PR head and merge only when green.
- [ ] Verify merged `main` with canonical CI.
- [ ] Archive task and restore task template only after all required evidence is green.

## Decisions and Notes

- Use Node's built-in HTTP stack for the transport bridge unless implementation evidence proves it insufficient. This avoids introducing a framework dependency for a narrow translation layer.
- The existing Fetch host remains the policy/auth/protocol/application boundary; the Node listener is a transport adapter, not a second runtime contract.
- Production deployment and TLS are intentionally separate because this repository currently has no approved hosting target or secret distribution mechanism.
- A checkpoint after each step or substep is required. Checklist and status documents must remain aligned with actual behavior.

## Charter Amendment Log

- 2026-08-18: identity only. The initially selected `ACME-0152` collides with Rickard/upstream Evidence V2 history. Scope, Goal and Definition of Done are unchanged; Felix-local task identity is now `FELIX-ACME-0001`.

## Verification

- [x] Focused listener tests.
- [x] Full canonical `verify` job — run `32078164500`.
- [x] Canonical PostgreSQL job — run `32078164500`.
- [ ] Post-merge `main` gate.
- [ ] Any skipped check is explicitly documented with reason; no skipped required gate may be called passed.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` — listener/service files and loopback tests added
- [ ] ADR only if implementation introduces a new long-lived architectural decision beyond the frozen transport-adapter boundary

## Handoff and Follow-ups

- Current state: listener/service implementation is complete on `felix-acme-0001-runtime-listener`. Canonical run `32078164500` passed `verify` and PostgreSQL after a real loopback regression exposed and then proved the fix for unconsumed oversized request bodies. The service is runnable but not deployed.
- Next recommended step: run canonical CI again on the final documentation-inclusive PR head, merge only if both jobs pass, verify merged `main`, then archive this task.
- Blockers: none for listener implementation. Public deployment remains intentionally out of scope.
- Child tasks: none yet.
- Resume condition: continue from branch `felix-acme-0001-runtime-listener`.
- Open questions: final hosting target, TLS termination, secret distribution and application runtime configuration belong to a later deployment task.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore the task template.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes, supersede this task instead of rewriting it.
