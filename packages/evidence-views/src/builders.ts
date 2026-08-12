import {
  effectiveReviewDecision,
  orderedReviewDecisions,
  type EvidenceProductSnapshot,
  type EvidenceReviewDecision,
} from '@acme/evidence-product-contracts';
import type {
  EvidenceAssessment,
  EvidenceObservation,
  EvidenceRelation,
  EvidenceState,
  EvidenceTemporalBound,
  SourceArtifactVersion,
} from '@acme/module-evidence';
import {
  buildEvidenceTimelineEntries,
  evidenceAttentionTier,
  EvidenceStateSchema,
  pairEvidenceCorrectionObservations,
} from '@acme/module-evidence';

import {
  EVIDENCE_PRIMARY_ACCOUNT_COMPARISON_VIEW_SCHEMA_VERSION,
  EVIDENCE_PRIMARY_ASSESSMENT_VIEW_SCHEMA_VERSION,
  EVIDENCE_PRIMARY_OBSERVATION_LEDGER_VIEW_SCHEMA_VERSION,
  EVIDENCE_PRIMARY_OPEN_QUESTIONS_VIEW_SCHEMA_VERSION,
  EVIDENCE_PRIMARY_RELATION_REVIEW_VIEW_SCHEMA_VERSION,
  EVIDENCE_PRIMARY_REVIEW_HISTORY_VIEW_SCHEMA_VERSION,
  EVIDENCE_PRIMARY_SOURCE_REVIEW_VIEW_SCHEMA_VERSION,
  EVIDENCE_PRIMARY_TIMELINE_VIEW_SCHEMA_VERSION,
  EVIDENCE_PRIMARY_WORK_QUEUE_VIEW_SCHEMA_VERSION,
  EVIDENCE_TECHNICAL_PROVENANCE_VIEW_SCHEMA_VERSION,
  EVIDENCE_TECHNICAL_REPLAY_VIEW_SCHEMA_VERSION,
  EvidencePrimaryAccountComparisonViewSchema,
  EvidencePrimaryAssessmentViewSchema,
  EvidencePrimaryObservationLedgerViewSchema,
  EvidencePrimaryOpenQuestionsViewSchema,
  EvidencePrimaryRelationReviewViewSchema,
  EvidencePrimaryReviewHistoryViewSchema,
  EvidencePrimarySourceReviewViewSchema,
  EvidencePrimaryTimelineViewSchema,
  EvidencePrimaryWorkQueueViewSchema,
  EvidenceTechnicalProvenanceViewSchema,
  EvidenceTechnicalReplayViewSchema,
  type EvidencePrimaryAccountComparisonView,
  type EvidencePrimaryAssessmentView,
  type EvidencePrimaryObservationLedgerView,
  type EvidencePrimaryOpenQuestionsView,
  type EvidencePrimaryRelationReviewView,
  type EvidencePrimaryReviewHistoryView,
  type EvidencePrimarySourceReviewView,
  type EvidencePrimaryTimelineView,
  type EvidencePrimaryWorkQueueView,
  type EvidenceTechnicalProvenanceView,
  type EvidenceTechnicalReplayView,
} from './schemas.js';

function freeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object' || seen.has(value))
    return value;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  return Object.freeze(value);
}

function detached<T>(value: T): T {
  return freeze(structuredClone(value));
}

function requireWorkspace(
  snapshot: EvidenceProductSnapshot,
  workspaceId: string,
) {
  const workspace = snapshot.workspaces.find(
    (value) => value.workspaceId === workspaceId,
  );
  if (workspace === undefined)
    throw new RangeError(`Unknown workspace ${workspaceId}.`);
  return workspace;
}

function requireSource(
  snapshot: EvidenceProductSnapshot,
  artifactVersionId: string,
) {
  const source = snapshot.sources.find(
    (value) => value.artifactVersionId === artifactVersionId,
  );
  if (source === undefined)
    throw new RangeError(`Unknown source ${artifactVersionId}.`);
  return source;
}

function sourceActor(observation: EvidenceObservation) {
  return observation.kind === 'statement-occurrence'
    ? observation.actorReference
    : observation.sourceActorReference;
}

function citation(
  source: SourceArtifactVersion,
  observation: EvidenceObservation,
) {
  const locator = observation.locator;
  return {
    display: `[${source.logicalArtifactId}@v${String(source.versionOrdinal)}:L${String(locator.startLine)}-L${String(locator.endLine)}]`,
    artifactVersionId: source.artifactVersionId,
    locatorId: locator.locatorId,
    contentHash: source.contentHash,
    startLine: locator.startLine,
    endLine: locator.endLine,
  };
}

function standing(decision: EvidenceReviewDecision | null) {
  switch (decision?.action) {
    case 'accept':
    case 'reaffirm':
      return 'accepted' as const;
    case 'reject':
      return 'rejected' as const;
    case 'leave-unresolved':
      return 'unresolved' as const;
    case 'request-revision':
      return 'revision-requested' as const;
    default:
      return 'awaiting-review' as const;
  }
}

function decisionActorRef(decision: EvidenceReviewDecision): string {
  return decision.schemaVersion === 'evidence-review-decision/1'
    ? decision.reviewerRef
    : decision.principalRef;
}

