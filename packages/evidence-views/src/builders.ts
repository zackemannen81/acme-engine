import {
  effectiveReviewDecision,
  orderedReviewDecisions,
  type EvidenceProductSnapshot,
  type EvidenceReviewDecision,
} from '@acme/evidence-product-contracts';
import type {
  EvidenceObservation,
  EvidenceRelation,
  EvidenceState,
  EvidenceTemporalBound,
  SourceArtifactVersion,
} from '@acme/module-evidence';
import {
  EvidenceStateSchema,
  pairEvidenceCorrectionObservations,
} from '@acme/module-evidence';

import {
  EVIDENCE_PRIMARY_ACCOUNT_COMPARISON_VIEW_SCHEMA_VERSION,
  EVIDENCE_PRIMARY_OBSERVATION_LEDGER_VIEW_SCHEMA_VERSION,
  EVIDENCE_PRIMARY_RELATION_REVIEW_VIEW_SCHEMA_VERSION,
  EVIDENCE_PRIMARY_SOURCE_REVIEW_VIEW_SCHEMA_VERSION,
  EVIDENCE_PRIMARY_WORK_QUEUE_VIEW_SCHEMA_VERSION,
  EvidencePrimaryAccountComparisonViewSchema,
  EvidencePrimaryObservationLedgerViewSchema,
  EvidencePrimaryRelationReviewViewSchema,
  EvidencePrimarySourceReviewViewSchema,
  EvidencePrimaryWorkQueueViewSchema,
  type EvidencePrimaryAccountComparisonView,
  type EvidencePrimaryObservationLedgerView,
  type EvidencePrimaryRelationReviewView,
  type EvidencePrimarySourceReviewView,
  type EvidencePrimaryWorkQueueView,
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
        summary: `${relation.relationKind}: ${relation.comparableScope.subject} / ${relation.comparableScope.aspect}`,
        targetPath: `/relations#${relation.relationId}`,
      },
    ];
  });
  const nextItems = [...observationItems, ...relationItems].sort(
    (left, right) => {
      if (
        left.kind === 'source-observation' &&
        right.kind === 'source-observation'
      ) {
        return (
          left.citation.display.localeCompare(right.citation.display) ||
          left.itemId.localeCompare(right.itemId)
        );
      }
      if (left.kind === 'source-observation') return -1;
      if (right.kind === 'source-observation') return 1;
      return left.itemId.localeCompare(right.itemId);
    },
  );
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
      mostRecentAction:
        recent === undefined
          ? null
          : {
              targetVersionId: recent.targetVersionId,
              action: recent.action,
              reviewerRef: recent.reviewerRef,
              rationale: recent.rationale,
              decidedAt: recent.decidedAt,
            },
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
