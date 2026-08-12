import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_PRODUCT_CHANGE_SET_SCHEMA_VERSION,
  effectiveReviewDecision,
  recordReviewDecision,
  type EvidenceProductRepository,
} from '@acme/evidence-product-contracts';
import {
  buildEvidencePrimarySourceReviewView,
  buildEvidencePrimaryWorkQueueView,
  scanPrimaryViewVocabulary,
} from '@acme/evidence-views';
import {
  evidenceObserveArtifactTask,
  createEvidenceChangeSet,
  type EvidenceObservation,
} from '@acme/module-evidence';

import {
  developmentObserveArtifactInput,
  developmentObserveArtifactOutput,
} from './development-observe.js';

const timestamp = '2026-08-11T10:00:00.000Z';

async function developmentObservations(): Promise<
  readonly EvidenceObservation[]
> {
  const result = await evidenceObserveArtifactTask.interpret(
    developmentObserveArtifactOutput(),
    developmentObserveArtifactInput(),
    {
      executionId: 'execution-product-conformance',
      entityId: 'workspace-conformance',
      now: timestamp,
      state: null,
      memories: [],
      documents: [],
    },
  );
  return result.memories.map(({ value }) => value as EvidenceObservation);
}

async function seed(repository: EvidenceProductRepository) {
  const input = developmentObserveArtifactInput();
  const observations = await developmentObservations();
  await repository.putWorkspace({
    schemaVersion: 'evidence-workspace/1',
    workspaceId: 'workspace-conformance',
    label: 'Synthetic conformance review',
    dataPolicy: 'synthetic-only',
    evidenceRevision: 0,
    createdAt: timestamp,
  });
  await repository.putSource(input.artifactVersion);
  await repository.putObservations(observations);
  await repository.advanceEvidenceRevision('workspace-conformance', 0, 1);
  return { input, observations };
}

export function evidenceProductRepositoryConformance(options: {
  readonly createRepository: () => EvidenceProductRepository;
}): void {
  describe('Evidence product repository conformance', () => {
    it('stores immutable sources and observations idempotently', async () => {
      const repository = options.createRepository();
      const { input, observations } = await seed(repository);
      await repository.putSource(input.artifactVersion);
      await repository.putObservations(observations);
      const snapshot = await repository.snapshot();
      expect(snapshot.sources).toHaveLength(1);
      expect(snapshot.observations).toHaveLength(2);
      expect(snapshot.workspaces[0]?.evidenceRevision).toBe(1);
    });

    it('keeps decisions append-only, idempotent and deterministically ordered', async () => {
      const repository = options.createRepository();
      const { observations } = await seed(repository);
      const target = observations[0];
      if (target === undefined)
        throw new Error('Missing development observation.');
      let id = 0;
      const ids = { next: () => `review-${String(++id)}` };
      const command = {
        schemaVersion: 'evidence-review-command/1' as const,
        workspaceId: 'workspace-conformance',
        commandKey: 'decision-command-1',
        targetKind: 'observation' as const,
        targetVersionId: target.observationId,
        action: 'accept' as const,
        reviewerRef: 'local-reviewer',
        rationale: 'Exact source quote confirmed.',
        basisEvidenceRevision: null,
      };
      const first = await recordReviewDecision(
        repository,
        command,
        { now: () => '2026-08-11T10:01:00.000Z' },
        ids,
      );
      expect(
        await recordReviewDecision(
          repository,
          command,
          { now: () => '2026-08-11T10:02:00.000Z' },
          ids,
        ),
      ).toEqual(first);
      await expect(
        recordReviewDecision(
          repository,
          { ...command, rationale: 'Divergent reuse.' },
          { now: () => '2026-08-11T10:03:00.000Z' },
          ids,
        ),
      ).rejects.toMatchObject({ code: 'EVIDENCE_PRODUCT_COMMAND_COLLISION' });
      const second = await recordReviewDecision(
        repository,
        {
          ...command,
          commandKey: 'decision-command-2',
          action: 'reject',
          rationale: 'A later exact-version decision.',
        },
        { now: () => '2026-08-11T10:04:00.000Z' },
        ids,
      );
      const snapshot = await repository.snapshot();
      expect(snapshot.reviewDecisions).toEqual([first, second]);
      expect(
        effectiveReviewDecision(
          snapshot.reviewDecisions,
          command.targetVersionId,
        ),
      ).toEqual(second);
    });

    it('persists immutable change sets idempotently and rejects divergent command reuse', async () => {
      const repository = options.createRepository();
      const { input, observations } = await seed(repository);
      const record = {
        schemaVersion: EVIDENCE_PRODUCT_CHANGE_SET_SCHEMA_VERSION,
        workspaceId: 'workspace-conformance',
        commandKey: 'change-set-command-1',
        recordedAt: timestamp,
        changeSet: createEvidenceChangeSet({
          fromEvidenceRevision: 0,
          toEvidenceRevision: 1,
          addedArtifactVersionIds: [input.artifactVersion.artifactVersionId],
          addedObservationIds: observations.map(
            ({ observationId }) => observationId,
          ),
          addedRelationIds: [],
          addedOpenQuestionIds: [],
          standingChanges: observations.map(({ observationId }) => ({
            objectId: observationId,
            from: null,
            to: 'current',
          })),
          actorReferenceKeys: [],
          relationEndpointIds: [],
          temporalBounds: [],
        }),
      } as const;
      expect(await repository.putChangeSet(record)).toEqual(record);
      expect(await repository.putChangeSet(record)).toEqual(record);
      await expect(
        repository.putChangeSet({
          ...record,
          changeSet: createEvidenceChangeSet({
            ...record.changeSet,
            addedObservationIds: [],
          }),
        }),
      ).rejects.toMatchObject({ code: 'EVIDENCE_PRODUCT_COMMAND_COLLISION' });
      expect((await repository.snapshot()).changeSets).toEqual([record]);
    });
  });
}

