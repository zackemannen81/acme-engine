import { canonicalJson, sha256 } from '@acme/core';
import {
  EvidenceSecurityAuditEventSchema,
  type EvidenceArtifactRepresentation,
} from '@acme/evidence-artifacts';

import type {
  EvidenceArtifactAuditContext,
  EvidenceArtifactService,
} from './artifact-service.js';
import {
  EVIDENCE_REDACTION_TRANSFORMATION_VERSION,
  EVIDENCE_SYNTHETIC_ATTESTATION_VERSION,
  EVIDENCE_SYNTHETIC_TEXT_DATA_CLASS,
  EvidenceRedactionDraftSchema,
  EvidenceRedactionLogSchema,
  EvidenceTextImportMetadataSchema,
  EvidenceTextImportRecordSchema,
  applyEvidenceRedactions,
  buildImportedSourceArtifactVersion,
  validateEvidenceTextImport,
  type EvidenceRedactionDraft,
  type EvidenceRedactionOperation,
  type EvidenceTextImportMetadata,
  type EvidenceTextImportRecord,
} from './ingestion.js';
import type {
  EvidenceProductClock,
  EvidenceProductRepository,
} from './repository.js';
import type { EvidenceCaseObjectScope } from './schemas.js';

export interface EvidenceIngestionIds {
  next(
    kind:
      | 'logical-artifact'
      | 'text-import'
      | 'redaction-draft'
      | 'redaction-log'
      | 'security-audit',
  ): string;
}

export interface EvidenceIngestionService {
  importText(input: {
    readonly organizationId: string;
    readonly scope: EvidenceCaseObjectScope;
    readonly metadata: EvidenceTextImportMetadata;
    readonly bytes: Uint8Array;
    readonly audit: EvidenceArtifactAuditContext;
  }): Promise<EvidenceTextImportRecord>;
  cancelTextImport(input: {
    readonly scope: EvidenceCaseObjectScope;
    readonly importId: string;
    readonly audit: EvidenceArtifactAuditContext;
  }): Promise<EvidenceTextImportRecord>;
  putRedactionDraft(input: {
    readonly organizationId: string;
    readonly scope: EvidenceCaseObjectScope;
    readonly draftId?: string;
    readonly predecessorRepresentationId: string;
    readonly expectedRepresentationRevision: number;
    readonly policyReference: string;
    readonly operations: readonly EvidenceRedactionOperation[];
    readonly audit: EvidenceArtifactAuditContext;
  }): Promise<EvidenceRedactionDraft>;
  applyRedaction(input: {
    readonly scope: EvidenceCaseObjectScope;
    readonly draftId: string;
    readonly commandKey: string;
    readonly audit: EvidenceArtifactAuditContext;
  }): Promise<import('./ingestion.js').EvidenceRedactionLog>;
}

