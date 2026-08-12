import { Buffer } from 'node:buffer';

import { canonicalJson, sha256 } from '@acme/core';
import {
  EvidenceArtifactBackupManifestSchema,
  EvidenceArtifactLifecycleEventSchema,
  EvidenceArtifactRepresentationSchema,
  EvidenceArtifactStagingSchema,
  EvidenceSecurityAuditEventSchema,
  artifactSha256,
  decryptArtifactRepresentation,
  encryptArtifactRepresentation,
  recreateStagedArtifactCiphertext,
  rewrapArtifactEnvelope,
  type EvidenceArtifactKeyProvider,
  type EvidenceArtifactObjectStore,
  type EvidenceArtifactRandom,
  type EvidenceArtifactBackupManifest,
  type EvidenceArtifactRepresentation,
  type EvidenceSecurityAuditEvent,
} from '@acme/evidence-artifacts';
import {
  SourceArtifactVersionSchema,
  type SourceArtifactVersion,
} from '@acme/module-evidence';

import type {
  EvidenceProductClock,
  EvidenceProductRepository,
  EvidenceArtifactReadAuditContext,
} from './repository.js';
import {
  EVIDENCE_ENCRYPTED_SOURCE_PLACEHOLDER,
  type EvidenceCaseObjectScope,
  type EvidenceProductSnapshot,
} from './schemas.js';

export interface EvidenceArtifactIds {
  next(
    kind:
      | 'artifact-object'
      | 'artifact-staging'
      | 'artifact-lifecycle'
      | 'security-audit',
  ): string;
}

export type EvidenceArtifactAuditContext = EvidenceArtifactReadAuditContext;

export interface EvidenceArtifactService {
  recordExport(input: {
    readonly scope: EvidenceCaseObjectScope;
    readonly audit: EvidenceArtifactAuditContext;
    readonly exportSha256: string;
  }): Promise<void>;
  recordDeniedRead(input: {
    readonly scope: EvidenceCaseObjectScope;
    readonly audit: EvidenceArtifactAuditContext;
    readonly reasonCode: string;
  }): Promise<void>;
  secureSource(input: {
    readonly source: SourceArtifactVersion;
    readonly scope: EvidenceCaseObjectScope;
    readonly commandKey: string;
    readonly audit: EvidenceArtifactAuditContext;
    readonly representation?: {
      readonly kind: EvidenceArtifactRepresentation['kind'];
      readonly plaintext: Uint8Array;
      readonly predecessorRepresentationId: string | null;
      readonly transformationContract: string;
      readonly transformationVersion: string;
    };
  }): Promise<SourceArtifactVersion>;
  readSource(input: {
    readonly snapshot: EvidenceProductSnapshot;
    readonly source: SourceArtifactVersion;
    readonly scope: EvidenceCaseObjectScope;
    readonly audit: EvidenceArtifactAuditContext;
  }): Promise<SourceArtifactVersion>;
  rewrap(input: {
    readonly representationId: string;
    readonly scope: EvidenceCaseObjectScope;
    readonly audit: EvidenceArtifactAuditContext;
  }): Promise<void>;
  delete(input: {
    readonly representationId: string;
    readonly scope: EvidenceCaseObjectScope;
    readonly reason: string;
    readonly expectedRevision: number;
    readonly audit: EvidenceArtifactAuditContext;
  }): Promise<void>;
  reconcile(input: {
    readonly scope: EvidenceCaseObjectScope;
    readonly now: string;
    readonly audit: EvidenceArtifactAuditContext;
  }): Promise<{
    readonly quarantined: number;
    readonly integrityFailures: number;
  }>;
}

function representationId(
  caseId: string,
  artifactVersionId: string,
  kind: EvidenceArtifactRepresentation['kind'] = 'canonical-text',
  plaintextSha256?: string,
): string {
  return `evidence-representation-${sha256(
    canonicalJson(
      kind === 'canonical-text' && plaintextSha256 === undefined
        ? {
            schemaVersion: 'evidence-representation-identity/1',
            caseId,
            artifactVersionId,
            kind,
          }
        : {
            schemaVersion: 'evidence-representation-identity/1',
            caseId,
            artifactVersionId,
            kind,
            plaintextSha256: plaintextSha256 ?? '',
          },
    ),
  )}`;
}