function timeDisplay(value: EvidenceTemporalBound): string {
  switch (value.kind) {
    case 'exact':
      return value.at;
    case 'range':
      return `${value.from} – ${value.to}`;
    case 'approximate':
      return `${value.center} ± ${String(value.toleranceMinutes)} min`;
    case 'unknown':
      return 'Time not specified in the quote.';
  }
}

function sourceSummary(source: SourceArtifactVersion) {
  return {
    artifactVersionId: source.artifactVersionId,
    logicalArtifactId: source.logicalArtifactId,
    title: source.title,
    versionOrdinal: source.versionOrdinal,
    predecessorVersionId: source.predecessorVersionId,
    sourcePath: `/sources/${source.artifactVersionId}`,
  };
}

function standingMap(stateValue: EvidenceState) {
  const state = EvidenceStateSchema.parse(stateValue);
  return new Map(
    state.standings
      .filter(({ objectKind }) =>
        ['statement-occurrence', 'exhibit-assertion'].includes(objectKind),
      )
      .map(({ objectId, standing: value }) => [objectId, value]),
  );
}

function objectStandingMap(stateValue: EvidenceState) {
  const state = EvidenceStateSchema.parse(stateValue);
  return new Map(
    state.standings.map(({ objectId, standing: value }) => [objectId, value]),
  );
}

function requireObservationStanding(
  standings: ReadonlyMap<
    string,
    EvidenceState['standings'][number]['standing']
  >,
  observationId: string,
) {
  const value = standings.get(observationId);
  if (value === undefined)
    throw new RangeError(`Missing standing for ${observationId}.`);
  return value;
}

function requireProjectionRevision(
  workspaceRevision: number,
  state: EvidenceState,
): void {
  if (workspaceRevision !== state.evidenceRevision) {
    throw new RangeError(
      'Workspace evidence revision does not match the supplied Evidence projection.',
    );
  }
}

function endpointDisplay(
  endpoint: EvidenceRelation['endpoints'][number],
  observations: ReadonlyMap<string, EvidenceObservation>,
): string {
  if (endpoint.kind === 'observation') {
    const observation = observations.get(endpoint.id);
    if (observation !== undefined) {
      return `${observation.kind}:${observation.locator.startLine}-${observation.locator.endLine}`;
    }
  }
  return `${endpoint.kind}:${endpoint.id.slice(0, 18)}`;
}

function assessmentDecisions(
  snapshot: EvidenceProductSnapshot,
  assessmentVersionId: string,
): readonly EvidenceReviewDecision[] {
  return orderedReviewDecisions(snapshot.reviewDecisions).filter(
    (decision) =>
      decision.workspaceId ===
        snapshot.assessments.find(
          (assessment) =>
            assessment.assessmentVersionId === assessmentVersionId,
        )?.workspaceId && decision.targetVersionId === assessmentVersionId,
  );
}

function effectiveAssessmentBasis(
  assessment: EvidenceAssessment,
  decisions: readonly EvidenceReviewDecision[],
): number {
  return decisions.reduce(
    (basis, decision) =>
      decision.action === 'reaffirm' && decision.basisEvidenceRevision !== null
        ? Math.max(basis, decision.basisEvidenceRevision)
        : basis,
    assessment.basisEvidenceRevision,
  );
}

function assessmentAnchors(
  snapshot: EvidenceProductSnapshot,
  assessment: EvidenceAssessment,
) {
  const citedIds = new Set(
    assessment.citations.map(({ evidenceId }) => evidenceId),
  );
  const observations = snapshot.observations.filter(({ observationId }) =>
    citedIds.has(observationId),
  );
  const relations = snapshot.relations.filter(({ relationId }) =>
    citedIds.has(relationId),
  );
  return {
    citedArtifactVersionIds: [
      ...new Set(
        assessment.citations.map(({ artifactVersionId }) => artifactVersionId),
      ),
    ].sort(),
    citedActorReferenceKeys: [
      ...new Set(
        observations.flatMap((observation) => {
          const actor = sourceActor(observation);
          return actor === null ? [] : [actor.actorReferenceKey];
        }),
      ),
    ].sort(),
    citedRelationEndpointIds: [
      ...new Set(
        relations.flatMap(({ endpoints }) => endpoints.map(({ id }) => id)),
      ),
    ].sort(),
    citedTemporalBounds: observations.flatMap(({ temporalBound }) =>
      temporalBound === null ? [] : [temporalBound],
    ),
  };
}