export function evidencePrimaryViewConformance(options: {
  readonly createRepository: () => EvidenceProductRepository;
}): void {
  describe('Evidence primary view conformance', () => {
    it('builds detached deterministic source-first views with clean vocabulary', async () => {
      const repository = options.createRepository();
      const { input } = await seed(repository);
      const snapshot = await repository.snapshot();
      const queue = buildEvidencePrimaryWorkQueueView({
        workspaceId: 'workspace-conformance',
        snapshot,
      });
      const source = buildEvidencePrimarySourceReviewView({
        workspaceId: 'workspace-conformance',
        artifactVersionId: input.artifactVersion.artifactVersionId,
        snapshot,
      });
      expect(queue.nextItems).toHaveLength(2);
      expect(
        source.observations.map(({ citation }) => citation.display),
      ).toEqual(['[DEV-T01@v1:L4-L4]', '[DEV-T01@v1:L6-L6]']);
      expect(scanPrimaryViewVocabulary({ queue, source })).toEqual([]);
      expect(Object.isFrozen(queue)).toBe(true);
      expect(Object.isFrozen(source.observations)).toBe(true);
      const rebuilt = buildEvidencePrimarySourceReviewView({
        workspaceId: 'workspace-conformance',
        artifactVersionId: input.artifactVersion.artifactVersionId,
        snapshot,
      });
      expect(rebuilt).toEqual(source);
      expect(rebuilt).not.toBe(source);
    });
  });
}

