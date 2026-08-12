import { canonicalJson, sha256 } from '@acme/core';
import { evidenceTemporalOverlap } from '@acme/module-evidence';
import type {
  EvidenceObservation,
  EvidenceRelation,
  EvidenceTemporalBound,
} from '@acme/module-evidence';
import { z } from 'zod';

import { effectiveReviewDecision } from './review.js';
import type { EvidenceProductSnapshot } from './schemas.js';

const NonBlank = z.string().trim().min(1);
const Digest = z.string().regex(/^[a-f0-9]{64}$/u);

const CitationSchema = z
  .object({
    observationId: NonBlank,
    artifactVersionId: NonBlank,
    locatorId: NonBlank,
    exactQuote: NonBlank,
  })
  .strict();

export const EvidenceCaseOverviewSchema = z
  .object({
    schemaVersion: z.literal('evidence-case-overview/1'),
    snapshotDigest: Digest,
    counts: z
      .object({
        sources: z.number().int().nonnegative(),
        pendingObservations: z.number().int().nonnegative(),
        pendingRelations: z.number().int().nonnegative(),
        openQuestions: z.number().int().nonnegative(),
        assessmentsNeedingReview: z.number().int().nonnegative(),
      })
      .strict(),
    recentActivity: z
      .array(
        z
          .object({
            activityId: NonBlank,
            action: NonBlank,
            targetKind: NonBlank,
            targetVersionId: NonBlank,
            principalRef: NonBlank,
            occurredAt: z.iso.datetime({ offset: true }),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

export const EvidenceCaseIntegrityReportSchema = z
  .object({
    schemaVersion: z.literal('evidence-case-integrity-report/1'),
    reportId: NonBlank,
    snapshotDigest: Digest,
    counts: z
      .object({
        sourceBoundObservations: z.number().int().nonnegative(),
        changedAccountPairs: z.number().int().nonnegative(),
        scopedContradictions: z.number().int().nonnegative(),
        qualifications: z.number().int().nonnegative(),
        corrections: z.number().int().nonnegative(),
        temporalConflicts: z.number().int().nonnegative(),
        unresolvedQuestions: z.number().int().nonnegative(),
        assessmentsAffectedByNewEvidence: z.number().int().nonnegative(),
      })
      .strict(),
    rows: z.array(
      z
        .object({
          rowId: NonBlank,
          kind: z.enum([
            'changed-account',
            'contradiction',
            'qualification',
            'correction',
            'temporal-conflict',
            'unresolved-question',
            'assessment-attention',
          ]),
          title: NonBlank,
          summary: NonBlank,
          relationId: NonBlank.nullable(),
          openQuestionId: NonBlank.nullable(),
          assessmentVersionId: NonBlank.nullable(),
          citations: z.array(CitationSchema).min(1),
        })
        .strict(),
    ),
  })
  .strict();

type IntegrityRow = z.input<
  typeof EvidenceCaseIntegrityReportSchema
>['rows'][number];
type IntegrityRowKind = IntegrityRow['kind'];

/**
 * The snapshot digest is an order-insensitive projection of exactly the
 * evidence and review overlay both read models derive from. Volatile
 * material — jobs, staging, audit records and import bookkeeping — is
 * excluded so a report basis changes only when the case content it reports
 * on changes.
 */
function snapshotDigest(snapshot: EvidenceProductSnapshot): string {
  const sorted = (values: readonly unknown[]): readonly string[] =>
    values.map((value) => canonicalJson(value as never)).sort();
  return sha256(
    canonicalJson({
      algorithm: 'evidence-case-insight-snapshot/1',
      workspaces: sorted(
        snapshot.workspaces.map((item) => [
          item.workspaceId,
          item.evidenceRevision,
        ]),
      ),
      sources: sorted(
        snapshot.sources.map((item) => [
          item.artifactVersionId,
          item.logicalArtifactId,
          item.versionOrdinal,
        ]),
      ),
      observations: sorted(
        snapshot.observations.map((item) => [
          item.observationId,
          item.artifactVersionId,
          item.locator.locatorId,
          item.exactQuote,
        ]),
      ),
      relations: sorted(snapshot.relations.map((item) => item.relationId)),
      openQuestions: sorted(
        snapshot.openQuestions.map((item) => item.openQuestionId),
      ),
      assessments: sorted(
        snapshot.assessments.map((item) => [
          item.assessmentVersionId,
          item.basisEvidenceRevision,
        ]),
      ),
      reviewDecisions: sorted(
        snapshot.reviewDecisions.map((item) => [
          item.reviewDecisionId,
          item.targetKind,
          item.targetVersionId,
          item.action,
        ]),
      ),
    } as never),
  );
}

function rowId(kind: IntegrityRowKind, id: string): string {
  return `integrity-${sha256(
    canonicalJson({
      algorithm: 'evidence-case-integrity-row-id/1',
      kind,
      id,
    }),
  )}`;
}

function citation(snapshot: EvidenceProductSnapshot, observationId: string) {
  const observation = snapshot.observations.find(
    (item) => item.observationId === observationId,
  );
  return observation === undefined
    ? null
    : {
        observationId: observation.observationId,
        artifactVersionId: observation.artifactVersionId,
        locatorId: observation.locator.locatorId,
        exactQuote: observation.exactQuote,
      };
}

/** Only a human-or-deterministically resolved actor may be compared. */
function resolvedActorKey(observation: EvidenceObservation): string | null {
  const reference =
    observation.kind === 'statement-occurrence'
      ? observation.actorReference
      : observation.sourceActorReference;
  return reference !== null && reference.resolution.status === 'resolved'
    ? reference.resolution.actorKey
    : null;
}

function logicalArtifactId(
  snapshot: EvidenceProductSnapshot,
  observation: EvidenceObservation,
): string | null {
  return (
    snapshot.sources.find(
      (item) => item.artifactVersionId === observation.artifactVersionId,
    )?.logicalArtifactId ?? null
  );
}

/**
 * A changed account is the same resolved actor speaking again in a different
 * logical artifact. The technical specification keeps that separate from a
 * correction, which stays inside one logical artifact lineage, and never lets
 * a later account supersede an earlier one.
 */
function isChangedAccount(
  snapshot: EvidenceProductSnapshot,
  observations: readonly EvidenceObservation[],
): boolean {
  const accounts = observations
    .map((observation) => ({
      actorKey: resolvedActorKey(observation),
      logical: logicalArtifactId(snapshot, observation),
    }))
    .filter(
      (item): item is { actorKey: string; logical: string } =>
        item.actorKey !== null && item.logical !== null,
    );
  return accounts.some((left) =>
    accounts.some(
      (right) =>
        left.actorKey === right.actorKey && left.logical !== right.logical,
    ),
  );
}

/**
 * A contradiction is temporal when the typed bounds it compares cannot both
 * stand: either two known bounds do not overlap, or a recorded document time
 * is set against a claimed event time. Free-text rationale is model-authored
 * and never classifies a row.
 */
function isTemporalConflict(bounds: readonly EvidenceTemporalBound[]): boolean {
  const known = bounds.filter((bound) => bound.kind !== 'unknown');
  const disjoint = known.some((left, index) =>
    known
      .slice(index + 1)
      .some((right) => !evidenceTemporalOverlap(left, right)),
  );
  const roles = new Set(known.map((bound) => bound.role));
  return (
    disjoint || (roles.has('document-time') && roles.has('claimed-event-time'))
  );
}

function classifyRelation(
  snapshot: EvidenceProductSnapshot,
  relation: EvidenceRelation,
  observations: readonly EvidenceObservation[],
): IntegrityRowKind | null {
  if (relation.relationKind === 'correction') return 'correction';
  if (
    relation.relationKind !== 'contradicts' &&
    relation.relationKind !== 'qualifies'
  )
    return null;
  if (isChangedAccount(snapshot, observations)) return 'changed-account';
  if (relation.relationKind === 'qualifies') return 'qualification';
  return isTemporalConflict(relation.comparableScope.temporalBounds)
    ? 'temporal-conflict'
    : 'contradiction';
}

function assessmentNeedsReview(
  snapshot: EvidenceProductSnapshot,
  assessmentVersionId: string,
): boolean {
  const assessment = snapshot.assessments.find(
    (item) => item.assessmentVersionId === assessmentVersionId,
  );
  if (assessment === undefined) return false;
  const evidenceRevision = snapshot.workspaces.reduce(
    (highest, workspace) => Math.max(highest, workspace.evidenceRevision),
    0,
  );
  const decision = effectiveReviewDecision(
    snapshot.reviewDecisions.filter((item) => item.targetKind === 'assessment'),
    assessmentVersionId,
  );
  return (
    assessment.basisEvidenceRevision < evidenceRevision ||
    decision?.action === 'request-revision'
  );
}

export function buildEvidenceCaseOverview(snapshot: EvidenceProductSnapshot) {
  const reviewed = (kind: 'observation' | 'relation', id: string) =>
    effectiveReviewDecision(
      snapshot.reviewDecisions.filter((item) => item.targetKind === kind),
      id,
    ) !== null;
  return EvidenceCaseOverviewSchema.parse({
    schemaVersion: 'evidence-case-overview/1',
    snapshotDigest: snapshotDigest(snapshot),
    counts: {
      sources: snapshot.sources.length,
      pendingObservations: snapshot.observations.filter(
        (item) => !reviewed('observation', item.observationId),
      ).length,
      pendingRelations: snapshot.relations.filter(
        (item) => !reviewed('relation', item.relationId),
      ).length,
      openQuestions: snapshot.openQuestions.length,
      assessmentsNeedingReview: snapshot.assessments.filter((item) =>
        assessmentNeedsReview(snapshot, item.assessmentVersionId),
      ).length,
    },
    recentActivity: [...snapshot.reviewActivity]
      .sort(
        (left, right) =>
          right.occurredAt.localeCompare(left.occurredAt) ||
          right.activityId.localeCompare(left.activityId),
      )
      .slice(0, 20)
      .map(
        ({
          activityId,
          action,
          targetKind,
          targetVersionId,
          principalRef,
          occurredAt,
        }) => ({
          activityId,
          action,
          targetKind,
          targetVersionId,
          principalRef,
          occurredAt,
        }),
      ),
  });
}

export function buildEvidenceCaseIntegrityReport(
  snapshot: EvidenceProductSnapshot,
) {
  const rows: IntegrityRow[] = [];
  for (const relation of snapshot.relations) {
    const observations = relation.endpoints
      .filter((endpoint) => endpoint.kind === 'observation')
      .map((endpoint) =>
        snapshot.observations.find(
          (item) => item.observationId === endpoint.id,
        ),
      )
      .filter((item): item is EvidenceObservation => item !== undefined);
    const kind = classifyRelation(snapshot, relation, observations);
    if (kind === null) continue;
    const citations = observations
      .map((observation) => citation(snapshot, observation.observationId))
      .filter((item): item is NonNullable<typeof item> => item !== null);
    if (citations.length === 0) continue;
    rows.push({
      rowId: rowId(kind, relation.relationId),
      kind,
      title: `${kind.replaceAll('-', ' ')}: ${relation.comparableScope.subject}`,
      summary: relation.rationale,
      relationId: relation.relationId,
      openQuestionId: null,
      assessmentVersionId: null,
      citations,
    });
  }
  for (const question of snapshot.openQuestions) {
    const citations = question.triggeringEvidenceIds
      .map((id) => citation(snapshot, id))
      .filter((item): item is NonNullable<typeof item> => item !== null);
    if (citations.length === 0) continue;
    rows.push({
      rowId: rowId('unresolved-question', question.openQuestionId),
      kind: 'unresolved-question',
      title: question.questionCode,
      summary: question.questionText,
      relationId: null,
      openQuestionId: question.openQuestionId,
      assessmentVersionId: null,
      citations,
    });
  }
  for (const assessment of snapshot.assessments) {
    if (!assessmentNeedsReview(snapshot, assessment.assessmentVersionId))
      continue;
    const citations = assessment.citations
      .map((item) => citation(snapshot, item.evidenceId))
      .filter((item): item is NonNullable<typeof item> => item !== null);
    if (citations.length === 0) continue;
    rows.push({
      rowId: rowId('assessment-attention', assessment.assessmentVersionId),
      kind: 'assessment-attention',
      title: `Assessment ${assessment.sequence} needs re-review`,
      summary:
        'New evidence or an explicit review decision requires renewed assessment review.',
      relationId: null,
      openQuestionId: null,
      assessmentVersionId: assessment.assessmentVersionId,
      citations,
    });
  }
  rows.sort(
    (left, right) =>
      left.kind.localeCompare(right.kind) ||
      left.rowId.localeCompare(right.rowId),
  );
  const count = (kind: IntegrityRowKind) =>
    rows.filter((row) => row.kind === kind).length;
  const digest = snapshotDigest(snapshot);
  return EvidenceCaseIntegrityReportSchema.parse({
    schemaVersion: 'evidence-case-integrity-report/1',
    reportId: `integrity-report-${sha256(
      canonicalJson({
        algorithm: 'evidence-case-integrity-report-id/1',
        schemaVersion: 'evidence-case-integrity-report/1',
        snapshotDigest: digest,
        rows,
      } as never),
    )}`,
    snapshotDigest: digest,
    counts: {
      sourceBoundObservations: snapshot.observations.length,
      changedAccountPairs: count('changed-account'),
      scopedContradictions: count('contradiction'),
      qualifications: count('qualification'),
      corrections: count('correction'),
      temporalConflicts: count('temporal-conflict'),
      unresolvedQuestions: count('unresolved-question'),
      assessmentsAffectedByNewEvidence: count('assessment-attention'),
    },
    rows,
  });
}

export type EvidenceCaseOverview = z.infer<typeof EvidenceCaseOverviewSchema>;
export type EvidenceCaseIntegrityReport = z.infer<
  typeof EvidenceCaseIntegrityReportSchema
>;