function newEvidenceNotices(
  snapshot: EvidenceProductSnapshot,
  workspaceEvidenceRevision: number,
  assessment: EvidenceAssessment,
  effectiveBasisEvidenceRevision: number,
) {
  const anchors = assessmentAnchors(snapshot, assessment);
  return snapshot.changeSets
    .filter(
      (record) =>
        record.workspaceId === assessment.workspaceId &&
        record.changeSet.toEvidenceRevision > effectiveBasisEvidenceRevision,
    )
    .map((record) => {
      const attentionTier = evidenceAttentionTier(
        {
          assessmentVersionId: assessment.assessmentVersionId,
          basisEvidenceRevision: assessment.basisEvidenceRevision,
          effectiveBasisEvidenceRevision,
          workspaceEvidenceRevision,
          ...anchors,
        },
        record.changeSet,
      );
      if (attentionTier === 'none') return null;
      return {
        noticeId: `attention:${assessment.assessmentVersionId}:${record.commandKey}`,
        assessmentVersionId: assessment.assessmentVersionId,
        fromEvidenceRevision: record.changeSet.fromEvidenceRevision,
        toEvidenceRevision: record.changeSet.toEvidenceRevision,
        attentionTier,
        message:
          'New evidence was added after this assessment was reviewed.' as const,
        addedArtifactVersionIds: record.changeSet.addedArtifactVersionIds,
        addedObservationIds: record.changeSet.addedObservationIds,
        addedRelationIds: record.changeSet.addedRelationIds,
        addedOpenQuestionIds: record.changeSet.addedOpenQuestionIds,
      };
    })
    .filter((notice): notice is NonNullable<typeof notice> => notice !== null)
    .sort(
      (left, right) =>
        left.toEvidenceRevision - right.toEvidenceRevision ||
        left.noticeId.localeCompare(right.noticeId),
    );
}

function citationForEvidence(
  snapshot: EvidenceProductSnapshot,
  assessment: EvidenceAssessment,
  evidenceId: string,
) {
  const reference = assessment.citations.find(
    (value) => value.evidenceId === evidenceId,
  );
  if (reference === undefined)
    throw new RangeError(`Assessment citation missing for ${evidenceId}.`);
  const source = requireSource(snapshot, reference.artifactVersionId);
  const observation = snapshot.observations.find(
    (value) => value.locator.locatorId === reference.locatorId,
  );
  if (observation === undefined)
    throw new RangeError(`Assessment locator missing for ${evidenceId}.`);
  return citation(source, observation);
}

export function buildEvidencePrimaryWorkQueueView(input: {
  readonly workspaceId: string;
  readonly snapshot: EvidenceProductSnapshot;
}): EvidencePrimaryWorkQueueView {
  const snapshot = structuredClone(input.snapshot);
  const workspace = requireWorkspace(snapshot, input.workspaceId);
  const sources = new Map(
    snapshot.sources.map((source) => [source.artifactVersionId, source]),
  );
  const observationItems = snapshot.observations.flatMap((observation) => {
    const decision = effectiveReviewDecision(
      snapshot.reviewDecisions,
      observation.observationId,
    );
    if (
      decision !== null &&
      !['leave-unresolved', 'request-revision'].includes(decision.action)
    )
      return [];
    const source = sources.get(observation.artifactVersionId);
    if (source === undefined)
      throw new RangeError(`Missing source for ${observation.observationId}.`);
    return [
      {
        itemId: `review:${observation.observationId}`,
        kind: 'source-observation' as const,
        observationVersionId: observation.observationId,
        sourceTitle: source.title,
        reason:
          decision?.action === 'request-revision'
            ? ('decision-requested' as const)
            : ('new-source-observation' as const),
        citation: citation(source, observation),
        targetPath: `/sources/${source.artifactVersionId}?observation=${observation.observationId}`,
      },
    ];
  });
  const relationItems = (snapshot.relations ?? []).flatMap((relation) => {
    const decision = effectiveReviewDecision(
      snapshot.reviewDecisions,
      relation.relationId,
    );
    if (
      decision !== null &&
      !['leave-unresolved', 'request-revision'].includes(decision.action)
    )
      return [];
    return [
      {
        itemId: `relation:${relation.relationId}`,
        kind: 'relation-review' as const,
        relationVersionId: relation.relationId,
        relationKind: relation.relationKind,
        reason:
          decision?.action === 'request-revision'
            ? ('decision-requested' as const)
            : ('new-relation' as const),
        summary: `${relation.relationKind.replaceAll('-', ' ')} between evidence records`,
        targetPath: `/relations#${relation.relationId}`,
      },
    ];
  });
  const notices = snapshot.assessments.flatMap((assessment) => {
    const decisions = assessmentDecisions(
      snapshot,
      assessment.assessmentVersionId,
    );
    const effectiveBasis = effectiveAssessmentBasis(assessment, decisions);
    return newEvidenceNotices(
      snapshot,
      workspace.evidenceRevision,
      assessment,
      effectiveBasis,
    );
  });
  const assessmentItems: Array<
    EvidencePrimaryWorkQueueView['nextItems'][number]
  > = [];
  for (const assessment of snapshot.assessments) {
    if (assessment.workspaceId !== workspace.workspaceId) continue;
    const decision = effectiveReviewDecision(
      snapshot.reviewDecisions,
      assessment.assessmentVersionId,
    );
    const assessmentNotices = notices.filter(
      (notice) => notice.assessmentVersionId === assessment.assessmentVersionId,
    );
    if (assessmentNotices.length > 0) {
      assessmentItems.push({
        itemId: `assessment-attention:${assessment.assessmentVersionId}`,
        kind: 'assessment-attention' as const,
        assessmentVersionId: assessment.assessmentVersionId,
        sequence: assessment.sequence,
        reason: 'new-evidence' as const,
        summary: 'New evidence was added after this assessment was reviewed.',
        targetPath: `/assessments/${assessment.assessmentVersionId}`,
      });
      continue;
    }
    if (
      decision !== null &&
      !['leave-unresolved', 'request-revision'].includes(decision.action)
    )
      continue;
    assessmentItems.push({
      itemId: `assessment-review:${assessment.assessmentVersionId}`,
      kind: 'assessment-review' as const,
      assessmentVersionId: assessment.assessmentVersionId,
      sequence: assessment.sequence,
      reason:
        decision?.action === 'request-revision'
          ? ('decision-requested' as const)
          : ('new-assessment' as const),
      summary: `Assessment version ${String(assessment.sequence)} requires review.`,
      targetPath: `/assessments/${assessment.assessmentVersionId}`,
    });
  }
  const nextItems = [
    ...observationItems,
    ...relationItems,
    ...assessmentItems,
  ].sort((left, right) => {
    const priority = {
      'assessment-attention': 0,
      'source-observation': 1,
      'relation-review': 2,
      'assessment-review': 3,
    } as const;
    if (priority[left.kind] !== priority[right.kind])
      return priority[left.kind] - priority[right.kind];
    if (
      left.kind === 'source-observation' &&
      right.kind === 'source-observation'
    ) {
      return (
        left.citation.display.localeCompare(right.citation.display) ||
        left.itemId.localeCompare(right.itemId)
      );
    }
    return left.itemId.localeCompare(right.itemId);
  });
  const recent = orderedReviewDecisions(snapshot.reviewDecisions).at(-1);
  return detached(
    EvidencePrimaryWorkQueueViewSchema.parse({
      schemaVersion: EVIDENCE_PRIMARY_WORK_QUEUE_VIEW_SCHEMA_VERSION,
      workspace: {
        workspaceId: workspace.workspaceId,
        label: workspace.label,
        evidenceRevision: workspace.evidenceRevision,
      },
      heading: 'Review queue',
      nextItems,
      newEvidenceNotices: notices,
      mostRecentAction:
        recent === undefined
          ? null
          : {
              targetVersionId: recent.targetVersionId,
              action: recent.action,
              reviewerRef: decisionActorRef(recent),
              rationale: recent.rationale,
              decidedAt: recent.decidedAt,
            },
    }),
  );
}

