# Evidence artifact operations

## Authority and boundary

This runbook operates ADR-0037's synthetic-only secure artifact subsystem. It
does not authorize arbitrary or non-synthetic input. PostgreSQL contains
immutable representation/envelope metadata and content-free audit events; the
private object store contains ciphertext only; KEKs remain mounted secret
files outside both stores.

## Startup and reconciliation

Hosted startup refuses unless `ACME_HOSTED=1`, `ACME_ARTIFACT_STORE=s3`, all S3
settings and either `ACME_ARTIFACT_KEK_FILE` or
`ACME_ARTIFACT_KEK_MANIFEST` are present. Startup runs a bounded reconciliation
for the provisioned case. Expired unactivated staging is deleted and marked
`quarantined`; a missing or digest-mismatched active object records an
integrity failure and aborts startup.

The KEK file is one base64-encoded 32-byte value. A rotation manifest is a JSON
array whose paths are container-visible mounted secrets:

```json
[
  { "keyId": "evidence-kek", "keyVersion": 1, "path": "/run/secrets/evidence_artifact_kek_v1" },
  { "keyId": "evidence-kek", "keyVersion": 2, "path": "/run/secrets/evidence_artifact_kek_v2" }
]
```

Never log, copy into environment variables, commit or back up the decoded key.

## KEK rotation

1. Create and mount the new 32-byte base64 KEK without removing the old one.
2. Add both versions to the manifest; set `ACME_ARTIFACT_KEK_VERSION` to the new
   version and restart. Startup must succeed with both versions available.
3. As a case admin, `GET /api/cases/{caseId}/artifacts` and POST each
   representation to `/api/cases/{caseId}/artifacts/{representationId}` with
   same-origin cookies and CSRF header. Re-wrap changes only the wrapped DEK,
   key id/version, lifecycle and audit; ciphertext digest and Evidence identity
   must remain unchanged.
4. Re-fetch the administration view and verify every live representation uses
   the new version. Exercise source read and deterministic assessment export.
5. Run and retain a verified backup manifest. Only then remove the old KEK from
   the runtime manifest. Keep old key material according to the separately
   approved backup-retention policy.

## Revisioned deletion

`GET /api/cases/{caseId}/artifacts` returns each representation's
`lifecycleRevision`. A case admin sends `DELETE` to the representation endpoint
with same-origin cookies, CSRF header and JSON:

```json
{ "reason": "Approved synthetic-data disposal", "expectedRevision": 1 }
```

The service atomically records `deletion-requested` before touching the object;
the representation becomes unreadable immediately. It then deletes and
verifies absence before appending the irreversible `deleted` tombstone. A stale
revision is refused. Metadata, lifecycle and content-free audit remain.

## Backup and isolated restore

Back up these three authorities as a coordinated set: PostgreSQL, ciphertext
bucket and every KEK version referenced by a live envelope. Generate the
versioned backup manifest from the case snapshot. It pins every live object
key, byte length, ciphertext SHA-256 and KEK id/version, plus all deletion
tombstones and its own canonical digest.

Restore into an isolated database, bucket and key mount. Before allowing any
traffic, run `verifyEvidenceArtifactRestore` against that manifest. Verification
must fail for a changed manifest, missing/mismatched object, missing KEK or a
tombstoned representation reintroduced as live. Then run the normal startup
reconciliation and an authorized synthetic source read. Never test restore in
the production bucket.

## Audit inspection

Case admins can read content-free events at
`GET /api/cases/{caseId}/security-audit`. The endpoint itself is authorization
gated and returns no source text, object keys, nonces, wrapped DEKs or secret
values. Successful and denied reads, staging, activation, integrity failures,
quarantine, re-wrap, deletion and exports carry server-derived principals,
request ids, policy versions and digests only.

## Synthetic import and redaction recovery

`EvidenceTextImportRecord/1`, artifact staging metadata and object ciphertext
form the durable recovery evidence. If a process stops before canonical
activation, resubmit the exact same case, command key, metadata, attestation
and document bytes. The deterministic logical id plus recorded encryption
envelope resume the staged command without creating a second logical artifact;
any changed hash or metadata is a command collision. Never reconstruct an
original from canonical text or a canonical source from a redacted derivative.

A cooperative cancel is valid only before activation. It marks the durable
import record `cancelled`; reconciliation later quarantines any expired staged
object. Activation is immutable and cannot be rolled back by cancellation.
Redaction recovery likewise resubmits the same draft id, frozen operation list,
expected predecessor revision and apply command key. An applied log is
append-only and contains hashes, intervals and policy references but no removed
text. After recovery, verify both original and canonical envelopes, the
redacted derivative if present, source navigation, security audit and backup
manifest before reopening the case.