function lifecycleLatest(
  snapshot: EvidenceProductSnapshot,
  id: string,
): 'active' | 'unreadable' {
  const events = snapshot.artifactLifecycle.filter(
    (item) => item.representationId === id,
  );
  if (
    events.some(
      (item) =>
        item.action === 'deletion-requested' || item.action === 'deleted',
    )
  )
    return 'unreadable';
  const last = events
    .sort(
      (a, b) =>
        a.occurredAt.localeCompare(b.occurredAt) ||
        a.lifecycleEventId.localeCompare(b.lifecycleEventId),
    )
    .at(-1);
  return last?.action === 'quarantined' ? 'unreadable' : 'active';
}

export function createEvidenceArtifactService(options: {
  readonly repository: EvidenceProductRepository;
  readonly objectStore: EvidenceArtifactObjectStore;
  readonly keyProvider: EvidenceArtifactKeyProvider;
  readonly clock: EvidenceProductClock;
  readonly ids: EvidenceArtifactIds;
  readonly random?: EvidenceArtifactRandom;
  readonly stagingLifetimeMs?: number;
}): EvidenceArtifactService {
  const stagingLifetimeMs = options.stagingLifetimeMs ?? 15 * 60 * 1000;
  const auditEvent = (
    context: EvidenceArtifactAuditContext,
    input: Omit<
      EvidenceSecurityAuditEvent,
      | 'schemaVersion'
      | 'auditEventId'
      | 'organizationId'
      | 'principalRef'
      | 'requestId'
      | 'policyVersion'
      | 'occurredAt'
    >,
  ): EvidenceSecurityAuditEvent =>
    EvidenceSecurityAuditEventSchema.parse({
      schemaVersion: 'evidence-security-audit-event/1',
      auditEventId: options.ids.next('security-audit'),
      organizationId: context.organizationId,
      principalRef: context.principalRef,
      requestId: context.requestId,
      policyVersion: context.policyVersion,
      occurredAt: options.clock.now(),
      ...input,
    });

  return {
    async recordExport(input) {
      await options.repository.appendSecurityAudit(
        auditEvent(input.audit, {
          caseId: input.scope.caseId,
          action: 'artifact.export',
          outcome: 'succeeded',
          reasonCode: 'REVIEWED_ASSESSMENT_EXPORTED',
          resourceKind: 'case',
          resourceId: input.scope.caseId,
          keyId: null,
          keyVersion: null,
          beforeDigest: null,
          afterDigest: input.exportSha256,
        }),
        input.scope,
      );
    },
    async recordDeniedRead(input) {
      await options.repository.appendSecurityAudit(
        auditEvent(input.audit, {
          caseId: input.scope.caseId,
          action: 'artifact.read-denied',
          outcome: 'denied',
          reasonCode: input.reasonCode,
          resourceKind: 'case',
          resourceId: input.scope.caseId,
          keyId: null,
          keyVersion: null,
          beforeDigest: null,
          afterDigest: null,
        }),
        input.scope,
      );
    },
    async secureSource(input) {
      const source = SourceArtifactVersionSchema.parse(input.source);
      const plaintext =
        input.representation?.plaintext ?? Buffer.from(source.text, 'utf8');
      const kind = input.representation?.kind ?? 'canonical-text';
      const id = representationId(
        input.scope.caseId,
        source.artifactVersionId,
        kind,
        input.representation === undefined
          ? undefined
          : artifactSha256(plaintext),
      );
      const existing = await options.repository.caseSnapshot(
        input.scope.caseId,
        input.scope.workspaceId,
      );
      const existingRepresentation = existing.artifactRepresentations.find(
        (item) => item.representationId === id,
      );
      if (existingRepresentation !== undefined) {
        if (
          existingRepresentation.artifactVersionId !==
            source.artifactVersionId ||
          existingRepresentation.plaintextByteLength !== plaintext.byteLength ||
          existingRepresentation.plaintextSha256 !== artifactSha256(plaintext)
        )
          throw new Error(
            'Artifact identity collides with different plaintext.',
          );
        return source;
      }
      const now = options.clock.now();
      let representation = EvidenceArtifactRepresentationSchema.parse({
        schemaVersion: 'evidence-artifact-representation/1',
        representationId: id,
        caseId: input.scope.caseId,
        workspaceId: input.scope.workspaceId,
        artifactVersionId: source.artifactVersionId,
        kind,
        mediaType: 'text/plain; charset=utf-8',
        plaintextSha256: artifactSha256(plaintext),
        plaintextByteLength: plaintext.byteLength,
        predecessorRepresentationId:
          input.representation?.predecessorRepresentationId ?? null,
        transformationContract:
          input.representation?.transformationContract ??
          'evidence-canonical-text/1',
        transformationVersion:
          input.representation?.transformationVersion ?? '1',
        producingCommandKey: input.commandKey,
        producingPrincipalRef: input.audit.principalRef,
        createdAt: now,
      });
      let objectKey = `cases/${options.ids.next('artifact-object')}`;
      let encrypted = await encryptArtifactRepresentation({
        representation,
        plaintext,
        objectKey,
        activatedAt: now,
        keyProvider: options.keyProvider,
        ...(options.random === undefined ? {} : { random: options.random }),
      });
      const priorStaging = existing.artifactStaging.find(
        (item) => item.commandKey === input.commandKey,
      );
      const staging = EvidenceArtifactStagingSchema.parse({
        schemaVersion: 'evidence-artifact-staging/1',
        stagingId: options.ids.next('artifact-staging'),
        caseId: input.scope.caseId,
        workspaceId: input.scope.workspaceId,
        representationId: id,
        objectKey,
        commandKey: input.commandKey,
        plaintextSha256: representation.plaintextSha256,
        state: 'staging',
        stagedAt: now,
        expiresAt: new Date(Date.parse(now) + stagingLifetimeMs).toISOString(),
        representation,
        pendingEnvelope: encrypted.envelope,
      });
      if (priorStaging !== undefined) {
        if (
          priorStaging.representationId !== id ||
          priorStaging.plaintextSha256 !== representation.plaintextSha256
        )
          throw new Error(
            'Artifact command key collides with different input.',
          );
        representation = priorStaging.representation;
        objectKey = priorStaging.objectKey;
        encrypted = {
          envelope: priorStaging.pendingEnvelope,
          ciphertext: await recreateStagedArtifactCiphertext({
            representation,
            envelope: priorStaging.pendingEnvelope,
            plaintext,
            keyProvider: options.keyProvider,
          }),
        };
      } else {
        const persistedStaging = await options.repository.stageArtifact(
          staging,
          auditEvent(input.audit, {
            caseId: input.scope.caseId,
            action: 'artifact.stage',
            outcome: 'succeeded',
            reasonCode: 'ARTIFACT_STAGED',
            resourceKind: 'artifact-representation',
            resourceId: id,
            keyId: encrypted.envelope.keyId,
            keyVersion: encrypted.envelope.keyVersion,
            beforeDigest: null,
            afterDigest: representation.plaintextSha256,
          }),
          input.scope,
        );
        if (persistedStaging.stagingId !== staging.stagingId) {
          representation = persistedStaging.representation;
          objectKey = persistedStaging.objectKey;
          encrypted = {
            envelope: persistedStaging.pendingEnvelope,
            ciphertext: await recreateStagedArtifactCiphertext({
              representation,
              envelope: persistedStaging.pendingEnvelope,
              plaintext,
              keyProvider: options.keyProvider,
            }),
          };
        }
      }
      const currentStat = await options.objectStore.stat(objectKey);
      if (currentStat === null) {
        let created;
        try {
          created = await options.objectStore.create(
            objectKey,
            encrypted.ciphertext,
          );
        } catch (error) {
          const raced = await options.objectStore.stat(objectKey);
          if (
            raced === null ||
            raced.sha256 !== encrypted.envelope.ciphertextSha256 ||
            raced.byteLength !== encrypted.envelope.ciphertextByteLength
          )
            throw error;
          created = raced;
        }
        if (
          created.sha256 !== encrypted.envelope.ciphertextSha256 ||
          created.byteLength !== encrypted.envelope.ciphertextByteLength
        )
          throw new Error(
            'Artifact store did not preserve uploaded ciphertext.',
          );
      } else if (
        currentStat.sha256 !== encrypted.envelope.ciphertextSha256 ||
        currentStat.byteLength !== encrypted.envelope.ciphertextByteLength
      )
        throw new Error(
          'Artifact staging object collides with different bytes.',
        );
      const placeholder = SourceArtifactVersionSchema.parse({
        ...source,
        text: EVIDENCE_ENCRYPTED_SOURCE_PLACEHOLDER,
      });
      await options.repository.activateArtifactSource(
        placeholder,
        representation,
        encrypted.envelope,
        EvidenceArtifactLifecycleEventSchema.parse({
          schemaVersion: 'evidence-artifact-lifecycle-event/1',
          lifecycleEventId: options.ids.next('artifact-lifecycle'),
          caseId: input.scope.caseId,
          workspaceId: input.scope.workspaceId,
          representationId: id,
          action: 'activated',
          reason: 'Verified encrypted canonical source activation.',
          principalRef: input.audit.principalRef,
          occurredAt: options.clock.now(),
          expectedRevision: null,
        }),
        auditEvent(input.audit, {
          caseId: input.scope.caseId,
          action: 'artifact.activate',
          outcome: 'succeeded',
          reasonCode: 'ARTIFACT_ACTIVATED',
          resourceKind: 'artifact-representation',
          resourceId: id,
          keyId: encrypted.envelope.keyId,
          keyVersion: encrypted.envelope.keyVersion,
          beforeDigest: null,
          afterDigest: encrypted.envelope.ciphertextSha256,
        }),
        input.scope,
      );
      return source;
    },

    async readSource(input) {
      const source = SourceArtifactVersionSchema.parse(input.source);
      if (source.text !== EVIDENCE_ENCRYPTED_SOURCE_PLACEHOLDER) return source;
      const representation = input.snapshot.artifactRepresentations.find(
        (item) =>
          item.artifactVersionId === source.artifactVersionId &&
          (item.kind === 'canonical-text' || item.kind === 'redacted-text'),
      );
      if (
        representation === undefined ||
        representation.caseId !== input.scope.caseId ||
        lifecycleLatest(input.snapshot, representation.representationId) !==
          'active'
      )
        throw new Error('Artifact representation is unavailable.');
      const envelope = input.snapshot.artifactEnvelopes.find(
        (item) => item.representationId === representation.representationId,
      );
      if (envelope === undefined)
        throw new Error('Artifact envelope is unavailable.');
      try {
        const ciphertext = await options.objectStore.read(
          envelope.objectKey,
          envelope.ciphertextByteLength,
        );
        const plaintext = await decryptArtifactRepresentation({
          representation,
          envelope,
          ciphertext,
          keyProvider: options.keyProvider,
        });
        await options.repository.appendSecurityAudit(
          auditEvent(input.audit, {
            caseId: input.scope.caseId,
            action: 'artifact.read',
            outcome: 'succeeded',
            reasonCode: 'ARTIFACT_READ_VERIFIED',
            resourceKind: 'artifact-representation',
            resourceId: representation.representationId,
            keyId: envelope.keyId,
            keyVersion: envelope.keyVersion,
            beforeDigest: envelope.ciphertextSha256,
            afterDigest: representation.plaintextSha256,
          }),
          input.scope,
        );
        return SourceArtifactVersionSchema.parse({
          ...source,
          text: Buffer.from(plaintext).toString('utf8'),
        });
      } catch (error) {
        await options.repository
          .appendSecurityAudit(
            auditEvent(input.audit, {
              caseId: input.scope.caseId,
              action: 'artifact.integrity-failed',
              outcome: 'failed',
              reasonCode: 'ARTIFACT_READ_INTEGRITY_FAILED',
              resourceKind: 'artifact-representation',
              resourceId: representation.representationId,
              keyId: envelope.keyId,
              keyVersion: envelope.keyVersion,
              beforeDigest: envelope.ciphertextSha256,
              afterDigest: null,
            }),
            input.scope,
          )
          .catch(() => undefined);
        throw error;
      }
    },

    async rewrap(input) {
      const snapshot = await options.repository.caseSnapshot(
        input.scope.caseId,
        input.scope.workspaceId,
      );
      const envelope = snapshot.artifactEnvelopes.find(
        (item) => item.representationId === input.representationId,
      );
      if (envelope === undefined)
        throw new Error('Artifact envelope is unavailable.');
      const next = await rewrapArtifactEnvelope({
        envelope,
        keyProvider: options.keyProvider,
      });
      await options.repository.updateArtifactEnvelope(
        next,
        EvidenceArtifactLifecycleEventSchema.parse({
          schemaVersion: 'evidence-artifact-lifecycle-event/1',
          lifecycleEventId: options.ids.next('artifact-lifecycle'),
          caseId: input.scope.caseId,
          workspaceId: input.scope.workspaceId,
          representationId: input.representationId,
          action: 'key-rewrapped',
          reason: 'DEK re-wrapped under active KEK.',
          principalRef: input.audit.principalRef,
          occurredAt: options.clock.now(),
          expectedRevision: null,
        }),
        auditEvent(input.audit, {
          caseId: input.scope.caseId,
          action: 'artifact.key-rewrap',
          outcome: 'succeeded',
          reasonCode: 'ARTIFACT_KEY_REWRAPPED',
          resourceKind: 'artifact-representation',
          resourceId: input.representationId,
          keyId: next.keyId,
          keyVersion: next.keyVersion,
          beforeDigest: envelope.ciphertextSha256,
          afterDigest: next.ciphertextSha256,
        }),
        input.scope,
      );
    },

    async delete(input) {
      if (input.reason.trim().length === 0)
        throw new Error('Deletion reason is required.');
      const snapshot = await options.repository.caseSnapshot(
        input.scope.caseId,
        input.scope.workspaceId,
      );
      const envelope = snapshot.artifactEnvelopes.find(
        (item) => item.representationId === input.representationId,
      );
      if (envelope === undefined)
        throw new Error('Artifact envelope is unavailable.');
      const currentRevision = snapshot.artifactLifecycle.filter(
        (item) => item.representationId === input.representationId,
      ).length;
      if (input.expectedRevision !== currentRevision)
        throw new Error('Artifact lifecycle revision conflict.');
      const event = (
        action: 'deletion-requested' | 'deleted',
        expectedRevision: number,
      ) =>
        EvidenceArtifactLifecycleEventSchema.parse({
          schemaVersion: 'evidence-artifact-lifecycle-event/1',
          lifecycleEventId: options.ids.next('artifact-lifecycle'),
          caseId: input.scope.caseId,
          workspaceId: input.scope.workspaceId,
          representationId: input.representationId,
          action,
          reason: input.reason,
          principalRef: input.audit.principalRef,
          occurredAt: options.clock.now(),
          expectedRevision,
        });
      await options.repository.appendArtifactLifecycle(
        event('deletion-requested', input.expectedRevision),
        auditEvent(input.audit, {
          caseId: input.scope.caseId,
          action: 'artifact.delete',
          outcome: 'succeeded',
          reasonCode: 'ARTIFACT_DELETION_REQUESTED',
          resourceKind: 'artifact-representation',
          resourceId: input.representationId,
          keyId: envelope.keyId,
          keyVersion: envelope.keyVersion,
          beforeDigest: envelope.ciphertextSha256,
          afterDigest: null,
        }),
        input.scope,
      );
      await options.objectStore.delete(envelope.objectKey);
      if ((await options.objectStore.stat(envelope.objectKey)) !== null)
        throw new Error('Artifact deletion could not be verified.');
      await options.repository.appendArtifactLifecycle(
        event('deleted', input.expectedRevision + 1),
        auditEvent(input.audit, {
          caseId: input.scope.caseId,
          action: 'artifact.delete',
          outcome: 'succeeded',
          reasonCode: 'ARTIFACT_DELETED_TOMBSTONED',
          resourceKind: 'artifact-representation',
          resourceId: input.representationId,
          keyId: envelope.keyId,
          keyVersion: envelope.keyVersion,
          beforeDigest: envelope.ciphertextSha256,
          afterDigest: null,
        }),
        input.scope,
      );
    },

    async reconcile(input) {
      const snapshot = await options.repository.caseSnapshot(
        input.scope.caseId,
        input.scope.workspaceId,
      );
      let quarantined = 0;
      let integrityFailures = 0;
      for (const staging of snapshot.artifactStaging) {
        const active = snapshot.artifactEnvelopes.some(
          (item) => item.representationId === staging.representationId,
        );
        if (!active && staging.expiresAt <= input.now) {
          await options.objectStore.delete(staging.objectKey);
          await options.repository.quarantineArtifactStaging(
            staging.stagingId,
            EvidenceArtifactLifecycleEventSchema.parse({
              schemaVersion: 'evidence-artifact-lifecycle-event/1',
              lifecycleEventId: options.ids.next('artifact-lifecycle'),
              caseId: input.scope.caseId,
              workspaceId: input.scope.workspaceId,
              representationId: staging.representationId,
              action: 'quarantined',
              reason: 'Expired unactivated staging metadata reconciled.',
              principalRef: input.audit.principalRef,
              occurredAt: options.clock.now(),
              expectedRevision: null,
            }),
            auditEvent(input.audit, {
              caseId: input.scope.caseId,
              action: 'artifact.quarantine',
              outcome: 'succeeded',
              reasonCode: 'ARTIFACT_STAGING_EXPIRED',
              resourceKind: 'artifact-representation',
              resourceId: staging.representationId,
              keyId: staging.pendingEnvelope.keyId,
              keyVersion: staging.pendingEnvelope.keyVersion,
              beforeDigest: staging.pendingEnvelope.ciphertextSha256,
              afterDigest: null,
            }),
            input.scope,
          );
          quarantined += 1;
        }
      }
      for (const envelope of snapshot.artifactEnvelopes) {
        if (lifecycleLatest(snapshot, envelope.representationId) !== 'active')
          continue;
        const object = await options.objectStore.stat(envelope.objectKey);
        if (
          object === null ||
          object.byteLength !== envelope.ciphertextByteLength ||
          object.sha256 !== envelope.ciphertextSha256
        )
          integrityFailures += 1;
      }
      if (quarantined > 0 || integrityFailures > 0)
        await options.repository.appendSecurityAudit(
          auditEvent(input.audit, {
            caseId: input.scope.caseId,
            action:
              integrityFailures > 0
                ? 'artifact.integrity-failed'
                : 'artifact.quarantine',
            outcome: integrityFailures > 0 ? 'failed' : 'succeeded',
            reasonCode: `RECONCILE_Q${quarantined}_I${integrityFailures}`,
            resourceKind: 'case',
            resourceId: input.scope.caseId,
            keyId: null,
            keyVersion: null,
            beforeDigest: null,
            afterDigest: null,
          }),
          input.scope,
        );
      return { quarantined, integrityFailures };
    },
  };
}