export function buildEvidencePrimaryAssessmentView(input: {
  readonly workspaceId: string;
  readonly assessmentVersionId: string;
  readonly snapshot: EvidenceProductSnapshot;
}): EvidencePrimaryAssessmentView {
  const snapshot = structuredClone(input.snapshot);
  const workspace = requireWorkspace(snapshot, input.workspaceId);
  const assessment = snapshot.assessments.find(
    (value) => value.assessmentVersionId === input.assessmentVersionId,
  );
  if (
    assessment === undefined ||
    assessment.workspaceId !== workspace.workspaceId
  )
    throw new RangeError(`Unknown assessment ${input.assessmentVersionId}.`);
  const decisions = assessmentDecisions(
    snapshot,
    assessment.assessmentVersionId,
  );
  const effective = effectiveReviewDecision(
    snapshot.reviewDecisions,
    assessment.assessmentVersionId,
  );
  const effectiveBasis = effectiveAssessmentBasis(assessment, decisions);
  const notices = newEvidenceNotices(
    snapshot,
    workspace.evidenceRevision,
    assessment,
    effectiveBasis,
  );
  const openQuestions = assessment.openQuestionIds.map((openQuestionId) => {
    const question = snapshot.openQuestions.find(
      (value) => value.openQuestionId === openQuestionId,
    );
    if (question === undefined) {
      return {
        openQuestionId,
        questionCode: 'QUESTION_PENDING_SOURCE_IMPORT',
        questionText:
          'This assessment preserves an open-question reference whose source context is not yet available at this evidence revision.',
        sourceCitations: [],
      };
    }
    return {
      openQuestionId,
      questionCode: question.questionCode,
      questionText: question.questionText,
      sourceCitations: question.triggeringEvidenceIds
        .filter((id) =>
          assessment.citations.some(({ evidenceId }) => evidenceId === id),
        )
        .map((id) => citationForEvidence(snapshot, assessment, id)),
    };
  });
  const reviewStanding = standing(effective);
  const shareable = ['accept', 'reaffirm'].includes(effective?.action ?? '');
  return detached(
    EvidencePrimaryAssessmentViewSchema.parse({
      schemaVersion: EVIDENCE_PRIMARY_ASSESSMENT_VIEW_SCHEMA_VERSION,
      workspace: {
        workspaceId: workspace.workspaceId,
        label: workspace.label,
        evidenceRevision: workspace.evidenceRevision,
      },
      heading: 'Reviewed evidence assessment',
      assessment: {
        assessmentVersionId: assessment.assessmentVersionId,
        sequence: assessment.sequence,
        basisEvidenceRevision: assessment.basisEvidenceRevision,
        effectiveBasisEvidenceRevision: effectiveBasis,
        contentHash: assessment.contentHash,
        predecessorAssessmentVersionId:
          assessment.predecessorAssessmentVersionId,
      },
      claims: assessment.claims.map((claim) => ({
        claimKey: claim.claimKey,
        text: claim.text,
        supportUnresolved: claim.supportUnresolved,
        uncertainty: claim.uncertainty,
        uncertaintyRationale: claim.uncertaintyRationale,
        supportCitations: claim.supportObservationIds.map((id) =>
          citationForEvidence(snapshot, assessment, id),
        ),
        conflictCitations: claim.conflictRelationIds.map((id) =>
          citationForEvidence(snapshot, assessment, id),
        ),
        qualificationCitations: claim.qualificationRelationIds.map((id) =>
          citationForEvidence(snapshot, assessment, id),
        ),
      })),
      openQuestions,
      reviewStanding,
      shareable,
      dueForAttention: notices.length > 0,
      newEvidenceNotices: notices,
      reviewChoices:
        notices.length > 0 && shareable
          ? ['reaffirm', 'request-revision']
          : ['accept', 'reject', 'request-revision'],
      reviewHistoryPath: `/reviews/assessment/${assessment.assessmentVersionId}`,
      exportPath: shareable
        ? `/api/assessments/${assessment.assessmentVersionId}/export`
        : null,
    }),
  );
}

