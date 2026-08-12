import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalJson } from '@acme/core';
import {
  EVIDENCE_PRODUCT_SNAPSHOT_SCHEMA_VERSION,
  EvidenceCaseObjectBindingSchema,
  createEvidenceCaseObjectBindings,
  assertEvidenceCaseScopedReferences,
  scopeEvidenceProductSnapshotByCase,
  EvidenceProductCommandCollisionError,
  EvidenceProductSnapshotSchema,
  EvidenceProductChangeSetSchema,
  EvidenceReviewDecisionRecordSchema,
  EvidenceWorkspaceSchema,
  type EvidenceProductJob,
  type EvidenceProductRepository,
  type EvidenceProductSnapshot,
  type EvidenceCaseObjectKind,
  type EvidenceCaseObjectScope,
  type EvidenceReviewDecision,
  EvidenceRedactionDraftSchema,
  EvidenceRedactionLogSchema,
  EvidenceTextImportRecordSchema,
  EvidenceReviewActivitySchema,
  EvidenceReviewAssignmentSchema,
  EvidenceReviewCommentSchema,
} from '@acme/evidence-product-contracts';
import {
  EvidenceAssessmentSchema,
  EvidenceObservationSchema,
  EvidenceOpenQuestionSchema,
  EvidenceRelationSchema,
  SourceArtifactVersionSchema,
} from '@acme/module-evidence';
import {
  EvidenceArtifactLifecycleEventSchema,
  EvidenceArtifactObjectEnvelopeSchema,
  EvidenceArtifactRepresentationSchema,
  EvidenceArtifactStagingSchema,
  EvidenceSecurityAuditEventSchema,
} from '@acme/evidence-artifacts';

