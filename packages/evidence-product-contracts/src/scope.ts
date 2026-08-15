import {
  EVIDENCE_CASE_OBJECT_BINDING_SCHEMA_VERSION,
  EvidenceCaseObjectBindingSchema,
  EvidenceProductSnapshotSchema,
  type EvidenceCaseObjectBinding,
  type EvidenceCaseObjectKind,
  type EvidenceCaseObjectScope,
  type EvidenceProductSnapshot,
} from './schemas.js';

function ids(values: readonly (readonly string[])[]): ReadonlySet<string> {
  return new Set(values.flat());
}

/**
 * Produces the fail-closed workspace projection used at the product API
 * boundary. Evidence objects do not carry mutable workspace fields, so their
 * durable import/relation change sets are the ownership ledger. Objects with
 * no workspace change-set provenance are deliberately invisible here.
 */
export function scopeEvidenceProductSnapshot(
  input: EvidenceProductSnapshot,
  workspaceId: string,
): EvidenceProductSnapshot {
  const snapshot = EvidenceProductSnapshotSchema.parse(input);
  const changeSets = snapshot.changeSets.filter(
    (item) => item.workspaceId === workspaceId,
  );
  const jobs = snapshot.jobs.filter((item) => item.workspaceId === workspaceId);
  const artifactVersionIds = new Set([
    ...ids(changeSets.map((item) => item.changeSet.addedArtifactVersionIds)),
    ...jobs.map((item) => item.artifactVersionId),
  ]);
  const observationIds = ids(
    changeSets.map((item) => item.changeSet.addedObservationIds),
  );
  const relationIds = ids(
    changeSets.map((item) => item.changeSet.addedRelationIds),
  );
  const openQuestionIds = ids(
    changeSets.map((item) => item.changeSet.addedOpenQuestionIds),
  );

  return EvidenceProductSnapshotSchema.parse({
    schemaVersion: snapshot.schemaVersion,
    workspaces: snapshot.workspaces.filter(
      (item) => item.workspaceId === workspaceId,
    ),
    sources: snapshot.sources.filter((item) =>
      artifactVersionIds.has(item.artifactVersionId),
    ),
    observations: snapshot.observations.filter((item) =>
      observationIds.has(item.observationId),
    ),
    relations: snapshot.relations.filter((item) =>
      relationIds.has(item.relationId),
    ),
    openQuestions: snapshot.openQuestions.filter((item) =>
      openQuestionIds.has(item.openQuestionId),
    ),
    assessments: snapshot.assessments.filter(
      (item) => item.workspaceId === workspaceId,
    ),
    changeSets,
    jobs,
    reviewDecisions: snapshot.reviewDecisions.filter(
      (item) => item.workspaceId === workspaceId,
    ),
    artifactRepresentations: snapshot.artifactRepresentations.filter(
      (item) => item.workspaceId === workspaceId,
    ),
    artifactEnvelopes: snapshot.artifactEnvelopes.filter(
      (item) => item.workspaceId === workspaceId,
    ),
    artifactStaging: snapshot.artifactStaging.filter(
      (item) => item.workspaceId === workspaceId,
    ),
    artifactLifecycle: snapshot.artifactLifecycle.filter(
      (item) => item.workspaceId === workspaceId,
    ),
    securityAudit: [],
    textImports: snapshot.textImports.filter(
      (item) => item.workspaceId === workspaceId,
    ),
    redactionDrafts: snapshot.redactionDrafts.filter(
      (item) => item.workspaceId === workspaceId,
    ),
    redactionLogs: snapshot.redactionLogs.filter(
      (item) => item.workspaceId === workspaceId,
    ),
    reviewAssignments: snapshot.reviewAssignments.filter(
      (item) => item.workspaceId === workspaceId,
    ),
    reviewComments: snapshot.reviewComments.filter(
      (item) => item.workspaceId === workspaceId,
    ),
    reviewActivity: snapshot.reviewActivity.filter(
      (item) => item.workspaceId === workspaceId,
    ),
    exportPolicies: snapshot.exportPolicies.filter(
      (item) => item.workspaceId === workspaceId,
    ),
    exportAuditRecords: snapshot.exportAuditRecords.filter(
      (item) => item.workspaceId === workspaceId,
    ),
  });
}