export function evidenceIngestionRepositoryConformance(options: {
  readonly createRepository: () => EvidenceProductRepository;
}): void {
  describe('evidence ingestion repository conformance', () => {
    it('persists case-scoped import and atomically freezes an applied redaction log', async () => {
      const repository = options.createRepository();
      const scope = {
        caseId: 'case-ingestion-conformance',
        workspaceId: 'workspace-ingestion-conformance',
        boundAt: timestamp,
      } as const;
      await repository.putWorkspace(
        {
          schemaVersion: 'evidence-workspace/1',
          workspaceId: scope.workspaceId,
          label: 'Synthetic ingestion conformance',
          dataPolicy: 'synthetic-only',
          evidenceRevision: 0,
          createdAt: timestamp,
        },
        scope,
      );
      const record = {
        schemaVersion: 'evidence-text-import-record/1' as const,
        importId: 'import-conformance-1',
        organizationId: 'organization-conformance',
        caseId: scope.caseId,
        workspaceId: scope.workspaceId,
        logicalArtifactId: 'ART-CONFORMANCE',
        artifactVersionId: 'evidence_artifact_' + '1'.repeat(64),
        commandKey: 'import-command-conformance-1',
        commandDigest: '2'.repeat(64),
        dataClass: 'synthetic-utf8-plain-text/1' as const,
        attestationVersion: 'evidence-synthetic-attestation/1' as const,
        originalRepresentationId: 'representation-original-conformance',
        canonicalRepresentationId: 'representation-canonical-conformance',
        originalSha256: '3'.repeat(64),
        canonicalSha256: '4'.repeat(64),
        originalByteLength: 10,
        canonicalByteLength: 10,
        principalRef: 'principal-conformance',
        policyVersion: 'policy-conformance/1',
        state: 'activated' as const,
        reasonCode: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await repository.putTextImport(record, scope);
      const operation = {
        schemaVersion: 'evidence-redaction-operation/1' as const,
        operationId: 'operation-conformance-1',
        ordinal: 1,
        startByte: 0,
        endByte: 1,
        removedBytesSha256: '5'.repeat(64),
        reasonCode: 'personal-data' as const,
        rationale: null,
        replacementVersion: 'evidence-redaction-token/1' as const,
      };
      const draft = {
        schemaVersion: 'evidence-redaction-draft/1' as const,
        draftId: 'draft-conformance-1',
        organizationId: record.organizationId,
        caseId: scope.caseId,
        workspaceId: scope.workspaceId,
        predecessorRepresentationId: record.canonicalRepresentationId,
        expectedRepresentationRevision: 1,
        policyReference: 'policy-reference-conformance/1',
        operations: [operation],
        authorPrincipalRef: record.principalRef,
        state: 'draft' as const,
        revision: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await repository.putRedactionDraft(draft, scope);
      const applied = { ...draft, state: 'applied' as const, revision: 1 };
      const log = {
        schemaVersion: 'evidence-redaction-log/1' as const,
        redactionLogId: 'redaction-log-conformance-1',
        organizationId: record.organizationId,
        caseId: scope.caseId,
        workspaceId: scope.workspaceId,
        draftId: draft.draftId,
        commandKey: 'redaction-command-conformance-1',
        predecessorRepresentationId: record.canonicalRepresentationId,
        derivedRepresentationId: 'representation-redacted-conformance',
        predecessorArtifactVersionId: record.artifactVersionId,
        derivedArtifactVersionId: 'evidence_artifact_' + '6'.repeat(64),
        predecessorSha256: record.canonicalSha256,
        resultSha256: '7'.repeat(64),
        operations: [operation],
        transformationVersion: 'evidence-redaction-transform/1' as const,
        principalRef: record.principalRef,
        policyVersion: record.policyVersion,
        appliedAt: timestamp,
      };
      await repository.applyRedaction(applied, log, scope);
      const snapshot = await repository.caseSnapshot(
        scope.caseId,
        scope.workspaceId,
      );
      expect(snapshot.textImports).toEqual([record]);
      expect(snapshot.redactionDrafts).toEqual([applied]);
      expect(snapshot.redactionLogs).toEqual([log]);
      await expect(
        repository.applyRedaction(
          applied,
          { ...log, resultSha256: '8'.repeat(64) },
          scope,
        ),
      ).rejects.toThrow();
    });
  });
}