function emptySnapshot(): EvidenceProductSnapshot {
  return EvidenceProductSnapshotSchema.parse({
    schemaVersion: EVIDENCE_PRODUCT_SNAPSHOT_SCHEMA_VERSION,
    workspaces: [],
    sources: [],
    observations: [],
    relations: [],
    openQuestions: [],
    assessments: [],
    changeSets: [],
    jobs: [],
    reviewDecisions: [],
    objectBindings: [],
    textImports: [],
    redactionDrafts: [],
    redactionLogs: [],
    reviewAssignments: [],
    reviewComments: [],
    reviewActivity: [],
  });
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function same(left: unknown, right: unknown): boolean {
  return canonicalJson(left as never) === canonicalJson(right as never);
}

function sameSourceMetadata(
  left: import('@acme/module-evidence').SourceArtifactVersion,
  right: import('@acme/module-evidence').SourceArtifactVersion,
): boolean {
  return same({ ...left, text: '' }, { ...right, text: '' });
}

function appendUnique<T>(
  values: readonly T[],
  value: T,
  id: (item: T) => string,
): T[] {
  const existing = values.find((item) => id(item) === id(value));
  if (existing !== undefined && !same(existing, value))
    throw new EvidenceProductCommandCollisionError(id(value));
  return existing === undefined ? [...values, value] : [...values];
}

function decisionCommand(value: EvidenceReviewDecision): unknown {
  return {
    workspaceId: value.workspaceId,
    targetKind: value.targetKind,
    targetVersionId: value.targetVersionId,
    action: value.action,
    actorRef:
      value.schemaVersion === 'evidence-review-decision/1'
        ? value.reviewerRef
        : value.principalRef,
    rationale: value.rationale,
    commandKey: value.commandKey,
    basisEvidenceRevision: value.basisEvidenceRevision,
  };
}

function attachBindings(
  snapshot: EvidenceProductSnapshot,
  scope: EvidenceCaseObjectScope | undefined,
  kind: EvidenceCaseObjectKind,
  values: readonly Record<string, unknown>[],
): EvidenceProductSnapshot {
  if (scope === undefined) return snapshot;
  const bindings = createEvidenceCaseObjectBindings(scope, kind, values);
  const next = [...snapshot.objectBindings];
  for (const binding of bindings) {
    const immutableCollision = next.find(
      (item) =>
        item.caseId === binding.caseId &&
        item.objectKind === binding.objectKind &&
        item.objectId === binding.objectId &&
        item.workspaceId !== binding.workspaceId,
    );
    if (immutableCollision !== undefined)
      throw new Error('Case object ownership cannot move workspaces.');
    if (
      !next.some(
        (item) =>
          item.caseId === binding.caseId &&
          item.workspaceId === binding.workspaceId &&
          item.objectKind === binding.objectKind &&
          item.objectId === binding.objectId,
      )
    )
      next.push(binding);
  }
  next.sort((a, b) =>
    `${a.caseId}\u0000${a.objectKind}\u0000${a.objectId}`.localeCompare(
      `${b.caseId}\u0000${b.objectKind}\u0000${b.objectId}`,
    ),
  );
  return { ...snapshot, objectBindings: next };
}

function attachExplicitBindings(
  snapshot: EvidenceProductSnapshot,
  bindings: readonly import('@acme/evidence-product-contracts').EvidenceCaseObjectBinding[],
): EvidenceProductSnapshot {
  let next = snapshot;
  for (const binding of bindings) {
    const existing = next.objectBindings.find(
      (item) =>
        item.caseId === binding.caseId &&
        item.objectKind === binding.objectKind &&
        item.objectId === binding.objectId,
    );
    if (existing !== undefined && existing.workspaceId !== binding.workspaceId)
      throw new Error('Case object ownership cannot move workspaces.');
    if (existing === undefined) {
      next = {
        ...next,
        objectBindings: [...next.objectBindings, binding].sort((a, b) =>
          `${a.caseId}\u0000${a.objectKind}\u0000${a.objectId}`.localeCompare(
            `${b.caseId}\u0000${b.objectKind}\u0000${b.objectId}`,
          ),
        ),
      };
    }
  }
  return next;
}

export function createFileEvidenceProductRepository(options: {
  readonly filePath: string;
}): EvidenceProductRepository {
  const filePath = path.resolve(options.filePath);
  let pending: Promise<void> = Promise.resolve();

  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const current = pending.then(operation);
    pending = current.then(
      () => undefined,
      () => undefined,
    );
    return current;
  }

  async function read(): Promise<EvidenceProductSnapshot> {
    try {
      const raw = JSON.parse(await readFile(filePath, 'utf8')) as Record<
        string,
        unknown
      >;
      return EvidenceProductSnapshotSchema.parse({
        relations: [],
        openQuestions: [],
        assessments: [],
        changeSets: [],
        objectBindings: [],
        textImports: [],
        redactionDrafts: [],
        redactionLogs: [],
        reviewAssignments: [],
        reviewComments: [],
        reviewActivity: [],
        ...raw,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return emptySnapshot();
      throw error;
    }
  }

  async function write(snapshot: EvidenceProductSnapshot): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.tmp`;
    await writeFile(temporary, `${canonicalJson(snapshot as never)}\n`, 'utf8');
    await rename(temporary, filePath);
  }

  async function mutate<T>(
    operation: (snapshot: EvidenceProductSnapshot) => {
      value: T;
      snapshot: EvidenceProductSnapshot;
    },
  ): Promise<T> {
    const output = await serialize(async () => {
      const result = operation(await read());
      const validated = EvidenceProductSnapshotSchema.parse(result.snapshot);
      const scopes = new Set(
        validated.objectBindings.map(
          (item) => `${item.caseId}\u0000${item.workspaceId}`,
        ),
      );
      for (const scope of scopes) {
        const [caseId, workspaceId] = scope.split('\u0000');
        if (caseId !== undefined && workspaceId !== undefined)
          assertEvidenceCaseScopedReferences(validated, caseId, workspaceId);
      }
      await write(validated);
      return result.value;
    });
    return clone(output);
  }

  return {
    async snapshot() {
      return clone(await serialize(read));
    },
    async caseSnapshot(caseId, workspaceId) {
      return clone(
        scopeEvidenceProductSnapshotByCase(
          await serialize(read),
          caseId,
          workspaceId,
        ),
      );
    },
    async bindCaseObjects(inputs) {
      const values = inputs.map((input) =>
        EvidenceCaseObjectBindingSchema.parse(input),
      );
      return mutate((snapshot) => {
        return {
          value: values,
          snapshot: attachExplicitBindings(snapshot, values),
        };
      });
    },
    async putTextImport(record, scope) {
      const value = EvidenceTextImportRecordSchema.parse(record);
      return mutate((snapshot) => {
        const existing = snapshot.textImports.find(
          (item) =>
            item.caseId === value.caseId &&
            item.commandKey === value.commandKey,
        );
        if (
          existing !== undefined &&
          existing.commandDigest !== value.commandDigest
        )
          throw new EvidenceProductCommandCollisionError(value.commandKey);
        const records = snapshot.textImports.filter(
          (item) => item.importId !== value.importId,
        );
        records.push(value);
        return {
          value,
          snapshot: attachBindings(
            {
              ...snapshot,
              textImports: records.sort((a, b) =>
                a.importId.localeCompare(b.importId),
              ),
            },
            scope,
            'text-import',
            [value as unknown as Record<string, unknown>],
          ),
        };
      });
    },
    async putRedactionDraft(draft, scope) {
      const value = EvidenceRedactionDraftSchema.parse(draft);
      return mutate((snapshot) => {
        const existing = snapshot.redactionDrafts.find(
          (item) => item.draftId === value.draftId,
        );
        if (existing !== undefined && existing.caseId !== value.caseId)
          throw new EvidenceProductCommandCollisionError(value.draftId);
        if (
          existing !== undefined &&
          value.revision !== existing.revision &&
          value.revision !== existing.revision + 1
        )
          throw new EvidenceProductCommandCollisionError(
            `redaction-revision:${value.draftId}`,
          );
        const drafts = snapshot.redactionDrafts.filter(
          (item) => item.draftId !== value.draftId,
        );
        drafts.push(value);
        return {
          value,
          snapshot: attachBindings(
            {
              ...snapshot,
              redactionDrafts: drafts.sort((a, b) =>
                a.draftId.localeCompare(b.draftId),
              ),
            },
            scope,
            'redaction-draft',
            [value as unknown as Record<string, unknown>],
          ),
        };
      });
    },
    async applyRedaction(draft, log, scope) {
      const draftValue = EvidenceRedactionDraftSchema.parse(draft);
      const logValue = EvidenceRedactionLogSchema.parse(log);
      return mutate((snapshot) => {
        const current = snapshot.redactionDrafts.find(
          (item) => item.draftId === draftValue.draftId,
        );
        if (
          current === undefined ||
          current.state !== 'draft' ||
          draftValue.state !== 'applied' ||
          current.revision + 1 !== draftValue.revision
        )
          throw new EvidenceProductCommandCollisionError(
            `redaction-apply:${draftValue.draftId}`,
          );
        if (
          logValue.caseId !== scope.caseId ||
          logValue.draftId !== draftValue.draftId ||
          !same(current.operations, logValue.operations)
        )
          throw new Error(
            'Applied redaction must use the frozen same-case operation list.',
          );
        const existing = snapshot.redactionLogs.find(
          (item) => item.commandKey === logValue.commandKey,
        );
        if (existing !== undefined && !same(existing, logValue))
          throw new EvidenceProductCommandCollisionError(logValue.commandKey);
        let next: EvidenceProductSnapshot = {
          ...snapshot,
          redactionDrafts: snapshot.redactionDrafts.map((item) =>
            item.draftId === draftValue.draftId ? draftValue : item,
          ),
          redactionLogs:
            existing === undefined
              ? [...snapshot.redactionLogs, logValue]
              : [...snapshot.redactionLogs],
        };
        next = attachBindings(next, scope, 'redaction-draft', [
          draftValue as unknown as Record<string, unknown>,
        ]);
        next = attachBindings(next, scope, 'redaction-log', [
          logValue as unknown as Record<string, unknown>,
        ]);
        return { value: existing ?? logValue, snapshot: next };
      });
    },
    async putReviewAssignment(assignment, activity, scope) {
      const value = EvidenceReviewAssignmentSchema.parse(assignment);
      const activityValue = EvidenceReviewActivitySchema.parse(activity);
      return mutate((snapshot) => {
        const current = snapshot.reviewAssignments.find(
          (item) => item.assignmentId === value.assignmentId,
        );
        if (
          current !== undefined &&
          (current.caseId !== value.caseId ||
            current.targetKind !== value.targetKind ||
            current.targetVersionId !== value.targetVersionId ||
            value.revision !== current.revision + 1)
        )
          throw new EvidenceProductCommandCollisionError(value.commandKey);
        const assignments = snapshot.reviewAssignments.filter(
          (item) => item.assignmentId !== value.assignmentId,
        );
        assignments.push(value);
        let next: EvidenceProductSnapshot = {
          ...snapshot,
          reviewAssignments: assignments.sort((a, b) =>
            a.assignmentId.localeCompare(b.assignmentId),
          ),
          reviewActivity: appendUnique(
            snapshot.reviewActivity,
            activityValue,
            (item) => item.activityId,
          ),
        };
        next = attachBindings(next, scope, 'review-assignment', [
          value as unknown as Record<string, unknown>,
        ]);
        next = attachBindings(next, scope, 'review-activity', [
          activityValue as unknown as Record<string, unknown>,
        ]);
        return { value, snapshot: next };
      });
    },
    async appendReviewComment(comment, activity, scope) {
      const value = EvidenceReviewCommentSchema.parse(comment);
      const activityValue = EvidenceReviewActivitySchema.parse(activity);
      return mutate((snapshot) => {
        let next: EvidenceProductSnapshot = {
          ...snapshot,
          reviewComments: appendUnique(
            snapshot.reviewComments,
            value,
            (item) => item.commentId,
          ),
          reviewActivity: appendUnique(
            snapshot.reviewActivity,
            activityValue,
            (item) => item.activityId,
          ),
        };
        next = attachBindings(next, scope, 'review-comment', [
          value as unknown as Record<string, unknown>,
        ]);
        next = attachBindings(next, scope, 'review-activity', [
          activityValue as unknown as Record<string, unknown>,
        ]);
        return { value, snapshot: next };
      });
    },
    async appendReviewActivity(activity, scope) {
      const value = EvidenceReviewActivitySchema.parse(activity);
      return mutate((snapshot) => ({
        value,
        snapshot: attachBindings(
          {
            ...snapshot,
            reviewActivity: appendUnique(
              snapshot.reviewActivity,
              value,
              (item) => item.activityId,
            ),
          },
          scope,
          'review-activity',
          [value as unknown as Record<string, unknown>],
        ),
      }));
    },
    async appendReviewDecisions(decisions, activities, scope) {
      const values = decisions.map((item) =>
        EvidenceReviewDecisionRecordSchema.parse(item),
      );
      const activityValues = activities.map((item) =>
        EvidenceReviewActivitySchema.parse(item),
      );
      if (values.length !== activityValues.length)
        throw new Error('Bulk decisions and activities must align.');
      return mutate((snapshot) => {
        const nextDecisions = [...snapshot.reviewDecisions];
        const nextActivity = [...snapshot.reviewActivity];
        for (let index = 0; index < values.length; index += 1) {
          const value = values[index] as EvidenceReviewDecision;
          const existing = nextDecisions.find(
            (item) =>
              item.workspaceId === value.workspaceId &&
              item.commandKey === value.commandKey,
          );
          if (existing !== undefined && !same(decisionCommand(existing), decisionCommand(value)))
            throw new EvidenceProductCommandCollisionError(value.commandKey);
          if (existing === undefined) nextDecisions.push(value);
          const activity = activityValues[index] as (typeof activityValues)[number];
          const existingActivity = nextActivity.find(
            (item) => item.activityId === activity.activityId,
          );
          if (existingActivity !== undefined && !same(existingActivity, activity))
            throw new EvidenceProductCommandCollisionError(activity.commandKey);
          if (existingActivity === undefined) nextActivity.push(activity);
        }
        let next: EvidenceProductSnapshot = {
          ...snapshot,
          reviewDecisions: nextDecisions.sort((a, b) =>
            a.decidedAt.localeCompare(b.decidedAt) ||
            a.reviewDecisionId.localeCompare(b.reviewDecisionId),
          ),
          reviewActivity: nextActivity.sort((a, b) =>
            a.occurredAt.localeCompare(b.occurredAt) ||
            a.activityId.localeCompare(b.activityId),
          ),
        };
        next = attachBindings(next, scope, 'review-decision', values as unknown as Record<string, unknown>[]);
        next = attachBindings(next, scope, 'review-activity', activityValues as unknown as Record<string, unknown>[]);
        return { value: values, snapshot: next };
      });
    },
    async stageArtifact(staging, audit, scope) {
      const value = EvidenceArtifactStagingSchema.parse(staging);
      const auditValue = EvidenceSecurityAuditEventSchema.parse(audit);
      return mutate((snapshot) => {
        const prior = snapshot.artifactStaging.find(
          (item) =>
            item.caseId === value.caseId &&
            item.commandKey === value.commandKey,
        );
        if (
          prior !== undefined &&
          (prior.representationId !== value.representationId ||
            prior.plaintextSha256 !== value.plaintextSha256)
        )
          throw new EvidenceProductCommandCollisionError(value.commandKey);
        if (prior !== undefined) return { value: prior, snapshot };
        return {
          value,
          snapshot: attachBindings(
            attachBindings(
              {
                ...snapshot,
                artifactStaging: appendUnique(
                  snapshot.artifactStaging,
                  value,
                  (item) => item.stagingId,
                ),
                securityAudit: appendUnique(
                  snapshot.securityAudit,
                  auditValue,
                  (item) => item.auditEventId,
                ),
              },
              scope,
              'artifact-staging',
              [value as unknown as Record<string, unknown>],
            ),
            scope,
            'security-audit',
            [auditValue as unknown as Record<string, unknown>],
          ),
        };
      });
    },
    async activateArtifactSource(
      source,
      representation,
      envelope,
      lifecycle,
      audit,
      scope,
    ) {
      const sourceValue = SourceArtifactVersionSchema.parse(source);
      const representationValue =
        EvidenceArtifactRepresentationSchema.parse(representation);
      const envelopeValue =
        EvidenceArtifactObjectEnvelopeSchema.parse(envelope);
      const lifecycleValue =
        EvidenceArtifactLifecycleEventSchema.parse(lifecycle);
      const auditValue = EvidenceSecurityAuditEventSchema.parse(audit);
      return mutate((snapshot) => {
        const staged = snapshot.artifactStaging.find(
          (item) =>
            item.representationId === representationValue.representationId &&
            canonicalJson(item.representation as never) ===
              canonicalJson(representationValue as never) &&
            canonicalJson(item.pendingEnvelope as never) ===
              canonicalJson(envelopeValue as never),
        );
        if (staged === undefined)
          throw new Error(
            'Artifact activation requires matching staged metadata.',
          );
        if (staged.state === 'activated') {
          const activeSource = snapshot.sources.find(
            (item) => item.artifactVersionId === sourceValue.artifactVersionId,
          );
          const activeRepresentation = snapshot.artifactRepresentations.find(
            (item) =>
              item.representationId === representationValue.representationId,
          );
          const activeEnvelope = snapshot.artifactEnvelopes.find(
            (item) => item.representationId === envelopeValue.representationId,
          );
          if (
            activeSource === undefined ||
            activeRepresentation === undefined ||
            activeEnvelope === undefined ||
            canonicalJson(activeSource as never) !==
              canonicalJson(sourceValue as never) ||
            canonicalJson(activeRepresentation as never) !==
              canonicalJson(representationValue as never) ||
            canonicalJson(activeEnvelope as never) !==
              canonicalJson(envelopeValue as never)
          )
            throw new Error('Activated artifact metadata is inconsistent.');
          return { value: activeSource, snapshot };
        }
        const existingSource = snapshot.sources.find(
          (item) => item.artifactVersionId === sourceValue.artifactVersionId,
        );
        const ordinalCollision = snapshot.sources.find(
          (item) =>
            item.logicalArtifactId === sourceValue.logicalArtifactId &&
            item.versionOrdinal === sourceValue.versionOrdinal &&
            item.artifactVersionId !== sourceValue.artifactVersionId,
        );
        if (ordinalCollision !== undefined)
          throw new EvidenceProductCommandCollisionError(
            `artifact-ordinal:${sourceValue.logicalArtifactId}:${String(sourceValue.versionOrdinal)}`,
          );
        if (
          existingSource !== undefined &&
          !sameSourceMetadata(existingSource, sourceValue)
        )
          throw new EvidenceProductCommandCollisionError(
            sourceValue.artifactVersionId,
          );
        const staging = snapshot.artifactStaging.map((item) =>
          item.representationId === representationValue.representationId
            ? EvidenceArtifactStagingSchema.parse({
                ...item,
                state: 'activated',
              })
            : item,
        );
        let next: EvidenceProductSnapshot = {
          ...snapshot,
          sources: [
            ...snapshot.sources.filter(
              (item) =>
                item.artifactVersionId !== sourceValue.artifactVersionId,
            ),
            sourceValue,
          ].sort((a, b) =>
            a.artifactVersionId.localeCompare(b.artifactVersionId),
          ),
          artifactStaging: staging,
          artifactRepresentations: appendUnique(
            snapshot.artifactRepresentations,
            representationValue,
            (item) => item.representationId,
          ),
          artifactEnvelopes: appendUnique(
            snapshot.artifactEnvelopes,
            envelopeValue,
            (item) => item.representationId,
          ),
          artifactLifecycle: appendUnique(
            snapshot.artifactLifecycle,
            lifecycleValue,
            (item) => item.lifecycleEventId,
          ),
          securityAudit: appendUnique(
            snapshot.securityAudit,
            auditValue,
            (item) => item.auditEventId,
          ),
        };
        for (const [kind, values] of [
          ['source', [sourceValue]],
          ['artifact-representation', [representationValue]],
          ['artifact-envelope', [envelopeValue]],
          ['artifact-lifecycle', [lifecycleValue]],
          ['security-audit', [auditValue]],
        ] as const)
          next = attachBindings(
            next,
            scope,
            kind,
            values as unknown as Record<string, unknown>[],
          );
        return { value: sourceValue, snapshot: next };
      });
    },
    async appendSecurityAudit(audit, scope) {
      const value = EvidenceSecurityAuditEventSchema.parse(audit);
      return mutate((snapshot) => ({
        value,
        snapshot: attachBindings(
          {
            ...snapshot,
            securityAudit: appendUnique(
              snapshot.securityAudit,
              value,
              (item) => item.auditEventId,
            ),
          },
          scope,
          'security-audit',
          [value as unknown as Record<string, unknown>],
        ),
      }));
    },
    async updateArtifactEnvelope(envelope, lifecycle, audit, scope) {
      const value = EvidenceArtifactObjectEnvelopeSchema.parse(envelope);
      const lifecycleValue =
        EvidenceArtifactLifecycleEventSchema.parse(lifecycle);
      const auditValue = EvidenceSecurityAuditEventSchema.parse(audit);
      return mutate((snapshot) => {
        const existing = snapshot.artifactEnvelopes.find(
          (item) => item.representationId === value.representationId,
        );
        if (
          existing === undefined ||
          existing.caseId !== value.caseId ||
          existing.workspaceId !== value.workspaceId ||
          existing.objectKey !== value.objectKey ||
          existing.ciphertextSha256 !== value.ciphertextSha256
        )
          throw new Error(
            'Artifact envelope re-wrap changed immutable content.',
          );
        let next: EvidenceProductSnapshot = {
          ...snapshot,
          artifactEnvelopes: snapshot.artifactEnvelopes.map((item) =>
            item.representationId === value.representationId ? value : item,
          ),
          artifactLifecycle: appendUnique(
            snapshot.artifactLifecycle,
            lifecycleValue,
            (item) => item.lifecycleEventId,
          ),
          securityAudit: appendUnique(
            snapshot.securityAudit,
            auditValue,
            (item) => item.auditEventId,
          ),
        };
        next = attachBindings(next, scope, 'artifact-lifecycle', [
          lifecycleValue as unknown as Record<string, unknown>,
        ]);
        next = attachBindings(next, scope, 'security-audit', [
          auditValue as unknown as Record<string, unknown>,
        ]);
        return { value, snapshot: next };
      });
    },
    async appendArtifactLifecycle(lifecycle, audit, scope) {
      const value = EvidenceArtifactLifecycleEventSchema.parse(lifecycle);
      const auditValue = EvidenceSecurityAuditEventSchema.parse(audit);
      return mutate((snapshot) => {
        const currentRevision = snapshot.artifactLifecycle.filter(
          (item) => item.representationId === value.representationId,
        ).length;
        if (
          value.expectedRevision !== null &&
          value.expectedRevision !== currentRevision
        )
          throw new Error('Artifact lifecycle revision conflict.');
        let next: EvidenceProductSnapshot = {
          ...snapshot,
          artifactLifecycle: appendUnique(
            snapshot.artifactLifecycle,
            value,
            (item) => item.lifecycleEventId,
          ),
          securityAudit: appendUnique(
            snapshot.securityAudit,
            auditValue,
            (item) => item.auditEventId,
          ),
        };
        next = attachBindings(next, scope, 'artifact-lifecycle', [
          value as unknown as Record<string, unknown>,
        ]);
        next = attachBindings(next, scope, 'security-audit', [
          auditValue as unknown as Record<string, unknown>,
        ]);
        return { value, snapshot: next };
      });
    },
    async quarantineArtifactStaging(stagingId, lifecycle, audit, scope) {
      const lifecycleValue =
        EvidenceArtifactLifecycleEventSchema.parse(lifecycle);
      const auditValue = EvidenceSecurityAuditEventSchema.parse(audit);
      return mutate((snapshot) => {
        const existing = snapshot.artifactStaging.find(
          (item) => item.stagingId === stagingId,
        );
        if (
          existing === undefined ||
          existing.caseId !== scope.caseId ||
          existing.workspaceId !== scope.workspaceId ||
          existing.representationId !== lifecycleValue.representationId
        )
          throw new Error('Artifact staging record is unavailable.');
        const value = EvidenceArtifactStagingSchema.parse({
          ...existing,
          state: 'quarantined',
        });
        let next: EvidenceProductSnapshot = {
          ...snapshot,
          artifactStaging: snapshot.artifactStaging.map((item) =>
            item.stagingId === stagingId ? value : item,
          ),
          artifactLifecycle: appendUnique(
            snapshot.artifactLifecycle,
            lifecycleValue,
            (item) => item.lifecycleEventId,
          ),
          securityAudit: appendUnique(
            snapshot.securityAudit,
            auditValue,
            (item) => item.auditEventId,
          ),
        };
        next = attachBindings(next, scope, 'artifact-lifecycle', [
          lifecycleValue as unknown as Record<string, unknown>,
        ]);
        next = attachBindings(next, scope, 'security-audit', [
          auditValue as unknown as Record<string, unknown>,
        ]);
        return { value, snapshot: next };
      });
    },
    async putWorkspace(workspace, scope) {
      const value = EvidenceWorkspaceSchema.parse(workspace);
      return mutate((snapshot) => {
        const existing = snapshot.workspaces.find(
          ({ workspaceId }) => workspaceId === value.workspaceId,
        );
        if (existing !== undefined) {
          if (!same(existing, value))
            throw new EvidenceProductCommandCollisionError(value.workspaceId);
          return {
            value: existing,
            snapshot: attachBindings(snapshot, scope, 'workspace', [
              value as unknown as Record<string, unknown>,
            ]),
          };
        }
        return {
          value,
          snapshot: attachBindings(
            {
              ...snapshot,
              workspaces: [...snapshot.workspaces, value].sort((a, b) =>
                a.workspaceId.localeCompare(b.workspaceId),
              ),
            },
            scope,
            'workspace',
            [value as unknown as Record<string, unknown>],
          ),
        };
      });
    },
    async putSource(source, scope) {
      const value = SourceArtifactVersionSchema.parse(source);
      return mutate((snapshot) => {
        const existing = snapshot.sources.find(
          ({ artifactVersionId }) =>
            artifactVersionId === value.artifactVersionId,
        );
        if (existing !== undefined) {
          if (!same(existing, value))
            throw new EvidenceProductCommandCollisionError(
              value.artifactVersionId,
            );
          return {
            value: existing,
            snapshot: attachBindings(snapshot, scope, 'source', [
              value as unknown as Record<string, unknown>,
            ]),
          };
        }
        return {
          value,
          snapshot: attachBindings(
            {
              ...snapshot,
              sources: [...snapshot.sources, value].sort((a, b) =>
                a.artifactVersionId.localeCompare(b.artifactVersionId),
              ),
            },
            scope,
            'source',
            [value as unknown as Record<string, unknown>],
          ),
        };
      });
    },
    async putObservations(observations, scope) {
      const values = observations.map((value) =>
        EvidenceObservationSchema.parse(value),
      );
      return mutate((snapshot) => {
        const byId = new Map(
          snapshot.observations.map((value) => [value.observationId, value]),
        );
        for (const value of values) {
          const existing = byId.get(value.observationId);
          if (existing !== undefined && !same(existing, value))
            throw new EvidenceProductCommandCollisionError(value.observationId);
          byId.set(value.observationId, existing ?? value);
        }
        return {
          value: values,
          snapshot: attachBindings(
            {
              ...snapshot,
              observations: [...byId.values()].sort((a, b) =>
                a.observationId.localeCompare(b.observationId),
              ),
            },
            scope,
            'observation',
            values as unknown as Record<string, unknown>[],
          ),
        };
      });
    },
    async putRelations(relations, scope) {
      const values = relations.map((value) =>
        EvidenceRelationSchema.parse(value),
      );
      return mutate((snapshot) => {
        const byId = new Map(
          (snapshot.relations ?? []).map((value) => [value.relationId, value]),
        );
        for (const value of values) {
          const existing = byId.get(value.relationId);
          if (existing !== undefined && !same(existing, value))
            throw new EvidenceProductCommandCollisionError(value.relationId);
          byId.set(value.relationId, existing ?? value);
        }
        return {
          value: values,
          snapshot: attachBindings(
            {
              ...snapshot,
              relations: [...byId.values()].sort((a, b) =>
                a.relationId.localeCompare(b.relationId),
              ),
            },
            scope,
            'relation',
            values as unknown as Record<string, unknown>[],
          ),
        };
      });
    },
    async putOpenQuestions(openQuestions, scope) {
      const values = openQuestions.map((value) =>
        EvidenceOpenQuestionSchema.parse(value),
      );
      return mutate((snapshot) => {
        const byId = new Map(
          (snapshot.openQuestions ?? []).map((value) => [
            value.openQuestionId,
            value,
          ]),
        );
        for (const value of values) {
          const existing = byId.get(value.openQuestionId);
          if (existing !== undefined && !same(existing, value))
            throw new EvidenceProductCommandCollisionError(
              value.openQuestionId,
            );
          byId.set(value.openQuestionId, existing ?? value);
        }
        return {
          value: values,
          snapshot: attachBindings(
            {
              ...snapshot,
              openQuestions: [...byId.values()].sort((a, b) =>
                a.openQuestionId.localeCompare(b.openQuestionId),
              ),
            },
            scope,
            'open-question',
            values as unknown as Record<string, unknown>[],
          ),
        };
      });
    },
    async putAssessments(assessments, scope) {
      const values = assessments.map((value) =>
        EvidenceAssessmentSchema.parse(value),
      );
      return mutate((snapshot) => {
        const byId = new Map(
          (snapshot.assessments ?? []).map((value) => [
            value.assessmentVersionId,
            value,
          ]),
        );
        for (const value of values) {
          const existing = byId.get(value.assessmentVersionId);
          if (existing !== undefined && !same(existing, value))
            throw new EvidenceProductCommandCollisionError(
              value.assessmentVersionId,
            );
          byId.set(value.assessmentVersionId, existing ?? value);
        }
        return {
          value: values,
          snapshot: attachBindings(
            {
              ...snapshot,
              assessments: [...byId.values()].sort((a, b) =>
                a.assessmentVersionId.localeCompare(b.assessmentVersionId),
              ),
            },
            scope,
            'assessment',
            values as unknown as Record<string, unknown>[],
          ),
        };
      });
    },
    async putChangeSet(changeSet, scope) {
      const value = EvidenceProductChangeSetSchema.parse(changeSet);
      return mutate((snapshot) => {
        const existing = snapshot.changeSets.find(
          ({ workspaceId, commandKey }) =>
            workspaceId === value.workspaceId &&
            commandKey === value.commandKey,
        );
        if (existing !== undefined) {
          if (!same(existing, value))
            throw new EvidenceProductCommandCollisionError(value.commandKey);
          return {
            value: existing,
            snapshot: attachBindings(snapshot, scope, 'change-set', [
              value as unknown as Record<string, unknown>,
            ]),
          };
        }
        return {
          value,
          snapshot: attachBindings(
            {
              ...snapshot,
              changeSets: [...snapshot.changeSets, value].sort(
                (a, b) =>
                  a.changeSet.toEvidenceRevision -
                    b.changeSet.toEvidenceRevision ||
                  a.commandKey.localeCompare(b.commandKey),
              ),
            },
            scope,
            'change-set',
            [value as unknown as Record<string, unknown>],
          ),
        };
      });
    },
    async putJob(job: EvidenceProductJob, scope) {
      return mutate((snapshot) => {
        const existing = snapshot.jobs.find(({ jobId }) => jobId === job.jobId);
        if (
          existing !== undefined &&
          (existing.workspaceId !== job.workspaceId ||
            existing.commandKey !== job.commandKey ||
            existing.artifactVersionId !== job.artifactVersionId)
        ) {
          throw new EvidenceProductCommandCollisionError(job.commandKey);
        }
        const jobs = snapshot.jobs.filter(({ jobId }) => jobId !== job.jobId);
        jobs.push(job);
        jobs.sort((a, b) => a.jobId.localeCompare(b.jobId));
        return {
          value: job,
          snapshot: attachBindings({ ...snapshot, jobs }, scope, 'job', [
            job as unknown as Record<string, unknown>,
          ]),
        };
      });
    },
    async appendReviewDecision(decision, scope) {
      const value = EvidenceReviewDecisionRecordSchema.parse(decision);
      return mutate((snapshot) => {
        const existing = snapshot.reviewDecisions.find(
          ({ workspaceId, commandKey }) =>
            workspaceId === value.workspaceId &&
            commandKey === value.commandKey,
        );
        if (existing !== undefined) {
          if (!same(decisionCommand(existing), decisionCommand(value)))
            throw new EvidenceProductCommandCollisionError(value.commandKey);
          return {
            value: existing,
            snapshot: attachBindings(snapshot, scope, 'review-decision', [
              value as unknown as Record<string, unknown>,
            ]),
          };
        }
        return {
          value,
          snapshot: attachBindings(
            {
              ...snapshot,
              reviewDecisions: [...snapshot.reviewDecisions, value].sort(
                (a, b) =>
                  a.decidedAt.localeCompare(b.decidedAt) ||
                  a.reviewDecisionId.localeCompare(b.reviewDecisionId),
              ),
            },
            scope,
            'review-decision',
            [value as unknown as Record<string, unknown>],
          ),
        };
      });
    },
    async advanceEvidenceRevision(workspaceId, expectedRevision, nextRevision) {
      return mutate((snapshot) => {
        const current = snapshot.workspaces.find(
          (value) => value.workspaceId === workspaceId,
        );
        if (current === undefined)
          throw new RangeError(`Unknown workspace ${workspaceId}.`);
        if (
          current.evidenceRevision !== expectedRevision ||
          nextRevision < expectedRevision ||
          nextRevision > expectedRevision + 1
        ) {
          throw new EvidenceProductCommandCollisionError(
            `revision:${workspaceId}`,
          );
        }
        const value = EvidenceWorkspaceSchema.parse({
          ...current,
          evidenceRevision: nextRevision,
        });
        return {
          value,
          snapshot: {
            ...snapshot,
            workspaces: snapshot.workspaces.map((item) =>
              item.workspaceId === workspaceId ? value : item,
            ),
          },
        };
      });
    },
  };
}
