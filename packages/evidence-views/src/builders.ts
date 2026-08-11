import {
  effectiveReviewDecision,
  orderedReviewDecisions,
  type EvidenceProductSnapshot,
  type EvidenceReviewDecision,
} from '@acme/evidence-product-contracts';
import type {
  EvidenceObservation,
  EvidenceTemporalBound,
  SourceArtifactVersion,
} from '@acme/module-evidence';

import {
  EVIDENCE_PRIMARY_SOURCE_REVIEW_VIEW_SCHEMA_VERSION,
  EVIDENCE_PRIMARY_WORK_QUEUE_VIEW_SCHEMA_VERSION,
  EvidencePrimarySourceReviewViewSchema,
  EvidencePrimaryWorkQueueViewSchema,
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

export function buildEvidencePrimaryWorkQueueView(input: {
  readonly workspaceId: string;
  readonly snapshot: EvidenceProductSnapshot;
}): EvidencePrimaryWorkQueueView {
  const snapshot = structuredClone(input.snapshot);
  const workspace = requireWorkspace(snapshot, input.workspaceId);
  const sources = new Map(
    snapshot.sources.map((source) => [source.artifactVersionId, source]),
  );
  const nextItems = snapshot.observations
    .flatMap((observation) => {
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
        throw new RangeError(
          `Missing source for ${observation.observationId}.`,
        );
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
    })
    .sort(
      (left, right) =>
        left.citation.display.localeCompare(right.citation.display) ||
        left.itemId.localeCompare(right.itemId),
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
