# ADR 0016 — Encrypted payload retention

Status: Accepted

Date: 2026-08-01

Decision owners: ACME maintainers

## Context

`ExecutionPolicy.retention` already accepts
`'none' | 'hash-only' | 'encrypted-payload'`. Under `encrypted-payload` both
repository adapters retain the complete `NormalizedModelResponse` in clear
text. `ModelCallRecord.protectedResponse` exists and is carried through, but
nothing encrypts and nothing populates it.

`hash-only` avoids plaintext but makes `replayVerify()` report `unavailable`.
After ACME-0028/0029 a live provider success path exists. Storing a real
provider response without an honest confidentiality story is no longer
acceptable, and renaming the mode to postpone encryption only preserves a
false promise.

Constraints already fixed by architecture:

- core must not own key material, environment access or key lifecycle
- adapters must not invent retention policy; they honor
  `execution.policy.retention`
- ADR-0014 currently mandates `hash-only` for live executions until this
  decision is implemented

## Decision

### 1. Who encrypts, and where the boundary sits

Inject a **`PayloadEncryptor`** (name may be finalized at implementation)
into the repository adapters at composition time.

| Layer | Responsibility |
| --- | --- |
| **core** | Defines the `PayloadEncryptor` port only. No keys, no env, no KMS. |
| **repository adapters** | Receive an optional or required encryptor at construction. When `retention === 'encrypted-payload'`, encrypt immediately before write and decrypt on read when a plaintext response is required. |
| **composition root** (CLI, tests, future apps) | Owns key acquisition (env, Vault, KMS, …) and supplies the encryptor instance. |

Adapters do not choose *whether* to encrypt; the effective execution policy
does. They only apply the encryptor when that policy demands it.

A first implementation may ship a **`SymmetricKeyEncryptor`** (or equivalent)
that reads a key from a caller-supplied secret material object, not from
process environment inside core. The interface stays open for KMS-backed
implementations later.

### 2. What `protectedResponse` holds

On `encrypted-payload` completion:

- **`response`** (cleartext `NormalizedModelResponse`) is **not** retained in
  durable or in-memory storage. It is omitted / absent on the recorded call.
- **`protectedResponse`** holds the **encrypted envelope**, serialized so it
  fits the existing `protectedResponse?: string` field (canonical JSON of the
  envelope is the default mapping unless implementation proves a typed
  envelope field is required).

Envelope shape (normative intent):

```ts
{
  ciphertext: string;
  iv: string;
  authTag: string;
  keyId: string;
  algorithm: 'aes-256-gcm'; // or successor algorithm id
}
```

The plaintext model response must be unreachable from a raw database row or
in-memory snapshot without an explicit decrypt step through the encryptor.

`responseHash` continues to cover the **plaintext** normalized response, so
identity and replay comparison stay independent of ciphertext encoding.

### 3. Replay from a protected payload

**Yes.** `replayVerify()` must succeed when the encryptor can decrypt the
envelope for the stored `keyId`.

- With a working key: the repository returns evidence whose model-call
  `response` is the decrypted plaintext (transparent to `ExecutionEngine`).
  Replay proceeds as today.
- Without a key, wrong key, or unknown `keyId`: decrypt fails; the adapter
  does not invent plaintext. Replay reports `unavailable` with
  `REPLAY_MODEL_RESPONSE_UNAVAILABLE` (and may attach details that name
  key unavailability). A more specific diagnostic code such as
  `REPLAY_MODEL_RESPONSE_KEY_UNAVAILABLE` is allowed if it improves
  operator clarity without changing the `unavailable` status semantics.

If encrypted retention could not support replay, it would be only a costlier
`hash-only`. That is rejected.

### 4. Build encryption now; do not rename the mode

Implement the real mechanism before treating live `encrypted-payload`
retention as honest. Do not rename the mode to an intermediate
`unencrypted-payload` alias.

Until an encryptor is configured, composition roots that would store live
payloads must continue to use `hash-only` (ADR-0014). Once ACME-0030 lands,
live executions may use `encrypted-payload` when the root supplies an
encryptor.

## Alternatives Considered

### Encrypt in `ExecutionEngine` / core

- Benefits: one place to enforce policy.
- Costs: pulls crypto and failure modes into the kernel; keys risk leaking
  into core tests and ports.
- Reason not selected: core defines the port; composition owns keys.

### Encrypt only in SQLite, leave memory cleartext

- Benefits: smaller first slice.
- Costs: two retention semantics; conformance diverges; tests that use memory
  would not prove confidentiality.
- Reason not selected: both adapters must behave identically.

### Keep cleartext `response` and also store ciphertext

- Benefits: simpler reads.
- Costs: raw DB inspection still yields plaintext; the mode's name remains a
  lie.
- Reason not selected: cleartext must not be persisted under this mode.

### Accept `unavailable` replay under encryption

- Benefits: less work.
- Costs: mode becomes expensive `hash-only`.
- Reason not selected: replay is a project goal; encryption must not destroy
  it when the key is present.

## Consequences

### Positive

- Live payloads can be retained without cleartext at rest.
- Replay remains available when keys are present.
- Core stays free of key lifecycle; adapters stay free of policy invention.
- Conformance can require identical encryptor-driven behavior on every
  repository adapter.

### Negative

- Repository construction grows a crypto dependency at the composition edge.
- Lost or rotated keys make historical encrypted executions non-replayable
  (honest `unavailable`), which operators must understand.
- Envelope encoding and algorithm choice become compatibility surface.

### Follow-ups

- Key rotation, multi-key decrypt sets and KMS integration remain future
  work on the same port.
- Whether `protectedRequest` ever receives the same treatment is out of
  this decision.
- Live gate / CLI may switch default live retention from `hash-only` to
  `encrypted-payload` only after the encryptor is wired and tested.

## Compatibility and Migration

Existing fixtures and tests that use `encrypted-payload` today store
plaintext; they must be updated to supply an encryptor and assert ciphertext
at rest. `hash-only` and `none` behavior is unchanged. No migration of
historical plaintext `encrypted-payload` rows is defined; those rows were
never production live data.

## References

- [ADR-0014 live provider boundary](0014-live-provider-boundary-and-transport-port.md)
- [ACME-0030 encrypted payload retention (finished)](../finished/ACME-0030_encrypted-payload-retention.md)