export function createEvidenceArtifactBackupManifest(input: {
  readonly snapshot: EvidenceProductSnapshot;
  readonly createdAt: string;
}): EvidenceArtifactBackupManifest {
  const tombstoned = new Set(
    input.snapshot.artifactLifecycle
      .filter((item) => item.action === 'deleted')
      .map((item) => item.representationId),
  );
  const objects = input.snapshot.artifactEnvelopes
    .filter((item) => !tombstoned.has(item.representationId))
    .map((item) => ({
      caseId: item.caseId,
      representationId: item.representationId,
      objectKey: item.objectKey,
      ciphertextSha256: item.ciphertextSha256,
      ciphertextByteLength: item.ciphertextByteLength,
      keyId: item.keyId,
      keyVersion: item.keyVersion,
    }))
    .sort((a, b) => a.representationId.localeCompare(b.representationId));
  const value = {
    schemaVersion: 'evidence-artifact-backup-manifest/1' as const,
    createdAt: input.createdAt,
    objects,
    tombstonedRepresentationIds: [...tombstoned].sort(),
  };
  return EvidenceArtifactBackupManifestSchema.parse({
    ...value,
    manifestSha256: sha256(canonicalJson(value)),
  });
}

export async function verifyEvidenceArtifactRestore(input: {
  readonly manifest: EvidenceArtifactBackupManifest;
  readonly objectStore: EvidenceArtifactObjectStore;
  readonly keyProvider: EvidenceArtifactKeyProvider;
}): Promise<void> {
  const manifest = EvidenceArtifactBackupManifestSchema.parse(input.manifest);
  const unsigned = {
    schemaVersion: manifest.schemaVersion,
    createdAt: manifest.createdAt,
    objects: manifest.objects,
    tombstonedRepresentationIds: manifest.tombstonedRepresentationIds,
  };
  if (sha256(canonicalJson(unsigned)) !== manifest.manifestSha256)
    throw new Error('Artifact backup manifest digest mismatch.');
  for (const object of manifest.objects) {
    const stat = await input.objectStore.stat(object.objectKey);
    if (
      stat === null ||
      stat.byteLength !== object.ciphertextByteLength ||
      stat.sha256 !== object.ciphertextSha256
    )
      throw new Error(
        `Artifact backup object ${object.representationId} is incomplete.`,
      );
    if (!(await input.keyProvider.hasKey(object.keyId, object.keyVersion)))
      throw new Error(
        `Artifact backup key ${object.keyId}/${object.keyVersion} is unavailable.`,
      );
  }
  for (const id of manifest.tombstonedRepresentationIds) {
    if (manifest.objects.some((item) => item.representationId === id))
      throw new Error(
        'Artifact tombstone was resurrected in the backup manifest.',
      );
  }
}