export function createEvidenceIngestionService(options: {
  readonly repository: EvidenceProductRepository;
  readonly artifacts: EvidenceArtifactService;
  readonly clock: EvidenceProductClock;
  readonly ids: EvidenceIngestionIds;
}): EvidenceIngestionService {
  const appendAudit = async (
    scope: EvidenceCaseObjectScope,
    audit: EvidenceArtifactAuditContext,
    action: 'import.activated' | 'redaction.draft' | 'redaction.applied',
    resourceKind: 'case' | 'artifact-representation',
    resourceId: string,
    afterDigest: string | null,
  ) =>
    options.repository.appendSecurityAudit(
      EvidenceSecurityAuditEventSchema.parse({
        schemaVersion: 'evidence-security-audit-event/1',
        auditEventId: options.ids.next('security-audit'),
        organizationId: audit.organizationId,
        caseId: scope.caseId,
        principalRef: audit.principalRef,
        action,
        outcome: 'succeeded',
        reasonCode:
          action === 'import.activated'
            ? 'SYNTHETIC_TEXT_IMPORT_ACTIVATED'
            : action === 'redaction.draft'
              ? 'REDACTION_DRAFT_SAVED'
              : 'REDACTION_APPLIED',
        resourceKind,
        resourceId,
        requestId: audit.requestId,
        policyVersion: audit.policyVersion,
        keyId: null,
        keyVersion: null,
        beforeDigest: null,
        afterDigest,
        occurredAt: options.clock.now(),
      }),
      scope,
    );

  return {
    async importText(input) {
      const metadata = EvidenceTextImportMetadataSchema.parse(input.metadata);
      const validated = validateEvidenceTextImport(
        input.bytes,
        metadata.declaredMediaType,
      );
      const snapshot = await options.repository.caseSnapshot(
        input.scope.caseId,
        input.scope.workspaceId,
      );
      const commandDigest = sha256(
        canonicalJson({
          metadata: metadata as never,
          originalSha256: validated.originalSha256,
          canonicalSha256: validated.canonicalSha256,
        }),
      );
      const existingImport = snapshot.textImports.find(
        (item) => item.commandKey === metadata.commandKey,
      );
      if (existingImport !== undefined) {
        if (existingImport.commandDigest !== commandDigest)
          throw new Error('IMPORT_COMMAND_COLLISION');
        if (existingImport.state === 'activated') return existingImport;
        if (existingImport.state === 'cancelled')
          throw new Error('IMPORT_CANCELLED');
      }
      const acceptedLastHour = snapshot.textImports.filter(
        (item) =>
          item.organizationId === input.organizationId &&
          item.state === 'activated' &&
          Date.parse(item.createdAt) >=
            Date.parse(options.clock.now()) - 3_600_000,
      ).length;
      if (acceptedLastHour >= 20) throw new Error('IMPORT_RATE_LIMIT');
      const activeSources = snapshot.sources;
      if (activeSources.length >= 1_000) throw new Error('CASE_VERSION_LIMIT');
      const logicalArtifactId =
        existingImport?.logicalArtifactId ??
        (metadata.intent.kind === 'create'
          ? `ART-${sha256(
              canonicalJson({
                caseId: input.scope.caseId,
                commandKey: metadata.commandKey,
              }),
            )
              .slice(0, 32)
              .toUpperCase()}`
          : metadata.intent.logicalArtifactId);
      const versions = activeSources.filter(
        (item) => item.logicalArtifactId === logicalArtifactId,
      );
      if (
        metadata.intent.kind === 'create' &&
        new Set(activeSources.map((item) => item.logicalArtifactId)).size >= 200
      )
        throw new Error('CASE_ARTIFACT_LIMIT');
      if (versions.length >= 20) throw new Error('ARTIFACT_VERSION_LIMIT');
      if (
        metadata.intent.kind === 'new-version' &&
        metadata.intent.expectedArtifactRevision !== versions.length
      )
        throw new Error('ARTIFACT_REVISION_CONFLICT');
      const predecessorVersionId =
        metadata.intent.kind === 'new-version'
          ? metadata.intent.predecessorVersionId
          : null;
      const predecessor =
        predecessorVersionId === null
          ? undefined
          : versions.find(
              (item) => item.artifactVersionId === predecessorVersionId,
            );
      if (metadata.intent.kind === 'new-version' && predecessor === undefined)
        throw new Error('PREDECESSOR_UNAVAILABLE');
      const resumedSource =
        existingImport === undefined
          ? undefined
          : snapshot.sources.find(
              (item) =>
                item.artifactVersionId === existingImport.artifactVersionId,
            );
      const source =
        resumedSource ??
        buildImportedSourceArtifactVersion({
          workspaceId: input.scope.workspaceId,
          logicalArtifactId,
          versionOrdinal: versions.length + 1,
          kind: metadata.artifactKind,
          title: metadata.title,
          canonicalText: validated.canonicalText,
          predecessorVersionId: predecessor?.artifactVersionId ?? null,
          correctionReason:
            predecessor === undefined ? null : 'transcription-correction',
        });
      const originalCommandKey = `${metadata.commandKey}:original`;
      await options.artifacts.secureSource({
        source,
        scope: input.scope,
        commandKey: originalCommandKey,
        audit: input.audit,
        representation: {
          kind: 'original',
          plaintext: validated.originalBytes,
          predecessorRepresentationId: null,
          transformationContract: 'received-exact-bytes/1',
          transformationVersion: '1',
        },
      });
      const afterOriginal = await options.repository.caseSnapshot(
        input.scope.caseId,
        input.scope.workspaceId,
      );
      const original = afterOriginal.artifactRepresentations.find(
        (item) =>
          item.artifactVersionId === source.artifactVersionId &&
          item.kind === 'original',
      );
      if (original === undefined) throw new Error('ORIGINAL_ACTIVATION_FAILED');
      const stagedAt = options.clock.now();
      const stagingRecord = EvidenceTextImportRecordSchema.parse({
        schemaVersion: 'evidence-text-import-record/1',
        importId:
          existingImport?.importId ??
          `text-import-${sha256(canonicalJson({ caseId: input.scope.caseId, commandKey: metadata.commandKey }))}`,
        organizationId: input.organizationId,
        caseId: input.scope.caseId,
        workspaceId: input.scope.workspaceId,
        logicalArtifactId,
        artifactVersionId: source.artifactVersionId,
        commandKey: metadata.commandKey,
        commandDigest,
        dataClass: EVIDENCE_SYNTHETIC_TEXT_DATA_CLASS,
        attestationVersion: EVIDENCE_SYNTHETIC_ATTESTATION_VERSION,
        originalRepresentationId: original.representationId,
        canonicalRepresentationId:
          existingImport?.canonicalRepresentationId ??
          `pending-canonical-${validated.canonicalSha256}`,
        originalSha256: validated.originalSha256,
        canonicalSha256: validated.canonicalSha256,
        originalByteLength: validated.originalBytes.byteLength,
        canonicalByteLength: validated.canonicalBytes.byteLength,
        principalRef: input.audit.principalRef,
        policyVersion: input.audit.policyVersion,
        state: 'staging',
        reasonCode: null,
        createdAt: existingImport?.createdAt ?? stagedAt,
        updatedAt: stagedAt,
      });
      await options.repository.putTextImport(stagingRecord, input.scope);
      const cancellationCheck = await options.repository.caseSnapshot(
        input.scope.caseId,
        input.scope.workspaceId,
      );
      if (
        cancellationCheck.textImports.find(
          (item) => item.importId === stagingRecord.importId,
        )?.state === 'cancelled'
      )
        throw new Error('IMPORT_CANCELLED');
      await options.artifacts.secureSource({
        source,
        scope: input.scope,
        commandKey: `${metadata.commandKey}:canonical`,
        audit: input.audit,
        representation: {
          kind: 'canonical-text',
          plaintext: validated.canonicalBytes,
          predecessorRepresentationId: original.representationId,
          transformationContract: 'evidence-text-canonicalization-1',
          transformationVersion: '1',
        },
      });
      const after = await options.repository.caseSnapshot(
        input.scope.caseId,
        input.scope.workspaceId,
      );
      const canonical = after.artifactRepresentations.find(
        (item) =>
          item.artifactVersionId === source.artifactVersionId &&
          item.kind === 'canonical-text',
      );
      if (canonical === undefined)
        throw new Error('CANONICAL_ACTIVATION_FAILED');
      const now = options.clock.now();
      const record = EvidenceTextImportRecordSchema.parse({
        ...stagingRecord,
        canonicalRepresentationId: canonical.representationId,
        state: 'activated',
        updatedAt: now,
      });
      await options.repository.putTextImport(record, input.scope);
      const workspace = after.workspaces.find(
        (item) => item.workspaceId === input.scope.workspaceId,
      );
      if (workspace !== undefined)
        await options.repository.advanceEvidenceRevision(
          input.scope.workspaceId,
          workspace.evidenceRevision,
          workspace.evidenceRevision + 1,
        );
      await appendAudit(
        input.scope,
        input.audit,
        'import.activated',
        'case',
        input.scope.caseId,
        validated.canonicalSha256,
      );
      return record;
    },

    async cancelTextImport(input) {
      const snapshot = await options.repository.caseSnapshot(
        input.scope.caseId,
        input.scope.workspaceId,
      );
      const record = snapshot.textImports.find(
        (item) => item.importId === input.importId,
      );
      if (record === undefined) throw new Error('IMPORT_UNAVAILABLE');
      if (record.state === 'activated')
        throw new Error('IMPORT_ALREADY_ACTIVATED');
      if (record.state === 'cancelled') return record;
      const cancelled = EvidenceTextImportRecordSchema.parse({
        ...record,
        state: 'cancelled',
        reasonCode: 'CANCEL_REQUESTED',
        updatedAt: options.clock.now(),
      });
      await options.repository.putTextImport(cancelled, input.scope);
      await options.repository.appendSecurityAudit(
        EvidenceSecurityAuditEventSchema.parse({
          schemaVersion: 'evidence-security-audit-event/1',
          auditEventId: options.ids.next('security-audit'),
          organizationId: input.audit.organizationId,
          caseId: input.scope.caseId,
          principalRef: input.audit.principalRef,
          action: 'import.cancelled',
          outcome: 'succeeded',
          reasonCode: 'IMPORT_CANCEL_REQUESTED',
          resourceKind: 'case',
          resourceId: input.scope.caseId,
          requestId: input.audit.requestId,
          policyVersion: input.audit.policyVersion,
          keyId: null,
          keyVersion: null,
          beforeDigest: record.commandDigest,
          afterDigest: null,
          occurredAt: options.clock.now(),
        }),
        input.scope,
      );
      return cancelled;
    },

    async putRedactionDraft(input) {
      const snapshot = await options.repository.caseSnapshot(
        input.scope.caseId,
        input.scope.workspaceId,
      );
      const representation = snapshot.artifactRepresentations.find(
        (item) =>
          item.representationId === input.predecessorRepresentationId &&
          (item.kind === 'canonical-text' || item.kind === 'redacted-text'),
      );
      if (representation === undefined)
        throw new Error('REDACTION_PREDECESSOR_UNAVAILABLE');
      const existing =
        input.draftId === undefined
          ? undefined
          : snapshot.redactionDrafts.find(
              (item) => item.draftId === input.draftId,
            );
      const now = options.clock.now();
      const draft = EvidenceRedactionDraftSchema.parse({
        schemaVersion: 'evidence-redaction-draft/1',
        draftId: input.draftId ?? options.ids.next('redaction-draft'),
        organizationId: input.organizationId,
        caseId: input.scope.caseId,
        workspaceId: input.scope.workspaceId,
        predecessorRepresentationId: representation.representationId,
        expectedRepresentationRevision: input.expectedRepresentationRevision,
        policyReference: input.policyReference,
        operations: input.operations,
        authorPrincipalRef: input.audit.principalRef,
        state: 'draft',
        revision: existing === undefined ? 0 : existing.revision + 1,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      await options.repository.putRedactionDraft(draft, input.scope);
      await appendAudit(
        input.scope,
        input.audit,
        'redaction.draft',
        'artifact-representation',
        representation.representationId,
        null,
      );
      return draft;
    },

    async applyRedaction(input) {
      const snapshot = await options.repository.caseSnapshot(
        input.scope.caseId,
        input.scope.workspaceId,
      );
      const draft = snapshot.redactionDrafts.find(
        (item) => item.draftId === input.draftId && item.state === 'draft',
      );
      if (draft === undefined) throw new Error('REDACTION_DRAFT_UNAVAILABLE');
      const representation = snapshot.artifactRepresentations.find(
        (item) => item.representationId === draft.predecessorRepresentationId,
      );
      if (representation === undefined)
        throw new Error('REDACTION_PREDECESSOR_UNAVAILABLE');
      const revision = snapshot.artifactLifecycle.filter(
        (item) => item.representationId === representation.representationId,
      ).length;
      if (revision !== draft.expectedRepresentationRevision)
        throw new Error('REDACTION_REVISION_CONFLICT');
      const predecessorSource = snapshot.sources.find(
        (item) => item.artifactVersionId === representation.artifactVersionId,
      );
      if (predecessorSource === undefined)
        throw new Error('REDACTION_SOURCE_UNAVAILABLE');
      const hydrated = await options.artifacts.readSource({
        snapshot,
        source: predecessorSource,
        scope: input.scope,
        audit: input.audit,
      });
      const predecessorBytes = new TextEncoder().encode(hydrated.text);
      const redactedBytes = applyEvidenceRedactions(
        predecessorBytes,
        draft.operations,
      );
      const redactedText = new TextDecoder('utf-8', { fatal: true }).decode(
        redactedBytes,
      );
      const ordinal =
        Math.max(
          ...snapshot.sources
            .filter(
              (item) =>
                item.logicalArtifactId === predecessorSource.logicalArtifactId,
            )
            .map((item) => item.versionOrdinal),
        ) + 1;
      const derivedSource = buildImportedSourceArtifactVersion({
        workspaceId: input.scope.workspaceId,
        logicalArtifactId: predecessorSource.logicalArtifactId,
        versionOrdinal: ordinal,
        kind: predecessorSource.kind,
        title: `${predecessorSource.title} — redacted`,
        canonicalText: redactedText,
        predecessorVersionId: predecessorSource.artifactVersionId,
        correctionReason: 'redaction-derivative',
      });
      await options.artifacts.secureSource({
        source: derivedSource,
        scope: input.scope,
        commandKey: input.commandKey,
        audit: input.audit,
        representation: {
          kind: 'redacted-text',
          plaintext: redactedBytes,
          predecessorRepresentationId: representation.representationId,
          transformationContract: EVIDENCE_REDACTION_TRANSFORMATION_VERSION,
          transformationVersion: '1',
        },
      });
      const after = await options.repository.caseSnapshot(
        input.scope.caseId,
        input.scope.workspaceId,
      );
      const derivedRepresentation = after.artifactRepresentations.find(
        (item) =>
          item.artifactVersionId === derivedSource.artifactVersionId &&
          item.kind === 'redacted-text',
      ) as EvidenceArtifactRepresentation | undefined;
      if (derivedRepresentation === undefined)
        throw new Error('REDACTION_ACTIVATION_FAILED');
      const appliedAt = options.clock.now();
      const log = EvidenceRedactionLogSchema.parse({
        schemaVersion: 'evidence-redaction-log/1',
        redactionLogId: options.ids.next('redaction-log'),
        organizationId: draft.organizationId,
        caseId: input.scope.caseId,
        workspaceId: input.scope.workspaceId,
        draftId: draft.draftId,
        commandKey: input.commandKey,
        predecessorRepresentationId: representation.representationId,
        derivedRepresentationId: derivedRepresentation.representationId,
        predecessorArtifactVersionId: predecessorSource.artifactVersionId,
        derivedArtifactVersionId: derivedSource.artifactVersionId,
        predecessorSha256: sha256(predecessorBytes),
        resultSha256: sha256(redactedBytes),
        operations: draft.operations,
        transformationVersion: EVIDENCE_REDACTION_TRANSFORMATION_VERSION,
        principalRef: input.audit.principalRef,
        policyVersion: input.audit.policyVersion,
        appliedAt,
      });
      const appliedDraft = EvidenceRedactionDraftSchema.parse({
        ...draft,
        state: 'applied',
        revision: draft.revision + 1,
        updatedAt: appliedAt,
      });
      await options.repository.applyRedaction(appliedDraft, log, input.scope);
      await appendAudit(
        input.scope,
        input.audit,
        'redaction.applied',
        'artifact-representation',
        derivedRepresentation.representationId,
        log.resultSha256,
      );
      return log;
    },
  };
}