export function buildEvidencePrimaryReviewHistoryView(input: {
  readonly workspaceId: string;
  readonly targetKind: 'observation' | 'relation' | 'assessment';
  readonly targetVersionId: string;
  readonly snapshot: EvidenceProductSnapshot;
}): EvidencePrimaryReviewHistoryView {
  const snapshot = structuredClone(input.snapshot);
  requireWorkspace(snapshot, input.workspaceId);
  const paths = {
    observation: `/observations/${input.targetVersionId}`,
    relation: `/relations/${input.targetVersionId}`,
    assessment: `/assessments/${input.targetVersionId}`,
  };
  const decisions = orderedReviewDecisions(snapshot.reviewDecisions)
    .filter(
      (decision) =>
        decision.workspaceId === input.workspaceId &&
        decision.targetKind === input.targetKind &&
        decision.targetVersionId === input.targetVersionId,
    )
    .map((decision) => ({
      reviewDecisionId: decision.reviewDecisionId,
      reviewerRef: decisionActorRef(decision),
      principalAssurance: decision.principalAssurance,
      action: decision.action,
      rationale: decision.rationale,
      decidedAt: decision.decidedAt,
      basisEvidenceRevision: decision.basisEvidenceRevision,
    }));
  return detached(
    EvidencePrimaryReviewHistoryViewSchema.parse({
      schemaVersion: EVIDENCE_PRIMARY_REVIEW_HISTORY_VIEW_SCHEMA_VERSION,
      workspaceId: input.workspaceId,
      heading: 'Review history',
      target: {
        targetKind: input.targetKind,
        targetVersionId: input.targetVersionId,
        immutableObjectPath: paths[input.targetKind],
      },
      decisions,
    }),
  );
}

export function buildEvidencePrimarySourceReviewView(input: {
  readonly workspaceId: string;
  readonly artifactVersionId: string;
  readonly snapshot: EvidenceProductSnapshot;
}): EvidencePrimarySourceReviewView {
  const snapshot = structuredClone(input.snapshot);
  requireWorkspace(snapshot, input.workspaceId);
  const source = requireSource(snapshot, input.artifactVersionId);
  const observations = snapshot.observations
    .filter((value) => value.artifactVersionId === source.artifactVersionId)
    .sort(
      (left, right) =>
        left.locator.startLine - right.locator.startLine ||
        left.observationId.localeCompare(right.observationId),
    )
    .map((observation) => {
      const actor = sourceActor(observation);
      const temporal = observation.temporalBound;
      return {
        observationVersionId: observation.observationId,
        kind: observation.kind,
        exactQuote: observation.exactQuote,
        citation: citation(source, observation),
        actor:
          actor === null
            ? null
            : {
                sourceLabel: actor.sourceLabel,
                sourceRole: actor.sourceRole,
                resolution: actor.resolution.status,
              },
        time:
          temporal === null
            ? null
            : {
                kind: temporal.kind,
                role: temporal.role,
                display: timeDisplay(temporal),
              },
        reviewStanding: standing(
          effectiveReviewDecision(
            snapshot.reviewDecisions,
            observation.observationId,
          ),
        ),
        reviewChoices: [
          'accept',
          'reject',
          'leave-unresolved',
          'request-revision',
        ] as const,
      };
    });
  return detached(
    EvidencePrimarySourceReviewViewSchema.parse({
      schemaVersion: EVIDENCE_PRIMARY_SOURCE_REVIEW_VIEW_SCHEMA_VERSION,
      workspaceId: input.workspaceId,
      source: {
        artifactVersionId: source.artifactVersionId,
        logicalArtifactId: source.logicalArtifactId,
        title: source.title,
        kind: source.kind,
        versionOrdinal: source.versionOrdinal,
        contentHash: source.contentHash,
        predecessorVersionId: source.predecessorVersionId,
        lines: (() => {
          const lines = source.text.split('\n');
          if (lines.at(-1) === '') lines.pop();
          return lines.map((text, index) => ({ lineNumber: index + 1, text }));
        })(),
      },
      heading: 'Source review',
      observations,
    }),
  );
}

