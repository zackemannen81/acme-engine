# Close the `encrypted-payload` retention gap

Status: **Resolved by ACME-0030**. Decisions in
[ADR-0016](../adr/0016-encrypted-payload-retention.md).

## Discovery context

Found while planning the live-provider deliverable, during ACME-0024, by
reading both repository adapters rather than by a failing test.

`ExecutionPolicy.retention` accepts `'none' | 'hash-only' | 'encrypted-payload'`.
Under `encrypted-payload` both `@acme/adapter-memory` and
`@acme/adapter-sqlite` retain the complete `NormalizedModelResponse` exactly as
supplied. `ModelCallRecord.protectedResponse` exists in the core contract and
is carried through faithfully, but nothing in the workspace ever populates it,
and no component encrypts anything.

Nothing delivered is wrong today: every retained payload so far is a
hand-written test fixture, and the mode's behavior is consistent across both
adapters and covered by the shared conformance suite. The gap is that the
mode's name promises confidentiality it does not provide.

## Why this matters now

`retention: 'hash-only'` is not an available workaround. Without a retained
response, `replayVerify()` reports `unavailable` with
`REPLAY_MODEL_RESPONSE_UNAVAILABLE`, which is asserted by the neutral
integration suite. So today a caller may retain a payload in clear text, or
keep it confidential and lose replay, but not both.

That trade is harmless against a scripted mock. It stops being harmless the
moment a real provider response is stored.

## Proposed outcome

An explicit decision, then whichever implementation it selects:

- define who encrypts and where the boundary sits, given that core must not
  gain a key lifecycle and adapters must not make policy decisions
- define what `protectedResponse` is for, since the contract already reserves
  it and the shape suggests an answer
- decide whether replay must work from a protected payload, or whether live
  executions accept `unavailable` replay by design
- if the mode cannot honestly be called `encrypted-payload` before encryption
  exists, rename it rather than leave the promise outstanding

## Why this is outside the active task

ACME-0024 is a documentation-reality task and changes no runtime behavior.
This proposal changes a public policy contract, touches both adapters and
needs a key-lifecycle decision, which `docs/CURRENT_STATUS.md` already records
as requiring a future ADR.

## Dependencies

- the live-provider ADR, which must confront this before any real payload is
  stored
- a key lifecycle decision, currently a deliberately deferred decision in
  `docs/SYSTEMDOC.md`

## Suggested verification

- a retained payload is unreadable in the durable database without the key
- `replayVerify()` behavior under each retention mode is asserted explicitly,
  including whichever outcome the decision selects for protected payloads
- the shared repository conformance suite covers the mode for every adapter
  without being weakened
- no key material reaches core, a module, the ledger or a log
