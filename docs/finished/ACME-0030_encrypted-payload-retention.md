# Current Task

Task ID: ACME-0030
Parent Task: None
Status: Complete
Owner: Grok
Created: 2026-08-01
Last updated: 2026-08-01
Charter frozen at: 2026-08-01

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0014-live-provider-boundary-and-transport-port.md`
- `docs/adr/0016-encrypted-payload-retention.md`
- `docs/backlog/encrypted-payload-retention.md`
- `packages/core/src/repository-model-call.ts`
- `packages/core/src/execution-engine.ts` (replay path)
- `packages/adapter-memory/src/repository.ts` (`completeModelCall`)
- `packages/adapter-sqlite/src/repository.ts` (`completeModelCall`)
- `packages/testing/src/repository-conformance.ts`

## Task Summary

A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

`encrypted-payload` retention currently stores plaintext
`NormalizedModelResponse` in both repository adapters. The field
`protectedResponse` is never populated. After live provider success
(ACME-0028/0029), retaining real responses without encryption is dishonest,
and `hash-only` cannot replay.

ADR-0016 records the decided boundary. This task implements it: a core
`PayloadEncryptor` port, adapter-side encrypt-on-write / decrypt-on-read for
`encrypted-payload`, a simple symmetric encryptor for composition roots, and
conformance plus durable raw-storage proof that cleartext never rests.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Make `retention: 'encrypted-payload'` mean ciphertext at rest with transparent
replay when the key is available, without putting keys or key lifecycle in
core and without letting adapters invent retention policy.

### Primary Deliverable

A working encrypted-payload path across both repository adapters, driven by an
injected `PayloadEncryptor`, with cleartext `response` absent at rest,
`protectedResponse` holding the envelope, and `replayVerify()` succeeding or
degrading to `unavailable` according to key availability.

### In Scope

- Accept and implement ADR-0016 (already decided; this task is the build).
- Define `PayloadEncryptor` (exact export name finalized in code) in
  `@acme/core`: encrypt/decrypt of a plaintext JSON payload to/from an
  envelope (`ciphertext`, `iv`, `authTag`, `keyId`, `algorithm`). Core
  holds no keys and reads no environment.
- Repository adapters (`@acme/adapter-memory`, `@acme/adapter-sqlite`) accept
  the encryptor at construction. On `completeModelCall` when
  `execution.policy.retention === 'encrypted-payload'`:
  - encrypt the validated plaintext response
  - persist `responseHash` and `protectedResponse` (envelope as string /
    canonical JSON)
  - do **not** persist cleartext `response`
  On evidence/load paths used by replay, decrypt into `response` when
  possible; if decrypt fails, leave `response` absent so replay reports
  `unavailable` (details may name key unavailability).
- A composition-friendly `SymmetricKeyEncryptor` (package location decided
  during implementation: adapter helper or small crypto adapter) that takes
  key material from the caller—not from core env reads.
- Wire tests and, if natural, CLI composition to supply an encryptor when
  exercising encrypted retention. No requirement to change live-gate default
  retention in this task unless it is a one-line honest switch after proofs.
- Shared repository conformance: both adapters must handle
  `encrypted-payload` identically under a test encryptor (ciphertext at rest,
  replay with key, unavailable without key).
- Durable storage proof: under SQLite, a raw SQL (or equivalent row) assertion
  that stored columns contain neither the cleartext JSON response nor other
  obvious plaintext payload fields.
- Documentation: SYSTEMDOC, CURRENT_STATUS, JOURNAL, FILESTRUCTURE; update
  ADR-0014 follow-up language once live may use encrypted retention; mark
  backlog proposal resolved.
- Optional diagnostic enrichment for missing keys (still `unavailable`).

### Out of Scope

- Full KMS / Vault / multi-region key lifecycle.
- Automatic key rotation jobs or re-encrypt-in-place of historical rows.
- Encrypting `protectedRequest` or non-model-call artifacts.
- Changing `hash-only` or `none` semantics.
- Ambiguous model-call reconciliation against provider history.
- Domain Test UI, evaluation harness, outbox drain, fault injection.
- New live spend beyond existing opt-in gates (no new paid provider charter).
- Renaming `encrypted-payload` to a temporary dishonest alias.

### Definition of Done

- Both adapters, given the same encryptor and policy, store only the envelope
  under `encrypted-payload` and expose decrypted `response` on read when the
  key works.
- Raw SQLite inspection proves no cleartext response body at rest.
- `replayVerify()` returns `match` (or equivalent success path for an
  unchanged offline fixture execution) when the key is present.
- `replayVerify()` returns `unavailable` when the encryptor cannot decrypt
  (key removed / wrong key / unknown `keyId`).
- Shared repository conformance covers encrypted-payload for memory and
  SQLite without weakening other cases.
- `responseHash` still digests plaintext; existing hash-only goldens remain
  valid where retention is unchanged.
- No key material appears in core, modules, committed fixtures, logs or
  ledger fields beyond opaque `keyId`.
- ADR-0016, SYSTEMDOC, CURRENT_STATUS and JOURNAL reflect the implemented
  behavior; backlog item marked resolved.
- All frozen verification gates pass, or every skip is recorded with reason.

### Minimum Verification Gates

- [x] `pnpm docs:check`
- [x] `pnpm format:check`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm boundaries`
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance`
- [x] `pnpm test:integration`
- [x] `pnpm test:scenario`
- [x] `pnpm build`
- [x] `git diff --check`
- [x] Raw SQLite ciphertext-at-rest assertion in an automated test
- [x] Replay-with-key and replay-without-key automated tests

## References

- `docs/adr/0016-encrypted-payload-retention.md`
- `docs/backlog/encrypted-payload-retention.md`
- `docs/adr/0014-live-provider-boundary-and-transport-port.md`
- `packages/core/src/repository-model-call.ts`
- `packages/testing/src/repository-conformance.ts`
- `packages/adapter-memory/src/repository.ts`
- `packages/adapter-sqlite/src/repository.ts`

## Checklist

- [x] Freeze charter to `Ready` after review (explicit approval).
- [x] Land `PayloadEncryptor` port in core (+ tests for type/contract only).
- [x] Implement envelope codec and `SymmetricKeyEncryptor`
      (`createAes256GcmPayloadEncryptor` in core).
- [x] Memory adapter: encrypt on write, decrypt on read, no cleartext store.
- [x] SQLite adapter: same behavior + raw row assertion test.
- [x] Extend repository conformance for encrypted-payload + encryptor.
- [x] Replay with key / without key integration or conformance coverage.
- [x] Wire composition roots/tests that use encrypted-payload to inject keys.
- [x] Update ADR-0014 follow-up, SYSTEMDOC, CURRENT_STATUS, FILESTRUCTURE.
- [x] Resolve backlog proposal; JOURNAL; archive ACME-0030 when Done.

## Decisions and Notes

- A checkpoint after each step or substep is required. Checklist is therefore
  updated along the work and `CURRENT_STATUS.md` is always updated when changes
  affect the behavior.
- **Decided (ADR-0016):** encryptor injected into adapters; core defines port
  only; composition owns keys.
- **Decided:** `protectedResponse` = encrypted envelope; cleartext `response`
  not stored under `encrypted-payload`.
- **Decided:** replay works when key available; otherwise `unavailable`.
- **Decided:** build encryption now; do not rename the mode.
- Existing field is `protectedResponse?: string` and cleartext field is
  `response`, not `rawResponse`. Envelope is stored as a string (canonical
  JSON of the envelope object) unless implementation shows a typed field is
  required—prefer the existing string slot to limit contract churn.
- Today's adapter bug/feature: `retainPayload` stores **plaintext** `response`.
  That branch must flip to envelope-only.
- Engine `completeModelCall` today passes plaintext `response` and never sets
  `protectedResponse`. Prefer keeping engine dumb: adapter encrypts from the
  plaintext it receives and drops cleartext from the durable record. Avoid
  teaching the engine about envelopes unless conformance forces it.
- `responseHash` remains over plaintext at completion time (engine already
  computes it before `completeModelCall`).
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- none

## Verification

- [x] Ciphertext at rest (memory snapshot + SQLite raw row).
- [x] Decrypt-on-read restores equivalent `NormalizedModelResponse`.
- [x] Replay match with key; unavailable without key.
- [x] Conformance parity memory vs SQLite.
- [x] Boundaries: core has no crypto SDK / env key loading.
- [x] Record exact test counts; document skips.

Evidence: unit 345 / 42 files; conformance 50 / 7; integration 13 / 2;
scenario 19 / 3; docs:check, format, lint, typecheck, boundaries, build.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADR-0014 follow-up once live may use encrypted retention
- [x] ADR-0016 remains the decision record (amend only if implementation
      forces a semantic correction)
- [x] `docs/backlog/encrypted-payload-retention.md` marked resolved

## Handoff and Follow-ups

- Current state: **Complete**. Encrypted-payload seals at rest; replay
  decrypts with key; missing encryptor fails at complete; missing key on load
  leaves response absent → replay unavailable.
- Next recommended step: Archive; optional follow-up charter for live-gate
  default to encrypted-payload + KMS-backed encryptor, and for temperature
  gating so reasoning models (e.g. gpt-5.6-terra) work without model switch.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: **Resolved at freeze (2026-08-01):**
  1. `createAes256GcmPayloadEncryptor` lives in `@acme/core` as a pure helper
     (like `nodeHashing`): caller supplies key material; core never reads env.
  2. Missing-key path uses only details on
     `REPLAY_MODEL_RESPONSE_UNAVAILABLE` (no new error code).
  3. Encryptor is optional at repository construction; required only when
     `retention === 'encrypted-payload'` (fail loud at complete if missing).

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