export function buildEvidencePrimaryObservationLedgerView(input: {
  readonly workspaceId: string;
  readonly snapshot: EvidenceProductSnapshot;
  readonly evidenceState: EvidenceState;
}): EvidencePrimaryObservationLedgerView {
  const snapshot = structuredClone(input.snapshot);
  const state = EvidenceStateSchema.parse(structuredClone(input.evidenceState));
  const workspace = requireWorkspace(snapshot, input.workspaceId);
  requireProjectionRevision(workspace.evidenceRevision, state);
  const sources = new Map(
    snapshot.sources.map((source) => [source.artifactVersionId, source]),
  );
  const successorIds = new Set(
    snapshot.sources.flatMap(({ predecessorVersionId }) =>
      predecessorVersionId === null ? [] : [predecessorVersionId],
    ),
  );
  const standings = standingMap(state);
  const entries = snapshot.observations
    .map((observation) => {
      const source = sources.get(observation.artifactVersionId);
      if (source === undefined)
        throw new RangeError(
          `Missing source for ${observation.observationId}.`,
        );
      const actor = sourceActor(observation);
      return {
        observationVersionId: observation.observationId,
        source: sourceSummary(source),
        exactQuote: observation.exactQuote,
        citation: citation(source, observation),
        actorLabel: actor?.sourceLabel ?? null,
        timeDisplay:
          observation.temporalBound === null
            ? null
            : timeDisplay(observation.temporalBound),
        standing: requireObservationStanding(
          standings,
          observation.observationId,
        ),
        versionRole:
          source.predecessorVersionId !== null
            ? ('corrected-version' as const)
            : successorIds.has(source.artifactVersionId)
              ? ('original-version' as const)
              : ('independent-source' as const),
      };
    })
    .sort(
      (left, right) =>
        left.citation.display.localeCompare(right.citation.display) ||
        left.observationVersionId.localeCompare(right.observationVersionId),
    );
  const counts = {
    current: 0,
    contested: 0,
    superseded: 0,
    rejected: 0,
  };
  for (const entry of entries) counts[entry.standing] += 1;
  return detached(
    EvidencePrimaryObservationLedgerViewSchema.parse({
      schemaVersion: EVIDENCE_PRIMARY_OBSERVATION_LEDGER_VIEW_SCHEMA_VERSION,
      workspace: {
        workspaceId: workspace.workspaceId,
        label: workspace.label,
        evidenceRevision: workspace.evidenceRevision,
      },
      heading: 'Observation ledger',
      summary: { total: entries.length, ...counts },
      entries,
    }),
  );
}

export function buildEvidencePrimaryAccountComparisonView(input: {
  readonly workspaceId: string;
  readonly correctionLogicalArtifactId: string;
  readonly changedAccountLogicalArtifactIds: readonly string[];
  readonly snapshot: EvidenceProductSnapshot;
  readonly evidenceState: EvidenceState;
}): EvidencePrimaryAccountComparisonView {
  const snapshot = structuredClone(input.snapshot);
  const state = EvidenceStateSchema.parse(structuredClone(input.evidenceState));
  const workspace = requireWorkspace(snapshot, input.workspaceId);
  requireProjectionRevision(workspace.evidenceRevision, state);
  const correctionSources = snapshot.sources
    .filter(
      ({ logicalArtifactId }) =>
        logicalArtifactId === input.correctionLogicalArtifactId,
    )
    .sort((left, right) => left.versionOrdinal - right.versionOrdinal);
  if (correctionSources.length !== 2) {
    throw new RangeError(
      `Account comparison requires exactly two versions of ${input.correctionLogicalArtifactId}.`,
    );
  }
  const originalSource = correctionSources[0];
  const correctedSource = correctionSources[1];
  if (originalSource === undefined || correctedSource === undefined) {
    throw new RangeError('Account comparison correction sources are missing.');
  }
  const observationsFor = (source: SourceArtifactVersion) =>
    snapshot.observations.filter(
      ({ artifactVersionId }) => artifactVersionId === source.artifactVersionId,
    );
  const pairs = pairEvidenceCorrectionObservations({
    predecessorSource: originalSource,
    successorSource: correctedSource,
    predecessorObservations: observationsFor(originalSource),
    successorObservations: observationsFor(correctedSource),
  });
  const standings = standingMap(state);
  const laterAccounts = input.changedAccountLogicalArtifactIds
    .flatMap((logicalArtifactId) =>
      snapshot.sources.filter(
        (source) => source.logicalArtifactId === logicalArtifactId,
      ),
    )
    .sort(
      (left, right) =>
        left.logicalArtifactId.localeCompare(right.logicalArtifactId) ||
        left.versionOrdinal - right.versionOrdinal,
    )
    .map((source) => ({
      source: sourceSummary(source),
      label: 'Later changed account — retained separately' as const,
      observations: observationsFor(source)
        .map((observation) => ({
          observationVersionId: observation.observationId,
          exactQuote: observation.exactQuote,
          citation: citation(source, observation),
          standing: requireObservationStanding(
            standings,
            observation.observationId,
          ),
        }))
        .sort(
          (left, right) =>
            left.citation.startLine - right.citation.startLine ||
            left.observationVersionId.localeCompare(right.observationVersionId),
        ),
    }));
  const navigationSources = [
    originalSource,
    correctedSource,
    ...laterAccounts.map(({ source }) =>
      requireSource(snapshot, source.artifactVersionId),
    ),
  ];
  return detached(
    EvidencePrimaryAccountComparisonViewSchema.parse({
      schemaVersion: EVIDENCE_PRIMARY_ACCOUNT_COMPARISON_VIEW_SCHEMA_VERSION,
      workspaceId: input.workspaceId,
      heading: 'Account comparison',
      explanation:
        'A corrected transcript replaces only its paired earlier occurrences. A later account remains separately visible.',
      correction: {
        logicalArtifactId: input.correctionLogicalArtifactId,
        originalSource: sourceSummary(originalSource),
        correctedSource: sourceSummary(correctedSource),
        pairs: pairs.map(({ predecessor, successor }) => ({
          predecessorObservationVersionId: predecessor.observationId,
          successorObservationVersionId: successor.observationId,
          predecessorCitation: citation(originalSource, predecessor),
          successorCitation: citation(correctedSource, successor),
          predecessorQuote: predecessor.exactQuote,
          successorQuote: successor.exactQuote,
          predecessorStanding: requireObservationStanding(
            standings,
            predecessor.observationId,
          ),
          successorStanding: requireObservationStanding(
            standings,
            successor.observationId,
          ),
        })),
      },
      laterAccounts,
      priorVersionNavigation: navigationSources.map((source) => ({
        label: `${source.title} — version ${String(source.versionOrdinal)}`,
        sourcePath: `/sources/${source.artifactVersionId}`,
      })),
    }),
  );
}