export function createSecureEvidenceProductRepository(input: {
  readonly repository: EvidenceProductRepository;
  readonly service: EvidenceArtifactService;
  readonly auditContext: (caseId: string) => EvidenceArtifactAuditContext;
}): EvidenceProductRepository {
  const hydrate = async (
    snapshot: EvidenceProductSnapshot,
    scope?: EvidenceCaseObjectScope,
  ): Promise<EvidenceProductSnapshot> => {
    if (scope === undefined) return snapshot;
    const sources: SourceArtifactVersion[] = [];
    for (const source of snapshot.sources) {
      if (source.text !== EVIDENCE_ENCRYPTED_SOURCE_PLACEHOLDER) {
        await input.service.secureSource({
          source,
          scope,
          commandKey: `legacy-secure-${source.artifactVersionId}`,
          audit: input.auditContext(scope.caseId),
        });
        sources.push(source);
      } else {
        sources.push(
          await input.service.readSource({
            snapshot,
            source,
            scope,
            audit: input.auditContext(scope.caseId),
          }),
        );
      }
    }
    return { ...snapshot, sources };
  };
  return {
    ...input.repository,
    async snapshot() {
      return input.repository.snapshot();
    },
    async caseSnapshot(caseId, workspaceId, audit) {
      const snapshot = await input.repository.caseSnapshot(caseId, workspaceId);
      const scope = {
        caseId,
        workspaceId,
        boundAt: new Date(0).toISOString(),
      };
      if (audit === undefined) return hydrate(snapshot, scope);
      const sources: SourceArtifactVersion[] = [];
      for (const source of snapshot.sources)
        sources.push(
          source.text === EVIDENCE_ENCRYPTED_SOURCE_PLACEHOLDER
            ? await input.service.readSource({ snapshot, source, scope, audit })
            : source,
        );
      return { ...snapshot, sources };
    },
    async putSource(source, scope) {
      if (scope === undefined) return input.repository.putSource(source);
      return input.service.secureSource({
        source,
        scope,
        commandKey: `secure-source-${source.artifactVersionId}`,
        audit: input.auditContext(scope.caseId),
      });
    },
  };
}