export function evidenceReviewTargetExistsInWorkspace(input: {
  readonly snapshot: EvidenceProductSnapshot;
  readonly workspaceId: string;
  readonly targetKind: 'observation' | 'relation' | 'assessment';
  readonly targetVersionId: string;
}): boolean {
  const scoped = scopeEvidenceProductSnapshot(
    input.snapshot,
    input.workspaceId,
  );
  if (input.targetKind === 'observation') {
    return scoped.observations.some(
      (item) => item.observationId === input.targetVersionId,
    );
  }
  if (input.targetKind === 'relation') {
    return scoped.relations.some(
      (item) => item.relationId === input.targetVersionId,
    );
  }
  return scoped.assessments.some(
    (item) => item.assessmentVersionId === input.targetVersionId,
  );
}

export function evidenceProductObjectId(
  kind: EvidenceCaseObjectKind,
  value: {
    readonly workspaceId?: string;
    readonly commandKey?: string;
  } & Record<string, unknown>,
): string {
  switch (kind) {
    case 'workspace':
      return String(value.workspaceId);
    case 'source':
      return String(value.artifactVersionId);
    case 'observation':
      return String(value.observationId);
    case 'relation':
      return String(value.relationId);
    case 'open-question':
      return String(value.openQuestionId);
    case 'assessment':
      return String(value.assessmentVersionId);
    case 'change-set':
      return `${String(value.workspaceId)}:${String(value.commandKey)}`;
    case 'job':
      return String(value.jobId);
    case 'review-decision':
      return String(value.reviewDecisionId);
    case 'artifact-representation':
    case 'artifact-envelope':
    case 'artifact-lifecycle':
      return String(value.representationId);
    case 'artifact-staging':
      return String(value.stagingId);
    case 'security-audit':
      return String(value.auditEventId);
    case 'text-import':
      return String(value.importId);
    case 'redaction-draft':
      return String(value.draftId);
    case 'redaction-log':
      return String(value.redactionLogId);
    case 'review-assignment':
      return String(value.assignmentId);
    case 'review-comment':
      return String(value.commentId);
    case 'review-activity':
      return String(value.activityId);
    case 'export-policy':
      return String(value.caseId);
    case 'export-audit-record':
      return String(value.exportAuditId);
  }
}

export function createEvidenceCaseObjectBindings(
  scope: EvidenceCaseObjectScope,
  kind: EvidenceCaseObjectKind,
  values: readonly Record<string, unknown>[],
): readonly EvidenceCaseObjectBinding[] {
  return values.map((value) =>
    EvidenceCaseObjectBindingSchema.parse({
      schemaVersion: EVIDENCE_CASE_OBJECT_BINDING_SCHEMA_VERSION,
      caseId: scope.caseId,
      workspaceId: scope.workspaceId,
      objectKind: kind,
      objectId: evidenceProductObjectId(kind, value),
      boundAt: scope.boundAt,
    }),
  );
}

/**
 * Case-first product projection. Only explicit immutable ownership bindings
 * participate; change-set inference is deliberately not consulted.
 */