export function buildEvidencePrimaryRelationReviewView(input: {
  readonly workspaceId: string;
  readonly snapshot: EvidenceProductSnapshot;
  readonly evidenceState: EvidenceState;
}): EvidencePrimaryRelationReviewView {
  const snapshot = structuredClone(input.snapshot);
  const state = EvidenceStateSchema.parse(structuredClone(input.evidenceState));
  const workspace = requireWorkspace(snapshot, input.workspaceId);
  requireProjectionRevision(workspace.evidenceRevision, state);
  const observations = new Map(
    snapshot.observations.map((observation) => [
      observation.observationId,
      observation,
    ]),
  );
  const standings = objectStandingMap(state);
  const byKind = {
    supports: 0,
    contradicts: 0,
    qualifies: 0,
    'scope-mismatch': 0,
    duplicate: 0,
    correction: 0,
    unresolved: 0,
  };
  let unresolvedActorRelations = 0;
  let awaitingReview = 0;
  const relations = [...(snapshot.relations ?? [])]
    .sort((left, right) => left.relationId.localeCompare(right.relationId))
    .map((relation) => {
      byKind[relation.relationKind] += 1;
      if (relation.relationKind === 'unresolved') unresolvedActorRelations += 1;
      const review = effectiveReviewDecision(
        snapshot.reviewDecisions,
        relation.relationId,
      );
      const reviewStanding = standing(review);
      if (
        review === null ||
        ['leave-unresolved', 'request-revision'].includes(review.action)
      ) {
        awaitingReview += 1;
      }
      return {
        relationVersionId: relation.relationId,
        relationKind: relation.relationKind,
        endpoints: relation.endpoints.map((endpoint) => ({
          kind: endpoint.kind,
          id: endpoint.id,
          display: endpointDisplay(endpoint, observations),
        })),
        scopeSubject: relation.comparableScope.subject,
        scopeAspect: relation.comparableScope.aspect,
        rationaleCode: relation.rationaleCode,
        rationale: relation.rationale,
        standing: standings.get(relation.relationId) ?? ('current' as const),
        reviewStanding,
        reviewChoices: [
          'accept',
          'reject',
          'leave-unresolved',
          'request-revision',
        ] as const,
      };
    });
  const openQuestions = [...(snapshot.openQuestions ?? [])]
    .sort((left, right) =>
      left.openQuestionId.localeCompare(right.openQuestionId),
    )
    .map((question) => ({
      openQuestionId: question.openQuestionId,
      questionCode: question.questionCode,
      questionText: question.questionText,
      triggeringEvidenceIds: [...question.triggeringEvidenceIds],
      standing: standings.get(question.openQuestionId) ?? ('current' as const),
    }));
  return detached(
    EvidencePrimaryRelationReviewViewSchema.parse({
      schemaVersion: EVIDENCE_PRIMARY_RELATION_REVIEW_VIEW_SCHEMA_VERSION,
      workspace: {
        workspaceId: workspace.workspaceId,
        label: workspace.label,
        evidenceRevision: workspace.evidenceRevision,
      },
      heading: 'Relation review',
      explanation:
        'Relations connect exact endpoints with a scoped comparison. Accept, reject or leave each one unresolved without overwriting the linked observations.',
      metrics: {
        relationTotal: relations.length,
        byKind,
        unresolvedActorRelations,
        openQuestionTotal: openQuestions.length,
        awaitingReview,
      },
      relations,
      openQuestions,
    }),
  );
}