export function scopeEvidenceProductSnapshotByCase(
  input: EvidenceProductSnapshot,
  caseId: string,
  workspaceId: string,
): EvidenceProductSnapshot {
  const snapshot = EvidenceProductSnapshotSchema.parse(input);
  const bindings = snapshot.objectBindings.filter(
    (item) => item.caseId === caseId && item.workspaceId === workspaceId,
  );
  const forKind = (kind: EvidenceCaseObjectKind) =>
    new Set(
      bindings
        .filter((item) => item.objectKind === kind)
        .map((item) => item.objectId),
    );
  const workspaceIds = forKind('workspace');
  const sourceIds = forKind('source');
  const observationIds = forKind('observation');
  const relationIds = forKind('relation');
  const questionIds = forKind('open-question');
  const assessmentIds = forKind('assessment');
  const changeSetIds = forKind('change-set');
  const jobIds = forKind('job');
  const reviewIds = forKind('review-decision');
  const representationIds = forKind('artifact-representation');
  const envelopeIds = forKind('artifact-envelope');
  const stagingIds = forKind('artifact-staging');
  const lifecycleIds = forKind('artifact-lifecycle');
  const auditIds = forKind('security-audit');
  const importIds = forKind('text-import');
  const redactionDraftIds = forKind('redaction-draft');
  const redactionLogIds = forKind('redaction-log');
  const assignmentIds = forKind('review-assignment');
  const commentIds = forKind('review-comment');
  const activityIds = forKind('review-activity');
  const exportPolicyIds = forKind('export-policy');
  const exportAuditIds = forKind('export-audit-record');
  return EvidenceProductSnapshotSchema.parse({
    schemaVersion: snapshot.schemaVersion,
    workspaces: snapshot.workspaces.filter((item) =>
      workspaceIds.has(item.workspaceId),
    ),
    sources: snapshot.sources.filter((item) =>
      sourceIds.has(item.artifactVersionId),
    ),
    observations: snapshot.observations.filter((item) =>
      observationIds.has(item.observationId),
    ),
    relations: snapshot.relations.filter((item) =>
      relationIds.has(item.relationId),
    ),
    openQuestions: snapshot.openQuestions.filter((item) =>
      questionIds.has(item.openQuestionId),
    ),
    assessments: snapshot.assessments.filter((item) =>
      assessmentIds.has(item.assessmentVersionId),
    ),
    changeSets: snapshot.changeSets.filter((item) =>
      changeSetIds.has(
        evidenceProductObjectId('change-set', item as Record<string, unknown>),
      ),
    ),
    jobs: snapshot.jobs.filter((item) => jobIds.has(item.jobId)),
    reviewDecisions: snapshot.reviewDecisions.filter((item) =>
      reviewIds.has(item.reviewDecisionId),
    ),
    objectBindings: bindings,
    artifactRepresentations: snapshot.artifactRepresentations.filter((item) =>
      representationIds.has(item.representationId),
    ),
    artifactEnvelopes: snapshot.artifactEnvelopes.filter((item) =>
      envelopeIds.has(item.representationId),
    ),
    artifactStaging: snapshot.artifactStaging.filter((item) =>
      stagingIds.has(item.stagingId),
    ),
    artifactLifecycle: snapshot.artifactLifecycle.filter((item) =>
      lifecycleIds.has(item.representationId),
    ),
    securityAudit: snapshot.securityAudit.filter((item) =>
      auditIds.has(item.auditEventId),
    ),
    textImports: snapshot.textImports.filter((item) =>
      importIds.has(item.importId),
    ),
    redactionDrafts: snapshot.redactionDrafts.filter((item) =>
      redactionDraftIds.has(item.draftId),
    ),
    redactionLogs: snapshot.redactionLogs.filter((item) =>
      redactionLogIds.has(item.redactionLogId),
    ),
    reviewAssignments: snapshot.reviewAssignments.filter((item) =>
      assignmentIds.has(item.assignmentId),
    ),
    reviewComments: snapshot.reviewComments.filter((item) =>
      commentIds.has(item.commentId),
    ),
    reviewActivity: snapshot.reviewActivity.filter((item) =>
      activityIds.has(item.activityId),
    ),
    exportPolicies: snapshot.exportPolicies.filter((item) =>
      exportPolicyIds.has(item.caseId),
    ),
    exportAuditRecords: snapshot.exportAuditRecords.filter((item) =>
      exportAuditIds.has(item.exportAuditId),
    ),
  });
}