export function buildEvidencePrimaryTimelineView(input: {
  readonly workspaceId: string;
  readonly snapshot: EvidenceProductSnapshot;
}): EvidencePrimaryTimelineView {
  const snapshot = structuredClone(input.snapshot);
  const workspace = requireWorkspace(snapshot, input.workspaceId);
  const sources = new Map(
    snapshot.sources.map((source) => [source.artifactVersionId, source]),
  );
  const observations = snapshot.observations.filter(
    (observation) => observation.temporalBound !== null,
  );
  const entries = buildEvidenceTimelineEntries(
    observations.map((observation) => ({
      observationId: observation.observationId,
      temporalBound: observation.temporalBound as EvidenceTemporalBound,
    })),
  ).map((entry) => {
    const sourceLinks = entry.observationIds.flatMap((observationId) => {
      const observation = observations.find(
        (item) => item.observationId === observationId,
      );
      if (observation === undefined) return [];
      const source = sources.get(observation.artifactVersionId);
      if (source === undefined) return [];
      return [
        {
          observationVersionId: observationId,
          citation: citation(source, observation),
        },
      ];
    });
    return {
      entryId: entry.entryId,
      bandKind: entry.bandKind,
      display: entry.display,
      observationVersionIds: [...entry.observationIds],
      sourceLinks,
    };
  });
  return detached(
    EvidencePrimaryTimelineViewSchema.parse({
      schemaVersion: EVIDENCE_PRIMARY_TIMELINE_VIEW_SCHEMA_VERSION,
      workspace: {
        workspaceId: workspace.workspaceId,
        label: workspace.label,
        evidenceRevision: workspace.evidenceRevision,
      },
      heading: 'Timeline',
      explanation:
        'Entries keep exact, range, approximate and unknown labels. Overlapping non-exact bounds form ambiguity bands. Precision is never invented.',
      entries,
    }),
  );
}

export function buildEvidencePrimaryOpenQuestionsView(input: {
  readonly workspaceId: string;
  readonly snapshot: EvidenceProductSnapshot;
  readonly evidenceState: EvidenceState;
}): EvidencePrimaryOpenQuestionsView {
  const snapshot = structuredClone(input.snapshot);
  const state = EvidenceStateSchema.parse(structuredClone(input.evidenceState));
  const workspace = requireWorkspace(snapshot, input.workspaceId);
  requireProjectionRevision(workspace.evidenceRevision, state);
  const sources = new Map(
    snapshot.sources.map((source) => [source.artifactVersionId, source]),
  );
  const observations = new Map(
    snapshot.observations.map((observation) => [
      observation.observationId,
      observation,
    ]),
  );
  const standings = objectStandingMap(state);
  const questions = [...(snapshot.openQuestions ?? [])]
    .sort((left, right) =>
      left.openQuestionId.localeCompare(right.openQuestionId),
    )
    .map((question) => {
      const sourceLinks = question.triggeringEvidenceIds.flatMap(
        (evidenceId) => {
          const observation = observations.get(evidenceId);
          if (observation === undefined) return [];
          const source = sources.get(observation.artifactVersionId);
          if (source === undefined) return [];
          return [
            {
              observationVersionId: observation.observationId,
              citation: citation(source, observation),
            },
          ];
        },
      );
      return {
        openQuestionId: question.openQuestionId,
        questionCode: question.questionCode,
        questionText: question.questionText,
        standing:
          standings.get(question.openQuestionId) ?? ('current' as const),
        triggeringEvidenceIds: [...question.triggeringEvidenceIds],
        sourceLinks,
      };
    });
  return detached(
    EvidencePrimaryOpenQuestionsViewSchema.parse({
      schemaVersion: EVIDENCE_PRIMARY_OPEN_QUESTIONS_VIEW_SCHEMA_VERSION,
      workspace: {
        workspaceId: workspace.workspaceId,
        label: workspace.label,
        evidenceRevision: workspace.evidenceRevision,
      },
      heading: 'Open questions',
      explanation:
        'Open questions mark gaps exposed by the evidence. Absence of an answer is not treated as falsity.',
      questions,
    }),
  );
}

export function buildEvidenceTechnicalProvenanceView(input: {
  readonly domainObjectId: string;
  readonly executionId: string;
  readonly contractId: string;
  readonly contractVersion: string;
  readonly contractFingerprint: string;
  readonly operationDigest: string | null;
  readonly retainedCallAvailable: boolean;
}): EvidenceTechnicalProvenanceView {
  return detached(
    EvidenceTechnicalProvenanceViewSchema.parse({
      schemaVersion: EVIDENCE_TECHNICAL_PROVENANCE_VIEW_SCHEMA_VERSION,
      classification: 'technical-audit',
      domainObjectId: input.domainObjectId,
      executionId: input.executionId,
      contractId: input.contractId,
      contractVersion: input.contractVersion,
      contractFingerprint: input.contractFingerprint,
      operationDigest: input.operationDigest,
      retainedCallAvailable: input.retainedCallAvailable,
    }),
  );
}

export function buildEvidenceTechnicalReplayView(input: {
  readonly executionId: string;
  readonly replayVerdict: 'match' | 'different' | 'unavailable';
  readonly recordedDigest: string | null;
  readonly currentDigest: string | null;
  readonly reason: string;
}): EvidenceTechnicalReplayView {
  return detached(
    EvidenceTechnicalReplayViewSchema.parse({
      schemaVersion: EVIDENCE_TECHNICAL_REPLAY_VIEW_SCHEMA_VERSION,
      classification: 'technical-audit',
      executionId: input.executionId,
      replayVerdict: input.replayVerdict,
      recordedDigest: input.recordedDigest,
      currentDigest: input.currentDigest,
      reason: input.reason,
      providerCallCount: 0,
    }),
  );
}