export function evidenceReviewTargetExistsInCase(input: {
  readonly snapshot: EvidenceProductSnapshot;
  readonly caseId: string;
  readonly workspaceId: string;
  readonly targetKind: 'observation' | 'relation' | 'assessment';
  readonly targetVersionId: string;
}): boolean {
  const scoped = scopeEvidenceProductSnapshotByCase(
    input.snapshot,
    input.caseId,
    input.workspaceId,
  );
  if (input.targetKind === 'observation')
    return scoped.observations.some(
      (item) => item.observationId === input.targetVersionId,
    );
  if (input.targetKind === 'relation')
    return scoped.relations.some(
      (item) => item.relationId === input.targetVersionId,
    );
  return scoped.assessments.some(
    (item) => item.assessmentVersionId === input.targetVersionId,
  );
}

export function assertEvidenceCaseScopedReferences(
  input: EvidenceProductSnapshot,
  caseId: string,
  workspaceId: string,
): void {
  const scoped = scopeEvidenceProductSnapshotByCase(input, caseId, workspaceId);
  const sourceIds = new Set(
    scoped.sources.map((item) => item.artifactVersionId),
  );
  const observationIds = new Set(
    scoped.observations.map((item) => item.observationId),
  );
  const relationIds = new Set(scoped.relations.map((item) => item.relationId));
  const questionIds = new Set(
    scoped.openQuestions.map((item) => item.openQuestionId),
  );
  const assessmentIds = new Set(
    scoped.assessments.map((item) => item.assessmentVersionId),
  );
  const jobIds = new Set(scoped.jobs.map((item) => item.jobId));
  const anyEvidenceId = (id: string) =>
    sourceIds.has(id) || observationIds.has(id) || relationIds.has(id);
  for (const observation of scoped.observations) {
    if (!sourceIds.has(observation.artifactVersionId))
      throw new Error('Observation source belongs to another case.');
  }
  for (const relation of scoped.relations) {
    for (const endpoint of relation.endpoints) {
      if (endpoint.kind === 'observation' && !observationIds.has(endpoint.id))
        throw new Error(
          'Relation observation endpoint belongs to another case.',
        );
      if (endpoint.kind === 'relation' && !relationIds.has(endpoint.id))
        throw new Error('Relation endpoint belongs to another case.');
    }
    if (
      relation.predecessorRelationId !== null &&
      !relationIds.has(relation.predecessorRelationId)
    )
      throw new Error('Relation predecessor belongs to another case.');
  }
  for (const question of scoped.openQuestions) {
    if (question.triggeringEvidenceIds.some((id) => !anyEvidenceId(id)))
      throw new Error('Open-question trigger belongs to another case.');
  }
  for (const assessment of scoped.assessments) {
    if (assessment.workspaceId !== workspaceId)
      throw new Error('Assessment workspace differs from its case.');
    if (
      assessment.predecessorAssessmentVersionId !== null &&
      !assessmentIds.has(assessment.predecessorAssessmentVersionId)
    )
      throw new Error('Assessment predecessor belongs to another case.');
    for (const claim of assessment.claims) {
      if (claim.supportObservationIds.some((id) => !observationIds.has(id)))
        throw new Error('Assessment support belongs to another case.');
      if (claim.conflictRelationIds.some((id) => !relationIds.has(id)))
        throw new Error('Assessment conflict belongs to another case.');
      if (claim.qualificationRelationIds.some((id) => !relationIds.has(id)))
        throw new Error('Assessment qualification belongs to another case.');
    }
    if (assessment.openQuestionIds.some((id) => !questionIds.has(id)))
      throw new Error('Assessment question belongs to another case.');
    for (const citation of assessment.citations) {
      if (
        !sourceIds.has(citation.artifactVersionId) ||
        !anyEvidenceId(citation.evidenceId)
      )
        throw new Error('Assessment citation belongs to another case.');
    }
  }
  for (const changeSet of scoped.changeSets) {
    if (
      changeSet.changeSet.addedArtifactVersionIds.some(
        (id) => !sourceIds.has(id),
      ) ||
      changeSet.changeSet.addedObservationIds.some(
        (id) => !observationIds.has(id),
      ) ||
      changeSet.changeSet.addedRelationIds.some((id) => !relationIds.has(id)) ||
      changeSet.changeSet.addedOpenQuestionIds.some(
        (id) => !questionIds.has(id),
      )
    )
      throw new Error('Change set contains a cross-case object.');
  }
  for (const job of scoped.jobs) {
    const missingObservationIds =
      job.schemaVersion === 'evidence-product-job/3' ||
      job.schemaVersion === 'evidence-product-job/4'
        ? job.observationIds.filter((id) => !observationIds.has(id))
        : [];
    if (missingObservationIds.length > 0)
      throw new Error('Job observations belong to another case.');
    if (
      job.schemaVersion === 'evidence-product-job/4' &&
      (job.relationIds.some((id) => !relationIds.has(id)) ||
        job.openQuestionIds.some((id) => !questionIds.has(id)) ||
        (job.predecessorAssessmentVersionId !== null &&
          !assessmentIds.has(job.predecessorAssessmentVersionId)))
    )
      throw new Error('Assessment job evidence belongs to another case.');
    const inputExists =
      job.schemaVersion === 'evidence-product-job/3' ||
      job.schemaVersion === 'evidence-product-job/4'
        ? true
        : sourceIds.has(job.artifactVersionId);
    if (job.workspaceId !== workspaceId)
      throw new Error('Job workspace belongs to another case.');
    if (!inputExists)
      throw new Error(
        `Job source belongs to another case (${job.schemaVersion}).`,
      );
  }
  for (const decision of scoped.reviewDecisions) {
    const targetExists =
      (decision.targetKind === 'observation' &&
        observationIds.has(decision.targetVersionId)) ||
      (decision.targetKind === 'relation' &&
        relationIds.has(decision.targetVersionId)) ||
      (decision.targetKind === 'assessment' &&
        assessmentIds.has(decision.targetVersionId));
    if (decision.workspaceId !== workspaceId || !targetExists)
      throw new Error('Review target belongs to another case.');
  }
  const representationIds = new Set(
    scoped.artifactRepresentations.map((item) => item.representationId),
  );
  for (const representation of scoped.artifactRepresentations) {
    if (
      representation.caseId !== caseId ||
      representation.workspaceId !== workspaceId ||
      !sourceIds.has(representation.artifactVersionId)
    )
      throw new Error('Artifact representation belongs to another case.');
  }
  for (const envelope of scoped.artifactEnvelopes) {
    if (
      envelope.caseId !== caseId ||
      envelope.workspaceId !== workspaceId ||
      !representationIds.has(envelope.representationId)
    )
      throw new Error('Artifact envelope belongs to another case.');
  }
  const stagedRepresentationIds = new Set<string>();
  for (const staging of scoped.artifactStaging) {
    stagedRepresentationIds.add(staging.representationId);
    if (
      staging.caseId !== caseId ||
      staging.workspaceId !== workspaceId ||
      staging.representation.caseId !== caseId ||
      staging.representation.workspaceId !== workspaceId ||
      staging.representation.representationId !== staging.representationId ||
      staging.pendingEnvelope.caseId !== caseId ||
      staging.pendingEnvelope.workspaceId !== workspaceId ||
      staging.pendingEnvelope.representationId !== staging.representationId ||
      staging.pendingEnvelope.objectKey !== staging.objectKey
    )
      throw new Error('Artifact staging metadata belongs to another case.');
  }
  for (const lifecycle of scoped.artifactLifecycle) {
    if (
      lifecycle.caseId !== caseId ||
      lifecycle.workspaceId !== workspaceId ||
      (!representationIds.has(lifecycle.representationId) &&
        !stagedRepresentationIds.has(lifecycle.representationId))
    )
      throw new Error('Artifact lifecycle event belongs to another case.');
  }
  for (const audit of scoped.securityAudit) {
    if (
      audit.caseId !== caseId ||
      (audit.resourceKind === 'case' && audit.resourceId !== caseId) ||
      (audit.resourceKind === 'artifact-representation' &&
        !representationIds.has(audit.resourceId) &&
        !stagedRepresentationIds.has(audit.resourceId)) ||
      (audit.resourceKind === 'live-execution' && !jobIds.has(audit.resourceId))
    )
      throw new Error('Security audit event belongs to another case.');
  }
}
